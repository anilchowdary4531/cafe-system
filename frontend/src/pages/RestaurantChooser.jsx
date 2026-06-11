import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navigation, Search, UserCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import { cachedGet } from "../utils/apiClient";
import useCachedGet from "../hooks/useCachedGet";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import BrandLogo from "../components/BrandLogo";
import VegModeToggle from "../components/VegModeToggle";
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
    const candidates = (restaurants || []).filter(hasCoords);
    if (!candidates.length) return null;

    let best = candidates[0];
    let bestKm = haversineKm(lat, lon, Number(best.latitude), Number(best.longitude));

    for (const r of candidates.slice(1)) {
        const km = haversineKm(lat, lon, Number(r.latitude), Number(r.longitude));
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
const SEARCH_ITEM_LIMIT = 12;
const MIN_SEARCH_LENGTH = 2;

const normalizeSearch = (value) => String(value || "").trim();

const formatLocation = (restaurant) => [restaurant?.city, restaurant?.state].filter(Boolean).join(", ");

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
    const navigate = useNavigate();
    const { customer } = useAuth();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(normalizeSearch(search));
    const [selectedSlugState, setSelectedSlugState] = useState(String(restaurantContext?.slug || ""));
    const [locationHint, setLocationHint] = useState("");
    const [detecting, setDetecting] = useState(false);
    const vegModeEnabled = Boolean(restaurantContext?.vegOnly);
    const profilePath = customer ? "/profile/overview?scope=customer" : "/login?mode=customer";
    const profileLabel = customer ? "Profile" : "Login";

    const selectedSlug = String(restaurantContext?.slug || selectedSlugState || "");

    const { data: browseData, loading: browseLoading, error: browseError } = useCachedGet("/restaurants", {
        params: {
            limit: INITIAL_RESTAURANT_LIMIT,
            offset: 0,
        },
        ttlMs: 5 * 60_000,
        staleMs: 30 * 60_000,
    });

    const browseRestaurants = normalizeRestaurantList(browseData) || [];
    const browseTotal = Number(browseData?.total || browseRestaurants.length);

    const searchEnabled = deferredSearch.length >= MIN_SEARCH_LENGTH;
    const { data: searchData, loading: searchLoading, error: searchError } = useCachedGet("/catalog/search", {
        params: {
            q: deferredSearch,
            restaurantLimit: SEARCH_RESTAURANT_LIMIT,
            itemLimit: SEARCH_ITEM_LIMIT,
        },
        ttlMs: 2 * 60_000,
        staleMs: 10 * 60_000,
        enabled: searchEnabled,
    });

    const visibleRestaurants = searchEnabled ? normalizeRestaurantList(searchData) || [] : browseRestaurants;
    const visibleItems = searchEnabled
        ? (Array.isArray(searchData?.items) ? searchData.items.filter((item) => !vegModeEnabled || isVegModeItem(item)) : [])
        : [];
    const restaurantTotal = searchEnabled ? Number(searchData?.totalRestaurants || 0) : browseTotal;
    const itemTotal = searchEnabled ? visibleItems.length : 0;
    const activeSearchError = searchEnabled ? searchError : "";

    const openRestaurant = (restaurant) => {
        if (!restaurant?.slug) return;

        setRestaurantContext({
            id: restaurant.id || null,
            name: restaurant.name || null,
            slug: restaurant.slug || null,
            logo: restaurant.logo || restaurant.logoUrl || null,
            tableNo: null,
        });
        setSelectedSlugState(String(restaurant.slug || ""));

        navigate(`/r/${restaurant.slug}/menu`, { replace: true });
    };

    const openItemRestaurant = (item) => {
        const slug = String(item?.restaurant?.slug || "").trim();
        if (!slug) return;

        setRestaurantContext({
            id: item?.restaurant?.id || null,
            name: item?.restaurant?.name || null,
            slug,
            logo: item?.restaurant?.logo || null,
            tableNo: null,
        });
        setSelectedSlugState(slug);

        const itemName = String(item?.name || "").trim();
        const path = itemName ? `/r/${slug}/menu?search=${encodeURIComponent(itemName)}` : `/r/${slug}/menu`;
        navigate(path, { replace: true });
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

            setSelectedSlugState(nearest.restaurant.slug);
            const roundedKm = Math.max(0, Math.round(nearest.distanceKm * 10) / 10);
            setLocationHint(`Selected ${nearest.restaurant.name} (${roundedKm} km away) based on your current location.`);
        } catch {
            // Permission denied or timeout.
            setLocationHint("Location permission denied or unavailable. Please select a restaurant.");
        } finally {
            setDetecting(false);
        }
    };

    const isSearching = searchEnabled;
    const handleVegModeToggle = (enabled) => {
        setRestaurantContext({ vegOnly: Boolean(enabled) });
    };

    return (
        <div className="theme-page min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-12">
            <div className="mx-auto w-full max-w-none">
                <section className="theme-panel relative overflow-hidden rounded-[24px] p-4 backdrop-blur sm:rounded-[28px] sm:p-5 md:rounded-[32px] md:p-8">
                    <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[color:var(--app-accent)]/10 blur-3xl" />
                    <div className="pointer-events-none absolute -left-12 bottom-0 h-52 w-52 rounded-full bg-[#c78f4a]/10 blur-3xl" />

                    <header className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex w-full items-start gap-3 sm:items-center sm:gap-4 lg:max-w-[58%]">
                            <div className="theme-card flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14">
                                <BrandLogo className="h-8 w-8 sm:h-9 sm:w-9" title="Brand logo" />
                            </div>
                            <div className="min-w-0 space-y-2">
                                <span className="inline-flex bg-gradient-to-r from-[#ff8a1f] via-[#d97706] to-[#8a4b11] bg-clip-text text-[12px] font-black uppercase tracking-[0.5em] text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.45)] sm:text-[13px]">
                                    Tiffzy
                                </span>
                                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Choose your restaurant</h1>
                            </div>
                        </div>

                        <div className="relative z-10 flex w-full flex-col items-stretch gap-3 lg:max-w-[680px] lg:items-end">
                            <div className="flex w-full items-center justify-end gap-2 overflow-x-auto rounded-none border-0 bg-transparent p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 lg:w-fit lg:overflow-visible">
                                <VegModeToggle
                                    enabled={vegModeEnabled}
                                    onToggle={handleVegModeToggle}
                                    compact
                                    className="shrink-0"
                                />

                                <Link
                                    to={profilePath}
                                    style={{ border: "none", boxShadow: "none" }}
                                    className="theme-soft-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-[11px] font-semibold sm:px-4 sm:py-3 sm:text-sm"
                                >
                                    <UserCircle2 size={16} />
                                    {profileLabel}
                                </Link>

                                <button
                                    onClick={() => detectNearest({ userTriggered: true })}
                                    disabled={detecting || browseLoading || browseRestaurants.length === 0}
                                    style={{ border: "none", boxShadow: "none" }}
                                    className="theme-soft-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-3 sm:text-sm"
                                >
                                    <Navigation size={16} />
                                    {detecting ? "Detecting..." : "Use my location"}
                                </button>
                            </div>

                            <div className="relative w-full max-w-[520px] self-end">
                                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={18} />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search restaurants or dishes..."
                                    className="theme-input w-full rounded-full border border-[var(--app-border)] bg-white/70 py-2.5 pl-11 pr-4 text-sm shadow-[0_10px_24px_rgba(104,70,37,0.08)] outline-none placeholder:text-[color:var(--app-muted)] sm:py-3"
                                />
                            </div>
                        </div>
                    </header>

                    <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
                        {browseError ? (
                            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {browseError}
                            </div>
                        ) : null}

                        {locationHint ? (
                            <div className="rounded-2xl border border-[var(--app-border)] bg-black/5 px-4 py-3 text-sm">
                                {locationHint}
                            </div>
                        ) : null}

                        {isSearching && searchLoading ? (
                            <p className="theme-muted text-sm">Searching restaurants and dishes...</p>
                        ) : null}

                        {activeSearchError ? (
                            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {activeSearchError}
                            </div>
                        ) : null}

                        {isSearching && visibleRestaurants.length === 0 && visibleItems.length === 0 && !searchLoading ? (
                            <div className="rounded-[28px] border border-[var(--app-border)] bg-white/55 p-6 text-center">
                                <h2 className="text-lg font-bold">No matches found</h2>
                                <p className="theme-muted mt-2 text-sm">
                                    Try a different restaurant name, dish name, or category.
                                </p>
                            </div>
                        ) : null}

                        {!isSearching ? (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                                    <div>
                                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">
                                            Restaurants
                                        </p>
                                        <h2 className="mt-1 text-lg font-bold sm:text-xl">Tap a restaurant to open its menu</h2>
                                    </div>
                                    <p className="theme-muted text-sm sm:text-right">
                                        {browseTotal ? `${browseTotal.toLocaleString("en-IN")} total` : ""}
                                    </p>
                                </div>

                                {browseLoading ? <p className="theme-muted text-sm">Loading restaurants...</p> : null}

                                <div className="grid justify-start gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(240px,280px))]">
                                    {browseRestaurants.map((restaurant) => {
                                        const isSelected = String(restaurant.slug) === String(selectedSlug);
                                        return (
                                            <RestaurantCard
                                                key={restaurant.id}
                                                restaurant={restaurant}
                                                isSelected={isSelected}
                                                onClick={() => openRestaurant(restaurant)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                                    <div>
                                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">
                                            Restaurants
                                        </p>
                                        <h2 className="mt-1 text-lg font-bold sm:text-xl">
                                            {restaurantTotal.toLocaleString("en-IN")} restaurants found
                                        </h2>
                                    </div>
                                </div>

                                <div className="grid justify-start gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(240px,280px))]">
                                    {visibleRestaurants.map((restaurant) => {
                                        const isSelected = String(restaurant.slug) === String(selectedSlug);
                                        return (
                                            <RestaurantCard
                                                key={restaurant.id}
                                                restaurant={restaurant}
                                                isSelected={isSelected}
                                                onClick={() => openRestaurant(restaurant)}
                                            />
                                        );
                                    })}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                                        <div>
                                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">
                                                Dishes
                                            </p>
                                            <h2 className="mt-1 text-lg font-bold sm:text-xl">
                                                {itemTotal.toLocaleString("en-IN")} dish matches
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {visibleItems.map((item) => (
                                            <SearchItemCard
                                                key={item.id}
                                                item={item}
                                                onClick={() => openItemRestaurant(item)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

function RestaurantCard({ restaurant, isSelected, onClick }) {
    const placeText = formatLocation(restaurant);
    const logoSrc = resolveImageUrl(restaurant?.logo || restaurant?.logoUrl);

    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "theme-card group w-full max-w-[280px] overflow-hidden rounded-[24px] text-left transition hover:-translate-y-1 hover:shadow-2xl",
                isSelected ? "ring-2 ring-[color:var(--app-accent)]" : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="relative aspect-[16/9] overflow-hidden bg-[linear-gradient(135deg,rgba(255,133,27,0.18)_0%,rgba(255,255,255,0.45)_100%)]">
                {logoSrc ? (
                    <img
                        src={logoSrc}
                        alt={restaurant?.name || "Restaurant logo"}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <BrandLogo className="h-16 w-16" title={restaurant?.name || "Restaurant logo"} />
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    {isSelected ? <span className="theme-pill rounded-full px-2.5 py-0.5 text-[10px] font-semibold">Selected</span> : null}
                    {placeText ? <span className="theme-pill rounded-full px-2.5 py-0.5 text-[10px] font-semibold">{placeText}</span> : null}
                </div>

            </div>

            <div className="flex min-h-[100px] flex-col gap-2 p-3">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-bold">{restaurant?.name}</h3>
                    <p className="theme-muted mt-1 text-xs sm:text-sm">{placeText || "Tap to open this restaurant menu"}</p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                    <p className="theme-muted text-[10px] uppercase tracking-[0.2em]">{restaurant?.slug}</p>
                    <span className="theme-button inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold">
                        View items
                    </span>
                </div>
            </div>
        </button>
    );
}

function SearchItemCard({ item, onClick }) {
    const imageSrc = resolveImageUrl(item?.image) || FALLBACK_IMAGE;
    const placeText = [item?.restaurant?.city, item?.restaurant?.state].filter(Boolean).join(", ");

    return (
        <button
            type="button"
            onClick={onClick}
            className="theme-card group flex w-full flex-col gap-3 rounded-[24px] p-3 text-left transition hover:-translate-y-0.5 hover:shadow-2xl sm:flex-row sm:items-center"
        >
            <div className="h-32 w-full shrink-0 overflow-hidden rounded-2xl sm:h-16 sm:w-16">
                <img src={imageSrc} alt={item?.name || "Menu item"} className="h-full w-full object-cover" loading="lazy" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    {item?.category ? (
                        <span className="theme-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">{item.category}</span>
                    ) : null}
                    {item?.isFeatured ? (
                        <span className="theme-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">Featured</span>
                    ) : null}
                </div>

                <h3 className="mt-1 truncate text-base font-bold">{item?.name}</h3>
                <p className="theme-muted mt-1 truncate text-sm">
                    {item?.restaurant?.name}
                    {placeText ? ` - ${placeText}` : ""}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="theme-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                        Rs {Math.round(Number(item?.price || 0))}
                    </span>
                    {Number(item?.orderCount || 0) > 0 ? (
                        <span className="theme-muted text-xs">{Number(item?.orderCount || 0).toLocaleString("en-IN")} orders</span>
                    ) : null}
                </div>
            </div>

            <span className="theme-button inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold sm:shrink-0">
                Open
            </span>
        </button>
    );
}
