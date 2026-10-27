import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
    Menu,
    Search,
    MapPin,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Maximize2,
    RefreshCw,
    ExternalLink,
    Store,
    X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/apiClient";
import { MAP_CONFIG } from "../../utils/mapConfig";
import SuperAdminSidebar from "../../components/super-admin/SuperAdminSidebar";

/**
 * Creates a GeoJSON Polygon circle of radiusKm around [centerLat, centerLng]
 */
function createGeoJSONCircle(centerLat, centerLng, radiusKm, points = 64) {
    const coords = [];
    const kmPerLat = 111.045;
    const kmPerLng = 111.045 * Math.cos((centerLat * Math.PI) / 180);

    for (let i = 0; i <= points; i++) {
        const angle = (i * 2 * Math.PI) / points;
        const dLat = (radiusKm * Math.sin(angle)) / kmPerLat;
        const dLng = (radiusKm * Math.cos(angle)) / kmPerLng;
        coords.push([centerLng + dLng, centerLat + dLat]);
    }

    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [coords],
        },
        properties: {},
    };
}

export default function SuperAdminRestaurantMap() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    // Data State
    const [restaurants, setRestaurants] = useState([]);
    const [summary, setSummary] = useState({
        totalRestaurants: 0,
        locatedRestaurants: 0,
        missingLocationRestaurants: 0,
        activeRestaurants: 0,
        inactiveRestaurants: 0,
    });
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState("");
    const [mapError, setMapError] = useState(null);

    // UI & Filter State
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'located' | 'missing' | 'active' | 'inactive'
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

    // Map Refs
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef(new Map());
    const activePopupRef = useRef(null);
    const resizeObserverRef = useRef(null);

    // Fetch Restaurant Map Data from backend
    const loadMapData = useCallback(async () => {
        try {
            setLoading(true);
            setApiError("");
            const res = await api.get("/super-admin/restaurants/map");
            const data = res?.data?.data || res?.data || res;
            if (data?.restaurants) {
                setRestaurants(data.restaurants);
                setSummary({
                    totalRestaurants: data.totalRestaurants ?? data.restaurants.length,
                    locatedRestaurants: data.locatedRestaurants ?? data.restaurants.filter((r) => r.hasValidLocation).length,
                    missingLocationRestaurants: data.missingLocationRestaurants ?? data.restaurants.filter((r) => !r.hasValidLocation).length,
                    activeRestaurants: data.activeRestaurants ?? data.restaurants.filter((r) => r.isActive).length,
                    inactiveRestaurants: data.inactiveRestaurants ?? data.restaurants.filter((r) => !r.isActive).length,
                });
            } else if (Array.isArray(data)) {
                setRestaurants(data);
                const located = data.filter((r) => r.hasValidLocation).length;
                const active = data.filter((r) => r.isActive).length;
                setSummary({
                    totalRestaurants: data.length,
                    locatedRestaurants: located,
                    missingLocationRestaurants: data.length - located,
                    activeRestaurants: active,
                    inactiveRestaurants: data.length - active,
                });
            }
        } catch (err) {
            console.error("[SuperAdminRestaurantMap] Error fetching map data:", err);
            setApiError(err.response?.data?.message || "Failed to load restaurant locations.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMapData();
    }, [loadMapData]);

    // Filter restaurants based on search & tab
    const filteredRestaurants = useMemo(() => {
        return restaurants.filter((r) => {
            // Status Tab Filter
            if (statusFilter === "located" && !r.hasValidLocation) return false;
            if (statusFilter === "missing" && r.hasValidLocation) return false;
            if (statusFilter === "active" && !r.isActive) return false;
            if (statusFilter === "inactive" && r.isActive) return false;

            // Search Filter (Name, City, Slug)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = (r.name || "").toLowerCase().includes(q);
                const cityMatch = (r.city || "").toLowerCase().includes(q);
                const slugMatch = (r.slug || "").toLowerCase().includes(q);
                if (!nameMatch && !cityMatch && !slugMatch) return false;
            }

            return true;
        });
    }, [restaurants, statusFilter, searchQuery]);

    // Located restaurants among the whole list (for rendering map markers)
    const locatedRestaurants = useMemo(() => {
        return restaurants.filter((r) => r.hasValidLocation && r.latitude != null && r.longitude != null);
    }, [restaurants]);

    // Update Radius Circle layer on Map
    const updateRadiusLayer = useCallback((restaurant) => {
        const map = mapRef.current;
        if (!map) return;

        const sourceId = "selected-restaurant-radius";
        const fillLayerId = "selected-restaurant-radius-fill";
        const lineLayerId = "selected-restaurant-radius-line";

        const applyLayer = () => {
            if (!restaurant || !restaurant.hasValidLocation || !restaurant.deliveryRadiusKm || restaurant.deliveryRadiusKm <= 0) {
                const source = map.getSource(sourceId);
                if (source) {
                    source.setData({ type: "FeatureCollection", features: [] });
                }
                return;
            }

            const circleGeoJSON = createGeoJSONCircle(restaurant.latitude, restaurant.longitude, restaurant.deliveryRadiusKm);

            const source = map.getSource(sourceId);
            if (source) {
                source.setData(circleGeoJSON);
            } else {
                map.addSource(sourceId, {
                    type: "geojson",
                    data: circleGeoJSON,
                });
                map.addLayer({
                    id: fillLayerId,
                    type: "fill",
                    source: sourceId,
                    paint: {
                        "fill-color": "#FE5102",
                        "fill-opacity": 0.12,
                    },
                });
                map.addLayer({
                    id: lineLayerId,
                    type: "line",
                    source: sourceId,
                    paint: {
                        "line-color": "#FE5102",
                        "line-width": 2,
                        "line-dasharray": [2, 2],
                    },
                });
            }
        };

        if (map.isStyleLoaded()) {
            applyLayer();
        } else {
            map.once("load", applyLayer);
        }
    }, []);

    // Open popup for selected restaurant
    const showRestaurantPopup = useCallback((restaurant) => {
        const map = mapRef.current;
        if (!map || !restaurant || !restaurant.hasValidLocation) return;

        if (activePopupRef.current) {
            activePopupRef.current.remove();
            activePopupRef.current = null;
        }

        const activeStatusBadge = restaurant.isActive
            ? `<span style="background:#ECFDF5; color:#059669; border:1px solid #A7F3D0; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">Active</span>`
            : `<span style="background:#F9F6F0; color:#795548; border:1px solid #E8D8CC; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">Inactive</span>`;

        const openStatusBadge = restaurant.isOpen
            ? `<span style="background:#ECFDF5; color:#059669; border:1px solid #A7F3D0; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">Open</span>`
            : `<span style="background:#FDF2F2; color:#DC2626; border:1px solid #FCA5A5; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">Closed</span>`;

        const popupHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; color: #2B1710; padding: 4px; min-width: 220px; max-width: 280px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                    <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: #2B1710; line-height: 1.2;">
                        ${restaurant.name}
                    </h4>
                    <div style="display: flex; gap: 4px;">
                        ${activeStatusBadge}
                        ${openStatusBadge}
                    </div>
                </div>

                <div style="font-size: 11px; color: #795548; margin-bottom: 6px; line-height: 1.4;">
                    ${restaurant.addressLine1 ? `<div>${restaurant.addressLine1}</div>` : ""}
                    <div><strong>${restaurant.city || "N/A"}</strong>${restaurant.state ? `, ${restaurant.state}` : ""}</div>
                    ${restaurant.phone ? `<div style="margin-top:2px;">📞 ${restaurant.phone}</div>` : ""}
                </div>

                <div style="background: #FFF8F1; border: 1px solid #E8D8CC; border-radius: 8px; padding: 6px 8px; font-size: 11px; margin-bottom: 8px;">
                    <div style="color: #795548; font-size: 10px; font-family: monospace;">
                        📍 ${Number(restaurant.latitude).toFixed(4)}, ${Number(restaurant.longitude).toFixed(4)}
                    </div>
                    <div style="color: #FE5102; font-weight: 700; margin-top: 2px;">
                        Delivery radius: ${restaurant.deliveryRadiusKm || 5} km
                    </div>
                </div>

                <a 
                    href="/super-admin/restaurant-profiles?q=${encodeURIComponent(restaurant.slug || restaurant.name)}" 
                    style="display: block; text-align: center; background: #FE5102; color: #ffffff; padding: 7px 12px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700; transition: background 0.2s; box-shadow: 0 2px 6px rgba(254,81,2,0.25);"
                    onmouseover="this.style.background='#E04600'"
                    onmouseout="this.style.background='#FE5102'"
                >
                    View Restaurant &rarr;
                </a>
            </div>
        `;

        const popup = new maplibregl.Popup({
            offset: 25,
            closeButton: true,
            closeOnClick: false,
            className: "tiffzy-admin-map-popup",
        })
            .setLngLat([restaurant.longitude, restaurant.latitude])
            .setHTML(popupHtml)
            .addTo(map);

        activePopupRef.current = popup;
    }, []);

    // Focus on a specific restaurant on the map
    const focusRestaurant = useCallback(
        (restaurant) => {
            setSelectedRestaurant(restaurant);

            if (!restaurant || !restaurant.hasValidLocation) {
                // If no coordinates, clear radius and popup
                updateRadiusLayer(null);
                if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                }
                return;
            }

            const map = mapRef.current;
            if (map) {
                map.flyTo({
                    center: [restaurant.longitude, restaurant.latitude],
                    zoom: 14,
                    speed: 1.4,
                    curve: 1.2,
                    essential: true,
                });
                updateRadiusLayer(restaurant);
                showRestaurantPopup(restaurant);
            }
        },
        [updateRadiusLayer, showRestaurantPopup]
    );

    // Fit map bounds to show all located restaurants
    const fitAllRestaurants = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        const validCoords = locatedRestaurants;
        if (validCoords.length === 0) {
            map.flyTo({
                center: [MAP_CONFIG.defaultCenter.lng, MAP_CONFIG.defaultCenter.lat],
                zoom: MAP_CONFIG.defaultCenter.zoom,
            });
            return;
        }

        if (validCoords.length === 1) {
            map.flyTo({
                center: [validCoords[0].longitude, validCoords[0].latitude],
                zoom: 13,
            });
            return;
        }

        const bounds = new maplibregl.LngLatBounds();
        validCoords.forEach((r) => {
            bounds.extend([r.longitude, r.latitude]);
        });

        map.fitBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            maxZoom: 15,
            duration: 1000,
        });
    }, [locatedRestaurants]);

    // Initialize MapLibre Map Instance
    const initMap = useCallback(() => {
        if (!mapContainerRef.current) return;

        // Clean up previous instance if any
        if (mapRef.current) {
            try {
                mapRef.current.remove();
            } catch (err) {
                console.warn("[SuperAdminRestaurantMap] Map cleanup warning:", err);
            }
            mapRef.current = null;
        }

        setMapError(null);

        try {
            // Clone style object to avoid in-place mutation by MapLibre
            const style = JSON.parse(JSON.stringify(MAP_CONFIG.styleUrl));

            const initialCenter = locatedRestaurants.length > 0
                ? [locatedRestaurants[0].longitude, locatedRestaurants[0].latitude]
                : [MAP_CONFIG.defaultCenter.lng, MAP_CONFIG.defaultCenter.lat];

            const initialZoom = locatedRestaurants.length === 1 ? 13 : (MAP_CONFIG.defaultCenter.zoom || 11);

            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style,
                center: initialCenter,
                zoom: initialZoom,
                attributionControl: true,
            });

            map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

            map.on("load", () => {
                map.resize();

                // If restaurants are already available, fit viewport
                if (locatedRestaurants.length === 1) {
                    map.setCenter([locatedRestaurants[0].longitude, locatedRestaurants[0].latitude]);
                    map.setZoom(13);
                } else if (locatedRestaurants.length > 1) {
                    const bounds = new maplibregl.LngLatBounds();
                    locatedRestaurants.forEach((r) => bounds.extend([r.longitude, r.latitude]));
                    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
                }
            });

            map.on("error", (e) => {
                console.warn("[SuperAdminRestaurantMap] MapLibre internal warning/error:", e);
            });

            mapRef.current = map;

            // Trigger resize at multiple stages to guarantee full canvas dimension sync
            requestAnimationFrame(() => map?.resize());
            setTimeout(() => map?.resize(), 100);
            setTimeout(() => map?.resize(), 400);

            if (window.ResizeObserver && mapContainerRef.current) {
                if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
                const ro = new ResizeObserver(() => {
                    map?.resize();
                });
                ro.observe(mapContainerRef.current);
                resizeObserverRef.current = ro;
            }
        } catch (err) {
            console.error("[SuperAdminRestaurantMap] Failed to initialize MapLibre canvas:", err);
            setMapError("Unable to load map");
        }
    }, [locatedRestaurants]);

    // Initialize map on mount
    useEffect(() => {
        initMap();

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
            if (mapRef.current) {
                try {
                    mapRef.current.remove();
                } catch (e) {
                    console.warn("[SuperAdminRestaurantMap] Map destruction error:", e);
                }
                mapRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Synchronize Markers on the Map when locatedRestaurants change
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current.clear();

        locatedRestaurants.forEach((r) => {
            const el = document.createElement("div");
            el.className = `tiffzy-admin-marker cursor-pointer transition-transform duration-200 hover:scale-125`;
            el.style.zIndex = "10";

            const isSelected = selectedRestaurant?.id === r.id;
            const statusDotColor = r.isActive ? (r.isOpen ? "#059669" : "#D97706") : "#795548";

            el.innerHTML = `
                <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="
                        background: ${isSelected ? "#FE5102" : "#FE5102"}; 
                        color: #ffffff; 
                        width: ${isSelected ? "38px" : "32px"}; 
                        height: ${isSelected ? "38px" : "32px"}; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        box-shadow: ${isSelected ? "0 4px 16px rgba(254,81,2,0.5)" : "0 3px 10px rgba(43,23,16,0.25)"}; 
                        border: ${isSelected ? "3px solid #FFFBF7" : "2.5px solid #ffffff"};
                        transition: all 0.2s ease;
                    ">
                        <svg width="${isSelected ? "20" : "16"}" height="${isSelected ? "20" : "16"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                            <line x1="6" y1="1" x2="6" y2="4"></line>
                            <line x1="10" y1="1" x2="10" y2="4"></line>
                            <line x1="14" y1="1" x2="14" y2="4"></line>
                        </svg>
                    </div>
                    <div style="
                        position: absolute; 
                        top: -2px; 
                        right: -2px; 
                        width: 10px; 
                        height: 10px; 
                        border-radius: 50%; 
                        background: ${statusDotColor}; 
                        border: 2px solid #ffffff;
                        box-shadow: 0 0 4px ${statusDotColor};
                    "></div>
                </div>
            `;

            el.addEventListener("click", (e) => {
                e.stopPropagation();
                focusRestaurant(r);
            });

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([r.longitude, r.latitude])
                .addTo(map);

            markersRef.current.set(r.id, marker);
        });

        // If a restaurant is selected, make sure radius layer is updated
        if (selectedRestaurant && selectedRestaurant.hasValidLocation) {
            updateRadiusLayer(selectedRestaurant);
        }

        // Trigger map resize so newly rendered markers align properly
        map.resize();
    }, [locatedRestaurants, selectedRestaurant, focusRestaurant, updateRadiusLayer]);

    // Automatically focus when a single restaurant is located
    useEffect(() => {
        if (!loading && locatedRestaurants.length === 1 && !selectedRestaurant) {
            const single = locatedRestaurants[0];
            setSelectedRestaurant(single);
            if (mapRef.current) {
                mapRef.current.flyTo({
                    center: [single.longitude, single.latitude],
                    zoom: 13,
                    essential: true,
                });
                updateRadiusLayer(single);
            }
        } else if (!loading && locatedRestaurants.length > 1 && mapRef.current) {
            fitAllRestaurants();
        }
    }, [loading, locatedRestaurants]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle single match on search
    useEffect(() => {
        if (searchQuery.trim() && filteredRestaurants.length === 1 && filteredRestaurants[0].hasValidLocation) {
            focusRestaurant(filteredRestaurants[0]);
        }
    }, [searchQuery, filteredRestaurants, focusRestaurant]);

    return (
        <div className="min-h-screen flex flex-col bg-[#FFF8F1] text-[#2B1710] selection:bg-[#FED7AA]">
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey="restaurant-map" />

            {/* Header */}
            <header className="border-b border-[#E8D8CC] px-4 py-3 sticky top-0 z-30 bg-[#FFFBF7]/95 backdrop-blur-md shadow-xs">
                <div className="w-full flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-xl text-[#2B1710] bg-[#FFF8F1] border border-[#E8D8CC] hover:bg-[#FFF3EB] hover:text-[#FE5102] transition shadow-xs"
                            aria-label="Open sidebar menu"
                        >
                            <Menu size={19} />
                        </button>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl" role="img" aria-label="map">🗺️</span>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-black text-[#FE5102]">Super Admin</p>
                                <h1 className="text-lg md:text-xl font-black text-[#2B1710] leading-tight">Restaurant Location Map</h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-2.5">
                        <button
                            type="button"
                            onClick={loadMapData}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#2B1710] bg-[#FFFBF7] border border-[#E8D8CC] hover:bg-[#FFF3EB] hover:border-[#FE5102]/40 hover:text-[#FE5102] transition disabled:opacity-50 shadow-xs"
                            title="Refresh location data"
                        >
                            <RefreshCw size={13} className={loading ? "animate-spin text-[#FE5102]" : ""} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate("/super-admin/restaurant-profiles")}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#2B1710] bg-[#FFFBF7] border border-[#E8D8CC] hover:bg-[#FFF3EB] hover:border-[#FE5102]/40 hover:text-[#FE5102] transition shadow-xs"
                        >
                            <Store size={13} />
                            <span>Profiles</span>
                        </button>

                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-full bg-[#FDF2F2] border border-[#FCA5A5]/40 px-3.5 py-1.5 text-xs font-bold text-[#991B1B] hover:bg-rose-100 transition shadow-xs"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Error banner if API fails */}
            {apiError && (
                <div className="mx-4 mt-3 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] p-3 text-[#991B1B] text-xs flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-[#DC2626]" />
                        <span>{apiError}</span>
                    </div>
                    <button onClick={loadMapData} className="underline font-bold text-xs text-[#DC2626] hover:text-[#991B1B]">Retry</button>
                </div>
            )}

            {/* Summary Metrics Bar */}
            <div className="px-4 py-3 border-b border-[#E8D8CC] bg-[#FFFBF7]">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {/* Total */}
                    <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            statusFilter === "all"
                                ? "bg-[#FFF3EB] border-[#FE5102] shadow-xs"
                                : "bg-[#FFFBF7] border-[#E8D8CC] hover:border-[#FE5102]/40"
                        }`}
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#795548]">Total</p>
                            <p className="text-lg font-black text-[#2B1710]">{summary.totalRestaurants}</p>
                        </div>
                        <Store size={18} className="text-[#FE5102]" />
                    </button>

                    {/* Located */}
                    <button
                        type="button"
                        onClick={() => setStatusFilter("located")}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            statusFilter === "located"
                                ? "bg-[#FFE8D6] border-[#FE5102] shadow-xs"
                                : "bg-[#FFF5ED] border-[#FED7AA] hover:border-[#FE5102]"
                        }`}
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#C2410C]">📍 Located</p>
                            <p className="text-lg font-black text-[#FE5102]">{summary.locatedRestaurants}</p>
                        </div>
                        <MapPin size={18} className="text-[#FE5102]" />
                    </button>

                    {/* Missing Location */}
                    <button
                        type="button"
                        onClick={() => setStatusFilter("missing")}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            statusFilter === "missing"
                                ? "bg-[#FEF3C7] border-[#D97706] shadow-xs"
                                : "bg-[#FEF9ED] border-[#FDE68A] hover:border-[#D97706]"
                        }`}
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">⚠️ Missing</p>
                            <p className="text-lg font-black text-[#2B1710]">{summary.missingLocationRestaurants}</p>
                        </div>
                        <AlertTriangle size={18} className="text-[#D97706]" />
                    </button>

                    {/* Active */}
                    <button
                        type="button"
                        onClick={() => setStatusFilter("active")}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            statusFilter === "active"
                                ? "bg-[#D1FAE5] border-[#059669] shadow-xs"
                                : "bg-[#ECFDF5] border-[#A7F3D0] hover:border-[#059669]"
                        }`}
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">🟢 Active</p>
                            <p className="text-lg font-black text-[#059669]">{summary.activeRestaurants}</p>
                        </div>
                        <CheckCircle2 size={18} className="text-[#059669]" />
                    </button>

                    {/* Inactive */}
                    <button
                        type="button"
                        onClick={() => setStatusFilter("inactive")}
                        className={`col-span-2 sm:col-span-1 p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            statusFilter === "inactive"
                                ? "bg-[#EFE9E1] border-[#795548] shadow-xs"
                                : "bg-[#F9F6F0] border-[#E8D8CC] hover:border-[#795548]"
                        }`}
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#795548]">⚫ Inactive</p>
                            <p className="text-lg font-black text-[#795548]">{summary.inactiveRestaurants}</p>
                        </div>
                        <XCircle size={18} className="text-[#795548]" />
                    </button>
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="px-4 py-2.5 border-b border-[#E8D8CC] bg-[#FFFBF7] flex flex-wrap items-center justify-between gap-3">
                {/* Search Field */}
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3.5 top-2.5 text-[#9C7C6E]" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search restaurant by name, city, or slug..."
                        className="w-full rounded-xl bg-white border border-[#E8D8CC] pl-9 pr-8 py-2 text-xs text-[#2B1710] placeholder-[#9C7C6E] outline-none focus:border-[#FE5102] focus:ring-1 focus:ring-[#FE5102] transition shadow-2xs"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2.5 text-[#9C7C6E] hover:text-[#2B1710]"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filter Pills & Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center rounded-xl bg-[#FFF8F1] p-1 border border-[#E8D8CC] text-xs">
                        <button
                            type="button"
                            onClick={() => setStatusFilter("all")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition ${
                                statusFilter === "all" ? "bg-[#FE5102] text-white shadow-xs" : "text-[#795548] hover:text-[#2B1710]"
                            }`}
                        >
                            All ({summary.totalRestaurants})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter("located")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition ${
                                statusFilter === "located" ? "bg-[#FE5102] text-white shadow-xs" : "text-[#795548] hover:text-[#2B1710]"
                            }`}
                        >
                            📍 Located ({summary.locatedRestaurants})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter("missing")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition ${
                                statusFilter === "missing" ? "bg-[#D97706] text-white shadow-xs" : "text-[#795548] hover:text-[#2B1710]"
                            }`}
                        >
                            ⚠️ Missing ({summary.missingLocationRestaurants})
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fitAllRestaurants}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFF3EB] text-xs font-bold text-[#2B1710] border border-[#E8D8CC] hover:border-[#FE5102]/40 hover:text-[#FE5102] transition shadow-xs"
                        title="Fit All Located Restaurants in View"
                    >
                        <Maximize2 size={13} className="text-[#FE5102]" />
                        <span className="hidden md:inline">Fit All</span>
                    </button>
                </div>
            </div>

            {/* Main Interactive Map & Directory Split View */}
            <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 sm:p-4 min-h-[580px] w-full">
                {/* Map Column */}
                <div className="relative flex-1 flex flex-col min-w-0 min-h-[460px] lg:min-h-[540px]">
                    {/* Explicitly Sized MapLibre Container */}
                    <div
                        ref={mapContainerRef}
                        style={{ minHeight: "520px", height: "65vh", width: "100%" }}
                        className="relative w-full rounded-2xl overflow-hidden bg-[#FFFBF7] border border-[#E8D8CC] shadow-sm"
                    />

                    {/* Map Initialization Error Overlay */}
                    {mapError && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#FFF8F1]/90 p-6 backdrop-blur-xs rounded-2xl">
                            <div className="max-w-sm text-center p-6 rounded-2xl bg-[#FFFBF7] border border-[#FCA5A5] shadow-xl">
                                <AlertTriangle className="mx-auto mb-3 text-[#DC2626]" size={38} />
                                <h3 className="text-base font-bold text-[#2B1710] mb-1">Unable to load map</h3>
                                <p className="text-xs text-[#795548] mb-4">
                                    The map canvas could not be initialized. Please check your browser WebGL support and tap retry below.
                                </p>
                                <button
                                    type="button"
                                    onClick={initMap}
                                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#FE5102] hover:bg-[#E04600] transition shadow-md shadow-orange-500/20 inline-flex items-center gap-2"
                                >
                                    <RefreshCw size={13} /> Retry
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty State Overlay if no valid coordinates exist */}
                    {!loading && locatedRestaurants.length === 0 && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#FFF8F1]/85 p-6 backdrop-blur-xs rounded-2xl">
                            <div className="max-w-md text-center p-6 rounded-3xl bg-[#FFFBF7] border border-[#E8D8CC] shadow-xl">
                                <AlertTriangle className="mx-auto mb-3 text-[#D97706]" size={40} />
                                <h3 className="text-base font-black text-[#2B1710] mb-1">No Restaurant Locations Available</h3>
                                <p className="text-xs text-[#795548] mb-4">
                                    None of the restaurants have valid latitude and longitude coordinates in the database.
                                </p>
                                <button
                                    onClick={() => navigate("/super-admin/restaurant-profiles")}
                                    className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#FE5102] hover:bg-[#E04600] transition shadow-md shadow-orange-500/20 inline-flex items-center gap-2"
                                >
                                    <Store size={14} /> Configure Restaurant Locations
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Map Legend Overlay */}
                    <div className="absolute bottom-4 left-4 z-10 bg-[#FFFBF7]/95 backdrop-blur-md border border-[#E8D8CC] rounded-2xl px-3.5 py-2.5 shadow-md text-xs hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wider font-extrabold text-[#795548] mb-1.5">MAP LEGEND</p>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full bg-[#FE5102] border-2 border-white flex items-center justify-center text-[8px] text-white">☕</div>
                                <span className="text-[11px] font-semibold text-[#2B1710]">Restaurant Outlet</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#059669] shadow-[0_0_4px_#059669]"></div>
                                <span className="text-[11px] font-semibold text-[#2B1710]">Active & Open</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-2 rounded border border-dashed border-[#FE5102] bg-[#FE5102]/15"></div>
                                <span className="text-[11px] font-semibold text-[#2B1710]">Selected Delivery Radius</span>
                            </div>
                        </div>
                    </div>

                    {/* Floating Selected Restaurant Card */}
                    {selectedRestaurant && (
                        <div className="absolute top-4 left-4 z-20 max-w-sm w-[calc(100%-2rem)] sm:w-80 bg-[#FFFBF7] border border-[#E8D8CC] rounded-2xl p-4 shadow-xl transition-all">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <h3 className="text-sm font-black text-[#2B1710] leading-tight">{selectedRestaurant.name}</h3>
                                    <p className="text-[11px] text-[#795548]">
                                        {selectedRestaurant.city || "No city"}{selectedRestaurant.state ? `, ${selectedRestaurant.state}` : ""}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedRestaurant(null);
                                        updateRadiusLayer(null);
                                        if (activePopupRef.current) activePopupRef.current.remove();
                                    }}
                                    className="text-[#795548] hover:text-[#2B1710] p-1 rounded-lg transition"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    selectedRestaurant.isActive
                                        ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
                                        : "bg-[#F9F6F0] text-[#795548] border border-[#E8D8CC]"
                                }`}>
                                    {selectedRestaurant.isActive ? "🟢 Active" : "⚫ Inactive"}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    selectedRestaurant.isOpen
                                        ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
                                        : "bg-[#FDF2F2] text-[#DC2626] border border-[#FCA5A5]"
                                }`}>
                                    {selectedRestaurant.isOpen ? "Open" : "Closed"}
                                </span>
                                {selectedRestaurant.hasValidLocation ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3EB] text-[#FE5102] border border-[#FED7AA]">
                                        📍 Radius: {selectedRestaurant.deliveryRadiusKm || 5} km
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                                        ⚠️ Missing Location
                                    </span>
                                )}
                            </div>

                            {selectedRestaurant.hasValidLocation ? (
                                <p className="text-[11px] font-mono text-[#795548] mb-3">
                                    Coordinates: {Number(selectedRestaurant.latitude).toFixed(4)}, {Number(selectedRestaurant.longitude).toFixed(4)}
                                </p>
                            ) : (
                                <p className="text-[11px] text-[#B45309] mb-3 bg-[#FEF9ED] p-2 rounded-lg border border-[#FDE68A]">
                                    Coordinates are not set. This restaurant cannot be shown on the map or calculated for nearby delivery.
                                </p>
                            )}

                            <div className="flex items-center gap-2">
                                <a
                                    href={`/super-admin/restaurant-profiles?q=${encodeURIComponent(selectedRestaurant.slug || selectedRestaurant.name)}`}
                                    className="flex-1 text-center py-2 px-3 rounded-xl bg-[#FE5102] hover:bg-[#E04600] text-white font-bold text-xs transition shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5"
                                >
                                    <span>View Restaurant Profile</span>
                                    <ExternalLink size={13} />
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Compact Restaurant List Drawer */}
                <div className="w-full lg:w-96 lg:shrink-0 rounded-2xl border border-[#E8D8CC] bg-[#FFFBF7] flex flex-col min-h-[380px] lg:min-h-[520px] max-h-[70vh] lg:max-h-[65vh] overflow-hidden shadow-sm">
                    {/* List Header */}
                    <div className="px-4 py-3 border-b border-[#E8D8CC] flex items-center justify-between bg-[#FFF8F1]">
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-wider text-[#2B1710]">Restaurants ({filteredRestaurants.length})</h2>
                            <p className="text-[11px] text-[#795548]">Click any restaurant to view on map</p>
                        </div>
                        {selectedRestaurant && (
                            <button
                                type="button"
                                onClick={() => setSelectedRestaurant(null)}
                                className="text-[11px] font-bold text-[#FE5102] hover:text-[#E04600] transition"
                            >
                                Clear Selection
                            </button>
                        )}
                    </div>

                    {/* Scrollable Restaurant Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            <div className="text-center py-12 text-[#795548] text-xs">
                                <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[#FE5102]" />
                                Loading restaurants...
                            </div>
                        ) : filteredRestaurants.length === 0 ? (
                            <div className="text-center py-12 text-[#795548] text-xs">
                                <Store size={30} className="mx-auto mb-2 text-[#9C7C6E]/40" />
                                No restaurants match the current filter.
                            </div>
                        ) : (
                            filteredRestaurants.map((r) => {
                                const isSelected = selectedRestaurant?.id === r.id;
                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => focusRestaurant(r)}
                                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                                            isSelected
                                                ? "bg-[#FFF3EB] border-[#FE5102] shadow-sm scale-[1.01]"
                                                : "bg-white border-[#E8D8CC] hover:border-[#FE5102]/50 hover:bg-[#FFFBF7]"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="text-xs font-extrabold text-[#2B1710] leading-tight">
                                                {r.name}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                                r.isActive
                                                    ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
                                                    : "bg-[#F9F6F0] text-[#795548] border border-[#E8D8CC]"
                                            }`}>
                                                {r.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-[#795548] mb-2 truncate">
                                            {r.city ? `${r.city}` : "No City"}{r.state ? `, ${r.state}` : ""}
                                        </p>

                                        <div className="flex items-center justify-between pt-1.5 border-t border-[#E8D8CC]/60 text-[10px]">
                                            {r.hasValidLocation ? (
                                                <div className="flex items-center gap-1 text-[#FE5102] font-semibold bg-[#FFF3EB] px-2 py-0.5 rounded border border-[#FED7AA]">
                                                    <MapPin size={11} className="text-[#FE5102]" />
                                                    <span>Radius: {r.deliveryRadiusKm || 5} km</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[#D97706] font-semibold bg-[#FEF9ED] px-2 py-0.5 rounded border border-[#FDE68A]">
                                                    <AlertTriangle size={11} />
                                                    <span>Missing Location</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {r.hasValidLocation && (
                                                    <span className="text-[#FE5102] font-bold hover:underline">
                                                        Show &rarr;
                                                    </span>
                                                )}
                                                <a
                                                    href={`/super-admin/restaurant-profiles?q=${encodeURIComponent(r.slug || r.name)}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[#795548] hover:text-[#FE5102] p-1 transition"
                                                    title="View Profile"
                                                >
                                                    <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
