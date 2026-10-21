import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Search, ShoppingBag, Sparkles, Tags } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useRestaurantContext } from "../../context/RestaurantContext";
import CartDrawer from "../../components/CartDrawer";
import BrandLogo from "../../components/BrandLogo";
import Footer from "../../components/Footer";
import useCachedGet from "../../hooks/useCachedGet";
import { getCustomerFavorites, toggleFavoriteMenuItem } from "../../utils/customerFavorites";
import { showToast } from "../../utils/toast";
import {
    EMPTY_MENU,
    compareMenuItems,
    getSectionMeta,
    normalizeText,
    isVegModeItem,
    MenuSection,
} from "./RestaurantMenu";
import VegModeToggle from "../../components/VegModeToggle";
import {
    TOBACCO_KEYWORDS,
    isTobaccoItem,
    isTobaccoCategory,
    isTobaccoText,
    isTobaccoAgeConfirmed,
    setTobaccoAgeConfirmed,
} from "../../utils/tobaccoUtils";
import TobaccoBanner from "../../components/tobacco/TobaccoBanner";
import TobaccoAgeVerificationModal from "../../components/tobacco/TobaccoAgeVerificationModal";

const FEATURED_MENU_THRESHOLD = 10;

export default function RestaurantPublicMenu() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const { addToCart, cart, total } = useCart();

    const tableFromUrl = String(searchParams.get("table") || "").trim();
    const searchFromUrl = String(searchParams.get("search") || "").trim();

    const { data, loading, error, errorStatus, refresh } = useCachedGet(`/r/${slug}/menu`, {
        ttlMs: 5_000,
        staleMs: 15_000,
        scope: `restaurant:${slug}`,
    });

    const isNotFound =
        errorStatus === 404 ||
        (!data && Boolean(error) && (errorStatus === 404 || error.toLowerCase().includes("not found"))) ||
        (!loading && Boolean(data) && !data.restaurant);

    const isNetworkError =
        !isNotFound &&
        (errorStatus === 0 ||
            (!data &&
                Boolean(error) &&
                (error.toLowerCase().includes("network") ||
                    error.toLowerCase().includes("err_network") ||
                    error.toLowerCase().includes("timeout"))));

    const isServerError =
        !isNotFound &&
        !isNetworkError &&
        (Boolean(errorStatus && errorStatus >= 500) || (!data && Boolean(error)));
    const restaurant = data?.restaurant || null;
    const menu = Array.isArray(data?.menu) ? data.menu : EMPTY_MENU;
    const restaurantName = String(restaurant?.name || slug || "Restaurant").trim();
    const restaurantLocation = [restaurant?.city, restaurant?.state].filter(Boolean).join(", ");
    const vegModeEnabled = Boolean(restaurantContext?.vegOnly);

    const [search, setSearch] = useState(() => searchFromUrl);
    const [activeSection, setActiveSection] = useState("all");
    const [cartOpen, setCartOpen] = useState(false);
    const [favorites, setFavorites] = useState(() => getCustomerFavorites());
    const [showAgeModal, setShowAgeModal] = useState(false);

    const handleOpenTobacco = () => {
        if (!isTobaccoAgeConfirmed()) {
            setShowAgeModal(true);
        } else {
            navigate(`/r/${slug}/tobacco`);
        }
    };

    const handleAddToCart = (item) => {
        if (isTobaccoItem(item) && !isTobaccoAgeConfirmed()) {
            setShowAgeModal(true);
            return;
        }
        addToCart(item);
    };

    const handleAgeConfirm = () => {
        setTobaccoAgeConfirmed(true);
        setShowAgeModal(false);
        navigate(`/r/${slug}/tobacco`);
    };

    const handleAgeCancel = () => {
        setShowAgeModal(false);
    };

    const sectionRefs = useRef(new Map());
    const menuStartRef = useRef(null);

    useEffect(() => {
        setRestaurantContext({ slug: slug || null, tableNo: null });
    }, [setRestaurantContext, slug]);

    useEffect(() => {
        if (!data?.restaurant) return;
        setRestaurantContext({
            id: data.restaurant.id || null,
            name: data.restaurant.name || null,
            slug: data.restaurant.slug || slug || null,
            logo: data.restaurant.logo || data.restaurant.logoUrl || null,
            tableNo: null,
        });
    }, [data?.restaurant, setRestaurantContext, slug]);

    const handleVegModeToggle = useCallback(
        (enabled) => {
            setRestaurantContext({ vegOnly: Boolean(enabled) });
        },
        [setRestaurantContext]
    );

    const menuWithMeta = useMemo(() => {
        return menu.map((item, index) => {
            const section = getSectionMeta(item, index);
            return {
                ...item,
                _index: index,
                _score: Number(item?.isFeatured ? 1_000_000 : 0) + Number(item?.orderCount || 0) * 12 + Number(item?.rating || 0) * 100 + Number(item?.reviewCount || 0),
                _section: section,
            };
        });
    }, [menu]);

    const filtered = useMemo(() => {
        const q = normalizeText(search);
        return menuWithMeta.filter((item) => {
            // Strictly exclude tobacco products from the normal restaurant public menu
            if (isTobaccoItem(item) || isTobaccoCategory(item?.category)) {
                return false;
            }

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
                if (sectionKey) setActiveSection(sectionKey);
            },
            {
                rootMargin: "-15% 0px -68% 0px",
                threshold: [0.12, 0.25, 0.5, 0.75],
            }
        );

        observedNodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [filtered.length, menuSections]);

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

    if (slug && tableFromUrl) {
        return <Navigate to={`/m/${encodeURIComponent(slug)}/${encodeURIComponent(tableFromUrl)}`} replace />;
    }

    if (loading) {
        return (
            <div className="theme-page flex min-h-screen items-center justify-center text-sm font-medium theme-muted">
                Loading Menu...
            </div>
        );
    }

    if (isNotFound) {
        return (
            <div className="theme-page min-h-screen">
                <div className="theme-nav sticky top-0 z-30 border-b px-3 py-3 sm:px-6">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1.5 shadow-[0_4px_14px_rgba(104,70,37,0.12)] sm:h-12 sm:w-12">
                                <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
                                    Tiffzy
                                </p>
                            </div>
                        </Link>
                        <Link
                            to="/"
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold sm:text-sm"
                        >
                            <span>Back to Restaurants</span>
                        </Link>
                    </div>
                </div>

                <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
                    <div className="theme-card flex flex-col items-center rounded-3xl p-8 sm:p-10 shadow-lg border border-[var(--app-border)]/40">
                        <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                            Restaurant Not Found
                        </h2>
                        <p className="theme-muted mt-3 text-sm">
                            This restaurant is no longer available or the link is invalid.
                        </p>
                        <div className="mt-6">
                            <Link
                                to="/"
                                className="theme-button inline-flex items-center rounded-2xl px-6 py-3 text-sm font-semibold shadow-md"
                            >
                                Back to Restaurants
                            </Link>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (isNetworkError) {
        return (
            <div className="theme-page min-h-screen">
                <div className="theme-nav sticky top-0 z-30 border-b px-3 py-3 sm:px-6">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1.5 shadow-[0_4px_14px_rgba(104,70,37,0.12)] sm:h-12 sm:w-12">
                                <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
                                    Tiffzy
                                </p>
                            </div>
                        </Link>
                        <Link
                            to="/"
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold sm:text-sm"
                        >
                            <span>Back Home</span>
                        </Link>
                    </div>
                </div>

                <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
                    <div className="theme-card flex flex-col items-center rounded-3xl p-8 sm:p-10 shadow-lg border border-[var(--app-border)]/40">
                        <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                            Connection Problem
                        </h2>
                        <p className="theme-muted mt-3 text-sm">
                            Unable to connect to the server. Please check your connection.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => refresh({ force: true })}
                                className="theme-button inline-flex items-center rounded-2xl px-6 py-3 text-sm font-semibold shadow-md"
                            >
                                Try Again
                            </button>
                            <Link
                                to="/"
                                className="theme-soft-button inline-flex items-center rounded-2xl px-5 py-3 text-sm font-semibold"
                            >
                                Back to Restaurants
                            </Link>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (isServerError) {
        return (
            <div className="theme-page min-h-screen">
                <div className="theme-nav sticky top-0 z-30 border-b px-3 py-3 sm:px-6">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1.5 shadow-[0_4px_14px_rgba(104,70,37,0.12)] sm:h-12 sm:w-12">
                                <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
                                    Tiffzy
                                </p>
                            </div>
                        </Link>
                        <Link
                            to="/"
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold sm:text-sm"
                        >
                            <span>Back Home</span>
                        </Link>
                    </div>
                </div>

                <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
                    <div className="theme-card flex flex-col items-center rounded-3xl p-8 sm:p-10 shadow-lg border border-[var(--app-border)]/40">
                        <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                            Unable to Load Menu
                        </h2>
                        <p className="theme-muted mt-3 text-sm">
                            We couldn't load this restaurant's menu right now.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => refresh({ force: true })}
                                className="theme-button inline-flex items-center rounded-2xl px-6 py-3 text-sm font-semibold shadow-md"
                            >
                                Try Again
                            </button>
                            <Link
                                to="/"
                                className="theme-soft-button inline-flex items-center rounded-2xl px-5 py-3 text-sm font-semibold"
                            >
                                Back to Restaurants
                            </Link>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    const hasResults = filtered.length > 0;

    return (
        <div className="theme-page min-h-screen">
            <div className="theme-nav sticky top-0 z-30 border-b px-2 py-2 sm:px-4 md:px-6">
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <Link to="/" className="flex min-w-0 items-center gap-3 justify-self-start">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3a3] bg-white p-1.5 shadow-[0_4px_14px_rgba(104,70,37,0.12)] sm:h-12 sm:w-12">
                            <BrandLogo className="h-full w-full" title="Tiffzy logo" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
                                Tiffzy
                            </p>
                        </div>
                    </Link>

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

                        <Link
                            to="/"
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm"
                        >
                            <span>Home</span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="w-full px-1 py-4 pb-28 sm:px-4 md:px-6 md:py-5 md:pb-10">
                <div ref={menuStartRef} className="scroll-mt-32">
                    <div className="mb-4 space-y-3">
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

                        {menu.length > 0 && (
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

                                {/* Clearly separated Tobacco Entry */}
                                <button
                                    type="button"
                                    onClick={handleOpenTobacco}
                                    className="theme-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:py-2 sm:text-sm bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
                                >
                                    <span>🚬 Tobacco</span>
                                </button>
                            </div>
                        )}
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
                            onAdd={handleAddToCart}
                            sectionRef={registerSectionRef(section.key)}
                            cart={cart}
                        />
                    ))}

                    {!hasResults && (
                        <div className="py-12 text-center">
                            <h3 className="text-lg font-bold">
                                {vegModeEnabled
                                    ? "No veg items found"
                                    : search.trim()
                                    ? "No items found"
                                    : "No menu items available"}
                            </h3>
                            <p className="theme-muted mt-2 text-sm">
                                {vegModeEnabled
                                    ? "Veg mode is on. Turn it off to browse the full menu."
                                    : search.trim()
                                    ? "Try a different search term or clear the search to browse the full menu."
                                    : "This restaurant currently has no items listed on the menu."}
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

            <Footer />
            <CartDrawer open={cartOpen} setOpen={setCartOpen} />
            <TobaccoAgeVerificationModal
                isOpen={showAgeModal}
                onConfirm={handleAgeConfirm}
                onCancel={handleAgeCancel}
            />
        </div>
    );
}
