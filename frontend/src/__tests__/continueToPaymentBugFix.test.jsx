import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CheckoutPrompt from "../components/CheckoutPrompt";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { AuthProvider } from "../context/AuthContext";
import { api } from "../utils/apiClient";

vi.mock("../utils/apiClient", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        api: {
            ...actual.api,
            post: vi.fn(),
            get: vi.fn(),
        },
        invalidateGetCache: vi.fn(),
    };
});

describe("Tiffzy Unified Checkout: Single-Page Order & Payment Integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        localStorage.setItem("cafe_system:order_flow_scope:v1", "online");
        localStorage.setItem(
            "cafe_system:restaurant_context:online",
            JSON.stringify({ slug: "mango-forest", name: "Mango Forest" })
        );
    });

    it("TEST A — ₹10 Tea order: Unified checkout displays Order Items and Payment Methods simultaneously without navigation", async () => {
        const mockCart = [
            { id: 101, name: "Tea", price: 10, quantity: 1 },
        ];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 10,
                    tax: 0,
                    taxAmount: 0,
                    total: 10,
                    couponDiscount: 0,
                    loyaltyDiscount: 0,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => {}}
                            cart={mockCart}
                            clearCart={() => {}}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // 1. Verify Unified Header is rendered
        expect(screen.getByRole("heading", { name: /order checkout/i })).toBeInTheDocument();

        // 2. Verify Order Items Review is visible
        expect(screen.getByText("Tea")).toBeInTheDocument();
        expect(screen.getByText("₹10.00 each")).toBeInTheDocument();
        expect(screen.getByText("Rs 10.00")).toBeInTheDocument();

        // 3. Verify Payment Methods are visible simultaneously on the same screen (no Step 2 navigation required!)
        expect(screen.getByText("Select Payment Method")).toBeInTheDocument();
        expect(screen.getByText("Pay Online")).toBeInTheDocument();
        expect(screen.getByText("Tiffzy Wallet")).toBeInTheDocument();
        expect(screen.getByText("Cash on Pickup")).toBeInTheDocument();

        // 4. Verify primary action button is present and not disabled
        const payBtns = screen.getAllByRole("button", { name: /pay|place order|send otp/i });
        expect(payBtns.length).toBeGreaterThanOrEqual(1);
        expect(payBtns[0]).not.toBeDisabled();

        // 5. Verify NO order creation was initiated just by opening checkout
        expect(api.post).not.toHaveBeenCalledWith(
            expect.stringMatching(/\/order$/),
            expect.anything()
        );
    });

    it("TEST A2 — Resilient against preview calculation errors: Unified checkout falls back to subtotal and does not block payment", async () => {
        const mockCart = [
            { id: 101, name: "Tea", price: 10, quantity: 1 },
        ];

        // Simulate preview endpoint failure (e.g. 404 Restaurant not found or network glitch)
        api.post.mockRejectedValueOnce({
            response: {
                data: { message: "Restaurant not found" },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => {}}
                            cart={mockCart}
                            clearCart={() => {}}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Wait for preview attempt to fail and fall back to cartSubtotal
        await waitFor(() => {
            expect(screen.getByText("Rs 10.00")).toBeInTheDocument();
        });

        // Both items and payment methods remain visible
        expect(screen.getByText("Tea")).toBeInTheDocument();
        expect(screen.getByText("Select Payment Method")).toBeInTheDocument();

        // The action button must NOT be blocked or frozen
        const payBtns = screen.getAllByRole("button", { name: /pay|place order|send otp/i });
        expect(payBtns.length).toBeGreaterThanOrEqual(1);
        expect(payBtns[0]).not.toBeDisabled();
    });

    it("TEST B — Multiple items: Preserves all items, quantities, and authoritative total in unified view", async () => {
        const mockCart = [
            { id: 101, name: "Tea", price: 10, quantity: 2 },
            { id: 102, name: "Samosa", price: 20, quantity: 3 },
        ];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 80,
                    tax: 4,
                    taxAmount: 4,
                    total: 84,
                    couponDiscount: 0,
                    loyaltyDiscount: 0,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => {}}
                            cart={mockCart}
                            clearCart={() => {}}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Rs 84.00")).toBeInTheDocument();
        });

        expect(screen.getByText("Tea")).toBeInTheDocument();
        expect(screen.getByText("Samosa")).toBeInTheDocument();
        expect(screen.getByText("Select Payment Method")).toBeInTheDocument();
        expect(screen.getByText("Bill Summary")).toBeInTheDocument();
    });

    it("TEST C — Coupon: Preserves coupon discount and adjusted total in unified bill breakdown", async () => {
        const mockCart = [
            { id: 101, name: "Biryani", price: 200, quantity: 1 },
        ];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 200,
                    tax: 10,
                    couponDiscount: 50,
                    total: 160,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => {}}
                            cart={mockCart}
                            clearCart={() => {}}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Rs 160.00")).toBeInTheDocument();
        });

        expect(screen.getByText("Biryani")).toBeInTheDocument();
        expect(screen.getByText("Offers & Coupons")).toBeInTheDocument();
        expect(screen.getByText("Select Payment Method")).toBeInTheDocument();
    });

    it("TEST D & E — Empty cart safely disables primary action, and Close button safely unmounts checkout", async () => {
        let closed = false;
        const { unmount } = render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => { closed = true; }}
                            cart={[]}
                            clearCart={() => {}}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
        const emptyPayBtns = screen.getAllByRole("button", { name: /send otp & pay|pay rs|place order/i });
        expect(emptyPayBtns.length).toBeGreaterThanOrEqual(1);
        emptyPayBtns.forEach((btn) => expect(btn).toBeDisabled());

        // Verify Close button works
        const closeBtns = screen.getAllByRole("button", { name: /close/i });
        fireEvent.click(closeBtns[0]);
        expect(closed).toBe(true);

        unmount();
    });
});
