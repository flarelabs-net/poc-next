import { createHash } from "node:crypto";

import { error } from "@opennextjs/aws/adapters/logger.js";
import type { CacheEntryType, CacheValue } from "@opennextjs/aws/types/overrides.js";

import { getCloudflareContext } from "../cloudflare-context.js";

export type IncrementalCacheEntry<CacheType extends CacheEntryType> = {
	value: CacheValue<CacheType>;
	lastModified: number;
};

export const debugCache = (name: string, ...args: unknown[]) => {
	if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
		console.log(`[${name}] `, ...args);
	}
};

export const FALLBACK_BUILD_ID = "no-build-id";

export const DEFAULT_PREFIX = "incremental-cache";

export type KeyOptions = {
	cacheType?: CacheEntryType;
	prefix: string | undefined;
	buildId: string | undefined;
};

export function computeCacheKey(key: string, options: KeyOptions) {
	const { cacheType = "cache", prefix = DEFAULT_PREFIX, buildId = FALLBACK_BUILD_ID } = options;
	const hash = createHash("sha256").update(key).digest("hex");
	return `${prefix}/${buildId}/${hash}.${cacheType}`.replace(/\/+/g, "/");
}

export function isPurgeCacheEnabled(): boolean {
	// The `?` is required at `openNextConfig?` or the Open Next build fails because of a type error
	const cdnInvalidation = globalThis.openNextConfig?.default?.override?.cdnInvalidation;

	return cdnInvalidation !== undefined && cdnInvalidation !== "dummy";
}

export async function purgeCacheByTags(tags: string[]) {
	const { env } = getCloudflareContext();
	// We have a durable object for purging cache
	// We should use it
	if (env.NEXT_CACHE_DO_PURGE) {
		const durableObject = env.NEXT_CACHE_DO_PURGE;
		const id = durableObject.idFromName("cache-purge");
		const obj = durableObject.get(id);
		await obj.purgeCacheByTags(tags);
	} else {
		// We don't have a durable object for purging cache
		// We should use the API directly
		const zoneIds = parseZoneIds(env);
		await internalPurgeCacheByTags(env, tags, zoneIds);
	}
}

type PurgeCacheStatus = "missing-credentials" | "rate-limit-exceeded" | "purge-failed" | "purge-success";

/**
 * Parse zone IDs from the `CACHE_PURGE_ZONE_ID` environment variable.
 */
export function parseZoneIds(env: CloudflareEnv): string[] {
	const zoneIds = new Set<string>();
	if (env.CACHE_PURGE_ZONE_ID) {
		for (const raw of env.CACHE_PURGE_ZONE_ID.split(",")) {
			const id = raw.trim();
			if (id) {
				zoneIds.add(id);
			}
		}
	}
	return [...zoneIds];
}

/**
 * Purge cache tags for one or more zones.
 *
 * @param env     - The Cloudflare environment bindings.
 * @param tags    - The cache tags to purge.
 * @param zoneIds - The zone IDs to purge. Use {@link parseZoneIds} to derive
 *                  them from the environment, or pass a subset to retry only
 *                  specific zones.
 */
export async function internalPurgeCacheByTags(
	env: CloudflareEnv,
	tags: string[],
	zoneIds: string[]
): Promise<{ status: PurgeCacheStatus; rateLimitedZones: string[] }> {
	if (zoneIds.length === 0 || !env.CACHE_PURGE_API_TOKEN) {
		// THIS IS A NO-OP
		error("No cache zone ID(s) or API token provided. Skipping cache purge.");
		return { status: "missing-credentials", rateLimitedZones: [] };
	}

	const results = await Promise.all(zoneIds.map((zoneId) => purgeZone(env, zoneId, tags)));

	const rateLimitedZones = results.filter((r) => r.status === "rate-limit-exceeded").map((r) => r.zoneId);

	if (rateLimitedZones.length > 0) {
		return { status: "rate-limit-exceeded", rateLimitedZones };
	}

	if (results.some((r) => r.status === "purge-failed")) {
		return { status: "purge-failed", rateLimitedZones: [] };
	}

	return { status: "purge-success", rateLimitedZones: [] };
}

async function purgeZone(
	env: CloudflareEnv,
	zoneId: string,
	tags: string[]
): Promise<{ zoneId: string; status: PurgeCacheStatus }> {
	let response: Response | undefined;
	try {
		response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
			headers: {
				Authorization: `Bearer ${env.CACHE_PURGE_API_TOKEN}`,
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify({
				tags,
			}),
		});
		if (response.status === 429) {
			// Rate limit exceeded
			error(`purgeCacheByTags: Rate limit exceeded for zone ${zoneId}. Skipping cache purge.`);
			return { zoneId, status: "rate-limit-exceeded" };
		}
		const bodyResponse = (await response.json()) as {
			success: boolean;
			errors: Array<{ code: number; message: string }>;
		};
		if (!bodyResponse.success) {
			error(
				`purgeCacheByTags: Cache purge failed for zone ${zoneId}. Errors:`,
				bodyResponse.errors.map((error) => `${error.code}: ${error.message}`)
			);
			return { zoneId, status: "purge-failed" };
		}
		debugCache("purgeCacheByTags", `Cache purged successfully for zone ${zoneId}, tags:`, tags);
		return { zoneId, status: "purge-success" };
	} catch (e) {
		error(`Error purging cache by tags for zone ${zoneId}:`, e);
		return { zoneId, status: "purge-failed" };
	} finally {
		// Cancel the stream when it has not been consumed
		try {
			await response?.body?.cancel();
		} catch {
			// Ignore errors when the stream was actually consumed
		}
	}
}
