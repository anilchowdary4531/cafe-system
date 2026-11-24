import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RestaurantChooser from "../pages/RestaurantChooser";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import {
    isTobaccoText,
    isTobaccoItem,
    isTobaccoCategory,
    isTobaccoAgeConfirmed,
    setTobaccoAgeConfirmed,
    resetTobaccoAgeConfirmed,
    DEFAULT_TOBACCO_ITEMS,
    TOBACCO_QUICK_TAGS,
} from "../utils/tobaccoUtils";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("axios", () => {
    const instance = {
        get: (...args) => mockGet(...args),
        post: (...args) => mockPost(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    return {
        default: {
            ...instance,
            create: () => instance,
        },
        get: (...args) => mockGet(...args),
        post: (...args) => mockPost(...args),
    };
});

vi.mock("../utils/apiClient", () => ({
    api: {
        get: (...args) => mockGet(...args),
        post: (...args) => mockPost(...args),
    },
    cachedGet: (...args) => mockGet(...args),
}));

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        if (url === "/restaurants") {
            return {
                data: [
                    { id: 1, name: "Cafe King", slug: "cafe-king", city: "Bangalore", isActive: true },
                ],
                loading: false,
                error: null,
                refresh: vi.fn(),
            };
        }
        if (url === "/catalog/search") {
            return {
                data: {
                    items: [
                        { id: 101, name: "Margherita Pizza", category: "Pizza", price: 299 },
                        { id: 102, name: "Cold Coffee", category: "Coffee", price: 120 },
                        { id: 103, name: "Classic Cold Coffee", category: "Coffee", price: 150 },
                        { id: 104, name: "Classic Margherita Pizza", category: "Pizza", price: 349 },
                    ],
                },
                loading: false,
                error: null,
                refresh: vi.fn(),
            };
        }
        if (url === "/global-categories") {
            return {
                data: [
                    { id: 1, name: "Pizza", isActive: true },
                    { id: 2, name: "Coffee", isActive: true },
                ],
                loading: false,
                error: null,
            };
        }
        return { data: null, loading: false, error: null };
    },
}));

vi.mock("socket.io-client", () => ({
    default: vi.fn(() => ({
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
    })),
}));

describe("Tobacco Banner Search Detection Unit Tests", () => {
    describe("1. Tobacco-related search queries (MUST return true)", () => {
        const requiredQueries = [
            "tobacco",
            "cigarette",
            "cigarettes",
            "ciggarette",
            "ciggarettes",
            "cig",
            "cigs",
            "Gold Flake",
            "goldflake",
            "Marlboro",
            "Advance",
            "advance compact",
            "Classic",
            "Classic Connect",
            "Classic Ice Burst",
            "Classic Double Burst",
            "Marlboro Advance",
            "Marlboro Gold Advance",
            "Gold Flake King's Blue (Lights)",
            "Gold Flake Indie Mint",
            "Gold Flake Filter",
            "Paan corner cigarette",
            "Paan corner",
            "bidi",
            "bidis",
            "vape",
            "hookah",
        ];

        requiredQueries.forEach((query) => {
            it(`detects "${query}" as tobacco-related`, () => {
                expect(isTobaccoText(query)).toBe(true);
            });
        });
    });

    describe("2. Case-insensitivity & whitespace normalization", () => {
        const variations = [
            { raw: "   tobacco   ", expected: true },
            { raw: "  marlboro  ", expected: true },
            { raw: "  classic  ", expected: true },
            { raw: "  cig  ", expected: true },
            { raw: "  advance  ", expected: true },
            { raw: "CIGARETTE", expected: true },
            { raw: "CIGS", expected: true },
            { raw: "GOLD FLAKE", expected: true },
            { raw: "MARLBORO", expected: true },
            { raw: "ADVANCE", expected: true },
            { raw: "CLASSIC", expected: true },
            { raw: "GoLd FlAkE", expected: true },
            { raw: "  Classic Connect  ", expected: true },
        ];

        variations.forEach(({ raw, expected }) => {
            it(`normalizes "${raw}" correctly -> ${expected}`, () => {
                expect(isTobaccoText(raw)).toBe(expected);
            });
        });
    });

    describe("3. Unrelated food searches & edge cases (MUST return false)", () => {
        const nonTobaccoQueries = [
            "pizza",
            "coffee",
            "Classic Cold Coffee",
            "Classic Margherita Pizza",
            "Classic Burger",
            "Classic French Fries",
            "Classic Sandwich",
            "Classic Pasta",
            "Cold Coffee",
            "Margherita Pizza",
            "burger",
            "biryani",
            "paneer",
            "chicken",
            "dal",
            "tea",
            "dessert",
            "ice cream",
            "",
            "   ",
            "a",
            "x",
        ];

        nonTobaccoQueries.forEach((query) => {
            it(`correctly rejects non-tobacco query "${query}"`, () => {
                expect(isTobaccoText(query)).toBe(false);
            });
        });
    });

    describe("4. Item and category classification safety", () => {
        it("classifies tobacco items vs food items with 'Classic' in name", () => {
            // Tobacco items
            expect(isTobaccoItem({ name: "Marlboro Advance Compact", category: "Cigarettes" })).toBe(true);
            expect(isTobaccoItem({ name: "Classic Ice Burst", category: "Cigarettes" })).toBe(true);
            expect(isTobaccoItem({ name: "Classic Connect", category: "Cigarettes" })).toBe(true);
            expect(isTobaccoItem({ name: "Gold Flake Filter", category: "Cigarettes" })).toBe(true);

            // Food items with "Classic" in name must NOT be treated as tobacco
            expect(isTobaccoItem({ name: "Classic Cold Coffee", category: "Coffee" })).toBe(false);
            expect(isTobaccoItem({ name: "Classic Margherita Pizza", category: "Pizza" })).toBe(false);
            expect(isTobaccoItem({ name: "Classic Burger", category: "Burgers" })).toBe(false);
        });

        it("classifies tobacco categories vs food categories", () => {
            expect(isTobaccoCategory("Cigarettes")).toBe(true);
            expect(isTobaccoCategory("Tobacco")).toBe(true);
            expect(isTobaccoCategory("Paan corner")).toBe(true);
            expect(isTobaccoCategory("Coffee")).toBe(false);
            expect(isTobaccoCategory("Pizza")).toBe(false);
            expect(isTobaccoCategory("Food")).toBe(false);
            expect(isTobaccoCategory("Beverages")).toBe(false);
        });
    });
});

describe("Tobacco Banner Integration in RestaurantChooser UI", () => {
    beforeEach(() => {
        resetTobaccoAgeConfirmed();
        sessionStorage.clear();
        mockGet.mockResolvedValue({ status: "ok" });
    });

    afterEach(() => {
        resetTobaccoAgeConfirmed();
        sessionStorage.clear();
    });

    const renderChooser = () => {
        return render(
            <MemoryRouter initialEntries={["/"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CartProvider>
                            <Routes>
                                <Route path="/" element={<RestaurantChooser />} />
                                <Route path="/tobacco" element={<div>Dedicated Tobacco Page</div>} />
                            </Routes>
                        </CartProvider>
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );
    };

    it("displays tobacco banner and quick tags when customer searches 'tobacco'", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);
        fireEvent.change(searchInput, { target: { value: "tobacco" } });

        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /View items/i })).toBeInTheDocument();
            expect(screen.getByText(/Caution: Tobacco products are injurious to health/i)).toBeInTheDocument();
        });

        // Quick tags are shown
        expect(screen.getByText("Gold flake cigarette")).toBeInTheDocument();
        expect(screen.getByText("Marlboro cigarette")).toBeInTheDocument();
        expect(screen.getByText("Advance cigarette")).toBeInTheDocument();
    });

    it("displays tobacco banner when customer searches 'cigarette' or 'cig'", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);

        // Search "cigarette"
        fireEvent.change(searchInput, { target: { value: "cigarette" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });

        // Search "cig"
        fireEvent.change(searchInput, { target: { value: "cig" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });

        // Search "cigs"
        fireEvent.change(searchInput, { target: { value: "cigs" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });
    });

    it("displays tobacco banner when customer searches 'Gold Flake' or 'Marlboro'", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);

        // Search "Gold Flake"
        fireEvent.change(searchInput, { target: { value: "Gold Flake" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });

        // Search "Marlboro"
        fireEvent.change(searchInput, { target: { value: "Marlboro" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });
    });

    it("displays tobacco banner when customer searches 'Advance' or 'Classic'", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);

        // Search "Advance"
        fireEvent.change(searchInput, { target: { value: "Advance" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });

        // Search "Classic"
        fireEvent.change(searchInput, { target: { value: "Classic" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });
    });

    it("does NOT display tobacco banner for food searches ('pizza', 'coffee', 'Classic Cold Coffee', 'Classic Margherita Pizza')", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);

        // Search "pizza"
        fireEvent.change(searchInput, { target: { value: "pizza" } });
        expect(screen.queryByText("Looking for tobacco products?")).not.toBeInTheDocument();

        // Search "coffee"
        fireEvent.change(searchInput, { target: { value: "coffee" } });
        expect(screen.queryByText("Looking for tobacco products?")).not.toBeInTheDocument();

        // Search "Classic Cold Coffee"
        fireEvent.change(searchInput, { target: { value: "Classic Cold Coffee" } });
        expect(screen.queryByText("Looking for tobacco products?")).not.toBeInTheDocument();

        // Search "Classic Margherita Pizza"
        fireEvent.change(searchInput, { target: { value: "Classic Margherita Pizza" } });
        expect(screen.queryByText("Looking for tobacco products?")).not.toBeInTheDocument();
    });

    it("hides tobacco banner immediately when search is cleared", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);

        // Type tobacco query
        fireEvent.change(searchInput, { target: { value: "Marlboro" } });
        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });

        // Clear query
        fireEvent.change(searchInput, { target: { value: "" } });
        await waitFor(() => {
            expect(screen.queryByText("Looking for tobacco products?")).not.toBeInTheDocument();
        });
    });

    it("clicking 'View items' prompts age verification when not confirmed, then navigates to /tobacco", async () => {
        renderChooser();

        const searchInput = screen.getByPlaceholderText(/Search dishes across restaurants.../i);
        fireEvent.change(searchInput, { target: { value: "cig" } });

        await waitFor(() => {
            expect(screen.getByText("Looking for tobacco products?")).toBeInTheDocument();
        });

        const viewItemsBtn = screen.getByRole("button", { name: /View items/i });
        fireEvent.click(viewItemsBtn);

        // 18+ Age verification modal must appear
        await waitFor(() => {
            expect(screen.getByText("Age Verification")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /I am 18 or older/i })).toBeInTheDocument();
        });

        // Click "I am 18 or older"
        const confirmBtn = screen.getByRole("button", { name: /I am 18 or older/i });
        fireEvent.click(confirmBtn);

        // Navigates to /tobacco
        await waitFor(() => {
            expect(screen.getByText("Dedicated Tobacco Page")).toBeInTheDocument();
        });
    });
});
