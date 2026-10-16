import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Login from "../pages/Login.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { isTableOrMenuPath } from "../utils/orderFlow.js";

// Mock api client
vi.mock("../utils/apiClient", async () => {
    const actual = await vi.importActual("../utils/apiClient");
    return {
        ...actual,
        api: {
            get: vi.fn().mockResolvedValue({ data: [] }),
            post: vi.fn().mockImplementation((url, body) => {
                if (url === "/customer/send-otp") {
                    return Promise.resolve({
                        data: {
                            success: true,
                            expiresAt: Date.now() + 60000,
                            phone: body?.phone || "9999999999",
                            devOtp: "123456",
                        },
                    });
                }
                if (url === "/customer/verify-otp") {
                    return Promise.resolve({
                        data: {
                            token: "test_jwt_customer_token",
                            customer: {
                                id: "cust_123",
                                name: "Test User",
                                phone: body?.phone || "9999999999",
                            },
                        },
                    });
                }
                return Promise.resolve({ data: {} });
            }),
            delete: vi.fn().mockResolvedValue({ data: {} }),
        },
        cachedGet: vi.fn().mockResolvedValue([]),
    };
});

function LocationDisplay() {
    const location = useLocation();
    return (
        <div data-testid="current-location">
            {location.pathname}{location.search}
        </div>
    );
}

function TestApp({ initialEntries = ["/login?mode=customer"] }) {
    return (
        <MemoryRouter initialEntries={initialEntries}>
            <AuthProvider>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <LocationDisplay />
                                <Routes>
                                    <Route path="/" element={<div data-testid="home-page">Tiffzy Home Page</div>} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/m/:slug/:table?" element={<div data-testid="table-menu-page">Table Menu</div>} />
                                    <Route path="/cart" element={<div data-testid="cart-page">Cart Page</div>} />
                                    <Route path="/profile/wallet" element={<div data-testid="wallet-page">Wallet Page</div>} />
                                </Routes>
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </AuthProvider>
        </MemoryRouter>
    );
}

async function performCustomerOtpLogin() {
    const phoneInput = screen.getByPlaceholderText(/Enter phone number or email address/i);
    fireEvent.change(phoneInput, { target: { value: "9999999999" } });

    const sendBtn = screen.getByRole("button", { name: /Send OTP/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter 6-digit OTP/i)).toBeInTheDocument();
    });

    const otpInput = screen.getByPlaceholderText(/Enter 6-digit OTP/i);
    fireEvent.change(otpInput, { target: { value: "123456" } });

    const verifyBtn = screen.getByRole("button", { name: /Verify & Continue/i });
    fireEvent.click(verifyBtn);
}

describe("Customer Login Redirect - Verification of 7 Test Cases", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    it("TEST 1 — Normal customer login navigates directly to Home ('/'), NOT to a table route", async () => {
        render(<TestApp initialEntries={["/login?mode=customer"]} />);

        await performCustomerOtpLogin();

        await waitFor(() => {
            expect(screen.getByTestId("home-page")).toBeInTheDocument();
        });

        const loc = screen.getByTestId("current-location").textContent;
        expect(loc).toBe("/");
        expect(loc).not.toContain("/m/");
        expect(loc).not.toContain("cafeking");
    });

    it("TEST 2 — Login after previously visiting a table navigates to Home, NOT back to Cafe King table 1", async () => {
        // Setup: Previous visit to Cafe King Table 1 stored in localStorage
        localStorage.setItem("cafe_system:order_flow_scope:v1", "table");
        localStorage.setItem(
            "cafe_system:restaurant_context:table",
            JSON.stringify({ slug: "cafeking", tableNo: "table 1", name: "Cafe King" })
        );

        // Open normal login independently
        render(<TestApp initialEntries={["/login?mode=customer"]} />);

        await performCustomerOtpLogin();

        await waitFor(() => {
            expect(screen.getByTestId("home-page")).toBeInTheDocument();
        });

        const loc = screen.getByTestId("current-location").textContent;
        expect(loc).toBe("/");
        expect(loc).not.toContain("/m/cafeking");
        expect(loc).not.toContain("table%201");
    });

    it("TEST 3 — QR/table login flow preserves table context and returns to the table URL", async () => {
        // User entered through a restaurant/table QR URL and triggered login with isQrFlow: true
        render(
            <TestApp
                initialEntries={[
                    {
                        pathname: "/login",
                        search: "?mode=customer",
                        state: {
                            from: { pathname: "/m/cafeking/table%201" },
                            isQrFlow: true,
                        },
                    },
                ]}
            />
        );

        await performCustomerOtpLogin();

        await waitFor(() => {
            expect(screen.getByTestId("table-menu-page")).toBeInTheDocument();
        });

        const loc = screen.getByTestId("current-location").textContent;
        expect(loc).toBe("/m/cafeking/table%201");
    });

    it("TEST 4 & 5 — Already authenticated customer on Home remains on Home without unexpected redirects", async () => {
        localStorage.setItem("customerToken", "valid_token");
        localStorage.setItem(
            "customer",
            JSON.stringify({ id: "c1", name: "Guest User", phone: "9999999999", verified: true })
        );

        render(<TestApp initialEntries={["/"]} />);

        expect(screen.getByTestId("home-page")).toBeInTheDocument();
        expect(screen.getByTestId("current-location").textContent).toBe("/");
    });

    it("TEST 6 — Logout -> Login again leads to Home", async () => {
        // User starts with an existing customer session
        localStorage.setItem("customerToken", "valid_token");
        localStorage.setItem(
            "customer",
            JSON.stringify({ id: "c1", name: "Guest User", phone: "9999999999", verified: true })
        );

        // Simulate logout clearing customer credentials
        localStorage.removeItem("customerToken");
        localStorage.removeItem("customer");

        // Go to Login and authenticate
        render(<TestApp initialEntries={["/login?mode=customer"]} />);

        await performCustomerOtpLogin();

        await waitFor(() => {
            expect(screen.getByTestId("home-page")).toBeInTheDocument();
        });

        expect(screen.getByTestId("current-location").textContent).toBe("/");
    });

    it("TEST 7 — Stale redirect protection discards stale restaurant/table redirect and routes to Home", async () => {
        // Retain a stale restaurant/table redirect in sessionStorage and query params without isQrFlow
        sessionStorage.setItem("returnUrl", "/m/cafeking/table%201");

        render(
            <TestApp
                initialEntries={[
                    {
                        pathname: "/login",
                        search: "?mode=customer&returnUrl=/m/cafeking/table%201",
                    },
                ]}
            />
        );

        await performCustomerOtpLogin();

        await waitFor(() => {
            expect(screen.getByTestId("home-page")).toBeInTheDocument();
        });

        const loc = screen.getByTestId("current-location").textContent;
        expect(loc).toBe("/");
        expect(loc).not.toContain("/m/cafeking");
        expect(sessionStorage.getItem("returnUrl")).toBeNull();
    });

    it("Helper isTableOrMenuPath correctly classifies paths", () => {
        expect(isTableOrMenuPath("/m/cafeking/table%201")).toBe(true);
        expect(isTableOrMenuPath("/m/some-cafe")).toBe(true);
        expect(isTableOrMenuPath("/order/table/xyz")).toBe(true);
        expect(isTableOrMenuPath("/")).toBe(false);
        expect(isTableOrMenuPath("/cart")).toBe(false);
        expect(isTableOrMenuPath("/profile/wallet")).toBe(false);
        expect(isTableOrMenuPath("/profile/overview")).toBe(false);
    });
});
