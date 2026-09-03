import { API } from "../config";

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const isLocalHostname = (host) => {
    const h = String(host || "").trim().toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".localhost");
};

const uploadBase = (() => {
    const apiValue = String(API || "").trim();
    if (!apiValue) return "";
    if (isAbsoluteHttpUrl(apiValue)) {
        try {
            return trimSlash(new URL(apiValue).origin);
        } catch {
            return trimSlash(apiValue);
        }
    }
    // Keep relative proxy prefixes like "/api" for frontend rewrites.
    return trimSlash(apiValue);
})();

const joinUrl = (base, path) => {
    const b = trimSlash(base);
    const p = String(path || "").trim().replace(/^\/+/, "");
    if (!b) return `/${p}`;
    return `${b}/${p}`;
};

export function resolveImageUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";

    if (value.startsWith("data:")) return value;
    if (isAbsoluteHttpUrl(value)) {
        try {
            const parsed = new URL(value);
            // Heal stale local URLs (e.g. http://localhost:3000/uploads/...) using current API base.
            if (isLocalHostname(parsed.hostname) && parsed.pathname.startsWith("/uploads/")) {
                return joinUrl(uploadBase || API, `${parsed.pathname}${parsed.search || ""}${parsed.hash || ""}`);
            }
            return value;
        } catch {
            return value;
        }
    }

    // Common persisted shapes:
    // - "/uploads/public/..." (older local)
    // - "public/restaurants/..." (stored key)
    // - "uploads/public/..." (missing leading slash)
    if (value.startsWith("/uploads/")) return joinUrl(uploadBase || API, value);
    if (value.startsWith("uploads/")) return joinUrl(uploadBase || API, `/${value}`);
    if (value.startsWith("public/") || value.startsWith("private/")) return joinUrl(uploadBase || API, `/uploads/${value}`);

    // Fallback: if uploadBase or API is defined and path is relative, join it
    if (uploadBase || API) {
        return joinUrl(uploadBase || API, value);
    }

    return value;
}

