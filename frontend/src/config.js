const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

// Centralized frontend config.
// Set VITE_API_URL in:
// - frontend/.env.development (local)
// - frontend/.env.production (build, or "/api" when Vercel proxies to the backend)
// Or via hosting provider env vars (Vercel recommended).
const envApi = trimSlash(import.meta.env.VITE_API_URL);
export const API_BASE_URL = envApi || (import.meta.env.PROD ? "/api" : "");
export const API = API_BASE_URL;

if (!envApi && !import.meta.env.PROD) {
    console.error(
        "[config] Missing VITE_API_URL. API calls will use relative URLs; set VITE_API_URL in production if the backend is hosted separately."
    );
} else if (!envApi && import.meta.env.PROD) {
    console.warn("[config] VITE_API_URL is missing in production; defaulting API calls to /api.");
}
