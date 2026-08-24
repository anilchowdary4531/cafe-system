import axios from "axios";
import { API } from "../config";
import { deleteCacheEntry, getCacheEntry, isFresh, isStaleAllowed, makeCacheEntry, pruneCache, setCacheEntry } from "./localCache";
import { clearStaffSession, getActiveStaffSession } from "./staffSessionStorage";

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

api.interceptors.request.use((config) => {
    const url = String(config?.url || "");
    const activeStaffSession = getActiveStaffSession();
    const staffToken = activeStaffSession?.token || null;
    const customerToken = localStorage.getItem("customerToken");

    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
        // Customer endpoints should prefer customer token, even if staff token exists.
        if ((url.startsWith("/customer") || url.startsWith("/api/wallet") || url.includes("/wallet")) && customerToken) {
            config.headers.Authorization = `Bearer ${customerToken}`;
        } else if (staffToken) {
            config.headers.Authorization = `Bearer ${staffToken}`;
        } else if (customerToken) {
            config.headers.Authorization = `Bearer ${customerToken}`;
        }
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (error) => {
        // If backend says "unauthorized", drop token and let UI redirect naturally.
        const status = error?.response?.status;
        if (status === 401) {
            const url = String(error?.config?.url || "");
            const activeStaffSession = getActiveStaffSession();
            try {
                if (url.startsWith("/customer")) {
                    localStorage.removeItem("customerToken");
                    localStorage.removeItem("customer");
                } else {
                    clearStaffSession(activeStaffSession?.scope || "local");
                }
            } catch {
                // ignore
            }
            try {
                window.dispatchEvent(
                    new CustomEvent("auth:logout", {
                        detail: { scope: url.startsWith("/customer") ? "customer" : "staff" },
                    })
                );
            } catch {
                // ignore non-browser envs
            }
        }
        return Promise.reject(error);
    }
);

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
        await inFlight.get(key);
        const latest = getCacheEntry(key);
        if (latest?.data !== undefined) return latest.data;
    }

    const p = api.get(url, { params });
    inFlight.set(key, p);
    const res = await p.finally(() => {
        inFlight.delete(key);
    });
    const entry = makeCacheEntry({ data: res.data, ttlMs });
    if (entry.expiresAt) entry.staleExpiresAt = entry.expiresAt + Number(staleMs || 0);
    setCacheEntry(key, entry);
    return res.data;
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
        if (fullKey.includes(`:${API}:${urlStartsWith}`)) {
            toDelete.push(fullKey);
        }
    }

    toDelete.forEach((fullKey) => {
        const rawKey = fullKey.replace("cafe_system_cache:v1:", "");
        deleteCacheEntry(rawKey);
    });
};
