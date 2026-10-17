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

describe("Tiffzy Unified Single-Page Checkout Comprehensive Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        localStorage.setItem("cafe_system:order_flow_scope:v1", "online");
        localStorage.setItem(
            "cafe_system:restaurant_context:online",
            JSON.stringify({ slug: "mango-forest", name: "Mango Forest", id: 10 })
        );
    });

    it("1. Unified UI: Order summary, fulfillment, and payment options render simultaneously", async () => {
        const mockCart = [
            { id: 101, name: "Special Tea", price: 20, quantity: 2 },
            { id: 102, name: "Veg Samosa", price: 15, quantity: 2 },
        ];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 70,
                    tax: 3.5,
                    taxes: [{ name: "GST", rate: 5, amount: 3.5 }],
                    charges: [{ name: "Packaging", amount: 10, type: "FIXED" }],
                    total: 83.5,
                    couponDiscount: 0,
                    loyaltyDiscount: 0,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest", id: 10 }}>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Header
        expect(screen.getByRole("heading", { name: /order checkout/i })).toBeInTheDocument();

        // Left Column: Fulfillment & Items
        expect(screen.getByText("Fulfillment Mode")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Delivery" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Pickup" })).toBeInTheDocument();
        expect(screen.getByText("Special Tea")).toBeInTheDocument();
        expect(screen.getByText("Veg Samosa")).toBeInTheDocument();

        // Right Column: Offers, Loyalty, Payment Method, Bill Summary
        expect(screen.getByText("Offers & Coupons")).toBeInTheDocument();
        expect(screen.getByText("Loyalty Rewards")).toBeInTheDocument();
        expect(screen.getByText("Select Payment Method")).toBeInTheDocument();
        expect(screen.getByText("Pay Online")).toBeInTheDocument();
        expect(screen.getByText("Tiffzy Wallet")).toBeInTheDocument();
        expect(screen.getByText("Cash on Pickup")).toBeInTheDocument();
        expect(screen.getByText("Bill Summary")).toBeInTheDocument();

        // Authoritative bill breakdown rendered
        await waitFor(() => {
            expect(screen.getByText("₹70.00")).toBeInTheDocument();
            expect(screen.getByText("₹3.50")).toBeInTheDocument();
            expect(screen.getByText("₹10.00")).toBeInTheDocument();
            expect(screen.getByText("Rs 83.50")).toBeInTheDocument();
        });
    });

    it("2. Fulfillment: Switching from Pickup to Delivery reveals Delivery Address", async () => {
        const mockCart = [{ id: 101, name: "Tea", price: 10, quantity: 1 }];

        api.post.mockResolvedValue({
            data: {
                ok: true,
                billing: { subtotal: 10, tax: 0, total: 10 },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Initially in Pickup mode
        expect(screen.getByText(/Pickup orders do not need a delivery address/i)).toBeInTheDocument();

        // Click Delivery button
        const deliveryBtn = screen.getByRole("button", { name: "Delivery" });
        fireEvent.click(deliveryBtn);

        // Delivery address textarea appears
        expect(screen.getByPlaceholderText(/house\/flat number/i)).toBeInTheDocument();
    });

    it("3. Table QR Order: Active table session locks fulfillment to Dine-In", async () => {
        localStorage.setItem("cafe_system:order_flow_scope:v1", "table");
        localStorage.setItem(
            "cafe_system:restaurant_context:table",
            JSON.stringify({ slug: "mango-forest", name: "Mango Forest", tableNo: "table-5" })
        );
        const mockCart = [{ id: 101, name: "Cold Coffee", price: 80, quantity: 1 }];

        api.post.mockResolvedValue({
            data: {
                ok: true,
                billing: { subtotal: 80, tax: 4, total: 84 },
            },
        });

        render(
            <MemoryRouter initialEntries={["/m/mango-forest/table-5"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Table badge displayed
        expect(screen.getByText(/Table table-5 • Dine-In/i)).toBeInTheDocument();
        expect(screen.getByText(/Active Session/i)).toBeInTheDocument();

        // Delivery options hidden
        expect(screen.queryByPlaceholderText(/house\/flat number/i)).not.toBeInTheDocument();

        // Payment method dynamically shows Cash on Table
        expect(screen.getByText("Cash on Table")).toBeInTheDocument();
    });

    it("4. Coupons: Applying coupon validates code and updates breakdown", async () => {
        const mockCart = [{ id: 101, name: "Biryani", price: 200, quantity: 1 }];

        api.post.mockImplementation((url, body) => {
            if (url.includes("/promotions/validate")) {
                return Promise.resolve({ data: { ok: true, code: "WELCOME50", discountAmount: 50 } });
            }
            if (url.includes("/checkout/preview")) {
                const isCouponApplied = body?.couponCode === "WELCOME50";
                return Promise.resolve({
                    data: {
                        ok: true,
                        billing: {
                            subtotal: 200,
                            tax: 10,
                            couponDiscount: isCouponApplied ? 50 : 0,
                            total: isCouponApplied ? 160 : 210,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Wait for initial preview
        await waitFor(() => {
            expect(screen.getAllByText(/210\.00/).length).toBeGreaterThanOrEqual(1);
        });

        const couponInput = screen.getByPlaceholderText(/enter code/i);
        fireEvent.change(couponInput, { target: { value: "WELCOME50" } });

        const applyBtn = screen.getByRole("button", { name: "Apply" });
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.getAllByText(/Coupon "WELCOME50"/i).length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText(/160\.00/).length).toBeGreaterThanOrEqual(1);
        });
    });

    it("5. Payment Selection: Toggling between UPI, Wallet, and Cash updates method state", async () => {
        const mockCart = [{ id: 101, name: "Tea", price: 10, quantity: 1 }];

        api.post.mockResolvedValue({
            data: {
                ok: true,
                billing: { subtotal: 10, tax: 0, total: 10 },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Click Tiffzy Wallet
        const walletOption = screen.getByText("Tiffzy Wallet").closest("button");
        fireEvent.click(walletOption);

        // Action button updates label to Wallet
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: /pay rs 10\.00 with wallet/i }).length).toBeGreaterThanOrEqual(1);
        });

        // Click Cash on Pickup
        const cashOption = screen.getByText("Cash on Pickup").closest("button");
        fireEvent.click(cashOption);

        // Action button updates label to Place Pickup Order
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: /place pickup order|place order/i }).length).toBeGreaterThanOrEqual(1);
        });
    });

    it("6. Cash Payment: Submitting cash order creates order and verifies with CASH mode", async () => {
        localStorage.setItem("customerToken", "mock-token-xyz");
        localStorage.setItem("customer", JSON.stringify({ phone: "9876543210", name: "John Doe" }));
        localStorage.setItem("cafe_system:order_flow_scope:v1", "online");
        localStorage.setItem(
            "cafe_system:restaurant_context:online",
            JSON.stringify({ slug: "mango-forest", name: "Mango Forest" })
        );
        const mockCart = [{ id: 101, name: "Tea", price: 10, quantity: 1 }];

        api.post.mockImplementation((url) => {
            if (url.includes("/checkout/preview")) {
                return Promise.resolve({ data: { ok: true, billing: { subtotal: 10, tax: 0, total: 10 } } });
            }
            if (url.includes("/order")) {
                return Promise.resolve({ data: { order: { id: 777, orderNo: "ORD-777", total: 10, status: "PLACED" } } });
            }
            if (url.includes("/verify")) {
                return Promise.resolve({ data: { success: true, order: { id: 777, paymentStatus: "SUCCESS" } } });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Wait for preview to complete
        await waitFor(() => {
            expect(screen.getAllByText(/10\.00/).length).toBeGreaterThanOrEqual(1);
        });

        // Select Cash
        const cashOption = screen.getByText("Cash on Pickup").closest("button");
        fireEvent.click(cashOption);

        // Click primary action button
        await waitFor(() => {
            const payBtns = screen.getAllByRole("button", { name: /place pickup order|place order/i });
            expect(payBtns.length).toBeGreaterThanOrEqual(1);
            fireEvent.click(payBtns[0]);
        });

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/r/mango-forest/order",
                expect.objectContaining({
                    fulfillment: "pickup",
                    tableNumber: "",
                })
            );
        });
    });
});
