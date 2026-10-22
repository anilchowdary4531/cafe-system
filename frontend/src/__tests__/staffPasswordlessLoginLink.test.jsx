import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OwnerStaff from "../pages/admin/OwnerStaff";
import StaffLoginLink from "../pages/StaffLoginLink";
import axios from "axios";

vi.mock("axios");

const mockAuthContext = {
    login: vi.fn(),
    user: { id: 1, name: "Owner Admin", role: "OWNER", restaurantId: 10 },
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockAuthContext,
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
];

describe("Staff Passwordless Login Link UI & Flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER", restaurantId: 10, name: "Owner" }));
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("displays 'Password: ••••••••••' and 'Generate Login Link' button instead of 'Not available'", async () => {
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

        // Verify "Not available" is absent
        expect(screen.queryByText("Not available")).not.toBeInTheDocument();

        // Verify bullet points password display
        const bulletPasswords = screen.getAllByText("••••••••••");
        expect(bulletPasswords.length).toBeGreaterThanOrEqual(1);

        // Verify Generate Login Link button
        const genBtns = screen.getAllByRole("button", { name: /generate login link/i });
        expect(genBtns.length).toBeGreaterThanOrEqual(1);
    });

    it("generates and displays single-use login link with 10 minute expiry", async () => {
        axios.get.mockResolvedValueOnce({
            data: { users: mockStaffUsers, modules: ["dashboard", "orders", "tables"] },
        });

        axios.post.mockResolvedValueOnce({
            data: {
                message: "Staff login link generated successfully",
                loginUrl: "https://www.tiffzy.com/staff-login?token=abc123xyz789randomtoken",
                token: "abc123xyz789randomtoken",
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
            expect(screen.getByText(/Single-use login link/i)).toBeInTheDocument();
            expect(screen.getByText("https://www.tiffzy.com/staff-login?token=abc123xyz789randomtoken")).toBeInTheDocument();
        });

        // Test Copy Link
        const copyBtn = screen.getByTestId("copy-login-link-101");
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://www.tiffzy.com/staff-login?token=abc123xyz789randomtoken");
    });

    it("StaffLoginLink component consumes token, calls login, and removes token from URL", async () => {
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

        // Verify replaceState was called to scrub the raw token
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

    it("StaffLoginLink handles expired or invalid tokens with safe error display", async () => {
        axios.post.mockRejectedValueOnce({
            response: {
                status: 401,
                data: { message: "This staff login link has expired" },
            },
        });

        render(
            <MemoryRouter initialEntries={["/staff-login?token=expiredToken123"]}>
                <Routes>
                    <Route path="/staff-login" element={<StaffLoginLink />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Login Link Invalid/i)).toBeInTheDocument();
            expect(screen.getByText(/This staff login link has expired/i)).toBeInTheDocument();
            expect(screen.getByText(/Go to Staff Login/i)).toBeInTheDocument();
        });
    });
});
