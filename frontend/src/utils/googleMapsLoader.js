import { Loader } from "@googlemaps/js-api-loader";

let googleMapsPromise = null;

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
 * Loads Google Maps JavaScript API libraries dynamically and returns the google object.
 * Caches the loading promise to ensure script tag is appended only once.
 * 
 * @param {string[]} libraries List of additional libraries to load (e.g. ['places', 'marker'])
 * @returns {Promise<typeof google>}
 */
export const loadGoogleMaps = (libraries = ["places", "marker"]) => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
        return Promise.reject(new Error("Google Maps API key is not configured."));
    }

    if (!googleMapsPromise) {
        const loader = new Loader({
            apiKey,
            version: "weekly",
            libraries,
        });

        googleMapsPromise = loader.load().then(() => window.google);
    }

    return googleMapsPromise;
};
