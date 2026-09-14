import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { quoteShellMeta } from "./helpers.js";

describe("quoteShellMeta", () => {
	describe("on Windows", () => {
		let originalPlatform: PropertyDescriptor | undefined;

		beforeEach(() => {
			originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
			Object.defineProperty(process, "platform", { value: "win32" });
		});

		afterEach(() => {
			if (originalPlatform) {
				Object.defineProperty(process, "platform", originalPlatform);
			}
		});

		it("escapes empty strings", () => {
			expect(quoteShellMeta("")).toBe('^"^"');
		});

		it("escapes simple alphanumeric values", () => {
			expect(quoteShellMeta("simple-value")).toBe('^"simple-value^"');
		});

		it("does not leave bare carets in front of metacharacters inside the wrapping quotes", () => {
			// Regression: an earlier implementation produced `"...^(...^)..."` which made the
			// carets literal characters inside cmd.exe quotes, corrupting SQL with parens.
			// The correct algorithm caret-escapes the wrapping quotes themselves, so the inner
			// metacharacters stay un-escaped.
			const sql = "CREATE TABLE foo (x INT);";
			const escaped = quoteShellMeta(sql);
			expect(escaped).toBe('^"CREATE^ TABLE^ foo^ ^(x^ INT^)^;^"');
			// No bare `^(` or `^)` sitting inside an un-caret-escaped `"..."`.
			expect(escaped).not.toMatch(/(?<!\^)"[^"]*\^[()][^"]*(?<!\^)"/);
		});

		it("escapes paths containing spaces", () => {
			expect(quoteShellMeta("C:\\Users\\Some User\\chunk.json")).toBe(
				'^"C:\\Users\\Some^ User\\chunk.json^"'
			);
		});

		it("escapes JSON values containing quotes and braces", () => {
			expect(quoteShellMeta('KEY:{"foo":"bar baz"}')).toBe('^"KEY:{\\^"foo\\^":\\^"bar^ baz\\^"}^"');
		});

		it("doubles backslashes that precede a quote", () => {
			// A backslash immediately before a quote needs doubling so the receiving program's
			// argument parser sees a single literal backslash followed by an escaped quote.
			expect(quoteShellMeta('\\"')).toBe('^"\\\\\\^"^"');
		});
	});

	describe("on POSIX", () => {
		let originalPlatform: PropertyDescriptor | undefined;

		beforeEach(() => {
			originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
			Object.defineProperty(process, "platform", { value: "linux" });
		});

		afterEach(() => {
			if (originalPlatform) {
				Object.defineProperty(process, "platform", originalPlatform);
			}
		});

		it("single-quotes values containing whitespace", () => {
			expect(quoteShellMeta("hello world")).toBe("'hello world'");
		});

		it("double-quotes values containing both single and double quotes", () => {
			expect(quoteShellMeta(`it's "quoted"`)).toBe(`"it's \\"quoted\\""`);
		});

		it("backslash-escapes shell metacharacters in bare values", () => {
			expect(quoteShellMeta("a;b")).toBe("a\\;b");
		});
	});
});
