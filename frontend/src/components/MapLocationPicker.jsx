import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "../utils/mapConfig";

/**
 * MapLocationPicker - Interactive MapLibre Location Selector Component
 * Used in Owner Settings and SuperAdmin Create Restaurant pages.
 * 
 * Explicit Coordinate Convention:
 * Human / DB: latitude = lat (-90 to +90), longitude = lng (-180 to +180)
 * MapLibre / GeoJSON: [longitude, latitude] -> [lng, lat]
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
        if (!mapContainerRef.current) return;

        console.log("[MapLocationPicker] Initializing map picker...");

        try {
            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style: MAP_CONFIG.styleUrl,
                center: [centerLng, centerLat], // MapLibre takes [lng, lat]
                zoom: hasValidCoords ? 14 : 11,
                attributionControl: true,
            });

            mapRef.current = map;
            map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

            map.on("load", () => {
                // Create draggable marker
                const marker = new maplibregl.Marker({
                    draggable: true,
                    color: "#fe5102",
                })
                    .setLngLat([centerLng, centerLat])
                    .addTo(map);

                markerRef.current = marker;

                // Handle marker drag event
                marker.on("dragend", () => {
                    const lngLat = marker.getLngLat();
                    // Explicitly extract latitude and longitude without swapping
                    const nextLat = Math.round(lngLat.lat * 1000000) / 1000000;
                    const nextLng = Math.round(lngLat.lng * 1000000) / 1000000;

                    console.log(`[MapLocationPicker] Marker dragged to: lat=${nextLat}, lng=${nextLng}`);
                    onSelectLocation?.({ lat: nextLat, lng: nextLng });
                });

                // Handle map click event
                map.on("click", (e) => {
                    const nextLat = Math.round(e.lngLat.lat * 1000000) / 1000000;
                    const nextLng = Math.round(e.lngLat.lng * 1000000) / 1000000;

                    console.log(`[MapLocationPicker] Map clicked at: lat=${nextLat}, lng=${nextLng}`);
                    marker.setLngLat([nextLng, nextLat]);
                    onSelectLocation?.({ lat: nextLat, lng: nextLng });
                });
            });
        } catch (err) {
            console.warn("[MapLocationPicker] WebGL initialization warning:", err?.message || err);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
            }
        };
    }, []);

    // Update marker position if props change externally
    useEffect(() => {
        if (!mapRef.current || !markerRef.current) return;
        if (hasValidCoords) {
            const nextLat = Number(latitude);
            const nextLng = Number(longitude);
            markerRef.current.setLngLat([nextLng, nextLat]);
            mapRef.current.flyTo({ center: [nextLng, nextLat], zoom: 14 });
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
                className="relative overflow-hidden rounded-2xl border border-white/10 shadow-inner"
            />

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
