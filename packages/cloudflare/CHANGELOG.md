# @opennextjs/cloudflare

## 1.20.7

### Patch Changes

- [#1387](https://github.com/opennextjs/opennextjs-cloudflare/pull/1387) [`ee0a415`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ee0a415b5cc2121a60035c89f9b6337b5da3fba3) Thanks [@vicb](https://github.com/vicb)! - chore: bump `@opennextjs/aws` to 4.1.5

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.1.5>

## 1.20.6

### Patch Changes

- [#1378](https://github.com/opennextjs/opennextjs-cloudflare/pull/1378) [`7a990e7`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7a990e7cdb9d770a5f4d71fbb32bc105ac944ff5) Thanks [@vicb](https://github.com/vicb)! - Bump Next to 16.3.4 and `@opennextjs/aws` to 4.1.4

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.1.4>

## 1.20.5

### Patch Changes

- [#1374](https://github.com/opennextjs/opennextjs-cloudflare/pull/1374) [`64a69ec`](https://github.com/opennextjs/opennextjs-cloudflare/commit/64a69ec8eed7685bb448be7be97bbff0971e88b1) Thanks [@conico974](https://github.com/conico974)! - chore: bump `@opennextjs/aws` to 4.1.3

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.1.3>

## 1.20.4

### Patch Changes

- [#1365](https://github.com/opennextjs/opennextjs-cloudflare/pull/1365) [`bf52109`](https://github.com/opennextjs/opennextjs-cloudflare/commit/bf52109c18122ec7a52d805c6f4b1e01ca3bce02) Thanks [@vicb](https://github.com/vicb)! - chore: bump `@opennextjs/aws` to 4.1.2

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.1.2>

## 1.20.3

### Patch Changes

- [#1361](https://github.com/opennextjs/opennextjs-cloudflare/pull/1361) [`8c31fbc`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8c31fbcd197d30b940354233cbff091264be7a58) Thanks [@vicb](https://github.com/vicb)! - chore: bump `@opennextjs/aws` to 4.1.1

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.1.1>

- [#1359](https://github.com/opennextjs/opennextjs-cloudflare/pull/1359) [`65e4487`](https://github.com/opennextjs/opennextjs-cloudflare/commit/65e44874d881f8ed6e0324c90e0ba43744c3b26c) Thanks [@vicb](https://github.com/vicb)! - chore: bump the Next.js peer dependency to 15.5.24 / 16.3.3

- [#1359](https://github.com/opennextjs/opennextjs-cloudflare/pull/1359) [`65e4487`](https://github.com/opennextjs/opennextjs-cloudflare/commit/65e44874d881f8ed6e0324c90e0ba43744c3b26c) Thanks [@vicb](https://github.com/vicb)! - fix: patch the Turbopack wasm helpers that Next.js 16.3 emits in the chunks

  Until Next.js 16.2 the Turbopack wasm loaders were named `loadWebAssembly` and
  `loadWebAssemblyModule` functions living in `[turbopack]_runtime.js`, which the adapter rewrote to
  resolve the chunk through a static `import()`. Next.js 16.3 emits them on demand in the chunks
  instead (`[turbopack-wasm]/node/loadWasm.ts`), so the existing patch silently stopped matching and
  `WebAssembly.compileStreaming` - which workerd does not implement - survived into the Worker.

  Every wasm backed import then threw `TypeError: WebAssembly.compileStreaming is not a function` at
  runtime, most visibly breaking Prisma with the `workerd` client runtime.

  The chunks emitted by Turbopack are now patched as well, for both the server and the Node.js
  middleware bundles.

- [#1309](https://github.com/opennextjs/opennextjs-cloudflare/pull/1309) [`56dfacc`](https://github.com/opennextjs/opennextjs-cloudflare/commit/56dfacc1cdeb6422eb59b23dcc80dc844e5f2529) Thanks [@ScienHAC](https://github.com/ScienHAC)! - feature: support Node.js middleware (`proxy.ts`)

  Next.js 16 replaces `middleware.ts` with `proxy.ts` which always runs on the Node.js runtime.

  The Node.js middleware is now bundled into a Workers compatible `middleware/handler.mjs`:
  the OpenNext config manifests are inlined at build time (as for the edge middleware) and the
  middleware compiled by Next.js is statically bundled instead of being loaded from the
  filesystem at runtime (workerd can not access the filesystem nor load modules at runtime).

  The support is experimental and requires the `nodejs_compat` compatibility flag.

- [#1359](https://github.com/opennextjs/opennextjs-cloudflare/pull/1359) [`65e4487`](https://github.com/opennextjs/opennextjs-cloudflare/commit/65e44874d881f8ed6e0324c90e0ba43744c3b26c) Thanks [@vicb](https://github.com/vicb)! - fix: do not load the instrumentation hook from the Node.js middleware bundle

  Next.js 16.3 registers the instrumentation hook from the middleware itself when the middleware
  does not run on the edge runtime, by dynamically requiring `.next/server/instrumentation.js`.
  workerd does not support dynamic requires so every request handled by the Node.js middleware
  (`proxy.ts`) failed with `Dynamic require of ".next/server/instrumentation.js" is not supported`.

  The guard Next.js uses (`process.env.NEXT_RUNTIME !== "edge"`) is inlined by Next.js when it
  compiles the middleware, so it can not be eliminated when the middleware is re-bundled. The loader
  is stubbed out instead, which matches the edge runtime behaviour: the server function - which
  shares the isolate - keeps registering the hook.

## 1.20.2

### Patch Changes

- [#1312](https://github.com/opennextjs/opennextjs-cloudflare/pull/1312) [`38ea40b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/38ea40b669be272ddf09a7df7e70c69d0b57404b) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: handle encoded middleware and cache paths safely

  Upgrade `@opennextjs/aws` to prevent encoded paths from bypassing middleware matching or selecting partially decoded cache entries.

- [#1313](https://github.com/opennextjs/opennextjs-cloudflare/pull/1313) [`766eee9`](https://github.com/opennextjs/opennextjs-cloudflare/commit/766eee97c2fff176a85c4edea59b1e670106d5c5) Thanks [@james-elicx](https://github.com/james-elicx)! - chore: bump the Next.js peer dependency to 15.5.21 / 16.2.11

- [#1306](https://github.com/opennextjs/opennextjs-cloudflare/pull/1306) [`97ef330`](https://github.com/opennextjs/opennextjs-cloudflare/commit/97ef330c6c976b15dd870f8cc280540f41e8833b) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: normalize Windows paths when patching the Turbopack runtime

  Ensure traced Turbopack chunks are included in the generated runtime loaders when builds run on Windows.

## 1.20.1

### Patch Changes

- [#1297](https://github.com/opennextjs/opennextjs-cloudflare/pull/1297) [`780a21c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/780a21c5abe0bbd30e38144a38c3faa555bace2b) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: disable response compression for skew protection API requests

  Avoid truncated compressed Cloudflare API responses causing worker version lookups to fail during deployment.

## 1.20.0

### Minor Changes

- [#1290](https://github.com/opennextjs/opennextjs-cloudflare/pull/1290) [`46c50fc`](https://github.com/opennextjs/opennextjs-cloudflare/commit/46c50fc69295bebe1597ae05ca41c6e03bcc01b3) Thanks [@james-elicx](https://github.com/james-elicx)! - feature: add opt-in batch upload via `rclone` for fast R2 cache population.

  **Key Changes:**

  1. **Optional `rclone` Upload**: Install the optional `rclone.js` peer dependency and pass `--rclone` to opt in to `rclone` based batch uploads.

     - `R2_ACCESS_KEY_ID`
     - `R2_SECRET_ACCESS_KEY`
     - `CF_ACCOUNT_ID`

  2. **Explicit Opt-in**: The existing worker-based population path remains the default. `rclone` is only loaded when `--rclone` is used for a remote cache.
  3. **Clear Errors**: The CLI reports missing credentials or a missing `rclone.js` installation when the option is used.

  **Usage:**

  Install `rclone.js`, then add the secrets in a `.env`/`.dev.vars` file in your project root:

  ```bash
  pnpm add rclone.js
  pnpm approve-builds # select rclone.js
  pnpm rebuild rclone.js
  R2_ACCESS_KEY_ID=your_key
  R2_SECRET_ACCESS_KEY=your_secret
  CF_ACCOUNT_ID=your_account

  opennextjs-cloudflare deploy --rclone
  ```

  You can also set the environment variables for CI builds.

  **Notes:**

  - You can follow documentation <https://developers.cloudflare.com/r2/api/tokens/> for creating API tokens with appropriate permissions for R2 access.
  - `rclone` may not be supported on all platforms.

### Patch Changes

- [#1289](https://github.com/opennextjs/opennextjs-cloudflare/pull/1289) [`eef243f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/eef243ff04790151fb1a4bc832597e2e44b40e70) Thanks [@thatssoheil](https://github.com/thatssoheil)! - fix: spread SQLite bindings in BucketCachePurge alarm so tag purges run

  `BucketCachePurge.alarm()` passed its tag bindings to `SqlStorage.exec` as a
  single array. `exec(query, ...bindings)` is variadic over its bindings, so for a
  multi-tag `DELETE ... WHERE tag IN (?, ?, …)` the binding count (1) disagreed
  with the placeholder count (N) and `exec` threw "Wrong number of parameter
  bindings" on every flush. On-demand `revalidateTag` purges therefore never
  reached the Cloudflare cache, and with `bypassTagCacheOnCacheHit` enabled pages
  served stale until the ISR TTL expired.

  Spread the bindings, normalise the `INSERT` to the same variadic form, and
  tighten the drain loop's guard from `while (tags.length >= 0)` (which never
  exits via the condition) to `while (tags.length > 0)`.

- [#1291](https://github.com/opennextjs/opennextjs-cloudflare/pull/1291) [`51439b1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/51439b12bc68b061d88cb883ee1b97fbc81edfcb) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: disable response compression when provisioning R2 cache buckets

  Avoid truncated compressed Cloudflare API responses causing R2 cache bucket provisioning to fail.

## 1.19.11

### Patch Changes

- [#1270](https://github.com/opennextjs/opennextjs-cloudflare/pull/1270) [`802047e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/802047e7fd30c5533d5b4f754f281bc7a3fd4720) Thanks [@alex-all3dp](https://github.com/alex-all3dp)! - fix: skip non-upload-triggered worker versions when building skew-protection deployment mapping

  Worker versions created by metadata-only operations (e.g. Cloudflare API secret updates) do not include the static assets bundle. Previously, such versions could become the "latest" target in the skew-protection mapping, causing `/_next/static/*` requests to return 404 on past deployments. Versions are now filtered to those with `workers/triggered_by` in `{upload, version_upload}`.

  Closes #1230

## 1.19.10

### Patch Changes

- [#1261](https://github.com/opennextjs/opennextjs-cloudflare/pull/1261) [`780dd4f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/780dd4f09c2090f1d955c90b6ddd1d6b25920850) Thanks [@vicb](https://github.com/vicb)! - Allow populating R2 when the domain is protected by Cloudflare Access

  You need to:

  - create a "Service Auth" policy for "open-next-cache-populate.<account>.workers.dev"
  - add an "Include" rule for "Any Access Service Token" or for a given service token ("Service Token")
  - populate the env variables CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET

## 1.19.9

### Patch Changes

- [#1259](https://github.com/opennextjs/opennextjs-cloudflare/pull/1259) [`3b35c6e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/3b35c6ebfb28a3201ec8d7e99381c14f223d3ff4) Thanks [@vicb](https://github.com/vicb)! - chore: bump Next.js to 15.5.18 / 16.2.6 and @opennextjs/aws to 4.0.2

## 1.19.8

### Patch Changes

- [#1256](https://github.com/opennextjs/opennextjs-cloudflare/pull/1256) [`9696cd0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9696cd014ef73562348e44e8915f76264228972c) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 4.0.1

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.0.1>

## 1.19.7

### Patch Changes

- [#1252](https://github.com/opennextjs/opennextjs-cloudflare/pull/1252) [`29fe15d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/29fe15df5b441e6a95e23de16dd0eca1fa680eae) Thanks [@vicb](https://github.com/vicb)! - bump the number of retries for r2 cache uploads

  Increase the retry count from 5 to 15 with a capped exponential backoff to improve resilience against transient R2 write failures during cache population.

- [#1255](https://github.com/opennextjs/opennextjs-cloudflare/pull/1255) [`364b7d9`](https://github.com/opennextjs/opennextjs-cloudflare/commit/364b7d91b221cddf0139f6875319de605a8fde77) Thanks [@vicb](https://github.com/vicb)! - Bump react and next

## 1.19.6

### Patch Changes

- [#1246](https://github.com/opennextjs/opennextjs-cloudflare/pull/1246) [`5d2014f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/5d2014f09afa24eed983d2ddcd568ac118a728fd) Thanks [@vicb](https://github.com/vicb)! - fix: do not log expected expected D1 errors

  The `populateCache` command adds columns to the D1 tag cache for SWR support.
  This is required for older deployments made before those column were added.
  SQLite errors when the columns exist and we should not log those errors.

- [#1244](https://github.com/opennextjs/opennextjs-cloudflare/pull/1244) [`01babce`](https://github.com/opennextjs/opennextjs-cloudflare/commit/01babce15c28d7a81797d6fbaebe281e930b92f5) Thanks [@tahmid-23](https://github.com/tahmid-23)! - fix: drop streaming wasm calls in Turbopack runtime

  Turbopack replaces wasm imports using `WebAssembly.compileStreaming` and
  `WebAssembly.instantiateStreaming`. These functions are not available in
  the workerd runtime.

  We add a helper `loadWasmChunkFn`. This is a generated switch statement
  that contains an import for each wasm chunk. We use static strings for
  all imports to ensure that all necessary wasm chunks will be detected
  and bundled for the final build.

  The Turbopack patcher replaces the invocations in `loadWebAssembly` and
  `loadWebAssemblyModule`, using the synchronous `WebAssembly.instantiate`
  and redirecting to `loadWasmChunkFn`.

- [#1243](https://github.com/opennextjs/opennextjs-cloudflare/pull/1243) [`1c815de`](https://github.com/opennextjs/opennextjs-cloudflare/commit/1c815de96abbabbd4e5ff81ab299f2b4f3aa77db) Thanks [@tahmid-23](https://github.com/tahmid-23)! - fix: detect object-valued conditions

  The pre-existing build condition transform logic had subtle errors:

  - failed to recognize object conditions
    (e.g. "workerd": { "import": ..., "require": ... })
  - sibling pruning only applied to strings, not objects

  Now, we fully support object conditions. Furthermore, we prune siblings,
  unless its subtree also contains the build condition.

## 1.19.5

### Patch Changes

- [#1240](https://github.com/opennextjs/opennextjs-cloudflare/pull/1240) [`dd7de1d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/dd7de1d4215ebc9943658b88aec858f0e0d314a4) Thanks [@vicb](https://github.com/vicb)! - fix: add missing git ignored files for the migrate command

## 1.19.4

### Patch Changes

- [#1221](https://github.com/opennextjs/opennextjs-cloudflare/pull/1221) [`a2679bf`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a2679bf9549f620e1ab0e1900dcc7a6b6ac03e0a) Thanks [@mushan0x0](https://github.com/mushan0x0)! - Stop bundling `@vercel/og` (and its ~1.4 MiB `resvg.wasm`) when the app does not use it.

  Next.js's `externalImport` helper keeps a dynamic `import("next/dist/compiled/@vercel/og/index.edge.js")` in the emitted handler even for apps that never use `ImageResponse` / `opengraph-image`. Previously this module was marked as `external` when `useOg` was `false`, which left Wrangler to resolve and bundle it — pulling in ~800 KiB of JS plus `resvg.wasm` and pushing many Workers over the Cloudflare free-tier 3 MiB gzip limit.

  When `useOg` is `false`, the edge entry is now aliased to the existing `throw.js` shim, so the unreachable dynamic import resolves to a tiny module and the real `@vercel/og` library is no longer pulled into the Worker bundle.

- [#1208](https://github.com/opennextjs/opennextjs-cloudflare/pull/1208) [`2c5b472`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2c5b4729b6a48560b550af820c46c2350e149fa6) Thanks [@edmundhung](https://github.com/edmundhung)! - Use `OPEN_NEXT_BUILD_ID` instead of `NEXT_BUILD_ID` in the cache keys.

  As of Next 16.2 `NEXT_BUILD_ID` is a fixed value when deploymentId is set explicitly.

  See <https://github.com/opennextjs/opennextjs-aws/pull/1144>

- [#1193](https://github.com/opennextjs/opennextjs-cloudflare/pull/1193) [`1e8d232`](https://github.com/opennextjs/opennextjs-cloudflare/commit/1e8d232672353920a8e05e468cf3a5890b82b0f6) Thanks [@conico974](https://github.com/conico974)! - Fix tag cache stale logic

## 1.19.3

### Patch Changes

- [#1215](https://github.com/opennextjs/opennextjs-cloudflare/pull/1215) [`608893e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/608893e63e1ee16d07c7ec42da979657cf2a62bd) Thanks [@vicb](https://github.com/vicb)! - Factor large repeated values in manifests

  This reduce the size of the generated code.

- [#1218](https://github.com/opennextjs/opennextjs-cloudflare/pull/1218) [`f0d0226`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f0d022685b24881a142bb01005ff78089be8c8d3) Thanks [@314systems](https://github.com/314systems)! - remove `process.version` override

  Remove process.version / process.versions.node overrides now that [unjs/unenv#493](https://github.com/unjs/unenv/pull/493) is merged and shipped in [unenv@2.0.0-rc.16](https://github.com/unjs/unenv/releases/tag/v2.0.0-rc.16) (project uses 2.0.0-rc.24)

- [#1199](https://github.com/opennextjs/opennextjs-cloudflare/pull/1199) [`32594d6`](https://github.com/opennextjs/opennextjs-cloudflare/commit/32594d6a921c5ebdbe25f38635bb2c9dabdcbff1) Thanks [@SdSadat](https://github.com/SdSadat)! - fix(cli): fail fast in non-TTY environments instead of hanging on config-creation prompts

  When `open-next.config.ts` (or `wrangler.(toml|json|jsonc)`) is missing, the CLI
  prompts the user to auto-create it. In non-TTY environments (Cloudflare Workers
  Builds, Docker, CI) the Enquirer prompt can't read stdin, so the build hangs or
  fails with a truncated prompt and a cryptic exit code — the user sees
  `? Missing required open-next.config.ts file, do you want to create one? (Y/n)`
  and then ` ELIFECYCLE  Command failed with exit code 13`, with no hint at what
  to do next.

  Now, in non-interactive environments, both prompts throw an actionable error
  with the exact template to paste (for `open-next.config.ts`) or point at the
  existing `--skipWranglerConfigCheck` / `SKIP_WRANGLER_CONFIG_CHECK` escape
  hatch (for the wrangler config). Interactive behavior is unchanged.

## 1.19.2

### Patch Changes

- [#1207](https://github.com/opennextjs/opennextjs-cloudflare/pull/1207) [`0958726`](https://github.com/opennextjs/opennextjs-cloudflare/commit/0958726939d59e4a5c5a3062190278ffdfde38f5) Thanks [@edmundhung](https://github.com/edmundhung)! - bump `@opennextjs/aws` to 3.10.2

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.10.2>

- [#1139](https://github.com/opennextjs/opennextjs-cloudflare/pull/1139) [`79b01b8`](https://github.com/opennextjs/opennextjs-cloudflare/commit/79b01b84fd92191517b7a11516c04208f9d474a6) Thanks [@james-elicx](https://github.com/james-elicx)! - Fix Turbopack external module resolution by dynamically discovering external imports at build time.

  When packages are listed in `serverExternalPackages`, Turbopack externalizes them via `externalImport()` which uses dynamic `await import(id)`. The bundler (ESBuild) can't statically analyze `import(id)` with a variable, so these modules aren't included in the worker bundle.

  This patch:

  - Discovers hashed Turbopack external module mappings from `.next/node_modules/` symlinks (e.g. `shiki-43d062b67f27bbdc` → `shiki`)
  - Scans traced chunk files for bare external imports (e.g. `externalImport("shiki")`) and subpath imports (e.g. `shiki/engine/javascript`)
  - Generates explicit `switch/case` entries so the bundler can statically resolve and include these modules

- [#1203](https://github.com/opennextjs/opennextjs-cloudflare/pull/1203) [`6f02d12`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6f02d12a75a78410711cc0d9db13ab0d41ed903a) Thanks [@314systems](https://github.com/314systems)! - fix: exclude unsupported Next.js 16 releases from peer dependencies.

  The previous range allowed Next.js 16.0.0 through 16.2.2 without a peer dependency warning because `>=16.2.3` was already covered by `>=15.5.15`.

  The range now explicitly supports Next.js 15.5.15 and above in the 15.x line, and Next.js 16.2.3 and above in the 16.x line.

- [#1200](https://github.com/opennextjs/opennextjs-cloudflare/pull/1200) [`7820ad0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7820ad0a0e5f57aba0580f3cabfdd0caa75cc9bb) Thanks [@NathanDrake2406](https://github.com/NathanDrake2406)! - fix: reuse sharded tag data when filling the regional cache.

  The sharded tag cache miss path already reads tag data from the Durable Object before answering the request. Reuse that fetched data when populating the regional cache so a shard miss does not immediately trigger a second identical Durable Object read.

- [#1206](https://github.com/opennextjs/opennextjs-cloudflare/pull/1206) [`585795d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/585795dbe20fe20d8662addbf9b7be64d82e3184) Thanks [@314systems](https://github.com/314systems)! - fix: regression where getEnvFromPlatformProxy received wrong options type

  This fixes a regression introduced in [32ba91a](https://github.com/opennextjs/opennextjs-cloudflare/commit/32ba91a6d3fa6b9a8b2cd5a8c973c3b3eb1108f0) where `getEnvFromPlatformProxy` call sites passed `OpenNextConfig` even though the function expects Wrangler `GetPlatformProxyOptions`.

  The fix restores the pre-[32ba91a](https://github.com/opennextjs/opennextjs-cloudflare/commit/32ba91a6d3fa6b9a8b2cd5a8c973c3b3eb1108f0) argument shape by passing `{ configPath, environment }` from CLI arguments, so env resolution follows the selected Wrangler config/environment.

## 1.19.1

### Patch Changes

- [#1189](https://github.com/opennextjs/opennextjs-cloudflare/pull/1189) [`236ce14`](https://github.com/opennextjs/opennextjs-cloudflare/commit/236ce14ec9717fa25e64d197081232a2456ebf00) Thanks [@fatihy101](https://github.com/fatihy101)! - fix(tag-cache): forward `isStale()` in `withFilter`

## 1.19.0

### Minor Changes

- [#1168](https://github.com/opennextjs/opennextjs-cloudflare/pull/1168) [`9a26846`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9a268469be3759277d2cc5b412dbc16aff8fe551) Thanks [@conico974](https://github.com/conico974)! - Add support for SWR (stale-while-revalidate) in `revalidateTag`

  See the [AWS implementation](https://github.com/opennextjs/opennextjs-aws/pull/1122) for more details.

### Patch Changes

- [#1184](https://github.com/opennextjs/opennextjs-cloudflare/pull/1184) [`c7d6425`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c7d64251c2789390d35197c31f06f9e28947f44d) Thanks [@vicb](https://github.com/vicb)! - fix for Next.js CVE-2026-23869

  See the [CVE-2026-23869 summary](https://vercel.com/changelog/summary-of-cve-2026-23869) for details.

  This CVE is fixed by bumping the minium Next.js release version to 15.5.15/16.2.3

- [#1177](https://github.com/opennextjs/opennextjs-cloudflare/pull/1177) [`e814a63`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e814a6314bb29b8f0130a68e3f0a8271b66a33ed) Thanks [@conico974](https://github.com/conico974)! - Fix `use cache` not working as expected in Next 16+

## 1.18.1

### Patch Changes

- [#1176](https://github.com/opennextjs/opennextjs-cloudflare/pull/1176) [`2232651`](https://github.com/opennextjs/opennextjs-cloudflare/commit/22326513042bd0a075661c5f3c175de77b084f2c) Thanks [@conico974](https://github.com/conico974)! - fix for OG with Next 16.2.2

- [#1166](https://github.com/opennextjs/opennextjs-cloudflare/pull/1166) [`f89fba1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f89fba1bb2867c9b6aecc810a3b94f17e6f04e51) Thanks [@ash1day](https://github.com/ash1day)! - fix: sort `.endsWith()` checks by path length descending to prevent suffix collisions in dynamic requires

  Routes whose paths are suffixes of other routes (e.g. `/test/app` vs `/`) were resolved incorrectly because the shorter path matched first in the generated `.endsWith()` chain. Sorting by path length descending ensures more specific (longer) paths are always checked first.

  Fixes #1156.

## 1.18.0

### Minor Changes

- [#1159](https://github.com/opennextjs/opennextjs-cloudflare/pull/1159) [`75f5f0a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/75f5f0a75a2ff15ccf3c84c6d66ca7675a99dcde) Thanks [@edmundhung](https://github.com/edmundhung)! - Use remote dev for R2 cache population

  Using remote dev is not subject to the Cloudflare API rate limit of 1,200 requests per 5 minutes that caused failures for large applications with thousands of prerendered pages.

## 1.17.3

### Patch Changes

- [#1160](https://github.com/opennextjs/opennextjs-cloudflare/pull/1160) [`161e726`](https://github.com/opennextjs/opennextjs-cloudflare/commit/161e726a02f063e3fa80aeb8fc629dad605a8b7d) Thanks [@matthewvolk](https://github.com/matthewvolk)! - fix(patches): include `prefetch-hints.json` in loadManifest build-time inlining

  Next.js 16.2.0 introduced `prefetch-hints.json` as a new server manifest loaded unconditionally
  by `NextNodeServer.getPrefetchHints()`. The file exists in the build output but wasn't matched by
  the glob pattern `*-manifest.json`, causing the patched `loadManifest()` to throw at runtime.

## 1.17.2

### Patch Changes

- [#1151](https://github.com/opennextjs/opennextjs-cloudflare/pull/1151) [`a143282`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a1432820bd8f4f867888758380f5e5cc20fa4be0) Thanks [@nathanschram](https://github.com/nathanschram)! - fix: handle known optional manifests gracefully in loadManifest/evalManifest patches

  Next.js loads certain manifests with `handleMissing: true` (returning `{}` when the file doesn't
  exist). The adapter's build-time glob scan doesn't find these files when they're conditionally
  generated, so the patched function threw at runtime, crashing dynamic routes with 500.

  Instead of a blanket catch-all, handle only the specific optional manifests from Next.js
  `route-module.ts`:

  - `react-loadable-manifest` (Turbopack per-route, not all routes have dynamic imports)
  - `subresource-integrity-manifest` (only when `experimental.sri` configured)
  - `server-reference-manifest` (App Router only)
  - `dynamic-css-manifest` (Pages Router + Webpack only)
  - `fallback-build-manifest` (only for `/_error` page)
  - `prefetch-hints` (new in Next.js 16.2)
  - `_client-reference-manifest.js` (optional for static metadata routes, evalManifest)

  Manifest matching strips `.json` before comparison since some Next.js constants omit
  the extension (`SUBRESOURCE_INTEGRITY_MANIFEST`, `DYNAMIC_CSS_MANIFEST`, etc.).

  Unknown manifests still throw to surface genuine errors.

  Fixes #1141.

## 1.17.1

### Patch Changes

- [#1147](https://github.com/opennextjs/opennextjs-cloudflare/pull/1147) [`f5bd138`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f5bd138fd3c77e02f2aa4b9c76d55681e59e98b4) Thanks [@vicb](https://github.com/vicb)! - make dev /cdn-cgi/image behaves like prod for consistency

## 1.17.0

### Minor Changes

- [#1133](https://github.com/opennextjs/opennextjs-cloudflare/pull/1133) [`25d5835`](https://github.com/opennextjs/opennextjs-cloudflare/commit/25d5835b1c006d6400141f3a5aa93332b26b04e3) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - Update the `migrate` command to attempt to create an R2 bucket for caching, if that is not possible an application without caching enabled will be generated instead.

## 1.16.6

### Patch Changes

- [#1138](https://github.com/opennextjs/opennextjs-cloudflare/pull/1138) [`4487f1f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/4487f1f64fbf14175a13d6e54928bc1a35d39fdf) Thanks [@james-elicx](https://github.com/james-elicx)! - Fix the CLI potentially setting a future compatibility date in the wrangler config when workerd has published a version matching a future date, by capping to the current date.

## 1.16.5

### Patch Changes

- [#1127](https://github.com/opennextjs/opennextjs-cloudflare/pull/1127) [`2b437f1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2b437f17cc696a65d8bb5b8fb5a230707267dd84) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - In the `migrate` command, add an initial step to create a Next.js config file (required by open-next) if it doesn't exist

- [#1126](https://github.com/opennextjs/opennextjs-cloudflare/pull/1126) [`8c3a36e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8c3a36e35a0c01745054ccf71169ff2859fa18ad) Thanks [@alex-all3dp](https://github.com/alex-all3dp)! - fix: prevent Worker hang on HEAD requests to static assets

## 1.16.4

### Patch Changes

- [#1122](https://github.com/opennextjs/opennextjs-cloudflare/pull/1122) [`6c94a4a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6c94a4aae9563942fea853b4bb4297dff62a5331) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - In `migrate` command, avoid adding unnecessary newlines when creating files

- [#1122](https://github.com/opennextjs/opennextjs-cloudflare/pull/1122) [`6c94a4a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6c94a4aae9563942fea853b4bb4297dff62a5331) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - fix `migrate` command incorrectly erroring if the target application doesn't have a `public` directory

- [#1122](https://github.com/opennextjs/opennextjs-cloudflare/pull/1122) [`6c94a4a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6c94a4aae9563942fea853b4bb4297dff62a5331) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - Bump `@opennextjs/aws` to 3.9.16

  - Fix `migrate` command not updating Next.js config files
  - Fixes [#1062](https://github.com/opennextjs/opennextjs-cloudflare/issues/1062), [#1115](https://github.com/opennextjs/opennextjs-cloudflare/issues/1115)

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.16>

- [#1097](https://github.com/opennextjs/opennextjs-cloudflare/pull/1097) [`fea645f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/fea645f01e95b58e728ae6f429601c3fa06dd8bc) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - Add `--help` and `--version` to the `opennextjs-cloudflare` CLI

  Improve the `opennextjs-cloudflare` CLI by:

  - ensuring that unknown commands (e.g., `opennextjs-cloudflare foo`) display a clear and helpful error message
  - adding a `-h`|`--help` flag to display the CLI's help message
  - adding a `-v`|`--version` flag to display the package's version

## 1.16.3

### Patch Changes

- [#1113](https://github.com/opennextjs/opennextjs-cloudflare/pull/1113) [`09c41f1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/09c41f1fd9db1253b59fccf0490db28ba2db1fb3) Thanks [@anonrig](https://github.com/anonrig)! - bump `@opennextjs/aws` to 3.9.15

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.15>

## 1.16.2

### Patch Changes

- [#1105](https://github.com/opennextjs/opennextjs-cloudflare/pull/1105) [`e6938a0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e6938a0aff7c01c011ef3035edf47f4e59e3827c) Thanks [@vicb](https://github.com/vicb)! - allow using a regional cache with KV

## 1.16.1

### Patch Changes

- [#1100](https://github.com/opennextjs/opennextjs-cloudflare/pull/1100) [`8676c78`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8676c788cd19022442c36476331a71ee2a850eee) Thanks [@vicb](https://github.com/vicb)! - Empty `NextNodeServer#handleNextImageRequest` to avoid pulling unneeded deps (in #1098)

## 1.16.0

### Minor Changes

- [#1083](https://github.com/opennextjs/opennextjs-cloudflare/pull/1083) [`b062597`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b0625978050c2b8b2d10e3baa589706261cb7e1b) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - feature: add `migrate` command to set up OpenNext for Cloudflare adapter

  This command helps users migrate existing Next.js applications to the OpenNext Cloudflare adapter by automatically setting up all necessary configuration files, dependencies, and scripts.

  To use the command simply run: `npx opennextjs-cloudflare migrate`

### Patch Changes

- [#1092](https://github.com/opennextjs/opennextjs-cloudflare/pull/1092) [`4279043`](https://github.com/opennextjs/opennextjs-cloudflare/commit/42790437e3edb56dad092e4d6c5319d354a286d6) Thanks [@vicb](https://github.com/vicb)! - Check for supported Next version

  The build will now error for unsupported Next version which may contain unpatched security vulnerabilities.
  You can bypass the check using the `--dangerouslyUseUnsupportedNextVersion` flag.

## 1.15.1

### Patch Changes

- [#1085](https://github.com/opennextjs/opennextjs-cloudflare/pull/1085) [`74302ec`](https://github.com/opennextjs/opennextjs-cloudflare/commit/74302ec90a4a98dd05db9d54b72fa312f128cc98) Thanks [@vicb](https://github.com/vicb)! - fix the detection of the runtime (webpack vs turbopack)

## 1.15.0

### Minor Changes

- [#1081](https://github.com/opennextjs/opennextjs-cloudflare/pull/1081) [`ae3d43d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ae3d43d2aa2b0a318d2ab622a4b1bbb2c6069ed9) Thanks [@vicb](https://github.com/vicb)! - Next 16 is now supported

### Patch Changes

- [#1076](https://github.com/opennextjs/opennextjs-cloudflare/pull/1076) [`c99eefd`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c99eefdf925045fd9119d9bb5c4e57bdc12690d0) Thanks [@vicb](https://github.com/vicb)! - fix: do not bundle og when not used

  This saves ~500kB when og is not used

- [#1079](https://github.com/opennextjs/opennextjs-cloudflare/pull/1079) [`6ac789a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6ac789ae6f0c9a81fcfbab255797f6084c5f7075) Thanks [@vicb](https://github.com/vicb)! - fix: use the correct runtime (i.e. webpack or turbopack)

- [#1078](https://github.com/opennextjs/opennextjs-cloudflare/pull/1078) [`249f738`](https://github.com/opennextjs/opennextjs-cloudflare/commit/249f7389196a43a93d9713c478a4a75504e5fd8f) Thanks [@vicb](https://github.com/vicb)! - drop unused react-dom modules

  This saves ~500kB on the output bundle

## 1.14.10

### Patch Changes

- [#1071](https://github.com/opennextjs/opennextjs-cloudflare/pull/1071) [`886c742`](https://github.com/opennextjs/opennextjs-cloudflare/commit/886c742f8e735843196a4a1c758a9e5b1cb5464e) Thanks [@vicb](https://github.com/vicb)! - fix: patch Next config for missing fields.

  There was a regression in Next 16.1.0 (<https://github.com/vercel/next.js/pull/86830>) and some fields were missing in the config.
  The Next team fixed that in 16.1.4 (<https://github.com/vercel/next.js/pull/88733>).

  This PR introduce a patch for 16.1.0-16.1.3

## 1.14.9

### Patch Changes

- [#1070](https://github.com/opennextjs/opennextjs-cloudflare/pull/1070) [`f7c6b3a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f7c6b3a221bd6ad53f04eb6fdfb3a9af9793562e) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.9.8

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.8>

- [#1057](https://github.com/opennextjs/opennextjs-cloudflare/pull/1057) [`0230cbe`](https://github.com/opennextjs/opennextjs-cloudflare/commit/0230cbeb5a1fb9e4218b01651d73283171d3963f) Thanks [@vicb](https://github.com/vicb)! - Do not inject setImmediate/clearImmediate in the global scope

- [#1069](https://github.com/opennextjs/opennextjs-cloudflare/pull/1069) [`4ee4ba3`](https://github.com/opennextjs/opennextjs-cloudflare/commit/4ee4ba31932af53c3f3ed3e33b9509cb6681f182) Thanks [@vicb](https://github.com/vicb)! - Check that wrangler is >= 4.59.2 when building Next 16.1+.

  To ensure `workerd` has a required fix to `setImmediate`

## 1.14.8

### Patch Changes

- [#1064](https://github.com/opennextjs/opennextjs-cloudflare/pull/1064) [`9222070`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9222070d68ecff62cd0138b727065e724f857121) Thanks [@vicb](https://github.com/vicb)! - fix r2 bulk put to respect bucket jurisdiction

## 1.14.7

### Patch Changes

- [#1053](https://github.com/opennextjs/opennextjs-cloudflare/pull/1053) [`d447125`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d44712566659b1040c345f0931532cc03f5619c0) Thanks [@vicb](https://github.com/vicb)! - Support composable cache in Next 16

## 1.14.6

### Patch Changes

- [#1043](https://github.com/opennextjs/opennextjs-cloudflare/pull/1043) [`c83cb83`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c83cb83f30e08d24c0a2b0217e02dff39bf87f95) Thanks [@vicb](https://github.com/vicb)! - fix for CVE-2025-67779

  See <https://nextjs.org/blog/security-update-2025-12-11>

## 1.14.5

### Patch Changes

- [#1042](https://github.com/opennextjs/opennextjs-cloudflare/pull/1042) [`763c4ec`](https://github.com/opennextjs/opennextjs-cloudflare/commit/763c4ec9903532e37054bb046930f62b2d73fb34) Thanks [@vicb](https://github.com/vicb)! - Bump Next, React, and @opennextjs/aws to fix vulnerabilities (CVE-2025-55184 and CVE-2025-55183)

  See <https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components>
  See <https://nextjs.org/blog/security-update-2025-12-11>
  See <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.5>

- [#1034](https://github.com/opennextjs/opennextjs-cloudflare/pull/1034) [`721bff0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/721bff023068c93bba830fe897de8314e71b3a5b) Thanks [@james-elicx](https://github.com/james-elicx)! - output more wrangler command logs when the command fails

- [#1023](https://github.com/opennextjs/opennextjs-cloudflare/pull/1023) [`a4a2f02`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a4a2f02fe664e95de47c75ca60c150892ae4d70d) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - When running `wrangler deploy` add a `OPEN_NEXT_DEPLOY` environment variable to let wrangler know that it is being run by open-next

## 1.14.4

### Patch Changes

- [#1020](https://github.com/opennextjs/opennextjs-cloudflare/pull/1020) [`07919d8`](https://github.com/opennextjs/opennextjs-cloudflare/commit/07919d84033ba46e3e4cad62f526be330947d7ec) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - Add missing WORKER_SELF_REFERENCE service binding in the wrangler.jsonc that the CLI creates

- [#1032](https://github.com/opennextjs/opennextjs-cloudflare/pull/1032) [`1de4899`](https://github.com/opennextjs/opennextjs-cloudflare/commit/1de4899e425510e200a8ecf1b959438afee0633b) Thanks [@vicb](https://github.com/vicb)! - fix(images): allow any local path when no localPatterns are specified

## 1.14.3

### Patch Changes

- [#1025](https://github.com/opennextjs/opennextjs-cloudflare/pull/1025) [`c3aba94`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c3aba94423acf457893eb9456b6113bf185cd1b3) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.9.4

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.4>

- [#1025](https://github.com/opennextjs/opennextjs-cloudflare/pull/1025) [`c3aba94`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c3aba94423acf457893eb9456b6113bf185cd1b3) Thanks [@vicb](https://github.com/vicb)! - Bump Next

## 1.14.2

### Patch Changes

- [#1021](https://github.com/opennextjs/opennextjs-cloudflare/pull/1021) [`250aba2`](https://github.com/opennextjs/opennextjs-cloudflare/commit/250aba239d57fd2d89e119fd7e53ac670e6428b3) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.9.3

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.3>

- [#1021](https://github.com/opennextjs/opennextjs-cloudflare/pull/1021) [`250aba2`](https://github.com/opennextjs/opennextjs-cloudflare/commit/250aba239d57fd2d89e119fd7e53ac670e6428b3) Thanks [@vicb](https://github.com/vicb)! - Bump Next

## 1.14.1

### Patch Changes

- [#1016](https://github.com/opennextjs/opennextjs-cloudflare/pull/1016) [`2200b4b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2200b4b7d05e1f8a89af3831decb3a5734d3fb9f) Thanks [@vicb](https://github.com/vicb)! - Update e2e tests to Next 16 (webpack)

- [#1015](https://github.com/opennextjs/opennextjs-cloudflare/pull/1015) [`e8971cd`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e8971cda7effcdcfa786c8bff85e62a14d4969a5) Thanks [@vicb](https://github.com/vicb)! - memory queue: retrieve the preview ID from `process.env`

- [#1012](https://github.com/opennextjs/opennextjs-cloudflare/pull/1012) [`5f6c0a6`](https://github.com/opennextjs/opennextjs-cloudflare/commit/5f6c0a6775760155b3f1860bb44b4fff2c2916eb) Thanks [@pilcrowonpaper](https://github.com/pilcrowonpaper)! - Add image binding to Wrangler configuration template file

- [#1017](https://github.com/opennextjs/opennextjs-cloudflare/pull/1017) [`a6904a4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a6904a4a0ce6c167d75132bf0fc1642515a7323f) Thanks [@vicb](https://github.com/vicb)! - fix: `response.validate` with the turbo pages runtime

- [#1014](https://github.com/opennextjs/opennextjs-cloudflare/pull/1014) [`f4b53b9`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f4b53b9d33ab2cd6fe27d0c7d3434b1e8494bbb8) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.9.1

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.1>

- [#1019](https://github.com/opennextjs/opennextjs-cloudflare/pull/1019) [`2a3ee86`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2a3ee86b54da60c7df72c7567c7f09edf9e877d7) Thanks [@vicb](https://github.com/vicb)! - await `headers()`

## 1.14.0

### Minor Changes

- [#999](https://github.com/opennextjs/opennextjs-cloudflare/pull/999) [`50d7427`](https://github.com/opennextjs/opennextjs-cloudflare/commit/50d74273f918109179f02dc4ab804d6070637e74) Thanks [@pilcrowonpaper](https://github.com/pilcrowonpaper)! - feat: support image optimization using [the image binding](https://developers.cloudflare.com/images/transform-images/bindings/)

## 1.13.1

### Patch Changes

- [#1001](https://github.com/opennextjs/opennextjs-cloudflare/pull/1001) [`fdf61b4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/fdf61b45b14896de2ff7f61628fd2667c9365552) Thanks [@vicb](https://github.com/vicb)! - Bump wrangler to ^4.49.1

- [#998](https://github.com/opennextjs/opennextjs-cloudflare/pull/998) [`f69787c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f69787ce4c5a4b6a9905d927ba84f5fe96486d4d) Thanks [@vicb](https://github.com/vicb)! - Warn when using Next 16

## 1.13.0

### Minor Changes

- [#991](https://github.com/opennextjs/opennextjs-cloudflare/pull/991) [`b95e7ca`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b95e7cad48b61524ed7c646a8247b1757f5c0171) Thanks [@vicb](https://github.com/vicb)! - use `wrangler r2 bulk put` for R2 cache population

### Patch Changes

- [#994](https://github.com/opennextjs/opennextjs-cloudflare/pull/994) [`ab2d805`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ab2d8051cdc1f54cc4dc787ae55581b062683a5a) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.9.0

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.9.0>

## 1.12.0

### Minor Changes

- [#973](https://github.com/opennextjs/opennextjs-cloudflare/pull/973) [`8cb7669`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8cb7669b0b394c02798f98f3ba5e311bf44b794e) Thanks [@petebacondarwin](https://github.com/petebacondarwin)! - Add standard Next template generated from create-next-app that will be used by create-cloudflare going forward

- [#983](https://github.com/opennextjs/opennextjs-cloudflare/pull/983) [`68aed26`](https://github.com/opennextjs/opennextjs-cloudflare/commit/68aed2605c3490b8650f9c2a38ca219ffb69318c) Thanks [@vicb](https://github.com/vicb)! - feat: turbopack support

## 1.11.1

### Patch Changes

- [#968](https://github.com/opennextjs/opennextjs-cloudflare/pull/968) [`ddb0589`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ddb0589ad17cecb06fd789774b1d75b6771af6bf) Thanks [@rgembalik](https://github.com/rgembalik)! - fix: Compiled config is now imported using `pathToFileURL` to avoid crashes on Windows.

- [#958](https://github.com/opennextjs/opennextjs-cloudflare/pull/958) [`7edf91c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7edf91c7c195cc71f99662ac9e0f039330b2528a) Thanks [@vicb](https://github.com/vicb)! - fix: add missing `await`s

- [#978](https://github.com/opennextjs/opennextjs-cloudflare/pull/978) [`d7ad53e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d7ad53e6caa277e9a3ad8eee4dc5a0f0a2fe9562) Thanks [@vicb](https://github.com/vicb)! - error early when a node middleware is detected

- [#976](https://github.com/opennextjs/opennextjs-cloudflare/pull/976) [`93f4c8a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/93f4c8a56801a260012e2cab4a2b0aea9df80fb1) Thanks [@rgembalik](https://github.com/rgembalik)! - fix: shell quoting on windows machines to avoid upload errors for routes with `[...path]` segments

## 1.11.0

### Minor Changes

- [#925](https://github.com/opennextjs/opennextjs-cloudflare/pull/925) [`62fee71`](https://github.com/opennextjs/opennextjs-cloudflare/commit/62fee7139912360edcc8acbf4c9780981d0077bc) Thanks [@krzysztof-palka-monogo](https://github.com/krzysztof-palka-monogo)! - feature: optional batch upload for faster R2 cache population

  This update adds optional batch upload support for R2 cache population, significantly improving upload performance for large caches when enabled via .env or environment variables.

  **Key Changes:**

  1. **Optional Batch Upload**: Configure R2 credentials via .env or environment variables to enable faster batch uploads:

     - `R2_ACCESS_KEY_ID`
     - `R2_SECRET_ACCESS_KEY`
     - `CF_ACCOUNT_ID`

  2. **Automatic Detection**: When credentials are detected, batch upload is automatically used for better performance
  3. **Smart Fallback**: If credentials are not configured, the CLI falls back to standard Wrangler uploads with a helpful message about enabling batch upload for better performance

  **All deployment commands support batch upload:**

  - `populateCache` - Explicit cache population
  - `deploy` - Deploy with cache population
  - `upload` - Upload version with cache population
  - `preview` - Preview with cache population

  **Performance Benefits (when batch upload is enabled):**

  - Parallel transfer capabilities (32 concurrent transfers)
  - Significantly faster for large caches
  - Reduced API calls to Cloudflare

  **Usage:**

  Add the credentials in a `.env`/`.dev.vars` file in your project root:

  ```bash
  R2_ACCESS_KEY_ID=your_key
  R2_SECRET_ACCESS_KEY=your_secret
  CF_ACCOUNT_ID=your_account
  ```

  You can also set the environment variables for CI builds.

  **Note:**

  You can follow documentation <https://developers.cloudflare.com/r2/api/tokens/> for creating API tokens with appropriate permissions for R2 access.

### Patch Changes

- [#951](https://github.com/opennextjs/opennextjs-cloudflare/pull/951) [`e3aba83`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e3aba83f37675f5c5edd07b9f8c8f431f67c8be7) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.8.5

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.8.5>

- [#948](https://github.com/opennextjs/opennextjs-cloudflare/pull/948) [`0c655c3`](https://github.com/opennextjs/opennextjs-cloudflare/commit/0c655c3c019769bf31c6fc25db678cd13b05babe) Thanks [@vicb](https://github.com/vicb)! - refactor: do not create a wrangler config when a custom one is passed

## 1.10.1

### Patch Changes

- [#945](https://github.com/opennextjs/opennextjs-cloudflare/pull/945) [`f73ac0f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f73ac0f631dcd1e38cd6b808231ffef8e6f8215a) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.8.4

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.8.4>

## 1.10.0

### Minor Changes

- [#937](https://github.com/opennextjs/opennextjs-cloudflare/pull/937) [`32ba91a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/32ba91a6d3fa6b9a8b2cd5a8c973c3b3eb1108f0) Thanks [@vicb](https://github.com/vicb)! - feat: retrieve CLI environment variables from `process.env` and `.env*` files

  Recommended usage on CI:

  - Add your secrets to `process.env` (i.e. `CF_ACCOUNT_ID`)
  - Add public values to the wrangler config `wrangler.jsonc` (i.e. `R2_CACHE_PREFIX_ENV_NAME`)

  Recommended usage for local dev:

  - Add your secrets to either a `.dev.vars*` or `.env*` file (i.e. `CF_ACCOUNT_ID`)
  - Add public values to the wrangler config `wrangler.jsonc` (i.e. `R2_CACHE_PREFIX_ENV_NAME`)

### Patch Changes

- [#941](https://github.com/opennextjs/opennextjs-cloudflare/pull/941) [`59f52e0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/59f52e02f6592130b6ad82e06abe6f6ed5cb3456) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.8.2

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.8.2>

- [#939](https://github.com/opennextjs/opennextjs-cloudflare/pull/939) [`54c47e5`](https://github.com/opennextjs/opennextjs-cloudflare/commit/54c47e5bdca38410c6782f55f0e2ececd0010182) Thanks [@vicb](https://github.com/vicb)! - perf: low-hanging fruits

## 1.9.2

### Patch Changes

- [#932](https://github.com/opennextjs/opennextjs-cloudflare/pull/932) [`0c7d1ae`](https://github.com/opennextjs/opennextjs-cloudflare/commit/0c7d1ae176ecc4808b0c8b21748979e2e886ca32) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.8.1

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.8.1>

## 1.9.1

### Patch Changes

- [#918](https://github.com/opennextjs/opennextjs-cloudflare/pull/918) [`eeb18bb`](https://github.com/opennextjs/opennextjs-cloudflare/commit/eeb18bb76de46c4d6e968952b0fe12e19eb8be94) Thanks [@vicb](https://github.com/vicb)! - refactor: account for empty tag list in tag cache

- [#921](https://github.com/opennextjs/opennextjs-cloudflare/pull/921) [`07487a4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/07487a4dda46321493371bd1588f84dbf5f466a9) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.8.0

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.8.0>

## 1.9.0

### Minor Changes

- [#906](https://github.com/opennextjs/opennextjs-cloudflare/pull/906) [`dcc864d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/dcc864d43558fd8a46dd7c19c10d132b5afc796b) Thanks [@vicb](https://github.com/vicb)! - feat: add an experimental KV based tag cache

### Patch Changes

- [#907](https://github.com/opennextjs/opennextjs-cloudflare/pull/907) [`ba4cac5`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ba4cac5f234555a21a0ad4a672905622f3eaf5b3) Thanks [@vicb](https://github.com/vicb)! - refactor: only try to purge the cache when invalidation is configured

## 1.8.5

### Patch Changes

- [#901](https://github.com/opennextjs/opennextjs-cloudflare/pull/901) [`17a4bea`](https://github.com/opennextjs/opennextjs-cloudflare/commit/17a4bea663ae158b6b4614595b3e5114ea613928) Thanks [@vicb](https://github.com/vicb)! - chore: bump wrangler to ^4.38.0

- [#903](https://github.com/opennextjs/opennextjs-cloudflare/pull/903) [`7fced0f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7fced0fbabc6e1e45609b265a7cca4a58ba52324) Thanks [@vicb](https://github.com/vicb)! - fix: enable using workerd process v2

  process v2 is an updated version of `node:process` active by default after 2025-09-15

## 1.8.4

### Patch Changes

- [#888](https://github.com/opennextjs/opennextjs-cloudflare/pull/888) [`51322a8`](https://github.com/opennextjs/opennextjs-cloudflare/commit/51322a8c02eda77ff106e50e57f41ca3832ebd87) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: remote flag not working for preview command's cache population

  Previously, passing the `--remote` flag when running `opennextjs-cloudflare preview --remote` would not result in the remote preview binding being populated, and would throw errors due to a missing preview flag when populating Workers KV. The remote flag is now supported for the cache popoulation step when running the preview command.

  - `opennextjs-cloudflare preview --remote` will populate the remote binding for the preview ID specified in your Wrangler config.
  - `opennextjs-cloudflare preview` will continue to populate the local binding in your Wrangler config.

## 1.8.3

### Patch Changes

- [#892](https://github.com/opennextjs/opennextjs-cloudflare/pull/892) [`1ee505f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/1ee505f7d89c91d51576edd7d9cbfc768ece8af3) Thanks [@vicb](https://github.com/vicb)! - Bump @opennextjs/aws to 3.7.7

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.7.7>

## 1.8.2

### Patch Changes

- [#883](https://github.com/opennextjs/opennextjs-cloudflare/pull/883) [`bf1a6f6`](https://github.com/opennextjs/opennextjs-cloudflare/commit/bf1a6f6c578934203cec83b50c65713b810f378a) Thanks [@vicb](https://github.com/vicb)! - fix: type error during build

## 1.8.1

### Patch Changes

- [#878](https://github.com/opennextjs/opennextjs-cloudflare/pull/878) [`23b67ce`](https://github.com/opennextjs/opennextjs-cloudflare/commit/23b67ce1d828498dcef89551b256dd0e8551199b) Thanks [@sommeeeer](https://github.com/sommeeeer)! - fix: Respect trailing slash config for \_next/image route in worker

- [#882](https://github.com/opennextjs/opennextjs-cloudflare/pull/882) [`a6283af`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a6283af5e0a70889a0dba1a0c7a8829184b2e7ae) Thanks [@vicb](https://github.com/vicb)! - perf: skip lazy update on cache hit when cache purge is enabled

- [#881](https://github.com/opennextjs/opennextjs-cloudflare/pull/881) [`9a746d2`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9a746d27e5712766516ac048bf6f73a1e9b7f5fd) Thanks [@vicb](https://github.com/vicb)! - fix: detection of cache purge

## 1.8.0

### Minor Changes

- [#862](https://github.com/opennextjs/opennextjs-cloudflare/pull/862) [`728ad99`](https://github.com/opennextjs/opennextjs-cloudflare/commit/728ad9901a2ed57a0aae33f5d460bf5d0f32b5bb) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: support for a custom OpenNext config path with the `--openNextConfigPath` flag

### Patch Changes

- [#872](https://github.com/opennextjs/opennextjs-cloudflare/pull/872) [`dc76d6e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/dc76d6e7b62a5e33488b47aba62f8573bf3ab49f) Thanks [@alex-all3dp](https://github.com/alex-all3dp)! - Fix check for missing CACHE_PURGE_ZONE_ID

- [#862](https://github.com/opennextjs/opennextjs-cloudflare/pull/862) [`728ad99`](https://github.com/opennextjs/opennextjs-cloudflare/commit/728ad9901a2ed57a0aae33f5d460bf5d0f32b5bb) Thanks [@james-elicx](https://github.com/james-elicx)! - refactor: deprecate usage of the `--configPath` flag for the Wrangler config, in favour of the `--config` flag.

## 1.7.1

### Patch Changes

- [#865](https://github.com/opennextjs/opennextjs-cloudflare/pull/865) [`f1e9457`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f1e9457ec10e8809ea195ff3328de27a89c1977c) Thanks [@sommeeeer](https://github.com/sommeeeer)! - fix: Ensure request.url reflects the actual host protocol in route handlers

- [#867](https://github.com/opennextjs/opennextjs-cloudflare/pull/867) [`2c1de0b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2c1de0b8d231ba2024145b4275ba2ae4b32b636a) Thanks [@vicb](https://github.com/vicb)! - Log cache purge errors as errors

## 1.7.0

### Minor Changes

- [#848](https://github.com/opennextjs/opennextjs-cloudflare/pull/848) [`f80c801`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f80c8019ab1536b6cf4ba4d3c5a82b57d6716537) Thanks [@sommeeeer](https://github.com/sommeeeer)! - Ensure that the initial request.signal is passed to the wrapper

  `request.signal.onabort` is now supported in route handlers. It requires that the signal from the original worker's request is passed to the handler. It will then pass along that `AbortSignal` through the `streamCreator` in the wrapper. This signal will destroy the response sent to NextServer when a client aborts, thus triggering the signal in the route handler.

  See the changelog in Cloudflare [here](https://developers.cloudflare.com/changelog/2025-05-22-handle-request-cancellation/).

  **Note:**
  If you have a custom worker, you must update your code to pass the original `request.signal` to the handler. You also need to enable the compatibility flag `enable_request_signal` to use this feature.

  For example:

  ```js
  // Before:
  return handler(reqOrResp, env, ctx);

  // After:
  return handler(reqOrResp, env, ctx, request.signal);
  ```

- [#850](https://github.com/opennextjs/opennextjs-cloudflare/pull/850) [`ce5c7b4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ce5c7b417d44ead633128e676bb0971ad68040ba) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - Add option for regional cache to skip tagCache on cache hits

  When the tag regional cache finds a value in the incremental cache, checking such value in the tagCache can be skipped, this helps reducing response times at the tradeoff that the user needs to either use the automatic cache purging or manually purge the cache when appropriate. For this the `bypassTagCacheOnCacheHit` option is being added to the `RegionalCache` class.

  Example:

  ```js
  import { defineCloudflareConfig } from "@opennextjs/cloudflare";
  import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
  import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
  import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
  import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

  export default defineCloudflareConfig({
  	incrementalCache: withRegionalCache(r2IncrementalCache, {
  		mode: "long-lived",
  		bypassTagCacheOnCacheHit: true,
  	}),
  	tagCache: d1NextTagCache,
  	queue: memoryQueue,
  });
  ```

### Patch Changes

- [#858](https://github.com/opennextjs/opennextjs-cloudflare/pull/858) [`7233c03`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7233c035c132b0642e8a891d9b3ff3a3c739be5e) Thanks [@vicb](https://github.com/vicb)! - bump @opennextjs/aws to 3.7.6

  See the changes at <https://github.com/opennextjs/opennextjs-aws/compare/v3.7.4...v3.7.6>

- [#857](https://github.com/opennextjs/opennextjs-cloudflare/pull/857) [`b8b38ee`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b8b38ee8af25bb76cf41fa208cc25ed5cafda851) Thanks [@vicb](https://github.com/vicb)! - Clean output directory before `next build`

## 1.6.5

### Patch Changes

- [#843](https://github.com/opennextjs/opennextjs-cloudflare/pull/843) [`10fc603`](https://github.com/opennextjs/opennextjs-cloudflare/commit/10fc603062564ee37c738a396a205cdb59687685) Thanks [@vicb](https://github.com/vicb)! - perf: drop the babel dependency

## 1.6.4

### Patch Changes

- [#838](https://github.com/opennextjs/opennextjs-cloudflare/pull/838) [`90f451d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/90f451db6597062eeca13f6b8913dd91ca39d0c3) Thanks [@conico974](https://github.com/conico974)! - bump @opennextjs/aws to 3.7.4

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.7.4>

- [#833](https://github.com/opennextjs/opennextjs-cloudflare/pull/833) [`c9705e5`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c9705e5bf44e00996c19cf146e0f56a28936c1fa) Thanks [@sommeeeer](https://github.com/sommeeeer)! - Update the patches to support Next.js 15.4"

## 1.6.3

### Patch Changes

- [#828](https://github.com/opennextjs/opennextjs-cloudflare/pull/828) [`d00b3a1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d00b3a13e42e65aad76fba41774815726422cc39) Thanks [@vicb](https://github.com/vicb)! - bump @opennextjs/aws to 3.7.2

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.7.2>

- [#830](https://github.com/opennextjs/opennextjs-cloudflare/pull/830) [`daf36fa`](https://github.com/opennextjs/opennextjs-cloudflare/commit/daf36faf91fa764b36fd1a4db39aa1e25e968518) Thanks [@vicb](https://github.com/vicb)! - detect more image types

  Sync of <https://github.com/vercel/next.js/pull/82118>

- [#832](https://github.com/opennextjs/opennextjs-cloudflare/pull/832) [`67e71b9`](https://github.com/opennextjs/opennextjs-cloudflare/commit/67e71b9f3aa55222df44296353025c4d19f38ecb) Thanks [@vicb](https://github.com/vicb)! - fix: --noMinify stop minifying the bundle

## 1.6.2

### Patch Changes

- [#820](https://github.com/opennextjs/opennextjs-cloudflare/pull/820) [`c202302`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c2023029d680ded87c01d0fd5cc324124f30fa3f) Thanks [@conico974](https://github.com/conico974)! - Fix regional cache for the DOShardedTagCache

- [#818](https://github.com/opennextjs/opennextjs-cloudflare/pull/818) [`be6a492`](https://github.com/opennextjs/opennextjs-cloudflare/commit/be6a49224ef85d89486240bb8491031ae5d27a20) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - fix `deploy` and `upload` commands not taking into account environment variables

- [#825](https://github.com/opennextjs/opennextjs-cloudflare/pull/825) [`3de7962`](https://github.com/opennextjs/opennextjs-cloudflare/commit/3de79624b63358af0881c21f1f93bbed1d9ca983) Thanks [@conico974](https://github.com/conico974)! - Add an option to persist missing tags in the regional tag cache

- [#816](https://github.com/opennextjs/opennextjs-cloudflare/pull/816) [`c46eeee`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c46eeee8f70032708f71dfb37a40fe8b1b805507) Thanks [@vicb](https://github.com/vicb)! - bump @opennextjs/aws to 3.7.1

  See details at <https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.7.1>

## 1.6.1

### Patch Changes

- [#814](https://github.com/opennextjs/opennextjs-cloudflare/pull/814) [`89ce96b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/89ce96b773a0a4a23f095e26d6c2403ea47eb69c) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: wrangler config not passed to cache population

## 1.6.0

### Minor Changes

- [#791](https://github.com/opennextjs/opennextjs-cloudflare/pull/791) [`b158e8b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b158e8b18b2c51005bd8f3929d2b9eaf58ee6e2f) Thanks [@james-elicx](https://github.com/james-elicx)! - refactor: use yargs for the cli

### Patch Changes

- [#810](https://github.com/opennextjs/opennextjs-cloudflare/pull/810) [`fdfa5af`](https://github.com/opennextjs/opennextjs-cloudflare/commit/fdfa5af6b7d5102ce31f436ef1f8ac910312e26f) Thanks [@vicb](https://github.com/vicb)! - fix skew protection handling of POST requests

## 1.5.3

### Patch Changes

- [#804](https://github.com/opennextjs/opennextjs-cloudflare/pull/804) [`72d8d5b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/72d8d5b71852d5e85e56dc5f7ac749b2a1e8d7ca) Thanks [@alex-all3dp](https://github.com/alex-all3dp)! - Fix missing SQL parameter bindings in D1NextModeTagCache.getLastRevalidated()

## 1.5.2

### Patch Changes

- [#785](https://github.com/opennextjs/opennextjs-cloudflare/pull/785) [`e0f39b6`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e0f39b6215bd58c8135c028578ae3f5dd2f05c7f) Thanks [@vicb](https://github.com/vicb)! - Cancel the unused stream (body)

- [#789](https://github.com/opennextjs/opennextjs-cloudflare/pull/789) [`040731c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/040731c56e5e96d6da31b393db1e074ce6524dae) Thanks [@vicb](https://github.com/vicb)! - cancel the body stream when unconsumed

- [#795](https://github.com/opennextjs/opennextjs-cloudflare/pull/795) [`d18cd9d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d18cd9d2071248ebe5560599f88fa0552940d77a) Thanks [@sommeeeer](https://github.com/sommeeeer)! - fix(patches): Update patchInstrumentation and loadManifest to work with Next 15.4

- [#800](https://github.com/opennextjs/opennextjs-cloudflare/pull/800) [`a3e7551`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a3e7551cc0684a36bbe9547c43ec1da2640f13a6) Thanks [@vicb](https://github.com/vicb)! - wrangler should not load .env files

## 1.5.1

### Patch Changes

- [#781](https://github.com/opennextjs/opennextjs-cloudflare/pull/781) [`e984e8f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e984e8f2e2627626377eee131f1b474697ee0d92) Thanks [@vicb](https://github.com/vicb)! - fallback to the upstream image content-type header

- [#779](https://github.com/opennextjs/opennextjs-cloudflare/pull/779) [`224a2f0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/224a2f05d720c51d507fc152e6fa01c6c26177c8) Thanks [@petebacondarwin](https://github.com/petebacondarwin)! - Ensure that the `cloudflare` library is available at runtime

  Previously it was only a `devDependency` which meant it was missing in real life installations of the tool.

  The error looked like:

  ```text
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cloudflare' imported from @opennextjs/cloudflare/dist/cli/commands/skew-protection.js
  ```

## 1.5.0

### Minor Changes

- [#768](https://github.com/opennextjs/opennextjs-cloudflare/pull/768) [`40f7e72`](https://github.com/opennextjs/opennextjs-cloudflare/commit/40f7e724e0e0326516be77b3ecea6842db4591bc) Thanks [@vicb](https://github.com/vicb)! - Add an asset resolver to support `run_worker_first=true`

- [#746](https://github.com/opennextjs/opennextjs-cloudflare/pull/746) [`6d020fe`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6d020fe230a0500c3dceeef4695edd21a450bded) Thanks [@vicb](https://github.com/vicb)! - feat: add support for experimental skew protection

### Patch Changes

- [#776](https://github.com/opennextjs/opennextjs-cloudflare/pull/776) [`bd448a8`](https://github.com/opennextjs/opennextjs-cloudflare/commit/bd448a83fbf5dd259160e1b24f31751bdbacb8e7) Thanks [@vicb](https://github.com/vicb)! - Add support for images CSP, disposition, and allow SVG

## 1.4.0

### Minor Changes

- [#764](https://github.com/opennextjs/opennextjs-cloudflare/pull/764) [`af963f0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/af963f04b820f39c81b8a39d58cd7a050f5599ab) Thanks [@vicb](https://github.com/vicb)! - Update @opennextjs/aws to 3.7.0

  [3.7.0 Release notes](https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.7.0)

## 1.3.1

### Patch Changes

- [#730](https://github.com/opennextjs/opennextjs-cloudflare/pull/730) [`ae31733`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ae317335fa110f6f981e06ba170460b5cdb1f40c) Thanks [@vicb](https://github.com/vicb)! - add tests for remote patterns

- [#738](https://github.com/opennextjs/opennextjs-cloudflare/pull/738) [`b911c3e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b911c3e7532c64b6fe687c8abd59f23d048c3776) Thanks [@sommeeeer](https://github.com/sommeeeer)! - fix: support Next 14 experimental.serverComponentsExternalPackages

- [#740](https://github.com/opennextjs/opennextjs-cloudflare/pull/740) [`d8150d2`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d8150d201e4ce282d8a7bff743771d7ab61e9b11) Thanks [@sommeeeer](https://github.com/sommeeeer)! - feat(images): implement localPatterns for images

- [#720](https://github.com/opennextjs/opennextjs-cloudflare/pull/720) [`9ed8d8a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9ed8d8aa5c728fc8a25e562ba44290c07fdda8ec) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: pass cli arguments not used by `opennextjs-cloudflare` to wrangler

  Previously, arguments had to be provided after `--` e.g. `opennextjs-cloudflare preview -- --port 12345`. This is no longer necessary, and they can be provided normally, e.g. `opennextjs-cloudflare preview --port 12345`.

- [#743](https://github.com/opennextjs/opennextjs-cloudflare/pull/743) [`7a2fc7d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7a2fc7d9ec353d7be7c33f81d08e3097ad62cd66) Thanks [@vicb](https://github.com/vicb)! - update @opennextjs/aws to 3.6.6

  [3.6.6 Release notes](https://github.com/opennextjs/opennextjs-aws/releases/tag/v3.6.6)

- [#712](https://github.com/opennextjs/opennextjs-cloudflare/pull/712) [`2f6dd81`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2f6dd81a7b5b1fb4ed16b9b0e0289ee780328e3c) Thanks [@vicb](https://github.com/vicb)! - Drop the patch for NextServer#getMiddlewareManifest (taken care of by was)

## 1.3.0

### Minor Changes

- [#727](https://github.com/opennextjs/opennextjs-cloudflare/pull/727) [`36119c0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/36119c0f490c95b3d4f6e826d745b728c80625ab) Thanks [@vicb](https://github.com/vicb)! - Enforce remotePatterns when fetching external images

## 1.2.1

### Patch Changes

- [#714](https://github.com/opennextjs/opennextjs-cloudflare/pull/714) [`eedbe2b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/eedbe2b772db476a68c68133d24cf80ea5bb9b82) Thanks [@vicb](https://github.com/vicb)! - perf: minify the generated bundle by default

- [#713](https://github.com/opennextjs/opennextjs-cloudflare/pull/713) [`3d8fb0c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/3d8fb0c353c180fa80c831a2a7703a5f58f33f54) Thanks [@vicb](https://github.com/vicb)! - make the "require" patch optional

## 1.2.0

### Minor Changes

- [#696](https://github.com/opennextjs/opennextjs-cloudflare/pull/696) [`de6a6cd`](https://github.com/opennextjs/opennextjs-cloudflare/commit/de6a6cd9511e6e6418fa2cd6ada38181566ac88b) Thanks [@vicb](https://github.com/vicb)! - Add the `routePreloadingBehavior` to the options of `defineCloudflareConfig`.

  The default is set to "none" as other values might increase CPU usage on cold starts.

### Patch Changes

- [#700](https://github.com/opennextjs/opennextjs-cloudflare/pull/700) [`56e9366`](https://github.com/opennextjs/opennextjs-cloudflare/commit/56e9366b736d5999afd421975bbb4167746d4ff7) Thanks [@vicb](https://github.com/vicb)! - perf: drop `@ampproject/toolbox-optimizer` to reduce the server bundle size

- [#689](https://github.com/opennextjs/opennextjs-cloudflare/pull/689) [`64a10a6`](https://github.com/opennextjs/opennextjs-cloudflare/commit/64a10a6ea4d0c7207e66e8b038b4ed8343f50caf) Thanks [@sommeeeer](https://github.com/sommeeeer)! - fix: Ensure the protocol is correct for redirects in server actions during preview mode

- [#710](https://github.com/opennextjs/opennextjs-cloudflare/pull/710) [`903ad45`](https://github.com/opennextjs/opennextjs-cloudflare/commit/903ad452f4a551e0a54089def37e797ecad58209) Thanks [@vicb](https://github.com/vicb)! - perf: drop babel to reduce the server bundle size

## 1.1.0

### Minor Changes

- [#655](https://github.com/opennextjs/opennextjs-cloudflare/pull/655) [`2c819c6`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2c819c629e8460ccca53fd771b46e048b512348e) Thanks [@conico974](https://github.com/conico974)! - Automatic Cache API purge

- [#500](https://github.com/opennextjs/opennextjs-cloudflare/pull/500) [`5142788`](https://github.com/opennextjs/opennextjs-cloudflare/commit/5142788f3e76fc63a3c4ee9b61f0cc4643e98e1a) Thanks [@conico974](https://github.com/conico974)! - add regional replicas for the sharded tag cache

- [#496](https://github.com/opennextjs/opennextjs-cloudflare/pull/496) [`298fd4e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/298fd4e29cd13ae68327fde80286575372bb5e32) Thanks [@conico974](https://github.com/conico974)! - add an optional cache for the durable queue

### Patch Changes

- [#685](https://github.com/opennextjs/opennextjs-cloudflare/pull/685) [`360012c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/360012c38299a52413675574b209690c04e5bf87) Thanks [@vicb](https://github.com/vicb)! - bump aws to 3.6.4

  More details about the fixes can be found [here](https://github.com/opennextjs/opennextjs-aws/blob/main/packages/open-next/CHANGELOG.md#364)

## 1.0.4

### Patch Changes

- [#676](https://github.com/opennextjs/opennextjs-cloudflare/pull/676) [`ead6ddc`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ead6ddce45a9c7725f027fb8f7e826f864d82be5) Thanks [@vicb](https://github.com/vicb)! - bump esbuild to 0.25.4

- [#675](https://github.com/opennextjs/opennextjs-cloudflare/pull/675) [`e6040bc`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e6040bcaaf887148b5be44e08fe79c7e4ff92042) Thanks [@conico974](https://github.com/conico974)! - add a `cloudflare.dangerousDisableConfigValidation` config option to not throw on validation of the config

- [#674](https://github.com/opennextjs/opennextjs-cloudflare/pull/674) [`ec9ea58`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ec9ea58764fa344b6a47df33b4ae05063d9a1c07) Thanks [@conico974](https://github.com/conico974)! - fix blockConcurrencyWhile on DO queue

- [#672](https://github.com/opennextjs/opennextjs-cloudflare/pull/672) [`9188e67`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9188e679cc70d14bc2dedfa2428926b51c1a1ba9) Thanks [@conico974](https://github.com/conico974)! - bump aws to 3.6.2. More details about the fixes can be found here: <https://github.com/opennextjs/opennextjs-aws/blob/main/packages/open-next/CHANGELOG.md#362>

## 1.0.3

### Patch Changes

- [#666](https://github.com/opennextjs/opennextjs-cloudflare/pull/666) [`e87d8bb`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e87d8bb460ded4f6d6cbeb1ddf69788d1c817cda) Thanks [@conico974](https://github.com/conico974)! - fix fetch inside `use cache` in ISR

- [#599](https://github.com/opennextjs/opennextjs-cloudflare/pull/599) [`7b06a42`](https://github.com/opennextjs/opennextjs-cloudflare/commit/7b06a42455d6f0dc90f76c85e4c372446f350ba3) Thanks [@james-elicx](https://github.com/james-elicx)! - Fix multiple Windows path issues.

## 1.0.2

### Patch Changes

- [#656](https://github.com/opennextjs/opennextjs-cloudflare/pull/656) [`a20d2df`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a20d2dff1274d2932eb53c2900eaaa8199e07eaa) Thanks [@conico974](https://github.com/conico974)! - revert to using an external middleware

  This will reduce cpu time for anything coming from the routing layer (i.e. redirects, rewrites, middleware response or when using cache interception)

## 1.0.1

### Patch Changes

- [#648](https://github.com/opennextjs/opennextjs-cloudflare/pull/648) [`cb3a2f2`](https://github.com/opennextjs/opennextjs-cloudflare/commit/cb3a2f28264fa1273059f87846e6e39811bc5402) Thanks [@conico974](https://github.com/conico974)! - fix cache population hanging

## 1.0.0

- [#613](https://github.com/opennextjs/opennextjs-cloudflare/pull/613) [`2d82fad`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2d82fadfbbc2883e990a79197c8793afb8bf400d) Thanks [@conico974](https://github.com/conico974)! - Bump aws to 3.6.0

  Introduce support for the composable cache

  BREAKING CHANGE: The interface for the Incremental cache has changed. The new interface use a Cache type instead of a boolean to distinguish between the different types of caches. It also includes a new Cache type for the composable cache. The new interface is as follows:

  ```ts
  export type CacheEntryType = "cache" | "fetch" | "composable";

  export type IncrementalCache = {
  	get<CacheType extends CacheEntryType = "cache">(
  		key: string,
  		cacheType?: CacheType
  	): Promise<WithLastModified<CacheValue<CacheType>> | null>;
  	set<CacheType extends CacheEntryType = "cache">(
  		key: string,
  		value: CacheValue<CacheType>,
  		isFetch?: CacheType
  	): Promise<void>;
  	delete(key: string): Promise<void>;
  	name: string;
  };
  ```

  NextModeTagCache also get a new function `getLastRevalidated` used for the composable cache:

  ```ts
    getLastRevalidated(tags: string[]): Promise<number>;
  ```

- [#640](https://github.com/opennextjs/opennextjs-cloudflare/pull/640) [`af60dea`](https://github.com/opennextjs/opennextjs-cloudflare/commit/af60deae5460bc72bf3abd2e87ed442d102d533f) Thanks [@vicb](https://github.com/vicb)! - fix: escape shell arguments when populating the cache

- [#628](https://github.com/opennextjs/opennextjs-cloudflare/pull/628) [`a169b76`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a169b7669544a26f1b66cf9d5061b554d2f09edc) Thanks [@conico974](https://github.com/conico974)! - fix issues with build conditions and wasm

- [#619](https://github.com/opennextjs/opennextjs-cloudflare/pull/619) [`09aaf35`](https://github.com/opennextjs/opennextjs-cloudflare/commit/09aaf359b2515b0aaab83f1cb50f2b2be6cb8ca7) Thanks [@conico974](https://github.com/conico974)! - global timer functions now use the one from node:timers

- [#593](https://github.com/opennextjs/opennextjs-cloudflare/pull/593) [`faca3e1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/faca3e1376dd47216f97a5dcaef6275fd16d84cb) Thanks [@vicb](https://github.com/vicb)! - Use the workerd build condition by default

- [#641](https://github.com/opennextjs/opennextjs-cloudflare/pull/641) [`e07a2ed`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e07a2ede88896982fc4e91f1a2f131590bcdcd32) Thanks [@conico974](https://github.com/conico974)! - some performance improvements

  - `enableCacheInterception` can be enabled using `defineCloudflareConfig`, it loads ISR/SSG pages from cache without waiting for the js page bundle to load. PPR is not supported at the moment
  - `routePreloadingBehavior` is now set to `withWaitUntil`, which means a single route js will be lazy loaded on cold start, but other routes will be preloaded using `waitUntil` for better performance

- [#639](https://github.com/opennextjs/opennextjs-cloudflare/pull/639) [`c4d278e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c4d278eb2e727b508cb432929e9dc0882b8e4242) Thanks [@conico974](https://github.com/conico974)! - polyfill import.meta.url

- [#622](https://github.com/opennextjs/opennextjs-cloudflare/pull/622) [`f5264d2`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f5264d2b6f7c72ff7c25a382a36c9de9bf897985) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: use `getPlatformProxy` for cache population prefix vars

- [#616](https://github.com/opennextjs/opennextjs-cloudflare/pull/616) [`f129602`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f12960266c1ceb381b8a6abb6234226e901f416e) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: prefix for kv cache keys

- [#644](https://github.com/opennextjs/opennextjs-cloudflare/pull/644) [`899bae0`](https://github.com/opennextjs/opennextjs-cloudflare/commit/899bae04ec981272868dfe3b3b20484019d00c8e) Thanks [@conico974](https://github.com/conico974)! - fix cache population for R2

- [#626](https://github.com/opennextjs/opennextjs-cloudflare/pull/626) [`de9e05a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/de9e05a414ddfe9055868194ee8e5df3489f82f7) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: bulk insert cache entries to KV

## 1.0.0-beta.4

### Changes

- [#595](https://github.com/opennextjs/opennextjs-cloudflare/pull/595) [`b0c14e1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b0c14e15ed886dd8f21489b89361feb05c244d23) Thanks [@vicb](https://github.com/vicb)! - drop support for wrangler v3

- [#608](https://github.com/opennextjs/opennextjs-cloudflare/pull/608) [`055a61b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/055a61b17c78ac87d0b66dee8e6416e334e01d98) Thanks [@conico974](https://github.com/conico974)! - Add a new `withFilter` tag cache to allow to filter the tags used

- [#591](https://github.com/opennextjs/opennextjs-cloudflare/pull/591) [`0361672`](https://github.com/opennextjs/opennextjs-cloudflare/commit/03616723ee775c31fed9cb1a048e7b0a9bd1e63c) Thanks [@vicb](https://github.com/vicb)! - Add an example of creating a custom worker

  Creating a custom worker enable adding DO, handlers (scheduled, queue, ...)

  closes #207, #397, #589

- [#607](https://github.com/opennextjs/opennextjs-cloudflare/pull/607) [`15f1160`](https://github.com/opennextjs/opennextjs-cloudflare/commit/15f11607d7cb5820e34164e887f18cef6d84a6b4) Thanks [@conico974](https://github.com/conico974)! - fix page router shared context to use the correct one

## 1.0.0-beta.3

### Changes

- [#574](https://github.com/opennextjs/opennextjs-cloudflare/pull/574) [`d310919`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d310919aed46d13f0010426b03e948e1726d6d50) Thanks [@vicb](https://github.com/vicb)! - Add support for basePath

- [#581](https://github.com/opennextjs/opennextjs-cloudflare/pull/581) [`c7c5d3d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/c7c5d3d32ac0cd644096059c854ade6eb8096126) Thanks [@vicb](https://github.com/vicb)! - fix(tagCache): gracefully handle empty tag list

- [#563](https://github.com/opennextjs/opennextjs-cloudflare/pull/563) [`2ce6454`](https://github.com/opennextjs/opennextjs-cloudflare/commit/2ce64546165b5bbcc1718649bf91b599aa01594c) Thanks [@vicb](https://github.com/vicb)! - Extract the worker init code to a separate file

- [#551](https://github.com/opennextjs/opennextjs-cloudflare/pull/551) [`8841641`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8841641fc740717489e59004de2b0e509ba16eca) Thanks [@SamyPesse](https://github.com/SamyPesse)! - Set `Cache-Tag` on the entries created by the regional cache, to be purged using the Cloudflare API or dashboard.

- [#579](https://github.com/opennextjs/opennextjs-cloudflare/pull/579) [`68d6bb4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/68d6bb4736b75cf1850c6f21b8ef2aa2e059f51b) Thanks [@vicb](https://github.com/vicb)! - `patchNextMinimal` is no more required with the latest `@opennextjs/aws` bump

- [#559](https://github.com/opennextjs/opennextjs-cloudflare/pull/559) [`b002d80`](https://github.com/opennextjs/opennextjs-cloudflare/commit/b002d801d6280b3596ab29d4ceac08a757ea4098) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: `upload` command for worker versions'

- [#574](https://github.com/opennextjs/opennextjs-cloudflare/pull/574) [`d310919`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d310919aed46d13f0010426b03e948e1726d6d50) Thanks [@vicb](https://github.com/vicb)! - bump @opennextjs/aws to 3.5.7

- [#564](https://github.com/opennextjs/opennextjs-cloudflare/pull/564) [`6343fb4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6343fb49c62cd939d5220ce9c63425a5239eb2aa) Thanks [@conico974](https://github.com/conico974)! - bump @opennextjs/aws to 3.5.6

## 1.0.0-beta.2

### Changes

- [#546](https://github.com/opennextjs/opennextjs-cloudflare/pull/546) [`9adc3a3`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9adc3a3b6ca7d75d868523024491800fe25f3e06) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: populate kv incremental cache

- [#547](https://github.com/opennextjs/opennextjs-cloudflare/pull/547) [`25ade6f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/25ade6f7edf6a48336058c2c5e2fdf7ec0d9b7c6) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: static assets incremental cache

## 1.0.0-beta.1

### Changes

- [#541](https://github.com/opennextjs/opennextjs-cloudflare/pull/541) [`ca7df8e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ca7df8eb30f4c0414c700bd905ebfed6346e64b1) Thanks [@vicb](https://github.com/vicb)! - bump `@opennextjs/aws` to 3.5.5

- [#536](https://github.com/opennextjs/opennextjs-cloudflare/pull/536) [`8abea36`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8abea3634adc1079338c9759b9df57bc06604323) Thanks [@vicb](https://github.com/vicb)! - Fix R2 bucket population

- [#540](https://github.com/opennextjs/opennextjs-cloudflare/pull/540) [`f46fcae`](https://github.com/opennextjs/opennextjs-cloudflare/commit/f46fcaeab4382c4efb5f070e72f7c537bbd54a12) Thanks [@vicb](https://github.com/vicb)! - test: sync e2e with aws

## 1.0.0-beta.0

### Minor Changes

- [#526](https://github.com/opennextjs/opennextjs-cloudflare/pull/526) [`8b40268`](https://github.com/opennextjs/opennextjs-cloudflare/commit/8b40268a328f43ee7dfc8fc68bcf14badc0650ca) Thanks [@vicb](https://github.com/vicb)! - Prepare for release 1.0.0-beta.0

  Bump `@opennextjs/aws` to 3.5.4

  BREAKING CHANGES

  - `DurableObjectQueueHandler` renamed to `DOQueueHandler`
  - `NEXT_CACHE_DO_QUEUE_MAX_NUM_REVALIDATIONS` renamed to `NEXT_CACHE_DO_QUEUE_MAX_RETRIES`
  - `D1TagCache` has been removed, use `D1NextModeTagCache` instead.
  - The `enableShardReplication` and `shardReplicationOptions` options passed to `ShardedDOTagCache`
    have been folded into `shardReplication`. A value for `shardReplication` must be specified to enable
    replications. The value must be an object with the number of soft and hard replicas.

## 0.6.6

### Patch Changes

- [#520](https://github.com/opennextjs/opennextjs-cloudflare/pull/520) [`3bd200a`](https://github.com/opennextjs/opennextjs-cloudflare/commit/3bd200a3ef9a85856a7004395aa7b27b6069b8ee) Thanks [@vicb](https://github.com/vicb)! - Define `process.version` and `process.versions.node`

- [#522](https://github.com/opennextjs/opennextjs-cloudflare/pull/522) [`79fadc4`](https://github.com/opennextjs/opennextjs-cloudflare/commit/79fadc49d303052165c70800b785fd488fad4c41) Thanks [@vicb](https://github.com/vicb)! - Log exceptions in `requirePage` and `NodeModuleLoader` when `OPEN_NEXT_DEBUG=1`

- [#523](https://github.com/opennextjs/opennextjs-cloudflare/pull/523) [`19dedc7`](https://github.com/opennextjs/opennextjs-cloudflare/commit/19dedc75bfa805802cee0f0e727e6c5355c5c747) Thanks [@vicb](https://github.com/vicb)! - fix: process.env has a higher loading priority than .env files

- [#469](https://github.com/opennextjs/opennextjs-cloudflare/pull/469) [`aef8e51`](https://github.com/opennextjs/opennextjs-cloudflare/commit/aef8e517eba94fe5ece23427c410c0cad15b5917) Thanks [@Juuldamen](https://github.com/Juuldamen)! - Adds support for passing options to `initOpenNextCloudflareForDev()`. This allows you to configure how your Cloudflare bindings will behave during [local development](https://opennext.js.org/cloudflare/get-started#11-develop-locally).

  For example, the below configuration will persist the local state of bindings to a custom directory. Which can be useful if you want to share the state between different apps that reuse the same bindings in a monorepo.

  ```ts
  initOpenNextCloudflareForDev({
  	persist: {
  		path: "../../.wrangler/state/v3/custom-dir",
  	},
  });
  ```

  You can find the configuration type with it's available options [here](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/api/integrations/platform/index.ts#L32) in the Wrangler source code.

## 0.6.5

### Patch Changes

- [#514](https://github.com/opennextjs/opennextjs-cloudflare/pull/514) [`3165593`](https://github.com/opennextjs/opennextjs-cloudflare/commit/3165593eb9b47bf07aff2fc1561c6481e6b8715a) Thanks [@vicb](https://github.com/vicb)! - fix(middleware): enable wasm in bundled middleware

- [#515](https://github.com/opennextjs/opennextjs-cloudflare/pull/515) [`cef5e03`](https://github.com/opennextjs/opennextjs-cloudflare/commit/cef5e03177a1b8e31436394669efa35d3978bef5) Thanks [@vicb](https://github.com/vicb)! - perf: optimize SQL queries

## 0.6.4

### Patch Changes

- [#512](https://github.com/opennextjs/opennextjs-cloudflare/pull/512) [`96efdc1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/96efdc1191cbee3582d84af7293ee0aa83e36f09) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: yarn v4 not passing args to wrangler correctly

## 0.6.3

### Patch Changes

- [#509](https://github.com/opennextjs/opennextjs-cloudflare/pull/509) [`42e2b5c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/42e2b5c2eb4dda7ce9e46a2c6acb99799ce4228f) Thanks [@ItsWendell](https://github.com/ItsWendell)! - fix: nextjs handler not detected in worker

## 0.6.2

### Patch Changes

- [#505](https://github.com/opennextjs/opennextjs-cloudflare/pull/505) [`ce7516d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ce7516db9067f3f04f94bf2e59725b38efd6cf66) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: npm failing to pass args to wrangler

## 0.6.1

### Patch Changes

- [#503](https://github.com/opennextjs/opennextjs-cloudflare/pull/503) [`ba35663`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ba35663c36e22de76926b3edfba77a89d86c798e) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: bun failing to spawn wrangler

## 0.6.0

### Minor Changes

- [#499](https://github.com/opennextjs/opennextjs-cloudflare/pull/499) [`5037f57`](https://github.com/opennextjs/opennextjs-cloudflare/commit/5037f57208304055cc844e99708bbe7fc3c08c96) Thanks [@vicb](https://github.com/vicb)! - Refactor the codebase for consistency

  BREAKING CHANGE

  Overrides:

  Overrides now live in `@opennextjs/cloudflare/overrides` and some files have been renamed.

  - Incremental cache overrides: `@opennextjs/cloudflare/overrides/incremental-cache/...`
  - Tag cache overrides: `@opennextjs/cloudflare/overrides/tag-cache/...`
  - Queue overrides: `@opennextjs/cloudflare/overrides/queue/...`

  For example the KV incremental cache override can be imported as `@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache`.

  Environment variables and bindings name changes:

  - `NEXT_CACHE_WORKERS_KV` -> `NEXT_INC_CACHE_KV`
  - `NEXT_CACHE_R2_...` -> `NEXT_INC_CACHE_R2_...`
  - `NEXT_CACHE_D1` -> `NEXT_TAG_CACHE_D1`
  - `NEXT_CACHE_DO_...` -> `NEXT_TAG_CACHE_DO_...`
  - `NEXT_CACHE_DO_REVALIDATION` -> `NEXT_CACHE_DO_QUEUE`
  - `NEXT_CACHE_REVALIDATION_WORKER` -> `WORKER_SELF_REFERENCE`

  Other:

  `NEXT_CACHE_D1_TAGS_TABLE` and `NEXT_CACHE_D1_REVALIDATIONS_TABLE` have been dropped.
  The tables have a fixed names `tags` and `revalidations`.

- [#479](https://github.com/opennextjs/opennextjs-cloudflare/pull/479) [`0c93e8b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/0c93e8b3e22960553c6537b6e83b84cbd8724423) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: commands for cli actions

  The OpenNext Cloudflare CLI now uses the following commands;

  - `build`: build the application
  - `populateCache`: populate either the local or remote cache
  - `preview`: populate the local cache and start a dev server
  - `deploy`: populate the remote cache and deploy to production

- [#490](https://github.com/opennextjs/opennextjs-cloudflare/pull/490) [`00f6071`](https://github.com/opennextjs/opennextjs-cloudflare/commit/00f60716227a883d9c3138e3797aaba9bd8fed33) Thanks [@vicb](https://github.com/vicb)! - Drop the deprecated kvCache in favor of kv-cache

### Patch Changes

- [#487](https://github.com/opennextjs/opennextjs-cloudflare/pull/487) [`0702d2e`](https://github.com/opennextjs/opennextjs-cloudflare/commit/0702d2ea8b6480d358f750060e510b466bdf8fd5) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: support passing the wrangler environment when populating the cache

- [#480](https://github.com/opennextjs/opennextjs-cloudflare/pull/480) [`e0ec01d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e0ec01d50d3ae9f15294735f8fd28d84d29140ca) Thanks [@conico974](https://github.com/conico974)! - fix deduplication for memory queue and add some log

- [#481](https://github.com/opennextjs/opennextjs-cloudflare/pull/481) [`9b0db4d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9b0db4dcc4e84cac8f17043dbcd79b2ed7b91983) Thanks [@conico974](https://github.com/conico974)! - fix `res.revalidate` not working in page router api route

- [#484](https://github.com/opennextjs/opennextjs-cloudflare/pull/484) [`6ce5643`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6ce5643c1c37c98b36b2b594616907f8d35ee405) Thanks [@conico974](https://github.com/conico974)! - Add sharding replication for the Durable Object Tag Cache

- [#470](https://github.com/opennextjs/opennextjs-cloudflare/pull/470) [`2650043`](https://github.com/opennextjs/opennextjs-cloudflare/commit/26500437cd9e6cabf44f6308a124ca0687754bf8) Thanks [@conico974](https://github.com/conico974)! - feat: add a sharded SQLite Durable object implementation for the tag cache

- [#485](https://github.com/opennextjs/opennextjs-cloudflare/pull/485) [`ced7d46`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ced7d4639209fd45f34c5109de89a0671b5d1874) Thanks [@conico974](https://github.com/conico974)! - add an option for disabling sqlite on the durable object queue

- [#460](https://github.com/opennextjs/opennextjs-cloudflare/pull/460) [`60171f5`](https://github.com/opennextjs/opennextjs-cloudflare/commit/60171f58a2817acb2ecef4ea67a3a60ab522bc0d) Thanks [@conico974](https://github.com/conico974)! - feat: durable object de-duping revalidation queue

- [#497](https://github.com/opennextjs/opennextjs-cloudflare/pull/497) [`958f322`](https://github.com/opennextjs/opennextjs-cloudflare/commit/958f3223781753810baca287e49533ae12364d5e) Thanks [@vicb](https://github.com/vicb)! - Switch to bundled middleware

- [#436](https://github.com/opennextjs/opennextjs-cloudflare/pull/436) [`86c0139`](https://github.com/opennextjs/opennextjs-cloudflare/commit/86c0139535350f5806c27a665f6ec8fcfb96e398) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: auto-populating d1 cache data

- [#464](https://github.com/opennextjs/opennextjs-cloudflare/pull/464) [`acfc7f3`](https://github.com/opennextjs/opennextjs-cloudflare/commit/acfc7f35a387b84607674e93d8ef66db4e634669) Thanks [@conico974](https://github.com/conico974)! - Implement next mode for d1 tag cache that will reduce write

- [#486](https://github.com/opennextjs/opennextjs-cloudflare/pull/486) [`25a8f4c`](https://github.com/opennextjs/opennextjs-cloudflare/commit/25a8f4c82c71cbf0c3dedd79d9a4f52e012bc95e) Thanks [@conico974](https://github.com/conico974)! - auto create table for D1NextModeTagCache

- [#443](https://github.com/opennextjs/opennextjs-cloudflare/pull/443) [`54508ff`](https://github.com/opennextjs/opennextjs-cloudflare/commit/54508ffc613cc12d27e014c472632a59db7d7833) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: r2 adapter for the incremental cache

- [#491](https://github.com/opennextjs/opennextjs-cloudflare/pull/491) [`e9dc621`](https://github.com/opennextjs/opennextjs-cloudflare/commit/e9dc621bec7f7d532ee2855e4ef2b7155662c910) Thanks [@vicb](https://github.com/vicb)! - Serve `/cdn-cgi/image/...` images in dev

## 0.5.12

### Patch Changes

- [#467](https://github.com/opennextjs/opennextjs-cloudflare/pull/467) [`09c5116`](https://github.com/opennextjs/opennextjs-cloudflare/commit/09c51167d4e6327bd48081bc18a9adb70a70dd04) Thanks [@vicb](https://github.com/vicb)! - Update wrangler dependency

## 0.5.11

### Patch Changes

- [#455](https://github.com/opennextjs/opennextjs-cloudflare/pull/455) [`1d40ab1`](https://github.com/opennextjs/opennextjs-cloudflare/commit/1d40ab12e7c581d69a773d56885f10fa33f3b2b8) Thanks [@vicb](https://github.com/vicb)! - sync with `@opennextjs/aws@3.5.2`

- [#453](https://github.com/opennextjs/opennextjs-cloudflare/pull/453) [`95caa87`](https://github.com/opennextjs/opennextjs-cloudflare/commit/95caa87cd9f1880972f1657e2a7ab79daf86dc0a) Thanks [@vicb](https://github.com/vicb)! - fix: Pages router API routes with Next 14

- [#452](https://github.com/opennextjs/opennextjs-cloudflare/pull/452) [`161a5f7`](https://github.com/opennextjs/opennextjs-cloudflare/commit/161a5f7f53af0435576f44dc5c15df230c6a3090) Thanks [@vicb](https://github.com/vicb)! - fix: patch the webpack runtime when there is a single chunk

## 0.5.10

### Patch Changes

- [#445](https://github.com/opennextjs/opennextjs-cloudflare/pull/445) [`6a389fe`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6a389fe54b360e542e4db0266e29f0e818176651) Thanks [@james-elicx](https://github.com/james-elicx)! - fix: deployed worker unable to invoke itself in memory queue

  In deployments, Cloudflare Workers are unable to invoke workers on the same account via fetch, and the recommended way to call a worker is to use a service binding. This change switches to use service bindings for the memory queue to avoid issues with worker-to-worker subrequests.

  To continue using the memory queue, add a service binding to your wrangler config for the binding `NEXT_CACHE_REVALIDATION_WORKER`.

  ```json
  {
  	"services": [
  		{
  			"binding": "NEXT_CACHE_REVALIDATION_WORKER",
  			"service": "<WORKER_NAME>"
  		}
  	]
  }
  ```

## 0.5.9

### Patch Changes

- [#441](https://github.com/opennextjs/opennextjs-cloudflare/pull/441) [`4966779`](https://github.com/opennextjs/opennextjs-cloudflare/commit/4966779cabb9607eb59eae49e87d555323fdfaf1) Thanks [@conico974](https://github.com/conico974)! - Fix for `Invariant: renderHTML should not be called in minimal mode`

## 0.5.8

### Patch Changes

- [#431](https://github.com/opennextjs/opennextjs-cloudflare/pull/431) [`9ad6714`](https://github.com/opennextjs/opennextjs-cloudflare/commit/9ad67145ee718c67b94bbfcbc144a565b3fd0dae) Thanks [@HyperKiko](https://github.com/HyperKiko)! - fix pages api routes

  fixed pages api routes by inlining a dynamic require in the `NodeModuleLoader` class

## 0.5.7

### Patch Changes

- [#429](https://github.com/opennextjs/opennextjs-cloudflare/pull/429) [`1c80772`](https://github.com/opennextjs/opennextjs-cloudflare/commit/1c807722f848b1eee59ef6f8a107f8525d602ea9) Thanks [@vicb](https://github.com/vicb)! - fix import paths in templates

## 0.5.6

### Patch Changes

- [#412](https://github.com/opennextjs/opennextjs-cloudflare/pull/412) [`58b200f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/58b200fc1d4f2a4906c13f8268fc7612457861a7) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - add `defineCloudflareConfig` utility

  this change adds a new `defineCloudflareConfig` utility that developers can use in their `open-next.config.ts`
  file to easily generate a configuration compatible with the adapter

  Example usage:

  ```ts
  // open-next.config.ts
  import { defineCloudflareConfig } from "@opennextjs/cloudflare";
  import kvIncrementalCache from "@opennextjs/cloudflare/kv-cache";

  export default defineCloudflareConfig({
  	incrementalCache: kvIncrementalCache,
  });
  ```

## 0.5.5

### Patch Changes

- [#417](https://github.com/opennextjs/opennextjs-cloudflare/pull/417) [`6d3291f`](https://github.com/opennextjs/opennextjs-cloudflare/commit/6d3291fdbdd9f0da4fcdabf4131b82288358b35f) Thanks [@vicb](https://github.com/vicb)! - define \_\_filename globally

- [#413](https://github.com/opennextjs/opennextjs-cloudflare/pull/413) [`01e2bfb`](https://github.com/opennextjs/opennextjs-cloudflare/commit/01e2bfb81f8decccce46f7d4e8427a39113814b5) Thanks [@ha1fstack](https://github.com/ha1fstack)! - improve windows support

## 0.5.4

### Patch Changes

- [#320](https://github.com/opennextjs/opennextjs-cloudflare/pull/320) [`ff2dd55`](https://github.com/opennextjs/opennextjs-cloudflare/commit/ff2dd55aa5645f9c54b064ced02719ff83321a04) Thanks [@james-elicx](https://github.com/james-elicx)! - feat: d1 adapter for the tag cache

- [#409](https://github.com/opennextjs/opennextjs-cloudflare/pull/409) [`a604c85`](https://github.com/opennextjs/opennextjs-cloudflare/commit/a604c8512c90921e90293c1e96a71926930234db) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - make sure that instrumentation files work

  currently [instrumentation files](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
  in applications built using the adapter are ignored, the changes here
  make sure that those are instead properly included in the applications

- [#410](https://github.com/opennextjs/opennextjs-cloudflare/pull/410) [`d30424b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/d30424baff219792a52e3b6c766398189be5f19e) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - remove `eval` calls introduced by `depd` wrapped functions

  Some dependencies of Next.js (`raw-body` and `send`) use `depd` to deprecate some of their functions,
  `depd` uses `eval` to generate a deprecated version of such functions, this causes `eval` warnings in
  the terminal even if these functions are never called, the changes here by patching the depd `wrapfunction`
  function so that it still retains the same type of behavior but without using `eval`

- [#404](https://github.com/opennextjs/opennextjs-cloudflare/pull/404) [`12d385d`](https://github.com/opennextjs/opennextjs-cloudflare/commit/12d385d84ff0ab7e3475cd9fea01d03b6876c46d) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - fix incorrect (sync) `getCloudflareContext` error message

  currently `getCloudflareContext` run in sync mode at the top level of a not static route
  gives a misleading error message saying that the function needs to be run in a not static
  route, the changes here correct this error message clarifying that the problem actually is

## 0.5.3

### Patch Changes

- [#394](https://github.com/opennextjs/opennextjs-cloudflare/pull/394) [`1479263`](https://github.com/opennextjs/opennextjs-cloudflare/commit/147926323ea98ab44151feb7db36b47722dcc8cc) Thanks [@vicb](https://github.com/vicb)! - fix: improve windows support

## 0.5.2

### Patch Changes

- [#372](https://github.com/opennextjs/opennextjs-cloudflare/pull/372) [`522076b`](https://github.com/opennextjs/opennextjs-cloudflare/commit/522076b2972c4e7038f38dc20c2c7a25855d479e) Thanks [@dario-piotrowicz](https://github.com/dario-piotrowicz)! - add "async mode" to `getCloudflareContext`

  Add an `async` option to `getCloudflareContext({async})` to run it in "async mode", the difference being that the returned value is a
  promise of the Cloudflare context instead of the context itself

  The main of this is that it allows the function to also run during SSG (since the missing context can be created on demand).

## 0.5.1

### Patch Changes

- ad895ed: fix: vercel og patch not moving to right node_modules directory

  There are two separate places where the node_modules could be. One is a package-scoped node_modules which does not always exist - if it doesn't exist, the server functions-scoped node_modules is used.

## 0.5.0

### Minor Changes

- 82bb588: feat: basic in-memory de-duping revalidation queue

### Patch Changes

- 2e48d4f: fix: make sure that fetch cache `set`s are properly awaited

  Next.js does not await promises that update the incremental cache for fetch requests,
  that is needed in our runtime otherwise the cache updates get lost, so this change
  makes sure that the promise is properly awaited via `waitUntil`

- 0c26049: fix path to file template in `open-next.config.ts`.

## 0.4.8

### Patch Changes

- ac8b271: fix waitUntil

  Calling `waitUntil`/`after` was failing when mulitple requests were handled concurrently.
  This is fixed by pulling opennextjs/opennextjs-aws#733

- 761a312: import `randomUUID` from `node:crypto` to support NodeJS 18

## 0.4.7

### Patch Changes

- 420b598: Fix asset cache path
- a19b34d: perf: reduce CPU and memory usage by limiting code to AST parsing
- f30a5fe: bump `@opennextjs/aws` dependency to `https://pkg.pr.new/@opennextjs/aws@727`
- 6791cea: Use kebab-case for the KV Cache.
- a630aea: fix: enable using the `direct` queue for isr

  The `direct` mode is not recommended for use in production as it does not de-dupe requests.

- f30a5fe: Fix: make sure that the kvCache doesn't serve stale cache values from assets when there is no KV binding

## 0.4.6

### Patch Changes

- 9561277: fix: remove dynamic require for map file

  ESBuild tries to load all files in the chunks folder with `require("./chunks/" + var)`.
  This is an error when the folder contains map file.

## 0.4.5

### Patch Changes

- 1ccff65: bump `@opennextjs/aws` dependency to `https://pkg.pr.new/@opennextjs/aws@724`

  this bump fixes rewrites to external urls not working when the external urls
  point to resources hosted on the Cloudflare network

- 30374b9: fix: Drop the module condition from ESBuild

  Because Next (via nft) does not use the module condition, ESBuild should not use it.
  Otherwise we might end up with missing files and a broken build.

## 0.4.4

### Patch Changes

- 6103547: fix: provide a proper error message when using `getCloudflareContext` in static routes

  `getCloudflareContext` can't be used in static routes, currently a misleading error
  message incorrectly tells the developer that they haven't called `initOpenNextCloudflareForDev`
  in their config file, this change updates such error message to properly clarify what
  the issue is (and how to solve it)

- 0a6191d: fix the encoding of \_\_NEXT_PRIVATE_STANDALONE_CONFIG
- da7f8d8: fix: enable PPR with `wrangler dev`
- 714172d: fix: trailing slash redirect
- 0892679: fix: inline optional dependencies when bundling the server

## 0.4.3

### Patch Changes

- 9d45ee8: fix the error message of getCloudflareContext

  Hardcode function names that would get mangled otherwise.

- ac52954: bump the `wrangler` peer dependency (so to avoid multiple `Using vars defined in .dev.vars` logs during local development)

## 0.4.2

### Patch Changes

- 1b3a972: Dump ESBuild metadata to `handler.mjs.meta.json`

  The ESBuild metadata are written to a file alongside `handler.mjs`
  in `.open-next/server-functions/default/...`

- 5c90521: refactor: Make the list of optional dependencies configurable
- 67acb2f: fix build issues with `@opentelemetry`

  By using the pre-compiled library provided by Next.

- 3ed6cd1: fix: syntax error

## 0.4.1

### Patch Changes

- 1a2b815: fix: make sure that the `initOpenNextCloudflareForDev()` logic runs only once

  Currently calling `initOpenNextCloudflareForDev()` in the Next.js config file causes
  this initialization logic to run twice, consuming more resources and causing extra
  noise in the terminal logs, this change makes sure that the initialization logic
  is run only once instead

## 0.4.0

### Minor Changes

- 8de2c04: introduce new `initOpenNextCloudflareForDev` utility and make `getCloudflareContext` synchronous

  this change introduces a new `initOpenNextCloudflareForDev` function that must called in the [Next.js config file](https://nextjs.org/docs/app/api-reference/config/next-config-js) to integrate the Next.js dev server with the open-next Cloudflare adapter.

  Also makes `getCloudflareContext` synchronous.

  Additionally the `getCloudflareContext` can now work during local development (`next dev`) in the edge runtime (including middlewares).

  Moving forward we'll recommend that all applications include the use of the `initOpenNextCloudflareForDev` utility in their config file (there is no downside in doing so and it only effect local development).

  Example:

  ```js
  // next.config.mjs

  import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

  initOpenNextCloudflareForDev();

  /** @type {import('next').NextConfig} */
  const nextConfig = {};

  export default nextConfig;
  ```

### Patch Changes

- 4ec334a: fix: @vercel/og failing due to using the node version.

  Patches usage of the @vercel/og library to require the edge runtime version, and enables importing of the fallback font.

## 0.3.10

### Patch Changes

- 48f863f: fix: do not require `caniuse-lite`

  `caniuse-lite` is an optional dependency.

- 27ab1ab: refactor: use the new regex utility for constructing cross-platform paths

## 0.3.9

### Patch Changes

- 67fafeb: fix top level awaits not working in middlewares by bumping the `@opennextjs/aws` package

## 0.3.8

### Patch Changes

- 05ee8d4: fix: invalid paths in windows bundles.

## 0.3.7

### Patch Changes

- 41c55a8: Add support for specifying wrangler environment when using next dev so that bindings and vars are properly loaded. This can be specified with the env variable NEXT_DEV_WRANGLER_ENV.
- 2e13de2: fix broken `patchRequireReactDomServerEdge` patch

## 0.3.6

### Patch Changes

- 9ab86d4: fix: host not included in route handler urls

  Next.js was unable to re-construct the correct URLs for the request in a route handler due to being unable to retrieve the hostname. This was due to the internal Next.js option `trustHostHeader` being disabled in OpenNext when there is external middleware - this option is needed for the Next.js server in our environment.

## 0.3.5

### Patch Changes

- 77e31d5: update the `patchExceptionBubbling` patch
- dbcc4be: patch `require("react-dom/server.edge")` calls in `pages.runtime.prod.js` so that they are `try-catch`ed
- 632a7d7: show error on Next.js versions older than v14

## 0.3.4

### Patch Changes

- d488d86: fix: exclude `.env.local` files for `test` mode

  Aligns with the Next.js behavior of not extracting variables from the `.env.local` file in test environments.

- 0ee77b2: fix the city header encoding

  By pulling <https://github.com/opennextjs/opennextjs-aws/pull/688>

- 4b6a50b: check and create a `wrangler.json` file for the user in case a `wrangler.(toml|json|jsonc)` file is not already present

  also introduce a new `--skipWranglerConfigCheck` cli flag and a `SKIP_WRANGLER_CONFIG_CHECK`
  environment variable that allows users to opt out of the above check (since developers might
  want to use custom locations for their config files)

- 7654867: bump `"@opennextjs/aws` dependency to `https://pkg.pr.new/@opennextjs/aws@686`

## 0.3.3

### Patch Changes

- b3949ce: fix: delete init.cache rather than assign undefined

  Assigning undefined to init.cache throws when using NextAuth

- 12a1f75: update location of output path in success message

## 0.3.2

### Patch Changes

- c0c1d04: fix: CustomRequest instantiation

  In some cases some request properties would not be initialized (i.e. method, headers, ...)
  The bug was caused by the processing the init in the CustomRequest class.
  The bug was tigerred when using clerk.

## 0.3.1

### Patch Changes

- f60a326: fix: cleanup dependencies

## 0.3.0

### Minor Changes

- ca2d452: feat: rename the binary from "cloudflare" to "opennextjs-cloudflare"

  **BREAKING CHANGE**:
  After this change the old way of running the tool (e.g. `pnpm cloudflare`) no longer works.
  Going forward use the new binary name (e.g. `pnpm opennextjs-cloudflare`).

  See [#161](https://github.com/opennextjs/opennextjs-cloudflare/issues/161)

- Add support for middleware, loading `.env*` files, ...

## 0.2.1

### Patch Changes

- 5bceecc: example: Add vercel blog starter

  Update the examples with vercel blog starter and adapt it to run on cf workers

## 0.2.0

### Minor Changes

- 6acf0fd: feat: cli arg to disable minification

  The cache handler currently forces minification. There is now a CLI arg to disable minification for the build. At the moment, this only applies to the cache handler but may be used for other parts of the build in the future when minification is introduced to them. By default, minification is enabled, but can be disabled by passing `--noMinify`.

## 0.1.1

### Patch Changes

- 66ba0ff: enhancement: Expand missing next.config error message

  Found out that next dev can run the a Next.js app without next.config but
  if we are using the adapter we throw an error if we don't find the config.
  So expanded the error for users.

## 0.1.0

### Minor Changes

- 87f4fb5: feat: configure kv binding name with env var

  The Workers KV binding used in the Next.js cache handler can be given a custom name with the `__OPENNEXT_KV_BINDING_NAME` environment variable at build-time, instead of defaulting to `NEXT_CACHE_WORKERS_KV`.

### Patch Changes

- 83abcfe: refactor: retrieve cache handler kv instance inside constructor

  The cache handler was retrieving it's KV instance as a static property on the class that was defined at some point during the execution of the Next.js server. This moves the retrieval of the KV instance to happen inside the constructor for the class, so that it is retrieved during instantiation instead.

## 0.0.3

### Patch Changes

- a99cd1e: ci: actually publish updates packages to npm

## 0.0.2

### Patch Changes

- ce8a281: ci: first deployment via changesets
