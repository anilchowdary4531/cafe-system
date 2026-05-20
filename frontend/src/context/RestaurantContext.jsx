import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getStoredRestaurantContext, setStoredRestaurantContext } from "../utils/restaurantContext";

const RestaurantContext = createContext(null);

export function RestaurantContextProvider({ children }) {
    const [restaurantContext, setRestaurantContextState] = useState(() => getStoredRestaurantContext());

    const setRestaurantContext = useCallback((patch = {}) => {
        const updates = patch && typeof patch === "object" ? patch : {};

        // Important: keep this callback stable so consumers can safely depend on it in `useEffect`.
        // Also, avoid re-setting state when nothing actually changed (prevents render loops).
        setRestaurantContextState((prev) => {
            const entries = Object.entries(updates);
            if (entries.length === 0) return prev;

            const changed = entries.some(([key, value]) => !Object.is(prev?.[key], value));
            if (!changed) return prev;

            return setStoredRestaurantContext(updates);
        });
    }, []);

    const value = useMemo(
        () => ({
            restaurantContext,
            setRestaurantContext,
        }),
        [restaurantContext, setRestaurantContext]
    );

    return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurantContext() {
    const ctx = useContext(RestaurantContext);
    if (!ctx) {
        throw new Error("useRestaurantContext must be used inside RestaurantContextProvider");
    }
    return ctx;
}
