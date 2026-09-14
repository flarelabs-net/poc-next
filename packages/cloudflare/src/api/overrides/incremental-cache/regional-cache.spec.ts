import type { IncrementalCache } from "@opennextjs/aws/types/overrides.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getCloudflareContext } from "../../cloudflare-context.js";
import { withRegionalCache } from "./regional-cache.js";

vi.mock("../../cloudflare-context.js", () => ({
	getCloudflareContext: vi.fn(),
}));

const mockedStore = {
	name: "mocked-store",
	get: vi.fn().mockResolvedValue(null),
	set: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined),
} satisfies IncrementalCache;

const mockedWaitUntil = vi.fn();
const mockedPut = vi.fn();

describe("regional-cache", () => {
	beforeEach(() => {
		// @ts-ignore
		globalThis.caches = {
			open: vi.fn().mockResolvedValue({
				put: mockedPut,
				match: vi.fn().mockResolvedValue(undefined),
			}),
		};
		vi.mocked(getCloudflareContext).mockReturnValue({
			ctx: { waitUntil: mockedWaitUntil },
			// @ts-ignore only `ctx` is used here
			env: {},
		});
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("set", () => {
		test("does not wait for the store write to complete", async () => {
			let resolveStoreWrite: () => void = () => {};
			mockedStore.set.mockReturnValue(
				new Promise<void>((resolve) => {
					resolveStoreWrite = resolve;
				})
			);
			const cache = withRegionalCache(mockedStore, { mode: "long-lived" });

			await cache.set("key", { type: "route", body: "", meta: {} });

			// The store write is still pending, yet `set` has already resolved.
			expect(mockedWaitUntil).toHaveBeenCalledTimes(1);
			resolveStoreWrite();
			await mockedWaitUntil.mock.calls[0]![0];
			expect(mockedStore.set).toHaveBeenCalledTimes(1);
		});

		test("writes to the store and the regional cache in the background", async () => {
			const cache = withRegionalCache(mockedStore, { mode: "long-lived" });

			await cache.set("key", { type: "route", body: "", meta: {} });
			await mockedWaitUntil.mock.calls[0]![0];

			expect(mockedStore.set).toHaveBeenCalledWith("key", { type: "route", body: "", meta: {} }, undefined);
			expect(mockedPut).toHaveBeenCalledTimes(1);
		});

		test("does not reject when the store write fails", async () => {
			mockedStore.set.mockRejectedValue(new Error("store is unavailable"));
			const cache = withRegionalCache(mockedStore, { mode: "long-lived" });

			await expect(cache.set("key", { type: "route", body: "", meta: {} })).resolves.toBeUndefined();
			// A rejected promise handed to `waitUntil` would surface as an unhandled rejection.
			await expect(mockedWaitUntil.mock.calls[0]![0]).resolves.toBeUndefined();
		});
	});
});
