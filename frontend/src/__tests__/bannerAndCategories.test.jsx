import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import PromoBannerSlider from "../components/PromoBannerSlider";
import PopularCategories, { getCategoryIcon } from "../components/PopularCategories";

vi.mock("../utils/apiClient", async () => {
    const actual = await vi.importActual("../utils/apiClient");
    return {
        ...actual,
        api: {
            get: vi.fn().mockResolvedValue({ data: [] }),
            post: vi.fn().mockResolvedValue({ data: {} }),
        },
        cachedGet: vi.fn().mockResolvedValue([]),
    };
});

describe("PromoBannerSlider & PopularCategories Audit", () => {
    it("renders fallback PromoBannerSlider when banners list is empty", () => {
        render(
            <MemoryRouter>
                <PromoBannerSlider />
            </MemoryRouter>
        );
        expect(screen.getByText(/Tasty Food Delivered Fast/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Order Now/i })).toBeInTheDocument();
    });

    it("correctly maps category names to icons", () => {
        expect(getCategoryIcon("Pizza")).toBeDefined();
        expect(getCategoryIcon("Coffee")).toBeDefined();
        expect(getCategoryIcon("Desserts")).toBeDefined();
        expect(getCategoryIcon("Biryani")).toBeDefined();
    });

    it("renders PopularCategories with fallback options and triggers selection callback", () => {
        const handleSelect = vi.fn();
        render(
            <MemoryRouter>
                <PopularCategories
                    items={[{ id: 1, category: "Chinese" }]}
                    selectedCategory=""
                    onSelectCategory={handleSelect}
                />
            </MemoryRouter>
        );

        expect(screen.getByText(/Popular Categories/i)).toBeInTheDocument();
        expect(screen.getAllByText(/All/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Biryani/i)).toBeInTheDocument();
        expect(screen.getByText(/Pizza/i)).toBeInTheDocument();
        expect(screen.getByText(/Chinese/i)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Pizza/i));
        expect(handleSelect).toHaveBeenCalledWith("Pizza");
    });
});
