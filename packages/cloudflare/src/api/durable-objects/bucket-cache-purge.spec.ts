import { describe, expect, it, vi } from "vitest";

import * as internal from "../overrides/internal.js";
import { BucketCachePurge } from "./bucket-cache-purge.js";

vi.mock("cloudflare:workers", () => ({
	DurableObject: class {
		constructor(
			public ctx: DurableObjectState,
			public env: CloudflareEnv
		) {}
	},
}));

const createBucketCachePurge = () => {
	const mockState = {
		waitUntil: vi.fn(),
		blockConcurrencyWhile: vi.fn().mockImplementation(async (fn) => fn()),
		storage: {
			setAlarm: vi.fn(),
			getAlarm: vi.fn(),
			sql: {
				exec: vi.fn().mockImplementation(() => ({
					one: vi.fn(),
					toArray: vi.fn().mockReturnValue([]),
				})),
			},
		},
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return new BucketCachePurge(mockState as any, {});
};

describe("BucketCachePurge", () => {
	it("should block concurrency while creating the tables", async () => {
		const cache = createBucketCachePurge();
		// @ts-expect-error - testing private method
		expect(cache.ctx.blockConcurrencyWhile).toHaveBeenCalled();
		// @ts-expect-error - testing private method
		expect(cache.ctx.storage.sql.exec).toHaveBeenCalledWith(
			expect.stringContaining("CREATE TABLE IF NOT EXISTS cache_purge")
		);
		// @ts-expect-error - testing private method
		expect(cache.ctx.storage.sql.exec).toHaveBeenCalledWith(
			expect.stringContaining("CREATE TABLE IF NOT EXISTS pending_zones")
		);
	});

	describe("purgeCacheByTags", () => {
		it("should insert tags into the sql table", async () => {
			const cache = createBucketCachePurge();
			const tags = ["tag1", "tag2"];
			await cache.purgeCacheByTags(tags);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenCalledWith(
				expect.stringContaining("INSERT OR REPLACE INTO cache_purge"),
				tags[0]
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenCalledWith(
				expect.stringContaining("INSERT OR REPLACE INTO cache_purge"),
				tags[1]
			);
		});

		it("should set an alarm if no alarm is set", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.getAlarm.mockResolvedValueOnce(null);
			await cache.purgeCacheByTags(["tag"]);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.setAlarm).toHaveBeenCalled();
		});

		it("should not set an alarm if one is already set", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.getAlarm.mockResolvedValueOnce(true);
			await cache.purgeCacheByTags(["tag"]);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.setAlarm).not.toHaveBeenCalled();
		});
	});

	describe("alarm", () => {
		it("should purge cache by tags and delete them from the sql table", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec.mockReturnValueOnce({
				toArray: () => [{ tag: "tag1" }, { tag: "tag2" }],
			});
			vi.spyOn(internal, "internalPurgeCacheByTags").mockResolvedValue({
				status: "purge-success",
				rateLimitedZones: [],
			});
			await cache.alarm();
			// SqlStorage.exec(query, ...bindings) is variadic: each placeholder needs
			// its own binding argument. Passing the tags as a single array made the
			// binding count (1) disagree with the placeholder count (N), so exec threw
			// "Wrong number of parameter bindings" and the purge never ran (#1288). The
			// bindings must be spread.
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenCalledWith(
				expect.stringContaining("DELETE FROM cache_purge"),
				"tag1",
				"tag2"
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).not.toHaveBeenCalledWith(
				expect.stringContaining("DELETE FROM cache_purge"),
				["tag1", "tag2"]
			);
		});

		it("should not purge cache if no tags are found", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec.mockReturnValueOnce({
				toArray: () => [],
			});
			await cache.alarm();
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).not.toHaveBeenCalledWith(
				expect.stringContaining("DELETE FROM cache_purge"),
				[]
			);
		});

		it("should call internalPurgeCacheByTags with the correct tags and empty pending zones", async () => {
			const cache = createBucketCachePurge();
			const tags = ["tag1", "tag2"];
			// 1st call after constructor: SELECT cache_purge
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec.mockReturnValueOnce({
				toArray: () => tags.map((tag) => ({ tag })),
			});
			const internalPurgeCacheByTagsSpy = vi
				.spyOn(internal, "internalPurgeCacheByTags")
				.mockResolvedValue({ status: "purge-success", rateLimitedZones: [] });
			await cache.alarm();
			expect(internalPurgeCacheByTagsSpy).toHaveBeenCalledWith(
				// @ts-expect-error - testing private method
				cache.env,
				tags,
				[]
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("CREATE TABLE IF NOT EXISTS cache_purge")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("SELECT * FROM cache_purge LIMIT 100")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("SELECT * FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("DELETE FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining("DELETE FROM cache_purge"),
				"tag1",
				"tag2"
			);
		});

		it("should continue until all tags are purged", async () => {
			const cache = createBucketCachePurge();
			const tags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec.mockReturnValueOnce({
				toArray: () => tags.map((tag) => ({ tag })),
			});
			const internalPurgeCacheByTagsSpy = vi
				.spyOn(internal, "internalPurgeCacheByTags")
				.mockResolvedValue({ status: "purge-success", rateLimitedZones: [] });
			await cache.alarm();
			expect(internalPurgeCacheByTagsSpy).toHaveBeenCalledWith(
				// @ts-expect-error - testing private method
				cache.env,
				tags,
				[]
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("CREATE TABLE IF NOT EXISTS cache_purge")
			);
			// get first 100 tags and delete them
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("SELECT * FROM cache_purge LIMIT 100")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("SELECT * FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("DELETE FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining("DELETE FROM cache_purge"),
				...tags
			);
			// get the next 100 tags
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				6,
				expect.stringContaining("SELECT * FROM cache_purge LIMIT 100")
			);
		});

		it("should throw on rate-limit and persist the rate-limited zones", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec.mockReturnValueOnce({
				toArray: () => [{ tag: "tag1" }],
			});
			vi.spyOn(internal, "internalPurgeCacheByTags").mockResolvedValue({
				status: "rate-limit-exceeded",
				rateLimitedZones: ["zone-b"],
			});

			await expect(cache.alarm()).rejects.toThrow("Rate limit exceeded");

			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("SELECT * FROM cache_purge LIMIT 100")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("SELECT * FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("DELETE FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining("INSERT OR REPLACE INTO pending_zones"),
				"zone-b"
			);
			// Tags should NOT be deleted, they must be retried.
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).not.toHaveBeenCalledWith(
				expect.stringContaining("DELETE FROM cache_purge"),
				expect.anything()
			);
		});

		it("should pass pending zones to internalPurgeCacheByTags on retry", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec
				// 1st exec call after constructor: SELECT cache_purge (returns tags)
				.mockReturnValueOnce({ toArray: () => [{ tag: "tag1" }] })
				// 2nd exec call: SELECT pending_zones (returns stored zones from previous attempt)
				.mockReturnValueOnce({ toArray: () => [{ zone_id: "zone-b" }] });

			const internalPurgeCacheByTagsSpy = vi.spyOn(internal, "internalPurgeCacheByTags").mockResolvedValue({
				status: "purge-success",
				rateLimitedZones: [],
			});

			await cache.alarm();

			expect(internalPurgeCacheByTagsSpy).toHaveBeenCalledWith(
				// @ts-expect-error - testing private method
				cache.env,
				["tag1"],
				["zone-b"]
			);
		});

		it("should clear pending zones after a successful retry", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec
				// 1st exec call after constructor: SELECT cache_purge (returns tags)
				.mockReturnValueOnce({ toArray: () => [{ tag: "tag1" }] })
				// 2nd exec call: SELECT pending_zones (returns stored zones from previous attempt)
				.mockReturnValueOnce({ toArray: () => [{ zone_id: "zone-b" }] });

			vi.spyOn(internal, "internalPurgeCacheByTags").mockResolvedValue({
				status: "purge-success",
				rateLimitedZones: [],
			});

			await cache.alarm();

			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("SELECT * FROM cache_purge LIMIT 100")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("SELECT * FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("DELETE FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining("DELETE FROM cache_purge"),
				"tag1"
			);
		});

		it("should replace pending zones with only the still-limited zones on repeated rate-limit", async () => {
			const cache = createBucketCachePurge();
			// @ts-expect-error - testing private method
			cache.ctx.storage.sql.exec
				// 1st exec call after constructor: SELECT cache_purge (returns tags)
				.mockReturnValueOnce({ toArray: () => [{ tag: "tag1" }] })
				// 2nd exec call: SELECT pending_zones (returns stored zones from previous attempt)
				.mockReturnValueOnce({ toArray: () => [{ zone_id: "zone-b" }, { zone_id: "zone-c" }] });

			vi.spyOn(internal, "internalPurgeCacheByTags").mockResolvedValue({
				status: "rate-limit-exceeded",
				// zone-b succeeded this time, only zone-c is still limited
				rateLimitedZones: ["zone-c"],
			});

			await expect(cache.alarm()).rejects.toThrow("Rate limit exceeded");

			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("SELECT * FROM cache_purge LIMIT 100")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("SELECT * FROM pending_zones")
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("DELETE FROM pending_zones")
			);
			// Only zone-c is persisted, not zone-b.
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining("INSERT OR REPLACE INTO pending_zones"),
				"zone-c"
			);
			// @ts-expect-error - testing private method
			expect(cache.ctx.storage.sql.exec).not.toHaveBeenCalledWith(
				expect.stringContaining("INSERT OR REPLACE INTO pending_zones"),
				"zone-b"
			);
		});
	});
});
