---
"@opennextjs/cloudflare": patch
---

fix: treat 200 + non-REVALIDATED response as success in DO queue handler

`DOQueueHandler.executeRevalidation` previously threw `FatalError` when the HEAD self-fetch returned 200 with `x-nextjs-cache` other than `REVALIDATED`. This commonly happens under load when in-isolate stale-while-revalidate has already regenerated the page before the queued HEAD reaches the ISR handler — the page is fresh in cache but Next.js returns `HIT`/`STALE` rather than `REVALIDATED`. The handler now logs a debug message and falls through to the success path (sync table updated, failed state cleared). Addresses the `FatalError: ... cannot be done. This error should never happen.` reports.
