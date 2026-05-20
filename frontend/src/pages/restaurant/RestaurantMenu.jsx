import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Star, Plus, Search, MapPin, ShoppingBag, LogIn, UserCircle2, Heart } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useRestaurantContext } from "../../context/RestaurantContext";
import CartDrawer from "../../components/CartDrawer";
import ThemeSelector from "../../components/ThemeSelector";
import RestaurantSelector from "../../components/RestaurantSelector";
import TableSelector from "../../components/TableSelector";
import useCachedGet from "../../hooks/useCachedGet";
import { useAuth } from "../../context/AuthContext";
import { getCustomerFavorites, toggleFavoriteMenuItem } from "../../utils/customerFavorites";
import { showToast } from "../../utils/toast";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

export default function RestaurantMenu() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const { customer, customerToken } = useAuth();

    const tableFromUrl = String(searchParams.get("table") || "").trim();
    const tableFromContext = useMemo(() => {
        // Only trust stored tableNo when it's for the same restaurant slug.
        if (String(restaurantContext?.slug || "") !== String(slug || "")) return "";
        return String(restaurantContext?.tableNo || "").trim();
    }, [restaurantContext?.slug, restaurantContext?.tableNo, slug]);

    // URL is source-of-truth when present. Otherwise keep the last selected table from local storage.
    const tableNo = tableFromUrl || tableFromContext || "";
    const { addToCart, cart, total } = useCart();

    const { data, loading } = useCachedGet(`/r/${slug}/menu`, {
        ttlMs: 2 * 60_000,
        staleMs: 30 * 60_000,
        scope: `restaurant:${slug}`,
    });
    const restaurant = data?.restaurant || null;
    const menu = data?.menu || [];
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("ALL");
    const [cartOpen, setCartOpen] = useState(false);
    const [favorites, setFavorites] = useState(() => getCustomerFavorites());

    useEffect(() => {
        // Keep global restaurant context in sync with the URL immediately,
        // so dropdowns show the right selection even before API response returns.
        setRestaurantContext({ slug: slug || null, tableNo: tableNo || null });
    }, [setRestaurantContext, slug, tableNo]);

    useEffect(() => {
        // If a table is stored but missing from the URL, make the menu link shareable and stable.
        if (!slug) return;
        if (!tableNo) return;
        if (tableFromUrl) return;
        setSearchParams(
            (prev) => {
                prev.set("table", tableNo);
                return prev;
            },
            { replace: true }
        );
    }, [setSearchParams, slug, tableFromUrl, tableNo]);

    useEffect(() => {
        if (!data?.restaurant) return;
        setRestaurantContext({
            id: data.restaurant.id || null,
            name: data.restaurant.name || null,
            slug: data.restaurant.slug || slug || null,
            logo: data.restaurant.logo || data.restaurant.logoUrl || restaurantContext?.logo || null,
            upiId: data.restaurant.upiId || null,
            tableNo: tableNo || null,
        });
    }, [data?.restaurant?.id, data?.restaurant?.slug, data?.restaurant?.name, setRestaurantContext, slug, tableNo]);

    const categories = useMemo(() => {
        const counts = new Map();
        for (const item of menu) {
            const c = String(item?.category || "").trim() || "General";
            counts.set(c, (counts.get(c) || 0) + 1);
        }
        const sorted = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c]) => c);
        return ["ALL", ...sorted.slice(0, 10)];
    }, [menu]);

    const topCuisine = useMemo(() => {
        const list = categories.filter((c) => c !== "ALL").slice(0, 3);
        return list.length ? list.join(" • ") : "Cafe & Restaurant";
    }, [categories]);

    const filtered = useMemo(() => {
        const q = String(search || "").trim().toLowerCase();
        return menu.filter((item) => {
            const name = String(item?.name || "").toLowerCase();
            const matchesSearch = !q || name.includes(q);
            const category = String(item?.category || "").trim() || "General";
            const matchesCategory = activeCategory === "ALL" ? true : category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [activeCategory, menu, search]);
    const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const isCustomerLoggedIn = Boolean(customerToken || customer);
    const restaurantLogoUrl = resolveImageUrl(restaurant?.logoUrl || restaurant?.logo);

    if (loading) {
        return (
            <div className="theme-page flex min-h-screen items-center justify-center">
                Loading Menu...
            </div>
        );
    }

    return (
        <div className="theme-page min-h-screen">
            <div className="theme-nav sticky top-0 z-30 border-b px-4 py-3 md:px-6">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        {restaurantLogoUrl ? (
                            <img
                                src={restaurantLogoUrl}
                                alt={`${restaurant?.name || "Restaurant"} logo`}
                                className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                            />
                        ) : (
                            <div className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-black/10" />
                        )}

                        <div className="min-w-0">
                            <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">
                                Scan To Order
                            </p>
                            <h2 className="truncate text-base font-semibold md:text-lg">{restaurant?.name || "Restaurant"}</h2>
                        </div>

                        {tableNo ? (
                            <span className="theme-pill hidden shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold md:inline-flex">
                                Table {tableNo}
                            </span>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <TableSelector slug={slug} variant="compact" />
                        <RestaurantSelector variant="compact" />
                        <ThemeSelector variant="compact" />

                        {isCustomerLoggedIn ? (
                            <button
                                onClick={() => navigate("/profile")}
                                className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition"
                            >
                                <UserCircle2 size={16} />
                                <span className="hidden sm:inline">Profile</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate("/login?mode=customer")}
                                className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition"
                            >
                                <LogIn size={16} />
                                <span className="hidden sm:inline">Login</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="theme-hero-band border-b px-4 py-5 md:px-6 md:py-6">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.35em]">{topCuisine}</p>

                        <div className="mt-2 flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{restaurant?.name}</h1>
                        </div>

                        <p className="theme-muted-strong mt-2 max-w-xl text-sm md:text-base">
                            Freshly prepared, served at your table. Build your order in seconds.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            <span className="theme-badge flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                                <Star size={14} className="theme-accent-text" />
                                4.8
                            </span>
                            <span className="theme-badge flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                                <MapPin size={14} className="theme-accent-text" />
                                {tableNo ? `Table ${tableNo}` : "Takeaway / No table"}
                            </span>
                            <span className="theme-badge flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                                <ShoppingBag size={14} className="theme-accent-text" />
                                Fast checkout
                            </span>
                        </div>
                    </div>

                    {/* Desktop summary: sticky card for quick access */}
                    <div className="hidden lg:block">
                        <div className="theme-panel w-[340px] rounded-[22px] p-4 backdrop-blur lg:sticky lg:top-24">
                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">Order Summary</p>
                            <div className="mt-3 flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold leading-none">
                                        {cartCount} item{cartCount === 1 ? "" : "s"}
                                    </p>
                                    <p className="theme-muted mt-1 text-sm">
                                        {tableNo ? `Table ${tableNo}` : "No table selected"}
                                    </p>
                                </div>
                                <p className="text-2xl font-bold leading-none">₹{total}</p>
                            </div>

                            <button
                                onClick={() => setCartOpen(true)}
                                className="theme-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl"
                            >
                                <ShoppingBag size={18} />
                                View Order
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 md:pb-10">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={18} />

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search dishes, drinks, desserts..."
                            className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                        {categories.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setActiveCategory(c)}
                                className={[
                                    "theme-chip shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                                    activeCategory === c ? "theme-chip-active" : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                {c === "ALL" ? "All" : c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                    {filtered.map((item) => (
                        (() => {
                            const favKey = `${String(slug || "").trim()}:${Number(item?.id || 0)}`;
                            const isFav = favorites.some((f) => String(f?.key || "") === favKey);

                            return (
                        <div
                            key={item.id}
                            className="theme-card group overflow-hidden rounded-3xl transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-2xl"
                        >
                            <div className="relative">
                                <img
                                    src={resolveImageUrl(item.image) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"}
                                    className="h-44 w-full object-cover sm:h-48"
                                    alt={item.name}
                                    loading="lazy"
                                />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
                                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">₹{item.price}</span>
                                    {item.category ? (
                                        <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">{item.category}</span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-lg font-bold leading-snug">{item.name}</h3>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const { next, added } = toggleFavoriteMenuItem({
                                                    restaurantSlug: slug,
                                                    restaurantName: restaurant?.name || slug,
                                                    item,
                                                });
                                                setFavorites(next);
                                                showToast({
                                                    title: added ? "Saved to favorites" : "Removed from favorites",
                                                    message: added ? "You can find it in Profile → Favorites." : "Removed from your favorites list.",
                                                    variant: "success",
                                                });
                                            }}
                                            className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition ${isFav ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-white/10 bg-black/10 theme-muted"}`}
                                            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                                        >
                                            <Heart size={16} fill={isFav ? "currentColor" : "none"} />
                                        </button>

                                        <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">
                                            ⭐ {item.rating || 4.5}
                                        </span>
                                    </div>
                                </div>

                                <p className="theme-muted mt-2 text-sm">
                                    Freshly prepared, premium quality ingredients.
                                </p>

                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <span className="theme-muted text-sm">
                                        Tap to add
                                    </span>

                                    <button
                                        onClick={() => addToCart(item)}
                                        className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold"
                                    >
                                        <Plus size={18} />
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                            );
                        })()
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="theme-muted mt-10 text-center">
                        No items found
                    </div>
                )}
            </div>

            {cartCount > 0 && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="theme-button fixed bottom-4 left-4 right-4 z-30 inline-flex items-center justify-between rounded-2xl px-5 py-4 font-semibold shadow-2xl md:left-auto md:right-6 md:w-[340px]"
                >
                    <span className="inline-flex items-center gap-2">
                        <ShoppingBag size={18} />
                        View order ({cartCount})
                    </span>
                    <span>₹{total}</span>
                </button>
            )}

            <CartDrawer open={cartOpen} setOpen={setCartOpen} />
        </div>
    );
}
