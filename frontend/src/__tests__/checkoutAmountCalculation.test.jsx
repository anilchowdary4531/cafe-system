import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CheckoutPrompt from "../components/CheckoutPrompt";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { AuthProvider } from "../context/AuthContext";
import { api } from "../utils/apiClient";
import ItemCustomizationModal from "../components/ItemCustomizationModal";

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

describe("Checkout Amount Calculation & Order Summary Audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        localStorage.setItem("cafe_system:order_flow_scope:v1", "online");
        localStorage.setItem(
            "cafe_system:restaurant_context:online",
            JSON.stringify({ slug: "cafe-fido", name: "Cafe Fido" })
        );
    });

    it("1. ItemCustomizationModal produces complete payload with id, quantity, and unit price", () => {
        const item = {
            id: 101,
            name: "Chicken Pulao",
            price: 260,
            category: "Biryani & Pulao",
            image: "pulao.jpg",
        };

        let savedPayload = null;
        render(
            <ItemCustomizationModal
                isOpen={true}
                item={item}
                onSave={(payload) => {
                    savedPayload = payload;
                }}
                onClose={() => {}}
            />
        );

        const confirmBtn = screen.getByRole("button", { name: /add to order/i });
        confirmBtn.click();

        expect(savedPayload).not.toBeNull();
        expect(savedPayload.id).toBe(101);
        expect(savedPayload.menuItemId).toBe(101);
        expect(savedPayload.name).toBe("Chicken Pulao");
        expect(savedPayload.price).toBe(260);
        expect(savedPayload.quantity).toBe(1);
        expect(savedPayload.totalPrice).toBe(260);
    });

    it("2. CheckoutPrompt displays authoritative Subtotal ₹280.00 and Final Total ₹294.00 consistently across all UI locations", async () => {
        const mockCart = [
            { id: 101, name: "Chicken Pulao", price: 260, quantity: 1 },
            { id: 102, name: "Coffee", price: 20, quantity: 1 },
        ];

        // Mock checkout preview API response
        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 280,
                    tax: 14,
                    taxAmount: 14,
                    total: 294,
                    couponDiscount: 0,
                    loyaltyDiscount: 0,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "cafe-fido", name: "Cafe Fido" }}>
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

        // Verify API was called with both items including id, name, price, and quantity
        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/customer/checkout/preview",
                expect.objectContaining({
                    slug: "cafe-fido",
                    items: expect.arrayContaining([
                        expect.objectContaining({ id: 101, name: "Chicken Pulao", price: 260, quantity: 1 }),
                        expect.objectContaining({ id: 102, name: "Coffee", price: 20, quantity: 1 }),
                    ]),
                }),
                expect.anything()
            );
        });

        // 1. Verify items in the summary list
        expect(screen.getByText("Chicken Pulao")).toBeInTheDocument();
        expect(screen.getByText("Coffee")).toBeInTheDocument();
        expect(screen.getByText("₹260.00 each")).toBeInTheDocument();
        expect(screen.getByText("₹20.00 each")).toBeInTheDocument();

        // 2. Verify Subtotal ₹280.00
        await waitFor(() => {
            expect(screen.getByText("₹280.00")).toBeInTheDocument();
        });

        // 3. Verify Taxes ₹14.00
        expect(screen.getByText("₹14.00")).toBeInTheDocument();

        // 4. Verify Final Total ₹294.00 in the bill breakdown
        expect(screen.getByText("Final Total")).toBeInTheDocument();

        // 5. Verify Header amount: Cafe Fido • ₹294.00
        expect(screen.getByText(/Cafe Fido • ₹294\.00/)).toBeInTheDocument();

        // 6. Verify Bill Summary total: ₹294.00
        const matchingTotals = screen.getAllByText("₹294.00");
        expect(matchingTotals.length).toBeGreaterThanOrEqual(1);

        // 7. Verify Bottom sticky bar: Rs 294.00
        expect(screen.getByText("Rs 294.00")).toBeInTheDocument();

        // 8. Verify Primary Pay button is present and enabled
        const payBtns = screen.getAllByRole("button", { name: /send otp & pay|pay rs|place order/i });
        expect(payBtns.length).toBeGreaterThanOrEqual(1);
        expect(payBtns[0]).not.toBeDisabled();
    });

    it("3. Quantity > 1: Chicken Pulao x 2 (₹520) + Coffee x 3 (₹60) yields Subtotal ₹580.00", async () => {
        const mockCart = [
            { id: 101, name: "Chicken Pulao", price: 260, quantity: 2 },
            { id: 102, name: "Coffee", price: 20, quantity: 3 },
        ];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 580,
                    tax: 29,
                    taxAmount: 29,
                    total: 609,
                    couponDiscount: 0,
                    loyaltyDiscount: 0,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "cafe-fido", name: "Cafe Fido" }}>
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
            expect(screen.getByText("₹580.00")).toBeInTheDocument();
            expect(screen.getByText("₹29.00")).toBeInTheDocument();
            expect(screen.getByText("Rs 609.00")).toBeInTheDocument();
        });
    });

    it("4. Empty cart: displays empty cart state and disabled action button", async () => {
        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "cafe-fido", name: "Cafe Fido" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => {}}
                            cart={[]}
                            clearCart={() => {}}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
        const payBtns = screen.getAllByRole("button", { name: /send otp & pay|pay rs|place order/i });
        expect(payBtns[0]).toBeDisabled();
    });

    it("5. Coupon discount: Displays coupon line and deducts from authoritative total", async () => {
        const mockCart = [
            { id: 101, name: "Chicken Pulao", price: 260, quantity: 1 },
            { id: 102, name: "Coffee", price: 20, quantity: 1 },
        ];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 280,
                    tax: 14,
                    taxAmount: 14,
                    couponDiscount: 50,
                    promoDiscountAmount: 50,
                    total: 244,
                    loyaltyDiscount: 0,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ slug: "cafe-fido", name: "Cafe Fido" }}>
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
            expect(screen.getByText("₹280.00")).toBeInTheDocument();
            expect(screen.getByText("Rs 244.00")).toBeInTheDocument();
            expect(screen.getAllByText("₹244.00").length).toBeGreaterThanOrEqual(1);
        });
    });
});
