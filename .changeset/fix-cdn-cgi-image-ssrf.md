---
"@opennextjs/cloudflare": patch
---

fix: add remotePatterns validation to /cdn-cgi/image/ handler

The `handleCdnCgiImageRequest()` handler now validates remote URLs against the
configured `remotePatterns` before fetching, matching the behavior of
`handleImageRequest()`. This provides defense-in-depth against SSRF in case
`/cdn-cgi/image/` requests reach the worker through non-edge paths (e.g.,
service binding calls). The validation is only applied when `remotePatterns`
are configured, preserving existing development behavior.

Related: CVE-2026-3125 (GHSA-c7mq-gh6q-6q7c)
