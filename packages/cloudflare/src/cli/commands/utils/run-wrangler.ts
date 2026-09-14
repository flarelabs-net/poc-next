import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { compareSemver } from "@opennextjs/aws/build/helper.js";

import { quoteShellMeta } from "./helpers.js";

export type PackagerDetails = {
	/** The name of the package manager. */
	packager: "npm" | "pnpm" | "yarn" | "bun";
	/** The root directory of the monorepo, used to locate package.json. */
	monorepoRoot: string;
};

export type WranglerTarget = "local" | "remote";

export type WranglerCommandResult = {
	success: boolean;
	stdout: string;
	stderr: string;
};

type WranglerOptions = {
	target?: WranglerTarget;
	environment?: string;
	configPath?: string;
	logging?: "all" | "error" | "none";
	env?: Record<string, string>;
};

/**
 * Checks the package.json `packageManager` field to determine whether yarn modern is used.
 *
 * @param options Build options.
 * @returns Whether yarn modern is used.
 */
function isYarnModern(monorepoRoot: string) {
	const packageJson: { packageManager?: string } = JSON.parse(
		readFileSync(path.join(monorepoRoot, "package.json"), "utf-8")
	);

	if (!packageJson.packageManager?.startsWith("yarn")) return false;

	const [, version] = packageJson.packageManager.split("@");
	return version ? compareSemver(version, ">=", "4.0.0") : false;
}

/**
 * Prepends CLI flags with `--` so that certain package managers can pass args through to wrangler
 * properly.
 *
 * npm and yarn classic require `--` to be used, while pnpm and bun require that it is not used.
 *
 * @param options Build options.
 * @param args CLI args.
 * @returns Arguments with a passthrough flag injected when needed.
 */
function injectPassthroughFlagForArgs(options: PackagerDetails, args: string[]) {
	if (options.packager !== "npm" && (options.packager !== "yarn" || isYarnModern(options.monorepoRoot))) {
		return args;
	}

	const flagInArgsIndex = args.findIndex((v) => v.startsWith("--"));
	if (flagInArgsIndex !== -1) {
		args.splice(flagInArgsIndex, 0, "--");
	}

	return args;
}

/**
 * Runs a wrangler command using the project's package manager.
 *
 * Spawns a synchronous child process, appending the provided arguments and any flags derived
 * from the wrangler options.
 *
 * The `.env` file loading by wrangler is disabled to let the adapter handle environment variables.
 *
 * @param options The package manager details used to invoke wrangler.
 * @param args The CLI arguments to pass to wrangler
 * @param wranglerOpts Optional configuration for the wrangler invocation.
 * @param wranglerOpts.target Whether to run wrangler in `"local"` or `"remote"` mode
 * @param wranglerOpts.environment The wrangler environment name
 * @param wranglerOpts.configPath Path to a wrangler configuration file
 * @param wranglerOpts.logging Controls stdio behavior:
 *   - `"all"` inherits stdin/stdout for interactive use,
 *   - `"error"` pipes all output and only displays it on failure,
 *   - `"none"` suppresses all output.
 *   When not specified, behaves the same as `"all"`.
 * @param wranglerOpts.env Additional environment variables to pass to the spawned process.
 * @returns The command result
 */
export function runWrangler(
	options: PackagerDetails,
	args: string[],
	wranglerOpts: WranglerOptions = {}
): WranglerCommandResult {
	const noLogs = wranglerOpts.logging === "none";
	const shouldPipeLogs = wranglerOpts.logging === "error";
	const isWin = process.platform === "win32";

	const packagerArgs = [
		options.packager === "bun" ? "x" : "exec",
		"wrangler",
		...injectPassthroughFlagForArgs(options, [
			...args,
			...(wranglerOpts.environment ? ["--env", wranglerOpts.environment] : []),
			...(wranglerOpts.configPath ? ["--config", wranglerOpts.configPath] : []),
			...(wranglerOpts.target === "remote" ? ["--remote"] : []),
			...(wranglerOpts.target === "local" ? ["--local"] : []),
		]),
	];

	// Always pipe stderr so that we can capture it for inspection.
	// Keep stdin and stdout as "inherit" when not piping logs to maintain TTY detection
	// (wrangler checks `process.stdin.isTTY && process.stdout.isTTY` for interactive mode).
	const stdio: ("inherit" | "ignore" | "pipe")[] =
		shouldPipeLogs || noLogs ? ["ignore", "pipe", "pipe"] : ["inherit", "inherit", "pipe"];

	const env = {
		...process.env,
		...wranglerOpts.env,
		// `.env` files are handled by the adapter.
		// Wrangler would load `.env.<wrangler env>` while we should load `.env.<process.env.NEXTJS_ENV>`
		// See https://opennext.js.org/cloudflare/howtos/env-vars
		CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
	};

	// We use `shell: false` everywhere to avoid DEP0190.
	// See https://nodejs.org/api/deprecations.html#dep0190-passing-args-to-nodechild-process-execfilespawn-with-shell-option
	//
	// On POSIX we can spawn the package manager binary directly: each value is passed verbatim
	// as its own argv entry.
	//
	// On Windows the package manager is typically a `.cmd` shim. Per Node.js docs
	// (https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows) the
	// recommended way to invoke a `.cmd`/`.bat` without `shell: true` is to spawn `cmd.exe`
	// directly with `/c`. We pre-escape every token with `quoteShellMeta` and pass the joined
	// command line as a single quoted string with `windowsVerbatimArguments: true` so Node
	// does not re-escape it. This mirrors how `cross-spawn` handles non-`.exe` commands.
	const result = isWin
		? spawnSync(
				"cmd.exe",
				[
					"/d",
					"/s",
					"/c",
					`"${[options.packager, ...packagerArgs].map((token) => quoteShellMeta(token)).join(" ")}"`,
				],
				{
					shell: false,
					windowsVerbatimArguments: true,
					stdio,
					env,
				}
			)
		: spawnSync(options.packager, packagerArgs, {
				shell: false,
				stdio,
				env,
			});

	const success = result.status === 0;
	const stdout = result.stdout?.toString() ?? "";
	const stderr = result.stderr?.toString() ?? "";

	if (!noLogs) {
		// When not piping logs, stderr is captured but should still be visible to the user
		if (!shouldPipeLogs && stderr) {
			process.stderr.write(stderr);
		}

		if (!success && shouldPipeLogs) {
			process.stdout.write(stdout);
			process.stderr.write(stderr);
		}
	}

	return {
		success,
		stdout,
		stderr,
	};
}

export function isWranglerTarget(v: string | undefined): v is WranglerTarget {
	return !!v && ["local", "remote"].includes(v);
}
