import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Navbar from "../components/Navbar";
import Profile from "../pages/Profile";
import { LanguageProvider } from "../context/LanguageContext";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        customer: { id: "cust_123", phone: "9876543210" },
        staffToken: null,
        logout: vi.fn(),
    }),
}));

vi.mock("../context/CartContext", () => ({
    useCart: () => ({
        cart: [{ id: "item_1", name: "Dosa", quantity: 2 }],
    }),
}));

vi.mock("../context/RestaurantContext", () => ({
    useRestaurantContext: () => ({
        restaurantContext: { id: "rest_1", name: "Ghuma Ghumalu", slug: "ghuma-ghumalu" },
    }),
}));

vi.mock("../hooks/useCustomerProfile", () => ({
    default: () => ({
        profile: {
            name: "Anil Kumar",
            email: "anil@example.com",
            phone: "9876543210",
        },
        customerToken: "fake_token",
        loading: false,
        saving: false,
        error: null,
        updateProfile: vi.fn(),
        setError: vi.fn(),
    }),
}));

vi.mock("../hooks/useCachedGet", () => ({
    default: () => ({ data: null, loading: false, error: null }),
}));

describe("Customer Global Navbar Language Selector Removal and Settings Language Control", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const customerRoutes = [
        "/cart",
        "/profile/overview",
        "/profile/favorites",
        "/profile/notifications",
        "/profile/pay-later",
        "/profile/edit",
        "/profile/order-history",
        "/profile/wallet",
        "/profile/settings",
    ];

    customerRoutes.forEach((route) => {
        it(`ensures language selector does NOT appear in the navbar on ${route}`, () => {
            render(
                <MemoryRouter initialEntries={[route]}>
                    <LanguageProvider>
                        <Navbar />
                    </LanguageProvider>
                </MemoryRouter>
            );

            // Neither the compact button nor the menu item variant should be in the navbar
            expect(screen.queryByTitle(/select language/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/choose your preferred language/i)).not.toBeInTheDocument();
        });
    });

    it("renders required customer navbar elements on /cart: Logo/Name, restaurant selector, profile, and cart", () => {
        render(
            <MemoryRouter initialEntries={["/cart"]}>
                <LanguageProvider>
                    <Navbar />
                </LanguageProvider>
            </MemoryRouter>
        );

        // Logo / Name
        expect(screen.getAllByText("Tiffzy").length).toBeGreaterThan(0);
        // Restaurant selector is rendered
        expect(screen.getByRole("button", { name: /select restaurant/i })).toBeInTheDocument();
        // Profile link is rendered
        expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
        // Cart link is rendered
        expect(screen.getByRole("link", { name: /cart/i })).toBeInTheDocument();
        // Language selector must NOT be rendered
        expect(screen.queryByTitle(/select language/i)).not.toBeInTheDocument();
    });

    it("renders the language selector inside Profile -> Settings -> Language section", () => {
        render(
            <MemoryRouter initialEntries={["/profile/settings?scope=customer"]}>
                <LanguageProvider>
                    <Profile section="settings" />
                </LanguageProvider>
            </MemoryRouter>
        );

        // Language section in Settings
        expect(screen.getAllByText("Language").length).toBeGreaterThan(0);
        expect(screen.getByText("Choose your preferred language")).toBeInTheDocument();
        expect(screen.getByText(/English/i)).toBeInTheDocument();
    });

    it("opens language selection dialog from Settings, updates language, and persists to localStorage", () => {
        const { unmount } = render(
            <MemoryRouter initialEntries={["/profile/settings?scope=customer"]}>
                <LanguageProvider>
                    <Profile section="settings" />
                </LanguageProvider>
            </MemoryRouter>
        );

        const openLangBtn = screen.getByRole("button", { name: /choose your preferred language/i });
        fireEvent.click(openLangBtn);

        // Dialog should be open
        expect(screen.getByRole("heading", { name: /select language/i })).toBeInTheDocument();
        expect(screen.getByText("Telugu")).toBeInTheDocument();
        expect(screen.getByText("తెలుగు")).toBeInTheDocument();

        // Select Telugu
        fireEvent.click(screen.getByText("Telugu"));

        // Persisted to localStorage
        expect(localStorage.getItem("app_language")).toBe("te");
        unmount();

        // Simulate refresh: Render with persisted language in localStorage
        render(
            <MemoryRouter initialEntries={["/profile/settings?scope=customer"]}>
                <LanguageProvider>
                    <Profile section="settings" />
                </LanguageProvider>
            </MemoryRouter>
        );

        expect(screen.getByText(/Telugu/i)).toBeInTheDocument();
    });
});
