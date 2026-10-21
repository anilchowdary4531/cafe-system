import { getStoredOrderFlowScope, ORDER_FLOW_SCOPES } from "./orderFlow";
import { getActiveStaffSession } from "./staffSessionStorage";

const STORAGE_PREFIX = "cafe_system:restaurant_context";
const LEGACY_STORAGE_KEY = "restaurant_context";

const getStorageKey = (scope) => `${STORAGE_PREFIX}:${scope}`;

const safeParse = (value) => {
    try {
        return JSON.parse(value) || {};
    } catch {
        return {};
    }
};

export const getStoredRestaurantContext = (scope) => {
    const resolvedScope =
        scope === ORDER_FLOW_SCOPES.TABLE || scope === ORDER_FLOW_SCOPES.ONLINE
            ? scope
            : getStoredOrderFlowScope();

    try {
        const value = localStorage.getItem(getStorageKey(resolvedScope));
        if (value) return safeParse(value);

        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) return safeParse(legacy);
    } catch {
        // ignore storage access failures
    }

    return {};
};

export const setStoredRestaurantContext = (context = {}, scope) => {
    const resolvedScope =
        scope === ORDER_FLOW_SCOPES.TABLE || scope === ORDER_FLOW_SCOPES.ONLINE
            ? scope
            : getStoredOrderFlowScope();

    try {
        const previous = getStoredRestaurantContext(resolvedScope);
        const next = { ...previous, ...context };
        localStorage.setItem(getStorageKey(resolvedScope), JSON.stringify(next));
        return next;
    } catch {
        return context;
    }
};

export const resolveRestaurantName = (user, fallback = "Tiffzy") => {
    const fromUserRestaurant = user?.restaurant?.name || user?.restaurantName || null;

    if (fromUserRestaurant) return fromUserRestaurant;

    const role = String(user?.role || "").toUpperCase();
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
        return "All Restaurants";
    }

    const fromStorage = getStoredRestaurantContext();
    if (fromStorage?.name) return fromStorage.name;

    return fallback;
};

export const resolveAuthoritativeRestaurantId = (user, fallbackCandidate = null) => {
    const fromCandidate = Number(fallbackCandidate || 0);
    if (fromCandidate > 0 && !isNaN(fromCandidate)) return fromCandidate;

    const fromUser = Number(user?.restaurantId || user?.restaurant?.id || 0);
    if (fromUser > 0 && !isNaN(fromUser)) return fromUser;

    try {
        const activeUser = typeof getActiveStaffSession === "function" ? getActiveStaffSession()?.user : null;
        const fromActive = Number(activeUser?.restaurantId || activeUser?.restaurant?.id || 0);
        if (fromActive > 0 && !isNaN(fromActive)) return fromActive;
    } catch {
        // ignore
    }

    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const stored = JSON.parse(window.localStorage.getItem("user") || "null");
            const fromStored = Number(stored?.restaurantId || stored?.restaurant?.id || 0);
            if (fromStored > 0 && !isNaN(fromStored)) return fromStored;

            const fromStorage = Number(
                window.localStorage.getItem("restaurantId") ||
                window.localStorage.getItem("activeRestaurantId") ||
                0
            );
            if (fromStorage > 0 && !isNaN(fromStorage)) return fromStorage;
        }
    } catch {
        // ignore
    }

    try {
        const fromContext = Number(getStoredRestaurantContext()?.id || 0);
        if (fromContext > 0 && !isNaN(fromContext)) return fromContext;
    } catch {
        // ignore
    }

    return 0;
};

