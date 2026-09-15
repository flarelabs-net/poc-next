import { error, warn } from "@opennextjs/aws/adapters/logger.js";

export type RemotePattern = {
	protocol?: "http" | "https";
	hostname: string;
	port?: string;
	// pathname is always set in the manifest (to `makeRe(pathname ?? '**', { dot: true }).source`)
	pathname: string;
	search?: string;
};

export type LocalPattern = {
	// pathname is always set in the manifest
	pathname: string;
	search?: string;
};

/**
 * Handles requests to /_next/image(/), including image optimizations.
 *
 * Image optimization is disabled and the original image is returned if `env.IMAGES` is undefined.
 *
 * Throws an exception on unexpected errors.
 *
 * @param requestURL
 * @param requestHeaders
 * @param env
 * @returns A promise that resolves to the resolved request.
 */
export async function handleImageRequest(
	requestURL: URL,
	requestHeaders: Headers,
	env: CloudflareEnv
): Promise<Response> {
	const parseResult = parseImageRequest(requestURL, requestHeaders);
	if (!parseResult.ok) {
		return new Response(parseResult.message, {
			status: 400,
		});
	}

	let imageResponse: Response;
	if (parseResult.url.startsWith("/")) {
		if (env.ASSETS === undefined) {
			error("env.ASSETS binding is not defined");
			return new Response('"url" parameter is valid but upstream response is invalid', {
				status: 404,
			});
		}
		const absoluteURL = new URL(parseResult.url, requestURL);
		imageResponse = await env.ASSETS.fetch(absoluteURL);
	} else {
		let fetchImageResult: FetchWithRedirectsResult;
		try {
			fetchImageResult = await fetchWithRedirects(parseResult.url, 7_000, __IMAGES_MAX_REDIRECTS__);
		} catch (e) {
			throw new Error("Failed to fetch image", { cause: e });
		}
		if (!fetchImageResult.ok) {
			if (fetchImageResult.error === "timed_out") {
				return new Response('"url" parameter is valid but upstream response timed out', {
					status: 504,
				});
			}
			if (fetchImageResult.error === "too_many_redirects") {
				return new Response('"url" parameter is valid but upstream response is invalid', {
					status: 508,
				});
			}
			throw new Error("Failed to fetch image");
		}
		imageResponse = fetchImageResult.response;
	}

	if (!imageResponse.ok || imageResponse.body === null) {
		return new Response('"url" parameter is valid but upstream response is invalid', {
			status: imageResponse.status,
		});
	}

	let immutable = false;
	if (parseResult.static) {
		immutable = true;
	} else {
		const cacheControlHeader = imageResponse.headers.get("Cache-Control");
		if (cacheControlHeader !== null) {
			// TODO: Properly parse header
			immutable = cacheControlHeader.includes("immutable");
		}
	}

	const readHeaderResult = await readImageHeader(imageResponse);
	if (readHeaderResult instanceof Response) {
		return readHeaderResult;
	}
	const { contentType, imageStream } = readHeaderResult;
	if (contentType === null) {
		warn(`Failed to detect content type of "${parseResult.url}"`);
		return new Response('"url" parameter is valid but image type is not allowed', {
			status: 400,
		});
	}
	if (contentType === SVG) {
		if (!__IMAGES_ALLOW_SVG__) {
			return new Response('"url" parameter is valid but image type is not allowed', {
				status: 400,
			});
		}
		const response = createImageResponse(imageStream, contentType, {
			immutable,
		});
		return response;
	}

	if (contentType === GIF) {
		if (env.IMAGES === undefined) {
			warn("env.IMAGES binding is not defined");
			const response = createImageResponse(imageStream, contentType, {
				immutable,
			});
			return response;
		}

		const imageSource = env.IMAGES.input(imageStream);
		const imageTransformationResult = await imageSource
			.transform({
				width: parseResult.width,
				fit: "scale-down",
			})
			.output({
				quality: parseResult.quality,
				format: GIF,
			});
		const outputImageStream = imageTransformationResult.image();
		const response = createImageResponse(outputImageStream, GIF, {
			immutable,
		});
		return response;
	}

	if (contentType === AVIF || contentType === WEBP || contentType === JPEG || contentType === PNG) {
		if (env.IMAGES === undefined) {
			warn("env.IMAGES binding is not defined");
			const response = createImageResponse(imageStream, contentType, {
				immutable,
			});
			return response;
		}

		const outputFormat = parseResult.format ?? contentType;
		const imageSource = env.IMAGES.input(imageStream);
		const imageTransformationResult = await imageSource
			.transform({
				width: parseResult.width,
				fit: "scale-down",
			})
			.output({
				quality: parseResult.quality,
				format: outputFormat,
			});
		const outputImageStream = imageTransformationResult.image();
		const response = createImageResponse(outputImageStream, outputFormat, {
			immutable,
		});
		return response;
	}

	warn(`Image content type ${contentType} not supported`);

	const response = createImageResponse(imageStream, contentType, {
		immutable,
	});

	return response;
}

/**
 * Handles requests to /cdn-cgi/image/ in development.
 *
 * Extracts the image URL, fetches the image, and checks the content type against
 * Cloudflare's supported input formats.
 *
 * @param requestURL The full request URL.
 * @param env The Cloudflare environment bindings.
 * @returns A promise that resolves to the image response.
 */
export async function handleCdnCgiImageRequest(requestURL: URL, env: CloudflareEnv): Promise<Response> {
	const parseResult = parseCdnCgiImageRequest(requestURL.pathname);

	if (!parseResult.ok) {
		return new Response(parseResult.message, {
			status: 400,
		});
	}

	let imageResponse: Response;
	if (parseResult.url.startsWith("/")) {
		if (env.ASSETS === undefined) {
			return new Response("env.ASSETS binding is not defined", {
				status: 404,
			});
		}
		const absoluteURL = new URL(parseResult.url, requestURL);
		imageResponse = await env.ASSETS.fetch(absoluteURL);
	} else {
		// Validate remote URLs against configured remote patterns (defense-in-depth).
		// This handler is intended for development use only, but service binding requests
		// can reach it in production, bypassing edge interception.
		// Only validate when remotePatterns are configured; when empty (e.g. custom image
		// loader without remotePatterns), skip the check to preserve dev emulation behavior.
		// See: CVE-2026-3125 (GHSA-c7mq-gh6q-6q7c)
		if (__IMAGES_REMOTE_PATTERNS__.length > 0) {
			let parsedUrl: URL;
			try {
				parsedUrl = new URL(parseResult.url);
			} catch {
				return new Response('"url" parameter is invalid', { status: 400 });
			}
			if (!hasRemoteMatch(__IMAGES_REMOTE_PATTERNS__, parsedUrl)) {
				return new Response('"url" parameter is not allowed', { status: 400 });
			}
		}
		imageResponse = await fetch(parseResult.url);
	}

	if (!imageResponse.ok || imageResponse.body === null) {
		return new Response('"url" parameter is valid but upstream response is invalid', {
			status: imageResponse.status,
		});
	}

	const readHeaderResult = await readImageHeader(imageResponse);
	if (readHeaderResult instanceof Response) {
		return readHeaderResult;
	}
	const { contentType, imageStream } = readHeaderResult;
	if (contentType === null || !SUPPORTED_CDN_CGI_INPUT_TYPES.has(contentType)) {
		return new Response('"url" parameter is valid but image type is not allowed', {
			status: 400,
		});
	}

	if (contentType === SVG && !__IMAGES_ALLOW_SVG__) {
		return new Response('"url" parameter is valid but image type is not allowed', {
			status: 400,
		});
	}

	return new Response(imageStream, {
		headers: { "Content-Type": contentType },
	});
}

/**
 * Parses a /cdn-cgi/image/ request URL.
 *
 * Extracts the image URL from the `/cdn-cgi/image/<options>/<image-url>` path format.
 * Rejects protocol-relative URLs (`//...`). The cdn-cgi options are not parsed or
 * validated as they are Cloudflare's concern.
 *
 * @param pathname The URL pathname (e.g. `/cdn-cgi/image/width=640,quality=75,format=auto/path/to/image.png`).
 * @returns the parsed URL result or an error.
 */
export function parseCdnCgiImageRequest(
	pathname: string
): { ok: true; url: string; static: boolean } | ErrorResult {
	const match = pathname.match(/^\/cdn-cgi\/image\/(?<options>[^/]+)\/(?<url>.+)$/);
	if (
		match === null ||
		// Valid URLs have at least one option
		!match.groups?.options ||
		!match.groups?.url
	) {
		return { ok: false, message: "Invalid /cdn-cgi/image/ URL format" };
	}

	const imageUrl = match.groups.url;

	// The regex separator consumes one `/`, so if imageUrl starts with `/`
	// the original URL segment was protocol-relative (`//...`).
	if (imageUrl.startsWith("/")) {
		return { ok: false, message: '"url" parameter cannot be a protocol-relative URL (//)' };
	}

	// Resolve the image URL: it may be absolute (https://...) or relative.
	let resolvedUrl: string;
	if (imageUrl.match(/^https?:\/\//)) {
		resolvedUrl = imageUrl;
	} else {
		// Relative URLs need a leading slash.
		resolvedUrl = `/${imageUrl}`;
	}

	return {
		ok: true,
		url: resolvedUrl,
		static: false,
	};
}

/**
 * Reads the first 32 bytes of an image response to detect its content type.
 *
 * Tees the response body so the image stream can still be consumed after detection.
 *
 * @param imageResponse The image response whose body to read.
 * @returns The detected content type and image stream, or an error Response if the header bytes
 *   could not be read.
 */
async function readImageHeader(
	imageResponse: Response
): Promise<{ contentType: ImageContentType | null; imageStream: ReadableStream } | Response> {
	// Note: imageResponse.body is non-null — callers check before calling.
	const [contentTypeStream, imageStream] = imageResponse.body!.tee();
	const headerBytes = new Uint8Array(32);
	const reader = contentTypeStream.getReader({ mode: "byob" });
	const readResult = await reader.readAtLeast(32, headerBytes);
	if (readResult.value === undefined) {
		await imageResponse.body!.cancel();
		return new Response('"url" parameter is valid but upstream response is invalid', {
			status: 400,
		});
	}

	const contentType = detectImageContentType(readResult.value);
	return { contentType, imageStream };
}

/**
 * Fetch call with max redirects and timeouts.
 *
 * Re-throws the exception thrown by a fetch call.
 * @param url
 * @param timeoutMS Timeout for a single fetch call.
 * @param maxRedirectCount
 * @returns
 */
async function fetchWithRedirects(
	url: string,
	timeoutMS: number,
	maxRedirectCount: number
): Promise<FetchWithRedirectsResult> {
	// TODO: Add dangerouslyAllowLocalIP support

	let response: Response;
	try {
		response = await fetch(url, {
			signal: AbortSignal.timeout(timeoutMS),
			redirect: "manual",
		});
	} catch (e) {
		if (e instanceof Error && e.name === "TimeoutError") {
			const result: FetchWithRedirectsErrorResult = {
				ok: false,
				error: "timed_out",
			};
			return result;
		}
		throw e;
	}
	if (redirectResponseStatuses.includes(response.status)) {
		const locationHeader = response.headers.get("Location");
		if (locationHeader !== null) {
			if (maxRedirectCount < 1) {
				const result: FetchWithRedirectsErrorResult = {
					ok: false,
					error: "too_many_redirects",
				};
				return result;
			}
			let redirectTarget: string;
			if (locationHeader.startsWith("/")) {
				redirectTarget = new URL(locationHeader, url).href;
			} else {
				redirectTarget = locationHeader;
			}
			const result = await fetchWithRedirects(redirectTarget, timeoutMS, maxRedirectCount - 1);
			return result;
		}
	}
	const result: FetchWithRedirectsSuccessResult = {
		ok: true,
		response: response,
	};
	return result;
}

type FetchWithRedirectsResult = FetchWithRedirectsSuccessResult | FetchWithRedirectsErrorResult;

type FetchWithRedirectsSuccessResult = {
	ok: true;
	response: Response;
};

type FetchWithRedirectsErrorResult = {
	ok: false;
	error: FetchImageError;
};

type FetchImageError = "timed_out" | "too_many_redirects";

const redirectResponseStatuses = [301, 302, 303, 307, 308];

function createImageResponse(
	image: ReadableStream,
	contentType: string,
	imageResponseFlags: ImageResponseFlags
): Response {
	const response = new Response(image, {
		headers: {
			Vary: "Accept",
			"Content-Type": contentType,
			"Content-Disposition": __IMAGES_CONTENT_DISPOSITION__,
			"Content-Security-Policy": __IMAGES_CONTENT_SECURITY_POLICY__,
		},
	});
	if (imageResponseFlags.immutable) {
		response.headers.set("Cache-Control", "public, max-age=315360000, immutable");
	}
	return response;
}

type ImageResponseFlags = {
	immutable: boolean;
};

/**
 * Parses the image request URL and headers.
 *
 * This function validates the parameters and returns either the parsed result or an error message.
 *
 * @param requestURL request URL
 * @param requestHeaders request headers
 * @returns an instance of `ParseImageRequestURLSuccessResult` when successful, or an instance of `ErrorResult` when failed.
 */
function parseImageRequest(
	requestURL: URL,
	requestHeaders: Headers
): ParseImageRequestURLSuccessResult | ErrorResult {
	const formats = __IMAGES_FORMATS__;

	const parsedUrlOrError = validateUrlQueryParameter(requestURL);
	if (!("url" in parsedUrlOrError)) {
		return parsedUrlOrError;
	}

	const widthOrError = validateWidthQueryParameter(requestURL);
	if (typeof widthOrError !== "number") {
		return widthOrError;
	}

	const qualityOrError = validateQualityQueryParameter(requestURL);
	if (typeof qualityOrError !== "number") {
		return qualityOrError;
	}

	const acceptHeader = requestHeaders.get("Accept") ?? "";
	let format: OptimizedImageFormat | null = null;
	// Find a more specific format that the client accepts.
	for (const allowedFormat of formats) {
		if (acceptHeader.includes(allowedFormat)) {
			format = allowedFormat;
			break;
		}
	}

	const result: ParseImageRequestURLSuccessResult = {
		ok: true,
		url: parsedUrlOrError.url,
		width: widthOrError,
		quality: qualityOrError,
		format,
		static: parsedUrlOrError.static,
	};
	return result;
}

type ParseImageRequestURLSuccessResult = {
	ok: true;
	/** Absolute or relative URL. */
	url: string;
	width: number;
	quality: number;
	format: OptimizedImageFormat | null;
	static: boolean;
};

export type OptimizedImageFormat = "image/avif" | "image/webp";

type ErrorResult = {
	ok: false;
	message: string;
};

/**
 * Validates that there is exactly one "url" query parameter.
 *
 * Checks length, protocol-relative URLs, local/remote pattern matching, recursion, and protocol.
 *
 * @param requestURL The request URL containing the "url" query parameter.
 * @returns the validated URL or an error result.
 */
function validateUrlQueryParameter(requestURL: URL): ErrorResult | { url: string; static: boolean } {
	// There should be a single "url" parameter.
	const urls = requestURL.searchParams.getAll("url");
	if (urls.length < 1) {
		const result: ErrorResult = {
			ok: false,
			message: '"url" parameter is required',
		};
		return result;
	}
	if (urls.length > 1) {
		const result: ErrorResult = {
			ok: false,
			message: '"url" parameter cannot be an array',
		};
		return result;
	}

	const url = urls[0]!;

	if (url.length > 3072) {
		const result: ErrorResult = {
			ok: false,
			message: '"url" parameter is too long',
		};
		return result;
	}
	if (url.startsWith("//")) {
		const result: ErrorResult = {
			ok: false,
			message: '"url" parameter cannot be a protocol-relative URL (//)',
		};
		return result;
	}

	if (url.startsWith("/")) {
		const staticAsset = url.startsWith(`${__NEXT_BASE_PATH__ || ""}/_next/static/media`);

		const pathname = getPathnameFromRelativeURL(url);
		if (/\/_next\/image($|\/)/.test(decodeURIComponent(pathname))) {
			const result: ErrorResult = {
				ok: false,
				message: '"url" parameter cannot be recursive',
			};
			return result;
		}

		if (!staticAsset) {
			if (!hasLocalMatch(__IMAGES_LOCAL_PATTERNS__, url)) {
				const result: ErrorResult = { ok: false, message: '"url" parameter is not allowed' };
				return result;
			}
		}

		return { url, static: staticAsset };
	}

	let parsedURL: URL;
	try {
		parsedURL = new URL(url);
	} catch {
		const result: ErrorResult = { ok: false, message: '"url" parameter is invalid' };
		return result;
	}

	const validProtocols = ["http:", "https:"];
	if (!validProtocols.includes(parsedURL.protocol)) {
		const result: ErrorResult = {
			ok: false,
			message: '"url" parameter is invalid',
		};
		return result;
	}
	if (!hasRemoteMatch(__IMAGES_REMOTE_PATTERNS__, parsedURL)) {
		const result: ErrorResult = {
			ok: false,
			message: '"url" parameter is not allowed',
		};
		return result;
	}

	return { url: parsedURL.href, static: false };
}

/**
 * Validates the "w" (width) query parameter.
 *
 * @returns the validated width number or an error result.
 */
function validateWidthQueryParameter(requestURL: URL): ErrorResult | number {
	const widthQueryValues = requestURL.searchParams.getAll("w");
	if (widthQueryValues.length < 1) {
		const result: ErrorResult = {
			ok: false,
			message: '"w" parameter (width) is required',
		};
		return result;
	}
	if (widthQueryValues.length > 1) {
		const result: ErrorResult = {
			ok: false,
			message: '"w" parameter (width) cannot be an array',
		};
		return result;
	}
	const widthQueryValue = widthQueryValues[0]!;
	if (!/^[0-9]+$/.test(widthQueryValue)) {
		const result: ErrorResult = {
			ok: false,
			message: '"w" parameter (width) must be an integer greater than 0',
		};
		return result;
	}
	const width = parseInt(widthQueryValue, 10);
	if (width <= 0 || isNaN(width)) {
		const result: ErrorResult = {
			ok: false,
			message: '"w" parameter (width) must be an integer greater than 0',
		};
		return result;
	}

	const sizeValid = __IMAGES_DEVICE_SIZES__.includes(width) || __IMAGES_IMAGE_SIZES__.includes(width);
	if (!sizeValid) {
		const result: ErrorResult = {
			ok: false,
			message: `"w" parameter (width) of ${width} is not allowed`,
		};
		return result;
	}

	return width;
}

/**
 * Validates the "q" (quality) query parameter.
 *
 * @returns the validated quality number or an error result.
 */
function validateQualityQueryParameter(requestURL: URL): ErrorResult | number {
	const qualityQueryValues = requestURL.searchParams.getAll("q");
	if (qualityQueryValues.length < 1) {
		const result: ErrorResult = {
			ok: false,
			message: '"q" parameter (quality) is required',
		};
		return result;
	}
	if (qualityQueryValues.length > 1) {
		const result: ErrorResult = {
			ok: false,
			message: '"q" parameter (quality) cannot be an array',
		};
		return result;
	}
	const qualityQueryValue = qualityQueryValues[0]!;
	if (!/^[0-9]+$/.test(qualityQueryValue)) {
		const result: ErrorResult = {
			ok: false,
			message: '"q" parameter (quality) must be an integer between 1 and 100',
		};
		return result;
	}
	const quality = parseInt(qualityQueryValue, 10);
	if (isNaN(quality) || quality < 1 || quality > 100) {
		const result: ErrorResult = {
			ok: false,
			message: '"q" parameter (quality) must be an integer between 1 and 100',
		};
		return result;
	}
	if (!__IMAGES_QUALITIES__.includes(quality)) {
		const result: ErrorResult = {
			ok: false,
			message: `"q" parameter (quality) of ${quality} is not allowed`,
		};
		return result;
	}

	return quality;
}

function getPathnameFromRelativeURL(relativeURL: string): string {
	return relativeURL.split("?")[0]!;
}

function hasLocalMatch(localPatterns: LocalPattern[], relativeURL: string): boolean {
	const parseRelativeURLResult = parseRelativeURL(relativeURL);
	for (const localPattern of localPatterns) {
		const matched = matchLocalPattern(localPattern, parseRelativeURLResult);
		if (matched) {
			return true;
		}
	}
	return false;
}

function parseRelativeURL(relativeURL: string): ParseRelativeURLResult {
	if (!relativeURL.includes("?")) {
		const result: ParseRelativeURLResult = {
			pathname: relativeURL,
			search: "",
		};
		return result;
	}
	const parts = relativeURL.split("?");
	const pathname = parts[0]!;
	const search = "?" + parts.slice(1).join("?");
	const result: ParseRelativeURLResult = {
		pathname,
		search,
	};
	return result;
}

type ParseRelativeURLResult = {
	pathname: string;
	search: string;
};

export function matchLocalPattern(pattern: LocalPattern, url: { pathname: string; search: string }): boolean {
	if (pattern.search !== undefined && pattern.search !== url.search) {
		return false;
	}

	return new RegExp(pattern.pathname).test(url.pathname);
}

function hasRemoteMatch(remotePatterns: RemotePattern[], url: URL): boolean {
	for (const remotePattern of remotePatterns) {
		const matched = matchRemotePattern(remotePattern, url);
		if (matched) {
			return true;
		}
	}
	return false;
}

export function matchRemotePattern(pattern: RemotePattern, url: URL): boolean {
	// https://github.com/vercel/next.js/blob/d76f0b1/packages/next/src/shared/lib/match-remote-pattern.ts
	if (
		pattern.protocol !== undefined &&
		pattern.protocol.replace(/:$/, "") !== url.protocol.replace(/:$/, "")
	) {
		return false;
	}

	if (pattern.port !== undefined && pattern.port !== url.port) {
		return false;
	}

	if (pattern.hostname === undefined || !new RegExp(pattern.hostname).test(url.hostname)) {
		return false;
	}

	if (pattern.search !== undefined && pattern.search !== url.search) {
		return false;
	}

	// Should be the same as writeImagesManifest()
	return new RegExp(pattern.pathname).test(url.pathname);
}

const AVIF = "image/avif";
const WEBP = "image/webp";
const PNG = "image/png";
const JPEG = "image/jpeg";
const JXL = "image/jxl";
const JP2 = "image/jp2";
const HEIC = "image/heic";
const GIF = "image/gif";
const SVG = "image/svg+xml";
const ICO = "image/x-icon";
const ICNS = "image/x-icns";
const TIFF = "image/tiff";
const BMP = "image/bmp";

/**
 * Image content types supported as input by Cloudflare's cdn-cgi image transformation.
 *
 * @see https://developers.cloudflare.com/images/transform-images/#supported-input-formats
 */
const SUPPORTED_CDN_CGI_INPUT_TYPES: ReadonlySet<string> = new Set([JPEG, PNG, GIF, WEBP, SVG, HEIC]);

type ImageContentType =
	| "image/avif"
	| "image/webp"
	| "image/png"
	| "image/jpeg"
	| "image/jxl"
	| "image/jp2"
	| "image/heic"
	| "image/gif"
	| "image/svg+xml"
	| "image/x-icon"
	| "image/x-icns"
	| "image/tiff"
	| "image/bmp";

/**
 * Detects the content type by looking at the first few bytes of a file
 *
 * Based on https://github.com/vercel/next.js/blob/72c9635/packages/next/src/server/image-optimizer.ts#L155
 *
 * @param buffer The image bytes
 * @returns a content type of undefined for unsupported content
 */
export function detectImageContentType(buffer: Uint8Array): ImageContentType | null {
	if ([0xff, 0xd8, 0xff].every((b, i) => buffer[i] === b)) {
		return JPEG;
	}
	if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buffer[i] === b)) {
		return PNG;
	}
	if ([0x47, 0x49, 0x46, 0x38].every((b, i) => buffer[i] === b)) {
		return GIF;
	}
	if ([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50].every((b, i) => !b || buffer[i] === b)) {
		return WEBP;
	}
	if ([0x3c, 0x3f, 0x78, 0x6d, 0x6c].every((b, i) => buffer[i] === b)) {
		return SVG;
	}
	if ([0x3c, 0x73, 0x76, 0x67].every((b, i) => buffer[i] === b)) {
		return SVG;
	}
	if ([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66].every((b, i) => !b || buffer[i] === b)) {
		return AVIF;
	}
	if ([0x00, 0x00, 0x01, 0x00].every((b, i) => buffer[i] === b)) {
		return ICO;
	}
	if ([0x69, 0x63, 0x6e, 0x73].every((b, i) => buffer[i] === b)) {
		return ICNS;
	}
	if ([0x49, 0x49, 0x2a, 0x00].every((b, i) => buffer[i] === b)) {
		return TIFF;
	}
	if ([0x42, 0x4d].every((b, i) => buffer[i] === b)) {
		return BMP;
	}
	if ([0xff, 0x0a].every((b, i) => buffer[i] === b)) {
		return JXL;
	}
	if (
		[0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a].every((b, i) => buffer[i] === b)
	) {
		return JXL;
	}
	if ([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63].every((b, i) => !b || buffer[i] === b)) {
		return HEIC;
	}
	if (
		[0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a].every((b, i) => buffer[i] === b)
	) {
		return JP2;
	}
	return null;
}

declare global {
	var __IMAGES_REMOTE_PATTERNS__: RemotePattern[];
	var __IMAGES_LOCAL_PATTERNS__: LocalPattern[];
	var __IMAGES_DEVICE_SIZES__: number[];
	var __IMAGES_IMAGE_SIZES__: number[];
	var __IMAGES_QUALITIES__: number[];
	var __IMAGES_FORMATS__: NextConfigImageFormat[];
	var __IMAGES_MINIMUM_CACHE_TTL_SEC__: number;
	var __IMAGES_ALLOW_SVG__: boolean;
	var __IMAGES_CONTENT_SECURITY_POLICY__: string;
	var __IMAGES_CONTENT_DISPOSITION__: string;
	var __IMAGES_MAX_REDIRECTS__: number;

	type NextConfigImageFormat = "image/avif" | "image/webp";
}
