---
"@opennextjs/cloudflare": patch
---

fix: replace the whole `loadCustomCacheHandlers` body so Next.js 16.3 chunks don't throw `ReferenceError`

Next.js 16.3 rewrote `loadCustomCacheHandlers`: the declaration that binds `cacheHandlers` now also binds
`cacheMaxMemorySize`, and the native method body consumes both. The composable cache patch replaced only that
declaration, so on the minified runtime chunks (`dist/compiled/next-server/*.runtime.prod.js`) the surviving
native code referenced bindings that were no longer declared. Every request to the Worker then failed with
`ReferenceError: <minified identifier> is not defined` inside `loadCustomCacheHandlers` (site-wide 500s on
Next.js 16.3.x), while builds stayed green because the unminified `next-server.js` short-circuits on
`if (!cacheHandlers) return` before the orphaned binding is read.

The patch now replaces the whole method body (the same shape as the node middleware patch) and wires the
composable cache registry to the static `require()` as before, so no native reference to a dropped binding
can survive. The rule still matches pre-16.3 chunks, so older Next.js versions are unaffected.
