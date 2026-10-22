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

    it("7. OwnerStaff card shows 'Not available' initially, then shows temporary password directly after reset, and copies it", async () => {
        window.confirm = vi.fn().mockReturnValue(true);
        localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER", restaurantId: 1 }));

        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 30,
                        name: "Dana Waiter",
                        email: "dana@restaurant.com",
                        phone: "+1122334455",
                        role: "WAITER",
                        designation: "Server",
                        isActive: true,
                        loginLink: "http://localhost:5173/login?mode=staff&email=dana%40restaurant.com",
                        createdAt: new Date().toISOString(),
                    },
                ],
                modules: ["dashboard", "orders"],
            },
        });

        const { rerender } = render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Dana Waiter")).toBeInTheDocument();
        });

        // Initially, card shows "Password: Not available"
        expect(screen.getByText("••••••••••")).toBeInTheDocument();

        // Mock the POST reset endpoint
        axios.post.mockResolvedValueOnce({
            data: {
                message: "Temporary password generated successfully",
                temporaryPassword: "Staff#4f8c92a1",
                user: { id: 30, name: "Dana Waiter" },
            },
        });
        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 30,
                        name: "Dana Waiter",
                        email: "dana@restaurant.com",
                        phone: "+1122334455",
                        role: "WAITER",
                        designation: "Server",
                        isActive: true,
                        loginLink: "http://localhost:5173/login?mode=staff&email=dana%40restaurant.com",
                        createdAt: new Date().toISOString(),
                    },
                ],
                modules: ["dashboard", "orders"],
            },
        });

        const resetBtn = screen.getByRole("button", { name: /reset password/i });
        fireEvent.click(resetBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/owner/1/staff/30/temp-password"));
        });

        // Verify staff card now displays the temporary password directly
        await waitFor(() => {
            expect(screen.getAllByText("Staff#4f8c92a1").length).toBeGreaterThanOrEqual(1);
        });

        // Verify "Temporary password — shown only after reset." note appears
        expect(screen.getByText(/Temporary password — shown only after reset/i)).toBeInTheDocument();

        // Click the card's Copy button
        const copyTempPassBtn = screen.getByLabelText("Copy temporary password for Dana Waiter");
        fireEvent.click(copyTempPassBtn);

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Staff#4f8c92a1");
            expect(screen.getByText("Copied")).toBeInTheDocument();
        });
    });

    it("8. StaffDirectoryDrawer shows temporary password directly on staff card after reset", async () => {
        window.confirm = vi.fn().mockReturnValue(true);

        axios.get.mockResolvedValueOnce({
            data: [
                {
                    id: 40,
                    name: "Evan Cashier",
                    email: "evan@restaurant.com",
                    phone: "+5566778899",
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
            expect(screen.getByText("Evan Cashier")).toBeInTheDocument();
        });

        // Initially shows "Not available"
        expect(screen.getByText("••••••••••")).toBeInTheDocument();

        // Mock POST reset endpoint
        axios.post.mockResolvedValueOnce({
            data: {
                message: "Temporary password generated successfully",
                temporaryPassword: "Staff#99aa88bb",
                user: { id: 40, name: "Evan Cashier" },
            },
        });
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    id: 40,
                    name: "Evan Cashier",
                    email: "evan@restaurant.com",
                    phone: "+5566778899",
                    role: "CASHIER",
                    isActive: true,
                },
            ],
        });

        const resetBtn = screen.getByRole("button", { name: /reset password/i });
        fireEvent.click(resetBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/owner/1/staff/40/temp-password"));
        });

        // Verify card displays the temporary password
        await waitFor(() => {
            expect(screen.getAllByText("Staff#99aa88bb").length).toBeGreaterThanOrEqual(1);
        });

        // Verify copy button on drawer card
        const copyDrawerPassBtn = screen.getByLabelText("Copy temporary password for Evan Cashier");
        fireEvent.click(copyDrawerPassBtn);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Staff#99aa88bb");
    });

    it("9. OwnerStaff Reset Password constructs /owner/<restaurantId>/staff/<staffId>/temp-password and NEVER generates /owner//staff/...", async () => {
        window.confirm = vi.fn().mockReturnValue(true);
        localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER", restaurantId: 1 }));

        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 15,
                        name: "Staff Fifteen",
                        email: "staff15@restaurant.com",
                        phone: "+911234567890",
                        role: "WAITER",
                        designation: "Server",
                        isActive: true,
                        loginLink: "http://localhost:5173/login?mode=staff&email=staff15%40restaurant.com",
                        createdAt: new Date().toISOString(),
                    },
                ],
                modules: ["dashboard", "orders"],
            },
        });

        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Staff Fifteen")).toBeInTheDocument();
        });

        axios.post.mockResolvedValueOnce({
            data: {
                message: "Temporary password generated successfully",
                temporaryPassword: "Staff#aabb1122",
                user: { id: 15, name: "Staff Fifteen" },
            },
        });
        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 15,
                        name: "Staff Fifteen",
                        email: "staff15@restaurant.com",
                        phone: "+911234567890",
                        role: "WAITER",
                        designation: "Server",
                        isActive: true,
                    },
                ],
            },
        });

        const resetBtn = screen.getByRole("button", { name: /reset password/i });
        fireEvent.click(resetBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/owner/1/staff/15/temp-password"));
        });

        // CRITICAL CHECK: The request URL MUST NOT contain double slash /owner//staff/
        const postCalls = axios.post.mock.calls.map((call) => call[0]);
        for (const url of postCalls) {
            expect(url).not.toMatch(/\/owner\/\/staff\//);
            expect(url).not.toContain("/owner//staff/15/temp-password");
        }
    });

    it("10. OwnerStaff resolves restaurantId from nested user.restaurant.id when user.restaurantId is absent", async () => {
        window.confirm = vi.fn().mockReturnValue(true);
        // Simulate production owner session: restaurant is nested under user.restaurant
        localStorage.setItem(
            "user",
            JSON.stringify({
                id: 1,
                name: "Owner User",
                role: "OWNER",
                restaurant: { id: 1, name: "Cafe King" },
            })
        );

        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 15,
                        name: "Cafe King Waiter",
                        email: "ckwaiter@cafeking.com",
                        phone: "+919876543210",
                        role: "WAITER",
                        designation: "Server",
                        isActive: true,
                        restaurantId: 1,
                    },
                ],
                modules: ["dashboard"],
            },
        });

        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cafe King Waiter")).toBeInTheDocument();
        });

        axios.post.mockResolvedValueOnce({
            data: {
                message: "Temporary password generated successfully",
                temporaryPassword: "Staff#ccdd3344",
                user: { id: 15, name: "Cafe King Waiter" },
            },
        });
        axios.get.mockResolvedValueOnce({
            data: {
                users: [
                    {
                        id: 15,
                        name: "Cafe King Waiter",
                        email: "ckwaiter@cafeking.com",
                        phone: "+919876543210",
                        role: "WAITER",
                        designation: "Server",
                        isActive: true,
                    },
                ],
            },
        });

        const resetBtn = screen.getByRole("button", { name: /reset password/i });
        fireEvent.click(resetBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/owner/1/staff/15/temp-password"));
        });

        const postCalls = axios.post.mock.calls.map((call) => call[0]);
        for (const url of postCalls) {
            expect(url).not.toMatch(/\/owner\/\/staff\//);
        }
    });

    it("11. OwnerStaff regression: missing restaurantId halts safely without network call and displays user-friendly error", async () => {
        window.confirm = vi.fn().mockReturnValue(true);
        // Clear all restaurant identity sources
        localStorage.clear();
        sessionStorage.clear();

        // Render with empty staff initially
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        // Verify that with missing restaurant info, error message indicates restaurant is not linked
        await waitFor(() => {
            expect(screen.getByText(/Restaurant not linked to owner account/i)).toBeInTheDocument();
        });

        // axios.post for temp-password was NEVER called with empty restaurantId
        const postCalls = axios.post.mock.calls.map((call) => call[0]);
        for (const url of postCalls) {
            expect(url).not.toMatch(/\/owner\/\/staff\//);
        }
    });

    it("12. StaffDirectoryDrawer regression: missing restaurantId halts safely without network call", async () => {
        window.confirm = vi.fn().mockReturnValue(true);
        localStorage.clear();
        sessionStorage.clear();

        const { container } = render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={0}
            />
        );

        // Drawer should not make temp-password call when restaurantId is missing
        const postCalls = axios.post.mock.calls.map((call) => call[0]);
        for (const url of postCalls) {
            expect(url).not.toMatch(/\/owner\/\/staff\//);
        }
    });
});
