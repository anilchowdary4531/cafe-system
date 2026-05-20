import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
    DEFAULT_RESTAURANT_THEME_ID,
    THEME_STORAGE_KEY,
    getRestaurantTheme,
    isRestaurantThemeId,
    restaurantThemes,
} from "../theme/restaurantThemes";

const RestaurantThemeContext = createContext(null);

const getInitialThemeId = () => {
    if (typeof window === "undefined") return DEFAULT_RESTAURANT_THEME_ID;

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isRestaurantThemeId(storedTheme) ? storedTheme : DEFAULT_RESTAURANT_THEME_ID;
};

export function RestaurantThemeProvider({ children }) {
    const [themeId, setThemeId] = useState(getInitialThemeId);

    const activeTheme = useMemo(() => getRestaurantTheme(themeId), [themeId]);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.appTheme = activeTheme.id;
        root.dataset.appThemeTone = activeTheme.tone;
        window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme.id);
    }, [activeTheme]);

    const value = useMemo(
        () => ({
            activeTheme,
            themeId: activeTheme.id,
            themes: restaurantThemes,
            setThemeId: (nextThemeId) => {
                if (isRestaurantThemeId(nextThemeId)) {
                    setThemeId(nextThemeId);
                }
            },
        }),
        [activeTheme]
    );

    return (
        <RestaurantThemeContext.Provider value={value}>
            {children}
        </RestaurantThemeContext.Provider>
    );
}

export function useRestaurantTheme() {
    const context = useContext(RestaurantThemeContext);
    if (!context) {
        throw new Error("useRestaurantTheme must be used inside RestaurantThemeProvider");
    }
    return context;
}
