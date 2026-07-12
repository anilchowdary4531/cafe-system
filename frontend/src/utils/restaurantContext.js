import { getStoredOrderFlowScope, ORDER_FLOW_SCOPES } from "./orderFlow";

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
