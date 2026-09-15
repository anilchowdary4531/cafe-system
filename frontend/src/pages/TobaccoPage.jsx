import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ArrowLeft, ShoppingBag, ShieldAlert, Sparkles, Filter } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import TobaccoBanner from "../components/tobacco/TobaccoBanner";
import TobaccoAgeVerificationModal from "../components/tobacco/TobaccoAgeVerificationModal";
import BlinkitTobaccoCard from "../components/tobacco/BlinkitTobaccoCard";
import { useCart } from "../context/CartContext";
import useCachedGet from "../hooks/useCachedGet";
import {
    TOBACCO_QUICK_TAGS,
    isTobaccoAgeConfirmed,
    setTobaccoAgeConfirmed,
} from "../utils/tobaccoUtils";

export default function TobaccoPage() {
    const navigate = useNavigate();
    const { addToCart, removeFromCart, cart, total } = useCart();
    const [search, setSearch] = useState("");
    const [showAgeModal, setShowAgeModal] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState(null);
    const itemsSectionRef = React.useRef(null);

    // Verify age confirmation on initial load
    useEffect(() => {
        if (!isTobaccoAgeConfirmed()) {
            setShowAgeModal(true);
        }
    }, []);

    // Fetch real tobacco items from backend API
    const { data, loading, error } = useCachedGet("/tobacco/items", {
        params: { q: search },
        ttlMs: 5_000,
        staleMs: 15_000,
    });

    const items = Array.isArray(data?.items) ? data.items : [];

    const handleViewItems = () => {
        if (!isTobaccoAgeConfirmed()) {
            setShowAgeModal(true);
        } else {
            itemsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    const handleAgeConfirm = () => {
        setTobaccoAgeConfirmed();
        setShowAgeModal(false);
        if (pendingItem) {
            addToCart(pendingItem);
            setPendingItem(null);
        } else {
            itemsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    const handleAgeCancel = () => {
        setShowAgeModal(false);
        setPendingItem(null);
        // If user cancels on initial page load without confirming age, navigate back home
        if (!isTobaccoAgeConfirmed()) {
            navigate("/", { replace: true });
        }
    };

    const handleAddItem = (item) => {
        if (!isTobaccoAgeConfirmed()) {
            setPendingItem(item);
            setShowAgeModal(true);
            return;
        }
        addToCart(item);
    };

    const cartCount = cart.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

    return (
        <div className="theme-page min-h-screen flex flex-col">
            {/* Header */}
            <header className="theme-nav sticky top-0 z-30 border-b px-3 py-3 sm:px-6 md:px-8">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                            aria-label="Back to home"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-300/40 bg-white p-1 shadow-md">
                                <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                            </div>
                            <div>
                                <h1 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight sm:text-lg flex items-center gap-1.5">
                                    <span>Tobacco Store</span>
                                    <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        18+ Only
                                    </span>
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full max-w-[320px] sm:max-w-[420px]">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search cigarettes, paan, tobacco..."
                            className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2 pl-9 pr-4 text-xs sm:text-sm outline-none shadow-xs focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 md:px-8 flex-1 w-full space-y-6">
                {/* Tobacco Banner */}
                <TobaccoBanner onViewItems={handleViewItems} />

                {/* Quick Tag Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {TOBACCO_QUICK_TAGS.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => {
                                setSearch(tag);
                                itemsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 shadow-2xs ${
                                search.toLowerCase() === tag.toLowerCase()
                                    ? "bg-emerald-700 text-white border-emerald-800"
                                    : "border-rose-200/60 bg-[#fff5f5] dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 hover:bg-rose-100/70"
                            }`}
                        >
                            <span className="text-xs">🚬</span>
                            <span>{tag}</span>
                        </button>
                    ))}
                    {search ? (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                        >
                            Clear Filter
                        </button>
                    ) : null}
                </div>

                {/* Section Title */}
                <div ref={itemsSectionRef} className="flex items-center justify-between pt-2">
                    <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                        {search ? `Results for "${search}"` : "Cigarettes & Tobacco Products"}
                    </h2>
                    <span className="text-xs font-bold text-zinc-500">
                        {items.length} {items.length === 1 ? "product" : "products"} available
                    </span>
                </div>

                {/* Loading / Empty / Products Grid */}
                {loading && items.length === 0 ? (
                    <div className="py-16 text-center text-zinc-400 flex items-center justify-center gap-2">
                        <Sparkles className="animate-spin text-amber-500" size={20} /> Loading tobacco products...
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-16 text-center space-y-3 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-8 shadow-xs">
                        <ShieldAlert className="mx-auto text-amber-500" size={44} />
                        <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            No Tobacco Products Available
                        </h3>
                        <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                            No tobacco items have been added yet by Super Admin approved restaurants. Ask your local store/admin to enable tobacco sales.
                        </p>
                    </div>
                ) : (
                    /* Products Grid */
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {items.map((item) => {
                            const cartItem = cart.find((c) => c.id === item.id);
                            const qty = cartItem ? cartItem.quantity : 0;
                            return (
                                <BlinkitTobaccoCard
                                    key={item.id}
                                    item={item}
                                    quantity={qty}
                                    onAdd={handleAddItem}
                                    onRemove={(i) => removeFromCart && removeFromCart(i.id)}
                                />
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Cart Button */}
            {cartCount > 0 && (
                <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="fixed bottom-4 left-3 right-3 z-40 mx-auto flex max-w-[520px] items-center justify-between gap-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-3.5 shadow-2xl transition active:scale-95 sm:left-auto sm:right-6 sm:w-[320px]"
                >
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <ShoppingBag size={18} />
                        <span>View Cart ({cartCount})</span>
                    </div>
                    <span className="font-extrabold text-base">₹{Math.round(Number(total || 0))}</span>
                </button>
            )}

            <CartDrawer open={cartOpen} setOpen={setCartOpen} />

            {/* Age Verification Modal */}
            <TobaccoAgeVerificationModal
                isOpen={showAgeModal}
                onConfirm={handleAgeConfirm}
                onCancel={handleAgeCancel}
            />

            <Footer />
        </div>
    );
}
