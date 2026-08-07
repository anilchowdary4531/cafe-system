import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { showToast } from "../utils/toast";
import {
    ORDER_FLOW_SCOPES,
    resolveOrderFlowScope,
    setStoredOrderFlowScope,
} from "../utils/orderFlow";

const CartContext = createContext();

const STORAGE_PREFIX = "cafe_system:cart";

const getStorageKey = (scope) => `${STORAGE_PREFIX}:${scope}`;

const readStoredCart = (scope) => {
    try {
        const parsed = JSON.parse(localStorage.getItem(getStorageKey(scope)));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeStoredCart = (scope, cart) => {
    try {
        localStorage.setItem(getStorageKey(scope), JSON.stringify(cart));
    } catch {
        // ignore storage access failures
    }
};

export function CartProvider({ children }) {
    const location = useLocation();
    const [cartsByScope, setCartsByScope] = useState(() => ({
        [ORDER_FLOW_SCOPES.ONLINE]: readStoredCart(ORDER_FLOW_SCOPES.ONLINE),
        [ORDER_FLOW_SCOPES.TABLE]: readStoredCart(ORDER_FLOW_SCOPES.TABLE),
    }));
    const [activeScope, setActiveScope] = useState(() => resolveOrderFlowScope(window.location.pathname));

    useEffect(() => {
        const nextScope = resolveOrderFlowScope(location.pathname);
        setActiveScope(nextScope);
    }, [location.pathname]);

    const scope = activeScope === ORDER_FLOW_SCOPES.TABLE ? ORDER_FLOW_SCOPES.TABLE : ORDER_FLOW_SCOPES.ONLINE;
    const cart = cartsByScope[scope] || [];

    const updateCart = useCallback((updater) => {
        setCartsByScope((prev) => {
            const currentScope = resolveOrderFlowScope(window.location.pathname) || scope;
            const active = currentScope === ORDER_FLOW_SCOPES.TABLE ? ORDER_FLOW_SCOPES.TABLE : ORDER_FLOW_SCOPES.ONLINE;
            const currentCart = prev[active] || [];
            const nextCart = typeof updater === "function" ? updater(currentCart) : updater;
            const normalized = Array.isArray(nextCart) ? nextCart : [];

            if (normalized === currentCart) return prev;

            writeStoredCart(active, normalized);
            setStoredOrderFlowScope(active);

            return {
                ...prev,
                [active]: normalized,
            };
        });

        const currentScope = resolveOrderFlowScope(window.location.pathname) || scope;
        setActiveScope(currentScope === ORDER_FLOW_SCOPES.TABLE ? ORDER_FLOW_SCOPES.TABLE : ORDER_FLOW_SCOPES.ONLINE);
    }, [scope]);

    const addToCart = useCallback((item, { silent = false } = {}) => {
        updateCart((currentCart) => {
            const existing = currentCart.find((i) => i.id === item.id);
            if (existing) {
                return currentCart.map((i) =>
                    i.id === item.id ? { ...i, quantity: (i.quantity || 0) + 1 } : i
                );
            }

            return [...currentCart, { ...item, quantity: 1 }];
        });

        if (!silent) {
            const itemName = String(item?.name || "Item");
            showToast({
                title: "Added to cart",
                message: itemName,
                variant: "success",
                actionLabel: "Undo",
                onAction: () => {
                    updateCart((currentCart) => {
                        const existing = currentCart.find((i) => i.id === item.id);
                        if (!existing) return currentCart;
                        if (Number(existing.quantity || 0) <= 1) {
                            return currentCart.filter((i) => i.id !== item.id);
                        }
                        return currentCart.map((i) =>
                            i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i
                        );
                    });
                },
            });
        }
    }, [updateCart]);

    const increaseQty = useCallback((id) => {
        updateCart((currentCart) =>
            currentCart.map((i) => (i.id === id ? { ...i, quantity: (i.quantity || 0) + 1 } : i))
        );
    }, [updateCart]);

    const decreaseQty = useCallback((id) => {
        updateCart((currentCart) =>
            currentCart
                .map((i) => (i.id === id ? { ...i, quantity: (i.quantity || 0) - 1 } : i))
                .filter((i) => (i.quantity || 0) > 0)
        );
    }, [updateCart]);

    const removeFromCart = useCallback((id) => {
        updateCart((currentCart) => currentCart.filter((item) => item.id !== id));
    }, [updateCart]);

    const clearCart = useCallback(() => {
        updateCart([]);
    }, [updateCart]);

    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const value = useMemo(
        () => ({
            cart,
            addToCart,
            increaseQty,
            decreaseQty,
            removeFromCart,
            clearCart,
            total,
        }),
        [addToCart, cart, clearCart, decreaseQty, increaseQty, removeFromCart, total]
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext) || { cart: [], addToCart: () => {}, total: 0, increaseQty: () => {}, decreaseQty: () => {}, removeFromCart: () => {}, clearCart: () => {} };
