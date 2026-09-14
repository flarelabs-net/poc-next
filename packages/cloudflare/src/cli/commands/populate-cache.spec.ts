import { EventEmitter } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BuildOptions } from "@opennextjs/aws/build/helper.js";
import mockFs from "mock-fs";
import rclone from "rclone.js";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { Unstable_Config as WranglerConfig } from "wrangler";
import { unstable_startWorker } from "wrangler";

import { defineCloudflareConfig } from "../../api/config.js";
import r2IncrementalCache from "../../api/overrides/incremental-cache/r2-incremental-cache.js";
import { ensureR2Bucket } from "../utils/ensure-r2-bucket.js";
import {
	getCacheAssets,
	loadRclone,
	MAX_REQUEST_RETRIES,
	MAX_RETRY_DELAY_MS,
	populateCache,
	PopulateCacheOptions,
} from "./populate-cache.js";
import { WorkerEnvVar } from "./utils/helpers.js";

describe("getCacheAssets", () => {
	beforeAll(() => {
		mockFs();

		const fetchBaseDir = "/base/path/cache/__fetch/buildID";
		const cacheDir = "/base/path/cache/buildID/path/to";

		mkdirSync(fetchBaseDir, { recursive: true });
		mkdirSync(cacheDir, { recursive: true });

		for (let i = 0; i < 3; i++) {
			writeFileSync(path.join(fetchBaseDir, `${i}`), "", { encoding: "utf-8" });
			writeFileSync(path.join(cacheDir, `${i}.cache`), "", { encoding: "utf-8" });
		}
	});

	afterAll(() => mockFs.restore());

	test("list cache assets", () => {
		expect(getCacheAssets({ outputDir: "/base/path" } as BuildOptions)).toMatchInlineSnapshot(`
      [
        {
          "buildId": "buildID",
          "fullPath": "/base/path/cache/buildID/path/to/2.cache",
          "isFetch": false,
          "key": "/path/to/2",
        },
        {
          "buildId": "buildID",
          "fullPath": "/base/path/cache/buildID/path/to/1.cache",
          "isFetch": false,
          "key": "/path/to/1",
        },
        {
          "buildId": "buildID",
          "fullPath": "/base/path/cache/buildID/path/to/0.cache",
          "isFetch": false,
          "key": "/path/to/0",
        },
        {
          "buildId": "buildID",
          "fullPath": "/base/path/cache/__fetch/buildID/2",
          "isFetch": true,
          "key": "/2",
        },
        {
          "buildId": "buildID",
          "fullPath": "/base/path/cache/__fetch/buildID/1",
          "isFetch": true,
          "key": "/1",
        },
        {
          "buildId": "buildID",
          "fullPath": "/base/path/cache/__fetch/buildID/0",
          "isFetch": true,
          "key": "/0",
        },
      ]
    `);
	});
});

// Mock `node:timers/promises` so that `setTimeout` delegates to `globalThis.setTimeout`,
// which is correctly intercepted by `vi.useFakeTimers()`. Without this, the destructured
// import in the source code holds a reference to the original native `setTimeout`, making
// `vi.advanceTimersByTimeAsync()` ineffective and causing tests to wait real wall-clock time.
vi.mock("node:timers/promises", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:timers/promises")>();
	return {
		...original,
		setTimeout: (ms: number, value?: unknown) =>
			new Promise((resolve) => globalThis.setTimeout(() => resolve(value), ms)),
	};
});

vi.mock("./utils/run-wrangler.js", () => ({
	runWrangler: vi.fn(() => ({ success: true, stdout: "", stderr: "" })),
}));

vi.mock("./utils/helpers.js", () => ({
	getEnvFromPlatformProxy: vi.fn(async () => ({})),
}));

vi.mock("../utils/ensure-r2-bucket.js");
vi.mock("rclone.js", () => ({
	default: {
		copy: vi.fn(() => {
			const child = new EventEmitter();
			queueMicrotask(() => child.emit("close", 0, null));
			return child;
		}),
		promises: {
			version: vi.fn(async () => ""),
		},
	},
}));
vi.mock("wrangler");

describe("populateCache", () => {
	const buildOptions = {
		appPath: "/test/app",
		outputDir: "/test/output",
	} as BuildOptions;
	const config = defineCloudflareConfig({
		incrementalCache: r2IncrementalCache,
	});
	const wranglerConfig = {
		r2_buckets: [
			{
				binding: "NEXT_INC_CACHE_R2_BUCKET",
				bucket_name: "test-bucket",
				preview_bucket_name: "preview-bucket",
				jurisdiction: "eu",
			},
		],
	} as WranglerConfig;
	const envVars = {} as WorkerEnvVar;

	const setupMockFileSystem = () => {
		mockFs({
			"/test/output": {
				cache: {
					buildID: {
						path: {
							to: {
								"test.cache": JSON.stringify({ data: "test" }),
							},
						},
					},
				},
			},
		});
	};

	describe("R2 incremental cache", () => {
		afterEach(() => {
			vi.resetAllMocks();
			vi.useRealTimers();
			mockFs.restore();
		});

		test.each<PopulateCacheOptions>([
			{ target: "local", shouldUsePreviewId: false },
			{ target: "remote", shouldUsePreviewId: false },
			{ target: "remote", shouldUsePreviewId: true },
		])(
			`$target (shouldUsePreviewId: $shouldUsePreviewId) - starts worker and sends individual cache entries with the cache key header`,
			async (populateCacheOptions) => {
				const bucketName =
					populateCacheOptions.target === "remote" && populateCacheOptions.shouldUsePreviewId
						? "preview-bucket"
						: "test-bucket";
				const mockWorkerDispose = vi.fn();

				setupMockFileSystem();
				vi.useFakeTimers();
				// @ts-expect-error - Mock unstable_startWorker to return a mock worker instance
				vi.mocked(unstable_startWorker).mockResolvedValueOnce({
					ready: Promise.resolve(),
					url: Promise.resolve(new URL("http://localhost:12345")),
					dispose: mockWorkerDispose,
				});
				vi.mocked(ensureR2Bucket).mockResolvedValueOnce({ success: true, bucketName });

				// Mock fetch to return a successful response for each individual entry.
				const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				});

				await populateCache(buildOptions, config, wranglerConfig, populateCacheOptions, envVars);

				expect(unstable_startWorker).toHaveBeenCalledWith(
					expect.objectContaining({
						bindings: expect.objectContaining({
							R2: expect.objectContaining({
								type: "r2_bucket",
								bucket_name: bucketName,
								jurisdiction: "eu",
							}),
						}),
						dev: expect.objectContaining({
							remote: populateCacheOptions.target === "remote",
						}),
					})
				);

				if (populateCacheOptions.target === "remote") {
					expect(ensureR2Bucket).toHaveBeenCalledWith("/test/app", bucketName, "eu");
				} else {
					expect(ensureR2Bucket).not.toHaveBeenCalled();
				}

				expect(fetchMock).toHaveBeenCalled();

				for (const [input, init] of fetchMock.mock.calls) {
					expect(input).toBe("http://localhost:12345/populate");
					expect(init?.method).toBe("POST");
					expect(init?.headers).toEqual({
						"x-opennext-cache-key": expect.any(String),
						"content-length": expect.any(String),
					});
					expect(init?.body).toBeInstanceOf(ReadableStream);
				}

				// Verify worker was disposed after sending entries.
				expect(mockWorkerDispose).toHaveBeenCalled();
			}
		);

		test("remote with rclone - uploads staged cache entries without starting a worker", async () => {
			setupMockFileSystem();

			await populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "remote", shouldUsePreviewId: false, useRclone: true, cacheChunkSize: 20 },
				{
					R2_ACCESS_KEY_ID: "access-key",
					R2_SECRET_ACCESS_KEY: "secret-key",
					CF_ACCOUNT_ID: "account-id",
				} as WorkerEnvVar
			);

			expect(rclone.copy).toHaveBeenCalledWith(
				expect.any(String),
				"r2:test-bucket",
				expect.objectContaining({
					progress: true,
					transfers: 20,
					checkers: 10,
					env: expect.objectContaining({ RCLONE_CONFIG: expect.any(String) }),
					stdio: "inherit",
				})
			);
			expect(unstable_startWorker).not.toHaveBeenCalled();
			expect(ensureR2Bucket).not.toHaveBeenCalled();
		});

		test("remote with rclone - uses the default transfer concurrency", async () => {
			setupMockFileSystem();

			await populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "remote", shouldUsePreviewId: false, useRclone: true },
				{
					R2_ACCESS_KEY_ID: "access-key",
					R2_SECRET_ACCESS_KEY: "secret-key",
					CF_ACCOUNT_ID: "account-id",
				} as WorkerEnvVar
			);

			expect(rclone.copy).toHaveBeenCalledWith(
				expect.any(String),
				"r2:test-bucket",
				expect.objectContaining({ transfers: 25, checkers: 12 })
			);
		});

		test("remote with rclone - rejects a failed rclone process", async () => {
			setupMockFileSystem();
			vi.mocked(rclone.copy).mockImplementationOnce(() => {
				const child = new EventEmitter();
				queueMicrotask(() => child.emit("close", 7, null));
				return child as ReturnType<typeof rclone.copy>;
			});

			await expect(
				populateCache(
					buildOptions,
					config,
					wranglerConfig,
					{ target: "remote", shouldUsePreviewId: false, useRclone: true },
					{
						R2_ACCESS_KEY_ID: "access-key",
						R2_SECRET_ACCESS_KEY: "secret-key",
						CF_ACCOUNT_ID: "account-id",
					} as WorkerEnvVar
				)
			).rejects.toThrow("rclone exited with code 7");
		});

		test("local with rclone - rejects the unsupported option", async () => {
			setupMockFileSystem();

			await expect(
				populateCache(
					buildOptions,
					config,
					wranglerConfig,
					{ target: "local", shouldUsePreviewId: false, useRclone: true },
					envVars
				)
			).rejects.toThrow("The `--rclone` option can only be used when populating a remote R2 cache.");
		});

		test("remote with rclone - rejects missing R2 credentials", async () => {
			setupMockFileSystem();

			await expect(
				populateCache(
					buildOptions,
					config,
					wranglerConfig,
					{ target: "remote", shouldUsePreviewId: false, useRclone: true },
					envVars
				)
			).rejects.toThrow(
				"R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CF_ACCOUNT_ID must be provided to use `rclone`"
			);
		});

		test("remote with rclone - rejects cache prefixes that escape the staging directory", async () => {
			setupMockFileSystem();

			await expect(
				populateCache(
					buildOptions,
					config,
					wranglerConfig,
					{ target: "remote", shouldUsePreviewId: false, useRclone: true },
					{
						R2_ACCESS_KEY_ID: "access-key",
						R2_SECRET_ACCESS_KEY: "secret-key",
						CF_ACCOUNT_ID: "account-id",
						NEXT_INC_CACHE_R2_PREFIX: "../escaped",
					} as WorkerEnvVar
				)
			).rejects.toThrow("Cannot stage R2 cache key outside the temporary directory");
		});

		test("remote with rclone - explains how to install the rclone executable with pnpm", async () => {
			setupMockFileSystem();
			vi.mocked(rclone.promises.version).mockRejectedValueOnce(
				Object.assign(new Error("spawn rclone ENOENT"), { code: "ENOENT" })
			);

			await expect(
				populateCache(
					buildOptions,
					config,
					wranglerConfig,
					{ target: "remote", shouldUsePreviewId: false, useRclone: true },
					{
						R2_ACCESS_KEY_ID: "access-key",
						R2_SECRET_ACCESS_KEY: "secret-key",
						CF_ACCOUNT_ID: "account-id",
					} as WorkerEnvVar
				)
			).rejects.toThrow(
				"pnpm users must allow its install script with `pnpm approve-builds`, select `rclone.js`, then run `pnpm rebuild rclone.js`"
			);
		});

		test("remote - exits when bucket provisioning fails", async () => {
			setupMockFileSystem();
			vi.mocked(ensureR2Bucket).mockResolvedValueOnce({
				success: false,
				error: "wrangler login failed",
			});

			const result = populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "remote", shouldUsePreviewId: false },
				envVars
			);

			await expect(result).rejects.toThrow(
				'Failed to provision remote R2 bucket "test-bucket" for binding "NEXT_INC_CACHE_R2_BUCKET": wrangler login failed'
			);

			expect(unstable_startWorker).not.toHaveBeenCalled();
		});

		test("retries timed out requests to the R2 worker", async () => {
			setupMockFileSystem();
			vi.useFakeTimers();

			const mockWorkerDispose = vi.fn();
			// @ts-expect-error - Mock unstable_startWorker to return a mock worker instance
			vi.mocked(unstable_startWorker).mockResolvedValueOnce({
				ready: Promise.resolve(),
				url: Promise.resolve(new URL("http://localhost:12345")),
				dispose: mockWorkerDispose,
			});
			vi.spyOn(AbortSignal, "timeout");

			const fetchMock = vi
				.spyOn(global, "fetch")
				.mockImplementationOnce(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					const timeoutError = new Error("Request timed out");
					timeoutError.name = "TimeoutError";
					throw timeoutError;
				})
				.mockImplementationOnce(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				});

			const result = populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "local", shouldUsePreviewId: false },
				envVars
			);

			await vi.waitFor(() => {
				expect(AbortSignal.timeout).toHaveBeenCalledWith(60_000);
				expect(fetchMock).toHaveBeenCalledTimes(1);
			});

			await vi.advanceTimersByTimeAsync(250);
			await result;

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(mockWorkerDispose).toHaveBeenCalled();
		});

		test("retries 5xx responses from the R2 worker", async () => {
			setupMockFileSystem();
			vi.useFakeTimers();
			vi.spyOn(AbortSignal, "timeout");

			const mockWorkerDispose = vi.fn();
			// @ts-expect-error - Mock unstable_startWorker to return a mock worker instance
			vi.mocked(unstable_startWorker).mockResolvedValueOnce({
				ready: Promise.resolve(),
				url: Promise.resolve(new URL("http://localhost:12345")),
				dispose: mockWorkerDispose,
			});

			const fetchMock = vi
				.spyOn(global, "fetch")
				.mockImplementationOnce(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					return new Response(
						JSON.stringify({ success: false, error: "R2 storage error", code: "ERR_WRITE_FAILED" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						}
					);
				})
				.mockImplementationOnce(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				});

			const result = populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "local", shouldUsePreviewId: false },
				envVars
			);

			await vi.waitFor(() => {
				expect(fetchMock).toHaveBeenCalledTimes(1);
			});

			await vi.advanceTimersByTimeAsync(250);
			await expect(result).resolves.toBeUndefined();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(AbortSignal.timeout).toHaveBeenCalledWith(60_000);
			expect(mockWorkerDispose).toHaveBeenCalled();
		});

		test("retries worker exceeded resource limits responses", async () => {
			setupMockFileSystem();
			vi.useFakeTimers();

			const mockWorkerDispose = vi.fn();
			// @ts-expect-error - Mock unstable_startWorker to return a mock worker instance
			vi.mocked(unstable_startWorker).mockResolvedValueOnce({
				ready: Promise.resolve(),
				url: Promise.resolve(new URL("http://localhost:12345")),
				dispose: mockWorkerDispose,
			});

			const fetchMock = vi
				.spyOn(global, "fetch")
				.mockImplementationOnce(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					return new Response(
						"<!DOCTYPE html><title>Worker exceeded resource limits</title><h1>Error 1102</h1></html>",
						{
							status: 200,
							headers: { "Content-Type": "text/html" },
						}
					);
				})
				.mockImplementationOnce(async (_input, init) => {
					if (init?.body instanceof ReadableStream) {
						await init.body.cancel();
					}

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				});

			const result = populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "local", shouldUsePreviewId: false },
				envVars
			);

			await vi.waitFor(() => {
				expect(fetchMock).toHaveBeenCalledTimes(1);
			});

			await vi.advanceTimersByTimeAsync(250);
			await expect(result).resolves.toBeUndefined();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(mockWorkerDispose).toHaveBeenCalled();
		});

		test("exhausts all retries with exponential backoff for 5xx responses", async () => {
			setupMockFileSystem();
			vi.useFakeTimers();

			const mockWorkerDispose = vi.fn();
			// @ts-expect-error - Mock unstable_startWorker to return a mock worker instance
			vi.mocked(unstable_startWorker).mockResolvedValueOnce({
				ready: Promise.resolve(),
				url: Promise.resolve(new URL("http://localhost:12345")),
				dispose: mockWorkerDispose,
			});

			const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
				if (init?.body instanceof ReadableStream) {
					await init.body.cancel();
				}

				return new Response(
					JSON.stringify({ success: false, error: "R2 storage error", code: "ERR_WRITE_FAILED" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			});

			const result = populateCache(
				buildOptions,
				config,
				wranglerConfig,
				{ target: "local", shouldUsePreviewId: false },
				envVars
			);

			const resultExpectation = expect(result).rejects.toThrow(
				new RegExp(
					`Failed to populate the local R2 cache: Failed to write "incremental-cache\\/buildID\\/[A-Za-z0-9]+\\.cache" to R2 after ${MAX_REQUEST_RETRIES} attempts`
				)
			);

			await vi.advanceTimersByTimeAsync(MAX_REQUEST_RETRIES * MAX_RETRY_DELAY_MS);
			await resultExpectation;

			expect(fetchMock).toHaveBeenCalledTimes(MAX_REQUEST_RETRIES);
			expect(mockWorkerDispose).toHaveBeenCalled();
		});
	});
});

describe("loadRclone", () => {
	test("reports how to install the optional peer dependency", async () => {
		const missingModuleError = Object.assign(new Error("Cannot find package 'rclone.js'"), {
			code: "ERR_MODULE_NOT_FOUND",
		});

		await expect(
			loadRclone(async () => {
				throw missingModuleError;
			})
		).rejects.toThrow(
			"The `--rclone` option requires the optional `rclone.js` peer dependency. Install it in your project before using this option."
		);
	});
});
