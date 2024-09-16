import { resolve } from "node:path";
import { getArgs } from "./args";
import { existsSync } from "node:fs";
import { build } from "./build";

const inputNextAppDir = resolve(".");

console.log({ inputNextAppDir });

if (!["js", "cjs", "mjs", "ts"].some((ext) => existsSync(`./next.config.${ext}`))) {
  // TODO: we can add more validation later
  throw new Error("Error: Not in a Next.js app project");
}

const { skipBuild, outputDir } = getArgs();

await build(inputNextAppDir, {
  outputDir,
  skipBuild: !!skipBuild,
});
