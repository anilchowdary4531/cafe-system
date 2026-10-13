import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "../utils/mapConfig";

/**
 * MapLocationPicker - Interactive MapLibre Location Selector Component
 * Used in Customer Address Modal, Owner Settings, and SuperAdmin Create Restaurant pages.
 * 
 * Explicit Coordinate Convention:
 * Human / DB: latitude = lat (-90 to +90), longitude = lng (-180 to +180)
 * MapLibre / GeoJSON: [longitude, latitude] -> [lng, lat]
 */
export default function MapLocationPicker({
    latitude,
    longitude,
    onSelectLocation,
    height = "320px",
    hideControls = false,
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

        let map = null;
        let resizeObserver = null;

        try {
            map = new maplibregl.Map({
                container: mapContainerRef.current,
                style: MAP_CONFIG.styleUrl,
                center: [centerLng, centerLat],
                zoom: hasValidCoords ? 14 : 12,
                attributionControl: true,
            });

            mapRef.current = map;

            if (!hideControls) {
                map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
            }

            map.on("load", () => {
                map.resize();

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
                    const nextLat = Math.round(lngLat.lat * 1000000) / 1000000;
                    const nextLng = Math.round(lngLat.lng * 1000000) / 1000000;

                    onSelectLocation?.({ lat: nextLat, lng: nextLng });
                });

                // Handle map click event
                map.on("click", (e) => {
                    const nextLat = Math.round(e.lngLat.lat * 1000000) / 1000000;
                    const nextLng = Math.round(e.lngLat.lng * 1000000) / 1000000;

                    marker.setLngLat([nextLng, nextLat]);
                    onSelectLocation?.({ lat: nextLat, lng: nextLng });
                });
            });

            // Ensure canvas fits container accurately
            requestAnimationFrame(() => {
                map?.resize();
            });
            const tId = setTimeout(() => {
                map?.resize();
            }, 100);

            if (window.ResizeObserver && mapContainerRef.current) {
                resizeObserver = new ResizeObserver(() => {
                    map?.resize();
                });
                resizeObserver.observe(mapContainerRef.current);
            }

            return () => {
                clearTimeout(tId);
            };
        } catch (err) {
            console.warn("[MapLocationPicker] MapLibre initialization warning:", err?.message || err);
        }

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
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
    }, [latitude, longitude, hasValidCoords]);

    return (
        <div className="space-y-2">
            <div
                ref={mapContainerRef}
                style={{ height, width: "100%", minHeight: "220px" }}
                className="relative overflow-hidden rounded-2xl border border-white/10 shadow-inner bg-stone-900"
            />

            <div className="flex items-center justify-between text-xs text-stone-400">
                <p>Click map or drag pin to select location.</p>
                {hasValidCoords && (
                    <span className="font-mono text-[11px] text-[#fe5102]">
                        {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
                    </span>
                )}
            </div>
        </div>
    );
}
