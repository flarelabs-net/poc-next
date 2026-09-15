import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Regression test for https://github.com/opennextjs/opennextjs-cloudflare/issues/1339
 *
 * `esbuild` is imported at build time (see src/cli/build/bundle-server.ts and
 * src/cli/build/open-next/*.ts) but used to be declared only in devDependencies,
 * so consumers only got it by npm hoisting accident. It must be a real runtime
 * `dependency` of the published package.
 */
const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../package.json");

describe("build-time dependencies", () => {
	it("declares esbuild as a runtime dependency", () => {
		const { dependencies } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
			dependencies?: Record<string, string>;
		};

		expect(dependencies).toBeDefined();
		expect(dependencies?.["esbuild"]).toBeDefined();
	});
});
