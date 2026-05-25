import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Star, Plus, Search, ShoppingBag, LogIn, UserCircle2, Heart } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useRestaurantContext } from "../../context/RestaurantContext";
import CartDrawer from "../../components/CartDrawer";
import RestaurantSelector from "../../components/RestaurantSelector";
import TableSelector from "../../components/TableSelector";
import useCachedGet from "../../hooks/useCachedGet";
import { useAuth } from "../../context/AuthContext";
import { getCustomerFavorites, toggleFavoriteMenuItem } from "../../utils/customerFavorites";
import { showToast } from "../../utils/toast";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

const qrImageUrl = (targetUrl) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`;

const NON_VEG_KEYWORDS = ["chicken", "mutton", "fish", "prawn", "egg", "meat", "beef", "pork", "seafood", "kebab"];
const COFFEE_KEYWORDS = ["coffee", "cappuccino", "espresso", "latte", "mocha", "americano", "macchiato"];
const SNACK_KEYWORDS = ["snack", "fries", "burger", "sandwich", "pizza", "roll", "momo", "nugget", "samosa", "cutlet", "chips"];
const VEG_KEYWORDS = ["veg", "vegetarian", "paneer", "aloo", "dal", "mushroom", "tofu", "salad"];

const combinedText = (item) => {
    const name = String(item?.name || "").toLowerCase();
    const category = String(item?.category || "").toLowerCase();
    return `${name} ${category}`.trim();
};

const hasKeyword = (text, keywords) => keywords.some((k) => text.includes(k));

const isNonVegItem = (item) => hasKeyword(combinedText(item), NON_VEG_KEYWORDS);
const isCoffeeItem = (item) => hasKeyword(combinedText(item), COFFEE_KEYWORDS);
const isSnackItem = (item) => hasKeyword(combinedText(item), SNACK_KEYWORDS);
const isVegItem = (item) => {
    const text = combinedText(item);
    if (!text) return false;
    if (isNonVegItem(item) || isCoffeeItem(item)) return false;
    if (hasKeyword(text, VEG_KEYWORDS)) return true;
    return true;
};

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
        return list.length ? list.join(" | ") : "Cafe & Restaurant";
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
    const sections = useMemo(() => {
        const all = filtered;
        const veg = filtered.filter(isVegItem);
        const nonVeg = filtered.filter(isNonVegItem);
        const coffee = filtered.filter(isCoffeeItem);
        const snacks = filtered.filter(isSnackItem);

        return [
            { key: "all", title: "All Items", items: all },
            { key: "veg", title: "Veg Items", items: veg },
            { key: "nonveg", title: "Non Veg Items", items: nonVeg },
            { key: "coffee", title: "Coffee", items: coffee },
            { key: "snacks", title: "Snacks", items: snacks },
        ].filter((section) => section.key === "all" || section.items.length > 0);
    }, [filtered]);
    const favoriteKeySet = useMemo(() => {
        return new Set((Array.isArray(favorites) ? favorites : []).map((f) => String(f?.key || "")));
    }, [favorites]);

    const handleToggleFavorite = (item) => {
        const { next, added } = toggleFavoriteMenuItem({
            restaurantSlug: slug,
            restaurantName: restaurant?.name || slug,
            item,
        });
        setFavorites(next);
        showToast({
            title: added ? "Saved to favorites" : "Removed from favorites",
            message: added ? "You can find it in Profile -> Favorites." : "Removed from your favorites list.",
            variant: "success",
        });
    };
    const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const isCustomerLoggedIn = Boolean(customerToken || customer);
    const scanTargetUrl = useMemo(() => {
        const activeSlug = String(restaurant?.slug || slug || "").trim();
        if (!activeSlug) return "";

        const basePath = `/r/${encodeURIComponent(activeSlug)}`;
        const pathWithTable = tableNo ? `${basePath}?table=${encodeURIComponent(tableNo)}` : basePath;
        if (typeof window === "undefined") return pathWithTable;
        return `${window.location.origin}${pathWithTable}`;
    }, [restaurant?.slug, slug, tableNo]);

    if (loading) {
        return (
            <div className="theme-page flex min-h-screen items-center justify-center">
                Loading Menu...
            </div>
        );
    }

    return (
        <div className="theme-page min-h-screen">
            <div className="theme-nav sticky top-0 z-30 border-b px-2 py-2 sm:px-4 md:px-6">
                <div className="mx-auto flex max-w-7xl items-center">
                    <div className="flex w-full flex-wrap items-center justify-end gap-2">
                        <RestaurantSelector variant="compact" />

                        {isCustomerLoggedIn ? (
                            <button
                                onClick={() => navigate("/profile/overview")}
                                className="theme-soft-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm"
                            >
                                <UserCircle2 size={16} />
                                <span className="hidden sm:inline">Profile</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate("/login?mode=customer")}
                                className="theme-soft-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm"
                            >
                                <LogIn size={16} />
                                <span className="hidden sm:inline">Login</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="theme-hero-band relative overflow-visible border-b px-3 py-3 sm:px-4 md:px-6 md:py-4">
                <div aria-hidden className="pointer-events-none absolute -left-12 top-0 h-28 w-28 rounded-full bg-amber-300/12 blur-2xl" />
                <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 h-44 w-44 rounded-full bg-orange-300/8 blur-3xl" />
                <div className="mx-auto relative flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="min-w-0 max-w-xl pr-28 sm:pr-32 md:pr-40 lg:pr-0">
                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.35em]">{topCuisine}</p>

                        <div className="mt-1.5 flex items-center gap-3">
                            <h1 className="break-words text-[clamp(1.9rem,7vw,3rem)] font-bold leading-tight tracking-tight">
                                {restaurant?.name}
                            </h1>
                        </div>

                        <p className="theme-muted-strong mt-1.5 max-w-lg text-sm leading-relaxed sm:text-[0.95rem]">
                            Freshly prepared, served at your table. Build your order in seconds.
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-2 text-sm">
                            <span className="theme-badge flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs sm:px-3">
                                <Star size={14} className="theme-accent-text" />
                                4.8
                            </span>
                            <span className="theme-badge flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs sm:px-3">
                                <ShoppingBag size={14} className="theme-accent-text" />
                                Fast checkout
                            </span>
                            <TableSelector slug={slug} variant="compact" className="shrink-0" />
                        </div>
                    </div>

                    <div className="absolute right-3 top-3 z-10 lg:static lg:order-last lg:z-auto lg:w-auto">
                        <div className="w-auto lg:w-[360px]">
                            {scanTargetUrl ? (
                                <div className="flex justify-end">
                                    <div className="flex flex-col items-end gap-1 sm:gap-1.5">
                                        <img
                                            src={qrImageUrl(scanTargetUrl)}
                                            alt={`QR code for ${restaurant?.name || "restaurant"} menu`}
                                            className="h-16 w-16 rounded-md sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-28 lg:w-28"
                                        />
                                        <p className="theme-accent-text whitespace-nowrap text-right text-[10px] font-semibold uppercase tracking-[0.34em] sm:text-[11px]">
                                            Scan To Order
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 md:pb-10">
                <div className="mb-4 flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={18} />

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search dishes, drinks, desserts..."
                            className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none sm:text-base"
                        />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {categories.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setActiveCategory(c)}
                                className={[
                                    "theme-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm",
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

                {sections.map((section) => (
                    <MenuSection
                        key={section.key}
                        title={section.title}
                        items={section.items}
                        slug={slug}
                        favoriteKeySet={favoriteKeySet}
                        onToggleFavorite={handleToggleFavorite}
                        onAdd={addToCart}
                    />
                ))}


                {filtered.length === 0 && (
                    <div className="theme-muted mt-10 text-center">
                        No items found
                    </div>
                )}
            </div>

            {cartCount > 0 && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="theme-button fixed bottom-3 left-3 right-3 z-30 inline-flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl md:bottom-4 md:left-auto md:right-6 md:w-[340px] md:px-5 md:py-4 md:text-base"
                >
                    <span className="inline-flex items-center gap-2">
                        <ShoppingBag size={18} />
                        View order ({cartCount})
                    </span>
                    <span>Rs {total}</span>
                </button>
            )}

            <CartDrawer open={cartOpen} setOpen={setCartOpen} />
        </div>
    );
}

function MenuSection({ title, items, slug, favoriteKeySet, onToggleFavorite, onAdd }) {
    if (!Array.isArray(items) || !items.length) return null;

    return (
        <section className="mb-5">
            <div className="mb-2 flex items-center justify-between px-0.5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">{title}</h2>
                <span className="theme-muted text-xs">{items.length} items</span>
            </div>

            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((item) => (
                    <MenuItemCard
                        key={String(item?.id || `${title}-${item?.name || "item"}`)}
                        item={item}
                        slug={slug}
                        isFavorite={favoriteKeySet.has(`${String(slug || "").trim()}:${Number(item?.id || 0)}`)}
                        onToggleFavorite={onToggleFavorite}
                        onAdd={onAdd}
                    />
                ))}
            </div>
        </section>
    );
}

function MenuItemCard({ item, isFavorite, onToggleFavorite, onAdd }) {
    return (
        <div className="theme-card group w-[250px] shrink-0 snap-start overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-2xl sm:w-[270px]">
            <div className="relative">
                <img
                    src={resolveImageUrl(item?.image) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"}
                    className="h-28 w-full object-cover sm:h-32"
                    alt={String(item?.name || "Menu item")}
                    loading="lazy"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">Rs {item?.price}</span>
                    {item?.category ? (
                        <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">{item.category}</span>
                    ) : null}
                </div>
            </div>

            <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-bold leading-snug">{item?.name}</h3>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onToggleFavorite && onToggleFavorite(item)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-xl border transition ${isFavorite ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-white/10 bg-black/10 theme-muted"}`}
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                        </button>

                        <span className="theme-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            <Star size={11} className="theme-accent-text" />
                            {item?.rating || 4.5}
                        </span>
                    </div>
                </div>

                <p className="theme-muted mt-1.5 text-xs">Freshly prepared, premium quality ingredients.</p>

                <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="theme-muted text-[11px]">Tap to add</span>

                    <button
                        onClick={() => onAdd && onAdd(item)}
                        className="theme-button inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold"
                    >
                        <Plus size={16} />
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
}
