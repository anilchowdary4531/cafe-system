/**
 * Tiffzy Web Map Provider & Style Configuration
 * MapLibre GL JS with CARTO Voyager Raster Tiles (OpenStreetMap data)
 */

const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY || "").trim();
const keyParam = CARTO_API_KEY && CARTO_API_KEY !== "YOUR_KEY" ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : "";

export const MAP_CONFIG = {
    // CARTO Voyager Raster Tile Style with OSM attribution
    styleUrl: {
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
    },

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
