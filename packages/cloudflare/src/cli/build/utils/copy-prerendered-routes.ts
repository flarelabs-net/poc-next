import { NEXT_META_SUFFIX, SEED_DATA_DIR } from "../../constants/incremental-cache";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Config } from "../../config";
import type { PrerenderManifest } from "next/dist/build";
import { readPathsRecursively } from "./read-paths-recursively";

/**
 * Copies all prerendered routes from the standalone output directory to the OpenNext static assets
 * output directory.
 *
 * Updates metadata configs with the current time as a modified date, so that it can be re-used in
 * the incremental cache to determine whether an entry is _fresh_ or not.
 *
 * @param config Build config.
 */
export function copyPrerenderedRoutes(config: Config) {
  console.log("# copyPrerenderedRoutes");

  const serverAppDirPath = join(config.paths.standaloneAppServer, "app");
  const prerenderManifestPath = join(config.paths.standaloneAppDotNext, "prerender-manifest.json");
  const outputPath = join(config.paths.outputDir, "assets", SEED_DATA_DIR);

  const prerenderManifest: PrerenderManifest = existsSync(prerenderManifestPath)
    ? JSON.parse(readFileSync(prerenderManifestPath, "utf8"))
    : {};
  const prerenderedRoutes = Object.keys(prerenderManifest.routes);

  const prerenderedAssets = readPathsRecursively(serverAppDirPath)
    .map((fullPath) => ({ fullPath, relativePath: fullPath.replace(serverAppDirPath, "") }))
    .filter(({ relativePath }) =>
      prerenderedRoutes.includes(relativePath.replace(/\.\w+$/, "").replace(/^\/index$/, "/"))
    );

  prerenderedAssets.forEach(({ fullPath, relativePath }) => {
    const destPath = join(outputPath, relativePath);
    mkdirSync(dirname(destPath), { recursive: true });

    if (fullPath.endsWith(NEXT_META_SUFFIX)) {
      const data = JSON.parse(readFileSync(fullPath, "utf8"));
      writeFileSync(destPath, JSON.stringify({ ...data, lastModified: config.build.timestamp }));
    } else {
      copyFileSync(fullPath, destPath);
    }
  });
}
