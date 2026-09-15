import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import url from "node:url";

import { compileOpenNextConfig } from "@opennextjs/aws/build/compileConfig.js";
import { normalizeOptions } from "@opennextjs/aws/build/helper.js";
import { printHeader, showWarningOnWindows } from "@opennextjs/aws/build/utils.js";
import logger from "@opennextjs/aws/logger.js";
import { unstable_readConfig } from "wrangler";
import type yargs from "yargs";

import type { OpenNextConfig } from "../../../api/config.js";
import { getOutputWorkerPath } from "../../build/bundle-server.js";
import { ensureCloudflareConfig } from "../../build/utils/ensure-cf-config.js";
import { askConfirmation } from "../../utils/ask-confirmation.js";
import {
	createOpenNextConfigFile,
	findOpenNextConfig,
	OPEN_NEXT_CONFIG_FILE_NAME,
} from "../../utils/create-open-next-config.js";
import { isNonInteractiveOrCI } from "../../utils/is-interactive.js";

export type WithWranglerArgs<T = unknown> = T & {
	// Array of arguments that can be given to wrangler commands, including the `--config` and `--env` args.
	wranglerArgs: string[];
	wranglerConfigPath: string | undefined;
	env: string | undefined;
};

export const nextAppDir = process.cwd();

/**
 * Print headers and warnings for the CLI.
 *
 * @param command
 */
export function printHeaders(command: string) {
	printHeader(`Cloudflare ${command}`);

	showWarningOnWindows();
}

/**
 * Compile the OpenNext config.
 *
 * When users do not specify a custom config file (using `--openNextConfigPath`),
 * the CLI will offer to create one.
 *
 * When users specify a custom config file but it doesn't exist, we throw an Error.
 *
 * @throws If a custom config path is provided but the file does not exist.
 * @throws If no config file is found and the user declines to create one.
 *
 * @param configPath Optional path to the config file. Absolute or relative to cwd.
 * @returns The compiled OpenNext config and the build directory.
 *
 */
export async function compileConfig(configPath: string | undefined) {
	if (configPath && !existsSync(configPath)) {
		throw new Error(`Custom config file not found at ${configPath}`);
	}

	configPath ??= findOpenNextConfig(nextAppDir);

	if (!configPath) {
		// In non-interactive environments (CI, Cloudflare Workers Builds,
		// Docker, etc.) there is no TTY to answer a prompt — the build would
		// hang or crash. Fail fast with an actionable message instead.
		if (isNonInteractiveOrCI()) {
			throw new Error(
				`No \`${OPEN_NEXT_CONFIG_FILE_NAME}\` file was found in the project root.\n\nThis file is required for OpenNext Cloudflare builds.\nRun \`opennextjs-cloudflare migrate\` to create it, or see https://opennext.js.org/cloudflare/get-started for setup guidance.\nCommit it and re-run the build.`
			);
		}

		const answer = await askConfirmation(
			`Missing required \`${OPEN_NEXT_CONFIG_FILE_NAME}\` file, do you want to create one?`
		);

		if (!answer) {
			throw new Error(`The \`${OPEN_NEXT_CONFIG_FILE_NAME}\` file is required, aborting!`);
		}

		configPath = createOpenNextConfigFile(nextAppDir, { cache: false });
	}

	const { config, buildDir } = await compileOpenNextConfig(configPath, { compileEdge: true });
	ensureCloudflareConfig(config);

	return { config, buildDir };
}

const MISSING_BUILD_ERROR = "Could not find compiled Open Next config, did you run the build command?";

/**
 * Retrieve a compiled OpenNext config, and ensure it is for Cloudflare.
 *
 * @returns OpenNext config.
 */
export async function retrieveCompiledConfig() {
	const compiledConfigPath = path.join(nextAppDir, ".open-next/.build/open-next.config.edge.mjs");

	if (existsSync(compiledConfigPath)) {
		const config = await import(url.pathToFileURL(compiledConfigPath).href).then((mod) => mod.default);
		ensureCloudflareConfig(config);

		return { config };
	}

	// The path above does not follow a custom `buildOutputPath`, and that value cannot be resolved
	// here -- it lives in the very config we are trying to load. Recompile from the source config
	// to find out where the build output actually is; `compileOpenNextConfig` emits to a temp dir,
	// so nothing lands in the project.
	//
	// `findOpenNextConfig` is checked first so that a missing source config never reaches
	// `compileConfig`, which would offer to create one -- these commands must not write to the
	// project, and "no config at all" means the app was never built.
	const sourceConfigPath = findOpenNextConfig(nextAppDir);

	if (!sourceConfigPath) {
		logger.error(MISSING_BUILD_ERROR);
		process.exit(1);
	}

	const { config, buildDir } = await compileConfig(sourceConfigPath);

	// A source config on its own does not mean the app was built, so check for the worker the
	// build emits. Without this, forgetting to build would surface as an obscure failure later.
	if (!existsSync(getOutputWorkerPath(getNormalizedOptions(config)))) {
		logger.error(MISSING_BUILD_ERROR);
		process.exit(1);
	}

	return { config, buildDir };
}

/**
 * Normalize the OpenNext options and set the logging level.
 *
 * @param config
 * @param buildDir Directory to use when building the application
 * @returns Normalized options.
 */
export function getNormalizedOptions(config: OpenNextConfig, buildDir = nextAppDir) {
	const require = createRequire(import.meta.url);
	const openNextDistDir = path.dirname(require.resolve("@opennextjs/aws/index.js"));

	const options = normalizeOptions(config, openNextDistDir, buildDir);
	logger.setLevel(options.debug ? "debug" : "info");

	return options;
}

/**
 * Read the Wrangler config.
 *
 * @param args Wrangler environment and config path.
 * @returns Wrangler config.
 */
export async function readWranglerConfig(args: WithWranglerArgs) {
	// Note: `unstable_readConfig` is sync as of wrangler 4.60.0
	//       But it will eventually become async.
	//       See https://github.com/cloudflare/workers-sdk/pull/12031
	return await unstable_readConfig({ env: args.env, config: args.wranglerConfigPath });
}

/**
 * Adds flags for the wrangler config path and environment to the yargs configuration.
 */
export function withWranglerOptions<T extends yargs.Argv>(args: T) {
	return args
		.option("config", {
			type: "string",
			alias: "c",
			desc: "Path to Wrangler configuration file",
		})
		.option("configPath", {
			type: "string",
			desc: "Path to Wrangler configuration file",
			deprecated: true,
		})
		.option("env", {
			type: "string",
			alias: "e",
			desc: "Wrangler environment to use for operations",
		});
}

type WranglerInputArgs = {
	configPath: string | undefined;
	config: string | undefined;
	env: string | undefined;
	remote?: boolean | undefined;
};

/**
 *
 * @param args
 * @returns An array of arguments that can be given to wrangler commands, including the `--config` and `--env` args.
 */
function getWranglerArgs(
	args: WranglerInputArgs & {
		_: (string | number)[];
		args?: (string | number)[];
	}
): string[] {
	if (args.configPath) {
		logger.warn("The `--configPath` flag is deprecated, please use `--config` instead.");

		if (args.config) {
			logger.error(
				"Multiple config flags found. Please use the `--config` flag for your Wrangler config path."
			);
			process.exit(1);
		}
	}

	return [
		...(args.configPath ? ["--config", args.configPath] : []),
		...(args.config ? ["--config", args.config] : []),
		...(args.env ? ["--env", args.env] : []),
		...(args.remote ? ["--remote"] : []),
		// Note: the `args` array contains unrecognised flags.
		...(args.args?.map((a) => `${a}`) ?? []),
	];
}

/**
 *
 * @param args
 * @returns The inputted args, and an array of arguments that can be given to wrangler commands, including the `--config` and `--env` args.
 */
export function withWranglerPassthroughArgs<T extends yargs.ArgumentsCamelCase<WranglerInputArgs>>(
	args: T
): WithWranglerArgs<T> {
	return {
		...args,
		wranglerConfigPath: args.config ?? args.configPath,
		wranglerArgs: getWranglerArgs(args),
	};
}
