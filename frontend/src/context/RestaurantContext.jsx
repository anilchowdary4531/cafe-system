import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    ORDER_FLOW_SCOPES,
    resolveOrderFlowScope,
    setStoredOrderFlowScope,
} from "../utils/orderFlow";

const RestaurantContext = createContext(null);

const STORAGE_PREFIX = "cafe_system:restaurant_context";

const getStorageKey = (scope) => `${STORAGE_PREFIX}:${scope}`;

const readStoredContext = (scope) => {
    try {
        return JSON.parse(localStorage.getItem(getStorageKey(scope))) || {};
    } catch {
        return {};
    }
};

const writeStoredContext = (scope, context = {}) => {
    try {
        const previous = readStoredContext(scope);
        const next = { ...previous, ...context };
        localStorage.setItem(getStorageKey(scope), JSON.stringify(next));
        return next;
    } catch {
        return context;
    }
};

export function RestaurantContextProvider({ children }) {
    const location = useLocation();
    const [contextsByScope, setContextsByScope] = useState(() => ({
        [ORDER_FLOW_SCOPES.ONLINE]: readStoredContext(ORDER_FLOW_SCOPES.ONLINE),
        [ORDER_FLOW_SCOPES.TABLE]: readStoredContext(ORDER_FLOW_SCOPES.TABLE),
    }));
    const [activeScope, setActiveScope] = useState(() => resolveOrderFlowScope(window.location.pathname));

    useEffect(() => {
        const nextScope = resolveOrderFlowScope(location.pathname);
        setActiveScope(nextScope);
    }, [location.pathname]);

    const restaurantContext = useMemo(() => {
        return contextsByScope[activeScope] || {};
    }, [activeScope, contextsByScope]);

    const setRestaurantContext = useCallback((patch = {}) => {
        const updates = patch && typeof patch === "object" ? patch : {};

        setContextsByScope((prev) => {
            const currentScope = resolveOrderFlowScope(window.location.pathname) || activeScope;
            const scope = currentScope === ORDER_FLOW_SCOPES.TABLE ? ORDER_FLOW_SCOPES.TABLE : ORDER_FLOW_SCOPES.ONLINE;
            const currentContext = prev[scope] || {};
            const nextEntries = Object.entries(updates);
            if (nextEntries.length === 0) return prev;

            const changed = nextEntries.some(([key, value]) => !Object.is(currentContext?.[key], value));
            if (!changed) return prev;

            const nextContext = writeStoredContext(scope, updates);
            setStoredOrderFlowScope(scope);

            return {
                ...prev,
                [scope]: nextContext,
            };
        });

        const scope = resolveOrderFlowScope(window.location.pathname) || activeScope;
        setActiveScope(scope === ORDER_FLOW_SCOPES.TABLE ? ORDER_FLOW_SCOPES.TABLE : ORDER_FLOW_SCOPES.ONLINE);
    }, [activeScope]);

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
