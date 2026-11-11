import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CheckoutPrompt from "../components/CheckoutPrompt";
import PaymentStatus, { parsePaymentReturnParams } from "../pages/PaymentStatus";
import { resolveFrontendEnvConfig } from "../config";
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
        cachedGet: vi.fn(() => Promise.resolve({ addresses: [], points: 0 })),
        invalidateGetCache: vi.fn(),
    };
});

describe("TWM Pay Frontend Checkout & Return Verification Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        const futureExp = Math.floor(Date.now() / 1000) + 3600;
        const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ id: 5, exp: futureExp }))}.fakesig`;
        localStorage.setItem("customerToken", fakeJwt);
        localStorage.setItem("customer", JSON.stringify({ id: 5, name: "Asha", phone: "9876543210", email: "asha@test.com" }));
        localStorage.setItem("cafe_system:order_flow_scope:v1", "online");
        localStorage.setItem(
            "cafe_system:restaurant_context:online",
            JSON.stringify({ id: 10, slug: "mango-forest", name: "Mango Forest" })
        );
    });

    it("1. parsePaymentReturnParams handles normal and malformed double-question-mark URLs", () => {
        const standard = parsePaymentReturnParams(
            "?order_ref=TWM_10_42_1&status=paid&amount_paise=25000&txn=UTR99&signature=abc123"
        );
        expect(standard.orderRef).toBe("TWM_10_42_1");
        expect(standard.status).toBe("paid");
        expect(standard.amountPaise).toBe("25000");
        expect(standard.txn).toBe("UTR99");
        expect(standard.signature).toBe("abc123");

        const doubleQ = parsePaymentReturnParams(
            "?provider=twm_pay?order_ref=TWM_10_42_2&status=utr_submitted&amount_paise=12000&txn=UTR77&signature=def456"
        );
        expect(doubleQ.provider).toBe("twm_pay");
        expect(doubleQ.orderRef).toBe("TWM_10_42_2");
        expect(doubleQ.status).toBe("utr_submitted");
        expect(doubleQ.signature).toBe("def456");
    });

    it("2. CheckoutPrompt supports selecting TWM Pay and redirects to hosted checkoutUrl", async () => {
        const mockCart = [{ id: 101, name: "Masala Chai", price: 50, quantity: 2 }];
        const redirectSpy = vi.fn();

        api.get.mockImplementation((url) => {
            if (url.includes("/api/payments/providers")) {
                return Promise.resolve({
                    data: {
                        defaultProvider: "TWM_PAY",
                        twmPay: { configured: true },
                        cashfree: { configured: true },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        api.post.mockImplementation((url) => {
            if (url.includes("/checkout/preview")) {
                return Promise.resolve({ data: { ok: true, billing: { subtotal: 100, tax: 0, total: 100 } } });
            }
            if (url.includes("/order")) {
                return Promise.resolve({ data: { order: { id: 42, orderNo: "ORD-42", total: 100, status: "PLACED" } } });
            }
            if (url.includes("/api/payments/create-order")) {
                return Promise.resolve({
                    data: {
                        success: true,
                        provider: "TWM_PAY",
                        orderId: "42",
                        orderRef: "TWM_10_42_1",
                        checkoutUrl: "https://pay.thewebsitemakers.in/checkout/TWM_10_42_1",
                        checkout_url: "https://pay.thewebsitemakers.in/checkout/TWM_10_42_1",
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/r/mango-forest"]}>
                <AuthProvider>
                    <RestaurantContextProvider initialValue={{ id: 10, slug: "mango-forest", name: "Mango Forest" }}>
                        <CheckoutPrompt
                            open={true}
                            onClose={() => {}}
                            cart={mockCart}
                            clearCart={() => {}}
                            redirectToCheckout={redirectSpy}
                        />
                    </RestaurantContextProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /TWM Pay \(UPI \/ QR\)/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Cashfree Online/i })).toBeInTheDocument();
        });

        const payBtn = screen.getByRole("button", { name: /Pay Rs 100\.00 Online \(TWM Pay\)/i });
        fireEvent.click(payBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/api/payments/create-order",
                expect.objectContaining({
                    orderId: 42,
                    amount: 100,
                    provider: "TWM_PAY",
                }),
                expect.anything()
            );
            expect(redirectSpy).toHaveBeenCalledWith("https://pay.thewebsitemakers.in/checkout/TWM_10_42_1");
        });
    });

    it("3. PaymentStatus verifies signed TWM return server-side and renders Paid vs UtrSubmitted vs InvalidSignature", async () => {
        // Case A: Verified PAID
        api.post.mockResolvedValueOnce({
            data: {
                verified: true,
                success: true,
                status: "SUCCESS",
                paymentStatus: "PAID",
                gatewayStatus: "PAID",
                provider: "TWM_PAY",
                paymentMethod: "ONLINE",
                orderId: "42",
                orderNo: "ORD-42",
                orderRef: "TWM_10_42_1",
                transactionId: "UTR111",
                amount: 100,
                restaurantSlug: "mango-forest",
            },
        });

        render(
            <MemoryRouter
                initialEntries={[
                    "/payment-status?order_ref=TWM_10_42_1&status=paid&amount_paise=10000&txn=UTR111&signature=validsig",
                ]}
            >
                <RestaurantContextProvider>
                    <Routes>
                        <Route path="/payment-status" element={<PaymentStatus />} />
                    </Routes>
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Payment Successful")).toBeInTheDocument();
            expect(screen.getByText(/Online \(TWM Pay\)/i)).toBeInTheDocument();
        });
        expect(api.post).toHaveBeenCalledWith(
            "/api/payments/twm/return",
            expect.objectContaining({
                order_ref: "TWM_10_42_1",
                status: "paid",
                amount_paise: "10000",
                txn: "UTR111",
                signature: "validsig",
            })
        );
    });

    it("4. PaymentStatus renders UPI Verification in Progress for utr_submitted and FAILED on invalid signature", async () => {
        api.post.mockResolvedValueOnce({
            data: {
                verified: false,
                success: false,
                status: "PENDING",
                paymentStatus: "PENDING",
                gatewayStatus: "UTR_SUBMITTED",
                provider: "TWM_PAY",
                paymentMethod: "ONLINE",
                orderId: "43",
                orderNo: "ORD-43",
                orderRef: "TWM_10_43_1",
                transactionId: "UTR222",
                amount: 150,
            },
        });

        const { unmount } = render(
            <MemoryRouter
                initialEntries={[
                    "/payment-status?order_ref=TWM_10_43_1&status=utr_submitted&amount_paise=15000&txn=UTR222&signature=utrsig",
                ]}
            >
                <RestaurantContextProvider>
                    <Routes>
                        <Route path="/payment-status" element={<PaymentStatus />} />
                    </Routes>
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("UPI Verification in Progress")).toBeInTheDocument();
            expect(screen.getByText(/VERIFYING UPI/i)).toBeInTheDocument();
        });
        unmount();

        // Case B: Forged / rejected signature -> must display FAILED
        api.post.mockRejectedValueOnce({
            response: {
                data: {
                    verified: false,
                    status: "FAILED",
                    paymentStatus: "FAILED",
                    message: "Invalid payment signature",
                },
            },
        });

        render(
            <MemoryRouter
                initialEntries={[
                    "/payment-status?order_ref=TWM_10_44_1&status=paid&amount_paise=100&txn=BAD&signature=bad",
                ]}
            >
                <RestaurantContextProvider>
                    <Routes>
                        <Route path="/payment-status" element={<PaymentStatus />} />
                    </Routes>
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Payment Failed")).toBeInTheDocument();
            expect(screen.getAllByText(/Invalid payment signature/i).length).toBeGreaterThanOrEqual(1);
        });
    });

    it("5. Vercel Preview env config supports VITE_API_BASE_URL/VITE_SOCKET_URL and blocks accidental prod API fallback", () => {
        // Explicit staging env vars succeed on Vercel Preview domain
        const validPreview = resolveFrontendEnvConfig({
            apiUrl: "",
            apiBaseUrl: "https://staging-api.tiffzy.com/",
            socketUrl: "https://staging-api.tiffzy.com/",
            isProd: true,
            hostname: "cafe-system-git-feature-twm-p-ebc5a0-anilchowdary4531s-projects.vercel.app",
        });
        expect(validPreview).toEqual({
            API_BASE_URL: "https://staging-api.tiffzy.com",
            SOCKET_URL: "https://staging-api.tiffzy.com",
            IS_MISCONFIGURED_PREVIEW: false,
        });

        // Missing staging API URL on Vercel Preview fails closed (does NOT fall back to /api -> api.tiffzy.com)
        const missingPreview = resolveFrontendEnvConfig({
            apiUrl: "",
            apiBaseUrl: "",
            socketUrl: "",
            isProd: true,
            hostname: "cafe-system-3ttgzslpf-anilchowdary4531s-projects.vercel.app",
        });
        expect(missingPreview.IS_MISCONFIGURED_PREVIEW).toBe(true);
        expect(missingPreview.API_BASE_URL).not.toBe("/api");
        expect(missingPreview.SOCKET_URL).toBe("");

        // Explicitly pointing Preview at https://api.tiffzy.com is also blocked
        const prodLeakPreview = resolveFrontendEnvConfig({
            apiUrl: "https://api.tiffzy.com",
            apiBaseUrl: "",
            socketUrl: "",
            isProd: true,
            hostname: "cafe-system-3ttgzslpf-anilchowdary4531s-projects.vercel.app",
        });
        expect(prodLeakPreview.IS_MISCONFIGURED_PREVIEW).toBe(true);

        // Production domain www.tiffzy.com continues to work normally
        const prodDomain = resolveFrontendEnvConfig({
            apiUrl: "",
            apiBaseUrl: "",
            socketUrl: "",
            isProd: true,
            hostname: "www.tiffzy.com",
        });
        expect(prodDomain).toEqual({
            API_BASE_URL: "/api",
            SOCKET_URL: "/api",
            IS_MISCONFIGURED_PREVIEW: false,
        });

        // Explicit VITE_API_BASE_URL on Preview/local overrides default .env.production VITE_API_URL=https://api.tiffzy.com
        const previewBaseOverridesDefaultProd = resolveFrontendEnvConfig({
            apiUrl: "https://api.tiffzy.com",
            apiBaseUrl: "https://staging-api.tiffzy.com",
            socketUrl: "https://staging-api.tiffzy.com",
            isProd: true,
            hostname: "cafe-system-3ttgzslpf-anilchowdary4531s-projects.vercel.app",
        });
        expect(previewBaseOverridesDefaultProd).toEqual({
            API_BASE_URL: "https://staging-api.tiffzy.com",
            SOCKET_URL: "https://staging-api.tiffzy.com",
            IS_MISCONFIGURED_PREVIEW: false,
        });
    });
});
