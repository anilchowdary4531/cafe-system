const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

// Centralized frontend config.
// Set VITE_API_URL in:
// - frontend/.env.development (local)
// - frontend/.env.production (build, or "/api" when Vercel proxies to the backend)
// Or via hosting provider env vars (Vercel recommended).
export const API = trimSlash(import.meta.env.VITE_API_URL);

if (!API) {
    console.error(
        "[config] Missing VITE_API_URL. API calls will use relative URLs; set VITE_API_URL in production if the backend is hosted separately."
    );
}
