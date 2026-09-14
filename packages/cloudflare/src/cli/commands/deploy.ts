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
 * Implementation of the `opennextjs-cloudflare deploy` command.
 *
 * @param args
 */
export async function deployCommand(
	args: WithWranglerArgs<{ cacheChunkSize?: number; rclone: boolean }>
): Promise<void> {
	printHeaders("deploy");

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

	const deploymentMapping = await getDeploymentMapping(buildOpts, config, envVars);

	const result = runWrangler(
		buildOpts,
		[
			"deploy",
			...args.wranglerArgs,
			...(deploymentMapping
				? ["--var", `${DEPLOYMENT_MAPPING_ENV_NAME}:${JSON.stringify(deploymentMapping)}`]
				: []),
		],
		{
			logging: "all",
			env: {
				// If we are running the deploy command we set this OPEN_NEXT_DEPLOY environment variable
				// to let `wrangler deploy` know that it is being run from open-next. We do this because
				// otherwise `wrangler deploy` run in an open-next project would call
				// `opennextjs-cloudflare deploy` (thus causing an unwanted recursion).
				OPEN_NEXT_DEPLOY: "true",
			},
		}
	);

	if (!result.success) {
		logger.error(`Wrangler deploy command failed${result.stderr ? `:\n${result.stderr}` : ""}`);
		process.exit(1);
	}
}

/**
 * Add the `deploy` command to yargs configuration.
 *
 * Consumes 1 positional parameter.
 */
export function addDeployCommand<T extends yargs.Argv>(y: T) {
	return y.command(
		"deploy [args..]",
		"Deploy a built OpenNext app to Cloudflare Workers",
		(c) => withPopulateCacheOptions(c),
		(args) => deployCommand(withWranglerPassthroughArgs(args))
	);
}
