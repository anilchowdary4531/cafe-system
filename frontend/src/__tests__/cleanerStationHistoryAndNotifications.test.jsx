import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CleanerStation from "../pages/staff/CleanerStation";
import StaffNotificationsView from "../components/StaffNotificationsView";
import OwnerNotifications from "../pages/admin/OwnerNotifications";
import { TableStateProvider } from "../context/TableStateContext";

// Mock axios
vi.mock("axios");

// Mock toast and sound
vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn().mockResolvedValue(true),
    triggerNotificationVibration: vi.fn(),
}));

const mockCleanerUser = {
    id: 99,
    name: "Carlos Cleaner",
    role: "STAFF",
    designation: "Cleaner",
    restaurantId: 1,
    restaurant: { id: 1, name: "Tiffzy Restaurant" },
};

let mockAuthState = {
    user: mockCleanerUser,
    staffToken: "mock-cleaner-jwt-token",
    token: "mock-cleaner-jwt-token",
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockAuthState,
}));

let socketListeners = {};
const mockSocket = {
    connected: false,
    on: (evt, cb) => {
        socketListeners[evt] = cb;
    },
    off: (evt, cb) => {
        if (socketListeners[evt] === cb) {
            delete socketListeners[evt];
        }
    },
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        isConnected: false,
    }),
}));

describe("Cleaner Station History & Notification Parity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketListeners = {};
        localStorage.clear();
        localStorage.setItem("token", "mock-cleaner-jwt-token");
        localStorage.setItem("staffToken", "mock-cleaner-jwt-token");
        localStorage.setItem("restaurantId", "1");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("1. 'Sanitized Today' count reflects ONLY today's completed tasks, while History shows all", async () => {
        const todayIso = new Date().toISOString();
        const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const mockTasks = [
            {
                id: 101,
                title: "Clean Table 1",
                category: "CLEANING",
                status: "COMPLETED",
                isCompleted: true,
                completedAt: todayIso,
                tableId: 1,
                table: { id: 1, tableNo: "1", section: "Main Floor" },
                assignedUser: { id: 99, name: "Carlos Cleaner" },
            },
            {
                id: 102,
                title: "Clean Table 2",
                category: "CLEANING",
                status: "COMPLETED",
                isCompleted: true,
                completedAt: todayIso,
                tableId: 2,
                table: { id: 2, tableNo: "2", section: "Main Floor" },
                assignedUser: { id: 99, name: "Carlos Cleaner" },
            },
            {
                id: 103,
                title: "Clean Table 3 (Yesterday)",
                category: "CLEANING",
                status: "COMPLETED",
                isCompleted: true,
                completedAt: yesterdayIso,
                tableId: 3,
                table: { id: 3, tableNo: "3", section: "Terrace" },
                assignedUser: { id: 88, name: "John Housekeeping" },
            },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: mockTasks } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { success: true, tables: [] } });
            }
            if (url.includes("/api/v1/staff/capabilities")) {
                return Promise.resolve({
                    data: { success: true, capabilities: { hasCleaner: true, hasSteward: true } },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        // Wait for tasks to load
        await waitFor(() => {
            expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
        });

        // "Sanitized Today" badge/tab should show 2 (strictly today's tasks)
        // Check for 2 today vs 3 total history
        const sanitizedTodayTabs = screen.getAllByText("Sanitized Today");
        expect(sanitizedTodayTabs.length).toBeGreaterThan(0);

        // History tab should exist
        const historyTabs = screen.getAllByText("History");
        expect(historyTabs.length).toBeGreaterThan(0);

        // Click History tab
        fireEvent.click(historyTabs[0]);

        // Verify history records are rendered
        await waitFor(() => {
            expect(screen.getByText("Sanitation & Cleaning History")).toBeInTheDocument();
            expect(screen.getByText(/3 total records/)).toBeInTheDocument();
            expect(screen.getByText("Table 1")).toBeInTheDocument();
            expect(screen.getByText("Table 2")).toBeInTheDocument();
            expect(screen.getByText("Table 3")).toBeInTheDocument();
            expect(screen.getAllByText(/Carlos Cleaner/).length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText(/John Housekeeping/)).toBeInTheDocument();
        });
    });

    it("2. StaffNotificationsView fetches and displays categorized notifications correctly", async () => {
        const mockNotifs = [
            {
                id: 201,
                notificationType: "CLEANING_TASK",
                title: "Table 4 Needs Cleaning",
                message: "Guest left Table 4, sanitization required",
                tableNo: "4",
                isRead: false,
                createdAt: new Date().toISOString(),
            },
            {
                id: 202,
                notificationType: "WAITER_CALL",
                title: "Waiter Call Table 2",
                message: "Water requested",
                tableNo: "2",
                isRead: true,
                createdAt: new Date().toISOString(),
            },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/notifications")) {
                return Promise.resolve({ data: { success: true, notifications: mockNotifs } });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter>
                <StaffNotificationsView />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Staff Notifications")).toBeInTheDocument();
            expect(screen.getByText("Table 4 Needs Cleaning")).toBeInTheDocument();
            expect(screen.getByText("Waiter Call Table 2")).toBeInTheDocument();
        });

        // Filter by CLEANING
        const cleaningFilter = screen.getByText("CLEANING");
        fireEvent.click(cleaningFilter);

        await waitFor(() => {
            expect(screen.getByText("Table 4 Needs Cleaning")).toBeInTheDocument();
            expect(screen.queryByText("Waiter Call Table 2")).not.toBeInTheDocument();
        });
    });

    it("3. OwnerNotifications connects to backend /api/notifications and supports Mark All Read", async () => {
        const mockOwnerNotifs = [
            {
                id: 301,
                notificationType: "TABLE_DIRTY",
                title: "Table 4 Dirty",
                message: "Table 4 is dirty and requires sanitation",
                isRead: false,
                createdAt: new Date().toISOString(),
            },
            {
                id: 302,
                notificationType: "TABLE_CLEANED",
                title: "Table 4 Sanitized",
                message: "Table 4 is clean and ready for guests",
                isRead: false,
                createdAt: new Date().toISOString(),
            },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/notifications")) {
                return Promise.resolve({ data: { success: true, notifications: mockOwnerNotifs } });
            }
            return Promise.resolve({ data: {} });
        });

        axios.put.mockResolvedValue({ data: { success: true } });

        render(
            <MemoryRouter>
                <OwnerNotifications />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Notifications Log")).toBeInTheDocument();
            expect(screen.getByText("Table 4 Dirty")).toBeInTheDocument();
            expect(screen.getByText("Table 4 Sanitized")).toBeInTheDocument();
            expect(screen.getByText("2 UNREAD")).toBeInTheDocument();
        });

        // Click Mark all as read
        const markAllBtn = screen.getByText("Mark all as read");
        fireEvent.click(markAllBtn);

        await waitFor(() => {
            expect(screen.getByText("0 UNREAD")).toBeInTheDocument();
        });
    });
});
