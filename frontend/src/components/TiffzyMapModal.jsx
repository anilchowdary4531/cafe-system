import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Navigation, MapPin, X, ExternalLink, Utensils, AlertTriangle } from "lucide-react";
import { MAP_CONFIG } from "../utils/mapConfig";
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
 * Human / DB: latitude = lat, longitude = lng
 * MapLibre / GeoJSON: [longitude, latitude]
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

    // Log warning for geographically suspicious values (e.g. historical swapped coords like lat=78.4867, lng=17.3850)
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

    const [userLocation, setUserLocation] = useState(null);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

    // Filter valid restaurants
    const validRestaurants = (restaurants || []).map((r) => {
        const coords = parseAndValidateCoords(r?.latitude, r?.longitude);
        if (!coords) return null;
        return {
            ...r,
            lat: coords.lat,
            lng: coords.lng,
        };
    }).filter(Boolean);

    // Calculate distance if user location is available
    const getRestaurantDistance = useCallback(
        (rLat, rLng, name) => {
            if (!userLocation) return null;

            const dist = calculateHaversineKm(userLocation.lat, userLocation.lng, rLat, rLng);
            const roundedDist = Math.round(dist * 10) / 10;

            // Step 8 console debug logging
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

    // Initialize MapLibre GL JS Map
    useEffect(() => {
        if (!isOpen) return;

        let timerId = null;

        const initMap = () => {
            if (!mapContainerRef.current) return;

            const mapContainer = mapContainerRef.current;

            console.log("MapLibre version: 6.7.0");
            console.log("Map style URL:", MAP_CONFIG.styleUrl);
            console.log("Map container dimensions:", {
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight,
                clientWidth: mapContainer.clientWidth,
                clientHeight: mapContainer.clientHeight,
            });

            try {
                const map = new maplibregl.Map({
                    container: mapContainer,
                    style: MAP_CONFIG.styleUrl,
                    center: [MAP_CONFIG.defaultCenter.lng, MAP_CONFIG.defaultCenter.lat], // [77.5946, 12.9716]
                    zoom: MAP_CONFIG.defaultCenter.zoom,
                    attributionControl: true,
                });

                mapRef.current = map;

                map.on("error", (e) => {
                    console.error("MAPLIBRE ERROR:", e);
                });

                map.on("styledata", () => {
                    console.log("MAP STYLE LOADED");
                    console.log("Sources:", map.getStyle()?.sources);
                    console.log("Layers:", map.getStyle()?.layers);
                });

                map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

                map.on("load", () => {
                    console.log("MAP LOAD SUCCESS");

                    const canvas = mapContainer.querySelector(".maplibregl-canvas");
                    console.log("Canvas:", canvas);
                    console.log("WebGL:", !!canvas?.getContext("webgl2") || !!canvas?.getContext("webgl"));

                    requestAnimationFrame(() => {
                        map.resize();
                    });

                    setTimeout(() => {
                        map.resize();
                    }, 100);

                    let markerCount = 0;

                    // 1. Add Step 4 Temporary Test Marker
                    if (MAP_CONFIG.testMarker && MAP_CONFIG.testMarker.enabled) {
                        const testMarkerEl = document.createElement("div");
                        testMarkerEl.className = "tiffzy-test-marker";
                        testMarkerEl.innerHTML = `
                            <div style="background: #fe5102; color: white; padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 12px rgba(254,81,2,0.4); display: flex; align-items: center; gap: 4px; border: 2px solid white; cursor: pointer;">
                                <span>📍</span>
                                <span>${MAP_CONFIG.testMarker.name}</span>
                            </div>
                        `;

                        const testPopup = new maplibregl.Popup({ offset: 25 }).setHTML(`
                            <div style="padding: 8px; font-family: system-ui, sans-serif;">
                                <h4 style="margin:0; font-weight: 800; color: #fe5102;">${MAP_CONFIG.testMarker.name}</h4>
                                <p style="margin:4px 0 0 0; font-size: 11px; color: #666;">TEST MARKER (Not saved in DB)</p>
                                <p style="margin:2px 0 0 0; font-size: 10px; color: #888;">Lat: ${MAP_CONFIG.testMarker.lat}, Lng: ${MAP_CONFIG.testMarker.lng}</p>
                            </div>
                        `);

                        new maplibregl.Marker({ element: testMarkerEl })
                            .setLngLat([MAP_CONFIG.testMarker.lng, MAP_CONFIG.testMarker.lat])
                            .setPopup(testPopup)
                            .addTo(map);

                        markerCount++;
                        console.log("[TiffzyMap] Added in-memory test restaurant marker at Bengaluru (12.9716, 77.5946)");
                    }

                    // 2. Add Real Restaurant Markers
                    validRestaurants.forEach((restaurant) => {
                        const el = document.createElement("div");
                        el.className = "tiffzy-restaurant-marker";
                        el.innerHTML = `
                            <div style="background: #111827; color: #fe5102; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2px solid #fe5102; cursor: pointer; transition: transform 0.2s;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                            </div>
                        `;

                        el.addEventListener("click", () => {
                            setSelectedRestaurant(restaurant);
                        });

                        new maplibregl.Marker({ element: el })
                            .setLngLat([restaurant.lng, restaurant.lat])
                            .addTo(map);

                        markerCount++;
                    });

                    console.log(`[TiffzyMap] Marker count: ${markerCount}`);
                });
            } catch (err) {
                console.error("[TiffzyMap] Map initialization error:", err);
            }
        };

        timerId = setTimeout(initMap, 50);

        return () => {
            if (timerId) clearTimeout(timerId);
            console.log("[TiffzyMap] Cleaning up MapLibre map instance.");
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
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

                if (mapRef.current) {
                    mapRef.current.flyTo({
                        center: [lng, lat],
                        zoom: 14,
                        duration: 1500,
                    });

                    // Update or create user location marker
                    if (userMarkerRef.current) {
                        userMarkerRef.current.setLngLat([lng, lat]);
                    } else {
                        const userEl = document.createElement("div");
                        userEl.innerHTML = `
                            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                                <div style="width: 20px; height: 20px; background-color: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59,130,246,0.8); z-index: 2;"></div>
                                <div style="position: absolute; width: 40px; height: 40px; background-color: rgba(59,130,246,0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                            </div>
                        `;
                        userMarkerRef.current = new maplibregl.Marker({ element: userEl })
                            .setLngLat([lng, lat])
                            .addTo(mapRef.current);
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
                            <p className="text-xs text-white/60">OpenStreetMap Interactive Locations</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={handleGetUserLocation}
                            disabled={locating}
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
                <div className="relative flex-1 min-h-[450px] w-full">
                    {/* Maplibre container */}
                    <div
                        ref={mapContainerRef}
                        style={{ width: "100%", height: "100%", minHeight: "450px" }}
                        className="absolute inset-0 h-full w-full overflow-hidden"
                    />

                    {/* Non-blocking Location Warning Banner */}
                    {locationError && (
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

                    {/* Selected Restaurant Popup / Bottom Card */}
                    {selectedRestaurant && (
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
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.lat},${selectedRestaurant.lng}`}
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
