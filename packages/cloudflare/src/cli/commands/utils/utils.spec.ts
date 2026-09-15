import logger from "@opennextjs/aws/logger.js";
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { askConfirmation } from "../../utils/ask-confirmation.js";
import { createOpenNextConfigFile, findOpenNextConfig } from "../../utils/create-open-next-config.js";
import { isNonInteractiveOrCI } from "../../utils/is-interactive.js";
import { compileConfig, retrieveCompiledConfig } from "./utils.js";

const { mockExistsSync } = vi.hoisted(() => ({
	mockExistsSync: vi.fn(),
}));

// Mock node:fs — only override existsSync
vi.mock("node:fs", async (importOriginal) => {
	const mod = await importOriginal<typeof import("node:fs")>();
	return { ...mod, existsSync: mockExistsSync };
});

// Mock logger
vi.mock("@opennextjs/aws/logger.js", () => ({
	default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), setLevel: vi.fn() },
}));

// Mock compileOpenNextConfig
const mockCompileOpenNextConfig = vi.fn(async (...args: [unknown, unknown]) => {
	void args;

	return {
		config: { default: {} },
		buildDir: "/build",
	};
});
vi.mock("@opennextjs/aws/build/compileConfig.js", () => ({
	compileOpenNextConfig: (...args: [unknown, unknown]) => mockCompileOpenNextConfig(...args),
}));

// Mock ensureCloudflareConfig
vi.mock("../../build/utils/ensure-cf-config.js", () => ({
	ensureCloudflareConfig: vi.fn(),
}));

// Mock askConfirmation
vi.mock("../../utils/ask-confirmation.js", () => ({
	askConfirmation: vi.fn(),
}));

// Mock CI/non-interactive detector — default to interactive local behavior.
vi.mock("../../utils/is-interactive.js", () => ({
	isNonInteractiveOrCI: vi.fn(() => false),
}));

// Mock create-config-files (unused import in utils.ts but required for module resolution)
vi.mock("../../utils/create-config-files.js", () => ({
	createOpenNextConfigIfNotExistent: vi.fn(),
}));

// Mock create-open-next-config
vi.mock("../../utils/create-open-next-config.js", () => ({
	findOpenNextConfig: vi.fn(),
	createOpenNextConfigFile: vi.fn(() => "/test/open-next.config.ts"),
	OPEN_NEXT_CONFIG_FILE_NAME: "open-next.config.ts",
}));

// Mock wrangler
vi.mock("wrangler", () => ({
	unstable_readConfig: vi.fn(),
}));

// Mock build utils
vi.mock("@opennextjs/aws/build/utils.js", () => ({
	printHeader: vi.fn(),
	showWarningOnWindows: vi.fn(),
}));

// Mock build helper
vi.mock("@opennextjs/aws/build/helper.js", () => ({
	normalizeOptions: vi.fn(() => ({})),
}));

// Mock the worker path helper
vi.mock("../../build/bundle-server.js", () => ({
	getOutputWorkerPath: vi.fn(() => "/build-output/worker.js"),
}));

describe("compileConfig", () => {
	beforeEach(() => {
		vi.mocked(isNonInteractiveOrCI).mockReturnValue(false);
	});

	it("should compile config when configPath is provided and file exists", async () => {
		mockExistsSync.mockReturnValue(true);

		const result = await compileConfig("/app/open-next.config.ts");

		expect(mockCompileOpenNextConfig).toHaveBeenCalledWith("/app/open-next.config.ts", { compileEdge: true });
		expect(result).toEqual({ config: { default: {} }, buildDir: "/build" });
	});

	it("should throw when configPath is provided but file does not exist", async () => {
		mockExistsSync.mockReturnValue(false);

		await expect(compileConfig("/app/missing-config.ts")).rejects.toThrowErrorMatchingInlineSnapshot(
			`[Error: Custom config file not found at /app/missing-config.ts]`
		);
	});

	it("should compile config when no configPath is provided but one is found", async () => {
		vi.mocked(findOpenNextConfig).mockReturnValue("/app/open-next.config.ts");

		const result = await compileConfig(undefined);

		expect(findOpenNextConfig).toHaveBeenCalledOnce();
		expect(mockCompileOpenNextConfig).toHaveBeenCalledWith("/app/open-next.config.ts", { compileEdge: true });
		expect(result).toEqual({ config: { default: {} }, buildDir: "/build" });
	});

	it("should create config when no configPath found and user confirms", async () => {
		vi.mocked(findOpenNextConfig).mockReturnValue(undefined);
		vi.mocked(askConfirmation).mockResolvedValue(true);

		const result = await compileConfig(undefined);

		expect(askConfirmation).toHaveBeenCalledOnce();
		expect(vi.mocked(askConfirmation).mock.calls[0]).toMatchInlineSnapshot(`
			[
			  "Missing required \`open-next.config.ts\` file, do you want to create one?",
			]
		`);
		expect(createOpenNextConfigFile).toHaveBeenCalledOnce();
		expect(mockCompileOpenNextConfig).toHaveBeenCalledWith("/test/open-next.config.ts", {
			compileEdge: true,
		});
		expect(result).toEqual({ config: { default: {} }, buildDir: "/build" });
	});

	it("should throw when no configPath found and user declines", async () => {
		vi.mocked(findOpenNextConfig).mockReturnValue(undefined);
		vi.mocked(askConfirmation).mockResolvedValue(false);

		await expect(compileConfig(undefined)).rejects.toThrowErrorMatchingInlineSnapshot(
			`[Error: The \`open-next.config.ts\` file is required, aborting!]`
		);

		expect(askConfirmation).toHaveBeenCalledOnce();
		expect(createOpenNextConfigFile).not.toHaveBeenCalled();
	});

	it("should throw a helpful error (without prompting) when no configPath found in a non-interactive environment", async () => {
		vi.mocked(findOpenNextConfig).mockReturnValue(undefined);
		vi.mocked(isNonInteractiveOrCI).mockReturnValue(true);

		await expect(compileConfig(undefined)).rejects.toThrowError(
			/No `open-next\.config\.ts` file was found.*opennextjs-cloudflare migrate/s
		);

		expect(askConfirmation).not.toHaveBeenCalled();
		expect(createOpenNextConfigFile).not.toHaveBeenCalled();
	});

	it("should still prompt in interactive environments", async () => {
		vi.mocked(findOpenNextConfig).mockReturnValue(undefined);
		vi.mocked(isNonInteractiveOrCI).mockReturnValue(false);
		vi.mocked(askConfirmation).mockResolvedValue(true);

		await compileConfig(undefined);

		expect(askConfirmation).toHaveBeenCalledOnce();
		expect(createOpenNextConfigFile).toHaveBeenCalledOnce();
	});
});

describe("retrieveCompiledConfig", () => {
	// The compiled config only lives under `<cwd>/.open-next/.build/` when `buildOutputPath` is
	// left at its default, so these tests drive the two lookups independently.
	function mockPaths({ compiledConfig, worker }: { compiledConfig: boolean; worker: boolean }) {
		mockExistsSync.mockImplementation((p: string) => {
			if (String(p).includes(".open-next/.build/")) return compiledConfig;
			if (String(p).endsWith("worker.js")) return worker;
			// The source config, checked by `compileConfig`.
			return true;
		});
	}

	let exitSpy: MockInstance<typeof process.exit>;

	beforeEach(() => {
		exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});
	});

	it("should recompile from source when a custom buildOutputPath moved the compiled config", async () => {
		mockPaths({ compiledConfig: false, worker: true });
		vi.mocked(findOpenNextConfig).mockReturnValue("/app/open-next.config.ts");

		const result = await retrieveCompiledConfig();

		expect(mockCompileOpenNextConfig).toHaveBeenCalledWith("/app/open-next.config.ts", {
			compileEdge: true,
		});
		expect(result.config).toEqual({ default: {} });
	});

	it("should report a missing build when there is no source config either", async () => {
		mockPaths({ compiledConfig: false, worker: false });
		vi.mocked(findOpenNextConfig).mockReturnValue(undefined);

		await expect(retrieveCompiledConfig()).rejects.toThrowError("process.exit");

		expect(logger.error).toHaveBeenCalledWith(
			"Could not find compiled Open Next config, did you run the build command?"
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("should report a missing build when the source config exists but the app was never built", async () => {
		mockPaths({ compiledConfig: false, worker: false });
		vi.mocked(findOpenNextConfig).mockReturnValue("/app/open-next.config.ts");

		await expect(retrieveCompiledConfig()).rejects.toThrowError("process.exit");

		expect(logger.error).toHaveBeenCalledWith(
			"Could not find compiled Open Next config, did you run the build command?"
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("should never create a config file — these commands must not write to the project", async () => {
		mockPaths({ compiledConfig: false, worker: false });
		vi.mocked(findOpenNextConfig).mockReturnValue(undefined);

		await expect(retrieveCompiledConfig()).rejects.toThrowError("process.exit");

		expect(askConfirmation).not.toHaveBeenCalled();
		expect(createOpenNextConfigFile).not.toHaveBeenCalled();
	});
});
