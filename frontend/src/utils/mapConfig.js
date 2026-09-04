/**
 * Tiffzy Web Map Provider & Style Configuration
 * Separated to allow easy swapping of tile providers / styles for production.
 */
export const MAP_CONFIG = {
    // OpenFreeMap Bright Vector Style (Free OpenStreetMap vector tiles, no API key required)
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
    
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


