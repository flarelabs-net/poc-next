#!/usr/bin/env node
import { build } from "./build";
import { existsSync } from "node:fs";
import { getArgs } from "./args";
import { resolve } from "node:path";

const nextAppDir = resolve(".");

console.log(`Building the Next.js app in the current folder (${nextAppDir})`);

if (!["js", "cjs", "mjs", "ts"].some((ext) => existsSync(`./next.config.${ext}`))) {
  // TODO: we can add more validation later
  console.error(
    "Error: next.config file not found. Please make sure you run the command inside a Next.js app"
  );
  process.exit(1);
}

const { skipBuild, outputDir } = getArgs();

await build({
  sourceDir: nextAppDir,
  outputDir: resolve(outputDir ?? nextAppDir, ".worker-next"),
  skipBuild,
});
