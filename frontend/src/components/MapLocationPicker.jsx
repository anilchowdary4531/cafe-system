import { useEffect, useRef, useState } from "react";
import { LocateFixed, MessageCircle, Loader2 } from "lucide-react";
import { MAP_CONFIG } from "../utils/mapConfig";
import { loadGoogleMaps, getGoogleMapsApiKey } from "../utils/googleMapsLoader";
import { showToast } from "../utils/toast";

/**
 * MapLocationPicker - Interactive Google Maps Location Selector Component
 * Used in Owner Settings and SuperAdmin Create Restaurant pages.
 * 
 * Explicit Coordinate Convention:
 * Human / DB / Google Maps: { lat: latitude, lng: longitude }
 */
export default function MapLocationPicker({
    latitude,
    longitude,
    onSelectLocation,
    ownerPhone = "",
    ownerName = "",
    height = "260px",
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const [mapError, setMapError] = useState(null);
    const [locating, setLocating] = useState(false);

    const hasValidCoords =
        Number.isFinite(Number(latitude)) &&
        Number.isFinite(Number(longitude)) &&
        Number(latitude) >= -90 &&
        Number(latitude) <= 90 &&
        Number(longitude) >= -180 &&
        Number(longitude) <= 180;

    const centerLng = hasValidCoords ? Number(longitude) : MAP_CONFIG.defaultCenter.lng;
    const centerLat = hasValidCoords ? Number(latitude) : MAP_CONFIG.defaultCenter.lat;

    useEffect(() => {
        let isSubscribed = true;

        if (!getGoogleMapsApiKey()) {
            setMapError("Google Maps API key is not configured.");
            return;
        }

        setMapError(null);

        loadGoogleMaps(["places", "marker"])
            .then((google) => {
                if (!isSubscribed || !mapContainerRef.current) return;

                console.log("[MapLocationPicker] Initializing Google Maps location picker...");

                const mapPos = { lat: centerLat, lng: centerLng };
                const map = new google.maps.Map(mapContainerRef.current, {
                    center: mapPos,
                    zoom: hasValidCoords ? 14 : 11,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                });

                mapRef.current = map;

                const marker = new google.maps.Marker({
                    position: mapPos,
                    map,
                    draggable: true,
                    title: "Drag to set location",
                });

                markerRef.current = marker;

                // Handle marker dragend event
                marker.addListener("dragend", () => {
                    const pos = marker.getPosition();
                    if (!pos) return;
                    const nextLat = Math.round(pos.lat() * 1000000) / 1000000;
                    const nextLng = Math.round(pos.lng() * 1000000) / 1000000;

                    console.log(`[MapLocationPicker] Marker dragged to: lat=${nextLat}, lng=${nextLng}`);
                    onSelectLocation?.({ lat: nextLat, lng: nextLng });
                });

                // Handle map click event
                map.addListener("click", (e) => {
                    if (!e.latLng) return;
                    const nextLat = Math.round(e.latLng.lat() * 1000000) / 1000000;
                    const nextLng = Math.round(e.latLng.lng() * 1000000) / 1000000;

                    console.log(`[MapLocationPicker] Map clicked at: lat=${nextLat}, lng=${nextLng}`);
                    marker.setPosition({ lat: nextLat, lng: nextLng });
                    onSelectLocation?.({ lat: nextLat, lng: nextLng });
                });
            })
            .catch((err) => {
                if (!isSubscribed) return;
                console.warn("[MapLocationPicker] Google Maps loading error:", err?.message || err);
                setMapError(err?.message || "Failed to load map.");
            });

        return () => {
            isSubscribed = false;
            if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
            mapRef.current = null;
        };
    }, []);

    // Update marker position if props change externally
    useEffect(() => {
        if (!mapRef.current || !markerRef.current || !window.google) return;
        if (hasValidCoords) {
            const nextLat = Number(latitude);
            const nextLng = Number(longitude);
            const pos = { lat: nextLat, lng: nextLng };
            markerRef.current.setPosition(pos);
            mapRef.current.panTo(pos);
        }
    }, [latitude, longitude]);

    // Handle detecting current GPS location
    const handleDetectCurrentLocation = () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", { type: "error" });
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = Math.round(position.coords.latitude * 1000000) / 1000000;
                const lng = Math.round(position.coords.longitude * 1000000) / 1000000;
                const pos = { lat, lng };

                if (mapRef.current && markerRef.current) {
                    markerRef.current.setPosition(pos);
                    mapRef.current.panTo(pos);
                    mapRef.current.setZoom(15);
                }

                let city = "";
                let state = "";
                let pincode = "";

                if (window.google?.maps?.Geocoder) {
                    try {
                        const geocoder = new window.google.maps.Geocoder();
                        const res = await geocoder.geocode({ location: pos });
                        if (res?.results?.[0]) {
                            for (const comp of res.results[0].address_components) {
                                if (comp.types.includes("locality") || comp.types.includes("administrative_area_level_3")) {
                                    city = comp.long_name;
                                }
                                if (comp.types.includes("administrative_area_level_1")) {
                                    state = comp.long_name;
                                }
                                if (comp.types.includes("postal_code")) {
                                    pincode = comp.long_name;
                                }
                            }
                        }
                    } catch {
                        // Ignore geocode error
                    }
                }

                onSelectLocation?.({ lat, lng, city, state, pincode });
                showToast("Current GPS location detected & set!", { type: "success" });
                setLocating(false);
            },
            (err) => {
                console.warn("[MapLocationPicker] Geolocation error:", err);
                showToast("Location permission denied or unavailable. Please click map manually.", { type: "error" });
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Handle asking location via WhatsApp
    const handleAskWhatsApp = () => {
        let cleanPhone = "";
        if (ownerPhone) {
            const digits = String(ownerPhone).replace(/\D/g, "");
            if (digits.length === 10) cleanPhone = `91${digits}`;
            else if (digits.length > 10) cleanPhone = digits;
        }

        const nameText = ownerName ? ` for ${ownerName}` : "";
        const msg = `Hello! Please share your restaurant outlet's Google Maps location pin or address link with Tiffzy Admin so we can complete your outlet setup${nameText}. Thank you!`;
        const waUrl = cleanPhone
            ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

        window.open(waUrl, "_blank");
        showToast("Opened WhatsApp to request location pin!", { type: "info" });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Location Coordinates
                </span>

                <div className="flex flex-wrap items-center gap-2">
                    {hasValidCoords ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                            <span>📍</span>
                            <span>
                                {Number(latitude).toFixed(4)}° N, {Number(longitude).toFixed(4)}° E
                            </span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
                            Location not set
                        </span>
                    )}

                    {/* Current Location Button */}
                    <button
                        type="button"
                        onClick={handleDetectCurrentLocation}
                        disabled={locating}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-extrabold text-amber-500 dark:text-amber-400 hover:bg-amber-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                        title="Detect & set current GPS location"
                    >
                        {locating ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
                        <span>{locating ? "Locating..." : "Use Current Location"}</span>
                    </button>

                    {/* Ask via WhatsApp Button */}
                    <button
                        type="button"
                        onClick={handleAskWhatsApp}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-3 py-1 text-xs font-extrabold text-emerald-500 dark:text-emerald-400 hover:bg-emerald-600/30 transition active:scale-95 cursor-pointer shadow-sm"
                        title="Send WhatsApp message asking for location pin"
                    >
                        <MessageCircle size={13} className="text-emerald-500 dark:text-emerald-400" />
                        <span>Ask via WhatsApp</span>
                    </button>
                </div>
            </div>

            {/* Map Canvas */}
            <div
                ref={mapContainerRef}
                style={{ height }}
                className="relative overflow-hidden rounded-2xl border border-white/10 shadow-inner bg-gray-900 flex items-center justify-center"
            >
                {mapError && (
                    <div className="p-4 text-center text-xs text-amber-400">
                        <p className="font-semibold">{mapError}</p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
                <p>Click map or drag pin to select restaurant outlet location.</p>
                {hasValidCoords && (
                    <button
                        type="button"
                        onClick={() => onSelectLocation?.({ lat: null, lng: null })}
                        className="text-red-400 underline hover:text-red-300 cursor-pointer"
                    >
                        Clear Location
                    </button>
                )}
            </div>
        </div>
    );
}

