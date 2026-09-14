import type { BuildOptions } from "@opennextjs/aws/build/helper.js";
import {
	BaseOverride,
	LazyLoadedOverride,
	OpenNextConfig as AwsOpenNextConfig,
	type RoutePreloadingBehavior,
} from "@opennextjs/aws/types/open-next.js";
import type {
	CDNInvalidationHandler,
	IncrementalCache,
	Queue,
	TagCache,
} from "@opennextjs/aws/types/overrides.js";

import assetResolver from "./overrides/asset-resolver/index.js";

export type Override<T extends BaseOverride> = "dummy" | T | LazyLoadedOverride<T>;

/**
 * Cloudflare specific overrides.
 *
 * See the [Caching documentation](https://opennext.js.org/cloudflare/caching))
 */
export type CloudflareOverrides = {
	/**
	 * Sets the incremental cache implementation.
	 */
	incrementalCache?: Override<IncrementalCache>;

	/**
	 * Sets the tag cache implementation.
	 */
	tagCache?: Override<TagCache>;

	/**
	 * Sets the revalidation queue implementation
	 */
	queue?: "direct" | Override<Queue>;

	/**
	 * Sets the automatic cache purge implementation
	 */
	cachePurge?: Override<CDNInvalidationHandler>;

	/**
	 * Enable cache interception
	 * Should be `false` when PPR is used
	 * @default false
	 */
	enableCacheInterception?: boolean;

	/**
	 * Route preloading behavior.
	 * Using a value other than "none" can result in higher CPU usage on cold starts.
	 * @default "none"
	 */
	routePreloadingBehavior?: RoutePreloadingBehavior;
};

/**
 * Defines the OpenNext configuration that targets the Cloudflare adapter
 *
 * @param config options that enabled you to configure the application's behavior
 * @returns the OpenNext configuration object
 */
export function defineCloudflareConfig(config: CloudflareOverrides = {}): OpenNextConfig {
	const {
		incrementalCache,
		tagCache,
		queue,
		cachePurge,
		enableCacheInterception = false,
		routePreloadingBehavior = "none",
	} = config;

	return {
		default: {
			override: {
				wrapper: "cloudflare-node",
				converter: "edge",
				proxyExternalRequest: "fetch",
				incrementalCache: resolveIncrementalCache(incrementalCache),
				tagCache: resolveTagCache(tagCache),
				queue: resolveQueue(queue),
				cdnInvalidation: resolveCdnInvalidation(cachePurge),
			},
			routePreloadingBehavior,
		},
		// node:crypto is used to compute cache keys
		edgeExternals: ["node:crypto"],
		cloudflare: {
			useWorkerdCondition: true,
			sourcemap: false,
		},
		dangerous: {
			enableCacheInterception,
		},
		middleware: {
			external: true,
			override: {
				wrapper: "cloudflare-edge",
				converter: "edge",
				proxyExternalRequest: "fetch",
				incrementalCache: resolveIncrementalCache(incrementalCache),
				tagCache: resolveTagCache(tagCache),
				queue: resolveQueue(queue),
			},
			assetResolver: () => assetResolver,
		},
	};
}

function resolveIncrementalCache(value: CloudflareOverrides["incrementalCache"] = "dummy") {
	if (typeof value === "string") {
		return value;
	}

	return typeof value === "function" ? value : () => value;
}

function resolveTagCache(value: CloudflareOverrides["tagCache"] = "dummy") {
	if (typeof value === "string") {
		return value;
	}

	return typeof value === "function" ? value : () => value;
}

function resolveQueue(value: CloudflareOverrides["queue"] = "dummy") {
	if (typeof value === "string") {
		return value;
	}

	return typeof value === "function" ? value : () => value;
}

function resolveCdnInvalidation(value: CloudflareOverrides["cachePurge"] = "dummy") {
	if (typeof value === "string") {
		return value;
	}

	return typeof value === "function" ? value : () => value;
}

interface OpenNextConfig extends AwsOpenNextConfig {
	cloudflare?: {
		/**
		 * Whether to use the "workerd" build conditions when bundling the server.
		 * It is recommended to set it to `true` so that code specifically targeted to the
		 * workerd runtime is bundled.
		 *
		 * See https://esbuild.github.io/api/#conditions
		 *
		 * @default true
		 */
		useWorkerdCondition?: boolean;

		/**
		 * Whether to genereate a sourcemap for the bundled server.
		 *
		 *
		 * @default false
		 */
		sourcemap?: boolean;

		/**
		 * Disable throwing an error when the config validation fails.
		 * This is useful for overriding some of the default provided by cloudflare.
		 * **USE AT YOUR OWN RISK**
		 * @default false
		 */
		dangerousDisableConfigValidation?: boolean;

		/**
		 * Skew protection.
		 *
		 * Note: Skew Protection is experimental and might break on minor releases.
		 *
		 * @default false
		 */
		skewProtection?: {
			// Whether to enable skew protection
			enabled?: boolean;
			// Maximum number of versions to retrieve
			// @default 20
			maxNumberOfVersions?: number;
			// Maximum age of versions to retrieve in days
			// @default 7
			maxVersionAgeDays?: number;
		};
	};
}

/**
 * @param buildOpts build options from AWS
 * @returns The OpenConfig specific to cloudflare
 */
export function getOpenNextConfig(buildOpts: BuildOptions): OpenNextConfig {
	return buildOpts.config;
}

/**
 * @returns Unique deployment ID
 */
export function getDeploymentId(): string {
	return `dpl-${new Date().getTime().toString(36)}`;
}

export type { OpenNextConfig };
