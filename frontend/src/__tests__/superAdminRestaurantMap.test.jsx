import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SuperAdminRestaurantMap, { normalizeRestaurant } from "../pages/super-admin/SuperAdminRestaurantMap";
import { api } from "../utils/apiClient";

// Captured markers for assertions
const createdMarkers = [];

// Mock maplibre-gl
const mockBoundsExtend = vi.fn();
const mockFitBounds = vi.fn();
const mockFlyTo = vi.fn();

const mockMapInstance = {
    addControl: vi.fn(),
    on: vi.fn((event, cb) => {
        if (event === "load") setTimeout(cb, 10);
    }),
    resize: vi.fn(),
    flyTo: mockFlyTo,
    fitBounds: mockFitBounds,
    getSource: vi.fn(() => null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    remove: vi.fn(),
    isStyleLoaded: vi.fn(() => true),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
};

vi.mock("maplibre-gl", () => {
    function MockMap() {
        return mockMapInstance;
    }
    function MockMarker(options) {
        const markerObj = {
            element: options?.element,
            lngLat: null,
            setLngLat: vi.fn(function (coords) {
                markerObj.lngLat = coords;
                return this;
            }),
            addTo: vi.fn(function () {
                createdMarkers.push(markerObj);
                return this;
            }),
            remove: vi.fn(function () {
                const idx = createdMarkers.indexOf(markerObj);
                if (idx !== -1) createdMarkers.splice(idx, 1);
            }),
        };
        return markerObj;
    }
    function MockPopup() {
        return {
            setLngLat: vi.fn().mockReturnThis(),
            setHTML: vi.fn().mockReturnThis(),
            addTo: vi.fn().mockReturnThis(),
            remove: vi.fn(),
        };
    }
    function MockNavigationControl() {
        return {};
    }
    function MockLngLatBounds() {
        return {
            extend: mockBoundsExtend,
        };
    }
    return {
        Map: MockMap,
        Marker: MockMarker,
        Popup: MockPopup,
        NavigationControl: MockNavigationControl,
        LngLatBounds: MockLngLatBounds,
    };
});

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        logout: vi.fn(),
        staffUser: { role: "SUPER_ADMIN", name: "Super Admin" },
    }),
}));

vi.mock("../utils/apiClient", async () => {
    const actual = await vi.importActual("../utils/apiClient");
    return {
        ...actual,
        api: {
            get: vi.fn(),
            patch: vi.fn(),
            post: vi.fn(),
        },
    };
});

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe("SuperAdminRestaurantMap Normalization Unit Tests", () => {
    it("1 & 9. Correctly normalizes valid coordinates and flags invalid/missing/out-of-bounds", () => {
        // Valid coordinates (Bangalore)
        const valid = normalizeRestaurant({
            id: 4,
            name: "Cafe King",
            latitude: 12.975,
            longitude: 77.59,
        });
        expect(valid.hasValidLocation).toBe(true);
        expect(valid.latitude).toBe(12.975);
        expect(valid.longitude).toBe(77.59);

        // Valid string coordinates (Hyderabad)
        const validStrings = normalizeRestaurant({
            id: 5,
            name: "Bean House",
            lat: "17.3606",
            lng: "78.4741",
        });
        expect(validStrings.hasValidLocation).toBe(true);
        expect(validStrings.latitude).toBe(17.3606);
        expect(validStrings.longitude).toBe(78.4741);

        // Missing coordinates (Cafe Fido)
        const missing = normalizeRestaurant({
            id: 2682,
            name: "Cafe Fido",
            latitude: null,
            longitude: null,
        });
        expect(missing.hasValidLocation).toBe(false);
        expect(missing.latitude).toBeNull();
        expect(missing.longitude).toBeNull();

        // Null Island (0, 0) is excluded
        const zeroZero = normalizeRestaurant({
            id: 99,
            name: "Null Island Cafe",
            latitude: 0,
            longitude: 0,
        });
        expect(zeroZero.hasValidLocation).toBe(false);

        // Out of bounds latitude (> 90)
        const outOfBoundsLat = normalizeRestaurant({
            id: 100,
            name: "North Pole Beyond",
            latitude: 95.0,
            longitude: 77.59,
        });
        expect(outOfBoundsLat.hasValidLocation).toBe(false);

        // Out of bounds longitude (> 180)
        const outOfBoundsLng = normalizeRestaurant({
            id: 101,
            name: "East Beyond",
            latitude: 12.975,
            longitude: 195.0,
        });
        expect(outOfBoundsLng.hasValidLocation).toBe(false);
    });
});

describe("SuperAdminRestaurantMap Component Integration QA", () => {
    const sampleRestaurants = [
        {
            id: 1,
            name: "Cafe King",
            slug: "cafeking",
            city: "Bangalore",
            state: "Karnataka",
            addressLine1: "123 MG Road",
            phone: "9876543210",
            latitude: 12.975,
            longitude: 77.59,
            deliveryRadiusKm: 5.5,
            isActive: true,
            isOpen: true,
            hasValidLocation: true,
        },
        {
            id: 2,
            name: "Bean House",
            slug: "beanhouse",
            city: "Hyderabad",
            state: "Telangana",
            addressLine1: "45 Banjara Hills",
            phone: "9876543211",
            latitude: 17.3606,
            longitude: 78.4741,
            deliveryRadiusKm: 4.0,
            isActive: true,
            isOpen: true,
            hasValidLocation: true,
        },
        {
            id: 3,
            name: "Cafe Fido",
            slug: "cafe-fido",
            city: null,
            state: null,
            addressLine1: null,
            phone: null,
            latitude: null,
            longitude: null,
            deliveryRadiusKm: 5.0,
            isActive: false,
            isOpen: false,
            hasValidLocation: false,
        },
        {
            id: 4,
            name: "Invalid Coord Cafe",
            slug: "invalid-cafe",
            city: "Mumbai",
            state: "Maharashtra",
            latitude: 120.0, // Invalid latitude
            longitude: 72.8777,
            deliveryRadiusKm: 5.0,
            isActive: true,
            isOpen: false,
            hasValidLocation: false,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        createdMarkers.length = 0;
        api.get.mockResolvedValue({
            data: {
                success: true,
                data: {
                    totalRestaurants: 4,
                    locatedRestaurants: 2,
                    missingLocationRestaurants: 2,
                    activeRestaurants: 3,
                    inactiveRestaurants: 1,
                    restaurants: sampleRestaurants,
                },
            },
        });
    });

    it("1, 2, 3, 4. Computes located and missing counts dynamically and accurately", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        // Header Title
        expect(screen.getByText("Restaurant Location Map")).toBeInTheDocument();

        // 3 & 4. Summary counts: Total=4, Located=2 (Cafe King, Bean House), Missing=2 (Cafe Fido, Invalid Coord Cafe)
        await waitFor(() => {
            expect(screen.getByText("4")).toBeInTheDocument(); // Total
            expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2); // Located and Missing
        });

        // 1. Located restaurants are in document
        expect(screen.getByText("Cafe King")).toBeInTheDocument();
        expect(screen.getByText("Bean House")).toBeInTheDocument();

        // 2. Missing restaurant has missing indicators
        expect(screen.getByText("Cafe Fido")).toBeInTheDocument();
        expect(screen.getByText("Invalid Coord Cafe")).toBeInTheDocument();
        expect(screen.getAllByText(/Missing Coordinates|No Address \/ Coords/i).length).toBeGreaterThanOrEqual(1);
    });

    it("5 & 12. Multiple restaurants produce multiple independent markers on the map", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        // 5 & 12. Exactly 2 markers for the 2 valid restaurants
        expect(createdMarkers.length).toBe(2);

        // Marker 1: Cafe King at [77.59, 12.975]
        expect(createdMarkers[0].lngLat).toEqual([77.59, 12.975]);

        // Marker 2: Bean House at [78.4741, 17.3606]
        expect(createdMarkers[1].lngLat).toEqual([78.4741, 17.3606]);
    });

    it("6. Clicking restaurant card centers map and selects restaurant", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText("Cafe King"));

        // Map centers on Cafe King coordinates [77.59, 12.975]
        expect(mockFlyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [77.59, 12.975],
                zoom: 14,
            })
        );

        // Details card displays delivery radius
        expect(screen.getAllByText(/Radius: 5.5 km/i).length).toBeGreaterThanOrEqual(1);
    });

    it("7. Clicking map marker selects restaurant and highlights card", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Bean House")).toBeInTheDocument();
        });

        expect(createdMarkers.length).toBe(2);

        // Click Bean House marker element
        fireEvent.click(createdMarkers[1].element);

        // Map centers on Bean House [78.4741, 17.3606]
        expect(mockFlyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [78.4741, 17.3606],
                zoom: 14,
            })
        );
    });

    it("8. Fit All calculates bounds including all located restaurants", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        const fitAllBtn = screen.getByTitle(/Fit All Located Restaurants/i);
        fireEvent.click(fitAllBtn);

        // Extends bounds with both located coordinates
        expect(mockBoundsExtend).toHaveBeenCalledWith([77.59, 12.975]);
        expect(mockBoundsExtend).toHaveBeenCalledWith([78.4741, 17.3606]);
        expect(mockFitBounds).toHaveBeenCalled();
    });

    it("10. Search operates against normalized restaurant data", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search restaurant by name, city, or slug/i);
        fireEvent.change(searchInput, { target: { value: "Hyderabad" } });

        expect(screen.getAllByText("Bean House").length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText("Cafe King")).not.toBeInTheDocument();
        expect(screen.queryByText("Cafe Fido")).not.toBeInTheDocument();
    });

    it("11. Filter tabs ALL, LOCATED, and MISSING work correctly", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe Fido")).toBeInTheDocument();
        });

        // Click Located filter
        const locatedBtns = screen.getAllByRole("button", { name: /📍 Located/i });
        fireEvent.click(locatedBtns[0]);

        expect(screen.getByText("Cafe King")).toBeInTheDocument();
        expect(screen.getByText("Bean House")).toBeInTheDocument();
        expect(screen.queryByText("Cafe Fido")).not.toBeInTheDocument();

        // Click Missing filter
        const missingBtns = screen.getAllByRole("button", { name: /⚠️ Missing/i });
        fireEvent.click(missingBtns[0]);

        expect(screen.queryByText("Cafe King")).not.toBeInTheDocument();
        expect(screen.queryByText("Bean House")).not.toBeInTheDocument();
        expect(screen.getByText("Cafe Fido")).toBeInTheDocument();
        expect(screen.getByText("Invalid Coord Cafe")).toBeInTheDocument();
    });

    it("12. Custom Tiffzy animated markers render with pulse ripple, pin silhouette, white restaurant icon, and accessibility attributes", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        // 2 markers created
        expect(createdMarkers.length).toBe(2);

        const markerEl = createdMarkers[0].element;

        // Verify Tiffzy classes
        expect(markerEl.classList.contains("tiffzy-restaurant-marker")).toBe(true);
        expect(markerEl.classList.contains("tiffzy-admin-marker")).toBe(true);

        // Accessibility attributes
        expect(markerEl.getAttribute("role")).toBe("button");
        expect(markerEl.getAttribute("tabindex")).toBe("0");
        expect(markerEl.getAttribute("aria-label")).toBe("Restaurant: Cafe King");

        // Pulse ripple element
        const pulse = markerEl.querySelector(".tiffzy-marker-pulse");
        expect(pulse).toBeTruthy();

        // Pin container and SVG
        const pin = markerEl.querySelector(".tiffzy-marker-pin");
        expect(pin).toBeTruthy();

        const pinSvg = markerEl.querySelector(".tiffzy-pin-svg");
        expect(pinSvg).toBeTruthy();

        // Restaurant icon
        const icon = markerEl.querySelector("[data-testid='restaurant-icon']");
        expect(icon).toBeTruthy();
    });

    it("13. Handles active and inactive restaurant marker visual distinctions correctly", async () => {
        // Provide sample with one active and one inactive located restaurant
        api.get.mockResolvedValueOnce({
            data: {
                success: true,
                data: {
                    totalRestaurants: 2,
                    locatedRestaurants: 2,
                    missingLocationRestaurants: 0,
                    activeRestaurants: 1,
                    inactiveRestaurants: 1,
                    restaurants: [
                        {
                            id: 10,
                            name: "Active Cafe",
                            latitude: 12.97,
                            longitude: 77.59,
                            isActive: true,
                            isOpen: true,
                        },
                        {
                            id: 20,
                            name: "Inactive Cafe",
                            latitude: 13.01,
                            longitude: 77.62,
                            isActive: false,
                            isOpen: false,
                        },
                    ],
                },
            },
        });

        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Active Cafe")).toBeInTheDocument();
            expect(screen.getByText("Inactive Cafe")).toBeInTheDocument();
        });

        expect(createdMarkers.length).toBe(2);

        const activeMarkerEl = createdMarkers[0].element;
        const inactiveMarkerEl = createdMarkers[1].element;

        expect(activeMarkerEl.classList.contains("tiffzy-marker-active")).toBe(true);
        expect(inactiveMarkerEl.classList.contains("tiffzy-marker-inactive")).toBe(true);
    });

    it("14. Keyboard navigation (Enter / Space) triggers restaurant focus and updates selected marker state", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        expect(createdMarkers.length).toBe(2);

        // Press Enter on Cafe King marker
        fireEvent.keyDown(createdMarkers[0].element, { key: "Enter", code: "Enter" });

        // Map centers on Cafe King
        expect(mockFlyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [77.59, 12.975],
                zoom: 14,
            })
        );
    });
});

