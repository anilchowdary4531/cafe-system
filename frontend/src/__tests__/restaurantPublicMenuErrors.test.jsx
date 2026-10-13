import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RestaurantPublicMenu from "../pages/restaurant/RestaurantPublicMenu";
import * as useCachedGetModule from "../hooks/useCachedGet";

describe("RestaurantPublicMenu Error & Empty State Matrix", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithSlug = (slug = "cafeking") => {
        return render(
            <MemoryRouter initialEntries={[`/r/${slug}/menu`]}>
                <Routes>
                    <Route path="/r/:slug/menu" element={<RestaurantPublicMenu />} />
                    <Route path="/" element={<div>Home Page</div>} />
                </Routes>
            </MemoryRouter>
        );
    };

    it("1. Loading state displays 'Loading Menu...'", () => {
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: null,
            loading: true,
            error: "",
            errorStatus: null,
            refresh: vi.fn(),
        });

        renderWithSlug("cafeking");
        expect(screen.getByText("Loading Menu...")).toBeInTheDocument();
    });

    it("2. Invalid restaurant / 404 renders 'Restaurant Not Found' (NOT fake header, NOT 'All 0')", () => {
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: null,
            loading: false,
            error: "Restaurant not found",
            errorStatus: 404,
            refresh: vi.fn(),
        });

        renderWithSlug("ghumaghumalu");

        // Must show clear Restaurant Not Found
        expect(screen.getByText("Restaurant Not Found")).toBeInTheDocument();
        expect(screen.getByText("This restaurant is no longer available or the link is invalid.")).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /Back to Restaurants/i }).length).toBeGreaterThanOrEqual(1);

        // Must NOT show fake header or "All 0"
        expect(screen.queryByText("ghumaghumalu")).not.toBeInTheDocument();
        expect(screen.queryByText("All 0")).not.toBeInTheDocument();
        expect(screen.queryByText(/Try a different search term/i)).not.toBeInTheDocument();
    });

    it("3. Backend 500 error renders 'Unable to Load Menu' with Try Again button (NOT 'All 0')", () => {
        const mockRefresh = vi.fn();
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: null,
            loading: false,
            error: "Failed to fetch menu",
            errorStatus: 500,
            refresh: mockRefresh,
        });

        renderWithSlug("cafeking");

        expect(screen.getByText("Unable to Load Menu")).toBeInTheDocument();
        expect(screen.getByText("We couldn't load this restaurant's menu right now.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();

        // Must NOT show fake empty menu or "All 0"
        expect(screen.queryByText("All 0")).not.toBeInTheDocument();
        expect(screen.queryByText(/Try a different search term/i)).not.toBeInTheDocument();
    });

    it("4. Network error renders 'Connection Problem'", () => {
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: null,
            loading: false,
            error: "Network Error",
            errorStatus: 0,
            refresh: vi.fn(),
        });

        renderWithSlug("cafeking");

        expect(screen.getByText("Connection Problem")).toBeInTheDocument();
        expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
    });

    it("5. Valid restaurant with genuine 0 items renders 'No menu items available' without search hint", () => {
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: {
                restaurant: { id: 1, name: "Empty Bistro", slug: "empty-bistro" },
                menu: [],
            },
            loading: false,
            error: "",
            errorStatus: null,
            refresh: vi.fn(),
        });

        renderWithSlug("empty-bistro");

        // Shows restaurant name
        expect(screen.getByText("Empty Bistro")).toBeInTheDocument();
        // Shows genuine empty menu message
        expect(screen.getByText("No menu items available")).toBeInTheDocument();
        expect(screen.getByText("This restaurant currently has no items listed on the menu.")).toBeInTheDocument();

        // Does NOT show misleading search message
        expect(screen.queryByText(/Try a different search term/i)).not.toBeInTheDocument();
        // Does NOT show "All 0" pill
        expect(screen.queryByText("All 0")).not.toBeInTheDocument();
    });

    it("6. Valid restaurant with items renders normally", () => {
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: {
                restaurant: { id: 4, name: "Cafe King", slug: "cafeking" },
                menu: [
                    { id: 10, name: "Masala Chai", category: "Beverages", price: 30, isAvailable: true },
                    { id: 11, name: "Veg Puff", category: "Snacks", price: 25, isAvailable: true },
                ],
            },
            loading: false,
            error: "",
            errorStatus: null,
            refresh: vi.fn(),
        });

        renderWithSlug("cafeking");

        expect(screen.getByText("Cafe King")).toBeInTheDocument();
        expect(screen.getByText("Masala Chai")).toBeInTheDocument();
        expect(screen.getByText("Veg Puff")).toBeInTheDocument();
    });

    it("7. Search with no matches shows 'No items found' and 'Try a different search term...'", () => {
        vi.spyOn(useCachedGetModule, "default").mockReturnValue({
            data: {
                restaurant: { id: 4, name: "Cafe King", slug: "cafeking" },
                menu: [
                    { id: 10, name: "Masala Chai", category: "Beverages", price: 30, isAvailable: true },
                ],
            },
            loading: false,
            error: "",
            errorStatus: null,
            refresh: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={["/r/cafeking/menu?search=NonExistentPizza"]}>
                <Routes>
                    <Route path="/r/:slug/menu" element={<RestaurantPublicMenu />} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText("No items found")).toBeInTheDocument();
        expect(screen.getByText(/Try a different search term or clear the search to browse the full menu/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Clear search/i })).toBeInTheDocument();
    });
});
