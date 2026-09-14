import { patchCode } from "@opennextjs/aws/build/patch/astCodePatcher.js";
import { describe, expect, test } from "vitest";

import { computePatchDiff } from "../../utils/test-patch.js";
import {
	attachRequestMetaRule,
	buildIdRule,
	createCacheHandlerRule,
	createComposableCacheHandlersRule,
	disableNodeMiddlewareRule,
} from "./next-server.js";

describe("Next Server", () => {
	const next15ServerCode = `
class NextNodeServer extends _baseserver.default {
    constructor(options){
        // Initialize super class
        super(options);
        this.handleNextImageRequest = async (req, res, parsedUrl) => { /* ... */ };
    }
    async handleUpgrade() {
    // The web server does not support web sockets, it's only used for HMR in
    // development.
    }
    loadEnvConfig({ dev, forceReload, silent }) {
        (0, _env.loadEnvConfig)(this.dir, dev, silent ? {
            info: ()=>{},
            error: ()=>{}
        } : _log, forceReload);
    }
    async hasPage(pathname) {
        var _this_nextConfig_i18n;
        return !!(0, _require.getMaybePagePath)(pathname, this.distDir, (_this_nextConfig_i18n = this.nextConfig.i18n) == null ? void 0 : _this_nextConfig_i18n.locales, this.enabledDirectories.app);
    }
    getBuildId() {
        const buildIdFile = (0, _path.join)(this.distDir, _constants.BUILD_ID_FILE);
        try {
            return _fs.default.readFileSync(buildIdFile, "utf8").trim();
        } catch (err) {
            if (err.code === "ENOENT") {
                throw new Error(\`Could not find a production build in the '\${this.distDir}' directory. Try building your app with 'next build' before starting the production server. https://nextjs.org/docs/messages/production-start-no-build-id\`);
            }
            throw err;
        }
    }
    getMiddlewareManifest() {
        if (this.minimalMode) return null;
        const manifest = require(this.middlewareManifestPath);
        return manifest;
    }
    async loadCustomCacheHandlers() {
        const { cacheHandlers } = this.nextConfig.experimental;
        if (!cacheHandlers) return;
        // If we've already initialized the cache handlers interface, don't do it
        // again.
        if (!(0, _handlers.initializeCacheHandlers)()) return;
        for (const [kind, handler] of Object.entries(cacheHandlers)){
            if (!handler) continue;
            (0, _handlers.setCacheHandler)(kind, (0, _interopdefault.interopDefault)(await dynamicImportEsmDefault((0, _formatdynamicimportpath.formatDynamicImportPath)(this.distDir, handler))));
        }
    }
    async getIncrementalCache({ requestHeaders, requestProtocol }) {
        const dev = !!this.renderOpts.dev;
        let CacheHandler;
        const { cacheHandler } = this.nextConfig;
        if (cacheHandler) {
            CacheHandler = (0, _interopdefault.interopDefault)(await dynamicImportEsmDefault((0, _formatdynamicimportpath.formatDynamicImportPath)(this.distDir, cacheHandler)));
        }
        await this.loadCustomCacheHandlers();
        // incremental-cache is request specific
        // although can have shared caches in module scope
        // per-cache handler
        return new _incrementalcache.IncrementalCache({
            fs: this.getCacheFilesystem(),
            dev,
            requestHeaders,
            requestProtocol,
            allowedRevalidateHeaderKeys: this.nextConfig.experimental.allowedRevalidateHeaderKeys,
            minimalMode: this.minimalMode,
            serverDistDir: this.serverDistDir,
            fetchCacheKeyPrefix: this.nextConfig.experimental.fetchCacheKeyPrefix,
            maxMemoryCacheSize: this.nextConfig.cacheMaxMemorySize,
            flushToDisk: !this.minimalMode && this.nextConfig.experimental.isrFlushToDisk,
            getPrerenderManifest: ()=>this.getPrerenderManifest(),
            CurCacheHandler: CacheHandler
        });
    }
    getEnabledDirectories(dev) {
        const dir = dev ? this.dir : this.serverDistDir;
        return {
            app: (0, _findpagesdir.findDir)(dir, "app") ? true : false,
            pages: (0, _findpagesdir.findDir)(dir, "pages") ? true : false
        };
    }
    async loadNodeMiddleware() {
        if (!process.env.NEXT_MINIMAL) {
            try {
                var _functionsConfig_functions;
                const functionsConfig = this.renderOpts.dev ? {} : require((0, _path.join)(this.distDir, 'server', _constants.FUNCTIONS_CONFIG_MANIFEST));
                if (this.renderOpts.dev || (functionsConfig == null ? void 0 : (_functionsConfig_functions = functionsConfig.functions) == null ? void 0 : _functionsConfig_functions['/_middleware'])) {
                    // if used with top level await, this will be a promise
                    return require((0, _path.join)(this.distDir, 'server', 'middleware.js'));
                }
            } catch (err) {
                if ((0, _iserror.default)(err) && err.code !== 'ENOENT' && err.code !== 'MODULE_NOT_FOUND') {
                    throw err;
                }
            }
        }
    }
    getPrerenderManifest() {
        var _this_renderOpts, _this_serverOptions;
        if (this._cachedPreviewManifest) {
            return this._cachedPreviewManifest;
        }
        if (((_this_renderOpts = this.renderOpts) == null ? void 0 : _this_renderOpts.dev) || ((_this_serverOptions = this.serverOptions) == null ? void 0 : _this_serverOptions.dev) || process.env.NODE_ENV === 'development' || process.env.NEXT_PHASE === _constants.PHASE_PRODUCTION_BUILD) {
            this._cachedPreviewManifest = {
                version: 4,
                routes: {},
                dynamicRoutes: {},
                notFoundRoutes: [],
                preview: {
                    previewModeId: require('crypto').randomBytes(16).toString('hex'),
                    previewModeSigningKey: require('crypto').randomBytes(32).toString('hex'),
                    previewModeEncryptionKey: require('crypto').randomBytes(32).toString('hex')
                }
            };
            return this._cachedPreviewManifest;
        }
        this._cachedPreviewManifest = (0, _loadmanifest.loadManifest)((0, _path.join)(this.distDir, _constants.PRERENDER_MANIFEST));
        return this._cachedPreviewManifest;
    }
    getRoutesManifest() {
        return (0, _tracer.getTracer)().trace(_constants2.NextNodeServerSpan.getRoutesManifest, ()=>{
            const manifest = (0, _loadmanifest.loadManifest)((0, _path.join)(this.distDir, _constants.ROUTES_MANIFEST));
            let rewrites = manifest.rewrites ?? {
                beforeFiles: [],
                afterFiles: [],
                fallback: []
            };
            if (Array.isArray(rewrites)) {
                rewrites = {
                    beforeFiles: [],
                    afterFiles: rewrites,
                    fallback: []
                };
            }
            return {
                ...manifest,
                rewrites
            };
        });
    }
    attachRequestMeta(req, parsedUrl, isUpgradeReq) {
        var _req_headers_xforwardedproto;
        // Injected in base-server.ts
        const protocol = ((_req_headers_xforwardedproto = req.headers['x-forwarded-proto']) == null ? void 0 : _req_headers_xforwardedproto.includes('https')) ? 'https' : 'http';
        // When there are hostname and port we build an absolute URL
        const initUrl = this.fetchHostname && this.port ? \`\${protocol}://\${this.fetchHostname}:\${this.port}\${req.url}\` : this.nextConfig.experimental.trustHostHeader ? \`https://\${req.headers.host || "localhost"}\${req.url}\` : req.url;
        (0, _requestmeta.addRequestMeta)(req, 'initURL', initUrl);
        (0, _requestmeta.addRequestMeta)(req, 'initQuery', {
            ...parsedUrl.query
        });
        (0, _requestmeta.addRequestMeta)(req, 'initProtocol', protocol);
        if (!isUpgradeReq) {
            (0, _requestmeta.addRequestMeta)(req, 'clonableBody', (0, _bodystreams.getCloneableBody)(req.originalRequest));
        }
    }
    // ...
}`;

	const next16ServerCode = `
class NextNodeServer extends _baseserver.default {
    // ...

    async loadCustomCacheHandlers() {
        const { cacheMaxMemorySize, cacheHandlers } = this.nextConfig;
        if (!cacheHandlers) return;
        // If we've already initialized the cache handlers interface, don't do it
        // again.
        if (!(0, _handlers.initializeCacheHandlers)(cacheMaxMemorySize)) return;
        for (const [kind, handler] of Object.entries(cacheHandlers)){
            if (!handler) continue;
            (0, _handlers.setCacheHandler)(kind, (0, _interopdefault.interopDefault)(await dynamicImportEsmDefault((0, _formatdynamicimportpath.formatDynamicImportPath)(this.distDir, handler))));
        }
    }
    // ...
}
`;

	test("build ID", () => {
		expect(computePatchDiff("next-server.js", next15ServerCode, buildIdRule)).toMatchInlineSnapshot(`
      "Index: next-server.js
      ===================================================================
      --- next-server.js
      +++ next-server.js
      @@ -1,5 +1,4 @@
      -
       class NextNodeServer extends _baseserver.default {
           constructor(options){
               // Initialize super class
               super(options);
      @@ -19,18 +18,10 @@
               var _this_nextConfig_i18n;
               return !!(0, _require.getMaybePagePath)(pathname, this.distDir, (_this_nextConfig_i18n = this.nextConfig.i18n) == null ? void 0 : _this_nextConfig_i18n.locales, this.enabledDirectories.app);
           }
           getBuildId() {
      -        const buildIdFile = (0, _path.join)(this.distDir, _constants.BUILD_ID_FILE);
      -        try {
      -            return _fs.default.readFileSync(buildIdFile, "utf8").trim();
      -        } catch (err) {
      -            if (err.code === "ENOENT") {
      -                throw new Error(\`Could not find a production build in the '\${this.distDir}' directory. Try building your app with 'next build' before starting the production server. https://nextjs.org/docs/messages/production-start-no-build-id\`);
      -            }
      -            throw err;
      -        }
      -    }
      +  return process.env.NEXT_BUILD_ID;
      +}
           getMiddlewareManifest() {
               if (this.minimalMode) return null;
               const manifest = require(this.middlewareManifestPath);
               return manifest;
      "
    `);
	});

	test("cache handler", () => {
		expect(computePatchDiff("next-server.js", next15ServerCode, createCacheHandlerRule("manifest")))
			.toMatchInlineSnapshot(`
      "Index: next-server.js
      ===================================================================
      --- next-server.js
      +++ next-server.js
      @@ -1,5 +1,4 @@
      -
       class NextNodeServer extends _baseserver.default {
           constructor(options){
               // Initialize super class
               super(options);
      @@ -48,9 +47,10 @@
           }
           async getIncrementalCache({ requestHeaders, requestProtocol }) {
               const dev = !!this.renderOpts.dev;
               let CacheHandler;
      -        const { cacheHandler } = this.nextConfig;
      +        const cacheHandler = null;
      +CacheHandler = require('manifest').default;
               if (cacheHandler) {
                   CacheHandler = (0, _interopdefault.interopDefault)(await dynamicImportEsmDefault((0, _formatdynamicimportpath.formatDynamicImportPath)(this.distDir, cacheHandler)));
               }
               await this.loadCustomCacheHandlers();
      "
    `);
	});

	test("composable cache handler (Next 15)", () => {
		expect(
			computePatchDiff("next-server.js", next15ServerCode, createComposableCacheHandlersRule("manifest"))
		).toMatchInlineSnapshot(`
			"Index: next-server.js
			===================================================================
			--- next-server.js
			+++ next-server.js
			@@ -1,5 +1,4 @@
			-
			 class NextNodeServer extends _baseserver.default {
			     constructor(options){
			         // Initialize super class
			         super(options);
			@@ -35,18 +34,16 @@
			         const manifest = require(this.middlewareManifestPath);
			         return manifest;
			     }
			     async loadCustomCacheHandlers() {
			-        const { cacheHandlers } = this.nextConfig.experimental;
			-        if (!cacheHandlers) return;
			-        // If we've already initialized the cache handlers interface, don't do it
			-        // again.
			-        if (!(0, _handlers.initializeCacheHandlers)()) return;
			-        for (const [kind, handler] of Object.entries(cacheHandlers)){
			-            if (!handler) continue;
			-            (0, _handlers.setCacheHandler)(kind, (0, _interopdefault.interopDefault)(await dynamicImportEsmDefault((0, _formatdynamicimportpath.formatDynamicImportPath)(this.distDir, handler))));
			-        }
			-    }
			+  const handlersSymbol = Symbol.for('@next/cache-handlers');
			+  const handlersMapSymbol = Symbol.for('@next/cache-handlers-map');
			+  const handlersSetSymbol = Symbol.for('@next/cache-handlers-set');
			+  globalThis[handlersMapSymbol] = new Map();
			+  globalThis[handlersMapSymbol].set("default", require('manifest').default);
			+  globalThis[handlersMapSymbol].set("remote", require('manifest').default);
			+  globalThis[handlersSetSymbol] = new Set(globalThis[handlersMapSymbol].values());
			+}
			     async getIncrementalCache({ requestHeaders, requestProtocol }) {
			         const dev = !!this.renderOpts.dev;
			         let CacheHandler;
			         const { cacheHandler } = this.nextConfig;
			"
		`);
	});

	test("composable cache handler (Next 16)", () => {
		expect(
			computePatchDiff("next-server.js", next16ServerCode, createComposableCacheHandlersRule("manifest"))
		).toMatchInlineSnapshot(`
			"Index: next-server.js
			===================================================================
			--- next-server.js
			+++ next-server.js
			@@ -1,17 +1,14 @@
			-
			 class NextNodeServer extends _baseserver.default {
			     // ...
			 
			     async loadCustomCacheHandlers() {
			-        const { cacheMaxMemorySize, cacheHandlers } = this.nextConfig;
			-        if (!cacheHandlers) return;
			-        // If we've already initialized the cache handlers interface, don't do it
			-        // again.
			-        if (!(0, _handlers.initializeCacheHandlers)(cacheMaxMemorySize)) return;
			-        for (const [kind, handler] of Object.entries(cacheHandlers)){
			-            if (!handler) continue;
			-            (0, _handlers.setCacheHandler)(kind, (0, _interopdefault.interopDefault)(await dynamicImportEsmDefault((0, _formatdynamicimportpath.formatDynamicImportPath)(this.distDir, handler))));
			-        }
			-    }
			+  const handlersSymbol = Symbol.for('@next/cache-handlers');
			+  const handlersMapSymbol = Symbol.for('@next/cache-handlers-map');
			+  const handlersSetSymbol = Symbol.for('@next/cache-handlers-set');
			+  globalThis[handlersMapSymbol] = new Map();
			+  globalThis[handlersMapSymbol].set("default", require('manifest').default);
			+  globalThis[handlersMapSymbol].set("remote", require('manifest').default);
			+  globalThis[handlersSetSymbol] = new Set(globalThis[handlersMapSymbol].values());
			+}
			     // ...
			 }
			"
		`);
	});

	test("composable cache handler replaces the whole method body", () => {
		// Next.js 16.3 rebinds `cacheMaxMemorySize` into the same declaration as
		// `cacheHandlers` and the native body consumes both. Replacing only the
		// declaration left the surviving native body reading bindings that no longer
		// existed (ReferenceError at runtime once minified). Nothing native may
		// survive inside the patched method.
		for (const serverCode of [next15ServerCode, next16ServerCode]) {
			const patched = patchCode(serverCode, createComposableCacheHandlersRule("manifest"));
			const method = patched.match(/async loadCustomCacheHandlers\(\) \{\n([\s\S]*?)\n\}/)?.[1];
			expect(method).toBeDefined();

			expect(method).toContain("require('manifest').default");
			expect(method).not.toContain("initializeCacheHandlers");
			expect(method).not.toContain("cacheMaxMemorySize");
			expect(method).not.toContain("Object.entries");
			expect(method).not.toContain("formatDynamicImportPath");
			expect(method).not.toContain("dynamicImportEsmDefault");
		}
	});

	test("composable cache handler wires the registry when executed", async () => {
		const patched = patchCode(next16ServerCode, createComposableCacheHandlersRule("manifest"));
		const method = patched.match(/async loadCustomCacheHandlers\(\) \{\n([\s\S]*?)\n\}/);
		expect(method).not.toBeNull();

		const mapSymbol = Symbol.for("@next/cache-handlers-map");
		const setSymbol = Symbol.for("@next/cache-handlers-set");
		try {
			const NextNodeServer = new Function(
				"require",
				`class NextNodeServer {
  async loadCustomCacheHandlers() {
${method![1]}
  }
}
return NextNodeServer;`
			)((modulePath: string) => ({ default: modulePath })) as new () => {
				loadCustomCacheHandlers(): Promise<void>;
			};

			await new NextNodeServer().loadCustomCacheHandlers();

			expect(Reflect.get(globalThis, mapSymbol)).toEqual(
				new Map([
					["default", "manifest"],
					["remote", "manifest"],
				])
			);
			expect(Reflect.get(globalThis, setSymbol)).toEqual(new Set(["manifest"]));
		} finally {
			Reflect.deleteProperty(globalThis, mapSymbol);
			Reflect.deleteProperty(globalThis, setSymbol);
		}
	});

	test("disable node middleware", () => {
		expect(computePatchDiff("next-server.js", next15ServerCode, disableNodeMiddlewareRule))
			.toMatchInlineSnapshot(`
				"Index: next-server.js
				===================================================================
				--- next-server.js
				+++ next-server.js
				@@ -1,5 +1,4 @@
				-
				 class NextNodeServer extends _baseserver.default {
				     constructor(options){
				         // Initialize super class
				         super(options);
				@@ -79,23 +78,10 @@
				             pages: (0, _findpagesdir.findDir)(dir, "pages") ? true : false
				         };
				     }
				     async loadNodeMiddleware() {
				-        if (!process.env.NEXT_MINIMAL) {
				-            try {
				-                var _functionsConfig_functions;
				-                const functionsConfig = this.renderOpts.dev ? {} : require((0, _path.join)(this.distDir, 'server', _constants.FUNCTIONS_CONFIG_MANIFEST));
				-                if (this.renderOpts.dev || (functionsConfig == null ? void 0 : (_functionsConfig_functions = functionsConfig.functions) == null ? void 0 : _functionsConfig_functions['/_middleware'])) {
				-                    // if used with top level await, this will be a promise
				-                    return require((0, _path.join)(this.distDir, 'server', 'middleware.js'));
				-                }
				-            } catch (err) {
				-                if ((0, _iserror.default)(err) && err.code !== 'ENOENT' && err.code !== 'MODULE_NOT_FOUND') {
				-                    throw err;
				-                }
				-            }
				-        }
				-    }
				+  // patched by open next
				+}
				     getPrerenderManifest() {
				         var _this_renderOpts, _this_serverOptions;
				         if (this._cachedPreviewManifest) {
				             return this._cachedPreviewManifest;
				"
			`);
	});

	test("attachRequestMeta", () => {
		expect(computePatchDiff("next-server.js", next15ServerCode, attachRequestMetaRule))
			.toMatchInlineSnapshot(`
			"Index: next-server.js
			===================================================================
			--- next-server.js
			+++ next-server.js
			@@ -1,5 +1,4 @@
			-
			 class NextNodeServer extends _baseserver.default {
			     constructor(options){
			         // Initialize super class
			         super(options);
			@@ -143,9 +142,9 @@
			         // Injected in base-server.ts
			         const protocol = ((_req_headers_xforwardedproto = req.headers['x-forwarded-proto']) == null ? void 0 : _req_headers_xforwardedproto.includes('https')) ? 'https' : 'http';
			         // When there are hostname and port we build an absolute URL
			         const initUrl = this.fetchHostname && this.port ? \`\${protocol}://\${this.fetchHostname}:\${this.port}\${req.url}\` : this.nextConfig.experimental.trustHostHeader ? \`https://\${req.headers.host || "localhost"}\${req.url}\` : req.url;
			-        (0, _requestmeta.addRequestMeta)(req, 'initURL', initUrl);
			+        (0, _requestmeta.addRequestMeta)(req, 'initURL', req[Symbol.for("NextInternalRequestMeta")]?.initProtocol === "http:" && initUrl.startsWith("https://") ? \`http://\${initUrl.slice(8)}\`: initUrl);
			         (0, _requestmeta.addRequestMeta)(req, 'initQuery', {
			             ...parsedUrl.query
			         });
			         (0, _requestmeta.addRequestMeta)(req, 'initProtocol', protocol);
			"
		`);
	});
});
