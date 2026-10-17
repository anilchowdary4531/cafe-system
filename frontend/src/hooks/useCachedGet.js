import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const [errorStatus, setErrorStatus] = useState(null);

    const inFlightPromiseRef = useRef(null);
    const inFlightKeyRef = useRef(null);

    // Sync state when cache key changes (e.g. from customer:session to customer:phone)
    useEffect(() => {
        const cached = getCacheEntry(key);
        if (cached && isStaleAllowed(cached)) {
            setData(cached.data);
            setError("");
            setErrorStatus(null);
        } else {
            setError("");
            setErrorStatus(null);
        }
    }, [key]);

    const refresh = useCallback(({ force = false } = {}) => {
        if (!enabled) return Promise.resolve(null);
        if (inFlightPromiseRef.current && inFlightKeyRef.current === key) {
            return inFlightPromiseRef.current;
        }

        const run = async () => {
            try {
                setLoading(true);
                setError("");
                setErrorStatus(null);
                const next = await cachedGet(url, { params, ttlMs, staleMs, scope, cacheKey: key, force });
                setData(next);
                setError("");
                setErrorStatus(null);
                return next;
            } catch (err) {
                const status = err?.response?.status ?? (err?.code === "ERR_NETWORK" || !err?.response ? 0 : null);
                setErrorStatus(status);
                setError(err?.response?.data?.message || err?.message || "Request failed");
                return null;
            } finally {
                setLoading(false);
                if (inFlightKeyRef.current === key) {
                    inFlightPromiseRef.current = null;
                    inFlightKeyRef.current = null;
                }
            }
        };

        const promise = run();
        inFlightPromiseRef.current = promise;
        inFlightKeyRef.current = key;
        return promise;
    }, [enabled, key, paramsKey, scope, staleMs, ttlMs, url]);

    useEffect(() => {
        if (!enabled) return undefined;

        // Keep component in sync with cache updates (including background revalidation).
        return subscribeCache(key, (nextData) => {
            setData(nextData);
            if (nextData !== null && nextData !== undefined) {
                setError("");
                setErrorStatus(null);
            } else if (nextData === null) {
                // Cache was deleted/invalidated; re-fetch.
                refresh({ force: true });
            }
        });
    }, [enabled, key, refresh]);

    useEffect(() => {
        if (!enabled) return;
        refresh();
    }, [enabled, key, refresh]);

    return { data, loading, error, errorStatus, refresh, cacheKey: key };
}

