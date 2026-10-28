import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
    playNotificationSound: vi.fn(),
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

let mockSocketConnected = false;
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
        isConnected: mockSocketConnected,
    }),
}));

describe("Cleaner Station Table Cleaning Synchronization Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketListeners = {};
        mockSocketConnected = false;
        mockSocket.connected = false;
    });

    it("TEST 1 & TEST 2: Dirty table (Table 4) appears under 'Tables Awaiting Sanitation' even when NO cleaner task exists; clean tables do NOT appear", async () => {
        const mockTables = [
            { id: 1, tableNo: "1", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 4, section: "Main Hall" },
            { id: 2, tableNo: "2", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 2, section: "Main Hall" },
            { id: 3, tableNo: "3", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 4, section: "Patio" },
            { id: 4, tableNo: "4", cleaningStatus: "DIRTY", status: "DIRTY", isOccupied: false, seats: 4, section: "Main Hall" },
            { id: 5, tableNo: "5", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 6, section: "Balcony" },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                // Zero tasks exist
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { tables: mockTables, total: 5, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true, hasSteward: false } } });
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

        // Header shows Offline when socket is not connected
        expect(screen.getByText("Offline")).toBeInTheDocument();

        // Dirty table count must be 1 (Table 4)
        await waitFor(() => {
            expect(screen.getByText("Tables Awaiting Sanitation (1)")).toBeInTheDocument();
        });

        // Table 4 card must be visible with DIRTY badge
        expect(screen.getByText("Table 4")).toBeInTheDocument();
        expect(screen.getByText("DIRTY")).toBeInTheDocument();
        expect(screen.getByText("Mark Clean & Available")).toBeInTheDocument();

        // Clean tables (1, 2, 3, 5) must NOT appear in dirty tables list
        expect(screen.queryByText("Table 1")).not.toBeInTheDocument();
        expect(screen.queryByText("Table 2")).not.toBeInTheDocument();
        expect(screen.queryByText("Table 3")).not.toBeInTheDocument();
        expect(screen.queryByText("Table 5")).not.toBeInTheDocument();
    });

    it("TEST 3 & TEST 4: Table 2 and Table T2 remain independent in Cleaner Station (no collision)", async () => {
        const mockCollisionTables = [
            { id: 2, tableNo: "2", cleaningStatus: "DIRTY", status: "DIRTY", isOccupied: false, seats: 4, section: "Indoor" },
            { id: 202, tableNo: "T2", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 4, section: "Terrace" },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { tables: mockCollisionTables, total: 2, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true } } });
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

        await waitFor(() => {
            expect(screen.getByText("Tables Awaiting Sanitation (1)")).toBeInTheDocument();
        });

        // Table 2 must be shown as dirty, T2 must NOT be shown
        expect(screen.getByText("Table 2")).toBeInTheDocument();
        expect(screen.queryByText("Table T2")).not.toBeInTheDocument();
    });

    it("TEST 5: Socket.IO disconnected state does NOT block loading dirty tables from API", async () => {
        mockSocketConnected = false;
        mockSocket.connected = false;

        const dirtyTable99 = [
            { id: 99, tableNo: "12", cleaningStatus: "DIRTY", status: "DIRTY", isOccupied: false, seats: 8, section: "VIP Room" },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { tables: dirtyTable99, total: 1, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true } } });
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

        await waitFor(() => {
            expect(screen.getByText("Tables Awaiting Sanitation (1)")).toBeInTheDocument();
            expect(screen.getByText("Table 12")).toBeInTheDocument();
        });

        // Realtime status correctly reflects Socket.IO disconnected ("Offline")
        expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("TEST 6: Realtime 'cleaner:table_dirty' event dynamically adds dirty table without page refresh", async () => {
        let tablesState = [
            { id: 4, tableNo: "4", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 4, section: "Main Hall" },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { tables: tablesState, total: 1, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true } } });
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

        await waitFor(() => {
            expect(screen.getByText("All Tables Sanitized & Ready")).toBeInTheDocument();
        });

        // Table 4 becomes dirty on backend
        tablesState = [
            { id: 4, tableNo: "4", cleaningStatus: "DIRTY", status: "DIRTY", isOccupied: false, seats: 4, section: "Main Hall" },
        ];

        // Realtime event fired
        act(() => {
            if (socketListeners["cleaner:table_dirty"]) {
                socketListeners["cleaner:table_dirty"]({ tableId: 4, tableNo: "4" });
            }
        });

        await waitFor(() => {
            expect(screen.getByText("Tables Awaiting Sanitation (1)")).toBeInTheDocument();
            expect(screen.getByText("Table 4")).toBeInTheDocument();
        });
    });

    it("TEST 7 & TEST 8: Clicking 'Mark Clean & Available' sanitizes table and removes it from dirty list", async () => {
        let tablesState = [
            { id: 4, tableNo: "4", cleaningStatus: "DIRTY", status: "DIRTY", isOccupied: false, seats: 4, section: "Main Hall" },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { tables: tablesState, total: 1, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true } } });
            }
            return Promise.resolve({ data: {} });
        });

        axios.post.mockImplementation((url) => {
            if (url.includes("/clean")) {
                tablesState = [
                    { id: 4, tableNo: "4", cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 4, section: "Main Hall" },
                ];
                return Promise.resolve({ data: { success: true, message: "Table 4 marked clean" } });
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

        await waitFor(() => {
            expect(screen.getByText("Tables Awaiting Sanitation (1)")).toBeInTheDocument();
            expect(screen.getByText("Table 4")).toBeInTheDocument();
        });

        // Click "Mark Clean & Available"
        const cleanBtn = screen.getByText("Mark Clean & Available");
        fireEvent.click(cleanBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/clean"),
                expect.anything(),
                expect.anything()
            );
        });

        // Realtime event: cleaner:table_cleaned
        act(() => {
            if (socketListeners["cleaner:table_cleaned"]) {
                socketListeners["cleaner:table_cleaned"]({ tableId: 4, tableNo: "4" });
            }
        });

        await waitFor(() => {
            expect(screen.getByText("All Tables Sanitized & Ready")).toBeInTheDocument();
            expect(screen.queryByText("Table 4")).not.toBeInTheDocument();
        });
    });

    it("TEST 9: Multi-restaurant isolation: Restaurant 2 dirty tables are never displayed in Restaurant 1 Cleaner Station", async () => {
        // Restaurant 1 tables
        const rest1Tables = [
            { id: 10, tableNo: "10", restaurantId: 1, cleaningStatus: "CLEAN", status: "AVAILABLE", isOccupied: false, seats: 4 },
        ];

        axios.get.mockImplementation((url, config) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || (url.includes("/tables") && config?.params?.restaurantId === 1)) {
                return Promise.resolve({ data: { tables: rest1Tables, total: 1, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true } } });
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

        await waitFor(() => {
            expect(screen.getByText("All Tables Sanitized & Ready")).toBeInTheDocument();
        });

        // Realtime event for Restaurant 2 dirty table should be ignored or not affect Restaurant 1
        act(() => {
            if (socketListeners["cleaner:table_dirty"]) {
                socketListeners["cleaner:table_dirty"]({ restaurantId: 2, tableId: 999, tableNo: "99" });
            }
        });

        // Still all clean
        expect(screen.getByText("All Tables Sanitized & Ready")).toBeInTheDocument();
        expect(screen.queryByText("Table 99")).not.toBeInTheDocument();
    });

    it("TEST 10: Owner Panel and Cleaner Station use identical DiningTable.id", async () => {
        const canonicalTbl = {
            id: 42,
            tableNo: "VIP-1",
            cleaningStatus: "DIRTY",
            status: "DIRTY",
            isOccupied: false,
            seats: 6,
            section: "VIP Lounge",
        };

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/owner/1/tables") || url.includes("/tables")) {
                return Promise.resolve({ data: { tables: [canonicalTbl], total: 1, occupied: 0 } });
            }
            if (url.includes("/capabilities")) {
                return Promise.resolve({ data: { success: true, capabilities: { hasCleaner: true } } });
            }
            return Promise.resolve({ data: {} });
        });

        axios.post.mockResolvedValue({ data: { success: true } });

        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Table VIP-1")).toBeInTheDocument();
        });

        const cleanBtn = screen.getByText("Mark Clean & Available");
        fireEvent.click(cleanBtn);

        await waitFor(() => {
            // Must call with table id 42, NOT tableNo "VIP-1"
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/42/clean"),
                expect.anything(),
                expect.anything()
            );
        });
    });
});

