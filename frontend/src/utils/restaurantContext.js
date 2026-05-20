const STORAGE_KEY = "restaurant_context";

export const getStoredRestaurantContext = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
};

export const setStoredRestaurantContext = (context = {}) => {
    try {
        const previous = getStoredRestaurantContext();
        const next = { ...previous, ...context };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
    } catch {
        return context;
    }
};

export const resolveRestaurantName = (user, fallback = "Suretra") => {
    const fromUserRestaurant =
        user?.restaurant?.name ||
        user?.restaurantName ||
        null;

    if (fromUserRestaurant) return fromUserRestaurant;

    const role = String(user?.role || "").toUpperCase();
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
        return "All Restaurants";
    }

    const fromStorage = getStoredRestaurantContext();
    if (fromStorage?.name) return fromStorage.name;

    return fallback;
};
