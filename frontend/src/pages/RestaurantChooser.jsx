import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, Store } from "lucide-react";
import { useRestaurantContext } from "../context/RestaurantContext";
import { cachedGet } from "../utils/apiClient";
import { getCustomerSettings } from "../utils/customerSettings";
import { resolveImageUrl } from "../utils/resolveImageUrl";

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
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();

    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedSlug, setSelectedSlug] = useState(String(restaurantContext?.slug || ""));
    const [locationHint, setLocationHint] = useState("");
    const [detecting, setDetecting] = useState(false);

    const selectedRestaurant = useMemo(() => {
        return restaurants.find((r) => String(r.slug) === String(selectedSlug)) || null;
    }, [restaurants, selectedSlug]);

    useEffect(() => {
        let alive = true;

        const loadRestaurants = async () => {
            try {
                setLoading(true);
                setError("");
                const data = await cachedGet("/restaurants", { ttlMs: 10 * 60_000, staleMs: 60 * 60_000 });
                if (!alive) return;
                const list = normalizeRestaurantList(data);
                if (!list) {
                    throw new Error("Failed to load restaurants");
                }
                setRestaurants(list);
                // If nothing is selected yet (fresh visit), default to the first restaurant
                // while we attempt geo-based auto selection.
                if (!restaurantContext?.slug && !selectedSlug && list.length) {
                    setSelectedSlug(String(list[0].slug || ""));
                }
            } catch (err) {
                if (!alive) return;
                setError(err.response?.data?.message || "Failed to load restaurants");
            } finally {
                if (alive) setLoading(false);
            }
        };

        loadRestaurants();
        return () => {
            alive = false;
        };
    }, []);

    const detectNearest = async ({ userTriggered = false } = {}) => {
        if (!restaurants.length) return;

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

            const nearest = pickNearestRestaurant(restaurants, lat, lon);
            if (!nearest?.restaurant) {
                setLocationHint("Restaurant coordinates not configured. Please select a restaurant.");
                return;
            }

            setSelectedSlug(nearest.restaurant.slug);
            const roundedKm = Math.max(0, Math.round(nearest.distanceKm * 10) / 10);
            setLocationHint(`Selected ${nearest.restaurant.name} (${roundedKm} km away) based on your current location.`);
        } catch (err) {
            // Permission denied or timeout.
            setLocationHint("Location permission denied or unavailable. Please select a restaurant.");
        } finally {
            setDetecting(false);
        }
    };

    useEffect(() => {
        // Auto-select the nearest restaurant when the user lands directly on the site.
        if (!restaurants.length) return;
        if (restaurantContext?.slug) return;
        const settings = getCustomerSettings();
        if (settings.autoDetectNearestRestaurant === false) return;
        detectNearest({ userTriggered: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurants.length]);

    const handleContinue = () => {
        if (!selectedRestaurant) {
            setError("Please select a restaurant to continue.");
            return;
        }

        setRestaurantContext({
            id: selectedRestaurant.id || null,
            name: selectedRestaurant.name || null,
            slug: selectedRestaurant.slug || null,
            logo: selectedRestaurant.logo || selectedRestaurant.logoUrl || null,
            tableNo: null,
        });

        navigate(`/r/${selectedRestaurant.slug}`, { replace: true });
    };

    return (
        <div className="theme-page min-h-screen px-4 py-12 md:px-8">
            <div className="mx-auto max-w-4xl">
                <section className="theme-panel rounded-[32px] p-7 backdrop-blur md:p-10">
                    <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="theme-card flex h-14 w-14 items-center justify-center rounded-2xl">
                                <Store size={26} />
                            </div>
                            <div>
                                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.28em]">Start Ordering</p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Choose your restaurant</h1>
                                <p className="theme-muted mt-2 max-w-xl text-sm">
                                    We can preselect the closest restaurant using your device location, or you can pick manually.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => detectNearest({ userTriggered: true })}
                            disabled={detecting || loading || restaurants.length === 0}
                            className="theme-soft-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <Navigation size={16} />
                            {detecting ? "Detecting..." : "Use my location"}
                        </button>
                    </header>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        <div className="theme-card rounded-[28px] p-5">
                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">Restaurant</p>

                            <label className="theme-dropdown mt-4 w-full">
                                <span className="theme-dropdown-label">
                                    <MapPin size={15} />
                                    <span>Select</span>
                                </span>
                                <select
                                    value={selectedSlug}
                                    onChange={(event) => setSelectedSlug(event.target.value)}
                                    aria-label="Select restaurant"
                                >
                                    <option value="" disabled>
                                        Select a restaurant...
                                    </option>
                                    {restaurants.map((restaurant) => (
                                        <option key={restaurant.id} value={restaurant.slug}>
                                            {restaurant.name}
                                        </option>
                                    ))}
                                </select>
                                <span className="theme-dropdown-swatch" aria-hidden="true" />
                            </label>

                            {locationHint && <p className="theme-muted mt-4 text-sm">{locationHint}</p>}
                            {error && (
                                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                    {error}
                                </div>
                            )}

                            {loading && <p className="theme-muted mt-4 text-sm">Loading restaurants...</p>}
                        </div>

                        <div className="theme-card rounded-[28px] p-5">
                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">Selected</p>

                            <div className="mt-4">
                                {Boolean(selectedRestaurant?.logo || selectedRestaurant?.logoUrl) && (
                                    <img
                                        src={resolveImageUrl(selectedRestaurant.logo || selectedRestaurant.logoUrl)}
                                        alt={selectedRestaurant?.name || "Restaurant logo"}
                                        className="h-14 w-14 rounded-2xl object-cover"
                                    />
                                )}
                                <h2 className="text-2xl font-semibold">{selectedRestaurant?.name || "No restaurant selected"}</h2>
                                <p className="theme-muted mt-2 text-sm">
                                    {(selectedRestaurant?.city || selectedRestaurant?.state)
                                        ? `${selectedRestaurant?.city || ""}${selectedRestaurant?.city && selectedRestaurant?.state ? ", " : ""}${selectedRestaurant?.state || ""}`
                                        : "Select a restaurant to continue to the menu."}
                                </p>
                            </div>

                            <button
                                onClick={handleContinue}
                                disabled={!selectedRestaurant}
                                className="theme-button mt-6 w-full rounded-2xl py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                Continue to Menu
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
