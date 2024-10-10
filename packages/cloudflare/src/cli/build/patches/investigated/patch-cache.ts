import { Config } from "../../../config";
import { build } from "esbuild";
import { join } from "node:path";

/**
 * Sets up the OpenNext cache handler in a Next.js build.
 *
 * The cache handler used by Next.js is normally defined in the config file as a path. At runtime,
 * Next.js would then do a dynamic require on a transformed version of the path to retrieve the
 * cache handler and create a new instance of it.
 *
 * This is problematic in workerd due to the dynamic import of the file that is not known from
 * build-time. Therefore, we have to manually override the default way that the cache handler is
 * instantiated with a dynamic require that uses a string literal for the path.
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
    minify: true,
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
