const STORAGE_KEY = "customer_favorites:v1";

const safeParse = (raw) => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const getCustomerFavorites = () => {
    if (typeof window === "undefined") return [];
    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
};

export const setCustomerFavorites = (next) => {
    if (typeof window === "undefined") return Array.isArray(next) ? next : [];
    const value = Array.isArray(next) ? next : [];
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        // ignore quota / private mode
    }
    return value;
};

export const toggleFavoriteMenuItem = ({ restaurantSlug, restaurantName, item } = {}) => {
    const slug = String(restaurantSlug || "").trim();
    const name = String(restaurantName || "").trim();
    const menuItemId = Number(item?.id || 0);
    if (!slug || !menuItemId) return { next: getCustomerFavorites(), added: false, removed: false };

    const current = getCustomerFavorites();
    const key = `${slug}:${menuItemId}`;
    const exists = current.some((fav) => String(fav?.key || "") === key);

    const now = new Date().toISOString();

    if (exists) {
        const next = current.filter((fav) => String(fav?.key || "") !== key);
        return { next: setCustomerFavorites(next), added: false, removed: true };
    }

    const next = [
        {
            key,
            type: "menu_item",
            restaurantSlug: slug,
            restaurantName: name || slug,
            menuItemId,
            itemName: String(item?.name || "Item"),
            image: String(item?.image || ""),
            price: Number(item?.price || 0),
            addedAt: now,
        },
        ...current,
    ];
    return { next: setCustomerFavorites(next), added: true, removed: false };
};

export const isMenuItemFavorite = ({ restaurantSlug, menuItemId } = {}) => {
    const slug = String(restaurantSlug || "").trim();
    const id = Number(menuItemId || 0);
    if (!slug || !id) return false;
    const key = `${slug}:${id}`;
    return getCustomerFavorites().some((fav) => String(fav?.key || "") === key);
};

export const CUSTOMER_FAVORITES_STORAGE_KEY = STORAGE_KEY;

