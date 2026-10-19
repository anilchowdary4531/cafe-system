import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SuperAdminRestaurantMap from "../pages/super-admin/SuperAdminRestaurantMap";
import { api } from "../utils/apiClient";

// Mock maplibre-gl
const mockMapInstance = {
    addControl: vi.fn(),
    on: vi.fn((event, cb) => {
        if (event === "load") setTimeout(cb, 10);
    }),
    resize: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getSource: vi.fn(() => null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    remove: vi.fn(),
    isStyleLoaded: vi.fn(() => true),
};

const mockMarkerInstance = {
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
};

const mockPopupInstance = {
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
};

vi.mock("maplibre-gl", () => {
    function MockMap() {
        return mockMapInstance;
    }
    function MockMarker() {
        return mockMarkerInstance;
    }
    function MockPopup() {
        return mockPopupInstance;
    }
    function MockNavigationControl() {
        return {};
    }
    function MockLngLatBounds() {
        return {
            extend: vi.fn(),
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
        },
    };
});

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe("SuperAdminRestaurantMap Component", () => {
    const sampleRestaurants = [
        {
            id: 1,
            name: "Cafe King",
            slug: "cafeking",
            city: "Bengaluru",
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
            name: "Spice Garden",
            slug: "spice-garden",
            city: "Mysuru",
            state: "Karnataka",
            addressLine1: "45 Palace Road",
            phone: "9876543211",
            latitude: 12.2958,
            longitude: 76.6394,
            deliveryRadiusKm: 4.0,
            isActive: false,
            isOpen: false,
            hasValidLocation: true,
        },
        {
            id: 3,
            name: "Cloud Kitchen Ghost",
            slug: "cloud-ghost",
            city: "Bengaluru",
            state: "Karnataka",
            addressLine1: "HSR Layout",
            phone: null,
            latitude: null,
            longitude: null,
            deliveryRadiusKm: 5.0,
            isActive: true,
            isOpen: true,
            hasValidLocation: false,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({
            data: {
                success: true,
                data: {
                    totalRestaurants: 3,
                    locatedRestaurants: 2,
                    missingLocationRestaurants: 1,
                    activeRestaurants: 2,
                    inactiveRestaurants: 1,
                    restaurants: sampleRestaurants,
                },
            },
        });
    });

    it("renders restaurant map page and displays accurate summary metrics", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        // Header Title
        expect(screen.getByText("Restaurant Location Map")).toBeInTheDocument();

        // Summary Metric values
        await waitFor(() => {
            expect(screen.getByText("3")).toBeInTheDocument(); // Total
            expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // Located / Active
            expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1); // Missing / Inactive
        });

        // Restaurants list
        expect(screen.getByText("Cafe King")).toBeInTheDocument();
        expect(screen.getByText("Spice Garden")).toBeInTheDocument();
        expect(screen.getByText("Cloud Kitchen Ghost")).toBeInTheDocument();
    });

    it("filters restaurants when search query is entered", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search restaurant by name, city, or slug/i);
        fireEvent.change(searchInput, { target: { value: "Mysuru" } });

        expect(screen.getAllByText("Spice Garden").length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText("Cafe King")).not.toBeInTheDocument();
        expect(screen.queryByText("Cloud Kitchen Ghost")).not.toBeInTheDocument();
    });

    it("filters to missing location restaurants only when Missing tab is clicked", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cloud Kitchen Ghost")).toBeInTheDocument();
        });

        // Click Missing filter tab button
        const missingButtons = screen.getAllByRole("button", { name: /Missing/i });
        fireEvent.click(missingButtons[0]);

        expect(screen.getByText("Cloud Kitchen Ghost")).toBeInTheDocument();
        expect(screen.queryByText("Cafe King")).not.toBeInTheDocument();
        expect(screen.queryByText("Spice Garden")).not.toBeInTheDocument();
    });

    it("focuses restaurant and triggers flyTo on map when a restaurant row is clicked", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText("Cafe King"));

        // Verify flyTo was invoked on map with coordinates [77.59, 12.975]
        expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [77.59, 12.975],
                zoom: 14,
            })
        );

        // Verify Floating Details card appears
        expect(screen.getByText("View Restaurant Profile")).toBeInTheDocument();
        expect(screen.getAllByText(/Radius: 5.5 km/i).length).toBeGreaterThanOrEqual(1);
    });

    it("shows missing location warning on floating card when missing location restaurant is selected", async () => {
        render(
            <MemoryRouter>
                <SuperAdminRestaurantMap />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cloud Kitchen Ghost")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText("Cloud Kitchen Ghost"));

        // Warning notice
        expect(screen.getByText(/Coordinates are not set/i)).toBeInTheDocument();
    });
});
