import { useEffect, useRef, useState } from "react";
import { MAP_CONFIG } from "../utils/mapConfig";
import { loadGoogleMaps, getGoogleMapsApiKey } from "../utils/googleMapsLoader";

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
    height = "260px",
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const [mapError, setMapError] = useState(null);

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

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Location Coordinates
                </span>
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
                        className="text-red-400 underline hover:text-red-300"
                    >
                        Clear Location
                    </button>
                )}
            </div>
        </div>
    );
}
