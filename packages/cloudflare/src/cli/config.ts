import path, { relative } from "node:path";
import { readdirSync, statSync } from "node:fs";

const PACKAGE_NAME = "@opennextjs/cloudflare";

export type Config = {
  build: {
    // Timestamp for when the build was started
    timestamp: number;
    // Whether to skip building the Next.js app or not
    shouldSkip: boolean;
  };

  paths: {
    // Path to the next application
    sourceDir: string;
    // Path to the output folder
    outputDir: string;
    // Path to the app's `.next` directory (where `next build` saves the build output)
    dotNext: string;
    // Path to the application standalone root directory
    standaloneRoot: string;
    // Path to the application standalone directory (where `next build` saves the standalone app)
    standaloneApp: string;
    // Path to the `.next` directory specific to the standalone application
    standaloneAppDotNext: string;
    // Path to the `server` directory specific to the standalone application
    standaloneAppServer: string;
    // Package in the standalone node_modules
    internalPackage: string;
    // Templates in the package in the standalone node_modules
    internalTemplates: string;
  };

  cache: {
    kvBindingName: string;
  };

  // Internal name for the copy of the package
  internalPackageName: string;
};

/**
 * Computes the configuration.
 *
 * @param opts.sourceDir Next app root folder
 * @param opts.outputDir The directory where to save the output (defaults to the app's directory)
 * @param opts.skipBuild Whether the Next.js build should be skipped (i.e. if the `.next` dir is already built)
 *
 * @returns The configuration, see `Config`
 */
export function getConfig(opts: ProjectOptions): Config {
  const dotNext = path.join(opts.outputDir, ".next");
  const appPath = getNextjsApplicationPath(dotNext).replace(/\/$/, "");
  const standaloneRoot = path.join(dotNext, "standalone");
  const standaloneApp = path.join(standaloneRoot, appPath);
  const standaloneAppDotNext = path.join(standaloneApp, ".next");
  const standaloneAppServer = path.join(standaloneAppDotNext, "server");

  const nodeModules = path.join(standaloneApp, "node_modules");
  const internalPackage = path.join(nodeModules, ...PACKAGE_NAME.split("/"));
  const internalTemplates = path.join(internalPackage, "cli", "templates");

  process.env.__OPENNEXT_KV_BINDING_NAME ??= "NEXT_CACHE_WORKERS_KV";

  return {
    build: {
      timestamp: Date.now(),
      shouldSkip: !!opts.skipBuild,
    },

    paths: {
      sourceDir: opts.sourceDir,
      outputDir: opts.outputDir,
      dotNext,
      standaloneRoot,
      standaloneApp,
      standaloneAppDotNext,
      standaloneAppServer,
      internalPackage,
      internalTemplates,
    },

    cache: {
      kvBindingName: process.env.__OPENNEXT_KV_BINDING_NAME,
    },

    internalPackageName: PACKAGE_NAME,
  };
}

export function containsDotNextDir(folder: string): boolean {
  try {
    return statSync(path.join(folder, ".next")).isDirectory();
  } catch {
    return false;
  }
}

export type ProjectOptions = {
  sourceDir: string;
  outputDir: string;
  skipBuild?: boolean;
};

/**
 * It basically tries to find the path that the application is under inside the `.next/standalone` directory, using the `.next/server` directory
 * presence as the condition that needs to be met.
 *
 * For example:
 *  When I build the api application the `.next/server` directory is located in:
 *  `<dotNextDir>/standalone/next-apps/api/.next/server`
 *  and the function here given the `dotNextDir` returns `next-apps/api`
 */
function getNextjsApplicationPath(dotNextDir: string): string {
  const serverPath = findServerParentPath(dotNextDir);

  if (!serverPath) {
    throw new Error(`Unexpected Error: no \`.next/server\` folder could be found in \`${serverPath}\``);
  }

  return relative(path.join(dotNextDir, "standalone"), serverPath);
}

function findServerParentPath(parentPath: string): string | undefined {
  try {
    if (statSync(path.join(parentPath, ".next", "server")).isDirectory()) {
      return parentPath;
    }
  } catch {
    /* empty */
  }

  const folders = readdirSync(parentPath);

  for (const folder of folders) {
    const subFolder = path.join(parentPath, folder);
    if (statSync(path.join(parentPath, folder)).isDirectory()) {
      const dirServerPath = findServerParentPath(subFolder);
      if (dirServerPath) {
        return dirServerPath;
      }
    }
  }
}
