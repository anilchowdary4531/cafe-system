import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCustomerFavorites, setCustomerFavorites, toggleFavoriteMenuItem } from "../utils/customerFavorites";
import { MenuItemCard } from "../pages/restaurant/RestaurantMenu";
import RestaurantChooser from "../pages/RestaurantChooser";
import { MemoryRouter } from "react-router-dom";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        customer: { id: "cust_123", phone: "9876543210" },
    }),
}));

vi.mock("../context/CartContext", () => ({
    useCart: () => ({
        cart: [],
        addToCart: vi.fn(),
        removeFromCart: vi.fn(),
        total: 0,
    }),
}));

vi.mock("../context/RestaurantContext", () => ({
    useRestaurantContext: () => ({
        restaurantContext: { vegOnly: false },
        setRestaurantContext: vi.fn(),
    }),
}));

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        if (url === "/restaurants") {
            return {
                data: {
                    restaurants: [
                        { id: 1, name: "Burger King", slug: "burger-king" },
                    ],
                },
                loading: false,
                error: null,
            };
        }
        if (url === "/catalog/search") {
            return {
                data: {
                    items: [
                        {
                            id: 101,
                            name: "Super Burger",
                            description: "Crispy grilled burger with fresh vegetables, special sauce and cheese.",
                            category: "Burgers",
                            price: 250,
                            image: "/images/super-burger.jpg",
                            restaurant: { id: 1, name: "Burger King", slug: "burger-king" },
                        },
                        {
                            id: 102,
                            name: "Crispy Fries",
                            description: "",
                            category: "Sides",
                            price: 120,
                            image: "/images/fries.jpg",
                            restaurant: { id: 1, name: "Burger King", slug: "burger-king" },
                        },
                    ],
                },
                loading: false,
                error: null,
            };
        }
        return { data: null, loading: false, error: null };
    },
}));

vi.mock("../utils/apiClient", () => ({
    api: { get: vi.fn().mockResolvedValue({ data: { ok: true } }) },
    cachedGet: vi.fn(),
}));

describe("Food Item Card Favorite Button", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("toggles favorite state in customerFavorites storage utility", () => {
        const item = { id: 101, name: "Super Burger", price: 250, image: "/burger.png" };
        const { added } = toggleFavoriteMenuItem({
            restaurantSlug: "burger-king",
            restaurantName: "Burger King",
            item,
        });

        expect(added).toBe(true);
        const stored = getCustomerFavorites();
        expect(stored).toHaveLength(1);
        expect(stored[0].key).toBe("burger-king:101");
        expect(stored[0].itemName).toBe("Super Burger");

        const { next, removed } = toggleFavoriteMenuItem({
            restaurantSlug: "burger-king",
            restaurantName: "Burger King",
            item,
        });
        expect(removed).toBe(true);
        expect(next).toHaveLength(0);
    });

    it("renders favorite heart button on MenuItemCard and prevents card click propagation", () => {
        const item = { id: 202, name: "Paneer Tikka", price: 320, image: "/tikka.png" };
        const onToggleFavorite = vi.fn();
        const onAdd = vi.fn();

        const { rerender } = render(
            <MenuItemCard
                item={item}
                isFavorite={false}
                onToggleFavorite={onToggleFavorite}
                onAdd={onAdd}
            />
        );

        const favBtn = screen.getByRole("button", { name: "Add to favorites" });
        expect(favBtn).toBeInTheDocument();
        expect(favBtn).toHaveAttribute("title", "Add to favorites");

        // Click the favorite button
        fireEvent.click(favBtn);
        expect(onToggleFavorite).toHaveBeenCalledWith(item);
        // Ensure onAdd was not triggered
        expect(onAdd).not.toHaveBeenCalled();

        // Rerender as favorited
        rerender(
            <MenuItemCard
                item={item}
                isFavorite={true}
                onToggleFavorite={onToggleFavorite}
                onAdd={onAdd}
            />
        );

        const favoritedBtn = screen.getByRole("button", { name: "Remove from favorites" });
        expect(favoritedBtn).toBeInTheDocument();
        expect(favoritedBtn).toHaveAttribute("title", "Remove from favorites");
    });

    it("renders food items on RestaurantChooser with favorite heart button in top-right of image", async () => {
        render(
            <MemoryRouter initialEntries={["/"]}>
                <RestaurantChooser />
            </MemoryRouter>
        );

        // Find the favorite buttons
        const favButtons = await screen.findAllByRole("button", { name: "Add to favorites" });
        expect(favButtons.length).toBeGreaterThanOrEqual(1);
        expect(favButtons[0]).toHaveAttribute("title", "Add to favorites");

        // Verify description is displayed for items with description
        expect(
            screen.getByText("Crispy grilled burger with fresh vegetables, special sauce and cheese.")
        ).toBeInTheDocument();

        // Verify fallback for items without description
        expect(screen.getByText("No description available")).toBeInTheDocument();

        // Clicking favorite should toggle without adding to cart
        fireEvent.click(favButtons[0]);

        const stored = getCustomerFavorites();
        expect(stored).toHaveLength(1);
        expect(stored[0].itemName).toBe("Super Burger");
        expect(stored[0].key).toBe("burger-king:101");
    });

    it("correctly resolves item-specific image, falls back when missing, and handles error", () => {
        const itemWithImage = { id: 1, name: "Burger", image: "https://images.unsplash.com/photo-burger" };
        const itemWithImageUrl = { id: 2, name: "Pizza", imageUrl: "https://images.unsplash.com/photo-pizza" };
        const itemNoImage = { id: 3, name: "Soda", image: null };

        const { rerender } = render(<MenuItemCard item={itemWithImage} />);
        const img1 = screen.getByRole("img", { name: "Burger" });
        expect(img1.src).toBe("https://images.unsplash.com/photo-burger");

        rerender(<MenuItemCard item={itemWithImageUrl} />);
        const img2 = screen.getByRole("img", { name: "Pizza" });
        expect(img2.src).toBe("https://images.unsplash.com/photo-pizza");

        rerender(<MenuItemCard item={itemNoImage} />);
        const img3 = screen.getByRole("img", { name: "Soda" });
        expect(img3.src).toContain("photo-1546069901-ba9599a7e63c");

        // Simulate image load error triggering onError
        fireEvent.error(img2);
        expect(img2.src).toContain("photo-1546069901-ba9599a7e63c");
    });
});
