import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet, makeGetCacheKey } from "../utils/apiClient";
import { getCacheEntry, isStaleAllowed, subscribeCache } from "../utils/localCache";

export default function useCachedGet(
    url,
    { params, ttlMs, staleMs, scope = "public", enabled = true } = {}
) {
    const paramsKey = useMemo(() => {
        if (!params || typeof params !== "object") return String(params || "");
        try {
            const keys = Object.keys(params).sort();
            return JSON.stringify(keys.map((k) => [k, params[k]]));
        } catch {
            return String(params);
        }
    }, [params]);

    const key = useMemo(() => makeGetCacheKey({ url, params, scope }), [url, paramsKey, scope]);

    const [data, setData] = useState(() => {
        const cached = getCacheEntry(key);
        if (!cached) return null;
        return isStaleAllowed(cached) ? cached.data : null;
    });
    const [loading, setLoading] = useState(Boolean(enabled && data === null));
    const [error, setError] = useState("");

    const refresh = useCallback(async ({ force = false } = {}) => {
        if (!enabled) return null;
        try {
            setLoading(true);
            setError("");
            const next = await cachedGet(url, { params, ttlMs, staleMs, scope, cacheKey: key, force });
            setData(next);
            return next;
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Request failed");
            return null;
        } finally {
            setLoading(false);
        }
    }, [enabled, key, paramsKey, scope, staleMs, ttlMs, url]);

    useEffect(() => {
        if (!enabled) return undefined;

        // Keep component in sync with cache updates (including background revalidation).
        return subscribeCache(key, (nextData) => {
            setData(nextData);
            if (nextData === null) {
                // Cache was deleted/invalidated; re-fetch.
                refresh({ force: true });
            }
        });
    }, [enabled, key, refresh]);

    useEffect(() => {
        if (!enabled) return;
        refresh();
    }, [enabled, key, refresh]);

    return { data, loading, error, refresh, cacheKey: key };
}
