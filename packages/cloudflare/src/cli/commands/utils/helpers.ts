import { type BuildOptions } from "@opennextjs/aws/build/helper.js";
import { getPlatformProxy, type GetPlatformProxyOptions } from "wrangler";

import { extractProjectEnvVars } from "../../utils/extract-project-env-vars.js";

export type WorkerEnvVar = Record<keyof CloudflareEnv, string | undefined>;

/**
 * Returns the env vars to use by the CLI.
 *
 * The environments variables are returned from a combination of `process.env`, wrangler config, and `.env*` files.
 *
 * Recommended usage on CI:
 *
 * - Add you secrets to `process.env` (i.e. `CF_ACCOUNT_ID`)
 * - Add public values to the wrangler config `wrangler.jsonc` (i.e. `R2_CACHE_PREFIX_ENV_NAME`)
 *
 * Note: `.dev.vars*` and `.env*` should not be checked in.
 *
 * Recommended usage for local dev:
 *
 * - Add you secrets to either a `.dev.vars*` or `.env*` file (i.e. `CF_ACCOUNT_ID`)
 * - Add public values to the wrangler config `wrangler.jsonc` (i.e. `R2_CACHE_PREFIX_ENV_NAME`)
 *
 * Note: `.env*` files are also used by `next dev` while `.dev.var*` files are only loaded by `wrangler`.
 *
 * Loading details:
 *
 * 1. The variables are first initialized from `process.env`
 * 2. They are then augmented/replaced with variables from the wrangler config (`wrangler.jsonc` and `.dev.vars*`)
 * 3. They are then augmented with variables from `.env*` files (existing values are not replaced).
 *
 * @param options Options to pass to `getPlatformProxy`, i.e. to set the environment
 * @param buildOpts Open Next build options
 * @returns the env vars
 */
export async function getEnvFromPlatformProxy(options: GetPlatformProxyOptions, buildOpts: BuildOptions) {
	// 1. Start from `process.env`
	const envVars = process.env;

	// 2. Apply vars from workers `env`
	const proxy = await getPlatformProxy<CloudflareEnv>({
		...options,
		// Next.js uses a different mechanism to load `.env*` files from wrangler.
		// We prevent wrangler for loading the files and handle that in `getEnvFromPlatformProxy`.
		envFiles: [],
	});

	Object.entries(proxy.env).forEach(([key, value]) => {
		if (typeof value === "string") {
			// filter out bindings by only considering string values
			envVars[key as keyof CloudflareEnv] = value;
		}
	});

	await proxy.dispose();

	// 3. Apply new vars from `.env*` files
	let mode: "production" | "development" | "test" = "production";
	if (envVars.NEXTJS_ENV === "development") {
		mode = "development";
	} else if (envVars.NEXTJS_ENV === "test") {
		mode = "test";
	}

	const dotEnvVars = extractProjectEnvVars(mode, buildOpts);

	for (const varName in dotEnvVars) {
		envVars[varName] ??= dotEnvVars[varName];
	}

	return envVars as unknown as WorkerEnvVar;
}

/**
 * Escape a single argument for shell-style invocation. Cross-platform.
 *
 * On Windows, `runWrangler` invokes `cmd.exe /d /s /c "<command line>"` with
 * `windowsVerbatimArguments: true`. The algorithm matches `cross-spawn`'s `escapeArgument`:
 *   1. Wrap the value in `"..."`, doubling backslash sequences that precede a quote per the
 *      Windows command-line argument rules.
 *   2. Caret-escape every cmd.exe metacharacter, including the wrapping quotes themselves.
 * The wrapping carets are needed for the OUTER `cmd /c "..."` parse: cmd.exe consumes them
 * and the receiving program sees a normally-quoted argument. Crucially, `^` must NOT be
 * applied inside an un-caret-escaped quoted region, because cmd.exe treats `^` as literal
 * inside double quotes (this was the bug an earlier shell-quote-style implementation hit).
 *
 * On POSIX, the value is quoted using standard POSIX shell rules (single quotes by default,
 * double quotes when the value contains a single quote, backslash-escapes for bare values).
 * `runWrangler` itself does not invoke a shell on POSIX, but this branch is preserved so the
 * function behaves usefully for any direct caller.
 *
 * References: https://github.com/moxystudio/node-cross-spawn/blob/master/lib/util/escape.js
 *             https://qntm.org/cmd
 *
 * @param arg
 * @returns escaped arg
 */
export function quoteShellMeta(arg: string) {
	if (process.platform !== "win32") {
		// POSIX shell quoting.
		if (/["\s]/.test(arg) && !/'/.test(arg)) {
			return `'${arg.replace(/(['\\])/g, "\\$1")}'`;
		}
		if (/["'\s]/.test(arg)) {
			return `"${arg.replace(/(["\\$`!])/g, "\\$1")}"`;
		}
		return arg.replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, "$1\\$2");
	}

	// Windows: cross-spawn-style escaping for `cmd.exe /d /s /c "..."` invocation.
	const metaChars = /([()\][%!^"`<>&|;, *?])/g;

	// Double up backslashes that precede a `"` (so the pre-existing backslashes survive
	// as literals after the quote-doubling below).
	let escaped = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
	// Same for backslashes at the end of the string (which will be followed by the wrapping `"`).
	escaped = escaped.replace(/(?=(\\+?)?)\1$/, "$1$1");
	// Wrap the whole thing in quotes.
	escaped = `"${escaped}"`;
	// Caret-escape every meta char, including the wrapping quotes themselves.
	escaped = escaped.replace(metaChars, "^$1");

	return escaped;
}
