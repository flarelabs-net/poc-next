import { Plugin, build } from "esbuild";
import { cp, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { Config } from "../config";
import { copyPackageCliFiles } from "./patches/investigated/copy-package-cli-files";
import { copyPrerenderedRoutes } from "./utils";
import { fileURLToPath } from "node:url";
import { inlineEvalManifest } from "./patches/to-investigate/inline-eval-manifest";
import { inlineMiddlewareManifestRequire } from "./patches/to-investigate/inline-middleware-manifest-require";
import { inlineNextRequire } from "./patches/to-investigate/inline-next-require";
import { patchCache } from "./patches/investigated/patch-cache";
import { patchExceptionBubbling } from "./patches/to-investigate/patch-exception-bubbling";
import { patchFindDir } from "./patches/to-investigate/patch-find-dir";
import { patchReadFile } from "./patches/to-investigate/patch-read-file";
import { patchRequire } from "./patches/investigated/patch-require";
import { patchWranglerDeps } from "./patches/to-investigate/wrangler-deps";
import path from "node:path";
import { updateWebpackChunksFile } from "./patches/investigated/update-webpack-chunks-file";

/** The dist directory of the Cloudflare adapter package */
const packageDistDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Using the Next.js build output in the `.next` directory builds a workerd compatible output
 *
 * @param outputDir the directory where to save the output
 * @param config
 */
export async function buildWorker(config: Config): Promise<void> {
  console.log(`\x1b[35m⚙️ Copying files...\n\x1b[0m`);

  // Copy over client-side generated files
  await cp(
    path.join(config.paths.dotNext, "static"),
    path.join(config.paths.outputDir, "assets", "_next", "static"),
    {
      recursive: true,
    }
  );

  // Copy over any static files (e.g. images) from the source project
  const publicDir = path.join(config.paths.sourceDir, "public");
  if (existsSync(publicDir)) {
    await cp(publicDir, path.join(config.paths.outputDir, "assets"), {
      recursive: true,
    });
  }

  // Copy over prerendered assets (e.g. SSG routes)
  copyPrerenderedRoutes(config);

  copyPackageCliFiles(packageDistDir, config);

  const workerEntrypoint = path.join(config.paths.internalTemplates, "worker.ts");
  const workerOutputFile = path.join(config.paths.outputDir, "index.mjs");

  const nextConfigStr =
    readFileSync(path.join(config.paths.standaloneApp, "/server.js"), "utf8")?.match(
      /const nextConfig = ({.+?})\n/
    )?.[1] ?? {};

  console.log(`\x1b[35m⚙️ Bundling the worker file...\n\x1b[0m`);

  patchWranglerDeps(config);
  updateWebpackChunksFile(config);

  await build({
    entryPoints: [workerEntrypoint],
    bundle: true,
    outfile: workerOutputFile,
    format: "esm",
    target: "esnext",
    minify: false,
    plugins: [createFixRequiresESBuildPlugin(config)],
    alias: {
      // Note: we apply an empty shim to next/dist/compiled/ws because it generates two `eval`s:
      //   eval("require")("bufferutil");
      //   eval("require")("utf-8-validate");
      "next/dist/compiled/ws": path.join(config.paths.internalTemplates, "shims", "empty.ts"),
      // Note: we apply an empty shim to next/dist/compiled/edge-runtime since (amongst others) it generated the following `eval`:
      //   eval(getModuleCode)(module, module.exports, throwingRequire, params.context, ...Object.values(params.scopedContext));
      //   which comes from https://github.com/vercel/edge-runtime/blob/6e96b55f/packages/primitives/src/primitives/load.js#L57-L63
      // QUESTION: Why did I encountered this but mhart didn't?
      "next/dist/compiled/edge-runtime": path.join(config.paths.internalTemplates, "shims", "empty.ts"),
      // `@next/env` is a library Next.js uses for loading dotenv files, for obvious reasons we need to stub it here
      // source: https://github.com/vercel/next.js/tree/0ac10d79720/packages/next-env
      "@next/env": path.join(config.paths.internalTemplates, "shims", "env.ts"),
    },
    define: {
      // config file used by Next.js, see: https://github.com/vercel/next.js/blob/68a7128/packages/next/src/build/utils.ts#L2137-L2139
      "process.env.__NEXT_PRIVATE_STANDALONE_CONFIG": JSON.stringify(nextConfigStr),
      // Next.js tried to access __dirname so we need to define it
      __dirname: '""',
      // Note: we need the __non_webpack_require__ variable declared as it is used by next-server:
      // https://github.com/vercel/next.js/blob/be0c3283/packages/next/src/server/next-server.ts#L116-L119
      __non_webpack_require__: "require",
      // Ask mhart if he can explain why the `define`s below are necessary
      "process.env.NEXT_RUNTIME": '"nodejs"',
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_MINIMAL": "true",
    },
    // We need to set platform to node so that esbuild doesn't complain about the node imports
    platform: "node",
    banner: {
      js: `
				${
          /*
					`__dirname` is used by unbundled js files (which don't inherit the `__dirname` present in the `define` field)
					so we also need to set it on the global scope
					Note: this was hit in the `next/dist/compiled/@opentelemetry/api` module
				*/ ""
        }
				globalThis.__dirname ??= "";

// Do not crash on cache not supported
// https://github.com/cloudflare/workerd/pull/2434
// compatibility flag "cache_option_enabled" -> does not support "force-cache"
const curFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  if (init) {
    delete init.cache;
  }
  return curFetch(input, init);
};
import { Readable } from 'node:stream';
fetch = globalThis.fetch;
const CustomRequest = class extends globalThis.Request {
  constructor(input, init) {
    if (init) {
      delete init.cache;
      if (init.body?.__node_stream__ === true) {
        // https://github.com/cloudflare/workerd/issues/2746
        init.body = Readable.toWeb(init.body);
      }
    }
    super(input, init);
  }
};
globalThis.Request = CustomRequest;
Request = globalThis.Request;
`,
    },
  });

  await updateWorkerBundledCode(workerOutputFile, config);

  console.log(`\x1b[35mWorker saved in \`${workerOutputFile}\` 🚀\n\x1b[0m`);
}

/**
 * This function applies string replacements on the bundled worker code necessary to get it to run in workerd
 *
 * Needless to say all the logic in this function is something we should avoid as much as possible!
 *
 * @param workerOutputFile
 * @param config
 */
async function updateWorkerBundledCode(workerOutputFile: string, config: Config): Promise<void> {
  const originalCode = await readFile(workerOutputFile, "utf8");

  let patchedCode = originalCode;

  patchedCode = patchRequire(patchedCode);
  patchedCode = patchReadFile(patchedCode, config);
  patchedCode = inlineNextRequire(patchedCode, config);
  patchedCode = patchFindDir(patchedCode, config);
  patchedCode = inlineEvalManifest(patchedCode, config);
  patchedCode = await patchCache(patchedCode, config);
  patchedCode = inlineMiddlewareManifestRequire(patchedCode, config);
  patchedCode = patchExceptionBubbling(patchedCode);

  await writeFile(workerOutputFile, patchedCode);
}

function createFixRequiresESBuildPlugin(config: Config): Plugin {
  return {
    name: "replaceRelative",
    setup(build) {
      // Note: we (empty) shim require-hook modules as they generate problematic code that uses requires
      build.onResolve({ filter: /^\.\/require-hook$/ }, () => ({
        path: path.join(config.paths.internalTemplates, "shims", "empty.ts"),
      }));
      build.onResolve({ filter: /\.\/lib\/node-fs-methods$/ }, () => ({
        path: path.join(config.paths.internalTemplates, "shims", "empty.ts"),
      }));
    },
  };
}
