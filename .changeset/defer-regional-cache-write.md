---
"@opennextjs/cloudflare": patch
---

fix: defer regional cache writes so they do not block the response

Next.js awaits `incrementalCache.set` while producing the response, which put the R2
write on the critical path. The returned value is unused, so the writes now run in
`ctx.waitUntil` — matching how the read path already defers its cache updates.
