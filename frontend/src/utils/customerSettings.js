const STORAGE_KEY = "customer_settings:v1";

export const DEFAULT_CUSTOMER_SETTINGS = {
    autoDetectNearestRestaurant: true,
    orderUpdateNotifications: true,
    promotionalNotifications: false,
    rememberSession: true,
    rememberTableSelection: true,
};

const safeParse = (raw) => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const getCustomerSettings = () => {
    if (typeof window === "undefined") return { ...DEFAULT_CUSTOMER_SETTINGS };
    const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return { ...DEFAULT_CUSTOMER_SETTINGS };
    return { ...DEFAULT_CUSTOMER_SETTINGS, ...stored };
};

export const setCustomerSettings = (patch = {}) => {
    if (typeof window === "undefined") return { ...DEFAULT_CUSTOMER_SETTINGS, ...(patch || {}) };
    const prev = getCustomerSettings();
    const next = { ...prev, ...(patch || {}) };
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // ignore quota / private mode
    }
    return next;
};

export const CUSTOMER_SETTINGS_STORAGE_KEY = STORAGE_KEY;

