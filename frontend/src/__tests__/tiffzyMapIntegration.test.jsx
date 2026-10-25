import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MAP_CONFIG, getCartoApiKey, getMapStyle, parseAndValidateCoords, sanitizeApiKey, transformMapRequest } from "../utils/mapConfig";
import MapLocationPicker from "../components/MapLocationPicker";
import TiffzyMapModal from "../components/TiffzyMapModal";

// Mock maplibre-gl
const mockMarkerInstance = {
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    setPopup: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
};

const mockMapInstance = {
    addControl: vi.fn(),
    on: vi.fn((event, handler) => {
        if (event === "load") {
            setTimeout(handler, 0);
        }
        return mockMapInstance;
    }),
    resize: vi.fn(),
    remove: vi.fn(),
    flyTo: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    fitBounds: vi.fn(),
};

vi.mock("maplibre-gl", () => {
    function MockMap() {
        return mockMapInstance;
    }
    function MockMarker() {
        return mockMarkerInstance;
    }
    function MockPopup() {
        return {
            setHTML: vi.fn().mockReturnThis(),
            setText: vi.fn().mockReturnThis(),
        };
    }
    function MockNavigationControl() {
        return {};
    }
    function MockLngLatBounds() {
        return {
            extend: vi.fn().mockReturnThis(),
        };
    }
    return {
        default: {
            Map: MockMap,
            Marker: MockMarker,
            Popup: MockPopup,
            NavigationControl: MockNavigationControl,
            LngLatBounds: MockLngLatBounds,
        },
        Map: MockMap,
        Marker: MockMarker,
        Popup: MockPopup,
        NavigationControl: MockNavigationControl,
        LngLatBounds: MockLngLatBounds,
    };
});

vi.mock("react-router-dom", () => ({
    useNavigate: () => vi.fn(),
}));

describe("Tiffzy Map Configuration & Provider Audit", () => {
    it("1. Map provider is MapLibre with CARTO Voyager raster tiles", () => {
        const style = getMapStyle();
        expect(style.version).toBe(8);
        expect(style.sources["carto-voyager"]).toBeDefined();
        expect(style.sources["carto-voyager"].type).toBe("raster");
        expect(style.sources["carto-voyager"].tiles[0]).toContain("basemaps.cartocdn.com/rastertiles/voyager");
        expect(style.layers[0].id).toBe("carto-voyager-layer");
    });

    it("2. Existing map key configuration is safely resolved from environment without crashing", () => {
        const key = getCartoApiKey();
        // Key should be string (empty if not set in local env, or non-empty if configured)
        expect(typeof key).toBe("string");
    });

    it("3. MAP_CONFIG.styleUrl returns a fresh, unmutated copy on every access", () => {
        const style1 = MAP_CONFIG.styleUrl;
        const style2 = MAP_CONFIG.styleUrl;
        expect(style1).toEqual(style2);
        // Mutating style1 must not corrupt style2
        style1.sources["carto-voyager"].tiles = ["mutated"];
        expect(MAP_CONFIG.styleUrl.sources["carto-voyager"].tiles[0]).toContain("basemaps.cartocdn.com");
    });

    it("4. Valid coordinates are accepted and parsed", () => {
        const coords = parseAndValidateCoords(12.9716, 77.5946);
        expect(coords).toEqual({ lat: 12.9716, lng: 77.5946 });
    });

    it("5. Invalid coordinates (empty strings, null, undefined, out of bounds) are handled safely", () => {
        expect(parseAndValidateCoords(null, null)).toBeNull();
        expect(parseAndValidateCoords("", "")).toBeNull();
        expect(parseAndValidateCoords(" ", " ")).toBeNull();
        expect(parseAndValidateCoords(100, 77.5946)).toBeNull();
        expect(parseAndValidateCoords(12.9716, 200)).toBeNull();
        expect(parseAndValidateCoords(NaN, 77.5946)).toBeNull();
    });

    it("6. Default map center is Bengaluru, India", () => {
        expect(MAP_CONFIG.defaultCenter.lat).toBe(12.9716);
        expect(MAP_CONFIG.defaultCenter.lng).toBe(77.5946);
        expect(MAP_CONFIG.defaultCenter.zoom).toBe(12);
    });

    it("7. sanitizeApiKey strips leading/trailing quotes and whitespace", () => {
        expect(sanitizeApiKey('"my_secret_key"')).toBe("my_secret_key");
        expect(sanitizeApiKey("'my_secret_key'")).toBe("my_secret_key");
        expect(sanitizeApiKey("  my_secret_key  ")).toBe("my_secret_key");
        expect(sanitizeApiKey(null)).toBe("");
    });

    it("8. transformMapRequest intercepts CARTO requests and attaches key if available", () => {
        const key = getCartoApiKey();
        const res = transformMapRequest("https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png");
        if (key) {
            expect(res.url).toBe(`https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png?key=${encodeURIComponent(key)}`);
        } else {
            expect(res.url).toBe("https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png");
        }

        // Non-carto URL should remain untouched
        const resOther = transformMapRequest("https://example.com/tile.png");
        expect(resOther.url).toBe("https://example.com/tile.png");
    });
});

describe("MapLocationPicker Component Lifecycle & Interaction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders map container with accessible hint text", () => {
        render(
            <MapLocationPicker
                latitude={12.9716}
                longitude={77.5946}
                onSelectLocation={vi.fn()}
            />
        );

        expect(screen.getByText(/Click map or drag pin to select location/i)).toBeInTheDocument();
        expect(screen.getByText(/12.9716, 77.5946/i)).toBeInTheDocument();
    });

    it("cleans up map instance on unmount", () => {
        const { unmount } = render(
            <MapLocationPicker
                latitude={12.9716}
                longitude={77.5946}
                onSelectLocation={vi.fn()}
            />
        );

        unmount();
        expect(mockMapInstance.remove).toHaveBeenCalled();
    });

    it("falls back to default center when coordinates are missing or empty", () => {
        render(
            <MapLocationPicker
                latitude=""
                longitude=""
                onSelectLocation={vi.fn()}
            />
        );

        expect(screen.getByText(/Click map or drag pin to select location/i)).toBeInTheDocument();
        expect(screen.queryByText(/0.0000/i)).not.toBeInTheDocument();
    });
});

describe("TiffzyMapModal Open / Close / Reopen Flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not render when isOpen is false", () => {
        const { container } = render(
            <TiffzyMapModal isOpen={false} onClose={vi.fn()} restaurants={[]} />
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders modal with accessible buttons when isOpen is true", () => {
        render(
            <TiffzyMapModal
                isOpen={true}
                onClose={vi.fn()}
                restaurants={[
                    { id: "r1", name: "Cafe Delight", latitude: 12.9716, longitude: 77.5946, slug: "cafe-delight" }
                ]}
            />
        );

        expect(screen.getByText(/Tiffzy Outlets Map/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Close Map/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Use my location/i })).toBeInTheDocument();
    });

    it("triggers onClose when close button is clicked", () => {
        const onCloseMock = vi.fn();
        render(
            <TiffzyMapModal
                isOpen={true}
                onClose={onCloseMock}
                restaurants={[]}
            />
        );

        const closeBtn = screen.getByRole("button", { name: /Close Map/i });
        fireEvent.click(closeBtn);
        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it("can be opened, closed, and reopened cleanly without crashing", () => {
        const { rerender } = render(
            <TiffzyMapModal isOpen={true} onClose={vi.fn()} restaurants={[]} />
        );
        expect(screen.getByText(/Tiffzy Outlets Map/i)).toBeInTheDocument();

        // Close
        rerender(<TiffzyMapModal isOpen={false} onClose={vi.fn()} restaurants={[]} />);
        expect(screen.queryByText(/Tiffzy Outlets Map/i)).not.toBeInTheDocument();

        // Reopen
        rerender(<TiffzyMapModal isOpen={true} onClose={vi.fn()} restaurants={[]} />);
        expect(screen.getByText(/Tiffzy Outlets Map/i)).toBeInTheDocument();
    });
});
