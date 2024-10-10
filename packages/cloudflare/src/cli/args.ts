import { type Stats, mkdirSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve } from "node:path";

export function getArgs(): {
  skipBuild: boolean;
  outputDir?: string;
  disableMinification?: boolean;
} {
  const {
    values: { skipBuild, output, disableMinification },
  } = parseArgs({
    options: {
      skipBuild: {
        type: "boolean",
        short: "s",
        default: false,
      },
      output: {
        type: "string",
        short: "o",
      },
      disableMinification: {
        type: "boolean",
      },
    },
    allowPositionals: false,
  });

  const outputDir = output ? resolve(output) : undefined;

  if (outputDir) {
    assertDirArg(outputDir, "output", true);
  }

  return {
    outputDir,
    skipBuild: skipBuild || ["1", "true", "yes"].includes(String(process.env.SKIP_NEXT_APP_BUILD)),
    disableMinification,
  };
}

function assertDirArg(path: string, argName?: string, make?: boolean) {
  let dirStats: Stats;
  try {
    dirStats = statSync(path);
  } catch {
    if (!make) {
      throw new Error(`Error: the provided${argName ? ` "${argName}"` : ""} input is not a valid path`);
    }
    mkdirSync(path);
    return;
  }

  if (!dirStats.isDirectory()) {
    throw new Error(`Error: the provided${argName ? ` "${argName}"` : ""} input is not a directory`);
  }
}
