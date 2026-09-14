import logger from "@opennextjs/aws/logger.js";
import type yargs from "yargs";

import { DEPLOYMENT_MAPPING_ENV_NAME } from "../templates/skew-protection.js";
import { populateCache, withPopulateCacheOptions } from "./populate-cache.js";
import { getDeploymentMapping } from "./skew-protection.js";
import { getEnvFromPlatformProxy } from "./utils/helpers.js";
import { runWrangler } from "./utils/run-wrangler.js";
import type { WithWranglerArgs } from "./utils/utils.js";
import {
	getNormalizedOptions,
	printHeaders,
	readWranglerConfig,
	retrieveCompiledConfig,
	withWranglerPassthroughArgs,
} from "./utils/utils.js";

/**
 * Implementation of the `opennextjs-cloudflare upload` command.
 *
 * @param args
 */
export async function uploadCommand(
	args: WithWranglerArgs<{ cacheChunkSize?: number; rclone: boolean }>
): Promise<void> {
	printHeaders("upload");

	const { config } = await retrieveCompiledConfig();
	const buildOpts = getNormalizedOptions(config);

	const wranglerConfig = await readWranglerConfig(args);

	const envVars = await getEnvFromPlatformProxy(
		{
			configPath: args.wranglerConfigPath,
			environment: args.env,
		},
		buildOpts
	);

	const deploymentMapping = await getDeploymentMapping(buildOpts, config, envVars);

	await populateCache(
		buildOpts,
		config,
		wranglerConfig,
		{
			target: "remote",
			environment: args.env,
			wranglerConfigPath: args.wranglerConfigPath,
			cacheChunkSize: args.cacheChunkSize,
			useRclone: args.rclone,
			shouldUsePreviewId: false,
		},
		envVars
	);

	const result = runWrangler(
		buildOpts,
		[
			"versions",
			"upload",
			...args.wranglerArgs,
			...(deploymentMapping
				? ["--var", `${DEPLOYMENT_MAPPING_ENV_NAME}:${JSON.stringify(deploymentMapping)}`]
				: []),
		],
		{ logging: "all" }
	);

	if (!result.success) {
		logger.error(`Wrangler versions upload command failed${result.stderr ? `:\n${result.stderr}` : ""}`);
		process.exit(1);
	}
}

/**
 * Add the `upload` command to yargs configuration.
 *
 * Consumes 1 positional parameter.
 */
export function addUploadCommand<T extends yargs.Argv>(y: T) {
	return y.command(
		"upload [args..]",
		"Upload a built OpenNext app to Cloudflare Workers",
		(c) => withPopulateCacheOptions(c),
		(args) => uploadCommand(withWranglerPassthroughArgs(args))
	);
}
