import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type { BuildOptions } from "@opennextjs/aws/build/helper.js";
import logger from "@opennextjs/aws/logger.js";
import type {
	IncludedIncrementalCache,
	IncludedTagCache,
	LazyLoadedOverride,
	OpenNextConfig,
} from "@opennextjs/aws/types/open-next.js";
import type { IncrementalCache, TagCache } from "@opennextjs/aws/types/overrides.js";
import { globSync } from "glob";
import { tqdm } from "ts-tqdm";
import type { Unstable_Config as WranglerConfig } from "wrangler";
import { unstable_startWorker } from "wrangler";
import type yargs from "yargs";

import {
	BINDING_NAME as KV_CACHE_BINDING_NAME,
	NAME as KV_CACHE_NAME,
	PREFIX_ENV_NAME as KV_CACHE_PREFIX_ENV_NAME,
} from "../../api/overrides/incremental-cache/kv-incremental-cache.js";
import {
	BINDING_NAME as R2_CACHE_BINDING_NAME,
	NAME as R2_CACHE_NAME,
	PREFIX_ENV_NAME as R2_CACHE_PREFIX_ENV_NAME,
} from "../../api/overrides/incremental-cache/r2-incremental-cache.js";
import {
	CACHE_DIR as STATIC_ASSETS_CACHE_DIR,
	NAME as STATIC_ASSETS_CACHE_NAME,
} from "../../api/overrides/incremental-cache/static-assets-incremental-cache.js";
import { computeCacheKey } from "../../api/overrides/internal.js";
import {
	BINDING_NAME as D1_TAG_BINDING_NAME,
	NAME as D1_TAG_NAME,
} from "../../api/overrides/tag-cache/d1-next-tag-cache.js";
import { ensureR2Bucket } from "../utils/ensure-r2-bucket.js";
import { normalizePath } from "../utils/normalize-path.js";
import type { R2Response } from "../workers/r2-cache-types.js";
import { getEnvFromPlatformProxy, type WorkerEnvVar } from "./utils/helpers.js";
import type { WranglerTarget } from "./utils/run-wrangler.js";
import { runWrangler } from "./utils/run-wrangler.js";
import type { WithWranglerArgs } from "./utils/utils.js";
import {
	getNormalizedOptions,
	printHeaders,
	readWranglerConfig,
	retrieveCompiledConfig,
	withWranglerOptions,
	withWranglerPassthroughArgs,
} from "./utils/utils.js";

// Maximum number of attempts to send the request
export const MAX_REQUEST_RETRIES = 15;
// Base delay for retries
export const BASE_RETRY_DELAY_MS = 250;
// Maximum delay for retries, used to calculate the backoff factor
export const MAX_RETRY_DELAY_MS = 10_000;
// Backoff factor for retries, calculated to ensure that the delay grows exponentially up to the maximum delay
export const BACKOFF_FACTOR = (MAX_RETRY_DELAY_MS / BASE_RETRY_DELAY_MS) ** (1 / (MAX_REQUEST_RETRIES - 1));

/**
 * Implementation of the `opennextjs-cloudflare populateCache` command.
 *
 * @param args
 */
async function populateCacheCommand(
	target: "local" | "remote",
	args: WithWranglerArgs<{ cacheChunkSize?: number; rclone: boolean }>
) {
	printHeaders(`populate cache - ${target}`);

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
			target,
			environment: args.env,
			wranglerConfigPath: args.wranglerConfigPath,
			cacheChunkSize: args.cacheChunkSize,
			useRclone: args.rclone,
			shouldUsePreviewId: false,
		},
		envVars
	);
}

export async function populateCache(
	buildOpts: BuildOptions,
	config: OpenNextConfig,
	wranglerConfig: WranglerConfig,
	populateCacheOptions: PopulateCacheOptions,
	envVars: WorkerEnvVar
) {
	const { incrementalCache, tagCache } = config.default.override ?? {};

	if (!fs.existsSync(buildOpts.outputDir)) {
		throw new Error("Unable to populate cache: Open Next build not found");
	}

	if (!config.dangerous?.disableIncrementalCache && incrementalCache) {
		const name = await resolveCacheName(incrementalCache);
		switch (name) {
			case R2_CACHE_NAME:
				await populateR2IncrementalCache(buildOpts, wranglerConfig, populateCacheOptions, envVars);
				break;
			case KV_CACHE_NAME:
				await populateKVIncrementalCache(buildOpts, wranglerConfig, populateCacheOptions, envVars);
				break;
			case STATIC_ASSETS_CACHE_NAME:
				populateStaticAssetsIncrementalCache(buildOpts);
				break;
			default:
				logger.info("Incremental cache does not need populating");
		}
	}

	if (!config.dangerous?.disableTagCache && !config.dangerous?.disableIncrementalCache && tagCache) {
		const name = await resolveCacheName(tagCache);
		switch (name) {
			case D1_TAG_NAME:
				populateD1TagCache(buildOpts, wranglerConfig, populateCacheOptions);
				break;
			default:
				logger.info("Tag cache does not need populating");
		}
	}
}

async function resolveCacheName(
	value:
		| IncludedIncrementalCache
		| IncludedTagCache
		| LazyLoadedOverride<IncrementalCache>
		| LazyLoadedOverride<TagCache>
) {
	return typeof value === "function" ? (await value()).name : value;
}

export type CacheAsset = { isFetch: boolean; fullPath: string; key: string; buildId: string };

export function getCacheAssets(opts: BuildOptions): CacheAsset[] {
	const allFiles = globSync(path.join(opts.outputDir, "cache/**/*"), {
		withFileTypes: true,
		windowsPathsNoEscape: true,
	}).filter((f) => f.isFile());

	const baseCacheDir = path.join(opts.outputDir, "cache");
	const assets: CacheAsset[] = [];

	for (const file of allFiles) {
		const fullPath = file.fullpath();
		const relativePath = normalizePath(path.relative(baseCacheDir, fullPath));

		if (relativePath.startsWith("__fetch")) {
			const [__fetch, buildId, ...keyParts] = relativePath.split("/");

			if (__fetch !== "__fetch" || buildId === undefined || keyParts.length === 0) {
				throw new Error(`Invalid path for a Cache Asset file: ${relativePath}`);
			}

			assets.push({
				isFetch: true,
				fullPath,
				key: `/${keyParts.join("/")}`,
				buildId,
			});
		} else {
			const [buildId, ...keyParts] = relativePath.slice(0, -".cache".length).split("/");

			if (!relativePath.endsWith(".cache") || buildId === undefined || keyParts.length === 0) {
				throw new Error(`Invalid path for a Cache Asset file: ${relativePath}`);
			}

			assets.push({
				isFetch: false,
				fullPath,
				key: `/${keyParts.join("/")}`,
				buildId,
			});
		}
	}

	return assets;
}

export type PopulateCacheOptions = {
	/**
	 * Whether to populate the local or remote cache.
	 */
	target: WranglerTarget;
	/**
	 * Wrangler environment to use.
	 */
	environment?: string;
	/**
	 * Path to the Wrangler config file.
	 */
	wranglerConfigPath?: string;
	/**
	 * Number of concurrent requests when populating the cache.
	 * For KV this is the chunk size passed to `wrangler kv bulk put`.
	 * For R2 this is the number of concurrent requests to the local worker or rclone transfers.
	 *
	 * @default 25
	 */
	cacheChunkSize?: number;
	/**
	 * Whether to use `rclone` instead of the worker-based R2 cache population path.
	 */
	useRclone?: boolean;
	/**
	 * Instructs Wrangler to use the preview namespace or ID defined in the Wrangler config for the remote target.
	 */
	shouldUsePreviewId: boolean;
};

/**
 * Populates the R2 incremental cache by starting a worker with an R2 binding.
 *
 * Flow:
 * 1. Reads the R2 binding configuration from the wrangler config.
 * 2. Collects cache assets from the build output.
 * 3. Starts a worker (via `unstable_startWorker`) with the R2 binding, set to run remotely or locally depending upon the cache target.
 * 4. Sends individual POST requests to the worker.
 *
 * Using a binding bypasses the Cloudflare REST API rate limit that affects `wrangler r2 bulk put`.
 */
async function populateR2IncrementalCache(
	buildOpts: BuildOptions,
	config: WranglerConfig,
	populateCacheOptions: PopulateCacheOptions,
	envVars: WorkerEnvVar
) {
	logger.info(`\nPopulating ${populateCacheOptions.target} R2 incremental cache...`);

	const binding = config.r2_buckets.find(({ binding }) => binding === R2_CACHE_BINDING_NAME);
	if (!binding) {
		throw new Error(`No R2 binding "${R2_CACHE_BINDING_NAME}" found!`);
	}

	if (typeof binding.bucket_name !== "string") {
		throw new Error(`R2 binding "${R2_CACHE_BINDING_NAME}" is missing a bucket_name.`);
	}

	const bucketName =
		populateCacheOptions.shouldUsePreviewId && typeof binding.preview_bucket_name === "string"
			? binding.preview_bucket_name
			: binding.bucket_name;
	const prefix = envVars[R2_CACHE_PREFIX_ENV_NAME];
	const assets = getCacheAssets(buildOpts);

	if (assets.length === 0) {
		logger.info("No cache assets to populate");
		return;
	}

	if (populateCacheOptions.useRclone) {
		if (populateCacheOptions.target !== "remote") {
			throw new Error("The `--rclone` option can only be used when populating a remote R2 cache.");
		}

		await populateR2IncrementalCacheWithRclone(
			bucketName,
			prefix,
			assets,
			envVars,
			populateCacheOptions.cacheChunkSize
		);
		return;
	}

	const currentDir = path.dirname(fileURLToPath(import.meta.url));
	const handlerPath = path.join(currentDir, "../workers/r2-cache.js");
	const isRemote = populateCacheOptions.target === "remote";

	if (isRemote) {
		const result = await ensureR2Bucket(buildOpts.appPath, bucketName, binding.jurisdiction);

		if (!result.success) {
			throw new Error(
				`Failed to provision remote R2 bucket "${bucketName}" for binding "${R2_CACHE_BINDING_NAME}": ${result.error}`
			);
		}
	}

	// Start a local worker and proxy it to the Cloudflare network when remote mode is enabled.
	const worker = await unstable_startWorker({
		name: "open-next-cache-populate",
		// Prevent it from discovering the project's wrangler config and leaking unrelated bindings.
		config: "",
		entrypoint: handlerPath,
		compatibilityDate: "2026-01-01",
		bindings: {
			R2: {
				type: "r2_bucket",
				bucket_name: bucketName,
				jurisdiction: binding.jurisdiction,
			},
		},
		dev: {
			remote: isRemote,
			server: { port: 0 },
			inspector: false,
			watch: false,
			liveReload: false,
			logLevel: "none",
		},
	});

	try {
		const baseUrl = await worker.url;
		await sendEntriesToR2Worker({
			workerUrl: new URL("/populate", baseUrl).href,
			assets,
			prefix,
			maxConcurrency: Math.max(1, populateCacheOptions.cacheChunkSize ?? 25),
		});
	} catch (e) {
		if (isRemote) {
			throw new Error(
				`Failed to populate remote R2 bucket "${bucketName}" for binding "${R2_CACHE_BINDING_NAME}": ${e instanceof Error ? e.message : String(e)}`
			);
		} else {
			throw new Error(`Failed to populate the local R2 cache: ${e instanceof Error ? e.message : String(e)}`);
		}
	} finally {
		await worker.dispose();
	}

	logger.info(`Successfully populated cache with ${assets.length} entries`);
}

async function populateR2IncrementalCacheWithRclone(
	bucketName: string,
	prefix: string | undefined,
	assets: CacheAsset[],
	envVars: WorkerEnvVar,
	cacheChunkSize?: number
) {
	const accessKey = envVars.R2_ACCESS_KEY_ID;
	const secretKey = envVars.R2_SECRET_ACCESS_KEY;
	const accountId = envVars.CF_ACCOUNT_ID;

	if (!accessKey || !secretKey || !accountId) {
		throw new Error(
			"R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CF_ACCOUNT_ID must be provided to use `rclone`"
		);
	}

	const rclone = await loadRclone();

	logger.info("\nPopulating remote R2 incremental cache using `rclone`...");

	const configDir = await fsp.mkdtemp(path.join(os.tmpdir(), "rclone-config-"));
	const configPath = path.join(configDir, "rclone.conf");
	const stagingDir = await fsp.mkdtemp(path.join(os.tmpdir(), "r2-staging-"));
	const transfers = Math.max(1, cacheChunkSize ?? 25);
	const checkers = Math.max(1, Math.floor(transfers / 2));

	try {
		await fsp.writeFile(
			configPath,
			`[r2]\ntype = s3\nprovider = Cloudflare\naccess_key_id = ${accessKey}\nsecret_access_key = ${secretKey}\nendpoint = https://${accountId}.r2.cloudflarestorage.com\nacl = private\n`,
			{ mode: 0o600 }
		);
		const rcloneEnv = {
			...process.env,
			RCLONE_CONFIG: configPath,
		};
		await ensureRcloneExecutable(rclone, rcloneEnv);

		await stageCacheAssets(assets, stagingDir, prefix, transfers);

		await runRcloneCopy(rclone, stagingDir, `r2:${bucketName}`, {
			progress: true,
			transfers,
			checkers,
			env: rcloneEnv,
			stdio: "inherit",
		});
	} finally {
		await Promise.allSettled([
			fsp.rm(stagingDir, { recursive: true, force: true }),
			fsp.rm(configDir, { recursive: true, force: true }),
		]);
	}

	logger.info(`Successfully populated cache with ${assets.length} entries`);
}

async function runRcloneCopy(
	rclone: typeof import("rclone.js"),
	source: string,
	destination: string,
	options: Record<string, unknown>
) {
	await new Promise<void>((resolve, reject) => {
		const child = rclone.copy(source, destination, options);

		child.once("error", reject);
		child.once("close", (code, signal) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(
				new Error(
					`rclone exited ${signal ? `after receiving signal ${signal}` : `with code ${code ?? "unknown"}`}`
				)
			);
		});
	});
}

async function stageCacheAssets(
	assets: CacheAsset[],
	stagingDir: string,
	prefix: string | undefined,
	maxConcurrency: number
) {
	const pending = new Set<Promise<void>>();

	for (const asset of assets) {
		const task = stageCacheAsset(asset, stagingDir, prefix).finally(() => pending.delete(task));
		pending.add(task);

		if (pending.size >= maxConcurrency) {
			await Promise.race(pending);
		}
	}

	await Promise.all(pending);
}

async function stageCacheAsset(asset: CacheAsset, stagingDir: string, prefix: string | undefined) {
	const cacheKey = computeCacheKey(asset.key, {
		prefix,
		buildId: asset.buildId,
		cacheType: asset.isFetch ? "fetch" : "cache",
	});
	const destination = path.resolve(stagingDir, cacheKey);
	const relativeDestination = path.relative(stagingDir, destination);

	if (relativeDestination.startsWith(`..${path.sep}`) || path.isAbsolute(relativeDestination)) {
		throw new Error(`Cannot stage R2 cache key outside the temporary directory: ${JSON.stringify(cacheKey)}`);
	}

	await fsp.mkdir(path.dirname(destination), { recursive: true });

	try {
		await fsp.link(asset.fullPath, destination);
	} catch (error) {
		if (!(error instanceof Error) || !("code" in error) || error.code !== "EXDEV") {
			throw error;
		}

		await fsp.copyFile(asset.fullPath, destination);
	}
}

async function ensureRcloneExecutable(rclone: typeof import("rclone.js"), env: NodeJS.ProcessEnv) {
	try {
		await rclone.promises.version({ env });
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			throw new Error(
				"The `rclone.js` executable is unavailable. pnpm users must allow its install script with `pnpm approve-builds`, select `rclone.js`, then run `pnpm rebuild rclone.js`."
			);
		}

		throw error;
	}
}

export async function loadRclone(
	importRclone: () => Promise<{ default: typeof import("rclone.js") }> = () => import("rclone.js")
) {
	try {
		return (await importRclone()).default;
	} catch (error) {
		if (
			error instanceof Error &&
			("code" in error ? error.code === "ERR_MODULE_NOT_FOUND" : error.message.includes("rclone.js"))
		) {
			throw new Error(
				"The `--rclone` option requires the optional `rclone.js` peer dependency. Install it in your project before using this option."
			);
		}
		throw error;
	}
}

/**
 * Sends cache entries to the R2 worker, one entry per request.
 *
 * @param options
 * @param options.workerUrl - The URL of the local R2 worker's `/populate` endpoint.
 * @param options.assets - The cache assets to write, as collected by {@link getCacheAssets}.
 * @param options.prefix - Optional prefix prepended to each R2 key.
 * @param options.maxConcurrency - Maximum number of concurrent in-flight requests.
 * @returns Resolves when all entries have been written successfully.
 * @throws {Error} If any entry fails after all retries or encounters a non-retryable error.
 */
async function sendEntriesToR2Worker(options: {
	workerUrl: string;
	assets: CacheAsset[];
	prefix: string | undefined;
	maxConcurrency: number;
}): Promise<void> {
	const { workerUrl, assets, prefix, maxConcurrency } = options;

	const pending = new Set<Promise<void>>();

	for (const asset of tqdm(assets)) {
		const { fullPath, key, buildId, isFetch } = asset;

		const task = sendEntryToR2Worker({
			workerUrl,
			key: computeCacheKey(key, {
				prefix,
				buildId,
				cacheType: isFetch ? "fetch" : "cache",
			}),
			filename: fullPath,
		}).finally(() => pending.delete(task));

		pending.add(task);

		// If we've reached the concurrency limit, wait for one to finish.
		if (pending.size >= maxConcurrency) {
			await Promise.race(pending);
		}
	}

	await Promise.all(pending);
}

class RetryableWorkerError extends Error {}

/**
 * Sends a single cache entry to the R2 worker.
 *
 * The file is streamed from disk and sent as the raw request body.
 *
 * @param options
 * @param options.workerUrl - The URL of the local R2 worker's `/populate` endpoint.
 * @param options.key - The R2 object key.
 * @param options.filename - Path to the cache file on disk. Read at send time to avoid holding all values in memory.
 * @throws {Error} If the worker reports a failure.
 */
async function sendEntryToR2Worker(options: {
	workerUrl: string;
	key: string;
	filename: string;
}): Promise<void> {
	const { workerUrl, key, filename } = options;

	for (let attempt = 0; attempt < MAX_REQUEST_RETRIES; attempt++) {
		try {
			let response: Response;

			try {
				response = await fetch(workerUrl, {
					method: "POST",
					headers: {
						"x-opennext-cache-key": key,
						"content-length": fs.statSync(filename).size.toString(),
						// Include Access Client ID and Secret if they are set in the environment,
						// so the helper worker can be reached through Cloudflare Access.
						//
						// If the workers.dev subdomain (or a parent route) is behind Cloudflare Access,
						// attach a "Service Auth" policy to the *existing* Access application that already
						// covers "open-next-cache-populate.<account>.workers.dev" — typically the
						// "*.<account>.workers.dev" wildcard application. Creating a separate application
						// scoped to this hostname has been observed to block the upload, even alongside
						// the wildcard app. The policy should have:
						//   - Action set to "Service Auth"
						//   - An Include rule for "Any Access Service Token" or a specific Service Token
						// See: https://opennext.js.org/cloudflare/cli#populating-remote-bindings-when-workers-are-protected-by-cloudflare-access
						...(process.env.CLOUDFLARE_ACCESS_CLIENT_ID && process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET
							? {
									"CF-Access-Client-Id": process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
									"CF-Access-Client-Secret": process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
								}
							: {}),
					},
					body: Readable.toWeb(fs.createReadStream(filename)) as unknown as ReadableStream,
					signal: AbortSignal.timeout(60_000),
					// @ts-expect-error - `duplex` is required for streaming request bodies in Node.js
					duplex: "half",
				});
			} catch (e) {
				throw new RetryableWorkerError(
					`Failed to send request to R2 worker: ${e instanceof Error ? e.message : String(e)}`,
					{ cause: e }
				);
			}

			const body = await response.text();
			let result: R2Response;

			try {
				result = JSON.parse(body) as R2Response;
			} catch (e) {
				// https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102
				if (body.includes("Worker exceeded resource limits")) {
					throw new RetryableWorkerError("Worker exceeded resource limits", { cause: e });
				}

				if (response.status >= 500) {
					throw new RetryableWorkerError(
						`Worker returned a ${response.status} ${response.statusText} response`,
						{ cause: e }
					);
				}

				throw new Error(`Unexpected ${response.status} response from R2 worker: ${body}`, {
					cause: e,
				});
			}

			if (!result.success) {
				throw response.status >= 500
					? new RetryableWorkerError(result.error)
					: new Error(`Failed to write "${key}" to R2: ${result.error}`);
			}

			return;
		} catch (e) {
			if (e instanceof RetryableWorkerError && attempt < MAX_REQUEST_RETRIES - 1) {
				logger.error(
					`Attempt ${attempt + 1} to write "${key}" failed with a retryable error: ${e.message}. Retrying...`
				);
				await setTimeout(BASE_RETRY_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt));
				continue;
			}

			throw new Error(`Failed to write "${key}" to R2 after ${MAX_REQUEST_RETRIES} attempts`, {
				cause: e,
			});
		}
	}
}

async function populateKVIncrementalCache(
	buildOpts: BuildOptions,
	config: WranglerConfig,
	populateCacheOptions: PopulateCacheOptions,
	envVars: WorkerEnvVar
) {
	logger.info(`\nPopulating ${populateCacheOptions.target} KV incremental cache...`);

	const binding = config.kv_namespaces.find(
		({ binding }: { binding: string }) => binding === KV_CACHE_BINDING_NAME
	);
	if (!binding) {
		throw new Error(`No KV binding "${KV_CACHE_BINDING_NAME}" found!`);
	}

	const prefix = envVars[KV_CACHE_PREFIX_ENV_NAME];
	const assets = getCacheAssets(buildOpts);

	if (assets.length === 0) {
		logger.info("No cache assets to populate");
		return;
	}

	const chunkSize = Math.max(1, populateCacheOptions.cacheChunkSize ?? 25);
	const totalChunks = Math.ceil(assets.length / chunkSize);

	logger.info(
		`Inserting ${assets.length} assets to ${populateCacheOptions.target} KV in chunks of ${chunkSize}`
	);

	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "open-next-"));

	for (const i of tqdm(Array.from({ length: totalChunks }, (_, i) => i))) {
		const chunkPath = path.join(tempDir, `cache-chunk-${i}.json`);

		const kvMapping = assets
			.slice(i * chunkSize, (i + 1) * chunkSize)
			.map(({ fullPath, key, buildId, isFetch }) => ({
				key: computeCacheKey(key, {
					prefix,
					buildId,
					cacheType: isFetch ? "fetch" : "cache",
				}),
				value: fs.readFileSync(fullPath, "utf8"),
			}));

		fs.writeFileSync(chunkPath, JSON.stringify(kvMapping));

		const result = runWrangler(
			buildOpts,
			[
				"kv",
				"bulk",
				"put",
				chunkPath,
				"--binding",
				KV_CACHE_BINDING_NAME,
				populateCacheOptions.shouldUsePreviewId ? "--preview" : "--no-preview",
			],
			{
				target: populateCacheOptions.target,
				environment: populateCacheOptions.environment,
				configPath: populateCacheOptions.wranglerConfigPath,
				logging: "error",
			}
		);

		fs.rmSync(chunkPath, { force: true });

		if (!result.success) {
			throw new Error(`Wrangler kv bulk put command failed${result.stderr ? `:\n${result.stderr}` : ""}`);
		}
	}

	logger.info(`Successfully populated cache with ${assets.length} entries`);
}

function populateD1TagCache(
	buildOpts: BuildOptions,
	config: WranglerConfig,
	populateCacheOptions: PopulateCacheOptions
) {
	logger.info("\nCreating D1 table if necessary...");

	const binding = config.d1_databases.find(
		({ binding }: { binding: string }) => binding === D1_TAG_BINDING_NAME
	);
	if (!binding) {
		throw new Error(`No D1 binding "${D1_TAG_BINDING_NAME}" found!`);
	}

	const result = runWrangler(
		buildOpts,
		[
			"d1",
			"execute",
			D1_TAG_BINDING_NAME,
			// Columns:
			//   tag           - The cache tag.
			//   revalidatedAt - Timestamp (ms) when the tag was last revalidated.
			//   stale         - Timestamp (ms) when the cached entry becomes stale. Added in v1.19.
			//   expire        - Timestamp (ms) when the cached entry expires. NULL means no expire. Added in v1.19.
			"--command",
			"CREATE TABLE IF NOT EXISTS revalidations (tag TEXT NOT NULL, revalidatedAt INTEGER NOT NULL, stale INTEGER, expire INTEGER default NULL, UNIQUE(tag) ON CONFLICT REPLACE);",
			populateCacheOptions.shouldUsePreviewId ? "--preview" : "--no-preview",
		],
		{
			target: populateCacheOptions.target,
			environment: populateCacheOptions.environment,
			configPath: populateCacheOptions.wranglerConfigPath,
			logging: "error",
		}
	);

	if (!result.success) {
		throw new Error(`Wrangler d1 execute command failed${result.stderr ? `:\n${result.stderr}` : ""}`);
	}

	// Schema migration: add `stale` and `expire` columns (idempotent, safe for existing deployments).
	// The columns were added in v1.19 to support SWR.
	// These commands are intentionally non-throwing — they fail harmlessly if the columns already exist.
	runWrangler(
		buildOpts,
		[
			"d1",
			"execute",
			D1_TAG_BINDING_NAME,
			"--command",
			"ALTER TABLE revalidations ADD COLUMN stale INTEGER; ALTER TABLE revalidations ADD COLUMN expire INTEGER default NULL",
			populateCacheOptions.shouldUsePreviewId ? "--preview" : "--no-preview",
		],
		{
			target: populateCacheOptions.target,
			environment: populateCacheOptions.environment,
			configPath: populateCacheOptions.wranglerConfigPath,
			// Do not log errors since the ALTER TABLE command will fail if the columns already exist.
			logging: "none",
		}
	);

	logger.info("\nSuccessfully created D1 table");
}

function populateStaticAssetsIncrementalCache(options: BuildOptions) {
	logger.info("\nPopulating Workers static assets...");

	fs.cpSync(
		path.join(options.outputDir, "cache"),
		path.join(options.outputDir, "assets", STATIC_ASSETS_CACHE_DIR),
		{ recursive: true }
	);

	logger.info(`Successfully populated static assets cache`);
}

/**
 * Add the `populateCache` command to yargs configuration, with nested commands for `local` and `remote`.
 *
 * Consumes 2 positional parameters.
 */
export function addPopulateCacheCommand<T extends yargs.Argv>(y: T) {
	return y.command("populateCache", "Populate the cache for a built Next.js app", (c) =>
		c
			.command(
				"local [args..]",
				"Local dev server cache",
				(c) => withPopulateCacheOptions(c),
				(args) => populateCacheCommand("local", withWranglerPassthroughArgs(args))
			)
			.command(
				"remote [args..]",
				"Remote Cloudflare Worker cache",
				(c) => withPopulateCacheOptions(c),
				(args) => populateCacheCommand("remote", withWranglerPassthroughArgs(args))
			)
			.demandCommand(1, 1)
	);
}

export function withPopulateCacheOptions<T extends yargs.Argv>(args: T) {
	return withWranglerOptions(args)
		.options("cacheChunkSize", {
			type: "number",
			desc: "Number of concurrent cache entries to process",
		})
		.options("rclone", {
			type: "boolean",
			default: false,
			desc: "Use rclone to populate a remote R2 incremental cache",
		});
}
