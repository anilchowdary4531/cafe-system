const CACHE_PREFIX = "cafe_system_cache:v1:";
const INDEX_KEY = `${CACHE_PREFIX}__index__`;

const memory = new Map();
const listeners = new Map();

const now = () => Date.now();

const safeParse = (raw) => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const readIndex = () => {
    const parsed = safeParse(localStorage.getItem(INDEX_KEY));
    return Array.isArray(parsed) ? parsed : [];
};

const writeIndex = (keys) => {
    try {
        localStorage.setItem(INDEX_KEY, JSON.stringify(keys));
    } catch {
        // ignore quota / private mode
    }
};

const addToIndex = (key) => {
    const keys = readIndex();
    if (!keys.includes(key)) {
        keys.push(key);
        writeIndex(keys);
    }
};

const removeFromIndex = (key) => {
    const keys = readIndex().filter((k) => k !== key);
    writeIndex(keys);
};

const emit = (fullKey, entry) => {
    const subs = listeners.get(fullKey);
    if (!subs || subs.size === 0) return;
    subs.forEach((fn) => {
        try {
            fn(entry?.data ?? null, entry || null);
        } catch {
            // ignore listener errors
        }
    });
};

export const buildCacheKey = (key) => `${CACHE_PREFIX}${String(key)}`;

export const getCacheEntry = (key) => {
    const fullKey = buildCacheKey(key);

    const inMem = memory.get(fullKey);
    if (inMem) return inMem;

    const stored = safeParse(localStorage.getItem(fullKey));
    if (!stored) return null;

    memory.set(fullKey, stored);
    return stored;
};

export const getCachedValue = (key) => {
    const entry = getCacheEntry(key);
    return entry?.data ?? null;
};

export const setCacheEntry = (key, entry) => {
    const fullKey = buildCacheKey(key);
    const next = { ...entry };

    memory.set(fullKey, next);
    addToIndex(fullKey);

    try {
        localStorage.setItem(fullKey, JSON.stringify(next));
    } catch {
        // ignore quota / private mode
    }

    emit(fullKey, next);
};

export const deleteCacheEntry = (key) => {
    const fullKey = buildCacheKey(key);
    memory.delete(fullKey);
    removeFromIndex(fullKey);
    try {
        localStorage.removeItem(fullKey);
    } catch {
        // ignore
    }
    emit(fullKey, null);
};

export const subscribeCache = (key, listener) => {
    const fullKey = buildCacheKey(key);
    const set = listeners.get(fullKey) || new Set();
    set.add(listener);
    listeners.set(fullKey, set);

    return () => {
        const current = listeners.get(fullKey);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) listeners.delete(fullKey);
    };
};

export const clearAllCache = () => {
    const keys = readIndex();
    keys.forEach((fullKey) => {
        memory.delete(fullKey);
        try {
            localStorage.removeItem(fullKey);
        } catch {
            // ignore
        }
    });
    writeIndex([]);
};

export const pruneCache = () => {
    const keys = readIndex();
    const keep = [];
    const t = now();

    for (const fullKey of keys) {
        const entry = safeParse(localStorage.getItem(fullKey));
        if (!entry) continue;

        const expiresAt = Number(entry.expiresAt || 0);
        if (expiresAt && expiresAt <= t) {
            try {
                localStorage.removeItem(fullKey);
            } catch {
                // ignore
            }
            memory.delete(fullKey);
            continue;
        }
        keep.push(fullKey);
    }

    writeIndex(keep);
};

export const makeCacheEntry = ({ data, ttlMs }) => {
    const createdAt = now();
    const expiresAt = ttlMs ? createdAt + Number(ttlMs) : 0; // 0 means "never"
    return { createdAt, expiresAt, staleExpiresAt: expiresAt, data };
};

export const isFresh = (entry) => {
    if (!entry) return false;
    const expiresAt = Number(entry.expiresAt || 0);
    return !expiresAt || expiresAt > now();
};

export const isStaleAllowed = (entry) => {
    if (!entry) return false;
    const staleExpiresAt = Number(entry.staleExpiresAt || entry.expiresAt || 0);
    return !staleExpiresAt || staleExpiresAt > now();
};
