/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    Coffee,
    Flame,
    Heart,
    IceCream,
    Leaf,
    LogIn,
    Pizza,
    Plus,
    Search,
    ShoppingBag,
    Sparkles,
    Star,
    Tags,
    UserCircle2,
    Sandwich,
    UtensilsCrossed,
} from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useRestaurantContext } from "../../context/RestaurantContext";
import CartDrawer from "../../components/CartDrawer";
import BrandLogo from "../../components/BrandLogo";
import VegModeToggle from "../../components/VegModeToggle";
import useCachedGet from "../../hooks/useCachedGet";
import { useAuth } from "../../context/AuthContext";
import { getCustomerFavorites, toggleFavoriteMenuItem } from "../../utils/customerFavorites";
import { showToast } from "../../utils/toast";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
const EMPTY_MENU = [];

const NON_VEG_KEYWORDS = ["chicken", "mutton", "fish", "prawn", "egg", "meat", "beef", "pork", "seafood", "kebab"];
const COFFEE_KEYWORDS = ["coffee", "cappuccino", "espresso", "latte", "mocha", "americano", "macchiato"];
const SNACK_KEYWORDS = ["snack", "fries", "burger", "sandwich", "wrap", "pizza", "roll", "momo", "nugget", "samosa", "cutlet", "chips", "starter"];
const VEG_KEYWORDS = ["veg", "vegetarian", "paneer", "aloo", "dal", "mushroom", "tofu", "salad"];
const DESSERT_KEYWORDS = ["dessert", "cake", "brownie", "ice cream", "icecream", "sweet", "shake", "milkshake"];
const GENERIC_CATEGORY_RE = /^(food|general|menu|items?|item|specials?|special|misc|miscellaneous|other|others?)$/i;
const FEATURED_MENU_THRESHOLD = 10;

const SECTION_RULES = [
    { key: "coffee-drinks", label: "Coffee & Drinks", keywords: COFFEE_KEYWORDS, Icon: Coffee, rank: 10 },
    { key: "biryani", label: "Biryani", keywords: ["biryani"], Icon: UtensilsCrossed, rank: 20 },
    { key: "pizza", label: "Pizza", keywords: ["pizza"], Icon: Pizza, rank: 30 },
    { key: "burgers", label: "Burgers", keywords: ["burger"], Icon: Sandwich, rank: 40 },
    { key: "snacks-starters", label: "Snacks & Starters", keywords: SNACK_KEYWORDS, Icon: Tags, rank: 50 },
    { key: "desserts", label: "Desserts", keywords: DESSERT_KEYWORDS, Icon: IceCream, rank: 60 },
];

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const toTitleCase = (value) =>
    String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

const toSectionKey = (value) =>
    normalizeText(value)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "specials";

const combinedText = (item) => {
    const name = normalizeText(item?.name);
    const description = normalizeText(item?.description);
    const category = normalizeText(item?.category);
    return `${name} ${description} ${category}`.trim();
};

const hasKeyword = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const isNonVegItem = (item) => hasKeyword(combinedText(item), NON_VEG_KEYWORDS);
const isCoffeeItem = (item) => hasKeyword(combinedText(item), COFFEE_KEYWORDS);
const isSnackItem = (item) => hasKeyword(combinedText(item), SNACK_KEYWORDS);
const isVegItem = (item) => {
    const text = combinedText(item);
    if (!text) return false;
    if (isNonVegItem(item)) return false;
    return hasKeyword(text, VEG_KEYWORDS);
};

const isVegModeItem = (item) => {
    const text = combinedText(item);
    if (!text) return false;
    return !isNonVegItem(item);
};

const getDietBadge = (item) => {
    const text = combinedText(item);
    if (!text) return null;
    if (hasKeyword(text, NON_VEG_KEYWORDS)) {
        return {
            label: "Non-Veg",
            className: "border-red-500/30 bg-red-500/10 text-red-200",
            Icon: Flame,
        };
    }
    if (hasKeyword(text, VEG_KEYWORDS)) {
        return {
            label: "Veg",
            className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
            Icon: Leaf,
        };
    }
    return null;
};

const getSectionMeta = (item, index) => {
    const text = combinedText(item);
    const rawCategory = String(item?.category || "").trim();
    const matchedRule = SECTION_RULES.find((rule) => hasKeyword(text, rule.keywords));

    if (matchedRule) {
        return matchedRule;
    }

    if (rawCategory && !GENERIC_CATEGORY_RE.test(rawCategory)) {
        return {
            key: toSectionKey(rawCategory),
            label: toTitleCase(rawCategory),
            Icon: Tags,
            rank: 120 + index,
        };
    }

    if (isCoffeeItem(item)) {
        return { key: "coffee-drinks", label: "Coffee & Drinks", Icon: Coffee, rank: 10 };
    }

    if (isSnackItem(item)) {
        return { key: "snacks-starters", label: "Snacks & Starters", Icon: Tags, rank: 50 };
    }

    if (isVegItem(item)) {
        return { key: "veg-specials", label: "Veg Specials", Icon: Leaf, rank: 70 };
    }

    if (isNonVegItem(item)) {
        return { key: "non-veg-specials", label: "Non-Veg Specials", Icon: Flame, rank: 80 };
    }

    return {
        key: "chef-specials",
        label: "Chef Specials",
        Icon: UtensilsCrossed,
        rank: 140 + index,
    };
};

const popularityScore = (item) => {
    const featuredBoost = item?.isFeatured ? 1_000_000 : 0;
    const orderBoost = Number(item?.orderCount || 0) * 12;
    const ratingBoost = Number(item?.rating || 0) * 100;
    const reviewsBoost = Number(item?.reviewCount || 0);
    return featuredBoost + orderBoost + ratingBoost + reviewsBoost;
};

const compareMenuItems = (a, b) => {
    const scoreDiff = popularityScore(b) - popularityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return normalizeText(a?.name).localeCompare(normalizeText(b?.name));
};

const formatPrice = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "₹0";
    return `₹${amount.toLocaleString("en-IN")}`;
};

export default function RestaurantMenu() {
    const { slug, table: tableFromPathParam } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const { customer, customerToken } = useAuth();

    const tableFromPath = String(tableFromPathParam || "").trim();
    const tableFromUrl = String(searchParams.get("table") || tableFromPath || "").trim();
    const searchFromUrl = String(searchParams.get("search") || "").trim();
    const tableFromContext = useMemo(() => {
        // Only trust stored tableNo when it's for the same restaurant slug.
        if (String(restaurantContext?.slug || "") !== String(slug || "")) return "";
        return String(restaurantContext?.tableNo || "").trim();
    }, [restaurantContext?.slug, restaurantContext?.tableNo, slug]);

    // URL is source-of-truth when present. Otherwise keep the last selected table from local storage.
    const tableNo = tableFromUrl || tableFromContext || "";
    const vegModeEnabled = Boolean(restaurantContext?.vegOnly);
    const { addToCart, cart, total } = useCart();

    const { data, loading } = useCachedGet(`/r/${slug}/menu`, {
        ttlMs: 5_000,
        staleMs: 15_000,
        scope: `restaurant:${slug}`,
    });
    const restaurant = data?.restaurant || null;
    const menu = Array.isArray(data?.menu) ? data.menu : EMPTY_MENU;
    const restaurantName = String(restaurant?.name || restaurantContext?.name || slug || "Restaurant").trim();
    const restaurantLocation = [restaurant?.city, restaurant?.state].filter(Boolean).join(", ");

    const [search, setSearch] = useState(() => searchFromUrl);
    const [activeSection, setActiveSection] = useState("all");
    const [cartOpen, setCartOpen] = useState(false);
    const [favorites, setFavorites] = useState(() => getCustomerFavorites());

    const sectionRefs = useRef(new Map());
    const menuStartRef = useRef(null);

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

    const handleVegModeToggle = useCallback(
        (enabled) => {
            setRestaurantContext({ vegOnly: Boolean(enabled) });
        },
        [setRestaurantContext]
    );

    useEffect(() => {
        if (!data?.restaurant) return;
        setRestaurantContext({
            id: data.restaurant.id || null,
            name: data.restaurant.name || null,
            slug: data.restaurant.slug || slug || null,
            logo: data.restaurant.logo || data.restaurant.logoUrl || restaurantContext?.logo || null,
            tableNo: tableNo || null,
        });
    }, [data?.restaurant, restaurantContext?.logo, setRestaurantContext, slug, tableNo]);

    const menuWithMeta = useMemo(() => {
        return menu.map((item, index) => {
            const section = getSectionMeta(item, index);
            return {
                ...item,
                _index: index,
                _score: popularityScore(item),
                _section: section,
            };
        });
    }, [menu]);

    const filtered = useMemo(() => {
        const q = normalizeText(search);
        return menuWithMeta.filter((item) => {
            if (vegModeEnabled && !isVegModeItem(item)) {
                return false;
            }

            if (!q) return true;
            return (
                normalizeText(item?.name).includes(q) ||
                normalizeText(item?.description).includes(q) ||
                normalizeText(item?.category).includes(q) ||
                normalizeText(item?._section?.label).includes(q)
            );
        });
    }, [menuWithMeta, search, vegModeEnabled]);

    const featuredItems = (() => {
        const featured = filtered.filter((item) => Boolean(item?.isFeatured));
        if (featured.length > 0) {
            return [...featured].sort(compareMenuItems).slice(0, 6);
        }
        if (filtered.length >= FEATURED_MENU_THRESHOLD) {
            return [...filtered].sort(compareMenuItems).slice(0, 4);
        }
        return [];
    })();

    const menuSections = useMemo(() => {
        const sections = [];

        if (featuredItems.length > 0) {
            sections.push({
                key: "recommended",
                title: "Recommended",
                Icon: Sparkles,
                rank: 0,
                items: featuredItems,
            });
        }

        const groups = new Map();
        for (const item of filtered) {
            const meta = item?._section || getSectionMeta(item, 0);
            if (!groups.has(meta.key)) {
                groups.set(meta.key, {
                    key: meta.key,
                    title: meta.label,
                    Icon: meta.Icon || Tags,
                    rank: meta.rank ?? 100,
                    firstIndex: item?._index ?? 0,
                    items: [],
                });
            }

            const entry = groups.get(meta.key);
            entry.items.push(item);
            entry.firstIndex = Math.min(entry.firstIndex, item?._index ?? entry.firstIndex);
        }

        const sortedGroups = [...groups.values()]
            .map((group) => ({
                ...group,
                items: [...group.items].sort(compareMenuItems),
            }))
            .sort((a, b) => {
                if (a.rank !== b.rank) return a.rank - b.rank;
                if (a.items.length !== b.items.length) return b.items.length - a.items.length;
                if (a.firstIndex !== b.firstIndex) return a.firstIndex - b.firstIndex;
                return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
            });

        sections.push(...sortedGroups);
        return sections;
    }, [featuredItems, filtered]);

    const navigationSections = useMemo(() => {
        const base = [
            {
                key: "all",
                label: "All",
                Icon: Tags,
                count: filtered.length,
                rank: -1,
            },
        ];

        for (const section of menuSections) {
            base.push({
                key: section.key,
                label: section.title,
                Icon: section.Icon || Tags,
                count: section.items.length,
                rank: section.rank ?? 100,
            });
        }

        return base;
    }, [filtered.length, menuSections]);

    const favoriteKeySet = useMemo(() => {
        return new Set((Array.isArray(favorites) ? favorites : []).map((favorite) => String(favorite?.key || "")));
    }, [favorites]);

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return undefined;

        const observedNodes = [...sectionRefs.current.values()].filter(Boolean);
        if (observedNodes.length === 0) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (!visible) return;

                const sectionKey = visible.target.getAttribute("data-section-key");
                if (sectionKey) {
                    setActiveSection(sectionKey);
                }
            },
            {
                rootMargin: "-15% 0px -68% 0px",
                threshold: [0.12, 0.25, 0.5, 0.75],
            }
        );

        observedNodes.forEach((node) => observer.observe(node));

        return () => observer.disconnect();
    }, [menuSections, filtered.length]);

    const registerSectionRef = useCallback((key) => {
        return (node) => {
            if (!node) {
                sectionRefs.current.delete(key);
                return;
            }
            sectionRefs.current.set(key, node);
        };
    }, []);

    const resolvedActiveSection = navigationSections.some((section) => section.key === activeSection)
        ? activeSection
        : navigationSections[0]?.key || "all";

    const scrollToSection = useCallback(
        (key) => {
            if (key === "all") {
                setActiveSection("all");
                menuStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            const node = sectionRefs.current.get(key);
            if (!node) return;

            setActiveSection(key);
            node.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        [setActiveSection]
    );

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

    if (loading) {
        return (
            <div className="theme-page flex min-h-screen items-center justify-center">
                Loading Menu...
            </div>
        );
    }

    const hasResults = filtered.length > 0;

    return (
        <div className="theme-page min-h-screen">
            <div className="theme-nav sticky top-0 z-30 border-b px-2 py-2 sm:px-4 md:px-6">
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-3 justify-self-start">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1.5 shadow-[0_4px_14px_rgba(104,70,37,0.12)] sm:h-12 sm:w-12">
                            <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
                                Tiffzy
                            </p>
                        </div>
                    </div>

                    <div className="min-w-0 justify-self-center text-center">
                        <p className="hidden text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--app-accent)]/80 sm:block">
                            Restaurant
                        </p>
                        <p className="truncate text-base font-black tracking-tight text-[color:var(--app-accent)] sm:text-lg md:text-xl">
                            {restaurantName}
                        </p>
                        {restaurantLocation ? (
                            <p className="hidden truncate text-xs text-[color:var(--app-muted)] sm:block sm:text-sm">
                                {restaurantLocation}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 justify-self-end">
                        <VegModeToggle
                            enabled={vegModeEnabled}
                            onToggle={handleVegModeToggle}
                            compact
                            className="w-auto"
                        />

                        {isCustomerLoggedIn ? (
                            <button
                                onClick={() => navigate("/profile/overview?scope=customer")}
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
                                <span>Login</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full px-1 py-4 pb-28 sm:px-4 md:px-6 md:py-5 md:pb-10">
                <div ref={menuStartRef} className="scroll-mt-32">
                    <div className="mb-3 space-y-3 sm:mb-4">
                        <div className="flex justify-end">
                            <div className="relative w-full max-w-[360px] sm:max-w-[420px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={16} />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search menu items..."
                                    className="theme-input w-full rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none sm:text-base"
                                />
                            </div>
                        </div>

                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {navigationSections.map((section) => (
                                <button
                                    key={section.key}
                                    type="button"
                                    onClick={() => scrollToSection(section.key)}
                                    className={[
                                        "theme-chip inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm",
                                        resolvedActiveSection === section.key ? "theme-chip-active" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    <span>{section.label}</span>
                                    <span className="theme-pill rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                                        {section.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    {menuSections.map((section) => (
                        <MenuSection
                            key={section.key}
                            section={section}
                            items={section.items}
                            slug={slug}
                            favoriteKeySet={favoriteKeySet}
                            onToggleFavorite={handleToggleFavorite}
                            onAdd={addToCart}
                            sectionRef={registerSectionRef(section.key)}
                            cart={cart}
                        />
                    ))}

                    {!hasResults && (
                        <div className="py-12 text-center">
                            <h3 className="text-lg font-bold">
                                {vegModeEnabled ? "No veg items found" : "No items found"}
                            </h3>
                            <p className="theme-muted mt-2 text-sm">
                                {vegModeEnabled
                                    ? "Veg mode is on. Turn it off to browse the full menu."
                                    : "Try a different search term or clear the search to browse the full menu."}
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-3">
                                {search.trim() ? (
                                    <button
                                        type="button"
                                        onClick={() => setSearch("")}
                                        className="theme-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                                    >
                                        <Search size={16} />
                                        Clear search
                                    </button>
                                ) : null}

                                {vegModeEnabled ? (
                                    <button
                                        type="button"
                                        onClick={() => handleVegModeToggle(false)}
                                        className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                                    >
                                        <Leaf size={16} />
                                        Show all items
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
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

function MenuSection({ section, items, slug, favoriteKeySet, onToggleFavorite, onAdd, sectionRef, cart = [] }) {
    if (!Array.isArray(items) || !items.length) return null;

    const Icon = section?.Icon || Tags;

    return (
        <section ref={sectionRef} data-section-key={section.key} className="scroll-mt-28">
            <div className="mb-2 flex items-end justify-between gap-3 px-0.5">
                <div className="flex items-center gap-2">
                    <span className="theme-pill inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl">
                        <Icon size={16} className="theme-accent-text" />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] sm:text-base">
                            {section.title}
                        </h2>
                        {section.key === "recommended" ? (
                            <p className="theme-muted mt-0.5 hidden text-xs sm:block">Popular picks surfaced first</p>
                        ) : null}
                    </div>
                </div>
                <span className="theme-muted text-xs tabular-nums sm:text-sm">{items.length} items</span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-col sm:overflow-visible sm:pb-0 sm:space-y-3">
                {items.map((item) => {
                    const cartItem = cart.find((i) => i.id === item.id);
                    const qty = cartItem ? cartItem.quantity : 0;
                    return (
                        <MenuItemCard
                            key={String(item?.id || `${section.key}-${item?.name || "item"}`)}
                            item={item}
                            slug={slug}
                            isFavorite={favoriteKeySet.has(`${String(slug || "").trim()}:${Number(item?.id || 0)}`)}
                            onToggleFavorite={onToggleFavorite}
                            onAdd={onAdd}
                            quantity={qty}
                        />
                    );
                })}
            </div>
        </section>
    );
}

function MenuItemCard({ item, isFavorite, onToggleFavorite, onAdd, quantity = 0 }) {
    const imageSrc = resolveImageUrl(item?.image) || FALLBACK_IMAGE;
    const dietBadge = getDietBadge(item);
    const itemPrice = Number(item?.price || 0);
    const originalPrice = Number(item?.originalPrice || 0);
    const discountPercent = Number(item?.discountPercent || 0);
    const hasDiscount = discountPercent > 0 && originalPrice > itemPrice;
    const handleCardClick = () => {
        if (onAdd) onAdd(item);
    };

    return (
        <article
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick();
                }
            }}
            className={`group flex w-[130px] shrink-0 cursor-pointer flex-col gap-1.5 rounded-2xl p-1.5 text-left transition duration-300 sm:w-full sm:cursor-default sm:flex-row sm:gap-3.5 sm:p-3 sm:rounded-2xl border ${
                quantity > 0
                    ? "bg-[linear-gradient(180deg,rgba(16,185,129,0.12)_0%,rgba(16,185,129,0.04)_100%)] border-emerald-500/30 shadow-[0_8px_20px_rgba(16,185,129,0.08)]"
                    : "bg-white/[0.02] border-white/5 sm:border-transparent sm:bg-transparent hover:bg-white/[0.04] sm:hover:bg-white/[0.02] sm:hover:border-white/10"
            }`}
        >
            <div className="relative h-22 w-full shrink-0 overflow-hidden rounded-2xl border border-white/8 bg-black/10 sm:h-24 sm:w-24">
                <img
                    src={imageSrc}
                    className="h-full w-full object-cover"
                    alt={String(item?.name || "Menu item")}
                    loading="lazy"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/55 to-transparent" />

                <div className="absolute bottom-1.5 right-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#fff8e6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                        <Star size={10} className="text-[#ffd24d]" />
                        {Number(item?.rating || 4.5).toFixed(1)}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite && onToggleFavorite(item);
                    }}
                    className={`absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
                        isFavorite
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : "border-white/10 bg-black/10 text-white/90"
                    }`}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Heart size={12} fill={isFavorite ? "currentColor" : "none"} />
                </button>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 className="text-[11px] font-bold leading-tight sm:text-[15px]">{item?.name}</h3>
                            {dietBadge ? (
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-semibold sm:gap-1.5 sm:text-[8px] ${dietBadge.className}`}
                                >
                                    <dietBadge.Icon size={9} />
                                    {dietBadge.label}
                                </span>
                            ) : null}
                        </div>

                        {hasDiscount ? (
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 sm:gap-2">
                                <p className="text-[9px] text-[color:var(--app-muted)] line-through sm:text-[11px]">
                                    {formatPrice(originalPrice)}
                                </p>
                                <p className="text-[10px] font-semibold text-[color:var(--app-accent)] sm:text-[13px]">
                                    {formatPrice(itemPrice)}
                                </p>
                                <span className="inline-flex items-center rounded-full border border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,var(--app-primary)_16%,transparent)] px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-primary)] sm:px-2 sm:text-[9px]">
                                    {Math.round(discountPercent)}% off
                                </span>
                            </div>
                        ) : (
                            <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--app-accent)] sm:text-[13px]">{formatPrice(itemPrice)}</p>
                        )}
                    </div>

                    {quantity > 0 ? (
                        <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-bold sm:inline-flex">
                            <span>{quantity} selected</span>
                        </div>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdd && onAdd(item);
                            }}
                            className="theme-button hidden shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold sm:inline-flex sm:px-3"
                        >
                            <Plus size={11} />
                            Add
                        </button>
                    )}
                </div>

                <p
                    className="theme-muted mt-1 hidden text-[10px] leading-4 sm:mt-1.5 sm:block sm:text-[13px] sm:leading-5"
                    style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 1,
                        overflow: "hidden",
                    }}
                >
                    {item?.description || "Freshly prepared, premium quality ingredients."}
                </p>

                <div className="mt-1 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[color:var(--app-muted)] sm:mt-2 sm:flex">
                    {Number(item?.orderCount || 0) > 0 ? (
                        <span>{Number(item?.orderCount || 0).toLocaleString("en-IN")} orders</span>
                    ) : null}

                    {Number(item?.reviewCount || 0) > 0 ? (
                        <span className="uppercase tracking-[0.14em]">{Number(item?.reviewCount || 0)} ratings</span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export {
    FALLBACK_IMAGE,
    EMPTY_MENU,
    normalizeText,
    compareMenuItems,
    getSectionMeta,
    MenuSection,
    MenuItemCard,
    isVegModeItem,
};
