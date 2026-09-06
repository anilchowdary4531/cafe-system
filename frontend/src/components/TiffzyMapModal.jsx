import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation, MapPin, X, ExternalLink, Utensils, AlertTriangle } from "lucide-react";
import { MAP_CONFIG } from "../utils/mapConfig";
import { loadGoogleMaps, getGoogleMapsApiKey } from "../utils/googleMapsLoader";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";

const toRad = (deg) => (Number(deg) * Math.PI) / 180;

/**
 * Haversine formula for distance in kilometers
 */
const calculateHaversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Validate coordinates strictly (-90..90 for lat, -180..180 for lng).
 * Explicit Coordinate Convention:
 * Human / DB / Google Maps: { lat: latitude, lng: longitude }
 * 
 * IMPORTANT: NEVER auto-swap coordinates.
 * Valid-but-swapped coordinates such as (lat: 78.4867, lng: 17.3850)
 * are both within mathematical bounds. SILENT AUTO-SWAPPING IS FORBIDDEN.
 */
export const parseAndValidateCoords = (rawLat, rawLng) => {
    if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) {
        return null;
    }

    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    // Strict numerical bounds check
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn(`[TiffzyMap] Invalid coordinate bounds (lat: ${lat}, lng: ${lng}). Skipping...`);
        return null;
    }

    // Log warning for geographically suspicious values
    if (Math.abs(lat) > 70) {
        console.warn(
            `[TiffzyMap] WARNING: Geographically suspicious coordinate detected (lat: ${lat}, lng: ${lng}). Proceeding without auto-correction.`
        );
    }

    return { lat, lng };
};

export default function TiffzyMapModal({ isOpen, onClose, restaurants = [] }) {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const userMarkerRef = useRef(null);
    const markersRef = useRef([]);
    const infoWindowRef = useRef(null);

    const [userLocation, setUserLocation] = useState(null);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);
    const [mapLoadingError, setMapLoadingError] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

    // Filter valid restaurants
    const validRestaurants = (restaurants || [])
        .map((r) => {
            const coords = parseAndValidateCoords(r?.latitude, r?.longitude);
            if (!coords) return null;
            return {
                ...r,
                lat: coords.lat,
                lng: coords.lng,
            };
        })
        .filter(Boolean);

    // Calculate distance if user location is available
    const getRestaurantDistance = useCallback(
        (rLat, rLng, name) => {
            if (!userLocation) return null;

            const dist = calculateHaversineKm(userLocation.lat, userLocation.lng, rLat, rLng);
            const roundedDist = Math.round(dist * 10) / 10;

            console.log(`=== TIFFZY DISTANCE DEBUG [${name || "Restaurant"}] ===`);
            console.log("User latitude:", userLocation.lat);
            console.log("User longitude:", userLocation.lng);
            console.log("Restaurant latitude:", rLat);
            console.log("Restaurant longitude:", rLng);
            console.log("Calculated distance (km):", roundedDist);

            return roundedDist;
        },
        [userLocation]
    );

    // Initialize Google Maps JavaScript API
    useEffect(() => {
        if (!isOpen) return;

        let isSubscribed = true;

        if (!getGoogleMapsApiKey()) {
            setMapLoadingError("Google Maps API key is not configured.");
            return;
        }

        setMapLoadingError(null);

        loadGoogleMaps(["places", "marker"])
            .then((google) => {
                if (!isSubscribed || !mapContainerRef.current) return;

                console.log("[TiffzyMap] Initializing Google Maps JS API...");

                const mapOptions = {
                    center: { lat: MAP_CONFIG.defaultCenter.lat, lng: MAP_CONFIG.defaultCenter.lng },
                    zoom: MAP_CONFIG.defaultCenter.zoom,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                };

                const map = new google.maps.Map(mapContainerRef.current, mapOptions);
                mapRef.current = map;

                const infoWindow = new google.maps.InfoWindow();
                infoWindowRef.current = infoWindow;

                // Trigger map resize event for modal visibility
                google.maps.event.trigger(map, "resize");

                // Clear previous markers
                markersRef.current.forEach((m) => m.setMap(null));
                markersRef.current = [];

                let markerCount = 0;

                // 1. Add Test Restaurant Marker
                if (MAP_CONFIG.testMarker && MAP_CONFIG.testMarker.enabled) {
                    const testMarkerPos = { lat: MAP_CONFIG.testMarker.lat, lng: MAP_CONFIG.testMarker.lng };
                    const testMarker = new google.maps.Marker({
                        position: testMarkerPos,
                        map,
                        title: MAP_CONFIG.testMarker.name,
                        icon: {
                            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                            scale: 6,
                            fillColor: "#fe5102",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#ffffff",
                        },
                    });

                    testMarker.addListener("click", () => {
                        setSelectedRestaurant({
                            name: MAP_CONFIG.testMarker.name,
                            lat: MAP_CONFIG.testMarker.lat,
                            lng: MAP_CONFIG.testMarker.lng,
                            addressLine1: MAP_CONFIG.testMarker.description,
                            city: "Bengaluru",
                            slug: "test-restaurant",
                        });
                        infoWindow.setContent(`
                            <div style="padding: 6px; font-family: system-ui, sans-serif;">
                                <h4 style="margin:0; font-weight:800; color:#fe5102;">${MAP_CONFIG.testMarker.name}</h4>
                                <p style="margin:4px 0 0 0; font-size:11px; color:#666;">TEST MARKER (Not in DB)</p>
                                <p style="margin:2px 0 0 0; font-size:10px; color:#888;">Lat: ${MAP_CONFIG.testMarker.lat}, Lng: ${MAP_CONFIG.testMarker.lng}</p>
                            </div>
                        `);
                        infoWindow.open(map, testMarker);
                    });

                    markersRef.current.push(testMarker);
                    markerCount++;
                    console.log("[TiffzyMap] Added Google Maps test marker at Bengaluru (12.9716, 77.5946)");
                }

                // 2. Add Real Restaurant Markers
                validRestaurants.forEach((restaurant) => {
                    const pos = { lat: restaurant.lat, lng: restaurant.lng };
                    const marker = new google.maps.Marker({
                        position: pos,
                        map,
                        title: restaurant.name || "Restaurant",
                    });

                    marker.addListener("click", () => {
                        setSelectedRestaurant(restaurant);
                        infoWindow.setContent(`
                            <div style="padding: 6px; font-family: system-ui, sans-serif;">
                                <h4 style="margin:0; font-weight:800; color:#111827;">${restaurant.name}</h4>
                                <p style="margin:4px 0 0 0; font-size:11px; color:#4b5563;">
                                    ${[restaurant.addressLine1, restaurant.city].filter(Boolean).join(", ") || "Outlet Location"}
                                </p>
                            </div>
                        `);
                        infoWindow.open(map, marker);
                    });

                    markersRef.current.push(marker);
                    markerCount++;
                });

                console.log(`[TiffzyMap] Total Google Maps markers created: ${markerCount}`);
            })
            .catch((err) => {
                if (!isSubscribed) return;
                console.error("[TiffzyMap] Google Maps failed to load:", err);
                setMapLoadingError(err.message || "Failed to load Google Maps.");
            });

        return () => {
            isSubscribed = false;
            console.log("[TiffzyMap] Cleaning up Google Maps instance.");
            markersRef.current.forEach((m) => m.setMap(null));
            markersRef.current = [];
            if (userMarkerRef.current) {
                userMarkerRef.current.setMap(null);
                userMarkerRef.current = null;
            }
            mapRef.current = null;
        };
    }, [isOpen]);

    // Handle "Use my location" button click
    const handleGetUserLocation = () => {
        if (!("geolocation" in navigator)) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }

        setLocating(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = Number(pos.coords.latitude);
                const lng = Number(pos.coords.longitude);
                console.log(`[TiffzyMap] Obtained user location: (${lat}, ${lng})`);

                setUserLocation({ lat, lng });
                setLocating(false);

                if (mapRef.current && window.google) {
                    const userPos = { lat, lng };
                    mapRef.current.panTo(userPos);
                    mapRef.current.setZoom(14);

                    if (userMarkerRef.current) {
                        userMarkerRef.current.setPosition(userPos);
                    } else {
                        userMarkerRef.current = new window.google.maps.Marker({
                            position: userPos,
                            map: mapRef.current,
                            title: "Your Location",
                            icon: {
                                path: window.google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: "#3b82f6",
                                fillOpacity: 1,
                                strokeWeight: 3,
                                strokeColor: "#ffffff",
                            },
                        });
                    }
                }
            },
            (err) => {
                setLocating(false);
                console.warn("[TiffzyMap] Location permission denied or unavailable:", err.message);
                setLocationError("Location permission denied or unavailable. You can still explore all restaurants on the map.");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            }
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4 md:p-6">
            <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[color:var(--app-surface,#111827)] shadow-2xl">
                {/* Header Toolbar */}
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🗺️</span>
                        <div>
                            <h2 className="text-base font-bold text-white sm:text-lg">Tiffzy Outlets Map</h2>
                            <p className="text-xs text-white/60">Google Maps Interactive Outlets</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={handleGetUserLocation}
                            disabled={locating || !!mapLoadingError}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#fe5102] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#e04600] disabled:opacity-50 sm:px-4 sm:text-sm"
                        >
                            <Navigation size={15} className={locating ? "animate-spin" : ""} />
                            {locating ? "Locating..." : "Use my location"}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
                            aria-label="Close Map"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <div className="relative h-[500px] sm:h-[550px] md:h-[600px] w-full flex-1 overflow-hidden">
                    {/* Google Map container */}
                    <div
                        ref={mapContainerRef}
                        style={{ width: "100%", height: "100%" }}
                        className="h-full w-full"
                    />

                    {/* Google Maps Loading Error Fallback */}
                    {mapLoadingError && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-950/90 p-6 text-center text-white backdrop-blur-md">
                            <AlertTriangle size={48} className="mb-3 text-amber-400" />
                            <h3 className="text-lg font-bold text-white">Google Maps Error</h3>
                            <p className="mt-1 text-sm text-gray-300 max-w-md">{mapLoadingError}</p>
                        </div>
                    )}

                    {/* Location Warning Banner */}
                    {locationError && !mapLoadingError && (
                        <div className="absolute top-3 left-3 right-3 z-10 mx-auto max-w-md rounded-xl border border-amber-500/30 bg-amber-950/90 p-3 text-xs text-amber-200 backdrop-blur-md shadow-lg">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                                <span>{locationError}</span>
                                <button onClick={() => setLocationError(null)} className="ml-auto text-amber-400 hover:text-white">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Selected Restaurant Card */}
                    {selectedRestaurant && !mapLoadingError && (
                        <div className="absolute bottom-4 left-4 right-4 z-20 mx-auto max-w-lg rounded-2xl border border-white/15 bg-gray-900/95 p-4 text-white shadow-2xl backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-auto sm:w-[380px]">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-white">{selectedRestaurant.name}</h3>
                                    <p className="mt-0.5 text-xs text-white/70">
                                        {[selectedRestaurant.addressLine1, selectedRestaurant.city, selectedRestaurant.state]
                                            .filter(Boolean)
                                            .join(", ") || "Outlet Location"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedRestaurant(null)}
                                    className="text-white/50 hover:text-white"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Distance Info if user location available */}
                            {userLocation && (
                                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                                    <MapPin size={13} />
                                    <span>
                                        {getRestaurantDistance(selectedRestaurant.lat, selectedRestaurant.lng, selectedRestaurant.name)} km away
                                    </span>
                                </div>
                            )}

                            {/* Action Buttons: View Restaurant & Get Directions */}
                            <div className="mt-4 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        navigate(buildRestaurantMenuPath(selectedRestaurant.slug, ""));
                                    }}
                                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#fe5102] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#e04600]"
                                >
                                    <Utensils size={14} />
                                    View Restaurant
                                </button>

                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.lat},${selectedRestaurant.lng}${userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : ""}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                                >
                                    <ExternalLink size={14} />
                                    Get Directions
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
