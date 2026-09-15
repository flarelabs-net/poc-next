---
"@opennextjs/cloudflare": patch
---

fix: declare esbuild as runtime dependency

esbuild is imported at build time by the Cloudflare adapter but was only in devDependencies, so consumers relied on hoisting from @opennextjs/aws. Add it to dependencies so builds work under npm ci and with hoist conflicts.
