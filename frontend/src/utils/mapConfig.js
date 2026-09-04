/**
 * Tiffzy Web Map Provider & Style Configuration
 * CARTO Voyager Raster Tile Provider with CARTO_API_KEY Constant
 */

// Step 2 requirement: Direct CARTO API Key constant in source code
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || "YOUR_KEY";

const getCartoTileUrl = () => {
    const key = (CARTO_API_KEY === "YOUR_KEY" ? "" : CARTO_API_KEY).trim();
    if (!key) {
        console.warn("[TiffzyMap] CARTO basemap API key is not configured. Replace YOUR_KEY in mapConfig.js with your actual CARTO API key.");
    }
    const keyParam = key ? `?key=${encodeURIComponent(key)}` : "";
    return `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`;
};

const tileUrlPattern = getCartoTileUrl();

export const MAP_CONFIG = {
    // CARTO Voyager Raster Tile Style with API Key
    styleUrl: {
        version: 8,
        sources: {
            "carto-voyager": {
                type: "raster",
                tiles: [
                    tileUrlPattern.replace("basemaps.cartocdn.com", "a.basemaps.cartocdn.com"),
                    tileUrlPattern.replace("basemaps.cartocdn.com", "b.basemaps.cartocdn.com"),
                    tileUrlPattern.replace("basemaps.cartocdn.com", "c.basemaps.cartocdn.com"),
                    tileUrlPattern.replace("basemaps.cartocdn.com", "d.basemaps.cartocdn.com")
                ],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }
        },
        layers: [
            {
                id: "carto-voyager-layer",
                type: "raster",
                source: "carto-voyager",
                minzoom: 0,
                maxzoom: 19
            }
        ]
    },
    
    // Default Map Center (Bengaluru, India: lat=12.9716, lng=77.5946)
    defaultCenter: {
        lat: 12.9716,
        lng: 77.5946,
        zoom: 12
    },

    // In-memory test restaurant marker (Step 4 requirement)
    testMarker: {
        enabled: true,
        name: "Tiffzy Test Restaurant",
        lat: 12.9716,
        lng: 77.5946,
        description: "Temporary Test Marker (Not in Database)"
    }
};




