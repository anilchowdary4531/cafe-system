import axios from "axios";
import { API } from "../config";
import { deleteCacheEntry, getCacheEntry, isFresh, isStaleAllowed, makeCacheEntry, pruneCache, setCacheEntry } from "./localCache";
import { applyAuthHeaders, handleAuth401 } from "./authInterceptor";

const stableStringify = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value !== "object") return String(value);
    if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(",")}}`;
};

export const api = axios.create({
    baseURL: API,
    timeout: 15000,
});

// Prevent duplicate in-flight requests for the same cache key.
const inFlight = new Map();

api.interceptors.request.use(applyAuthHeaders);
api.interceptors.response.use((res) => res, handleAuth401);

export const makeGetCacheKey = ({ url, params, scope = "public" }) => {
    return `GET:${scope}:${API}:${url}?${stableStringify(params || {})}`;
};

/**
 * Cached GET with stale-while-revalidate:
 * - If cache is fresh: return cached response immediately.
 * - If cache is stale but present: return cached response immediately, and refresh in background.
 * - If no cache: fetch from network and cache it.
 */
export const cachedGet = async (
    url,
    { params, ttlMs = 30_000, staleMs = 5 * 60_000, scope = "public", cacheKey, revalidate = true, force = false } = {}
) => {
    pruneCache();

    const key = cacheKey || makeGetCacheKey({ url, params, scope });
    const cached = getCacheEntry(key);

    if (!force && cached && isFresh(cached)) {
        return cached.data;
    }

    // Serve stale immediately, then refresh in background.
    if (!force && cached?.data !== undefined && revalidate && isStaleAllowed(cached)) {
        if (!inFlight.has(key)) {
            const p = api
                .get(url, { params })
                .then((res) => {
                    const entry = makeCacheEntry({ data: res.data, ttlMs });
                    if (entry.expiresAt) entry.staleExpiresAt = entry.expiresAt + Number(staleMs || 0);
                    setCacheEntry(key, entry);
                })
                .catch(() => {
                    // ignore background refresh errors
                })
                .finally(() => {
                    inFlight.delete(key);
                });
            inFlight.set(key, p);
        }
        return cached.data;
    }

    if (!force && inFlight.has(key)) {
        return inFlight.get(key);
    }

    const p = (async () => {
        const res = await api.get(url, { params });
        const entry = makeCacheEntry({ data: res.data, ttlMs });
        if (entry.expiresAt) entry.staleExpiresAt = entry.expiresAt + Number(staleMs || 0);
        setCacheEntry(key, entry);
        return res.data;
    })().finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, p);
    return p;
};

export const invalidateGetCache = ({ urlStartsWith } = {}) => {
    if (!urlStartsWith) return;

    // We only have an index of full keys; easiest invalidation is to delete by prefix match.
    // Using localStorage iteration is OK here (small dev app) and only on mutations.
    const prefix = `cafe_system_cache:v1:GET:`;
    const toDelete = [];

    for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (!fullKey || !fullKey.startsWith(prefix)) continue;
        if (fullKey.includes(`${API}${urlStartsWith}`) || fullKey.includes(urlStartsWith)) {
            toDelete.push(fullKey);
        }
    }

    toDelete.forEach((fullKey) => {
        const rawKey = fullKey.replace("cafe_system_cache:v1:", "");
        deleteCacheEntry(rawKey);
    });
};
