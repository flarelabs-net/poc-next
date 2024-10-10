---
"@opennextjs/cloudflare": minor
---

feat: cli arg to disable minification

The cache handler currently forces minification. There is now a CLI arg to disable minification for the build. At the moment, this only applies to the cache handler but may be used for other parts of the build in the future when minification is introduced to them.
