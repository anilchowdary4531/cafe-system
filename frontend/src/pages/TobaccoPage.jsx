import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Search, ShoppingBag, ShieldAlert, Sparkles, X } from "lucide-react";
import axios from "axios";
import { API } from "../config";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import TobaccoAgeVerificationModal from "../components/tobacco/TobaccoAgeVerificationModal";
import BlinkitTobaccoCard from "../components/tobacco/BlinkitTobaccoCard";
import { useCart } from "../context/CartContext";
import {
    isTobaccoAgeConfirmed,
    setTobaccoAgeConfirmed,
    isTobaccoItem,
    isTobaccoCategory,
} from "../utils/tobaccoUtils";
import { showToast } from "../utils/toast";

export default function TobaccoPage() {
    const { token, slug, table } = useParams();
    const navigate = useNavigate();

    // Verification state
    const [isVerified, setIsVerified] = useState(() => isTobaccoAgeConfirmed());
    const [showAgeModal, setShowAgeModal] = useState(() => !isTobaccoAgeConfirmed());

    // Search & Data
    const [search, setSearch] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Global Cart for slug / standard routes
    const { addToCart, decreaseQty, cart: globalCart, total: globalTotal } = useCart();
    const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

    // QR Table Cart state (when route has token)
    const [tableCart, setTableCart] = useState(() => {
        if (typeof window !== "undefined" && token) {
            try {
                const saved = sessionStorage.getItem(`tiffzy_table_cart_${token}`);
                if (saved) return JSON.parse(saved);
            } catch {
                // ignore
            }
        }
        return {};
    });

    // Sync table cart to sessionStorage
    useEffect(() => {
        if (token && typeof window !== "undefined") {
            try {
                sessionStorage.setItem(`tiffzy_table_cart_${token}`, JSON.stringify(tableCart));
            } catch {
                // ignore
            }
        }
    }, [tableCart, token]);

    // Back button destination resolver
    const handleBack = useCallback(() => {
        if (token) {
            // Check if this came from digital menu or QR table ordering
            if (window.location.pathname.startsWith("/menu/")) {
                navigate(`/menu/${token}`, { replace: true });
            } else {
                navigate(`/order/table/${token}`, { replace: true });
            }
        } else if (slug) {
            if (table) {
                navigate(`/m/${slug}/${table}`, { replace: true });
            } else if (window.location.pathname.startsWith("/r/")) {
                navigate(`/r/${slug}/menu`, { replace: true });
            } else {
                navigate(`/m/${slug}`, { replace: true });
            }
        } else {
            if (window.history.length > 1) {
                navigate(-1);
            } else {
                navigate("/", { replace: true });
            }
        }
    }, [token, slug, table, navigate]);

    // Age verification handlers
    const handleConfirmAge = () => {
        setTobaccoAgeConfirmed(true);
        setIsVerified(true);
        setShowAgeModal(false);
    };

    const handleCancelAge = () => {
        setShowAgeModal(false);
        if (!isTobaccoAgeConfirmed()) {
            handleBack();
        }
    };

    // Load tobacco products ONLY when verified
    useEffect(() => {
        if (!isVerified) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        const fetchTobaccoProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = {};
                if (search.trim()) params.q = search.trim();
                if (token) params.token = token;
                if (slug) params.slug = slug;

                const res = await axios.get(`${API}/api/tobacco/items`, { params });
                if (!isMounted) return;

                const fetchedItems = Array.isArray(res.data?.items) ? res.data.items : [];
                // Defensive front-end safety: ensure zero non-tobacco items are displayed
                const strictlyTobacco = fetchedItems.filter((i) => isTobaccoItem(i) || isTobaccoCategory(i?.category));
                setItems(strictlyTobacco);
            } catch (err) {
                if (!isMounted) return;
                // Fallback attempt without /api prefix
                try {
                    const fallbackParams = {};
                    if (search.trim()) fallbackParams.q = search.trim();
                    if (token) fallbackParams.token = token;
                    if (slug) fallbackParams.slug = slug;

                    const resFallback = await axios.get(`${API}/tobacco/items`, { params: fallbackParams });
                    if (!isMounted) return;
                    const fetchedItems = Array.isArray(resFallback.data?.items) ? resFallback.data.items : [];
                    const strictlyTobacco = fetchedItems.filter((i) => isTobaccoItem(i) || isTobaccoCategory(i?.category));
                    setItems(strictlyTobacco);
                } catch (fallbackErr) {
                    if (!isMounted) return;
                    setError(fallbackErr?.response?.data?.message || "Failed to load tobacco products");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchTobaccoProducts();

        return () => {
            isMounted = false;
        };
    }, [isVerified, search, token, slug]);

    // Filter items locally by search query as well (defensive double-check)
    const filteredTobaccoItems = useMemo(() => {
        const query = search.trim().toLowerCase();
        return items.filter((item) => {
            // Must be tobacco
            if (!isTobaccoItem(item) && !isTobaccoCategory(item?.category)) return false;
            if (!query) return true;
            const name = String(item.name || "").toLowerCase();
            const desc = String(item.description || "").toLowerCase();
            const cat = String(item.category || "").toLowerCase();
            return name.includes(query) || desc.includes(query) || cat.includes(query);
        });
    }, [items, search]);

    // Cart Handlers
    const handleAddItem = (item) => {
        if (!isTobaccoAgeConfirmed()) {
            setShowAgeModal(true);
            return;
        }

        if (token) {
            // Table QR Cart
            const key = `item_${item.id}`;
            setTableCart((prev) => {
                const existing = prev[key];
                if (existing) {
                    return { ...prev, [key]: { ...existing, qty: existing.qty + 1 } };
                }
                return {
                    ...prev,
                    [key]: {
                        key,
                        menuItemId: item.id,
                        name: item.name,
                        price: Number(item.price || 0),
                        qty: 1,
                        variantName: null,
                        modifiers: [],
                    },
                };
            });
            showToast(`Added ${item.name}`, "success");
        } else {
            // Context Cart
            addToCart(item);
            showToast(`Added ${item.name}`, "success");
        }
    };

    const handleRemoveItem = (item) => {
        if (token) {
            const key = `item_${item.id}`;
            setTableCart((prev) => {
                const existing = prev[key];
                if (!existing) return prev;
                const newQty = existing.qty - 1;
                if (newQty <= 0) {
                    const copy = { ...prev };
                    delete copy[key];
                    return copy;
                }
                return { ...prev, [key]: { ...existing, qty: newQty } };
            });
        } else {
            decreaseQty(item.id);
        }
    };

    // Cart counts and totals
    const { totalCartCount, totalCartAmount } = useMemo(() => {
        if (token) {
            const itemsList = Object.values(tableCart);
            const count = itemsList.reduce((sum, i) => sum + (i.qty || 0), 0);
            const amount = itemsList.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 0), 0);
            return { totalCartCount: count, totalCartAmount: amount };
        } else {
            const count = Array.isArray(globalCart)
                ? globalCart.reduce((sum, i) => sum + (i.quantity || 1), 0)
                : 0;
            return { totalCartCount: count, totalCartAmount: Number(globalTotal || 0) };
        }
    }, [token, tableCart, globalCart, globalTotal]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                    {/* Back Button + Title */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition active:scale-95"
                            aria-label="Back to menu"
                        >
                            <ArrowLeft size={16} />
                            <span>Back</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                                <span>Tobacco Products</span>
                                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                    18+ Only
                                </span>
                            </h1>
                        </div>
                    </div>

                    {/* Cart Trigger */}
                    {totalCartCount > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (token) {
                                    handleBack();
                                } else {
                                    setCartDrawerOpen(true);
                                }
                            }}
                            className="flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition active:scale-95"
                        >
                            <ShoppingBag size={15} />
                            <span>Cart ({totalCartCount})</span>
                            <span className="hidden sm:inline font-black">₹{Math.round(totalCartAmount)}</span>
                        </button>
                    )}
                </div>

                {/* Scoped Search Input */}
                <div className="max-w-4xl mx-auto mt-2.5">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tobacco products..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 shadow-2xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-4xl mx-auto w-full px-4 py-5 flex-1">
                {/* Notice if unverified */}
                {!isVerified ? (
                    <div className="py-16 text-center space-y-4 rounded-3xl border border-amber-200 bg-amber-50/60 p-8 shadow-xs my-6">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-black text-xl border-2 border-orange-500">
                            18+
                        </div>
                        <h2 className="text-lg font-black text-slate-900">
                            Age Verification Required
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                            Tobacco products are restricted to adult customers of legal age. Please confirm your age to view available items.
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowAgeModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-md shadow-orange-500/20 transition active:scale-95"
                        >
                            Verify Age
                        </button>
                    </div>
                ) : loading ? (
                    <div className="py-20 text-center text-slate-400 flex items-center justify-center gap-2">
                        <Sparkles className="animate-spin text-orange-500" size={20} />
                        <span className="text-sm font-semibold">Loading tobacco products...</span>
                    </div>
                ) : error ? (
                    <div className="py-12 text-center space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 my-6">
                        <ShieldAlert className="mx-auto text-rose-500" size={36} />
                        <h3 className="font-bold text-rose-800 text-sm">{error}</h3>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="text-xs font-bold text-rose-600 underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredTobaccoItems.length === 0 ? (
                    <div className="py-16 text-center space-y-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-xs my-6">
                        <ShieldAlert className="mx-auto text-slate-300" size={40} />
                        <h3 className="font-bold text-slate-700 text-base">
                            {search ? `No tobacco products matching "${search}"` : "No Tobacco Products Available"}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            {search
                                ? "Try searching for a different brand or keyword."
                                : "No tobacco products are currently available for this menu."}
                        </p>
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="text-xs font-bold text-orange-600 underline"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-xs font-bold text-slate-500">
                                {filteredTobaccoItems.length}{" "}
                                {filteredTobaccoItems.length === 1 ? "product" : "products"} found
                            </span>
                        </div>

                        {/* Grid of ONLY Tobacco Products */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                            {filteredTobaccoItems.map((item) => {
                                const qty = token
                                    ? tableCart[`item_${item.id}`]?.qty || 0
                                    : globalCart?.find((c) => c.id === item.id)?.quantity || 0;

                                return (
                                    <BlinkitTobaccoCard
                                        key={item.id}
                                        item={item}
                                        quantity={qty}
                                        onAdd={handleAddItem}
                                        onRemove={handleRemoveItem}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* Floating Cart Button for Mobile */}
            {totalCartCount > 0 && (
                <div className="sticky bottom-4 z-40 px-4 max-w-4xl mx-auto w-full">
                    <button
                        type="button"
                        onClick={() => {
                            if (token) {
                                handleBack();
                            } else {
                                setCartDrawerOpen(true);
                            }
                        }}
                        className="w-full flex items-center justify-between rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-3.5 shadow-xl shadow-orange-500/25 transition active:scale-98"
                    >
                        <div className="flex items-center gap-2 font-bold text-sm">
                            <ShoppingBag size={18} />
                            <span>View Cart ({totalCartCount} items)</span>
                        </div>
                        <span className="font-extrabold text-base">₹{Math.round(totalCartAmount)}</span>
                    </button>
                </div>
            )}

            {/* Cart Drawer for standard routes */}
            {!token && (
                <CartDrawer open={cartDrawerOpen} setOpen={setCartDrawerOpen} />
            )}

            {/* Age Verification Modal */}
            <TobaccoAgeVerificationModal
                isOpen={showAgeModal}
                onConfirm={handleConfirmAge}
                onCancel={handleCancelAge}
            />

            <Footer />
        </div>
    );
}
