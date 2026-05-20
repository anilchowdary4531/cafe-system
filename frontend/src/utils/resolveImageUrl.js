import { API } from "../config";

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

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
    if (value.startsWith("http://") || value.startsWith("https://")) return value;

    // Common persisted shapes:
    // - "/uploads/public/..." (older local)
    // - "public/restaurants/..." (stored key)
    // - "uploads/public/..." (missing leading slash)
    if (value.startsWith("/uploads/")) return joinUrl(API, value);
    if (value.startsWith("uploads/")) return joinUrl(API, `/${value}`);
    if (value.startsWith("public/") || value.startsWith("private/")) return joinUrl(API, `/uploads/${value}`);

    // Fallback: treat as relative and let the browser resolve it.
    return value;
}

