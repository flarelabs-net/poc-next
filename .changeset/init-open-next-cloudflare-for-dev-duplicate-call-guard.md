---
"@opennextjs/cloudflare": patch
---

fix: throw a user-actionable error when `initOpenNextCloudflareForDev` is called more than once in the same process

Calling `initOpenNextCloudflareForDev` twice in the Next.js config file used to spawn two competing miniflare instances and fail with an obscure workerd `SQLITE_BUSY` error. The function now tracks its own invocation and throws an error that points the user at the config file the moment the second call happens, instead of letting the failure surface deep inside the Workers runtime.

Closes #1251
