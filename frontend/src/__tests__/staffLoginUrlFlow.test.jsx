import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../pages/Login";
import OwnerStaff from "../pages/admin/OwnerStaff";
import StaffDirectoryDrawer from "../components/StaffDirectoryDrawer";
import axios from "axios";
import { api } from "../utils/apiClient";

vi.mock("axios");
vi.mock("../utils/apiClient", () => ({
    api: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

const mockAuthContext = {
    login: vi.fn(),
    loginSession: vi.fn(),
    loginCustomer: vi.fn(),
    customer: null,
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockAuthContext,
}));

vi.mock("../context/RestaurantContext", () => ({
    useRestaurantContext: () => ({
        restaurantContext: { id: 1, name: "Test Cafe", slug: "test-cafe" },
        setRestaurantContext: vi.fn(),
    }),
}));

vi.mock("../context/LanguageContext", () => ({
    useLanguage: () => ({
        t: (k) => k,
        language: "en",
        currentLanguageObj: { code: "en", name: "English", flag: "🇬🇧" },
        languages: [{ code: "en", name: "English", flag: "🇬🇧" }],
        setLanguage: vi.fn(),
    }),
}));

describe("Staff Login URL & Password Flow Security", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
        window.open = vi.fn();
    });

    it("1. Staff Login URL pre-fills email and leaves password empty with security guidance", async () => {
        render(
            <MemoryRouter initialEntries={["/login?mode=staff&email=kakkaka%40gmail.com"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                </Routes>
            </MemoryRouter>
        );

        // Mode is staff
        expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();

        // Email input is prefilled with decoded email
        const emailInput = screen.getByPlaceholderText("admin@cafe.com");
        expect(emailInput).toHaveValue("kakkaka@gmail.com");

        // Password input is EMPTY
        const passwordInput = screen.getByPlaceholderText("Enter password");
        expect(passwordInput).toHaveValue("");

        // Guidance banner explaining password entry is visible
        expect(screen.getByText(/Staff Login:/i)).toBeInTheDocument();
        expect(screen.getByText(/Email is pre-filled from your login link/i)).toBeInTheDocument();
        expect(screen.getByText(/Please enter your password or the temporary password/i)).toBeInTheDocument();
    });

    it("2. Password field remains interactive and allows typing password", async () => {
        render(
            <MemoryRouter initialEntries={["/login?mode=staff&email=kakkaka%40gmail.com"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                </Routes>
            </MemoryRouter>
        );

        const passwordInput = screen.getByPlaceholderText("Enter password");
        fireEvent.change(passwordInput, { target: { value: "SecretPass123!" } });
        expect(passwordInput).toHaveValue("SecretPass123!");
    });

    it("3. Successful staff login with credentials succeeds", async () => {
        api.post.mockResolvedValueOnce({
            data: {
                token: "staff-jwt-token-xyz",
                user: {
                    id: 10,
                    name: "Alice Waiter",
                    email: "alice@restaurant.com",
                    role: "WAITER",
                    restaurantId: 1,
                },
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&email=alice%40restaurant.com"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/server" element={<div>Server Workspace</div>} />
                </Routes>
            </MemoryRouter>
        );

        const passwordInput = screen.getByPlaceholderText("Enter password");
        fireEvent.change(passwordInput, { target: { value: "Staff#ValidPass" } });

        const loginButton = screen.getByRole("button", { name: "Login" });
        fireEvent.click(loginButton);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/login", {
                email: "alice@restaurant.com",
                password: "Staff#ValidPass",
            });
            expect(mockAuthContext.login).toHaveBeenCalled();
        });
    });

    it("4. Invalid password shows error message safely", async () => {
        api.post.mockRejectedValueOnce({
            response: {
                data: { message: "Invalid email or password" },
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&email=alice%40restaurant.com"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                </Routes>
            </MemoryRouter>
        );

        const passwordInput = screen.getByPlaceholderText("Enter password");
        fireEvent.change(passwordInput, { target: { value: "WrongPassword" } });

        const loginButton = screen.getByRole("button", { name: "Login" });
        fireEvent.click(loginButton);

        await waitFor(() => {
            expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
        });
    });

    it("5. Staff Directory Drawer displays password notice on staff cards and in WhatsApp share text", async () => {
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    id: 10,
                    name: "Bob Cashier",
                    email: "bob@restaurant.com",
                    phone: "+1234567890",
                    role: "CASHIER",
                    isActive: true,
                },
            ],
        });

        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Bob Cashier")).toBeInTheDocument();
        });

        // Notice that password must be entered separately
        expect(
            screen.getByText(/Password must be entered separately at login/i)
        ).toBeInTheDocument();

        // WhatsApp share button contains explicit note
        const whatsappBtn = screen.getByRole("button", { name: /whatsapp/i });
        fireEvent.click(whatsappBtn);

        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining(encodeURIComponent("Please enter your staff password")),
            "_blank"
        );
    });

    it("6. OwnerStaff page cards show safe login links and note password is required separately", async () => {
        localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER", restaurantId: 1 }));

        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 20,
                        name: "Charlie Chef",
                        email: "charlie@restaurant.com",
                        phone: "+9876543210",
                        role: "CHEF",
                        designation: "Senior Chef",
                        isActive: true,
                        loginLink: "http://localhost:5173/login?mode=staff&email=charlie%40restaurant.com",
                        createdAt: new Date().toISOString(),
                    },
                ],
                modules: ["dashboard", "kitchen"],
            },
        });

        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Charlie Chef")).toBeInTheDocument();
        });

        // Verify login URL in code block does NOT have password or token
        const loginCode = screen.getByText(/mode=staff/i);
        expect(loginCode.textContent).toContain("email=charlie%40restaurant.com");
        expect(loginCode.textContent).not.toContain("password");
        expect(loginCode.textContent).not.toContain("token");

        // Verify notice below button
        expect(
            screen.getByText(/Password must be entered separately at login/i)
        ).toBeInTheDocument();
    });
});
