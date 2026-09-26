import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MenuStudio from "../pages/admin/MenuStudio";

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

describe("MenuStudio Dual Form & Tobacco Button", () => {
    it("renders both '+ Add Item' and '+ Add Tobacco Item' buttons", () => {
        localStorage.setItem("user", JSON.stringify({ restaurantId: 1 }));
        render(
            <MemoryRouter>
                <MenuStudio />
            </MemoryRouter>
        );

        expect(screen.getByText(/\+ Add Item/i)).toBeInTheDocument();
        expect(screen.getByText(/\+ Add Tobacco Item/i)).toBeInTheDocument();
    });

    it("opens normal form when '+ Add Item' is clicked", () => {
        localStorage.setItem("user", JSON.stringify({ restaurantId: 1 }));
        render(
            <MemoryRouter>
                <MenuStudio />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText(/\+ Add Item/i));
        expect(screen.getByText(/Add Normal Menu Item/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Category (e.g. Coffee, Food, Sweets)")).toBeInTheDocument();
    });

    it("opens dedicated Tobacco form when '+ Add Tobacco Item' is clicked", () => {
        localStorage.setItem("user", JSON.stringify({ restaurantId: 1 }));
        render(
            <MemoryRouter>
                <MenuStudio />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText(/\+ Add Tobacco Item/i));
        expect(screen.getByText(/Statutory Tobacco Product Registry/i)).toBeInTheDocument();
        expect(screen.getByText(/Flag Mandatory 18\+ Age Check at POS \/ Waiter Terminal/i)).toBeInTheDocument();
    });
});
