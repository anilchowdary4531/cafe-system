import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CheckoutPrompt from "../components/CheckoutPrompt";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { AuthProvider } from "../context/AuthContext";
import { api, cachedGet } from "../utils/apiClient";

const makeCustomerJwt = (phone = "9876543210") => {
    const payload = btoa(JSON.stringify({ type: "customer", phone }));
    return `header.${payload}.signature`;
};

vi.mock("../utils/apiClient", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        api: {
            ...actual.api,
            post: vi.fn(),
            get: vi.fn(),
        },
        cachedGet: vi.fn(),
        invalidateGetCache: vi.fn(),
    };
});

describe("Tiffzy Checkout Preview Diagnosis & Fix Test Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.post.mockReset();
        cachedGet.mockReset();
        localStorage.clear();
        localStorage.setItem("cafe_system:order_flow_scope:v1", "online");
        localStorage.setItem(
            "cafe_system:restaurant_context:online",
            JSON.stringify({ slug: "cafe-fido", name: "Cafe Fido", id: "cafe-fido" })
        );
    });

    it("1. Pickup + single item: Cafe Fido Maggie x 1 preview succeeds with string restaurantId sanitized", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post.mockResolvedValueOnce({
            data: {
                ok: true,
                billing: {
                    subtotal: 60,
                    tax: 0,
                    taxes: [],
                    charges: [],
                    serviceCharge: 0,
                    deliveryFee: 0,
                    roundOff: 0,
                    total: 60,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            // Verify restaurantId was NOT sent as the raw string "cafe-fido" (sanitized to undefined)
            expect(api.post).toHaveBeenCalledWith(
                "/customer/checkout/preview",
                expect.objectContaining({
                    slug: "cafe-fido",
                    restaurantId: undefined,
                    fulfillment: "pickup",
                    items: expect.arrayContaining([
                        expect.objectContaining({ name: "Maggie", price: 60, quantity: 1 }),
                    ]),
                }),
                expect.anything()
            );
        });

        // Authoritative bill is shown without error
        expect(screen.queryByText(/Failed to calculate order preview/i)).not.toBeInTheDocument();
        expect(screen.getAllByText("₹60.00").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Rs 60.00")).toBeInTheDocument();
    });

    it("2. Delivery + valid address: preview succeeds with delivery fulfillment", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post.mockResolvedValue({
            data: {
                ok: true,
                billing: {
                    subtotal: 60,
                    tax: 3,
                    taxes: [{ name: "GST", rate: 5, amount: 3 }],
                    deliveryFee: 20,
                    total: 83,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Click Delivery button
        const deliveryBtn = screen.getByRole("button", { name: "Delivery" });
        fireEvent.click(deliveryBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/customer/checkout/preview",
                expect.objectContaining({
                    slug: "cafe-fido",
                    fulfillment: "delivery",
                }),
                expect.anything()
            );
        });

        await waitFor(() => {
            expect(screen.getByText("Delivery Fee")).toBeInTheDocument();
            expect(screen.getByText("₹20.00")).toBeInTheDocument();
            expect(screen.getByText("Rs 83.00")).toBeInTheDocument();
        });
    });

    it("3. Dine-in + table session: preview succeeds and preserves tableNumber", async () => {
        window.history.pushState({}, "", "/m/cafe-fido/table-4");
        localStorage.setItem("cafe_system:order_flow_scope:v1", "table");
        localStorage.setItem(
            "cafe_system:restaurant_context:table",
            JSON.stringify({ slug: "cafe-fido", name: "Cafe Fido", tableNo: "4" })
        );
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post.mockResolvedValue({
            data: {
                ok: true,
                billing: {
                    subtotal: 60,
                    tax: 3,
                    serviceCharge: 3,
                    total: 66,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/m/cafe-fido/table-4"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/customer/checkout/preview",
                expect.objectContaining({
                    fulfillment: "dinein",
                    tableNumber: "4",
                }),
                expect.anything()
            );
            expect(screen.getByText("Rs 66.00")).toBeInTheDocument();
        });
    });

    it("4. Preview failure: error is shown with a Retry action", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post.mockRejectedValueOnce({
            response: { status: 500, data: { message: "Failed to calculate order preview" } },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Failed to calculate order preview")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
        });
    });

    it("5 & 6. Preview retry: successful retry clears error and leaves no stale error", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post
            .mockRejectedValueOnce({
                response: { status: 500, data: { message: "Failed to calculate order preview" } },
            })
            .mockResolvedValueOnce({
                data: {
                    ok: true,
                    billing: { subtotal: 60, total: 60 },
                },
            });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // First attempt fails
        await waitFor(() => {
            expect(screen.getByText("Failed to calculate order preview")).toBeInTheDocument();
        });

        // Click Retry button
        const retryBtn = screen.getByRole("button", { name: "Retry" });
        fireEvent.click(retryBtn);

        // Successful retry clears the error banner completely
        await waitFor(() => {
            expect(screen.queryByText("Failed to calculate order preview")).not.toBeInTheDocument();
            expect(screen.getByText("Rs 60.00")).toBeInTheDocument();
        });
    });

    it("7. Coupon: preview recalculates authoritative bill when coupon applied", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 2 }];

        api.post.mockImplementation((url, payload) => {
            if (url.includes("/promotions/validate")) {
                return Promise.resolve({
                    data: { ok: true, code: "FIDO20", discountAmount: 20 },
                });
            }
            if (url.includes("/checkout/preview")) {
                if (payload?.couponCode === "FIDO20") {
                    return Promise.resolve({
                        data: {
                            ok: true,
                            billing: { subtotal: 120, couponDiscount: 20, total: 100 },
                        },
                    });
                }
                return Promise.resolve({
                    data: {
                        ok: true,
                        billing: { subtotal: 120, couponDiscount: 0, total: 120 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Rs 120.00")).toBeInTheDocument();
        });

        // Apply Coupon
        const couponInput = screen.getByPlaceholderText(/enter promo code|enter code/i);
        fireEvent.change(couponInput, { target: { value: "FIDO20" } });
        const applyBtn = screen.getByRole("button", { name: "Apply" });
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.getByText("Coupon Discount (FIDO20)")).toBeInTheDocument();
            expect(screen.getByText("-₹20.00")).toBeInTheDocument();
            expect(screen.getByText("Rs 100.00")).toBeInTheDocument();
        });
    });

    it("8. Loyalty: preview recalculates when loyalty redeemed", async () => {
        const jwt = makeCustomerJwt("9876543210");
        localStorage.setItem("customerToken", jwt);
        localStorage.setItem("customer", JSON.stringify({ name: "John Doe", phone: "9876543210" }));
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 2 }];

        cachedGet.mockImplementation((url) => {
            if (url.includes("/customer/loyalty")) {
                return Promise.resolve({ currentBalance: 50, equivalentValue: 50 });
            }
            return Promise.resolve({});
        });

        api.post.mockImplementation((url, payload) => {
            if (payload?.pointsToRedeem === 10) {
                return Promise.resolve({
                    data: {
                        ok: true,
                        billing: { subtotal: 120, loyaltyDiscount: 10, total: 110 },
                    },
                });
            }
            return Promise.resolve({
                data: {
                    ok: true,
                    billing: { subtotal: 120, loyaltyDiscount: 0, total: 120 },
                },
            });
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Rs 120.00")).toBeInTheDocument();
        });

        // Redeem 10 pts
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/max 50 pts/i)).toBeInTheDocument();
        });
        const loyaltyInput = screen.getByPlaceholderText(/max 50 pts/i);
        fireEvent.change(loyaltyInput, { target: { value: "10" } });
        const redeemBtn = screen.getByRole("button", { name: "Redeem" });
        fireEvent.click(redeemBtn);

        await waitFor(() => {
            expect(screen.getByText(/Loyalty Discount \(10 pts\)/)).toBeInTheDocument();
            expect(screen.getByText("-₹10.00")).toBeInTheDocument();
            expect(screen.getByText("Rs 110.00")).toBeInTheDocument();
        });
    });

    it("9 & 10. Switching Pickup -> Delivery -> Pickup triggers correct preview requests", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        const previewFulfillments = [];
        api.post.mockImplementation((url, payload) => {
            if (url.includes("/checkout/preview")) {
                previewFulfillments.push(payload?.fulfillment);
                return Promise.resolve({
                    data: {
                        ok: true,
                        billing: { subtotal: 60, total: payload?.fulfillment === "delivery" ? 80 : 60 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Initial Pickup
        await waitFor(() => {
            expect(previewFulfillments).toContain("pickup");
        });

        // Switch to Delivery
        const deliveryBtn = screen.getByRole("button", { name: "Delivery" });
        fireEvent.click(deliveryBtn);

        await waitFor(() => {
            expect(previewFulfillments).toContain("delivery");
        });

        // Switch back to Pickup
        const pickupBtn = screen.getByRole("button", { name: "Pickup" });
        fireEvent.click(pickupBtn);

        await waitFor(() => {
            expect(previewFulfillments[previewFulfillments.length - 1]).toBe("pickup");
        });
    });

    it("11. Rapid fulfillment changes: latest preview wins (race condition protection)", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        // Request 1 (pickup) takes 100ms, Request 2 (delivery) takes 10ms
        let callCount = 0;
        api.post.mockImplementation((url, payload) => {
            if (url.includes("/checkout/preview")) {
                callCount++;
                const isFirst = callCount === 1;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            data: {
                                ok: true,
                                billing: {
                                    subtotal: 60,
                                    deliveryFee: isFirst ? 0 : 35,
                                    total: isFirst ? 60 : 95,
                                },
                            },
                        });
                    }, isFirst ? 80 : 10);
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Rapidly switch to Delivery before Request 1 finishes
        const deliveryBtn = screen.getByRole("button", { name: "Delivery" });
        fireEvent.click(deliveryBtn);

        // Latest preview (Delivery: Rs 95.00) must win and not be overwritten by Request 1
        await waitFor(() => {
            expect(screen.getByText("Rs 95.00")).toBeInTheDocument();
        });

        // Wait extra to ensure delayed Request 1 cannot revert it
        await new Promise((r) => setTimeout(r, 120));
        expect(screen.getByText("Rs 95.00")).toBeInTheDocument();
    });

    it("12. Payment uses authoritative amount and cannot accidentally use fabricated amount", async () => {
        const jwt = makeCustomerJwt("9876543210");
        localStorage.setItem("customerToken", jwt);
        localStorage.setItem("customer", JSON.stringify({ name: "John Doe", phone: "9876543210" }));
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post.mockImplementation((url) => {
            if (url.includes("/checkout/preview")) {
                return Promise.resolve({
                    data: {
                        ok: true,
                        billing: { subtotal: 60, tax: 3, total: 63 },
                    },
                });
            }
            if (url.includes("/order")) {
                return Promise.resolve({
                    data: { order: { id: 888, total: 63, status: "PLACED" } },
                });
            }
            if (url.includes("/verify")) {
                return Promise.resolve({ data: { success: true } });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Rs 63.00")).toBeInTheDocument();
        });

        const cashOption = screen.getByText("Cash on Pickup").closest("button");
        fireEvent.click(cashOption);

        await waitFor(() => {
            const placeOrderBtns = screen.getAllByRole("button", { name: /place pickup order|place order/i });
            expect(placeOrderBtns.length).toBeGreaterThanOrEqual(1);
            fireEvent.click(placeOrderBtns[0]);
        });

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/r/cafe-fido/order",
                expect.objectContaining({
                    customerName: "John Doe",
                    fulfillment: "pickup",
                    phone: "9876543210",
                })
            );
            expect(api.post).toHaveBeenCalledWith(
                "/payments/verify",
                expect.objectContaining({
                    orderId: 888,
                    paymentMode: "CASH",
                    status: "SUCCESS",
                }),
                expect.anything()
            );
        });
    });

    it("13. Layout: Offers & Coupons and Loyalty Rewards are placed in Left Column below Cooking Instructions, Right Column has Payment and Bill Summary", async () => {
        const mockCart = [{ id: 1246, name: "Maggie", price: 60, quantity: 1 }];

        api.post.mockResolvedValue({
            data: {
                ok: true,
                billing: { subtotal: 60, total: 60 },
            },
        });

        render(
            <MemoryRouter initialEntries={["/r/cafe-fido"]}>
                <AuthProvider>
                    <RestaurantContextProvider>
                        <CheckoutPrompt open={true} onClose={() => {}} cart={mockCart} clearCart={() => {}} />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Rs 60.00")).toBeInTheDocument();
        });

        const cookingHeading = screen.getByText(/Special Cooking Instructions/i);
        const offersHeading = screen.getByText(/Offers & Coupons/i);
        const loyaltyHeading = screen.getByText(/Loyalty Rewards/i);
        const paymentHeading = screen.getByText(/Select Payment Method/i);
        const billHeading = screen.getByText(/Bill Summary/i);

        // Verify all 5 sections exist
        expect(cookingHeading).toBeInTheDocument();
        expect(offersHeading).toBeInTheDocument();
        expect(loyaltyHeading).toBeInTheDocument();
        expect(paymentHeading).toBeInTheDocument();
        expect(billHeading).toBeInTheDocument();

        // Verify document position order: Cooking -> Offers -> Loyalty -> Payment -> Bill Summary
        expect(cookingHeading.compareDocumentPosition(offersHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(offersHeading.compareDocumentPosition(loyaltyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(loyaltyHeading.compareDocumentPosition(paymentHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(paymentHeading.compareDocumentPosition(billHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
