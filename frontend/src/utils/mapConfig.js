/**
 * Tiffzy Web Map Provider & Style Configuration
 * Separated to allow easy swapping of tile providers / styles for production.
 */
export const MAP_CONFIG = {
    // OpenStreetMap-compatible vector tile style URL (Free, no API key required)
    styleUrl: "https://demotiles.maplibre.org/style.json",
    
    // Default Map Center (Bengaluru, India as per Step 4 requirements)
    defaultCenter: {
        lat: 12.9716,
        lng: 77.5946,
        zoom: 12
    },

    // In-memory test restaurant marker (Step 4 requirement)
    // Removed/disabled in production by setting enabled: false or removing
    testMarker: {
        enabled: true,
        name: "Tiffzy Test Restaurant",
        lat: 12.9716,
        lng: 77.5946,
        description: "Temporary Test Marker (Not in Database)"
    }
};
