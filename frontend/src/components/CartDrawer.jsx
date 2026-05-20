import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40"
                    />

                    {/* DRAWER */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 120 }}
                        className="theme-page fixed right-0 top-0 z-50 flex h-full w-full flex-col p-5 sm:w-[400px]"
                    >

                        {/* HEADER */}
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Your Cart</h2>
                            <button onClick={() => setOpen(false)}>✕</button>
                        </div>

                        {/* ITEMS */}
                        <div className="flex-1 overflow-y-auto space-y-4">
                            {cart.length === 0 && (
                                <p className="theme-muted">Cart is empty</p>
                            )}

                            {cart.map((item) => (
                                <div
                                    key={item.id}
                                    className="theme-card flex items-center justify-between rounded-xl p-3"
                                >
                                    <div>
                                        <h4>{item.name}</h4>
                                        <p className="theme-muted text-sm">
                                            ₹{item.price}
                                        </p>
                                    </div>

                                    {/* QTY */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => decreaseQty(item.id)}
                                            className="theme-soft-button rounded px-2"
                                        >
                                            -
                                        </button>

                                        <span>{item.quantity}</span>

                                        <button
                                            onClick={() => increaseQty(item.id)}
                                            className="theme-button rounded px-2"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
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

                    </motion.div>
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
