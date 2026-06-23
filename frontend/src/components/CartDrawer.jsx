import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import CheckoutPrompt from "./CheckoutPrompt";

export default function CartDrawer({ open, setOpen }) {
    const { cart, increaseQty, decreaseQty, total, clearCart } = useCart();
    const [checkoutOpen, setCheckoutOpen] = useState(false);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* BACKDROP */}
                    <div
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40"
                    />

                    {/* DRAWER */}
                    <div
                        className="theme-page fixed right-0 top-0 z-50 flex h-full w-full flex-col p-4 sm:w-[400px] sm:p-5"
                    >

                        {/* HEADER */}
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">Your Cart</h2>
                            <button onClick={() => setOpen(false)} className="theme-soft-button rounded-full p-2">
                                ✕
                            </button>
                        </div>

                        {/* ITEMS */}
                        <div className="flex-1 overflow-y-auto">
                            {cart.length === 0 && (
                                <p className="theme-muted">Cart is empty</p>
                            )}

                            <div className="space-y-4">
                                {cart.map((item) => (
                                    <div key={item.id} className="pb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h4 className="truncate text-base font-semibold">{item.name}</h4>
                                                <p className="theme-muted mt-0.5 text-sm">₹{item.price}</p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    onClick={() => decreaseQty(item.id)}
                                                    className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-full"
                                                >
                                                    -
                                                </button>

                                                <span className="min-w-5 text-center text-sm font-semibold tabular-nums">
                                                    {item.quantity}
                                                </span>

                                                <button
                                                    onClick={() => increaseQty(item.id)}
                                                    className="theme-button inline-flex h-8 w-8 items-center justify-center rounded-full"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="theme-border mt-4 border-t pt-4">

                            <div className="mb-4 flex justify-between">
                                <span>Total</span>
                                <span>₹{total}</span>
                            </div>

                            <button
                                onClick={() => setCheckoutOpen(true)}
                                className="theme-button w-full rounded-xl py-3 font-bold"
                            >
                                Checkout
                            </button>

                        </div>

                    </div>
                    <CheckoutPrompt
                        open={checkoutOpen}
                        onClose={() => setCheckoutOpen(false)}
                        cart={cart}
                        clearCart={clearCart}
                    />
                </>
            )}
        </AnimatePresence>
    );
}
