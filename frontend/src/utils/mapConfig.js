/**
 * Tiffzy Web Map Provider & Style Configuration
 * CARTO Voyager Raster Tile Provider with VITE_CARTO_API_KEY
 */

const getCartoApiKey = () => {
    const key = (import.meta.env.VITE_CARTO_API_KEY || "").trim();
    if (!key) {
        console.warn("[TiffzyMap] CARTO basemap API key is not configured. (VITE_CARTO_API_KEY missing)");
    }
    return key;
};

const cartoKey = getCartoApiKey();
const keyQuery = cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : "";

export const MAP_CONFIG = {
    // CARTO Voyager Raster Tile Style with API Key
    styleUrl: {
        version: 8,
        sources: {
            "carto-voyager": {
                type: "raster",
                tiles: [
                    `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyQuery}`,
                    `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyQuery}`,
                    `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyQuery}`,
                    `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyQuery}`
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



