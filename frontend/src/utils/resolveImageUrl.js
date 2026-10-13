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
    if (!raw) return "";

    let value = "";
    if (typeof raw === "string") {
        value = raw.trim();
    } else if (typeof raw === "object") {
        const candidate =
            raw.image ||
            raw.imageUrl ||
            raw.image_url ||
            raw.url ||
            raw.photo ||
            raw.photoUrl ||
            raw.img ||
            (Array.isArray(raw.images) && raw.images.length > 0
                ? (typeof raw.images[0] === "string" ? raw.images[0] : raw.images[0]?.imageUrl || raw.images[0]?.url)
                : "") ||
            "";
        value = String(candidate || "").trim();
    }

    if (!value || value === "[object Object]") return "";

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

export function getItemImageUrl(item) {
    if (!item) return "";
    if (typeof item === "string") return resolveImageUrl(item);
    const raw =
        item.image ||
        item.imageUrl ||
        item.image_url ||
        item.photo ||
        item.photoUrl ||
        item.img ||
        (Array.isArray(item.images) && item.images.length > 0
            ? (typeof item.images[0] === "string" ? item.images[0] : item.images[0]?.imageUrl || item.images[0]?.url)
            : "") ||
        "";
    return resolveImageUrl(raw);
}

export const CATEGORY_FALLBACK_IMAGES = {
    burger: [
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
        "https://images.unsplash.com/photo-1550547660-d9450f859349",
        "https://images.unsplash.com/photo-1586190848861-99aa4a171e90",
        "https://images.unsplash.com/photo-1571091718767-18b5b1457add",
        "https://images.unsplash.com/photo-1553979459-d2229ba7433b",
    ],
    biryani: [
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8",
        "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d",
        "https://images.unsplash.com/photo-1633945274405-b6c8069047b0",
        "https://images.unsplash.com/photo-1589302168068-964664d93dc0",
    ],
    briyani: [
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8",
        "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d",
        "https://images.unsplash.com/photo-1633945274405-b6c8069047b0",
    ],
    pulao: [
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8",
        "https://images.unsplash.com/photo-1589302168068-964664d93dc0",
    ],
    pizza: [
        "https://images.unsplash.com/photo-1513104890138-7c749659a591",
        "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
    ],
    coffee: [
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93",
        "https://images.unsplash.com/photo-1461023058943-07fcbe16d735",
        "https://images.unsplash.com/photo-1511920170033-f8396924c348",
    ],
    dessert: [
        "https://images.unsplash.com/photo-1606313564200-e75d5e30476c",
        "https://images.unsplash.com/photo-1551024709-8f23befc6f87",
    ],
    cake: [
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
        "https://images.unsplash.com/photo-1551024709-8f23befc6f87",
    ],
    food: [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
    ],
};

export function getItemFallbackImages(item) {
    if (!item) return [CATEGORY_FALLBACK_IMAGES.food[0]];
    const cat = String(item.category || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    const text = `${cat} ${name}`;

    for (const [key, list] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
        if (text.includes(key)) {
            const id = Number(item.id) || 0;
            const offset = list.length > 0 ? id % list.length : 0;
            return [...list.slice(offset), ...list.slice(0, offset)];
        }
    }
    return CATEGORY_FALLBACK_IMAGES.food;
}

export function getItemFallbackImage(item) {
    const list = getItemFallbackImages(item);
    return list[0] || CATEGORY_FALLBACK_IMAGES.food[0];
}

export function getItemImages(item) {
    if (!item) return [];

    const rawList = [];

    const extractUrl = (val) => {
        if (!val) return "";
        if (typeof val === "string") return val.trim();
        if (typeof val === "object" && val !== null) {
            return String(val.imageUrl || val.url || val.src || val.image || val.photoUrl || "").trim();
        }
        return "";
    };

    // 1. Array fields: images, imageUrls, gallery, media
    if (Array.isArray(item.images) && item.images.length > 0) {
        rawList.push(...item.images);
    } else if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
        rawList.push(...item.imageUrls);
    } else if (Array.isArray(item.gallery) && item.gallery.length > 0) {
        rawList.push(...item.gallery);
    } else if (Array.isArray(item.media) && item.media.length > 0) {
        rawList.push(...item.media);
    }

    // 2. String fields that could be JSON array or single/comma-separated URLs
    const stringCandidates = [
        item.image,
        item.imageUrl,
        item.image_url,
        item.photo,
        item.photoUrl,
        item.img,
    ];

    for (const cand of stringCandidates) {
        if (typeof cand === "string" && cand.trim()) {
            const trimmed = cand.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        rawList.push(...parsed);
                        continue;
                    }
                } catch {}
            }
            if (trimmed.includes(",")) {
                const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
                if (parts.length > 1 && parts.every((p) => p.startsWith("http") || p.startsWith("/"))) {
                    rawList.push(...parts);
                    continue;
                }
            }
            rawList.push(trimmed);
        } else if (Array.isArray(cand)) {
            rawList.push(...cand);
        }
    }

    // 3. Resolve and deduplicate
    const resolvedSet = new Set();
    const result = [];

    for (const entry of rawList) {
        const rawUrl = extractUrl(entry);
        if (!rawUrl) continue;
        const resolved = resolveImageUrl(rawUrl);
        if (resolved && !resolvedSet.has(resolved)) {
            resolvedSet.add(resolved);
            result.push(resolved);
        }
    }

    // Fallback: if no images found but item itself has a single resolved image
    if (result.length === 0) {
        const single = getItemImageUrl(item);
        if (single) {
            result.push(single);
        } else {
            // Category/item-name-aware fallback pool so items never share the exact same generic image
            const fallbacks = getItemFallbackImages(item);
            if (fallbacks.length > 0) {
                result.push(...fallbacks);
            }
        }
    }

    return result;
}



