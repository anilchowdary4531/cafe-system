/**
 * Tiffzy Web Map Configuration
 * Default map center and in-memory test restaurant marker constants for Google Maps.
 */

export const MAP_CONFIG = {
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
