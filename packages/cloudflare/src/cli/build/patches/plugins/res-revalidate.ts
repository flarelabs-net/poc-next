/**
 * This patch will replace code used for `res.revalidate` in page router
 * Without the patch it uses `fetch` to make a call to itself, which doesn't work once deployed in cloudflare workers
 * This patch will replace this fetch by a call to `WORKER_SELF_REFERENCE` service binding
 */
import { patchCode } from "@opennextjs/aws/build/patch/astCodePatcher.js";
import type { CodePatcher } from "@opennextjs/aws/build/patch/codePatcher.js";
import { getCrossPlatformPathRegex } from "@opennextjs/aws/utils/regex.js";

export const rule = `
rule:
  kind: await_expression
  inside:
    kind: if_statement
    stopBy: end
    has:
      field: condition
      stopBy: end
      pattern: $$$_.trustHostHeader
  has:
    kind: call_expression
    all:
      - has: { kind: identifier, pattern: fetch}
      - has:
          kind: arguments
          all:
            - has:
                kind: object
                all:
                  - has:
                      kind: pair
                      all:
                        - has: { kind: property_identifier, regex: method }
                        - has: { kind: string, regex: 'HEAD'}
                  - has:
                      kind: pair
                      all:
                        - has: { kind: property_identifier, regex: headers}
                        - has: { kind: identifier, pattern: $HEADERS}
            - has:
                kind: template_string
                all:
                  - has: { kind: string_fragment, regex: ^https://$ }
                  - has:
                      kind: template_substitution
                      all:
                        - has: { kind: identifier, stopBy: end, pattern: $REQ }
                        - has: { kind: property_identifier, regex: ^headers$, stopBy: end }
                        - has: { kind: property_identifier, regex: ^host$, stopBy: end }
                  - has:
                      kind: template_substitution
                      pattern: $URL_PATH
                      has:
                        kind: identifier

fix: await (await import("@opennextjs/cloudflare")).getCloudflareContext().env.WORKER_SELF_REFERENCE.fetch(\`https://self.local$URL_PATH\`,{method:'HEAD', headers:$HEADERS})
`;

export const patchResRevalidate: CodePatcher = {
	name: "patch-res-revalidate",
	patches: [
		{
			versions: ">=14.2.0",
			pathFilter: getCrossPlatformPathRegex(
				String.raw`(pages-api(?:-turbo)?\.runtime\.prod\.js|node/api-resolver\.js)$`,
				{
					escape: false,
				}
			),
			contentFilter: /\.trustHostHeader/,
			patchCode: async ({ code }) => patchCode(code, rule),
		},
	],
};
