import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Login from "../pages/Login.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

let lastPostCall = null;
let postCalls = [];

const mockPost = vi.fn().mockImplementation((url, body) => {
    lastPostCall = { url, body };
    postCalls.push({ url, body });

    if (url === "/customer/send-otp") {
        const raw = body.identifier || body.email || body.phone || "";
        const isEmail = raw.includes("@");
        const channel = isEmail ? "EMAIL" : "WHATSAPP";
        let masked = "";
        if (isEmail) {
            const [name, domain] = raw.split("@");
            masked = `${name[0]}******@${domain}`;
        } else {
            const digits = String(raw).replace(/\D/g, "");
            masked = `******${digits.slice(-4)}`;
        }

        return Promise.resolve({
            data: {
                success: true,
                channel,
                identifierType: isEmail ? "EMAIL" : "PHONE",
                destination: raw,
                maskedDestination: masked,
                phone: isEmail ? "" : raw,
                email: isEmail ? raw : null,
                expiresAt: Date.now() + 60000,
                devOtp: "123456",
                delivery: {
                    whatsApp: !isEmail ? { ok: true, accepted: true } : null,
                    email: isEmail ? { ok: true, accepted: true } : null,
                },
            },
        });
    }

    if (url === "/customer/verify-otp") {
        return Promise.resolve({
            data: {
                token: "customer_jwt_token_123",
                customer: {
                    id: "cust_1",
                    name: body.name || "Test Customer",
                    email: body.email || null,
                    phone: body.phone || null,
                },
            },
        });
    }

    return Promise.resolve({ data: {} });
});

vi.mock("../utils/apiClient", async () => {
    const actual = await vi.importActual("../utils/apiClient");
    return {
        ...actual,
        api: {
            get: vi.fn().mockResolvedValue({ data: [] }),
            post: (...args) => mockPost(...args),
            delete: vi.fn().mockResolvedValue({ data: {} }),
        },
        cachedGet: vi.fn().mockResolvedValue([]),
    };
});

function renderTestLogin(initialEntry = "/login?mode=customer") {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <LanguageProvider>
                <RestaurantThemeProvider>
                    <RestaurantContextProvider>
                        <AuthProvider>
                            <CartProvider>
                                <Routes>
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/" element={<div>Home Page</div>} />
                                </Routes>
                            </CartProvider>
                        </AuthProvider>
                    </RestaurantContextProvider>
                </RestaurantThemeProvider>
            </LanguageProvider>
        </MemoryRouter>
    );
}

describe("Customer OTP Login — Delivery Channel UI & Handler Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        lastPostCall = null;
        postCalls = [];
    });

    it("1. Email request: input = customer@example.com -> UI says 'OTP sent to your email.' and does NOT say 'WhatsApp'", async () => {
        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "customer@example.com" } });

        const sendBtn = screen.getByRole("button", { name: /Send OTP/i });
        fireEvent.click(sendBtn);

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith(
                "/customer/send-otp",
                expect.objectContaining({
                    identifier: "customer@example.com",
                    email: "customer@example.com",
                    phone: "",
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
            expect(screen.getByText(/Email: c\*\*\*\*\*\*@example\.com/i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your WhatsApp/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/WhatsApp:/i)).not.toBeInTheDocument();
        });
    });

    it("2. Mobile request: input = 9876543210 -> UI says 'OTP sent to your WhatsApp.' and does NOT say 'email'", async () => {
        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9876543210" } });

        const sendBtn = screen.getByRole("button", { name: /Send OTP/i });
        fireEvent.click(sendBtn);

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith(
                "/customer/send-otp",
                expect.objectContaining({
                    identifier: "9876543210",
                    phone: "9876543210",
                    email: "",
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
            expect(screen.getByText(/WhatsApp: \*\*\*\*\*\*3210/i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your email/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Email:/i)).not.toBeInTheDocument();
        });
    });

    it("3. Email -> resend preserves EMAIL channel", async () => {
        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "user@domain.com" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
        });

        expect(lastPostCall.body.identifier).toBe("user@domain.com");
        expect(lastPostCall.body.email).toBe("user@domain.com");

        // Click Resend OTP
        const resendBtn = screen.getByRole("button", { name: /Resend OTP/i });
        fireEvent.click(resendBtn);

        await waitFor(() => {
            expect(lastPostCall.body.identifier).toBe("user@domain.com");
            expect(lastPostCall.body.email).toBe("user@domain.com");
            expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your WhatsApp/i)).not.toBeInTheDocument();
        });
    });

    it("4. Mobile -> resend preserves WHATSAPP channel", async () => {
        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9123456789" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
        });

        expect(lastPostCall.body.identifier).toBe("9123456789");
        expect(lastPostCall.body.phone).toBe("9123456789");

        // Click Resend OTP
        const resendBtn = screen.getByRole("button", { name: /Resend OTP/i });
        fireEvent.click(resendBtn);

        await waitFor(() => {
            expect(lastPostCall.body.identifier).toBe("9123456789");
            expect(lastPostCall.body.phone).toBe("9123456789");
            expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your email/i)).not.toBeInTheDocument();
        });
    });

    it("5. Email -> Change Contact -> Mobile: new request displays WhatsApp", async () => {
        renderTestLogin();

        // 1st request: Email
        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "cust@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
        });

        // Click Change Contact Info
        const changeBtn = screen.getByRole("button", { name: /Change Contact Info/i });
        fireEvent.click(changeBtn);

        // 2nd request: Mobile
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Enter phone number or email address/i)).toBeInTheDocument();
        });

        const input2 = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input2, { target: { value: "9876543210" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
            expect(screen.getByText(/WhatsApp: \*\*\*\*\*\*3210/i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your email/i)).not.toBeInTheDocument();
        });
    });

    it("6. Mobile -> Change Contact -> Email: new request displays Email", async () => {
        renderTestLogin();

        // 1st request: Mobile
        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9876543210" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
        });

        // Click Change Contact Info
        const changeBtn = screen.getByRole("button", { name: /Change Contact Info/i });
        fireEvent.click(changeBtn);

        // 2nd request: Email
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Enter phone number or email address/i)).toBeInTheDocument();
        });

        const input2 = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input2, { target: { value: "customer@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
            expect(screen.getByText(/Email: c\*\*\*\*\*\*@example\.com/i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your WhatsApp/i)).not.toBeInTheDocument();
        });
    });

    it("7. Customer profile contains BOTH phone and email: entering email still displays EMAIL", async () => {
        // Mock AuthProvider initial customer having both phone and email
        localStorage.setItem("tiffzy_customer_user", JSON.stringify({
            id: "cust_dual",
            name: "Dual Customer",
            phone: "9199999988",
            email: "dual@example.com",
        }));

        try {
            renderTestLogin();

            const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
            fireEvent.change(input, { target: { value: "dual@example.com" } });
            fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

            await waitFor(() => {
                expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
                expect(screen.getByText(/Email: d\*\*\*\*\*\*@example\.com/i)).toBeInTheDocument();
                expect(screen.queryByText(/OTP sent to your WhatsApp/i)).not.toBeInTheDocument();
                expect(screen.queryByText(/\*\*\*\*\*\*9988/)).not.toBeInTheDocument();
            });
        } finally {
            localStorage.removeItem("tiffzy_customer_user");
        }
    });

    it("8. Customer profile contains BOTH phone and email: entering mobile still displays WHATSAPP", async () => {
        localStorage.setItem("tiffzy_customer_user", JSON.stringify({
            id: "cust_dual",
            name: "Dual Customer",
            phone: "9199999988",
            email: "dual@example.com",
        }));

        try {
            renderTestLogin();

            const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
            fireEvent.change(input, { target: { value: "9199999988" } });
            fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

            await waitFor(() => {
                expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
                expect(screen.getByText(/WhatsApp: \*\*\*\*\*\*9988/i)).toBeInTheDocument();
                expect(screen.queryByText(/OTP sent to your email/i)).not.toBeInTheDocument();
            });
        } finally {
            localStorage.removeItem("tiffzy_customer_user");
        }
    });

    it("9. Stale otpChannel cannot leak from a previous login attempt", async () => {
        const { unmount } = renderTestLogin("/login?mode=customer");

        // Submit mobile first
        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9876543210" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your WhatsApp\./i)).toBeInTheDocument();
        });

        // Unmount component (simulates navigation away)
        unmount();

        // Render fresh login page with email
        renderTestLogin("/login?mode=customer");
        const freshInput = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(freshInput, { target: { value: "newuser@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/OTP sent to your email\./i)).toBeInTheDocument();
            expect(screen.getByText(/Email: n\*\*\*\*\*\*@example\.com/i)).toBeInTheDocument();
            expect(screen.queryByText(/OTP sent to your WhatsApp/i)).not.toBeInTheDocument();
        });
    });

    it("10. Masked destination corresponds strictly to the current channel and input", async () => {
        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "special.order@cafe.com" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            expect(screen.getByText(/Email: s\*\*\*\*\*\*@cafe\.com/i)).toBeInTheDocument();
            expect(screen.queryByText(/WhatsApp:/i)).not.toBeInTheDocument();
        });
    });

    it("11. Successful OTP send displays GREEN success alert with checkmark, NOT red/pink", async () => {
        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9876543210" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            // Find the OTP sent success alert
            const alertText = screen.getByText(/^OTP sent$/i);
            expect(alertText).toBeInTheDocument();

            // Locate container element for the alert
            const alertContainer = alertText.closest("div");
            expect(alertContainer).toHaveClass("bg-emerald-500/10");
            expect(alertContainer).toHaveClass("border-emerald-500/30");
            expect(alertContainer).not.toHaveClass("bg-red-500/15");
            expect(alertContainer).not.toHaveClass("text-red-600");
        });
    });

    it("12. Provider failure (HTTP 502) displays RED error alert, NOT green", async () => {
        mockPost.mockRejectedValueOnce({
            response: {
                status: 502,
                data: { success: false, message: "WhatsApp provider rejected message" },
            },
            message: "WhatsApp provider rejected message",
        });

        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9876543210" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            const errText = screen.getByText(/WhatsApp provider rejected message/i);
            expect(errText).toBeInTheDocument();

            const alertContainer = errText.closest("div");
            expect(alertContainer).toHaveClass("bg-red-500/15");
            expect(alertContainer).toHaveClass("border-red-500/30");
            expect(alertContainer).not.toHaveClass("bg-emerald-500/10");
        });
    });

    it("13. Cooldown (HTTP 429) displays AMBER warning alert", async () => {
        mockPost.mockRejectedValueOnce({
            response: {
                status: 429,
                data: { success: false, message: "OTP already sent recently. Please wait a moment and try again." },
            },
            message: "OTP already sent recently. Please wait a moment and try again.",
        });

        renderTestLogin();

        const input = screen.getByPlaceholderText(/Enter phone number or email address/i);
        fireEvent.change(input, { target: { value: "9876543210" } });
        fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));

        await waitFor(() => {
            const warnText = screen.getByText(/OTP already sent recently/i);
            expect(warnText).toBeInTheDocument();

            const alertContainer = warnText.closest("div");
            expect(alertContainer).toHaveClass("bg-amber-500/15");
            expect(alertContainer).toHaveClass("border-amber-500/30");
            expect(alertContainer).not.toHaveClass("bg-red-500/15");
            expect(alertContainer).not.toHaveClass("bg-emerald-500/10");
        });
    });
});

