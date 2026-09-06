import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    BarChart3,
    ChefHat,
    ChevronRight,
    Dot,
    Map as MapIcon,
    Navigation,
    QrCode,
    Receipt,
    Search,
    ShoppingBag,
    Store,
    Truck,
    UserCircle2,
    UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import { api, cachedGet } from "../utils/apiClient";
import useCachedGet from "../hooks/useCachedGet";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import BrandLogo from "../components/BrandLogo";
import CartDrawer from "../components/CartDrawer";
import VegModeToggle from "../components/VegModeToggle";
import CustomerNotificationBell from "../components/CustomerNotificationBell";
import Footer from "../components/Footer";
import PromoBannerSlider from "../components/PromoBannerSlider";
import PopularCategories, { normalizeCategoryName } from "../components/PopularCategories";
import TiffzyMapModal from "../components/TiffzyMapModal";
import SeoHead from "../components/SeoHead";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import { isVegModeItem } from "./restaurant/RestaurantMenu";

const toRad = (deg) => (Number(deg) * Math.PI) / 180;

const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

const hasCoords = (restaurant) => Number.isFinite(Number(restaurant?.latitude)) && Number.isFinite(Number(restaurant?.longitude));

const pickNearestRestaurant = (restaurants, lat, lon) => {
    const candidates = (restaurants || []).map((r) => {
        if (!hasCoords(r)) return null;
        const rLat = Number(r.latitude);
        const rLon = Number(r.longitude);

        if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) return null;
        if (rLat < -90 || rLat > 90 || rLon < -180 || rLon > 180) {
            console.warn(`[Tiffzy] Invalid coordinate bounds for ${r.name}: lat ${rLat}, lon ${rLon}. Skipping...`);
            return null;
        }
        return { ...r, latitude: rLat, longitude: rLon };
    }).filter(Boolean);

    if (!candidates.length) return null;

    console.log("=== TIFFZY NEAREST RESTAURANT DEBUG ===");
    console.log("User latitude:", lat);
    console.log("User longitude:", lon);

    let best = candidates[0];
    let bestKm = haversineKm(lat, lon, Number(best.latitude), Number(best.longitude));
    console.log(`Restaurant '${best.name}' lat:${best.latitude} lon:${best.longitude} dist:${bestKm.toFixed(1)}km`);

    for (const r of candidates.slice(1)) {
        const km = haversineKm(lat, lon, Number(r.latitude), Number(r.longitude));
        console.log(`Restaurant '${r.name}' lat:${r.latitude} lon:${r.longitude} dist:${km.toFixed(1)}km`);
        if (km < bestKm) {
            best = r;
            bestKm = km;
        }
    }

    return { restaurant: best, distanceKm: bestKm };
};

const normalizeRestaurantList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.restaurants)) return data.restaurants;
    return null;
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
const INITIAL_RESTAURANT_LIMIT = 24;
const SEARCH_RESTAURANT_LIMIT = 24;
const FEED_ITEM_LIMIT = 24;
const SEARCH_ITEM_LIMIT = 12;
const MIN_SEARCH_LENGTH = 2;

const normalizeSearch = (value) => String(value || "").trim();

const getCurrentPosition = () =>
    new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("Geolocation not supported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60_000,
        });
    });

export default function RestaurantChooser() {
    const { customer } = useAuth();
    const { addToCart, cart, total } = useCart();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(normalizeSearch(search));
    const [locationHint, setLocationHint] = useState("");
    const [detecting, setDetecting] = useState(false);
    const [backendState, setBackendState] = useState("checking");
    const [selectedItem, setSelectedItem] = useState(null);
    const [popupAnchor, setPopupAnchor] = useState(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [isMapOpen, setIsMapOpen] = useState(false);
    const vegModeEnabled = Boolean(restaurantContext?.vegOnly);
    const profilePath = customer ? "/profile/overview?scope=customer" : "/login?mode=customer";
    const profileLabel = customer ? "Profile" : "Login";

    const { data: restaurantData, loading: restaurantLoading, error: restaurantError, refresh: refreshRestaurants } = useCachedGet("/restaurants", {
        params: {
            limit: INITIAL_RESTAURANT_LIMIT,
            offset: 0,
        },
        ttlMs: 5_000,
        staleMs: 15_000,
    });

    const browseRestaurants = normalizeRestaurantList(restaurantData) || [];

    const probeBackend = useCallback(async () => {
        setBackendState("checking");
        try {
            await api.get("/healthz", { timeout: 2500 });
            setBackendState("up");
            return true;
        } catch {
            setBackendState("down");
            return false;
        }
    }, []);

    useEffect(() => {
        probeBackend();
    }, [probeBackend]);

    useEffect(() => {
        if (!selectedItem) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setSelectedItem(null);
                setPopupAnchor(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedItem]);

    const searchEnabled = deferredSearch.length >= MIN_SEARCH_LENGTH;
    const { data: catalogData, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useCachedGet("/catalog/search", {
        params: {
            q: searchEnabled ? deferredSearch : "",
            restaurantLimit: SEARCH_RESTAURANT_LIMIT,
            itemLimit: searchEnabled ? SEARCH_ITEM_LIMIT : FEED_ITEM_LIMIT,
        },
        ttlMs: 5_000,
        staleMs: 15_000,
    });

    const visibleItems = useMemo(() => {
        let items = Array.isArray(catalogData?.items) ? catalogData.items : [];
        if (vegModeEnabled) {
            items = items.filter((item) => (typeof isVegModeItem === "function" ? isVegModeItem(item) : true));
        }
        if (selectedCategory) {
            const target = normalizeCategoryName(selectedCategory).toLowerCase();
            items = items.filter((item) => {
                const cat = normalizeCategoryName(item?.category).toLowerCase();
                const name = String(item?.name || "").toLowerCase();
                return cat.includes(target) || target.includes(cat) || name.includes(target);
            });
        }
        return items;
    }, [catalogData?.items, vegModeEnabled, selectedCategory]);
    const itemSections = useMemo(() => {
        const groups = new Map();

        for (const item of visibleItems) {
            const rawCategory = String(item?.category || "").trim();
            const label = normalizeCategoryName(rawCategory) || "Other";
            const key = label.toLowerCase();

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    label,
                    items: [],
                });
            }

            groups.get(key).items.push(item);
        }

        return [...groups.values()];
    }, [visibleItems]);
    const activeSearchError = catalogError || "";

    const addItemToCart = (item) => {
        const slug = String(item?.restaurant?.slug || "").trim();
        if (slug) {
            setRestaurantContext({
                id: item?.restaurant?.id || null,
                name: item?.restaurant?.name || null,
                slug,
                logo: item?.restaurant?.logo || null,
                tableNo: null,
            });
        }

        addToCart(item);
    };

    const cartItemCount = cart.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

    const closeItemDetails = () => {
        setSelectedItem(null);
        setPopupAnchor(null);
    };

    const detectNearest = async ({ userTriggered = false } = {}) => {
        setDetecting(true);
        setLocationHint(userTriggered ? "Getting your current location..." : "Selecting the nearest restaurant...");

        try {
            const pos = await getCurrentPosition();
            const lat = Number(pos?.coords?.latitude);
            const lon = Number(pos?.coords?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                setLocationHint("Location not available. Please select a restaurant.");
                return;
            }

            const coordsData = await cachedGet("/restaurants", {
                params: { coordsOnly: 1 },
                ttlMs: 5 * 60_000,
                staleMs: 30 * 60_000,
            });
            const allRestaurants = normalizeRestaurantList(coordsData);
            const nearest = pickNearestRestaurant(
                Array.isArray(allRestaurants) && allRestaurants.length ? allRestaurants : browseRestaurants,
                lat,
                lon
            );
            if (!nearest?.restaurant) {
                setLocationHint("Restaurant coordinates not configured. Please select a restaurant.");
                return;
            }

            const roundedKm = Math.max(0, Math.round(nearest.distanceKm * 10) / 10);
            setLocationHint(`Selected ${nearest.restaurant.name} (${roundedKm} km away) based on your current location.`);
        } catch {
            // Permission denied or timeout.
            setLocationHint("Location permission denied or unavailable. Please select a restaurant.");
        } finally {
            setDetecting(false);
        }
    };

    const handleVegModeToggle = (enabled) => {
        setRestaurantContext({ vegOnly: Boolean(enabled) });
    };

    const handleRetryConnection = async () => {
        const ok = await probeBackend();
        if (ok) {
            await Promise.all([refreshCatalog({ force: true }), refreshRestaurants({ force: true })]);
        }
    };

    return (
        <div className="theme-page min-h-screen px-1 py-1.5 sm:px-4 sm:py-6 md:px-8 md:py-12">
            <div className="mx-auto w-full max-w-none">
                <section className="chooser-shell theme-panel relative overflow-hidden rounded-[24px] p-4 backdrop-blur sm:rounded-[28px] sm:p-5 md:rounded-[32px] md:p-8">
                    <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[color:var(--app-accent)]/10 blur-3xl" />
                    <div className="pointer-events-none absolute -left-12 bottom-0 h-52 w-52 rounded-full bg-[#c78f4a]/10 blur-3xl" />

                    <header className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex w-full flex-col items-start gap-3 lg:max-w-[55%]">
                            <div className="flex items-center gap-3.5">
                                <div className="chooser-logo-shell theme-card flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16 shadow-lg">
                                    <BrandLogo className="h-9 w-9 sm:h-11 sm:w-11" title="Tiffzy Logo" />
                                </div>
                                <div>
                                    <h1 className="bg-gradient-to-r from-[#ff8a1f] via-[#ea580c] to-[#9a3412] bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
                                        Tiffzy
                                    </h1>
                                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#d97706] sm:text-sm">
                                        Food Business Platform
                                    </p>
                                    <p className="text-[11px] font-semibold text-[color:var(--app-muted)]">
                                        All-in-one platform for restaurants and food businesses
                                    </p>
                                </div>
                            </div>
                            <p className="theme-muted text-sm sm:text-base leading-relaxed max-w-xl">
                                Tiffzy is a connected Food Business Platform powering online ordering, restaurant operations, QR table ordering, live kitchen orders, billing &amp; payments, analytics, and supply chain management.
                            </p>

                        </div>

                        <div className="relative z-10 flex w-full flex-col items-stretch gap-3 lg:max-w-[500px] lg:items-end">
                            <div className="flex w-full items-center justify-end gap-2 overflow-x-auto rounded-none border-0 bg-transparent p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 lg:w-fit lg:overflow-visible">
                                <VegModeToggle
                                    enabled={vegModeEnabled}
                                    onToggle={handleVegModeToggle}
                                    compact
                                    className="shrink-0"
                                />

                                <CustomerNotificationBell className="shrink-0" />

                                <Link
                                    to={profilePath}
                                    style={{ border: "none", boxShadow: "none" }}
                                    className="chooser-chip theme-soft-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-[11px] font-semibold sm:px-4 sm:py-3 sm:text-sm"
                                >
                                    <UserCircle2 size={16} />
                                    {profileLabel}
                                </Link>

                                <button
                                    onClick={() => detectNearest({ userTriggered: true })}
                                    disabled={detecting || restaurantLoading || browseRestaurants.length === 0}
                                    style={{ border: "none", boxShadow: "none" }}
                                    className="chooser-chip theme-soft-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-3 sm:text-sm"
                                >
                                    <Navigation size={16} />
                                    {detecting ? "Detecting..." : "Use my location"}
                                </button>

                                <button
                                    onClick={() => setIsMapOpen(true)}
                                    style={{ border: "none", boxShadow: "none" }}
                                    className="chooser-chip theme-soft-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#fe5102]/10 px-3 py-2 text-[11px] font-bold text-[#fe5102] hover:bg-[#fe5102]/20 sm:px-4 sm:py-3 sm:text-sm"
                                >
                                    <MapIcon size={16} />
                                    View Map 🗺️
                                </button>
                            </div>

                            <div className="relative w-full max-w-[520px] self-end">
                                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={18} />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search dishes across restaurants..."
                                    className="chooser-input theme-input w-full rounded-full border border-[var(--app-border)] bg-white/70 py-2.5 pl-11 pr-4 text-sm shadow-[0_10px_24px_rgba(104,70,37,0.08)] outline-none placeholder:text-[color:var(--app-muted)] sm:py-3"
                                />
                            </div>
                        </div>
                    </header>

                    <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-6">
                        {locationHint ? (
                            <div className="rounded-2xl border border-[var(--app-border)] bg-black/5 px-4 py-3 text-sm">
                                {locationHint}
                            </div>
                        ) : null}

                        <PromoBannerSlider />

                        <PopularCategories
                            items={catalogData?.items || []}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                        />

                        {backendState === "checking" ? (
                            <InitialBrowseLoadingCard />
                        ) : backendState === "down" ? (
                            <BackendOfflineCard
                                message={restaurantError || catalogError || "Network Error"}
                                onRetry={handleRetryConnection}
                            />
                        ) : (
                            <>
                                {catalogLoading ? (
                                    <p className="theme-muted text-sm">
                                        {searchEnabled ? "Searching dishes..." : "Loading popular dishes..."}
                                    </p>
                                ) : null}

                                {activeSearchError ? (
                                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                        {activeSearchError}
                                    </div>
                                ) : null}

                                {visibleItems.length === 0 && !catalogLoading ? (
                                    <div className="py-8 text-center">
                                        <h2 className="text-lg font-bold">No matches found</h2>
                                        <p className="theme-muted mt-2 text-sm">
                                            Try a different dish name or clear the search to browse popular items.
                                        </p>
                                    </div>
                                ) : null}

                                <div className="space-y-2.5">
                                    <div className="space-y-3">
                                        {itemSections.map((section) => (
                                            <div key={section.key} className="space-y-1">
                                                <div className="flex items-end justify-between gap-1">
                                                    <div>
                                                        <p className="theme-muted text-[9px] font-semibold uppercase tracking-[0.2em] sm:text-[10px]">
                                                            {section.label}
                                                        </p>
                                                        <h3 className="mt-0.5 text-[12px] font-bold sm:text-[13px]">
                                                            {section.items.length} {section.items.length === 1 ? "item" : "items"}
                                                        </h3>
                                                    </div>
                                                </div>

                                                <div className="snap-x snap-mandatory overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                    <div className="flex w-max gap-2 pr-1 sm:gap-2.5">
                                                        {section.items.map((item) => {
                                                            const cartItem = cart.find((c) => c.id === item.id);
                                                            const qty = cartItem ? cartItem.quantity : 0;
                                                            return (
                                                                <SearchItemCard
                                                                    key={item.id}
                                                                    item={item}
                                                                    selected={selectedItem?.id === item.id}
                                                                    quantity={qty}
                                                                    onToggleDetails={(event) => {
                                                                        const isSame = selectedItem?.id === item.id;
                                                                        if (isSame) {
                                                                            closeItemDetails();
                                                                            return;
                                                                        }

                                                                        const rect = event?.currentTarget?.getBoundingClientRect?.();
                                                                        const popupWidth = 250;
                                                                        const popupHeight = 215;
                                                                        const gap = 10;
                                                                        const viewportWidth = window.innerWidth;
                                                                        const viewportHeight = window.innerHeight;
                                                                        const left = rect
                                                                            ? Math.max(12, Math.min(rect.left, viewportWidth - popupWidth - 12))
                                                                            : Math.max(12, (viewportWidth - popupWidth) / 2);
                                                                        let top = rect ? rect.bottom + gap : Math.max(12, (viewportHeight - popupHeight) / 2);
                                                                        if (top + popupHeight > viewportHeight - 12) {
                                                                            top = rect ? Math.max(12, rect.top - popupHeight - gap) : top;
                                                                        }

                                                                        setSelectedItem(item);
                                                                        setPopupAnchor({ left, top });
                                                                    }}
                                                                    onClick={() => addItemToCart(item)}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        <PlatformCapabilitiesSection />
                    </div>
                </section>
            </div>

            {selectedItem ? <ItemDetailsPopup item={selectedItem} anchor={popupAnchor} onClose={closeItemDetails} /> : null}

            {cartItemCount > 0 ? (
                <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="fixed bottom-4 left-3 right-3 z-40 mx-auto flex max-w-[520px] items-center justify-between gap-3 rounded-[18px] border border-[var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.28)] sm:left-auto sm:right-4 sm:w-[280px] sm:max-w-none"
                >
                    <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-semibold">{cartItemCount} in cart</p>
                        <p className="theme-muted truncate text-xs">Tap to review items</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] theme-muted">Total</p>
                        <p className="text-base font-bold text-[color:var(--app-accent)]">₹{Math.round(Number(total || 0))}</p>
                    </div>
                </button>
            ) : null}

            <CartDrawer open={cartOpen} setOpen={setCartOpen} />

            <TiffzyMapModal
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                restaurants={browseRestaurants}
            />

            <Footer />
        </div>
    );
}

function SearchItemCard({ item, onClick, onToggleDetails, selected, quantity = 0 }) {
    const imageSrc = resolveImageUrl(item?.image) || FALLBACK_IMAGE;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick?.();
                }
            }}
            className={`chooser-item-card group flex w-[115px] shrink-0 snap-start flex-col overflow-hidden rounded-[14px] border text-left shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-0.5 sm:w-[124px] md:w-[132px] lg:w-[140px] ${
                quantity > 0
                    ? "border-emerald-500/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.12)_0%,rgba(16,185,129,0.04)_100%)] shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
                    : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] hover:border-white/15 hover:bg-white/6"
            }`}
        >
            <div className="relative aspect-[17/10] overflow-hidden bg-white/5">
                <img
                    src={imageSrc}
                    alt={item?.name || "Menu item"}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_35%,rgba(0,0,0,0.35)_100%)]" />
            </div>

            <div className="flex min-h-[72px] min-w-0 flex-1 flex-col p-1.5 sm:p-2">
                <div className="flex items-start justify-between gap-1">
                    <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold sm:text-[12px]">{item?.name}</h3>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleDetails?.(event);
                        }}
                        aria-label={selected ? "Hide item details" : "Show item details"}
                        className={`mt-0.5 inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition ${
                            selected
                                ? "border-[color:var(--app-primary)] bg-[color:var(--app-primary)] text-[color:var(--app-primary-text)]"
                                : "border-white/15 bg-black/35 text-white/85"
                        }`}
                    >
                        <Dot size={12} strokeWidth={3.5} />
                    </button>
                </div>
                <p className="theme-muted mt-[0.5px] truncate text-[8.5px] sm:text-[9.5px]">{item?.restaurant?.name || "Restaurant"}</p>

                <div className="mt-auto flex items-end justify-between gap-1 pt-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <span className="text-[9.5px] font-semibold text-[color:var(--app-accent)] sm:text-[10.5px]">Rs {Math.round(Number(item?.price || 0))}</span>
                    </div>

                    {quantity > 0 ? (
                        <span className="inline-flex h-5 px-1.5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 text-[9.5px] font-bold">
                            {quantity}
                        </span>
                    ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-white/5 text-[color:var(--app-accent)]">
                            <ChevronRight size={10} />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function ItemDetailsPopup({ item, anchor, onClose }) {
    const imageSrc = resolveImageUrl(item?.image) || FALLBACK_IMAGE;
    const placeText = [item?.restaurant?.city, item?.restaurant?.state].filter(Boolean).join(", ");
    const orderCount = Number(item?.orderCount || 0);
    const popupStyle = anchor ? { left: `${anchor.left}px`, top: `${anchor.top}px` } : undefined;
    const restaurantPath = buildRestaurantMenuPath(String(item?.restaurant?.slug || "").trim(), "");

    return (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" onClick={onClose}>
            <div
                style={popupStyle}
                className="fixed w-[250px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[18px] border border-white/10 bg-[color:var(--app-surface)] shadow-[0_22px_56px_rgba(0,0,0,0.34)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="relative aspect-[16/10] overflow-hidden">
                    <img src={imageSrc} alt={item?.name || "Menu item"} className="h-full w-full object-cover" />
                </div>

                <div className="space-y-2.5 p-3.5">
                    <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-bold leading-tight">{item?.name}</h3>
                            {restaurantPath ? (
                                <Link
                                    to={restaurantPath}
                                    className="theme-muted mt-0.5 block truncate text-[12px] underline decoration-dotted underline-offset-4 hover:text-[color:var(--app-text)]"
                                >
                                    {item?.restaurant?.name || "Restaurant"}
                                </Link>
                            ) : (
                                <p className="theme-muted mt-0.5 truncate text-[12px]">{item?.restaurant?.name || "Restaurant"}</p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-white/5 text-[color:var(--app-text)]"
                            aria-label="Close details"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-1.5 rounded-[14px] border border-white/8 bg-white/4 px-3 py-2.5 text-[12px]">
                        {placeText ? <p className="theme-muted">{placeText}</p> : null}
                        <p className="theme-muted">{orderCount.toLocaleString("en-IN")} orders</p>
                        <p className="font-semibold text-[color:var(--app-accent)]">Rs {Math.round(Number(item?.price || 0))}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
function BackendOfflineCard({ message, onRetry }) {
    return (
        <div className="overflow-hidden rounded-[28px] border border-red-500/20 bg-[linear-gradient(180deg,rgba(49,18,18,0.92)_0%,rgba(24,18,26,0.96)_100%)] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-center">
                <div className="relative mx-auto flex h-44 w-full max-w-[220px] items-center justify-center rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,214,132,0.2),rgba(255,255,255,0.03)_42%,rgba(255,255,255,0)_70%)]">
                    <svg viewBox="0 0 220 180" className="h-full w-full" role="img" aria-label="Cute character eating noodles">
                        <defs>
                            <linearGradient id="bowlGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ffcc7a" />
                                <stop offset="100%" stopColor="#ff8a1f" />
                            </linearGradient>
                            <linearGradient id="noodleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#fff4c8" />
                                <stop offset="100%" stopColor="#f8c55d" />
                            </linearGradient>
                        </defs>

                        <ellipse cx="110" cy="154" rx="66" ry="10" fill="rgba(0,0,0,0.28)" />
                        <circle cx="110" cy="72" r="32" fill="#ffd9c6" />
                        <circle cx="98" cy="68" r="4" fill="#3d2b24" />
                        <circle cx="122" cy="68" r="4" fill="#3d2b24" />
                        <path d="M102 83c6 6 10 6 18 0" fill="none" stroke="#8a4d35" strokeWidth="4" strokeLinecap="round" />
                        <path d="M92 88c10 8 26 8 36 0" fill="none" stroke="#ff9f8d" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                        <path d="M80 60c6-12 20-20 30-20 10 0 22 6 28 16" fill="none" stroke="#ffb36b" strokeWidth="8" strokeLinecap="round" />
                        <path d="M128 44c10 4 18 12 22 22" fill="none" stroke="#ffb36b" strokeWidth="8" strokeLinecap="round" />

                        <path d="M88 97c-16 7-28 23-31 40h110c-3-17-15-33-31-40" fill="url(#bowlGradient)" />
                        <path d="M70 101h80c-2 18-16 32-40 32s-38-14-40-32Z" fill="#fff8ef" opacity="0.95" />
                        <path d="M73 103c10 6 18 8 27 8s17-2 27-8c7 6 15 8 23 8" fill="none" stroke="url(#noodleGradient)" strokeWidth="5" strokeLinecap="round" />
                        <path d="M77 114c9 4 16 5 23 5s14-1 22-5" fill="none" stroke="url(#noodleGradient)" strokeWidth="4" strokeLinecap="round" />
                        <path d="M115 96c-4-15 1-22 12-28" fill="none" stroke="#ffd88b" strokeWidth="4" strokeLinecap="round" />
                        <path d="M136 88c3 8 3 16 0 24" fill="none" stroke="#ffd88b" strokeWidth="4" strokeLinecap="round" />

                        <path d="M145 56l24 10" stroke="#ffe6ab" strokeWidth="4" strokeLinecap="round" />
                        <path d="M144 64l26 6" stroke="#ffe6ab" strokeWidth="4" strokeLinecap="round" />
                        <path d="M142 72l24 0" stroke="#ffe6ab" strokeWidth="4" strokeLinecap="round" />

                        <circle cx="50" cy="40" r="5" fill="#ffd9c6" opacity="0.7" />
                        <circle cx="172" cy="34" r="5" fill="#ffd9c6" opacity="0.7" />
                        <circle cx="182" cy="60" r="3" fill="#ffd9c6" opacity="0.55" />
                        <circle cx="42" cy="62" r="3" fill="#ffd9c6" opacity="0.55" />
                    </svg>
                </div>

                <div className="space-y-3">
                    <span className="inline-flex w-fit items-center rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-200">
                        Connection lost
                    </span>
                    <h2 className="text-2xl font-bold text-white sm:text-3xl">We lost the dish feed</h2>
                    <p className="max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                        The backend is not responding right now, so the dish feed cannot load. Please check the server and
                        try again in a moment.
                    </p>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65 sm:text-sm">
                        {message}
                    </div>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="theme-button inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
                    >
                        Try again
                    </button>
                </div>
            </div>
        </div>
    );
}

function InitialBrowseLoadingCard() {
    return (
        <div className="overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                <div className="relative mx-auto flex h-40 w-full max-w-[220px] items-center justify-center rounded-[28px] border border-white/10 bg-white/5">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 animate-pulse rounded-full border-4 border-[color:var(--app-accent)] border-t-transparent" />
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white/85">Checking connection</p>
                            <p className="mt-1 text-xs text-white/55">Please wait while we load dishes.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                        Loading
                    </span>
                    <h2 className="text-2xl font-bold text-white sm:text-3xl">Warming up the feed</h2>
                    <p className="max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                        We are reaching out to the backend and preparing the mixed dish feed. If the server takes a moment,
                        this screen stays calm instead of flashing the layout.
                    </p>
                </div>
            </div>
        </div>
    );
}

function PlatformCapabilitiesSection() {
    const capabilities = [
        {
            icon: <ShoppingBag className="h-6 w-6 text-[#ff8a1f]" />,
            title: "Online Ordering",
            description: "Seamless customer food ordering experience for takeaway, delivery, and online digital menus.",
        },
        {
            icon: <Store className="h-6 w-6 text-[#ff8a1f]" />,
            title: "Restaurant Operations",
            description: "Complete back-office management, staff role permissions, and restaurant configuration.",
        },
        {
            icon: <QrCode className="h-6 w-6 text-[#ff8a1f]" />,
            title: "QR Table Ordering",
            description: "Instant, contactless ordering from dining tables with table-specific digital menus.",
        },
        {
            icon: <ChefHat className="h-6 w-6 text-[#ff8a1f]" />,
            title: "Live Kitchen Orders",
            description: "Real-time kitchen order tickets (KOT), status dispatch, and chef boards for fast execution.",
        },
        {
            icon: <Receipt className="h-6 w-6 text-[#ff8a1f]" />,
            title: "Billing & Payments",
            description: "Integrated POS billing desk with digital payment gateways and automated settlements.",
        },
        {
            icon: <BarChart3 className="h-6 w-6 text-[#ff8a1f]" />,
            title: "Analytics & Insights",
            description: "Real-time sales reporting, revenue metrics, dish popularities, and performance tracking.",
        },
        {
            icon: <Truck className="h-6 w-6 text-[#ff8a1f]" />,
            title: "Supply Chain Management",
            description: "B2B ingredient marketplace, supplier connectivity, and automated stock & inventory controls.",
        },
    ];

    return (
        <section className="mt-12 space-y-6">
            <div className="rounded-[24px] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-alpha,var(--app-bg))_92%,#000_8%)] p-6 sm:p-8">
                <div className="max-w-3xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff8a1f]/10 border border-[#ff8a1f]/30 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#ff8a1f]">
                        Smart QR Restaurant Ordering System
                    </span>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-[color:var(--app-text)] sm:text-3xl">
                        Tiffzy — Smart QR Restaurant Ordering System &amp; Food Business Platform
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--app-muted)] sm:text-base">
                        <strong>Tiffzy</strong> is a comprehensive Smart QR Restaurant Ordering System and Food Business Platform operated by <strong>SURVETRA SERVICES</strong>. From front-of-house customer online ordering to back-of-house restaurant operations, QR table ordering, live kitchen orders, POS billing &amp; payments, real-time analytics, and B2B supply chain management, Tiffzy connects every aspect of your food business.
                    </p>
                </div>


                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {capabilities.map((cap) => (
                        <div
                            key={cap.title}
                            className="rounded-2xl border border-[var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm transition hover:border-[#ff8a1f]/40"
                        >
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff8a1f]/10">
                                {cap.icon}
                            </div>
                            <h3 className="mt-4 text-base font-bold text-[color:var(--app-text)]">{cap.title}</h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--app-muted)]">{cap.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

