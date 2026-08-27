import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SuperAdminCategories from "../pages/super-admin/SuperAdminCategories";
import { api } from "../utils/apiClient";

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
            delete: vi.fn(),
            post: vi.fn(),
        },
        invalidateGetCache: vi.fn(),
    };
});

describe("SuperAdminCategories Page Interactive Audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, "confirm").mockImplementation(() => true);
    });

    it("renders categories list, pauses a category, and deletes a category cleanly", async () => {
        const mockCategories = [
            { id: 1, name: "Biryani", imageUrl: "https://example.com/biryani.jpg", priority: 100, isActive: true, itemCount: 5 },
            { id: 2, name: "Pizza", imageUrl: "https://example.com/pizza.jpg", priority: 95, isActive: true, itemCount: 3 },
        ];

        api.get.mockResolvedValue({ data: { categories: mockCategories } });
        api.patch.mockResolvedValue({ data: { message: "Category updated" } });
        api.delete.mockResolvedValue({ data: { message: "Category deleted" } });

        render(
            <MemoryRouter>
                <SuperAdminCategories />
            </MemoryRouter>
        );

        // 1. Verify Page Loads Categories
        await waitFor(() => {
            expect(screen.getByText("Biryani")).toBeInTheDocument();
            expect(screen.getByText("Pizza")).toBeInTheDocument();
        });

        // 2. Click Power Toggle (Pause) on Biryani
        const powerButtons = screen.getAllByRole("button").filter((btn) => btn.className.includes("bg-emerald-500") || btn.className.includes("bg-green-500") || btn.className.includes("bg-gray-700"));
        expect(powerButtons.length).toBeGreaterThan(0);

        fireEvent.click(powerButtons[0]);

        await waitFor(() => {
            expect(api.patch).toHaveBeenCalledWith("/super-admin/categories/1", expect.objectContaining({ isActive: false, name: "Biryani" }));
        });

        // 3. Click Delete (Trash Icon) on Biryani
        const deleteButtons = screen.getAllByRole("button").filter((btn) => btn.className.includes("bg-red-500"));
        expect(deleteButtons.length).toBeGreaterThan(0);

        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete this category?");
            expect(api.delete).toHaveBeenCalledWith(expect.stringContaining("/super-admin/categories/1"), expect.anything());
        });
    });
});
