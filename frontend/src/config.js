const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const PROD_HOSTNAMES = new Set([
    "tiffzy.com",
    "www.tiffzy.com",
    "cafe-system-nu.vercel.app",
]);

const PROD_API_ORIGINS = new Set([
    "https://api.tiffzy.com",
]);

export const PREVIEW_CONFIG_ERROR =
    "Staging backend URL is not configured for this Vercel Preview build. Set VITE_API_URL / VITE_API_BASE_URL (and VITE_SOCKET_URL) in Vercel Preview Environment Variables.";

export const resolveFrontendEnvConfig = ({
    apiUrl = import.meta.env.VITE_API_URL,
    apiBaseUrl = import.meta.env.VITE_API_BASE_URL,
    socketUrl = import.meta.env.VITE_SOCKET_URL,
    allowProdApiOnPreview = import.meta.env.VITE_ALLOW_PROD_API_ON_PREVIEW,
    isProd = import.meta.env.PROD,
    hostname = typeof window !== "undefined" ? window.location.hostname : "",
} = {}) => {
    const normalizedHost = String(hostname || "").trim().toLowerCase();
    const isVercelPreviewHost =
        Boolean(normalizedHost) &&
        normalizedHost.endsWith(".vercel.app") &&
        !PROD_HOSTNAMES.has(normalizedHost);

    const cleanApiUrl = trimSlash(apiUrl);
    const cleanApiBaseUrl = trimSlash(apiBaseUrl);
    const extractOrigin = (raw) => {
        if (!raw) return "";
        try {
            return trimSlash(new URL(raw).origin).toLowerCase();
        } catch {
            return raw.toLowerCase();
        }
    };
    const isProdApiUrl = PROD_API_ORIGINS.has(extractOrigin(cleanApiUrl));
    const isProdApiBaseUrl = PROD_API_ORIGINS.has(extractOrigin(cleanApiBaseUrl));
    // If `.env.production` supplied https://api.tiffzy.com on a non-production host while
    // VITE_API_BASE_URL was explicitly set for staging/preview, honor VITE_API_BASE_URL.
    const preferBaseOverride =
        Boolean(cleanApiBaseUrl) &&
        !isProdApiBaseUrl &&
        !PROD_HOSTNAMES.has(normalizedHost) &&
        (!cleanApiUrl || isProdApiUrl);
    const rawApi = preferBaseOverride ? cleanApiBaseUrl : (cleanApiUrl || cleanApiBaseUrl);
    const rawSocket = trimSlash(socketUrl);
    const allowProdOnPreview = String(allowProdApiOnPreview || "").trim().toLowerCase() === "true";

    const apiOrigin = extractOrigin(rawApi);
    const socketOrigin = extractOrigin(rawSocket);

    // Guard against Vercel Preview accidentally proxying `/api` (via vercel.json) or calling api.tiffzy.com directly.
    const isMisconfiguredPreview =
        Boolean(isProd) &&
        isVercelPreviewHost &&
        !allowProdOnPreview &&
        (!rawApi || PROD_API_ORIGINS.has(apiOrigin) || PROD_API_ORIGINS.has(socketOrigin));

    if (isMisconfiguredPreview) {
        return {
            API_BASE_URL: "/__staging_api_not_configured__",
            SOCKET_URL: "",
            IS_MISCONFIGURED_PREVIEW: true,
        };
    }

    const resolvedApiBase = rawApi || (isProd ? "/api" : "");
    const resolvedSocket = rawSocket || resolvedApiBase;
    return {
        API_BASE_URL: resolvedApiBase,
        SOCKET_URL: resolvedSocket,
        IS_MISCONFIGURED_PREVIEW: false,
    };
};

// Centralized frontend config.
// Supports VITE_API_URL (canonical) and VITE_API_BASE_URL (staging alias), plus optional VITE_SOCKET_URL.
const resolvedConfig = resolveFrontendEnvConfig();

export const API_BASE_URL = resolvedConfig.API_BASE_URL;
export const API = API_BASE_URL;
export const SOCKET_URL = resolvedConfig.SOCKET_URL;
export const IS_MISCONFIGURED_PREVIEW = resolvedConfig.IS_MISCONFIGURED_PREVIEW;
export const config = {
    API_BASE_URL,
    API,
    SOCKET_URL,
    IS_MISCONFIGURED_PREVIEW,
};

if (IS_MISCONFIGURED_PREVIEW) {
    console.error(`[config] ${PREVIEW_CONFIG_ERROR}`);
} else if (!trimSlash(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL) && !import.meta.env.PROD) {
    console.error(
        "[config] Missing VITE_API_URL / VITE_API_BASE_URL. API calls will use relative URLs; set VITE_API_URL in production/staging if the backend is hosted separately."
    );
} else if (!trimSlash(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL) && import.meta.env.PROD) {
    console.warn("[config] VITE_API_URL is missing in production; defaulting API calls to /api.");
}
