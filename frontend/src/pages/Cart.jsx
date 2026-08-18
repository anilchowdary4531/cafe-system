import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CheckoutPrompt from "../components/CheckoutPrompt";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import Footer from "../components/Footer";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

export default function Cart() {
    const navigate = useNavigate();
    const location = useLocation();
    const { customer, customerToken } = useAuth();
    const {
        cart,
        removeFromCart,
        clearCart,
        increaseQty,
        decreaseQty,
    } = useCart();
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const { restaurantContext } = useRestaurantContext();
    const slug = String(restaurantContext?.slug || "").trim();
    const isTableSession = Boolean(String(restaurantContext?.tableNo || "").trim());

    const subtotal = cart.reduce(
        (sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
        0
    );

    const { data: menuData } = useCachedGet(slug ? `/r/${slug}/menu` : "/r/_/menu", {
        enabled: Boolean(slug) && cart.length > 0,
        ttlMs: 2 * 60_000,
        staleMs: 30 * 60_000,
        scope: `restaurant:${slug}`,
    });

    const taxEnabled = Boolean(menuData?.restaurant?.taxEnabled);
    const taxPercent = Number(menuData?.restaurant?.taxPercent || 0);
    const tax = taxEnabled ? (subtotal * taxPercent) / 100 : 0;
    const total = subtotal + tax;
    const isCustomerLoggedIn = Boolean(customerToken || customer);
    const toMoney = (value) => {
        const n = Number(value || 0);
        if (!Number.isFinite(n)) return "0.00";
        return n.toFixed(2);
    };

    const handleCheckout = () => {
        if (isCustomerLoggedIn || isTableSession) {
            setCheckoutOpen(true);
            return;
        }

        navigate("/login?mode=customer", {
            state: {
                from: {
                    pathname: location.pathname,
                    search: location.search,
                    hash: location.hash,
                },
            },
        });
    };

    return (
        <>
            <div className="theme-page min-h-screen px-4 py-10 pb-28 md:px-8 md:pb-12">
                <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <h1 className="mb-8 text-4xl font-bold">Your Cart</h1>

                        {cart.length === 0 && (
                            <div className="theme-panel rounded-3xl p-10 text-center backdrop-blur-xl">
                                <h2 className="mb-4 text-2xl">Cart is empty</h2>

                                <Link
                                    to={buildRestaurantMenuPath(slug, restaurantContext?.tableNo)}
                                    className="theme-button inline-block rounded-xl px-6 py-3"
                                >
                                    Browse Menu
                                </Link>
                            </div>
                        )}

                        <div className="space-y-5">
                            {cart.map((item) => (
                                <div
                                    key={item.id}
                                    className="theme-panel flex items-center gap-4 rounded-3xl p-4 backdrop-blur-xl"
                                >
                                    <img
                                        src={resolveImageUrl(item.image) || FALLBACK_IMAGE}
                                        alt={item.name}
                                        className="h-24 w-24 rounded-2xl object-cover"
                                    />

                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-lg font-semibold">{item.name}</h2>
                                        <p className="theme-muted mt-1 text-sm tabular-nums">₹{toMoney(item.price)}</p>
                                    </div>

                                    <div className="flex flex-col items-end gap-3">
                                        <div className="theme-card flex items-center gap-3 rounded-full px-2 py-1">
                                            <button
                                                onClick={() => decreaseQty(item.id)}
                                                className="theme-soft-button h-8 w-8 rounded-full"
                                            >
                                                -
                                            </button>

                                            <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{Math.max(1, Number(item.quantity || 1))}</span>

                                            <button
                                                onClick={() => increaseQty(item.id)}
                                                className="theme-button h-8 w-8 rounded-full"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="theme-muted text-sm underline decoration-dotted underline-offset-4 hover:text-red-300"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {cart.length > 0 && (
                        <div className="sticky top-10 h-fit">
                            <div className="theme-panel rounded-3xl p-6 backdrop-blur-xl">
                                <h2 className="text-2xl font-bold">Billing</h2>

                                <div className="mt-6 space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span className="tabular-nums">₹{toMoney(subtotal)}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>{taxEnabled ? `Tax (${toMoney(taxPercent)}%)` : "Tax"}</span>
                                        <span className="tabular-nums">₹{toMoney(tax)}</span>
                                    </div>
                                </div>

                                <hr className="theme-border my-5" />

                                <div className="flex justify-between text-xl font-bold">
                                    <span>Total</span>
                                    <span className="theme-price tabular-nums">₹{toMoney(total)}</span>
                                </div>

                                <button
                                    onClick={handleCheckout}
                                    className="theme-button mt-6 hidden w-full rounded-2xl py-4 text-lg font-bold transition md:block"
                                >
                                    Pay ₹{toMoney(total)}
                                </button>

                                <Link
                                    to={buildRestaurantMenuPath(slug, restaurantContext?.tableNo)}
                                    className="theme-muted mt-4 block text-center hover:opacity-80"
                                >
                                    Continue Shopping
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {cart.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/60 backdrop-blur md:hidden">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                            <p className="theme-muted text-[10px] font-extrabold uppercase tracking-[0.28em]">Total</p>
                            <p className="truncate text-lg font-bold tabular-nums">₹{toMoney(total)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCheckout}
                            className="theme-button rounded-2xl px-6 py-3 text-sm font-semibold"
                        >
                            Pay ₹{toMoney(total)}
                        </button>
                    </div>
                </div>
            )}

            <CheckoutPrompt
                open={checkoutOpen}
                onClose={() => setCheckoutOpen(false)}
                cart={cart}
                clearCart={clearCart}
            />
            <Footer />
        </>
    );
}
