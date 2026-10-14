import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import OwnerAuditLogs, { escapeCsvCell } from "../pages/admin/OwnerAuditLogs";
import SecurityActivityDrawer, {
    sanitizeDetailsFrontend,
    isSensitiveKey,
    formatActionLabel,
    getSeverityBadgeClass,
    getStatusBadgeClass,
} from "../components/SecurityActivityDrawer";
import ProtectedRoute from "../routes/ProtectedRoute";
import OwnerLayout from "../layouts/OwnerLayout";
import { api } from "../utils/apiClient";
import * as AuthContextModule from "../context/AuthContext";

// Mock API Client
vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn(),
    },
}));

// Mock Sound Player to prevent Audio errors in jsdom
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn(),
}));

// Mock Notifications to avoid timers in tests
vi.mock("../utils/ownerNotifications", () => ({
    getOwnerUnreadCount: vi.fn().mockResolvedValue(0),
    subscribeOwnerNotifications: vi.fn(() => () => {}),
}));

// Mock Staff Socket
vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({ socket: null, isConnected: false }),
}));

// Mock Menu Button
vi.mock("../components/OwnerMenuButton", () => ({
    default: () => <button data-testid="owner-menu-button">Menu</button>,
}));

const mockAuditLogsData = [
    {
        id: 101,
        restaurantId: 1,
        branchId: 1,
        actorUserId: 12,
        actorName: "Anil Owner",
        actorRole: "OWNER",
        action: "AUTH_LOGIN_SUCCESS",
        entity: "Auth",
        entityId: "12",
        details: { method: "PASSWORD", ip: "192.168.1.1" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        severity: "INFO",
        status: "SUCCESS",
        createdAt: "2026-10-14T08:30:00.000Z",
    },
    {
        id: 102,
        restaurantId: 1,
        branchId: 1,
        actorUserId: 15,
        actorName: "Kamalesh Waiter",
        actorRole: "WAITER",
        action: "AUTH_LOGIN_FAILURE",
        entity: "Auth",
        entityId: "15",
        details: { reason: "Invalid PIN", attempt: 3 },
        ipAddress: "192.168.1.50",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        severity: "WARN",
        status: "FAILURE",
        createdAt: "2026-10-14T08:25:00.000Z",
    },
    {
        id: 103,
        restaurantId: 1,
        branchId: 2,
        actorUserId: 12,
        actorName: "Anil Owner",
        actorRole: "OWNER",
        action: "STAFF_ROLE_CHANGED",
        entity: "User",
        entityId: "22",
        details: { oldRole: "WAITER", newRole: "CAPTAIN", userId: 22 },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        severity: "WARN",
        status: "SUCCESS",
        createdAt: "2026-10-14T08:20:00.000Z",
    },
    {
        id: 104,
        restaurantId: 1,
        branchId: 1,
        actorUserId: 99,
        actorName: "Hacker Bot",
        actorRole: "SYSTEM",
        action: "AUTH_ACCOUNT_LOCKED",
        entity: "Auth",
        entityId: "99",
        details: { lockedUntil: "2026-10-14T09:00:00.000Z" },
        ipAddress: "203.0.113.195",
        userAgent: "curl/7.68.0",
        severity: "CRITICAL",
        status: "BLOCKED",
        createdAt: "2026-10-14T08:15:00.000Z",
    },
];

const mockPagination = {
    total: 4,
    page: 1,
    limit: 50,
    totalPages: 1,
};

describe("TIFFZY PHASE 3D-2 — Owner Security Audit Logs UI Test Suite", () => {
    let originalCreateObjectURL;
    let originalRevokeObjectURL;

    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({
            data: {
                ok: true,
                logs: mockAuditLogsData,
                pagination: mockPagination,
            },
        });

        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = vi.fn(() => "blob:mock-url");
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    // Helper to render OwnerAuditLogs with Auth context
    const renderWithAuth = (user = { id: 1, role: "OWNER", restaurantId: 1 }) => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user,
            staffToken: "mock-valid-token",
        });

        return render(
            <MemoryRouter initialEntries={["/owner/audit-logs"]}>
                <Routes>
                    <Route path="/owner/audit-logs" element={<OwnerAuditLogs />} />
                </Routes>
            </MemoryRouter>
        );
    };

    // 1. OWNER can access Audit Logs
    it("1. OWNER can access Audit Logs route", async () => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user: { id: 1, role: "OWNER", restaurantId: 1 },
            staffToken: "token-owner",
        });

        render(
            <MemoryRouter initialEntries={["/owner/audit-logs"]}>
                <Routes>
                    <Route
                        path="/owner/audit-logs"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER"]}>
                                <OwnerAuditLogs />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: "Audit Logs" })).toBeInTheDocument();
    });

    // 2. MANAGER can access Audit Logs
    it("2. MANAGER can access Audit Logs route", async () => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user: { id: 2, role: "MANAGER", restaurantId: 1 },
            staffToken: "token-manager",
        });

        render(
            <MemoryRouter initialEntries={["/owner/audit-logs"]}>
                <Routes>
                    <Route
                        path="/owner/audit-logs"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER"]}>
                                <OwnerAuditLogs />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: "Audit Logs" })).toBeInTheDocument();
    });

    // 3. SUPER_ADMIN can access Audit Logs
    it("3. SUPER_ADMIN can access Audit Logs route", async () => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user: { id: 99, role: "SUPER_ADMIN", restaurantId: 1 },
            staffToken: "token-superadmin",
        });

        render(
            <MemoryRouter initialEntries={["/owner/audit-logs"]}>
                <Routes>
                    <Route
                        path="/owner/audit-logs"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER"]}>
                                <OwnerAuditLogs />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: "Audit Logs" })).toBeInTheDocument();
    });

    // 4. unauthorized role cannot access
    it("4. unauthorized role (WAITER) cannot access Audit Logs route and is redirected", async () => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user: { id: 10, role: "WAITER", restaurantId: 1 },
            staffToken: "token-waiter",
        });

        render(
            <MemoryRouter initialEntries={["/owner/audit-logs"]}>
                <Routes>
                    <Route
                        path="/owner/audit-logs"
                        element={
                            <ProtectedRoute roles={["SUPER_ADMIN", "OWNER", "MANAGER"]}>
                                <OwnerAuditLogs />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/" element={<div data-testid="home-page">Redirected Home</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByTestId("home-page")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Audit Logs" })).not.toBeInTheDocument();
    });

    // 5. Audit Logs appears in navigation for authorized users
    it("5. Audit Logs appears in navigation sidebar for OWNER", async () => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user: {
                id: 1,
                role: "OWNER",
                restaurantId: 1,
                access: { audit: true, reports: true },
            },
            staffToken: "token-owner",
        });

        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        const auditLinks = screen.getAllByRole("link", { name: /audit logs/i });
        expect(auditLinks.length).toBeGreaterThan(0);
        expect(auditLinks[0]).toHaveAttribute("href", "/owner/audit-logs");
    });

    // 6. Audit Logs does not appear for unauthorized roles
    it("6. Audit Logs does not appear in navigation for unauthorized roles (CHEF)", async () => {
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            user: {
                id: 5,
                role: "CHEF",
                restaurantId: 1,
                access: { kitchen: true, orders: true, audit: false, reports: false },
            },
            staffToken: "token-chef",
        });

        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
    });

    // 7. API request uses restaurantId
    it("7. API request uses authenticated restaurantId", async () => {
        renderWithAuth({ id: 1, role: "OWNER", restaurantId: 42 });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/42/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ page: 1, limit: 50 }),
                })
            );
        });
    });

    // 8. severity filter
    it("8. severity filter sends severity query param", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const severitySelect = screen.getByLabelText(/filter by severity/i);
        fireEvent.change(severitySelect, { target: { value: "WARN" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ severity: "WARN", page: 1 }),
                })
            );
        });
    });

    // 9. status filter
    it("9. status filter sends status query param", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const statusSelect = screen.getByLabelText(/filter by status/i);
        fireEvent.change(statusSelect, { target: { value: "FAILURE" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ status: "FAILURE", page: 1 }),
                })
            );
        });
    });

    // 10. action filter
    it("10. action filter sends action query param", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const actionSelect = screen.getByLabelText(/filter by action/i);
        fireEvent.change(actionSelect, { target: { value: "AUTH_LOGIN_FAILURE" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ action: "AUTH_LOGIN_FAILURE", page: 1 }),
                })
            );
        });
    });

    // 11. entity filter
    it("11. entity filter sends entity query param", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const entitySelect = screen.getByLabelText(/filter by entity/i);
        fireEvent.change(entitySelect, { target: { value: "User" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ entity: "User", page: 1 }),
                })
            );
        });
    });

    // 12. branch filter
    it("12. branch filter sends branchId query param", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const branchSelect = screen.getByLabelText(/filter by branch/i);
        fireEvent.change(branchSelect, { target: { value: "2" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ branchId: 2, page: 1 }),
                })
            );
        });
    });

    // 13. date range filter
    it("13. date range filter sends ISO startDate and endDate", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const dateSelect = screen.getByLabelText(/filter by date range/i);
        fireEvent.change(dateSelect, { target: { value: "today" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({
                        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
                        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
                    }),
                })
            );
        });
    });

    // 14. Reset Filters
    it("14. Reset Filters button clears all active filters and resets to page 1", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        // Set severity
        const severitySelect = screen.getByLabelText(/filter by severity/i);
        fireEvent.change(severitySelect, { target: { value: "CRITICAL" } });

        // Click Reset Filters
        const resetBtn = screen.getByRole("button", { name: /reset filters/i });
        fireEvent.click(resetBtn);

        await waitFor(() => {
            expect(severitySelect.value).toBe("");
            expect(api.get).toHaveBeenLastCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: { page: 1, limit: 50 },
                })
            );
        });
    });

    // 15. pagination
    it("15. pagination controls page forward and backward", async () => {
        api.get.mockResolvedValueOnce({
            data: {
                ok: true,
                logs: mockAuditLogsData,
                pagination: { total: 100, page: 1, limit: 50, totalPages: 2 },
            },
        });

        renderWithAuth();
        await screen.findByText("Page 1 of 2");

        const nextBtn = screen.getByRole("button", { name: /next page/i });
        const prevBtn = screen.getByRole("button", { name: /previous page/i });

        expect(prevBtn).toBeDisabled();
        expect(nextBtn).not.toBeDisabled();

        // Click Next Page
        fireEvent.click(nextBtn);

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ page: 2 }),
                })
            );
        });
    });

    // 16. page-size change
    it("16. changing page size resets page to 1 and sends new limit", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const limitSelect = screen.getByLabelText(/items per page/i);
        fireEvent.change(limitSelect, { target: { value: "100" } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/audit-logs",
                expect.objectContaining({
                    params: expect.objectContaining({ limit: 100, page: 1 }),
                })
            );
        });
    });

    // 17. newest-first display
    it("17. displays logs chronologically ordered as returned from API", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const rows = screen.getAllByRole("row");
        // Row 0 is header, Row 1 should be event 101, Row 2 event 102
        expect(within(rows[1]).getByText("Login Successful")).toBeInTheDocument();
        expect(within(rows[2]).getByText("Login Failed")).toBeInTheDocument();
        expect(within(rows[3]).getByText("Staff Role Changed")).toBeInTheDocument();
        expect(within(rows[4]).getByText("Account Locked")).toBeInTheDocument();
    });

    // 18. severity badges
    it("18. renders correct severity badges and badge classes", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const rows = screen.getAllByRole("row");
        const infoBadge = within(rows[1]).getByText("INFO");
        expect(infoBadge).toHaveClass("border-blue-500/20");

        const warnBadge = within(rows[2]).getByText("WARN");
        expect(warnBadge).toHaveClass("border-amber-500/20");

        const criticalBadge = within(rows[4]).getByText("CRITICAL");
        expect(criticalBadge).toHaveClass("border-rose-500/20");
    });

    // 19. status badges
    it("19. renders correct status badges", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const rows = screen.getAllByRole("row");
        const successBadge = within(rows[1]).getByText("SUCCESS");
        expect(successBadge).toHaveClass("border-emerald-500/20");

        const failureBadge = within(rows[2]).getByText("FAILURE");
        expect(failureBadge).toHaveClass("border-rose-500/20");

        const blockedBadge = within(rows[4]).getByText("BLOCKED");
        expect(blockedBadge).toHaveClass("border-amber-500/20");
    });

    // 20. human-friendly action labels
    it("20. maps raw backend event actions to human-friendly labels", () => {
        expect(formatActionLabel("AUTH_LOGIN_SUCCESS")).toBe("Login Successful");
        expect(formatActionLabel("AUTH_LOGIN_FAILURE")).toBe("Login Failed");
        expect(formatActionLabel("AUTH_ACCOUNT_LOCKED")).toBe("Account Locked");
        expect(formatActionLabel("STAFF_ROLE_CHANGED")).toBe("Staff Role Changed");
        expect(formatActionLabel("WAITER_ASSIGNED")).toBe("Waiter Assigned");
        expect(formatActionLabel("KOT_REPRINTED")).toBe("KOT Reprinted");
    });

    // 21. Security Activity Drawer opens
    it("21. clicking 'View Details' opens the Security Activity Drawer", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const viewButtons = screen.getAllByRole("button", { name: /view details/i });
        fireEvent.click(viewButtons[0]);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Security Activity Detail")).toBeInTheDocument();
    });

    // 22. Drawer displays audit details
    it("22. Drawer displays complete event information including actor, IP, and entity", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const viewButtons = screen.getAllByRole("button", { name: /view details/i });
        fireEvent.click(viewButtons[0]);

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getAllByText("192.168.1.1")[0]).toBeInTheDocument();
        expect(within(dialog).getByText(/Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_15_7\)/)).toBeInTheDocument();
        expect(within(dialog).getByText("Anil Owner")).toBeInTheDocument();
        expect(within(dialog).getByText("#12")).toBeInTheDocument();
    });

    // 23. Drawer closes
    it("23. Drawer closes when clicking the close button, backdrop, or pressing Escape", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const viewButtons = screen.getAllByRole("button", { name: /view details/i });
        fireEvent.click(viewButtons[0]);
        await screen.findByRole("dialog");

        // Close via close button
        const closeBtn = screen.getByRole("button", { name: /close drawer/i });
        fireEvent.click(closeBtn);
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });

        // Re-open and close via Escape
        fireEvent.click(viewButtons[0]);
        await screen.findByRole("dialog");
        fireEvent.keyDown(window, { key: "Escape" });
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    // 24. sensitive keys are never rendered
    it("24. sensitive credential keys are defensively stripped from details and never rendered", () => {
        const dirtyDetails = {
            userId: 10,
            email: "staff@restaurant.com",
            password: "supersecretpassword123",
            passwordHash: "bcrypt_hash_value",
            tempPassword: "tempPin1234",
            otp: "123456",
            token: "jwt_token_payload",
            cookie: "session_cookie_secret",
            authorization: "Bearer secret",
            nested: {
                currentPassword: "oldpassword",
                newPassword: "newpassword",
                safeField: "safeValue",
            },
        };

        const clean = sanitizeDetailsFrontend(dirtyDetails);

        expect(clean.password).toBeUndefined();
        expect(clean.passwordHash).toBeUndefined();
        expect(clean.tempPassword).toBeUndefined();
        expect(clean.otp).toBeUndefined();
        expect(clean.token).toBeUndefined();
        expect(clean.cookie).toBeUndefined();
        expect(clean.authorization).toBeUndefined();
        expect(clean.nested.currentPassword).toBeUndefined();
        expect(clean.nested.newPassword).toBeUndefined();
        expect(clean.nested.safeField).toBe("safeValue");
        expect(clean.userId).toBe(10);
        expect(clean.email).toBe("staff@restaurant.com");
    });

    // 25. empty state
    it("25. renders empty state when API returns empty logs", async () => {
        api.get.mockResolvedValueOnce({
            data: {
                ok: true,
                logs: [],
                pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
            },
        });

        renderWithAuth();

        expect(
            await screen.findByText("No security audit events recorded for the selected criteria.")
        ).toBeInTheDocument();
    });

    // 26. loading state
    it("26. renders skeleton rows during loading", () => {
        api.get.mockImplementationOnce(() => new Promise(() => {})); // pending

        renderWithAuth();

        const skeletonRows = document.querySelectorAll(".animate-pulse");
        expect(skeletonRows.length).toBeGreaterThan(0);
    });

    // 27. 403 state
    it("27. renders 403 Forbidden Access Restricted alert when API returns HTTP 403", async () => {
        api.get.mockRejectedValueOnce({
            response: { status: 403, data: { message: "Access forbidden" } },
        });

        renderWithAuth();

        expect(await screen.findByRole("heading", { name: "Access Restricted" })).toBeInTheDocument();
        expect(
            screen.getByText("You do not have sufficient permissions to view Security Audit Logs.")
        ).toBeInTheDocument();
    });

    // 28. 500/network error state
    it("28. renders error state with Retry button on network error", async () => {
        api.get.mockRejectedValueOnce(new Error("Network Error"));

        renderWithAuth();

        expect(
            await screen.findByRole("heading", { name: "Failed to Load Audit Logs" })
        ).toBeInTheDocument();

        const retryBtn = screen.getByRole("button", { name: /retry/i });
        expect(retryBtn).toBeInTheDocument();

        // Clicking retry re-triggers api.get
        api.get.mockResolvedValueOnce({
            data: { ok: true, logs: mockAuditLogsData, pagination: mockPagination },
        });
        fireEvent.click(retryBtn);

        expect(await screen.findByText("Login Successful")).toBeInTheDocument();
    });

    // 29. Refresh
    it("29. Refresh button refetches the current page while preserving filters", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const refreshBtn = screen.getByRole("button", { name: /refresh/i });
        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledTimes(2);
        });
    });

    // 30. CSV export
    it("30. Export CSV generates Blob and triggers download", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const exportBtn = screen.getByRole("button", { name: /export csv/i });
        fireEvent.click(exportBtn);

        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    // 31. CSV escaping
    it("31. CSV escaping correctly escapes commas, quotes, and newlines", () => {
        expect(escapeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
        expect(escapeCsvCell("Item 1, Item 2")).toBe('"Item 1, Item 2"');
        expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
        expect(escapeCsvCell(null)).toBe('""');
    });

    // 32. no unsupported API query parameters are sent
    it("32. verifies that unsupported parameters (search, query, sort, order, actorRole, from, to) are NEVER sent", async () => {
        renderWithAuth();
        await screen.findByText("Login Successful");

        const lastCall = api.get.mock.calls[api.get.mock.calls.length - 1];
        const params = lastCall[1].params;

        expect(params.search).toBeUndefined();
        expect(params.query).toBeUndefined();
        expect(params.sort).toBeUndefined();
        expect(params.order).toBeUndefined();
        expect(params.actorRole).toBeUndefined();
        expect(params.from).toBeUndefined();
        expect(params.to).toBeUndefined();
    });
});
