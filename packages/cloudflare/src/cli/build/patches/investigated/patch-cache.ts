import path from "node:path";
import { Config } from "../../../cli/config";

/**
 * Install the cloudflare KV cache handler
 */
export function patchCache(code: string, config: Config): string {
  console.log("# patchCached");

  const cacheHandler = path.join(config.paths.internalPackage, "cache-handler.mjs");

  const patchedCode = code.replace(
    "const { cacheHandler } = this.nextConfig;",
    `const cacheHandler = null;
CacheHandler = (await import('${cacheHandler}')).default;
CacheHandler.maybeKVNamespace = process.env["${config.cache.kvBindingName}"];
`
  );

  if (patchedCode === code) {
    throw new Error("Cache patch not applied");
  }

  return patchedCode;
}
