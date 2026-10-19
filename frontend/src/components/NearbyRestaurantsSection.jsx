import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Clock,
    MapPin,
    Navigation,
    Store,
    Truck,
    AlertCircle,
    ChevronRight,
    RefreshCw,
} from "lucide-react";
import { api } from "../utils/apiClient";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";

const FALLBACK_RESTAURANT_IMAGE = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5";

const getCurrentBrowserPosition = () =>
    new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            const err = new Error("Geolocation is not supported by your browser.");
            err.code = "UNSUPPORTED";
            reject(err);
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60_000,
        });
    });

export default function NearbyRestaurantsSection({
    activeAddress,
    onSelectRestaurant,
    onOpenAddressModal,
    className = "",
}) {
    const [nearbyData, setNearbyData] = useState(null);
    const [status, setStatus] = useState("idle"); // "idle" | "loading" | "success" | "denied" | "unavailable" | "error"
    const [errorMessage, setErrorMessage] = useState("");
    const [currentCoords, setCurrentCoords] = useState(null);

    const fetchNearby = useCallback(async (lat, lng, radius = 5) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setStatus("loading");
        setErrorMessage("");

        try {
            const res = await api.get("/api/restaurants/nearby", {
                params: {
                    lat,
                    lng,
                    radius,
                    limit: 12,
                },
            });

            const data = res?.data || res;
            setNearbyData(data);
            setCurrentCoords({ lat, lng });
            setStatus("success");
        } catch (err) {
            console.error("Failed to fetch nearby restaurants:", err);
            setErrorMessage(err?.response?.data?.message || err?.message || "Could not retrieve nearby restaurants.");
            setStatus("error");
        }
    }, []);

    const requestLocation = useCallback(async () => {
        setStatus("loading");
        setErrorMessage("");

        try {
            const pos = await getCurrentBrowserPosition();
            const lat = Number(pos?.coords?.latitude);
            const lng = Number(pos?.coords?.longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                setStatus("unavailable");
                setErrorMessage("Invalid coordinates returned from GPS.");
                return;
            }

            await fetchNearby(lat, lng);
        } catch (err) {
            console.warn("Location permission or detection error:", err);
            if (err?.code === 1 || err?.name === "NotAllowedError") {
                setStatus("denied");
                setErrorMessage("Location permission was denied. Enable location in browser settings or choose a saved address.");
            } else if (err?.code === 2 || err?.code === "UNSUPPORTED") {
                setStatus("unavailable");
                setErrorMessage("Location is currently unavailable on this device.");
            } else if (err?.code === 3) {
                setStatus("unavailable");
                setErrorMessage("Location request timed out. Please try again.");
            } else {
                setStatus("error");
                setErrorMessage(err?.message || "Failed to retrieve location.");
            }
        }
    }, [fetchNearby]);

    // Automatically fetch if activeAddress has coordinates, or probe permission state
    useEffect(() => {
        const addrLat = Number(activeAddress?.latitude ?? activeAddress?.lat);
        const addrLng = Number(activeAddress?.longitude ?? activeAddress?.lng);

        if (Number.isFinite(addrLat) && Number.isFinite(addrLng)) {
            fetchNearby(addrLat, addrLng);
            return;
        }

        // Check if browser permission was already granted previously
        if (typeof navigator !== "undefined" && navigator.permissions?.query) {
            navigator.permissions.query({ name: "geolocation" }).then((perm) => {
                if (perm.state === "granted") {
                    requestLocation();
                }
            }).catch(() => {
                // Ignore permissions API failures
            });
        }
    }, [activeAddress, fetchNearby, requestLocation]);

    const restaurants = nearbyData?.restaurants || [];

    return (
        <section aria-label="Restaurants Near You" className={`space-y-3.5 ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-[#ff8a1f]">
                        <Navigation size={17} className="fill-[#ff8a1f]/20" />
                    </div>
                    <div>
                        <h2 className="text-base font-black tracking-tight text-[color:var(--app-text)] sm:text-lg flex items-center gap-2">
                            Restaurants Near You
                            {status === "success" && (
                                <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-[#ff8a1f]">
                                    {restaurants.length} within {nearbyData?.radiusKm || 5} km
                                </span>
                            )}
                        </h2>
                        <p className="text-[11px] font-medium text-[color:var(--app-muted)]">
                            Distance-verified kitchens with real-time delivery availability
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {status === "idle" || status === "denied" || status === "unavailable" ? (
                        <button
                            type="button"
                            onClick={requestLocation}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-[#ff8a1f] transition hover:bg-orange-500/20 active:scale-95"
                        >
                            <MapPin size={13} />
                            <span>Use Current Location</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={requestLocation}
                            disabled={status === "loading"}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-black/5 dark:bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-black/10 active:scale-95 disabled:opacity-50"
                            title="Refresh nearby restaurants"
                        >
                            <RefreshCw size={13} className={status === "loading" ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    )}
                </div>
            </div>

            {/* State Handlers */}
            {status === "loading" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((n) => (
                        <div
                            key={n}
                            className="animate-pulse rounded-2xl border border-[var(--app-border)] bg-black/5 p-3.5 space-y-3"
                        >
                            <div className="h-28 w-full rounded-xl bg-black/10 dark:bg-white/10" />
                            <div className="h-4 w-3/4 rounded bg-black/10 dark:bg-white/10" />
                            <div className="h-3 w-1/2 rounded bg-black/10 dark:bg-white/10" />
                        </div>
                    ))}
                </div>
            )}

            {status === "idle" && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-transparent p-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-[#ff8a1f]">
                            <MapPin size={20} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-[color:var(--app-text)]">
                                Enable location to see restaurants near you
                            </h3>
                            <p className="text-xs text-[color:var(--app-muted)]">
                                Allow GPS access to discover local kitchens and check delivery availability in your area.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={requestLocation}
                        className="w-full sm:w-auto shrink-0 rounded-xl bg-gradient-to-r from-[#ff8a1f] to-[#ea580c] px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition hover:brightness-105 active:scale-95"
                    >
                        Share Location
                    </button>
                </div>
            )}

            {status === "denied" && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <AlertCircle size={18} className="shrink-0 text-amber-500 mt-0.5" />
                        <div>
                            <p className="font-bold text-[color:var(--app-text)]">
                                Location permission denied
                            </p>
                            <p className="text-[color:var(--app-muted)] mt-0.5">
                                Enable location in your browser settings or select a saved delivery address to discover nearby restaurants.
                            </p>
                        </div>
                    </div>
                    {onOpenAddressModal && (
                        <button
                            type="button"
                            onClick={onOpenAddressModal}
                            className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition active:scale-95"
                        >
                            Select Saved Address
                        </button>
                    )}
                </div>
            )}

            {status === "unavailable" && (
                <div className="rounded-2xl border border-[var(--app-border)] bg-black/5 p-4 text-xs text-[color:var(--app-muted)] flex items-center justify-between gap-2">
                    <p>{errorMessage || "Location unavailable. Please select an address or try again."}</p>
                    {onOpenAddressModal && (
                        <button
                            type="button"
                            onClick={onOpenAddressModal}
                            className="font-bold text-[#ff8a1f] underline hover:no-underline"
                        >
                            Select Address
                        </button>
                    )}
                </div>
            )}

            {status === "success" && restaurants.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--app-border)] p-6 text-center space-y-2">
                    <Store size={28} className="mx-auto text-[color:var(--app-muted)]" />
                    <h3 className="text-sm font-bold text-[color:var(--app-text)]">
                        No restaurants found within {nearbyData?.radiusKm || 5} km
                    </h3>
                    <p className="text-xs text-[color:var(--app-muted)] max-w-md mx-auto">
                        We couldn't find any active kitchens in this immediate radius. Try selecting a different delivery address.
                    </p>
                    {onOpenAddressModal && (
                        <button
                            type="button"
                            onClick={onOpenAddressModal}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 text-xs font-bold text-[#ff8a1f] hover:bg-orange-500/20"
                        >
                            <MapPin size={13} />
                            Change Address
                        </button>
                    )}
                </div>
            )}

            {status === "success" && restaurants.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {restaurants.map((restaurant) => {
                        const restaurantUrl = buildRestaurantMenuPath(restaurant.slug || "");
                        const image = resolveImageUrl(restaurant.bannerUrl || restaurant.logoUrl, FALLBACK_RESTAURANT_IMAGE);

                        return (
                            <Link
                                key={restaurant.id}
                                to={restaurantUrl}
                                onClick={() => onSelectRestaurant?.(restaurant)}
                                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[color:var(--app-surface)] shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-orange-500/30"
                            >
                                {/* Thumbnail Header */}
                                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/10">
                                    <img
                                        src={image}
                                        alt={restaurant.name}
                                        loading="lazy"
                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                                    {/* Distance Badge */}
                                    <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                                        <MapPin size={11} className="text-[#ff8a1f]" />
                                        <span>{restaurant.distanceKm} km</span>
                                    </div>

                                    {/* Open/Closed Badge */}
                                    <div className="absolute top-2.5 right-2.5">
                                        {restaurant.isOpen ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                Open
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-700/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-zinc-200 shadow-xs">
                                                Closed
                                            </span>
                                        )}
                                    </div>

                                    {/* ETA Bottom Overlay */}
                                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white">
                                        <div className="flex items-center gap-1 text-xs font-semibold drop-shadow-sm">
                                            <Clock size={12} className="text-orange-400" />
                                            <span>{restaurant.estimatedDeliveryMinutes} min</span>
                                        </div>

                                        {restaurant.city && (
                                            <span className="text-[11px] font-medium opacity-90 drop-shadow-sm">
                                                {restaurant.city}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Body Information */}
                                <div className="flex flex-1 flex-col justify-between p-3.5 space-y-2.5">
                                    <div>
                                        <h3 className="text-sm font-bold leading-tight text-[color:var(--app-text)] group-hover:text-[#ff8a1f] transition-colors truncate">
                                            {restaurant.name}
                                        </h3>
                                        {restaurant.addressLine1 ? (
                                            <p className="mt-0.5 truncate text-[11px] text-[color:var(--app-muted)]">
                                                {restaurant.addressLine1}
                                            </p>
                                        ) : null}
                                    </div>

                                    {/* Delivery Availability Status Badge */}
                                    <div className="pt-1 border-t border-[var(--app-border)]/50 flex items-center justify-between text-xs">
                                        {restaurant.canDeliver ? (
                                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                                <Truck size={13} />
                                                Delivery available
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400 text-[11px]" title={`Delivery radius: ${restaurant.deliveryRadiusKm} km`}>
                                                <AlertCircle size={13} />
                                                Outside delivery area
                                            </span>
                                        )}

                                        <span className="text-[11px] font-bold text-[#ff8a1f] group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                                            Menu <ChevronRight size={13} />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
