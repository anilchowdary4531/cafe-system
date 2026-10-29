import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CleanerStation from "../pages/staff/CleanerStation";
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

describe("Cleaner Station Responsive UI Matrix Across Viewports", () => {
    const todayIso = new Date().toISOString();
    const mockTasks = [
        {
            id: 101,
            title: "Clean Table 1",
            category: "CLEANING",
            taskType: "TABLE_BUS_AND_SANITIZE",
            status: "PENDING",
            priority: "URGENT",
            tableId: 1,
            table: { id: 1, tableNo: "1", section: "Main Floor" },
        },
        {
            id: 102,
            title: "Mop Dining Area Spills",
            category: "CLEANING",
            taskType: "SPILL_CLEANUP",
            status: "ACCEPTED",
            assignedTo: 99,
            priority: "NORMAL",
            tableId: null,
            table: null,
        },
        {
            id: 103,
            title: "Clean Table 2",
            category: "CLEANING",
            taskType: "TABLE_BUS_AND_SANITIZE",
            status: "COMPLETED",
            isCompleted: true,
            completedAt: todayIso,
            tableId: 2,
            table: { id: 2, tableNo: "2", section: "Terrace" },
            assignedUser: { id: 99, name: "Carlos Cleaner" },
        },
    ];

    const mockTables = [
        { id: 1, tableNo: "1", section: "Main Floor", seats: 4, status: "DIRTY" },
        { id: 2, tableNo: "2", section: "Terrace", seats: 2, status: "DIRTY" },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        socketListeners = {};
        localStorage.clear();
        localStorage.setItem("token", "mock-cleaner-jwt-token");
        localStorage.setItem("staffToken", "mock-cleaner-jwt-token");
        localStorage.setItem("restaurantId", "1");

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: mockTasks } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { success: true, tables: mockTables } });
            }
            if (url.includes("/api/v1/staff/capabilities")) {
                return Promise.resolve({
                    data: { success: true, capabilities: { hasCleaner: true, hasSteward: true } },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const viewports = [
        { name: "Small Mobile Phone", width: 320, height: 568 },
        { name: "Standard Mobile Phone", width: 375, height: 667 },
        { name: "Large Mobile Phone", width: 390, height: 844 },
        { name: "Large Mobile Plus", width: 414, height: 896 },
        { name: "Tablet Portrait (iPad Mini/Air)", width: 768, height: 1024 },
        { name: "Tablet Portrait (iPad 10th Gen)", width: 820, height: 1180 },
        { name: "Tablet Landscape / Small Laptop", width: 1024, height: 768 },
        { name: "Standard Laptop", width: 1280, height: 800 },
        { name: "Desktop Monitor", width: 1440, height: 900 },
        { name: "Ultra-Wide / Full HD Monitor", width: 1920, height: 1080 },
    ];

    viewports.forEach(({ name, width, height }) => {
        it(`renders without layout errors on ${name} (${width}×${height})`, async () => {
            window.innerWidth = width;
            window.innerHeight = height;
            window.dispatchEvent(new Event("resize"));

            const { container } = render(
                <MemoryRouter>
                    <TableStateProvider>
                        <CleanerStation />
                    </TableStateProvider>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
            });

            // All 5 tabs must be represented
            expect(screen.getAllByText("Dirty Tables").length).toBeGreaterThan(0);
            expect(screen.getAllByText("Cleaning Queue").length).toBeGreaterThan(0);
            expect(screen.getAllByText("My Tasks").length).toBeGreaterThan(0);
            expect(screen.getAllByText("Sanitized Today").length).toBeGreaterThan(0);
            expect(screen.getAllByText("History").length).toBeGreaterThan(0);

            // Container must have max-w-7xl and min-w-0 for responsive bounds
            const mainContainer = container.querySelector(".max-w-7xl");
            expect(mainContainer).toBeInTheDocument();
        });
    });

    it("verifies KPI overview cards have responsive grid and minimum touch target size (>= 40px)", async () => {
        const { container } = render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
        });

        const kpiGrid = container.querySelector(".grid.grid-cols-1");
        expect(kpiGrid).toBeInTheDocument();
        expect(kpiGrid.className).toContain("min-[360px]:grid-cols-2");
        expect(kpiGrid.className).toContain("lg:grid-cols-4");

        // Clickable cards must have min-h-[80px] which comfortably exceeds 40px touch requirement
        const cardButtons = container.querySelectorAll("[role='button']");
        expect(cardButtons.length).toBeGreaterThanOrEqual(4);
        cardButtons.forEach((card) => {
            expect(card.className).toContain("min-h-[80px]");
        });
    });

    it("verifies Dirty Tables quick sanitize button has minimum 40px touch height and full-width layout", async () => {
        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
        });

        const sanitizeButtons = screen.getAllByRole("button", { name: /mark clean & available/i });
        expect(sanitizeButtons.length).toBeGreaterThan(0);
        sanitizeButtons.forEach((btn) => {
            expect(btn.className).toContain("min-h-[42px]");
            expect(btn.className).toContain("w-full");
        });
    });

    it("verifies Cleaning Queue claim button has minimum 40px touch height and wraps properly", async () => {
        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
        });

        // Switch to Cleaning Queue tab
        const queueTabs = screen.getAllByText("Cleaning Queue");
        fireEvent.click(queueTabs[0]);

        await waitFor(() => {
            expect(screen.getByText("Cleaning Tasks & Sanitation Queue")).toBeInTheDocument();
        });

        const claimButtons = screen.getAllByRole("button", { name: /claim task/i });
        expect(claimButtons.length).toBeGreaterThan(0);
        claimButtons.forEach((btn) => {
            expect(btn.className).toContain("min-h-[40px]");
            expect(btn.className).toContain("w-full");
            expect(btn.className).toContain("sm:w-auto");
        });
    });

    it("verifies My Tasks action buttons stack vertically on mobile (w-full) and horizontally on desktop", async () => {
        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
        });

        // Switch to My Tasks tab
        const myTasksTabs = screen.getAllByText("My Tasks");
        fireEvent.click(myTasksTabs[0]);

        await waitFor(() => {
            expect(screen.getByText("Sanitation Tasks Claimed by Me")).toBeInTheDocument();
        });

        const startButtons = screen.getAllByRole("button", { name: /start cleaning/i });
        expect(startButtons.length).toBeGreaterThan(0);
        startButtons.forEach((btn) => {
            expect(btn.className).toContain("min-h-[40px]");
            expect(btn.className).toContain("w-full");
            expect(btn.className).toContain("sm:w-auto");
        });
    });

    it("verifies History tab has no duplicate navigation and wraps badges cleanly on mobile", async () => {
        const { container } = render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Cleaner Station — Sanitation & Table Turnover")).toBeInTheDocument();
        });

        // Switch to History tab
        const historyTabs = screen.getAllByText("History");
        fireEvent.click(historyTabs[0]);

        await waitFor(() => {
            expect(screen.getByText("Sanitation & Cleaning History")).toBeInTheDocument();
        });

        // Duplicate KPI cards must NOT be rendered
        expect(screen.queryByText("Need busing & sanitize")).not.toBeInTheDocument();
        expect(screen.queryByText("Spills & checklists")).not.toBeInTheDocument();

        // Check badge container self-alignment
        const readyBadges = container.querySelectorAll(".self-start.sm\\:self-center");
        expect(readyBadges.length).toBeGreaterThan(0);
    });
});

