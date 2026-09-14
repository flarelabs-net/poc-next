import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { initOpenNextCloudflareForDev as InitOpenNextCloudflareForDev } from "./cloudflare-context.js";

/**
 * Regression test for https://github.com/opennextjs/opennextjs-cloudflare/issues/1251.
 *
 * Calling `initOpenNextCloudflareForDev` more than once in the same Node.js process previously
 * surfaced as an obscure `SQLITE_BUSY` workerd error because two miniflare instances raced for the
 * same on-disk state. The function now tracks its own invocation and throws a user-actionable
 * error on the second call.
 */
describe("initOpenNextCloudflareForDev duplicate-call guard", () => {
	let initOpenNextCloudflareForDev: typeof InitOpenNextCloudflareForDev;

	beforeEach(async () => {
		// Re-import fresh per test so the module-level "has been called" flag resets between cases.
		vi.resetModules();

		// AsyncLocalStorage must be absent on globalThis so `shouldContextInitializationRun` short-
		// circuits before any wrangler / miniflare setup tries to run, isolating the duplicate-call
		// guard from the rest of the initialization path.
		vi.stubGlobal("AsyncLocalStorage", undefined);

		({ initOpenNextCloudflareForDev } = await import("./cloudflare-context.js"));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("resolves on the first call", async () => {
		await expect(initOpenNextCloudflareForDev()).resolves.toBeUndefined();
	});

	it("throws a user-actionable error on the second call in the same process", async () => {
		await initOpenNextCloudflareForDev();
		expect(() => initOpenNextCloudflareForDev()).toThrow(
			/`initOpenNextCloudflareForDev` was called more than once in the same process/
		);
	});

	it("mentions the SQLITE_BUSY workerd symptom and points the user at the config file", async () => {
		await initOpenNextCloudflareForDev();
		expect(() => initOpenNextCloudflareForDev()).toThrowError(
			expect.objectContaining({
				message: expect.stringMatching(/Next\.js config file/),
			})
		);
		expect(() => initOpenNextCloudflareForDev()).toThrowError(
			expect.objectContaining({
				message: expect.stringMatching(/SQLITE_BUSY/),
			})
		);
	});

	it("treats each fresh module load as its own process for the purpose of the guard", async () => {
		await initOpenNextCloudflareForDev();
		expect(() => initOpenNextCloudflareForDev()).toThrow();

		// Simulating a new process boundary: re-import the module and call once - it should resolve
		// because the module-level flag is fresh.
		vi.resetModules();
		const fresh = await import("./cloudflare-context.js");
		await expect(fresh.initOpenNextCloudflareForDev()).resolves.toBeUndefined();
	});
});
