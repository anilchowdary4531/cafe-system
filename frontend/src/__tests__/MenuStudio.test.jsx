import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MenuStudio from "../pages/admin/MenuStudio";
import { api } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn().mockResolvedValue([]),
    },
    invalidateGetCache: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { restaurantId: 1 },
    }),
}));

const sampleMenuItems = [
    { id: 1, name: "Cold Coffee", category: "Coffee", price: 120, isAvailable: true },
    { id: 2, name: "Classic Cold Coffee", category: "Coffee", price: 150, isAvailable: true },
    { id: 3, name: "Dal Khichdi", category: "Food", price: 180, isAvailable: true },
    { id: 4, name: "Gobi Manchurian", category: "Food", price: 210, isAvailable: true },
    { id: 5, name: "Gulab Jamun", category: "Sweet", price: 80, isAvailable: true },
    { id: 6, name: "Marlboro Advance Compact", category: "Cigarettes", price: 122, isTobacco: true, isAvailable: true },
    { id: 7, name: "Classic Connect", category: "Cigarettes", price: 390, isTobacco: true, isAvailable: true },
    { id: 8, name: "Gold Flake Filter", category: "Cigarettes", price: 127, isAvailable: true },
];

describe("MenuStudio Dual Form & Tobacco Category Toggle", () => {
    beforeEach(() => {
        localStorage.setItem("user", JSON.stringify({ restaurantId: 1 }));
        api.get.mockImplementation((url) => {
            if (url.includes("/menu")) {
                return Promise.resolve(sampleMenuItems);
            }
            if (url.includes("/settings")) {
                return Promise.resolve({ restaurant: { id: 1, tobaccoApproved: true } });
            }
            return Promise.resolve([]);
        });
    });

    const renderMenuStudio = () =>
        render(
            <MemoryRouter>
                <MenuStudio />
            </MemoryRouter>
        );

    it("renders both '+ Add Item' and '+ Add Tobacco Item' buttons", async () => {
        renderMenuStudio();

        expect(screen.getByText(/\+ Add Item/i)).toBeInTheDocument();
        expect(screen.getByText(/\+ Add Tobacco Item/i)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
        });
    });

    it("opens normal form when '+ Add Item' is clicked", async () => {
        renderMenuStudio();
        await waitFor(() => expect(screen.getByText("Cold Coffee")).toBeInTheDocument());

        fireEvent.click(screen.getByText(/\+ Add Item/i));
        expect(screen.getByText(/Add Normal Menu Item/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Category (e.g. Coffee, Food, Sweets)")).toBeInTheDocument();
    });

    it("opens dedicated Tobacco form when '+ Add Tobacco Item' is clicked", async () => {
        renderMenuStudio();
        await waitFor(() => expect(screen.getByText("Cold Coffee")).toBeInTheDocument());

        fireEvent.click(screen.getByText(/\+ Add Tobacco Item/i));
        expect(screen.getByText(/Statutory Tobacco Product Registry/i)).toBeInTheDocument();
        expect(screen.getByText(/Flag Mandatory 18\+ Age Check at POS \/ Waiter Terminal/i)).toBeInTheDocument();
    });

    it("hides tobacco products on initial load while keeping the Tobacco button visible", async () => {
        renderMenuStudio();

        await waitFor(() => {
            expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
        });

        // Normal categories & products are visible
        expect(screen.getByRole("button", { name: /Coffee \(2\)/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Food \(2\)/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sweet \(1\)/i })).toBeInTheDocument();
        expect(screen.getByText("Classic Cold Coffee")).toBeInTheDocument();
        expect(screen.getByText("Dal Khichdi")).toBeInTheDocument();
        expect(screen.getByText("Gulab Jamun")).toBeInTheDocument();

        // Tobacco button is visible and inactive
        const tobaccoBtn = screen.getByRole("button", { name: /Tobacco \(3\)/i });
        expect(tobaccoBtn).toBeInTheDocument();
        expect(tobaccoBtn).toHaveAttribute("aria-pressed", "false");

        // Tobacco products are hidden
        expect(screen.queryByText("Marlboro Advance Compact")).not.toBeInTheDocument();
        expect(screen.queryByText("Classic Connect")).not.toBeInTheDocument();
        expect(screen.queryByText("Gold Flake Filter")).not.toBeInTheDocument();
    });

    it("displays tobacco products when Tobacco is clicked and hides them when clicked again", async () => {
        renderMenuStudio();
        await waitFor(() => expect(screen.getByText("Cold Coffee")).toBeInTheDocument());

        const tobaccoBtn = screen.getByRole("button", { name: /Tobacco \(3\)/i });

        // Click Tobacco -> show only tobacco products
        fireEvent.click(tobaccoBtn);
        expect(tobaccoBtn).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Marlboro Advance Compact")).toBeInTheDocument();
        expect(screen.getByText("Classic Connect")).toBeInTheDocument();
        expect(screen.getByText("Gold Flake Filter")).toBeInTheDocument();
        expect(screen.queryByText("Cold Coffee")).not.toBeInTheDocument();
        expect(screen.queryByText("Dal Khichdi")).not.toBeInTheDocument();

        // Click Tobacco again -> hide tobacco products and return to normal menu
        fireEvent.click(tobaccoBtn);
        expect(tobaccoBtn).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByText("Marlboro Advance Compact")).not.toBeInTheDocument();
        expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
        expect(screen.getByText("Dal Khichdi")).toBeInTheDocument();
    });

    it("filters by normal categories (Coffee, Food) without showing tobacco products and switches cleanly", async () => {
        renderMenuStudio();
        await waitFor(() => expect(screen.getByText("Cold Coffee")).toBeInTheDocument());

        const coffeeBtn = screen.getByRole("button", { name: /Coffee \(2\)/i });
        const foodBtn = screen.getByRole("button", { name: /Food \(2\)/i });
        const tobaccoBtn = screen.getByRole("button", { name: /Tobacco \(3\)/i });

        // Select Coffee
        fireEvent.click(coffeeBtn);
        expect(coffeeBtn).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
        expect(screen.getByText("Classic Cold Coffee")).toBeInTheDocument();
        expect(screen.queryByText("Dal Khichdi")).not.toBeInTheDocument();
        expect(screen.queryByText("Marlboro Advance Compact")).not.toBeInTheDocument();

        // Select Food
        fireEvent.click(foodBtn);
        expect(foodBtn).toHaveAttribute("aria-pressed", "true");
        expect(coffeeBtn).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByText("Dal Khichdi")).toBeInTheDocument();
        expect(screen.getByText("Gobi Manchurian")).toBeInTheDocument();
        expect(screen.queryByText("Cold Coffee")).not.toBeInTheDocument();
        expect(screen.queryByText("Marlboro Advance Compact")).not.toBeInTheDocument();

        // Switch from Food -> Tobacco -> Coffee
        fireEvent.click(tobaccoBtn);
        expect(tobaccoBtn).toHaveAttribute("aria-pressed", "true");
        expect(foodBtn).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByText("Marlboro Advance Compact")).toBeInTheDocument();
        expect(screen.queryByText("Dal Khichdi")).not.toBeInTheDocument();

        fireEvent.click(coffeeBtn);
        expect(tobaccoBtn).toHaveAttribute("aria-pressed", "false");
        expect(coffeeBtn).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
        expect(screen.queryByText("Marlboro Advance Compact")).not.toBeInTheDocument();
    });

    it("excludes tobacco products from search unless Tobacco filter is active", async () => {
        renderMenuStudio();
        await waitFor(() => expect(screen.getByText("Cold Coffee")).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText("Search menu items...");

        // Search "Marlboro" with Tobacco inactive -> must NOT show tobacco product
        fireEvent.change(searchInput, { target: { value: "Marlboro" } });
        expect(screen.queryByText("Marlboro Advance Compact")).not.toBeInTheDocument();
        expect(screen.getByText(/No items match your search/i)).toBeInTheDocument();

        // Tobacco toggle button remains visible
        const tobaccoBtn = screen.getByRole("button", { name: /Tobacco \(3\)/i });
        expect(tobaccoBtn).toBeInTheDocument();

        // Activate Tobacco filter -> matching tobacco product appears
        fireEvent.click(tobaccoBtn);
        expect(screen.getByText("Marlboro Advance Compact")).toBeInTheDocument();
        expect(screen.queryByText("Classic Connect")).not.toBeInTheDocument();
    });
});
