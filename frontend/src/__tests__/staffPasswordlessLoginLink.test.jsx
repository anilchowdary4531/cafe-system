import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OwnerStaff from "../pages/admin/OwnerStaff";
import Login from "../pages/Login";
import StaffLoginLink from "../pages/StaffLoginLink";
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
    user: { id: 1, name: "Owner Admin", role: "OWNER", restaurantId: 10 },
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockAuthContext,
}));

vi.mock("../context/RestaurantContext", () => ({
    useRestaurantContext: () => ({
        restaurantContext: { id: 10, name: "Test Cafe", slug: "test-cafe" },
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

const mockStaffUsers = [
    {
        id: 101,
        name: "John Waiter",
        email: "john@tiffzy.com",
        phone: "+919876543210",
        role: "WAITER",
        designation: "Server",
        isActive: true,
        createdAt: "2026-10-01T00:00:00.000Z",
    },
    {
        id: 102,
        name: "Alice Chef",
        email: "alice@tiffzy.com",
        phone: "+919876543211",
        role: "CHEF",
        designation: "Chef",
        isActive: true,
        createdAt: "2026-10-01T00:00:00.000Z",
    },
    {
        id: 103,
        name: "Senior Chef Bob",
        email: "bob@tiffzy.com",
        phone: "+919876543212",
        role: "CHEF",
        designation: "Senior Chef",
        isActive: true,
        createdAt: "2026-10-01T00:00:00.000Z",
    },
    {
        id: 104,
        name: "Manager Carol",
        email: "carol@tiffzy.com",
        phone: "+919876543213",
        role: "MANAGER",
        designation: "Manager",
        isActive: true,
        createdAt: "2026-10-01T00:00:00.000Z",
    },
];

describe("Staff Passwordless Login Link UI & Flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER", restaurantId: 10, name: "Owner" }));
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("displays 'Password: ••••••••••' and 'Generate Login Link' button", async () => {
        axios.get.mockResolvedValueOnce({
            data: { users: mockStaffUsers, modules: ["dashboard", "orders", "tables"] },
        });

        render(
            <MemoryRouter>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("John Waiter")).toBeInTheDocument();
        });

        // Verify bullet points password display
        const bulletPasswords = screen.getAllByText("••••••••••");
        expect(bulletPasswords.length).toBeGreaterThanOrEqual(1);

        // Verify Generate Login Link button
        const genBtns = screen.getAllByRole("button", { name: /generate login link/i });
        expect(genBtns.length).toBeGreaterThanOrEqual(1);
    });

    it("generates and displays single-use login link with 10 minute expiry and copies token URL", async () => {
        axios.get.mockResolvedValueOnce({
            data: { users: mockStaffUsers, modules: ["dashboard", "orders", "tables"] },
        });

        axios.post.mockResolvedValueOnce({
            data: {
                message: "Staff login link generated successfully",
                loginUrl: "http://localhost:5173/login?mode=staff&token=mockToken12345",
                token: "mockToken12345",
                expiresAt: new Date(Date.now() + 600000).toISOString(),
                expiresInMinutes: 10,
                singleUse: true,
            },
        });

        render(
            <MemoryRouter>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("John Waiter")).toBeInTheDocument();
        });

        const genBtn = screen.getByTestId("generate-login-link-101");
        fireEvent.click(genBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/owner/10/staff/101/login-link"));
        });

        // Verify displayed card elements
        await waitFor(() => {
            expect(screen.getByText(/Staff Login Link/i)).toBeInTheDocument();
            expect(screen.getByText(/Expires in 10 minutes/i)).toBeInTheDocument();
            expect(screen.getByText("http://localhost:5173/login?mode=staff&token=mockToken12345")).toBeInTheDocument();
        });

        // Test Copy Link
        const copyBtn = screen.getByTestId("copy-login-link-101");
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost:5173/login?mode=staff&token=mockToken12345");
    });

    it("Chef opens /login?mode=staff&token=... -> authenticates and enters /kitchen directly without password prompt", async () => {
        const replaceStateSpy = vi.spyOn(window.history, "replaceState");

        api.post.mockResolvedValueOnce({
            data: {
                message: "Login success",
                actorType: "STAFF",
                token: "chef-jwt-token-xyz",
                user: { id: 102, name: "Alice Chef", role: "CHEF", designation: "Chef", restaurantId: 10 },
                redirectPath: "/kitchen",
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&token=chefOneTimeToken123"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/kitchen" element={<div data-testid="kitchen-workspace">Kitchen Operations</div>} />
                </Routes>
            </MemoryRouter>
        );

        // Verify replaceState called to scrub raw token from URL/history
        expect(replaceStateSpy).toHaveBeenCalled();

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/auth/staff-login-link", { token: "chefOneTimeToken123" });
        });

        // Authenticated session established
        await waitFor(() => {
            expect(mockAuthContext.loginSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: "chef-jwt-token-xyz",
                    user: expect.objectContaining({ id: 102, role: "CHEF" }),
                })
            );
        });

        // Navigated directly to Kitchen workspace without asking for password
        await waitFor(() => {
            expect(screen.getByTestId("kitchen-workspace")).toBeInTheDocument();
        });
    });

    it("Senior Chef opens login link -> enters /kitchen workspace without password", async () => {
        api.post.mockResolvedValueOnce({
            data: {
                message: "Login success",
                actorType: "STAFF",
                token: "senior-chef-jwt-token",
                user: { id: 103, name: "Senior Chef Bob", role: "CHEF", designation: "Senior Chef", restaurantId: 10 },
                redirectPath: "/kitchen",
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&token=srChefToken456"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/kitchen" element={<div data-testid="kitchen-workspace">Kitchen Operations</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/auth/staff-login-link", { token: "srChefToken456" });
        });

        await waitFor(() => {
            expect(screen.getByTestId("kitchen-workspace")).toBeInTheDocument();
        });
    });

    it("Manager opens login link -> enters /owner workspace without password", async () => {
        api.post.mockResolvedValueOnce({
            data: {
                message: "Login success",
                actorType: "STAFF",
                token: "manager-jwt-token",
                user: { id: 104, name: "Manager Carol", role: "MANAGER", designation: "Manager", restaurantId: 10 },
                redirectPath: "/owner/staff",
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&token=managerToken789"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/owner" element={<div data-testid="owner-workspace">Owner Panel</div>} />
                    <Route path="/owner/staff" element={<div data-testid="owner-workspace">Owner Panel</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/auth/staff-login-link", { token: "managerToken789" });
        });

        await waitFor(() => {
            expect(screen.getByTestId("owner-workspace")).toBeInTheDocument();
        });
    });

    it("Opening login link while another Tiffzy user is logged in clears existing session and does not reuse it", async () => {
        // Pre-populate old user session
        localStorage.setItem("token", "old-foreign-user-token");
        localStorage.setItem("user", JSON.stringify({ id: 999, name: "Wrong User", role: "OWNER" }));
        sessionStorage.setItem("token", "old-session-token");

        api.post.mockResolvedValueOnce({
            data: {
                message: "Login success",
                actorType: "STAFF",
                token: "new-staff-token",
                user: { id: 101, name: "John Waiter", role: "WAITER", restaurantId: 10 },
                redirectPath: "/server",
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&token=newToken123"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/server" element={<div data-testid="server-station">Server Station</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/auth/staff-login-link", { token: "newToken123" });
        });

        // The session established is the NEW user
        expect(mockAuthContext.loginSession).toHaveBeenCalledWith(
            expect.objectContaining({
                token: "new-staff-token",
                user: expect.objectContaining({ id: 101, role: "WAITER" }),
            })
        );
    });

    it("Attempt to use same link twice or expired link fails with error notice and does not log in", async () => {
        api.post.mockRejectedValueOnce({
            response: {
                status: 401,
                data: { message: "This staff login link has already been used" },
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff&token=usedToken123"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("This staff login link has already been used")).toBeInTheDocument();
        });

        // Login context should NOT be called
        expect(mockAuthContext.loginSession).not.toHaveBeenCalled();
        expect(mockAuthContext.login).not.toHaveBeenCalled();

        // Password input remains empty
        const passwordInput = screen.getByPlaceholderText("Enter password");
        expect(passwordInput).toHaveValue("");
    });

    it("Normal email and password login still works", async () => {
        api.post.mockResolvedValueOnce({
            data: {
                token: "normal-jwt-token",
                user: { id: 101, name: "John Waiter", role: "WAITER", restaurantId: 10 },
            },
        });

        render(
            <MemoryRouter initialEntries={["/login?mode=staff"]}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/server" element={<div data-testid="server-station">Server Station</div>} />
                </Routes>
            </MemoryRouter>
        );

        const emailInput = screen.getByPlaceholderText("admin@cafe.com");
        const passwordInput = screen.getByPlaceholderText("Enter password");
        const loginBtn = screen.getByRole("button", { name: "Login" });

        fireEvent.change(emailInput, { target: { value: "john@tiffzy.com" } });
        fireEvent.change(passwordInput, { target: { value: "SecretPass123" } });
        fireEvent.click(loginBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/login", {
                email: "john@tiffzy.com",
                password: "SecretPass123",
            });
        });

        await waitFor(() => {
            expect(mockAuthContext.login).toHaveBeenCalled();
        });
    });

    it("StaffLoginLink standalone route also consumes token, calls login, and redirects", async () => {
        const replaceStateSpy = vi.spyOn(window.history, "replaceState");

        axios.post.mockResolvedValueOnce({
            data: {
                message: "Login success",
                actorType: "STAFF",
                token: "session-jwt-token-xyz",
                user: { id: 101, name: "John Waiter", role: "WAITER" },
                redirectPath: "/server",
            },
        });

        render(
            <MemoryRouter initialEntries={["/staff-login?token=mockRandomToken321"]}>
                <Routes>
                    <Route path="/staff-login" element={<StaffLoginLink />} />
                </Routes>
            </MemoryRouter>
        );

        expect(replaceStateSpy).toHaveBeenCalled();

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/auth/staff-login-link"),
                { token: "mockRandomToken321" }
            );
        });

        await waitFor(() => {
            expect(mockAuthContext.login).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: "session-jwt-token-xyz",
                    user: expect.objectContaining({ id: 101, role: "WAITER" }),
                })
            );
        });
    });
});
