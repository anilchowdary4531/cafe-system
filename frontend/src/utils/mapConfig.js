/**
 * Tiffzy Web Map Provider & Style Configuration
 * Separated to allow easy swapping of tile providers / styles for production.
 */
export const MAP_CONFIG = {
    // CartoDB Voyager Raster Tile Style (Free OpenStreetMap PNG tiles: roads, streets, labels, parks, water)
    styleUrl: {
        version: 8,
        sources: {
            "carto-voyager": {
                type: "raster",
                tiles: [
                    "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
                    "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
                    "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
                    "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
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

