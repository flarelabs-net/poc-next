import type { Context, RunningCodeOptions } from "node:vm";

import type { GetPlatformProxyOptions } from "wrangler";

import type { BucketCachePurge } from "./durable-objects/bucket-cache-purge.js";
import type { DOQueueHandler } from "./durable-objects/queue.js";
import type { DOShardedTagCache } from "./durable-objects/sharded-tag-cache.js";
import type { PREFIX_ENV_NAME as KV_CACHE_PREFIX_ENV_NAME } from "./overrides/incremental-cache/kv-incremental-cache.js";
import type { PREFIX_ENV_NAME as R2_CACHE_PREFIX_ENV_NAME } from "./overrides/incremental-cache/r2-incremental-cache.js";

declare global {
	interface CloudflareEnv {
		// Asset binding
		ASSETS?: Fetcher;

		// Images binding for image optimization
		// Optimization is disabled if undefined
		IMAGES?: ImagesBinding;

		// Environment to use when loading Next `.env` files
		// Default to "production"
		NEXTJS_ENV?: string;

		// Service binding for the worker itself to be able to call itself from within the worker
		WORKER_SELF_REFERENCE?: Service;

		// KV used for the incremental cache
		NEXT_INC_CACHE_KV?: KVNamespace;
		// Prefix used for the KV incremental cache key
		[KV_CACHE_PREFIX_ENV_NAME]?: string;

		// R2 bucket used for the incremental cache
		NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
		// Prefix used for the R2 incremental cache bucket
		[R2_CACHE_PREFIX_ENV_NAME]?: string;

		// D1 db used for the tag cache
		NEXT_TAG_CACHE_D1?: D1Database;

		// KV used for the tag cache
		NEXT_TAG_CACHE_KV?: KVNamespace;

		// Durables object namespace to use for the sharded tag cache
		NEXT_TAG_CACHE_DO_SHARDED?: DurableObjectNamespace<DOShardedTagCache>;
		// Queue of failed tag write
		// Optional, could be used to monitor or reprocess failed writes
		NEXT_TAG_CACHE_DO_SHARDED_DLQ?: Queue;

		// Durable Object namespace to use for the durable object queue
		NEXT_CACHE_DO_QUEUE?: DurableObjectNamespace<DOQueueHandler>;

		// Below are the optional environment variables to configure the durable object queue
		// The max number of revalidations that can be processed by the durable worker at the same time
		NEXT_CACHE_DO_QUEUE_MAX_REVALIDATION?: string;
		// The max time in milliseconds that a revalidation can take before being considered as failed
		NEXT_CACHE_DO_QUEUE_REVALIDATION_TIMEOUT_MS?: string;
		// The amount of time after which a revalidation will be attempted again if it failed
		// If it fails again it will exponentially back off until it reaches the max retry interval
		NEXT_CACHE_DO_QUEUE_RETRY_INTERVAL_MS?: string;
		// The maximum number of attempts that can be made to revalidate a path
		NEXT_CACHE_DO_QUEUE_MAX_RETRIES?: string;
		// Disable SQLite for the durable object queue handler
		// This can be safely used if you don't use an eventually consistent incremental cache (i.e. R2 without the regional cache for example)
		NEXT_CACHE_DO_QUEUE_DISABLE_SQLITE?: string;

		// Below are the env variables to use for purging the cache
		// Durable Object namespace to use for the durable object cache purge (not needed in direct mode)
		NEXT_CACHE_DO_PURGE?: DurableObjectNamespace<BucketCachePurge>;
		// The amount of time in seconds that the cache purge will wait before purging the cache (not needed in direct mode)
		NEXT_CACHE_DO_PURGE_BUFFER_TIME_IN_SECONDS?: string;
		// The zone ID to use for the cache purge https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/
		CACHE_PURGE_ZONE_ID?: string;
		// The API token to use for the cache purge. It should have the `Cache Purge` permission
		CACHE_PURGE_API_TOKEN?: string;

		// The following variables must be provided when skew protection is enabled
		// The name of the worker (as defined in the wrangler configuration)
		// When a specific wrangler environment is used, it should be appended at the end:
		// - Use `worker-name` when no wrangler environment is used
		// - Use `worker-name-<environment>` when a wrangler environment is used via `wrangler --env=<environment>`
		CF_WORKER_NAME?: string;
		// The subdomain where the previews are deployed, i.e. `<version-name>.<domain>.workers.dev`
		CF_PREVIEW_DOMAIN?: string;
		// Should have the `Workers Scripts:Read` permission
		CF_WORKERS_SCRIPTS_API_TOKEN?: string;

		// Cloudflare account id - needed for skew protection and R2 batch population
		CF_ACCOUNT_ID?: string;

		// R2 S3 API credentials used by `rclone`
		R2_ACCESS_KEY_ID?: string;
		R2_SECRET_ACCESS_KEY?: string;
	}
}

export type CloudflareContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
> = {
	/**
	 * the worker's [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
	 */
	env: CloudflareEnv;
	/**
	 * the request's [cf properties](https://developers.cloudflare.com/workers/runtime-apis/request/#the-cf-property-requestinitcfproperties)
	 */
	cf: CfProperties | undefined;
	/**
	 * the current [execution context](https://developers.cloudflare.com/workers/runtime-apis/context)
	 */
	ctx: Context;
};

/**
 * Symbol used as an index in the global scope to set and retrieve the Cloudflare context
 *
 * This is used both in production (in the actual built worker) and in development (`next dev`)
 *
 * Note: this symbol needs to be kept in sync with the one used in `src/cli/templates/worker.ts`
 */
const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");

/**
 * `globalThis` override for internal usage
 */
type InternalGlobalThis<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
> = typeof globalThis & {
	[cloudflareContextSymbol]: CloudflareContext<CfProperties, Context> | undefined;
	__NEXT_DATA__: Record<string, unknown>;
};

type GetCloudflareContextOptions = {
	/**
	 * When `true`, `getCloudflareContext` returns a promise of the cloudflare context instead of the context,
	 * this is needed to access the context from statically generated routes.
	 */
	async: boolean;
};

/**
 * Utility to get the current Cloudflare context
 *
 * @returns the cloudflare context
 */
export function getCloudflareContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(options: { async: true }): Promise<CloudflareContext<CfProperties, Context>>;
export function getCloudflareContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(options?: { async: false }): CloudflareContext<CfProperties, Context>;
export function getCloudflareContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(
	options: GetCloudflareContextOptions = { async: false }
): CloudflareContext<CfProperties, Context> | Promise<CloudflareContext<CfProperties, Context>> {
	return options.async ? getCloudflareContextAsync() : getCloudflareContextSync();
}

/**
 * Get the cloudflare context from the current global scope
 */
function getCloudflareContextFromGlobalScope<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): CloudflareContext<CfProperties, Context> | undefined {
	const global = globalThis as InternalGlobalThis<CfProperties, Context>;
	return global[cloudflareContextSymbol];
}

/**
 * Detects whether the current code is being evaluated in a statically generated route
 */
function inSSG<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): boolean {
	const global = globalThis as InternalGlobalThis<CfProperties, Context>;
	// Note: Next.js sets globalThis.__NEXT_DATA__.nextExport to true for SSG routes
	// source: https://github.com/vercel/next.js/blob/4e394608423/packages/next/src/export/worker.ts#L55-L57)
	return global.__NEXT_DATA__?.nextExport === true;
}

/**
 * Utility to get the current Cloudflare context in sync mode
 */
function getCloudflareContextSync<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): CloudflareContext<CfProperties, Context> {
	const cloudflareContext = getCloudflareContextFromGlobalScope<CfProperties, Context>();

	if (cloudflareContext) {
		return cloudflareContext;
	}

	// The sync mode of `getCloudflareContext`, relies on the context being set on the global state
	// by either the worker entrypoint (in prod) or by `initOpenNextCloudflareForDev` (in dev), neither
	// can work during SSG since for SSG Next.js creates (jest) workers that don't get access to the
	// normal global state so we throw with a helpful error message.
	if (inSSG()) {
		throw new Error(
			`\n\nERROR: \`getCloudflareContext\` has been called in sync mode in either a static route or at the top level of a non-static one,` +
				` both cases are not allowed but can be solved by either:\n` +
				`  - make sure that the call is not at the top level and that the route is not static\n` +
				`  - call \`getCloudflareContext({async: true})\` to use the \`async\` mode\n` +
				`  - avoid calling \`getCloudflareContext\` in the route\n`
		);
	}

	throw new Error(initOpenNextCloudflareForDevErrorMsg);
}

/**
 * Utility to get the current Cloudflare context in async mode
 */
async function getCloudflareContextAsync<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): Promise<CloudflareContext<CfProperties, Context>> {
	const cloudflareContext = getCloudflareContextFromGlobalScope<CfProperties, Context>();

	if (cloudflareContext) {
		return cloudflareContext;
	}

	// Note: Next.js sets process.env.NEXT_RUNTIME to 'nodejs' when the runtime in use is the node.js one
	// We want to detect when the runtime is the node.js one so that during development (`next dev`) we know wether
	// we are or not in a node.js process and that access to wrangler's node.js apis
	const inNodejsRuntime = process.env.NEXT_RUNTIME === "nodejs";

	if (inNodejsRuntime || inSSG()) {
		// we're in a node.js process and also in "async mode" so we can use wrangler to asynchronously get the context
		const cloudflareContext = await getCloudflareContextFromWrangler<CfProperties, Context>();
		addCloudflareContextToNodejsGlobal(cloudflareContext);
		return cloudflareContext;
	}

	throw new Error(initOpenNextCloudflareForDevErrorMsg);
}

/**
 * Tracks whether {@link initOpenNextCloudflareForDev} has already been called in the current Node.js
 * process. Calling it more than once spawns competing workerd instances and surfaces as an obscure
 * `SQLITE_BUSY` failure (see https://github.com/opennextjs/opennextjs-cloudflare/issues/1251), so we
 * surface a user-actionable error before any setup runs.
 */
let initOpenNextCloudflareForDevHasBeenCalled = false;

/**
 * Performs some initial setup to integrate as best as possible the local Next.js dev server (run via `next dev`)
 * with the open-next Cloudflare adapter
 *
 * Note: this function should only be called inside the Next.js config file. Although it returns a
 * promise it doesn't need to be `await`ed: the duplicate-call guard throws synchronously, so a second
 * unawaited call fails at the call site instead of as an unhandled promise rejection.
 * @param options options on how the function should operate and if/where to persist the platform data
 */
export function initOpenNextCloudflareForDev(options?: GetPlatformProxyOptions): Promise<void> {
	if (initOpenNextCloudflareForDevHasBeenCalled) {
		throw new Error(
			`\n\nERROR: \`initOpenNextCloudflareForDev\` was called more than once in the same process.\n` +
				`It should be called exactly once, at the top of your Next.js config file.\n` +
				`Multiple calls start competing Workers runtimes, which fail with an obscure workerd \`SQLITE_BUSY\` error.\n`
		);
	}
	initOpenNextCloudflareForDevHasBeenCalled = true;

	return initOpenNextCloudflareForDevImpl(options);
}

async function initOpenNextCloudflareForDevImpl(options?: GetPlatformProxyOptions) {
	const shouldInitializationRun = shouldContextInitializationRun();
	if (!shouldInitializationRun) return;

	if (options?.environment && process.env.NEXT_DEV_WRANGLER_ENV) {
		console.warn(
			`'initOpenNextCloudflareForDev' has been called with an environment option while NEXT_DEV_WRANGLER_ENV is set.` +
				` NEXT_DEV_WRANGLER_ENV will be ignored and the environment will be set to: '${options.environment}'`
		);
	}

	const context = await getCloudflareContextFromWrangler(options);

	addCloudflareContextToNodejsGlobal(context);

	await monkeyPatchVmModuleEdgeContext(context);
}

/**
 * Next dev server imports the config file twice (in two different processes, making it hard to track),
 * this causes the initialization to run twice as well, to keep things clean, not allocate extra
 * resources (i.e. instantiate two miniflare instances) and avoid extra potential logs, it would be best
 * to run the initialization only once, this function is used to try to make it so that it does, it returns
 * a flag which indicates if the initialization should run in the current process or not.
 *
 * @returns boolean indicating if the initialization should run
 */
function shouldContextInitializationRun(): boolean {
	// via debugging we've seen that AsyncLocalStorage is only set in one of the
	// two processes so we're using it as the differentiator between the two
	const AsyncLocalStorage = (globalThis as unknown as { AsyncLocalStorage?: unknown })["AsyncLocalStorage"];
	return !!AsyncLocalStorage;
}

/**
 * Adds the cloudflare context to the global scope of the current node.js process, enabling
 * future calls to `getCloudflareContext` to retrieve and return such context
 *
 * @param cloudflareContext the cloudflare context to add to the node.sj global scope
 */
function addCloudflareContextToNodejsGlobal<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(cloudflareContext: CloudflareContext<CfProperties, Context>) {
	const global = globalThis as InternalGlobalThis<CfProperties, Context>;
	global[cloudflareContextSymbol] = cloudflareContext;
}

/**
 * Next.js uses the Node.js vm module's `runInContext()` function to evaluate edge functions
 * in a runtime context that tries to simulate as accurately as possible the actual production runtime
 * behavior, see: https://github.com/vercel/next.js/blob/9a1cd3/packages/next/src/server/web/sandbox/context.ts#L525-L527
 *
 * This function monkey-patches the Node.js `vm` module to override the `runInContext()` function so that the
 * cloudflare context is added to the runtime context's global scope before edge functions are evaluated
 *
 * @param cloudflareContext the cloudflare context to patch onto the "edge" runtime context global scope
 */
async function monkeyPatchVmModuleEdgeContext(cloudflareContext: CloudflareContext<CfProperties, Context>) {
	const require = (
		await import(/* webpackIgnore: true */ `${"__module".replaceAll("_", "")}`)
	).default.createRequire(import.meta.url);

	// eslint-disable-next-line unicorn/prefer-node-protocol -- the `next dev` compiler doesn't accept the node prefix
	const vmModule = require("vm");

	const originalRunInContext = vmModule.runInContext.bind(vmModule);

	vmModule.runInContext = (
		code: string,
		contextifiedObject: Context,
		options?: RunningCodeOptions | string
	) => {
		type RuntimeContext = Record<string, unknown> & {
			[cloudflareContextSymbol]?: CloudflareContext<CfProperties, Context>;
		};
		const runtimeContext = contextifiedObject as RuntimeContext;
		runtimeContext[cloudflareContextSymbol] ??= cloudflareContext;
		return originalRunInContext(code, contextifiedObject, options);
	};
}

/**
 * Gets a cloudflare context object from wrangler
 *
 * @returns the cloudflare context ready for use
 */
async function getCloudflareContextFromWrangler<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(options?: GetPlatformProxyOptions): Promise<CloudflareContext<CfProperties, Context>> {
	// Note: we never want wrangler to be bundled in the Next.js app, that's why the import below looks like it does
	const { getPlatformProxy } = await import(/* webpackIgnore: true */ `${"__wrangler".replaceAll("_", "")}`);

	// This allows the selection of a wrangler environment while running in next dev mode
	const environment = options?.environment ?? process.env.NEXT_DEV_WRANGLER_ENV;

	const { env, cf, ctx } = await getPlatformProxy({
		...options,
		// The `env` passed to the fetch handler does not contain variables from `.env*` files.
		// because we invoke wrangler with `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV`=`"false"`.
		// Initializing `envFiles` with an empty list is the equivalent for this API call.
		envFiles: [],
		environment,
	});
	return {
		env,
		cf: cf as unknown as CfProperties,
		ctx: ctx as Context,
	};
}

// In production the cloudflare context is initialized by the worker so it is always available.
// During local development (`next dev`) it might be missing only if the developers hasn't called
// the `initOpenNextCloudflareForDev` function in their Next.js config file
const initOpenNextCloudflareForDevErrorMsg =
	`\n\nERROR: \`getCloudflareContext\` has been called without having called` +
	` \`initOpenNextCloudflareForDev\` from the Next.js config file.\n` +
	`You should update your Next.js config file as shown below:\n\n` +
	"   ```\n   // next.config.mjs\n\n" +
	`   import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";\n\n` +
	`   initOpenNextCloudflareForDev();\n\n` +
	"   const nextConfig = { ... };\n" +
	"   export default nextConfig;\n" +
	"   ```\n" +
	"\n";
