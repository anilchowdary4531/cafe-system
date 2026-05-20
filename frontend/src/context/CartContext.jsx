import { createContext, useContext, useState } from "react";
import { showToast } from "../utils/toast";

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);

    const addToCart = (item, { silent = false } = {}) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.id === item.id);
            if (existing) {
                return prev.map((i) => (i.id === item.id ? { ...i, quantity: (i.quantity || 0) + 1 } : i));
            }
            return [...prev, { ...item, quantity: 1 }];
        });

        if (!silent) {
            const itemName = String(item?.name || "Item");
            showToast({
                title: "Added to cart",
                message: itemName,
                variant: "success",
                actionLabel: "Undo",
                onAction: () => {
                    setCart((prev) => {
                        const existing = prev.find((i) => i.id === item.id);
                        if (!existing) return prev;
                        if (Number(existing.quantity || 0) <= 1) return prev.filter((i) => i.id !== item.id);
                        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                    });
                },
            });
        }
    };

    const increaseQty = (id) => {
        setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: (i.quantity || 0) + 1 } : i)));
    };

    const decreaseQty = (id) => {
        setCart((prev) =>
            prev
                .map((i) => (i.id === id ? { ...i, quantity: (i.quantity || 0) - 1 } : i))
                .filter((i) => (i.quantity || 0) > 0)
        );
    };

    const removeFromCart = (id) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => {
        setCart([]);
    };

    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    return (
        <CartContext.Provider
            value={{ cart, addToCart, increaseQty, decreaseQty, removeFromCart, clearCart, total }}
        >
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);
