import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let googleMapsPromise = null;
let isOptionsSet = false;

/**
 * Get configured Google Maps API Key from environment variables.
 */
export const getGoogleMapsApiKey = () => {
    const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
    if (!key || key === "YOUR_KEY") {
        return null;
    }
    return key;
};

/**
 * Loads Google Maps JavaScript API libraries dynamically and returns window.google.
 * Caches the loading promise to ensure API is loaded only once.
 * 
 * @param {string[]} libraries List of additional libraries to load (e.g. ['maps', 'places', 'marker'])
 * @returns {Promise<typeof google>}
 */
export const loadGoogleMaps = (libraries = ["maps", "places", "marker"]) => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
        return Promise.reject(new Error("Google Maps API key is not configured."));
    }

    if (!googleMapsPromise) {
        googleMapsPromise = (async () => {
            if (!isOptionsSet) {
                setOptions({
                    key: apiKey,
                    v: "weekly",
                });
                isOptionsSet = true;
            }

            // Load requested libraries in parallel using modern importLibrary API
            await Promise.all(libraries.map((lib) => importLibrary(lib)));

            return window.google;
        })();
    }

    return googleMapsPromise;
};
