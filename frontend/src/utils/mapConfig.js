/**
 * Tiffzy Web Map Provider & Style Configuration
 * MapLibre GL JS with CARTO Voyager Raster Tiles (OpenStreetMap data)
 */

export const sanitizeApiKey = (rawKey) => {
    if (!rawKey) return "";
    let key = String(rawKey).trim();
    if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
    ) {
        key = key.slice(1, -1).trim();
    }
    return key;
};

export const getCartoApiKey = () => {
    const candidateKeys = [
        "VITE_CARTO_API_KEY",
        "VITE_CARTO_KEY",
        "VITE_CARTO_TOKEN",
        "VITE_CARTO_ACCESS_TOKEN",
        "VITE_CARTO_MAP_KEY",
        "CARTO_API_KEY",
        "VITE_MAP_KEY",
        "VITE_MAPS_API_KEY",
    ];

    try {
        if (typeof import.meta !== "undefined" && import.meta.env) {
            for (const name of candidateKeys) {
                const val = import.meta.env[name];
                if (val && typeof val === "string" && val.trim() !== "" && val.trim() !== "YOUR_KEY") {
                    return sanitizeApiKey(val);
                }
            }
        }
    } catch {
        // ignore in non-Vite environments
    }

    try {
        if (typeof process !== "undefined" && process.env) {
            for (const name of candidateKeys) {
                const val = process.env[name];
                if (val && typeof val === "string" && val.trim() !== "" && val.trim() !== "YOUR_KEY") {
                    return sanitizeApiKey(val);
                }
            }
        }
    } catch {
        // ignore in environments without process.env
    }

    return "";
};

/**
 * Request transformer to guarantee that every network request to CARTO CDN
 * has the authenticated API key appended as ?key=... parameter.
 */
export const transformMapRequest = (url) => {
    const key = getCartoApiKey();
    if (key && url && typeof url === "string" && url.includes("basemaps.cartocdn.com") && !url.includes("key=")) {
        const separator = url.includes("?") ? "&" : "?";
        return {
            url: `${url}${separator}key=${encodeURIComponent(key)}`,
        };
    }
    return { url };
};

/**
 * Returns a fresh, unmutated MapLibre GL style specification object.
 * Always returns a new copy to avoid MapLibre's in-place style mutations across map instances.
 */
export const getMapStyle = () => {
    const key = getCartoApiKey();
    const keyParam = key && key !== "YOUR_KEY" ? `?key=${encodeURIComponent(key)}` : "";

    return {
        version: 8,
        sources: {
            "carto-voyager": {
                type: "raster",
                tiles: [
                    `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
                    `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
                    `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
                    `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
                ],
                tileSize: 256,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
            },
        },
        layers: [
            {
                id: "carto-voyager-layer",
                type: "raster",
                source: "carto-voyager",
                minzoom: 0,
                maxzoom: 19,
            },
        ],
    };
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
    if (typeof rawLat === "boolean" || typeof rawLng === "boolean") {
        return null;
    }
    if (typeof rawLat === "string" && rawLat.trim() === "") {
        return null;
    }
    if (typeof rawLng === "string" && rawLng.trim() === "") {
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

export const MAP_CONFIG = {
    // Dynamic getter so every consumer receives a fresh, unmutated style object
    get styleUrl() {
        return getMapStyle();
    },

    // Request transformer ensuring all CARTO network tile/style requests include API key
    transformRequest: transformMapRequest,

    // Default Map Center (Bengaluru, India: lat=12.9716, lng=77.5946)
    defaultCenter: {
        lat: 12.9716,
        lng: 77.5946,
        zoom: 12,
    },

    // In-memory test restaurant marker
    testMarker: {
        enabled: true,
        name: "Tiffzy Test Restaurant",
        lat: 12.9716,
        lng: 77.5946,
        description: "Temporary Test Marker (Not in Database)",
    },
};

