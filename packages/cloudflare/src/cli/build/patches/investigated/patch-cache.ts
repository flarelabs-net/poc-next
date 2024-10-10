import { Config } from "../../../config";
import { build } from "esbuild";
import { join } from "node:path";

/**
 * Install the cloudflare KV cache handler
 */
export async function patchCache(code: string, config: Config): Promise<string> {
  console.log("# patchCache");

  const cacheHandlerFileName = "cache-handler.mjs";
  const cacheHandlerEntrypoint = join(config.paths.internalTemplates, "cache-handler", "index.ts");
  const cacheHandlerOutputFile = join(config.paths.outputDir, cacheHandlerFileName);

  await build({
    entryPoints: [cacheHandlerEntrypoint],
    bundle: true,
    outfile: cacheHandlerOutputFile,
    format: "esm",
    target: "esnext",
    minify: config.build.shouldMinify,
    define: {
      "process.env.__OPENNEXT_KV_BINDING_NAME": `"${config.cache.kvBindingName}"`,
    },
  });

  const patchedCode = code.replace(
    "const { cacheHandler } = this.nextConfig;",
    `const cacheHandler = null;
CacheHandler = (await import('./${cacheHandlerFileName}')).OpenNextCacheHandler;
`
  );

  if (patchedCode === code) {
    throw new Error("Patch `patchCache` not applied");
  }

  return patchedCode;
}
