import fs from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type BuildOptions, getPackagePath } from "@opennextjs/aws/build/helper.js";
import * as buildHelper from "@opennextjs/aws/build/helper.js";
import { ContentUpdater } from "@opennextjs/aws/plugins/content-updater.js";
import { build, type Plugin } from "esbuild";

import { getOpenNextConfig } from "../../api/config.js";
import type { ProjectOptions } from "../project-options.js";
import { normalizePath } from "../utils/normalize-path.js";
import { patchVercelOgLibrary } from "./patches/ast/patch-vercel-og-library.js";
import { patchWebpackRuntime } from "./patches/ast/webpack-runtime.js";
import { inlineDynamicRequires } from "./patches/plugins/dynamic-requires.js";
import { inlineFindDir } from "./patches/plugins/find-dir.js";
import { patchInstrumentation } from "./patches/plugins/instrumentation.js";
import { inlineLoadManifest } from "./patches/plugins/load-manifest.js";
import { patchNextServer } from "./patches/plugins/next-server.js";
import { patchResolveCache, patchSetWorkingDirectory } from "./patches/plugins/open-next.js";
import { handleOptionalDependencies } from "./patches/plugins/optional-deps.js";
import { patchPagesRouterContext } from "./patches/plugins/pages-router-context.js";
import { patchDepdDeprecations } from "./patches/plugins/patch-depd-deprecations.js";
import { fixRequire } from "./patches/plugins/require.js";
import { shimRequireHook } from "./patches/plugins/require-hook.js";
import { patchRouteModules } from "./patches/plugins/route-module.js";
import { shimReact } from "./patches/plugins/shim-react.js";
import { setWranglerExternal } from "./patches/plugins/wrangler-external.js";
import { copyPackageCliFiles } from "./utils/copy-package-cli-files.js";
import { needsExperimentalReact } from "./utils/needs-experimental-react.js";

/** The dist directory of the Cloudflare adapter package */
const packageDistDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * List of optional Next.js dependencies.
 * They are not required for Next.js to run but only needed to enabled specific features.
 * When one of those dependency is required, it should be installed by the application.
 */
const optionalDependencies = [
	"caniuse-lite",
	"critters",
	"jimp",
	"probe-image-size",
	// `server.edge` is not available in react-dom@18
	"react-dom/server.edge",
];

/**
 * Bundle the Open Next server.
 */
export async function bundleServer(buildOpts: BuildOptions, projectOpts: ProjectOptions): Promise<void> {
	copyPackageCliFiles(packageDistDir, buildOpts);

	const { appPath, outputDir, monorepoRoot, debug } = buildOpts;
	const dotNextPath = path.join(outputDir, "server-functions/default", getPackagePath(buildOpts), ".next");
	const serverFiles = path.join(dotNextPath, "required-server-files.json");
	const nextConfig = JSON.parse(fs.readFileSync(serverFiles, "utf-8")).config;

	const useTurbopack = buildHelper.getBundlerRuntime(buildOpts) === "turbopack";

	console.log(`\x1b[35m⚙️ Bundling the OpenNext server...\n\x1b[0m`);

	await patchWebpackRuntime(path.join(dotNextPath, "server"));
	const useOg = patchVercelOgLibrary(buildOpts);

	const outputPath = path.join(outputDir, "server-functions", "default");
	const packagePath = getPackagePath(buildOpts);
	const openNextServer = path.join(outputPath, packagePath, `index.mjs`);
	const openNextServerBundle = path.join(outputPath, packagePath, `handler.mjs`);

	const updater = new ContentUpdater(buildOpts);

	const result = await build({
		entryPoints: [openNextServer],
		bundle: true,
		outfile: openNextServerBundle,
		format: "esm",
		target: "esnext",
		// Minify code as much as possible but stay safe by not renaming identifiers
		minifyWhitespace: projectOpts.minify && !debug,
		minifyIdentifiers: false,
		minifySyntax: projectOpts.minify && !debug,
		legalComments: "none",
		metafile: true,
		sourcemap: getOpenNextConfig(buildOpts).cloudflare?.sourcemap,
		// Next traces files using the default conditions from `nft` (`node`, `require`, `import` and `default`)
		//
		// Because we use the `node` platform for this build, the "module" condition is used when no conditions are defined.
		// The conditions are always set (should it be to an empty array) to disable the "module" condition.
		//
		// See:
		// - default nft conditions: https://github.com/vercel/nft/blob/2b55b01/readme.md#exports--imports
		// - Next no explicit override: https://github.com/vercel/next.js/blob/2efcf11/packages/next/src/build/collect-build-traces.ts#L287
		// - ESBuild `node` platform: https://esbuild.github.io/api/#platform
		conditions: getOpenNextConfig(buildOpts).cloudflare?.useWorkerdCondition === false ? [] : ["workerd"],
		plugins: [
			shimRequireHook(buildOpts),
			shimReact(buildOpts),
			inlineDynamicRequires(updater, buildOpts),
			setWranglerExternal(),
			fixRequire(updater),
			handleOptionalDependencies(optionalDependencies),
			patchInstrumentation(updater, buildOpts),
			patchPagesRouterContext(buildOpts),
			inlineFindDir(updater, buildOpts),
			inlineLoadManifest(updater, buildOpts),
			patchNextServer(updater, buildOpts),
			patchRouteModules(updater, buildOpts),
			patchDepdDeprecations(updater),
			patchResolveCache(updater, buildOpts),
			patchSetWorkingDirectory(updater, buildOpts),
			// Apply updater updates, must be the last plugin
			updater.plugin,
		] as Plugin[],
		external: ["./middleware/handler.mjs"],
		alias: {
			// When @vercel/og is not used, alias the edge entry to a throwing shim so the
			// dynamic `import("next/dist/compiled/@vercel/og/index.edge.js")` call site
			// emitted by Next.js does not drag the library (~800 KiB) and its
			// `resvg.wasm` (~1.4 MiB) into the Worker bundle.
			...(useOg
				? {}
				: {
						"next/dist/compiled/@vercel/og/index.edge.js": path.join(
							buildOpts.outputDir,
							"cloudflare-templates/shims/throw.js"
						),
					}),
			// Workers have `fetch` so the `node-fetch` polyfill is not needed
			"next/dist/compiled/node-fetch": path.join(buildOpts.outputDir, "cloudflare-templates/shims/fetch.js"),
			// Workers have builtin Web Sockets
			"next/dist/compiled/ws": path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty.js"),
			// The toolbox optimizer pulls severals MB of dependencies (`caniuse-lite`, `terser`, `acorn`, ...)
			// Drop it to optimize the code size
			// See https://github.com/vercel/next.js/blob/6eb235c/packages/next/src/server/optimize-amp.ts
			"next/dist/compiled/@ampproject/toolbox-optimizer": path.join(
				buildOpts.outputDir,
				"cloudflare-templates/shims/throw.js"
			),
			// The edge runtime is not supported
			"next/dist/compiled/edge-runtime": path.join(
				buildOpts.outputDir,
				"cloudflare-templates/shims/empty.js"
			),
			// `@next/env` is used by Next to load environment variables from files.
			// OpenNext inlines the values at build time so this is not needed.
			"@next/env": path.join(buildOpts.outputDir, "cloudflare-templates/shims/env.js"),
		},
		define: {
			// config file used by Next.js, see: https://github.com/vercel/next.js/blob/68a7128/packages/next/src/build/utils.ts#L2137-L2139
			"process.env.__NEXT_PRIVATE_STANDALONE_CONFIG": JSON.stringify(JSON.stringify(nextConfig)),
			// Next.js tried to access __dirname so we need to define it
			__dirname: '""',
			// Note: we need the __non_webpack_require__ variable declared as it is used by next-server:
			// https://github.com/vercel/next.js/blob/be0c3283/packages/next/src/server/next-server.ts#L116-L119
			__non_webpack_require__: "require",
			// The 2 following defines are used to reduce the bundle size by removing unnecessary code
			// Next uses different precompiled renderers (i.e. `app-page.runtime.prod.js`) based on if you use `TURBOPACK` or some experimental React features
			...(useTurbopack ? {} : { "process.env.TURBOPACK": "false" }),
			// We make sure that environment variables that Next.js expects are properly defined
			"process.env.NEXT_RUNTIME": '"nodejs"',
			"process.env.NODE_ENV": '"production"',
			// This define should be safe to use for Next 14.2+, earlier versions (13.5 and less) will cause trouble
			"process.env.__NEXT_EXPERIMENTAL_REACT": `${needsExperimentalReact(nextConfig)}`,
			// Fix `res.validate` in Next 15.4 (together with the `route-module` patch)
			"process.env.__NEXT_TRUST_HOST_HEADER": "true",
		},
		banner: {
			// We need to import them here, assigning them to `globalThis` does not work because node:timers use `globalThis` and thus create an infinite loop
			// See https://github.com/cloudflare/workerd/blob/d6a764c/src/node/internal/internal_timers.ts#L56-L70
			js: `import {setInterval, clearInterval, setTimeout, clearTimeout} from "node:timers"`,
		},
		platform: "node",
	});

	fs.writeFileSync(openNextServerBundle + ".meta.json", JSON.stringify(result.metafile, null, 2));

	await updateWorkerBundledCode(openNextServerBundle);

	const isMonorepo = monorepoRoot !== appPath;
	if (isMonorepo) {
		fs.writeFileSync(
			path.join(outputPath, "handler.mjs"),
			`export { handler } from "./${normalizePath(packagePath)}/handler.mjs";`
		);
	}

	console.log(
		`\x1b[35mWorker saved in \`${path.relative(buildOpts.appPath, getOutputWorkerPath(buildOpts))}\` 🚀\n\x1b[0m`
	);
}

/**
 * This function apply updates to the bundled code.
 */
export async function updateWorkerBundledCode(workerOutputFile: string): Promise<void> {
	const code = await readFile(workerOutputFile, "utf8");
	const patchedCode = code.replace(/__require\d?\(/g, "require(").replace(/__require\d?\./g, "require.");
	await writeFile(workerOutputFile, patchedCode);
}

/**
 * Gets the path of the worker.js file generated by the build process
 *
 * @param buildOpts the open-next build options
 * @returns the path of the worker.js file that the build process generates
 */
export function getOutputWorkerPath(buildOpts: BuildOptions): string {
	return path.join(buildOpts.outputDir, "worker.js");
}
