---
"@opennextjs/cloudflare": patch
---

fix: use constant internal origin instead of req.headers.host in revalidation patch

The `res.revalidate()` patch now uses a constant internal origin (`https://self.local`)
instead of the user-controllable `req.headers.host` for the `WORKER_SELF_REFERENCE.fetch()`
URL. The service binding routes to the correct worker regardless of the URL host, so the
host value is only metadata. This eliminates host header injection without affecting
functionality.
