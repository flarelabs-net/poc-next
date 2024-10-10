# Deploy Next.js apps to Cloudflare

[OpenNext for Cloudflare](https://opennext.js.org/cloudflare) is an adapter that enables the deployment of Next.js applications to Cloudflare's developer platform.

This monorepo includes a package for adapting a Next.js application built via `next build` (in standalone mode) to run in the Cloudflare workerd runtime using the [Workers Node.js compatibility layer](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).

## Get started

Visit the [OpenNext docs](https://opennext.js.org/cloudflare/get-started) for instructions on starting a new project, or migrating an existing one.

## Contributing

### The repository

The repository contains two directories:

- `packages` containing a cloudflare package that can be used to build a Cloudflare Workers-compatible output for Next.js applications.
- `examples` containing Next.js applications that use the above mentioned cloudflare package.

### How to try out/develop in the repository

See the [CONTRIBUTING](./CONTRIBUTING.md) page for how to get started with this repository.
