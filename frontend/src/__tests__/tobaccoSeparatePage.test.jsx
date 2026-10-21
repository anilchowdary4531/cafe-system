import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CustomerQrLandingPage from "../pages/customer/CustomerQrLandingPage";
import TobaccoPage from "../pages/TobaccoPage";
import { CartProvider } from "../context/CartContext";
import {
    isTobaccoItem,
    isTobaccoCategory,
    isTobaccoAgeConfirmed,
    setTobaccoAgeConfirmed,
    resetTobaccoAgeConfirmed,
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

vi.mock("socket.io-client", () => {
    return {
        default: vi.fn(() => ({
            on: vi.fn(),
            emit: vi.fn(),
            disconnect: vi.fn(),
        })),
    };
});

describe("Tobacco Separate Page & Flow Verification", () => {
    const mockSampleMenu = [
        { id: 1, name: "Margherita Pizza", category: "Pizza", price: 299, isAvailable: true },
        { id: 2, name: "Cold Coffee", category: "Coffee", price: 120, isAvailable: true },
        { id: 3, name: "Paneer Butter Masala", category: "Food", price: 250, isAvailable: true },
        { id: 4, name: "Gulab Jamun", category: "Sweet", price: 80, isAvailable: true },
        { id: 15, name: "Marlboro Advance Compact (10 pcs)", category: "Cigarettes", price: 122, isAvailable: true },
        { id: 18, name: "Classic Ice Burst (10 pcs)", category: "Cigarettes", price: 240, isAvailable: true },
        { id: 24, name: "Gold Flake Kings (Pack of 10)", category: "Cigarettes", price: 180, isAvailable: true },
    ];

    const mockResolveResponse = {
        restaurant: { id: 4, name: "Cafe King", slug: "cafeking" },
        table: { id: 1, tableNo: "T1", section: "Main Floor" },
        activeSession: { sessionId: "sess-123", status: "OPEN" },
        menu: mockSampleMenu,
        isReserved: false,
    };

    beforeEach(() => {
        resetTobaccoAgeConfirmed();
        sessionStorage.clear();
        mockGet.mockReset();
        mockPost.mockReset();
    });

    afterEach(() => {
        resetTobaccoAgeConfirmed();
        sessionStorage.clear();
    });

    // Requirement A: Tobacco does not appear as a normal product category in the main menu
    it("A. Tobacco does not appear as a normal product category chip in the main menu", async () => {
        mockGet.mockResolvedValue({ data: mockResolveResponse });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token"]}>
                <Routes>
                    <Route path="/order/table/:token" element={<CustomerQrLandingPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        // Cigarettes should NOT appear as a normal category chip in the category list
        expect(screen.queryByRole("button", { name: /^Cigarettes/i })).not.toBeInTheDocument();
        // Normal categories must be present
        expect(screen.getByText("Pizza")).toBeInTheDocument();
        expect(screen.getByText("Coffee")).toBeInTheDocument();
        expect(screen.getByText("Food")).toBeInTheDocument();
        expect(screen.getByText("Sweet")).toBeInTheDocument();

        // Separate Tobacco entry must exist
        expect(screen.getByRole("button", { name: /🚬 Tobacco/i })).toBeInTheDocument();
    });

    // Requirement B: Tobacco entry opens age verification
    it("B. Tapping Tobacco entry triggers the 18+ Age Verification Modal", async () => {
        mockGet.mockResolvedValue({ data: mockResolveResponse });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token"]}>
                <Routes>
                    <Route path="/order/table/:token" element={<CustomerQrLandingPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        const tobaccoButton = screen.getByRole("button", { name: /🚬 Tobacco/i });
        fireEvent.click(tobaccoButton);

        // Verification modal must pop up with exact required copy
        expect(screen.getByText("18+")).toBeInTheDocument();
        expect(screen.getByText("Age Verification")).toBeInTheDocument();
        expect(
            screen.getByText(/Tobacco products are available only to customers who meet the applicable legal age requirement/i)
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /I am 18 or older/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    });

    // Requirement C & J: User cannot see tobacco products before verification / Direct URL protection
    it("C & J. Direct access to Tobacco route without verification blocks items and shows Age Verification", async () => {
        expect(isTobaccoAgeConfirmed()).toBe(false);

        render(
            <MemoryRouter initialEntries={["/order/table/test-token/tobacco"]}>
                <CartProvider>
                    <Routes>
                        <Route path="/order/table/:token/tobacco" element={<TobaccoPage />} />
                    </Routes>
                </CartProvider>
            </MemoryRouter>
        );

        // Direct access must show Age Verification Required
        expect(screen.getByText("Age Verification Required")).toBeInTheDocument();
        expect(screen.getAllByText("18+").length).toBeGreaterThanOrEqual(1);

        // Items must NOT be rendered
        expect(screen.queryByText("Marlboro Advance Compact (10 pcs)")).not.toBeInTheDocument();
        expect(screen.queryByText("Classic Ice Burst (10 pcs)")).not.toBeInTheDocument();
    });

    // Requirement D & E: Eligible user can open Tobacco Products page containing ONLY tobacco products
    it("D & E. Eligible user sees ONLY tobacco products on the dedicated Tobacco page", async () => {
        setTobaccoAgeConfirmed(true);
        expect(isTobaccoAgeConfirmed()).toBe(true);

        const tobaccoItems = [
            { id: 15, name: "Marlboro Advance Compact (10 pcs)", category: "Cigarettes", price: 122 },
            { id: 18, name: "Classic Ice Burst (10 pcs)", category: "Cigarettes", price: 240 },
            { id: 24, name: "Gold Flake Kings (Pack of 10)", category: "Cigarettes", price: 180 },
        ];

        mockGet.mockResolvedValue({
            data: { items: tobaccoItems, total: 3 },
        });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token/tobacco"]}>
                <CartProvider>
                    <Routes>
                        <Route path="/order/table/:token/tobacco" element={<TobaccoPage />} />
                    </Routes>
                </CartProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Marlboro Advance Compact (10 pcs)")).toBeInTheDocument();
            expect(screen.getByText("Classic Ice Burst (10 pcs)")).toBeInTheDocument();
            expect(screen.getByText("Gold Flake Kings (Pack of 10)")).toBeInTheDocument();
        });

        // Food & beverage items must NEVER appear on tobacco page
        expect(screen.queryByText("Margherita Pizza")).not.toBeInTheDocument();
        expect(screen.queryByText("Cold Coffee")).not.toBeInTheDocument();
        expect(screen.queryByText("Paneer Butter Masala")).not.toBeInTheDocument();
    });

    // Requirement F: Tobacco search returns only tobacco products
    it("F. Dedicated tobacco search returns only matching tobacco items", async () => {
        setTobaccoAgeConfirmed(true);

        const tobaccoItems = [
            { id: 15, name: "Marlboro Advance Compact (10 pcs)", category: "Cigarettes", price: 122 },
            { id: 18, name: "Classic Ice Burst (10 pcs)", category: "Cigarettes", price: 240 },
            { id: 24, name: "Gold Flake Kings (Pack of 10)", category: "Cigarettes", price: 180 },
        ];

        mockGet.mockResolvedValue({
            data: { items: tobaccoItems, total: 3 },
        });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token/tobacco"]}>
                <CartProvider>
                    <Routes>
                        <Route path="/order/table/:token/tobacco" element={<TobaccoPage />} />
                    </Routes>
                </CartProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Gold Flake Kings (Pack of 10)")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search tobacco products/i);
        fireEvent.change(searchInput, { target: { value: "Gold" } });

        await waitFor(() => {
            // Marlboro and Classic should be filtered out from view, Gold Flake stays
            expect(screen.getByText("Gold Flake Kings (Pack of 10)")).toBeInTheDocument();
            expect(screen.queryByText("Marlboro Advance Compact (10 pcs)")).not.toBeInTheDocument();
            expect(screen.queryByText("Classic Ice Burst (10 pcs)")).not.toBeInTheDocument();
        });
    });

    // Requirement G: Food search does not accidentally return tobacco products
    it("G. Main menu search does not return tobacco items", async () => {
        mockGet.mockResolvedValue({ data: mockResolveResponse });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token"]}>
                <Routes>
                    <Route path="/order/table/:token" element={<CustomerQrLandingPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search dishes, starters, beverages.../i);
        fireEvent.change(searchInput, { target: { value: "Gold" } });

        // Tobacco item with "Gold" in name must NOT appear in normal dishes grid
        expect(screen.queryByText("Gold Flake Kings (Pack of 10)")).not.toBeInTheDocument();
        expect(screen.getByText(/No dishes found/i)).toBeInTheDocument();
    });

    // Requirement H: Add tobacco uses existing table cart
    it("H. Adding tobacco item syncs with existing table cart in sessionStorage", async () => {
        setTobaccoAgeConfirmed(true);

        const tobaccoItems = [
            { id: 18, name: "Classic Ice Burst (10 pcs)", category: "Cigarettes", price: 240 },
        ];

        mockGet.mockResolvedValue({
            data: { items: tobaccoItems, total: 1 },
        });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token/tobacco"]}>
                <CartProvider>
                    <Routes>
                        <Route path="/order/table/:token/tobacco" element={<TobaccoPage />} />
                    </Routes>
                </CartProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Classic Ice Burst (10 pcs)")).toBeInTheDocument();
        });

        const addButton = screen.getByRole("button", { name: /\+ ADD/i });
        fireEvent.click(addButton);

        // Verify cart item was saved to table sessionStorage
        const savedCart = JSON.parse(sessionStorage.getItem("tiffzy_table_cart_test-token") || "{}");
        expect(savedCart["item_18"]).toBeDefined();
        expect(savedCart["item_18"].name).toBe("Classic Ice Burst (10 pcs)");
        expect(savedCart["item_18"].qty).toBe(1);
        expect(savedCart["item_18"].price).toBe(240);

        // Header cart count must show 1
        expect(screen.getByText(/Cart \(1\)/i)).toBeInTheDocument();
    });

    // Requirement I: Back button navigates back to main menu
    it("I. Back button returns to the normal table menu", async () => {
        setTobaccoAgeConfirmed(true);
        mockGet.mockResolvedValue({ data: { items: [], total: 0 } });

        render(
            <MemoryRouter initialEntries={["/order/table/test-token/tobacco"]}>
                <CartProvider>
                    <Routes>
                        <Route path="/order/table/:token/tobacco" element={<TobaccoPage />} />
                        <Route path="/order/table/:token" element={<div>Normal Restaurant Menu Page</div>} />
                    </Routes>
                </CartProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
        });

        const backButton = screen.getByRole("button", { name: /Back/i });
        fireEvent.click(backButton);

        // Navigates back to normal restaurant menu
        expect(screen.getByText("Normal Restaurant Menu Page")).toBeInTheDocument();
    });

    // Classification tests: verify food items like "Paneer" and "Classic Cold Coffee" are NOT treated as tobacco
    it("Correctly classifies tobacco vs non-tobacco food items", () => {
        expect(isTobaccoCategory("Cigarettes")).toBe(true);
        expect(isTobaccoCategory("Tobacco")).toBe(true);
        expect(isTobaccoCategory("Food")).toBe(false);
        expect(isTobaccoCategory("Beverages")).toBe(false);
        expect(isTobaccoCategory("Pizza")).toBe(false);

        // Tobacco products
        expect(isTobaccoItem({ name: "Marlboro Advance Compact", category: "Cigarettes" })).toBe(true);
        expect(isTobaccoItem({ name: "Classic Ice Burst", category: "Cigarettes" })).toBe(true);
        expect(isTobaccoItem({ name: "Gold Flake Filter", category: "Cigarettes" })).toBe(true);

        // Non-tobacco food products must NOT match
        expect(isTobaccoItem({ name: "Paneer Butter Masala", category: "Food" })).toBe(false);
        expect(isTobaccoItem({ name: "Classic Cold Coffee", category: "Coffee" })).toBe(false);
        expect(isTobaccoItem({ name: "Classic Margherita Pizza", category: "Pizza" })).toBe(false);
        expect(isTobaccoItem({ name: "Smoked Chicken Burger", category: "Burgers" })).toBe(false);
        expect(isTobaccoItem({ name: "Pancakes with Honey", category: "Dessert" })).toBe(false);
    });
});
