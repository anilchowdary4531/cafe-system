import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import App from "../App.jsx";
import Landing from "../pages/Landing.jsx";
import RestaurantChooser from "../pages/RestaurantChooser.jsx";
import Login from "../pages/Login.jsx";
import SuperAdminDashboard from "../pages/super-admin/SuperAdminDashboard.jsx";
import SuperAdminUsers from "../pages/super-admin/SuperAdminUsers.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

// Mock fetch / axios so API calls resolve safely in JSDOM
vi.mock("../utils/apiClient", async () => {
    const actual = await vi.importActual("../utils/apiClient");
    return {
        ...actual,
        api: {
            get: vi.fn().mockResolvedValue({ data: [] }),
            post: vi.fn().mockResolvedValue({ data: {} }),
            delete: vi.fn().mockResolvedValue({ data: {} }),
        },
        cachedGet: vi.fn().mockResolvedValue([]),
    };
});

describe("Real Component Render Audit", () => {
    it("renders Landing without crashing", () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/"]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <Landing />
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );
        expect(container.innerHTML).not.toBe("");
    });

    it("renders App at root without crashing", () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/"]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <App />
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );
        expect(container.innerHTML).not.toBe("");
    });

    it("renders Login at /login without crashing", () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/login"]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <App />
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );
        expect(container.innerHTML).not.toBe("");
    });

    it("renders SuperAdminUsers at /super-admin/users without crashing", () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/super-admin/users"]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <App />
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );
        expect(container.innerHTML).not.toBe("");
    });
});
