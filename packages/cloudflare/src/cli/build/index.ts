import { containsDotNextDir, getConfig } from "../config";
import type { ProjectOptions } from "../config";
import { buildNextjsApp } from "./build-next-app";
import { buildWorker } from "./build-worker";
import { cpSync } from "node:fs";
import { join } from "node:path";
import { rm } from "node:fs/promises";

/**
 * Builds the application in a format that can be passed to workerd
 *
 * It saves the output in a `.worker-next` directory
 *
 * @param opts The options for the project
 */
export async function build(opts: ProjectOptions): Promise<void> {
  if (!opts.skipBuild) {
    // Build the next app
    await buildNextjsApp(opts.sourceDir);
  }

  if (!containsDotNextDir(opts.sourceDir)) {
    throw new Error(`.next folder not found in ${opts.sourceDir}`);
  }

  // Clean the output directory
  await cleanDirectory(opts.outputDir);

  // Copy the .next directory to the output directory so it can be mutated.
  cpSync(join(opts.sourceDir, ".next"), join(opts.outputDir, ".next"), { recursive: true });

  const config = getConfig(opts);

  await buildWorker(config);
}

async function cleanDirectory(path: string): Promise<void> {
  return await rm(path, { recursive: true, force: true });
}
