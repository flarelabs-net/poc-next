import { error } from "@opennextjs/aws/adapters/logger.js";
import {
	CacheEntryType,
	CacheValue,
	IncrementalCache,
	WithLastModified,
} from "@opennextjs/aws/types/overrides.js";
import { compareSemver } from "@opennextjs/aws/utils/semver.js";

import { getCloudflareContext } from "../../cloudflare-context.js";
import { debugCache, FALLBACK_BUILD_ID, IncrementalCacheEntry, isPurgeCacheEnabled } from "../internal.js";

const ONE_MINUTE_IN_SECONDS = 60;
const THIRTY_MINUTES_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 30;

type Options = {
	/**
	 * The mode to use for the regional cache.
	 *
	 * - `short-lived`: Re-use a cache entry for up to a minute after it has been retrieved.
	 * - `long-lived`: Re-use a fetch cache entry until it is revalidated (per-region),
	 *                 or an ISR/SSG entry for up to 30 minutes.
	 */
	mode: "short-lived" | "long-lived";

	/**
	 * The default TTL of long-lived cache entries.
	 * When no revalidate is provided, the default age will be used.
	 *
	 * @default `THIRTY_MINUTES_IN_SECONDS`
	 */
	defaultLongLivedTtlSec?: number;

	/**
	 * Whether the regional cache entry should be updated in the background on regional cache hits.
	 *
	 * NOTE: Use the default value unless you know what you are doing. It is set to:
	 * - Next < 16:
	 *   `true` in `long-lived` mode when cache purge is not used, `false` otherwise.
	 * - Next >= 16:
	 *   `!bypassTagCacheOnCacheHit`
	 */
	shouldLazilyUpdateOnCacheHit?: boolean;

	/**
	 * Whether the tagCache should be skipped on regional cache hits.
	 *
	 * Note:
	 * - Skipping the tagCache allows requests to be handled faster
	 * - When `true`, make sure the cache gets purged
	 *   either by enabling the auto cache purging feature or manually
	 *
	 * `true` is not compatible with SWR types of revalidateTag
	 * i.e. on Next 16+, anything different than `revalidateTag("tag", { expire: 0 })`.
	 * That's why the default is `false` for Next 16+ which uses SWR by default.
	 *
	 * NOTE: Use the default value unless you know what you are doing. It is set to:
	 * - Next <16:
	 *    `true` if the auto cache purging is enabled, `false` otherwise.
	 * - Next >= 16:
	 *   `false`
	 */
	bypassTagCacheOnCacheHit?: boolean;
};

interface PutToCacheInput {
	key: string;
	cacheType?: CacheEntryType;
	entry: IncrementalCacheEntry<CacheEntryType>;
}

/**
 * Wrapper adding a regional cache on an `IncrementalCache` implementation.
 *
 * Using a the `RegionalCache` does not directly improves the performance much.
 * However it allows bypassing the tag cache (see `bypassTagCacheOnCacheHit`) on hits.
 * That's where bigger perf gain happens.
 *
 * We recommend using cache purge.
 * When cache purge is not enabled, there is a possibility that the Cache API (local to a Data Center)
 * is out of sync with the cache store (i.e. R2). That's why when cache purge is not enabled the Cache
 * API is refreshed from the cache store on cache hits (for the long-lived mode).
 */
class RegionalCache implements IncrementalCache {
	public name: string;

	protected localCache: Cache | undefined;

	constructor(
		private store: IncrementalCache,
		private opts: Options
	) {
		this.name = this.store.name;

		// `globalThis.nextVersion` is only defined at runtime but not when the Open Next build runs.
		// The options do no matter at build time so we can skip setting them.
		const { nextVersion } = globalThis;
		if (nextVersion) {
			if (compareSemver(nextVersion, "<", "16")) {
				// Next < 16
				this.opts.shouldLazilyUpdateOnCacheHit ??= this.opts.mode === "long-lived" && !isPurgeCacheEnabled();
				this.opts.bypassTagCacheOnCacheHit ??= isPurgeCacheEnabled();
			} else {
				// Next >= 16
				this.opts.bypassTagCacheOnCacheHit ??= false;
				if (this.opts.bypassTagCacheOnCacheHit) {
					debugCache(
						"RegionalCache",
						`bypassTagCacheOnCacheHit is not recommended for Next 16+ as it is not compatible with SWR tags. Make sure to always use \`revalidateTag\` with \`{ expire: 0 }\` if you want to bypass the tag cache.`
					);
				}
				this.opts.shouldLazilyUpdateOnCacheHit ??= !this.opts.bypassTagCacheOnCacheHit;
				if (this.opts.shouldLazilyUpdateOnCacheHit !== this.opts.bypassTagCacheOnCacheHit) {
					debugCache(
						"RegionalCache",
						`\`shouldLazilyUpdateOnCacheHit\` and \`bypassTagCacheOnCacheHit\` are mutually exclusive for Next 16+.`
					);
				}
			}
		}
	}

	async get<CacheType extends CacheEntryType = "cache">(
		key: string,
		cacheType?: CacheType
	): Promise<WithLastModified<CacheValue<CacheType>> | null> {
		try {
			const cache = await this.getCacheInstance();
			const urlKey = this.getCacheUrlKey(key, cacheType);

			// Check for a cached entry as this will be faster than the store response.
			const cachedResponse = await cache.match(urlKey);

			if (cachedResponse) {
				debugCache("RegionalCache", `get ${key} -> cached response`);

				// Re-fetch from the store and update the regional cache in the background.
				// Note: this is only useful when the Cache API is not purged automatically.
				if (this.opts.shouldLazilyUpdateOnCacheHit) {
					getCloudflareContext().ctx.waitUntil(
						this.store.get(key, cacheType).then(async (rawEntry) => {
							const { value, lastModified } = rawEntry ?? {};

							if (value && typeof lastModified === "number") {
								await this.putToCache({ key, cacheType, entry: { value, lastModified } });
							}
						})
					);
				}

				const responseJson: Record<string, unknown> = await cachedResponse.json();

				return {
					...responseJson,
					shouldBypassTagCache: this.opts.bypassTagCacheOnCacheHit,
				};
			}

			const rawEntry = await this.store.get(key, cacheType);
			const { value, lastModified } = rawEntry ?? {};
			if (!value || typeof lastModified !== "number") return null;

			debugCache("RegionalCache", `get ${key} -> put to cache`);

			// Update the locale cache after retrieving from the store.
			getCloudflareContext().ctx.waitUntil(
				this.putToCache({ key, cacheType, entry: { value, lastModified } })
			);

			return { value, lastModified };
		} catch (e) {
			error("Failed to get from regional cache", e);
			return null;
		}
	}

	async set<CacheType extends CacheEntryType = "cache">(
		key: string,
		value: CacheValue<CacheType>,
		cacheType?: CacheType
	): Promise<void> {
		debugCache("RegionalCache", `set ${key}`);

		// Next.js awaits `set` while it produces the response, so awaiting the writes here
		// puts them on the critical path. The returned value is not used, so they can run
		// in the background without changing what is served.
		getCloudflareContext().ctx.waitUntil(
			(async () => {
				try {
					await this.store.set(key, value, cacheType);

					await this.putToCache({
						key,
						cacheType,
						entry: {
							value,
							// Note: `Date.now()` returns the time of the last IO rather than the actual time.
							//       See https://developers.cloudflare.com/workers/reference/security-model/
							lastModified: Date.now(),
						},
					});
				} catch (e) {
					error(`Failed to set the regional cache`, e);
				}
			})()
		);
	}

	async delete(key: string): Promise<void> {
		debugCache("RegionalCache", `delete ${key}`);
		try {
			await this.store.delete(key);

			const cache = await this.getCacheInstance();
			await cache.delete(this.getCacheUrlKey(key));
		} catch (e) {
			error("Failed to delete from regional cache", e);
		}
	}

	protected async getCacheInstance(): Promise<Cache> {
		if (this.localCache) return this.localCache;

		this.localCache = await caches.open("incremental-cache");
		return this.localCache;
	}

	protected getCacheUrlKey(key: string, cacheType?: CacheEntryType) {
		const buildId = process.env.OPEN_NEXT_BUILD_ID ?? FALLBACK_BUILD_ID;
		return "http://cache.local" + `/${buildId}/${key}`.replace(/\/+/g, "/") + `.${cacheType ?? "cache"}`;
	}

	protected async putToCache({ key, cacheType, entry }: PutToCacheInput): Promise<void> {
		const urlKey = this.getCacheUrlKey(key, cacheType);
		const cache = await this.getCacheInstance();

		const age =
			this.opts.mode === "short-lived"
				? ONE_MINUTE_IN_SECONDS
				: entry.value.revalidate || this.opts.defaultLongLivedTtlSec || THIRTY_MINUTES_IN_SECONDS;

		// We default to the entry key if no tags are found.
		// so that we can also revalidate page router based entry this way.
		const tags = getTagsFromCacheEntry(entry) ?? [key];
		await cache.put(
			urlKey,
			new Response(JSON.stringify(entry), {
				headers: new Headers({
					"cache-control": `max-age=${age}`,
					...(tags.length > 0
						? {
								"cache-tag": tags.join(","),
							}
						: {}),
				}),
			})
		);
	}
}

/**
 * A regional cache will wrap an incremental cache and provide faster cache lookups for an entry
 * when making requests within the region.
 *
 * The regional cache uses the Cache API.
 *
 * **WARNING:**
 * If an entry is revalidated on demand in one region (using either `revalidateTag`, `revalidatePath` or `res.revalidate` ), it will trigger an additional revalidation if
 * a request is made to another region that has an entry stored in its regional cache.
 *
 * @param cache Incremental cache instance.
 * @param opts Options for the regional cache.
 */
export function withRegionalCache(cache: IncrementalCache, opts: Options) {
	return new RegionalCache(cache, opts);
}

/**
 * Extract the list of tags from a cache entry.
 */
function getTagsFromCacheEntry(entry: IncrementalCacheEntry<CacheEntryType>): string[] | undefined {
	if ("tags" in entry.value && entry.value.tags) {
		return entry.value.tags;
	}

	if (
		"meta" in entry.value &&
		entry.value.meta &&
		"headers" in entry.value.meta &&
		entry.value.meta.headers
	) {
		const rawTags = entry.value.meta.headers["x-next-cache-tags"];
		if (typeof rawTags === "string") {
			return rawTags.split(",");
		}
	}
	if ("value" in entry.value) {
		return entry.value.tags;
	}
}
