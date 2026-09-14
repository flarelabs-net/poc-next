import { describe, expect, it, vi } from "vitest";

import { internalPurgeCacheByTags, parseZoneIds } from "./internal.js";

// Mock dependencies
vi.mock("@opennextjs/aws/adapters/logger.js", () => ({
	error: vi.fn(),
}));

const successBody = () => {
	return new Response(JSON.stringify({ success: true, errors: [] }), { status: 200 });
};
const failBody = () => {
	return new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: "fail" }] }), {
		status: 200,
	});
};
const rateLimitBody = () => {
	return new Response(null, { status: 429 });
};

describe("parseZoneIds", () => {
	it("should return an empty array when CACHE_PURGE_ZONE_ID is not set", () => {
		expect(parseZoneIds({} as CloudflareEnv)).toEqual([]);
	});

	it("should parse a single zone ID", () => {
		expect(parseZoneIds({ CACHE_PURGE_ZONE_ID: "zone-a" } as CloudflareEnv)).toEqual(["zone-a"]);
	});

	it("should parse comma-separated zone IDs and trim whitespace", () => {
		expect(parseZoneIds({ CACHE_PURGE_ZONE_ID: "zone-a, zone-b, zone-c" } as CloudflareEnv)).toEqual([
			"zone-a",
			"zone-b",
			"zone-c",
		]);
	});

	it("should deduplicate zone IDs", () => {
		expect(parseZoneIds({ CACHE_PURGE_ZONE_ID: "zone-a, zone-b, zone-a" } as CloudflareEnv)).toEqual([
			"zone-a",
			"zone-b",
		]);
	});

	it("should skip empty entries from trailing commas", () => {
		expect(parseZoneIds({ CACHE_PURGE_ZONE_ID: "zone-a,,zone-b," } as CloudflareEnv)).toEqual([
			"zone-a",
			"zone-b",
		]);
	});
});

describe("internalPurgeCacheByTags", () => {
	it.each([
		{ scenario: "empty zone list", zoneIds: [] as string[], env: { CACHE_PURGE_API_TOKEN: "token" } },
		{ scenario: "no API token", zoneIds: ["zone-a"], env: {} },
	])("should return missing-credentials when $scenario", async ({ zoneIds, env }) => {
		const result = await internalPurgeCacheByTags(env as CloudflareEnv, ["tag1"], zoneIds);

		expect(result).toEqual({ status: "missing-credentials", rateLimitedZones: [] });
	});

	it("should purge a single zone", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(successBody());

		const env = { CACHE_PURGE_API_TOKEN: "token" } as CloudflareEnv;

		const result = await internalPurgeCacheByTags(env, ["tag1"], ["zone-a"]);

		expect(result).toEqual({ status: "purge-success", rateLimitedZones: [] });
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/zones/zone-a/purge_cache",
			expect.objectContaining({ method: "POST" })
		);
	});

	it("should purge multiple zones in parallel", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(successBody()));

		const env = { CACHE_PURGE_API_TOKEN: "token" } as CloudflareEnv;

		const result = await internalPurgeCacheByTags(env, ["tag1"], ["zone-a", "zone-b", "zone-c"]);

		expect(result).toEqual({ status: "purge-success", rateLimitedZones: [] });
		expect(fetchSpy).toHaveBeenCalledTimes(3);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/zones/zone-a/purge_cache",
			expect.anything()
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/zones/zone-b/purge_cache",
			expect.anything()
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/zones/zone-c/purge_cache",
			expect.anything()
		);
	});

	it("should return rate-limit-exceeded with the limited zone IDs", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(successBody())
			.mockResolvedValueOnce(rateLimitBody());

		const env = { CACHE_PURGE_API_TOKEN: "token" } as CloudflareEnv;

		const result = await internalPurgeCacheByTags(env, ["tag1"], ["zone-a", "zone-b"]);

		expect(result).toEqual({ status: "rate-limit-exceeded", rateLimitedZones: ["zone-b"] });
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("should return purge-failed when any zone reports failure", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(successBody())
			.mockResolvedValueOnce(failBody());

		const env = { CACHE_PURGE_API_TOKEN: "token" } as CloudflareEnv;

		const result = await internalPurgeCacheByTags(env, ["tag1"], ["zone-a", "zone-b"]);

		expect(result).toEqual({ status: "purge-failed", rateLimitedZones: [] });
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("should pass the correct tags in the request body", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(successBody());

		const env = { CACHE_PURGE_API_TOKEN: "my-token" } as CloudflareEnv;

		await internalPurgeCacheByTags(env, ["tag1", "tag2"], ["zone-a"]);

		expect(fetchSpy).toHaveBeenCalledWith("https://api.cloudflare.com/client/v4/zones/zone-a/purge_cache", {
			body: '{"tags":["tag1","tag2"]}',
			method: "POST",
			headers: {
				Authorization: "Bearer my-token",
				"Content-Type": "application/json",
			},
		});
	});

	it("should return purge-failed when fetch throws", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

		const env = { CACHE_PURGE_API_TOKEN: "token" } as CloudflareEnv;

		const result = await internalPurgeCacheByTags(env, ["tag1"], ["zone-a"]);

		expect(result).toEqual({ status: "purge-failed", rateLimitedZones: [] });
	});

	it("should prioritise rate-limit-exceeded over purge-failed", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(failBody()).mockResolvedValueOnce(rateLimitBody());

		const env = { CACHE_PURGE_API_TOKEN: "token" } as CloudflareEnv;

		const result = await internalPurgeCacheByTags(env, ["tag1"], ["zone-a", "zone-b"]);

		expect(result).toEqual({ status: "rate-limit-exceeded", rateLimitedZones: ["zone-b"] });
	});
});
