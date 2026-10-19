import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SuperAdminDashboard from "../pages/super-admin/SuperAdminDashboard";
import SuperAdminUsers from "../pages/super-admin/SuperAdminUsers";
import { api } from "../utils/apiClient";

// Mock socket handlers map to simulate real-time socket events
let socketHandlers = {};
const mockSocket = {
    on: vi.fn((event, cb) => {
        socketHandlers[event] = cb;
    }),
    off: vi.fn((event) => {
        delete socketHandlers[event];
    }),
    emit: vi.fn(),
    connected: true,
};

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        connected: true,
    }),
    StaffSocketProvider: ({ children }) => <>{children}</>,
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 1, role: "SUPER_ADMIN", email: "admin@tiffzy.com" },
        logout: vi.fn(),
        staffToken: "mock-superadmin-token",
    }),
}));

import { cachedGet } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
    cachedGet: vi.fn(),
    invalidateGetCache: vi.fn(),
}));

describe("Super Admin Customer Presence — Real-time Dashboard & Directory Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketHandlers = {};
    });

    it("1. SuperAdminDashboard renders Customer Presence card with Online, Offline, and Total counts", async () => {
        api.get.mockImplementation((url) => {
            if (url === "/super-admin/customers/presence") {
                return Promise.resolve({
                    data: {
                        totalCustomers: 120,
                        onlineCustomers: 15,
                        offlineCustomers: 105,
                    },
                });
            }
            if (url === "/super-admin/server-metrics") {
                return Promise.resolve({ data: { instanceId: "i-test123", cpu: [], memory: [], disk: [] } });
            }
            if (url.includes("/super-admin/error-logs")) {
                return Promise.resolve({ data: { openErrorsCount: 0, totalEvents: 0, logs: [] } });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter>
                <SuperAdminDashboard />
            </MemoryRouter>
        );

        // Header check
        expect(await screen.findByText("Customer Presence")).toBeInTheDocument();
        expect(screen.getByText(/Live/)).toBeInTheDocument();

        // Count checks
        await waitFor(() => {
            expect(screen.getByTestId("online-customers-count")).toHaveTextContent("15");
            expect(screen.getByTestId("offline-customers-count")).toHaveTextContent("105");
            expect(screen.getByTestId("total-customers-count")).toHaveTextContent("120");
        });
    });

    it("2. SuperAdminDashboard updates counts in real-time when customer:presence_updated socket event arrives", async () => {
        api.get.mockImplementation((url) => {
            if (url === "/super-admin/customers/presence") {
                return Promise.resolve({
                    data: { totalCustomers: 100, onlineCustomers: 10, offlineCustomers: 90 },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter>
                <SuperAdminDashboard />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId("online-customers-count")).toHaveTextContent("10");
        });

        // Simulate incoming real-time socket event: another customer connects
        act(() => {
            if (socketHandlers["customer:presence_updated"]) {
                socketHandlers["customer:presence_updated"]({
                    totalCustomers: 100,
                    onlineCustomers: 11,
                    offlineCustomers: 89,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByTestId("online-customers-count")).toHaveTextContent("11");
            expect(screen.getByTestId("offline-customers-count")).toHaveTextContent("89");
        });
    });

    it("3. SuperAdminUsers renders customer rows with Status (Online/Offline) and Last Seen", async () => {
        const mockCustomers = [
            {
                id: 1,
                name: "Ramesh Sharma",
                username: "ramesh",
                phone: "9876543210",
                email: "ramesh@example.com",
                isOnline: true,
                lastSeenAt: new Date().toISOString(),
                rewardPoints: 50,
                createdAt: new Date().toISOString(),
            },
            {
                id: 2,
                name: "Kiran Rao",
                username: "kiran",
                phone: "9876543211",
                email: "kiran@example.com",
                isOnline: false,
                lastSeenAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
                rewardPoints: 20,
                createdAt: new Date().toISOString(),
            },
        ];

        cachedGet.mockImplementation((url) => {
            if (url.includes("/super-admin/customers")) {
                return Promise.resolve({
                    customers: mockCustomers,
                    summary: { totalCustomers: 2, onlineCustomers: 1, offlineCustomers: 1 },
                });
            }
            return Promise.resolve({});
        });

        render(
            <MemoryRouter initialEntries={["/super-admin/customers"]}>
                <SuperAdminUsers />
            </MemoryRouter>
        );

        // Verify table column headers
        expect(await screen.findByText("Status")).toBeInTheDocument();
        expect(screen.getByText("Last Seen")).toBeInTheDocument();

        // Customer 1: Online, Last Seen: Now
        expect(screen.getByText("Ramesh Sharma")).toBeInTheDocument();
        expect(screen.getAllByText("Online").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Now")).toBeInTheDocument();

        // Customer 2: Offline, Last Seen: 5 mins ago
        expect(screen.getByText("Kiran Rao")).toBeInTheDocument();
        expect(screen.getAllByText("Offline").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/min.*ago/i)).toBeInTheDocument();
    });

    it("4. SuperAdminUsers updates customer row from Offline to Online upon customer:online socket event", async () => {
        const mockCustomers = [
            {
                id: 5,
                name: "Anil Kumar",
                username: "anil",
                phone: "9876543215",
                email: "anil@example.com",
                isOnline: false,
                lastSeenAt: new Date(Date.now() - 600000).toISOString(),
                rewardPoints: 0,
                createdAt: new Date().toISOString(),
            },
        ];

        cachedGet.mockImplementation((url) => {
            if (url.includes("/super-admin/customers")) {
                return Promise.resolve({
                    customers: mockCustomers,
                    summary: { totalCustomers: 1 },
                });
            }
            return Promise.resolve({});
        });

        render(
            <MemoryRouter initialEntries={["/super-admin/customers"]}>
                <SuperAdminUsers />
            </MemoryRouter>
        );

        expect(await screen.findByText("Anil Kumar")).toBeInTheDocument();
        expect(screen.getAllByText("Offline").length).toBeGreaterThanOrEqual(1);

        // Socket event: Anil connects and becomes Online
        act(() => {
            if (socketHandlers["customer:online"]) {
                socketHandlers["customer:online"]({
                    customerId: 5,
                    isOnline: true,
                    lastSeenAt: new Date().toISOString(),
                });
            }
        });

        await waitFor(() => {
            expect(screen.getAllByText("Online").length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText("Now")).toBeInTheDocument();
        });
    });

    it("5. Presence filters (All, Online, Offline) filter customer directory rows accurately", async () => {
        const mockCustomers = [
            {
                id: 10,
                name: "Online User",
                username: "user_online",
                phone: "9876543220",
                email: "online@example.com",
                isOnline: true,
                lastSeenAt: new Date().toISOString(),
                rewardPoints: 10,
                createdAt: new Date().toISOString(),
            },
            {
                id: 20,
                name: "Offline User",
                username: "user_offline",
                phone: "9876543221",
                email: "offline@example.com",
                isOnline: false,
                lastSeenAt: new Date(Date.now() - 7200000).toISOString(),
                rewardPoints: 0,
                createdAt: new Date().toISOString(),
            },
        ];

        cachedGet.mockImplementation((url) => {
            if (url.includes("/super-admin/customers")) {
                return Promise.resolve({
                    customers: mockCustomers,
                    summary: { totalCustomers: 2 },
                });
            }
            return Promise.resolve({});
        });

        render(
            <MemoryRouter initialEntries={["/super-admin/customers"]}>
                <SuperAdminUsers />
            </MemoryRouter>
        );

        // Initially both are visible in ALL
        expect(await screen.findByText("Online User")).toBeInTheDocument();
        expect(screen.getByText("Offline User")).toBeInTheDocument();

        // Click Online filter
        const onlineBtn = screen.getByRole("button", { name: /Online \(1\)/i });
        fireEvent.click(onlineBtn);

        await waitFor(() => {
            expect(screen.getByText("Online User")).toBeInTheDocument();
            expect(screen.queryByText("Offline User")).not.toBeInTheDocument();
        });

        // Click Offline filter
        const offlineBtn = screen.getByRole("button", { name: /Offline \(1\)/i });
        fireEvent.click(offlineBtn);

        await waitFor(() => {
            expect(screen.queryByText("Online User")).not.toBeInTheDocument();
            expect(screen.getByText("Offline User")).toBeInTheDocument();
        });

        // Click All filter
        const allBtn = screen.getByRole("button", { name: /All \(2\)/i });
        fireEvent.click(allBtn);

        await waitFor(() => {
            expect(screen.getByText("Online User")).toBeInTheDocument();
            expect(screen.getByText("Offline User")).toBeInTheDocument();
        });
    });

    it("6. SuperAdminUsers displays Customer Presence card at the top of /super-admin/users and Tab 1 displays Status and Last Seen", async () => {
        api.get.mockImplementation((url) => {
            if (url === "/super-admin/customers/presence") {
                return Promise.resolve({
                    data: {
                        totalCustomers: 50,
                        onlineCustomers: 8,
                        offlineCustomers: 42,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        cachedGet.mockImplementation((url) => {
            if (url.includes("/super-admin/all-users")) {
                return Promise.resolve({
                    users: [
                        {
                            id: "cust_101",
                            rawId: 101,
                            userType: "CUSTOMER",
                            name: "Guest Customer",
                            email: "guest@tiffzy.com",
                            phone: "919999999999",
                            role: "CUSTOMER",
                            isOnline: true,
                            lastSeenAt: new Date().toISOString(),
                            createdAt: new Date().toISOString(),
                        },
                        {
                            id: "staff_1",
                            rawId: 1,
                            userType: "STAFF",
                            name: "Admin Staff",
                            email: "staff@tiffzy.com",
                            phone: "918888888888",
                            role: "WAITER",
                            isActive: true,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                    summary: { totalUsers: 2, staffCount: 1, customerCount: 1, ownersCount: 0 },
                });
            }
            return Promise.resolve({});
        });

        render(
            <MemoryRouter initialEntries={["/super-admin/users"]}>
                <SuperAdminUsers />
            </MemoryRouter>
        );

        // Header & Live indicator on /super-admin/users
        expect(await screen.findByText("Customer Presence")).toBeInTheDocument();
        expect(screen.getByText(/Live/)).toBeInTheDocument();

        // Customer Presence counts on /super-admin/users
        await waitFor(() => {
            expect(screen.getByTestId("online-customers-count")).toHaveTextContent("8");
            expect(screen.getByTestId("offline-customers-count")).toHaveTextContent("42");
            expect(screen.getByTestId("total-customers-count")).toHaveTextContent("50");
        });

        // Tab 1 (All Users) shows Status and Last Seen for customer
        expect(screen.getByText("Guest Customer")).toBeInTheDocument();
        expect(screen.getAllByText("Online").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Now")).toBeInTheDocument();
    });
});
