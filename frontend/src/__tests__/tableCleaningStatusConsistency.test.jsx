import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { normalizeCanonicalTable } from "../context/TableStateContext";
import OwnerLayout from "../layouts/OwnerLayout";
import Server from "../pages/Server";

let socketListeners = {};
const mockSocket = {
    on: vi.fn((event, handler) => {
        socketListeners[event] = handler;
    }),
    off: vi.fn((event) => {
        delete socketListeners[event];
    }),
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        connected: true,
        isConnected: true,
    }),
    StaffSocketProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("../context/SocketContext", () => ({
    useSocket: () => ({
        socket: mockSocket,
        connected: true,
        isConnected: true,
    }),
    SocketProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 1, restaurantId: 4, name: "Test User", role: "OWNER" },
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
    AuthProvider: ({ children }) => <div>{children}</div>,
}));

let currentTables = [];

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return { data: { tables: currentTables }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/active-sessions") || urlStr.includes("/sessions")) {
            return { data: { sessions: [] }, loading: false, refresh: vi.fn() };
        }
        return { data: {}, loading: false, refresh: vi.fn() };
    },
}));

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return { default: mockAxiosInstance, ...mockAxiosInstance };
});

vi.mock("../utils/apiClient", async (importOriginal) => {
    const actual = await importOriginal();
    const mockApi = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    return {
        ...actual,
        api: mockApi,
        default: mockApi,
        cachedGet: vi.fn().mockImplementation(() => Promise.resolve({ tables: currentTables })),
        makeGetCacheKey: vi.fn().mockReturnValue("mock-cache-key"),
    };
});

describe("TABLE CLEANING STATUS CONSISTENCY SUITE", () => {
    const dataset9Tables = [
        { id: 101, restaurantId: 4, tableNo: "Table 1", seats: 4, status: "DIRTY", cleaningStatus: "DIRTY", isOccupied: false },
        { id: 102, restaurantId: 4, tableNo: "Table 2", seats: 4, status: "DIRTY", cleaningStatus: "DIRTY", isOccupied: false },
        { id: 10, restaurantId: 4, tableNo: "T3", seats: 2, status: "DIRTY", cleaningStatus: "DIRTY", isOccupied: false },
        { id: 103, restaurantId: 4, tableNo: "table 1", seats: 4, status: "DIRTY", cleaningStatus: "DIRTY", isOccupied: false },
        { id: 104, restaurantId: 4, tableNo: "Table 4", seats: 6, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        { id: 105, restaurantId: 4, tableNo: "Table 5", seats: 4, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        { id: 106, restaurantId: 4, tableNo: "Table 6", seats: 4, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        { id: 107, restaurantId: 4, tableNo: "Table 7", seats: 4, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        { id: 108, restaurantId: 4, tableNo: "Table 8", seats: 4, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
    ];

    beforeEach(() => {
        localStorage.clear();
        socketListeners = {};
        vi.clearAllMocks();
        window.history.pushState({}, "", "/server");
        currentTables = [...dataset9Tables];
    });

    it("TEST 1 & TEST 4: Tables requiring cleaning appear as CLEANING on Server Station; genuinely available tables appear Available", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: { tables: dataset9Tables } });
            }
            if (url.includes("/active-sessions") || url.includes("/sessions")) {
                return Promise.resolve({ data: { sessions: [] } });
            }
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter initialEntries={["/server"]}>
                <Server />
            </MemoryRouter>
        );

        await waitFor(() => {
            // Server Station summary badge for cleaning needed
            expect(screen.getByText(/Cleaning Needed \(4\)/i)).toBeInTheDocument();
        });

        // Verify the 4 dirty tables show CLEANING state
        const cleaningElements = screen.getAllByText(/CLEANING/i);
        expect(cleaningElements.length).toBeGreaterThanOrEqual(4);

        // Verify Table 4 (AVAILABLE) shows Available
        expect(screen.getByText(/Table 4/i)).toBeInTheDocument();
        expect(screen.getByText(/Available \(5\)/i)).toBeInTheDocument();
    });

    it("TEST 2 & TEST 3: The SAME DiningTables appear as Cleaning on Owner Dashboard and are NOT counted as Free/Available", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: { tables: dataset9Tables, total: 9, occupied: 0 } });
            }
            if (url.includes("/staff")) {
                return Promise.resolve({ data: { users: [] } });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Tables: 9/i)).toBeInTheDocument();
        });

        // Summary counts: Tables: 9, Occupied: 0, Cleaning: 4, Free: 5 (NOT Free: 9!)
        expect(screen.getByText(/Occupied: 0/i)).toBeInTheDocument();
        expect(screen.getByText(/Cleaning: 4/i)).toBeInTheDocument();
        expect(screen.getByText(/Free: 5/i)).toBeInTheDocument();

        // Cards: The 4 dirty tables must show "Cleaning" badge
        const cleaningBadges = screen.getAllByText(/^Cleaning$/i);
        expect(cleaningBadges.length).toBe(4);
    });

    it("TEST 5: A cleaning table becomes Available only after Cleaner completes cleaning workflow", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: { tables: currentTables, total: 9, occupied: 0 } });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Cleaning: 4/i)).toBeInTheDocument();
            expect(screen.getByText(/Free: 5/i)).toBeInTheDocument();
        });

        // Simulate cleaner completing Table 101 cleaning
        currentTables = currentTables.map((t) =>
            t.id === 101 ? { ...t, status: "AVAILABLE", cleaningStatus: "CLEAN" } : t
        );

        // Realtime event emitted by backend cleaner completion
        act(() => {
            if (socketListeners["table:updated"]) {
                socketListeners["table:updated"]({
                    tableId: 101,
                    status: "AVAILABLE",
                    cleaningStatus: "CLEAN",
                    isOccupied: false,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText(/Cleaning: 3/i)).toBeInTheDocument();
            expect(screen.getByText(/Free: 6/i)).toBeInTheDocument();
        });
    });

    it("TEST 6: Refresh Owner Dashboard retains correct cleaning status", async () => {
        axios.get.mockResolvedValue({
            data: { tables: dataset9Tables, total: 9, occupied: 0 },
        });

        const { unmount } = render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Cleaning: 4/i)).toBeInTheDocument();
            expect(screen.getByText(/Free: 5/i)).toBeInTheDocument();
        });

        unmount();

        // Re-mount / Refresh
        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Cleaning: 4/i)).toBeInTheDocument();
            expect(screen.getByText(/Free: 5/i)).toBeInTheDocument();
        });
    });

    it("TEST 7: Refresh Server Station retains correct cleaning status", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: { tables: dataset9Tables } });
            }
            return Promise.resolve({ data: [] });
        });

        const { unmount } = render(
            <MemoryRouter initialEntries={["/server"]}>
                <Server />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Cleaning Needed \(4\)/i)).toBeInTheDocument();
        });

        unmount();

        render(
            <MemoryRouter initialEntries={["/server"]}>
                <Server />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Cleaning Needed \(4\)/i)).toBeInTheDocument();
        });
    });

    it("TEST 8: Complete payment for Table A makes Table A cleaning-required while Table B is unaffected", async () => {
        currentTables = [
            { id: 201, restaurantId: 4, tableNo: "Table A", seats: 4, status: "OCCUPIED", cleaningStatus: "CLEAN", isOccupied: true },
            { id: 202, restaurantId: 4, tableNo: "Table B", seats: 4, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: {
                        tables: currentTables,
                        total: currentTables.length,
                        occupied: currentTables.filter((t) => t.isOccupied).length,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <OwnerLayout />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Occupied: 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Free: 1/i)).toBeInTheDocument();
        });

        // Payment completed for Table A -> session closed -> Table A dirty
        currentTables = [
            { id: 201, restaurantId: 4, tableNo: "Table A", seats: 4, status: "DIRTY", cleaningStatus: "DIRTY", isOccupied: false },
            { id: 202, restaurantId: 4, tableNo: "Table B", seats: 4, status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        ];

        act(() => {
            if (socketListeners["table:updated"]) {
                socketListeners["table:updated"]({
                    tableId: 201,
                    status: "DIRTY",
                    cleaningStatus: "DIRTY",
                    isOccupied: false,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText(/Occupied: 0/i)).toBeInTheDocument();
            expect(screen.getByText(/Cleaning: 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Free: 1/i)).toBeInTheDocument();
        });
    });

    it("TEST 9: Two tables with similar display names (ID 101 'Table 1' vs ID 102 '1') remain independent", () => {
        const table101 = normalizeCanonicalTable({
            id: 101,
            restaurantId: 4,
            tableNo: "Table 1",
            status: "DIRTY",
            cleaningStatus: "DIRTY",
            isOccupied: false,
        });

        const table102 = normalizeCanonicalTable({
            id: 102,
            restaurantId: 4,
            tableNo: "1",
            status: "AVAILABLE",
            cleaningStatus: "CLEAN",
            isOccupied: false,
        });

        expect(table101.id).toBe(101);
        expect(table101.status).toBe("DIRTY");
        expect(table101.cleaningStatus).toBe("DIRTY");

        expect(table102.id).toBe(102);
        expect(table102.status).toBe("AVAILABLE");
        expect(table102.cleaningStatus).toBe("CLEAN");

        // Ensuring modifying 101 never changes 102
        expect(table101.id).not.toBe(table102.id);
        expect(table101.status).not.toBe(table102.status);
    });

    it("TEST 10: Multi-restaurant isolation: Restaurant A cleaning tables never affect Restaurant B", () => {
        const restATable = normalizeCanonicalTable(
            { id: 301, restaurantId: 4, tableNo: "1", status: "DIRTY", cleaningStatus: "DIRTY", isOccupied: false },
            4
        );
        const restBTable = normalizeCanonicalTable(
            { id: 302, restaurantId: 99, tableNo: "1", status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
            99
        );

        expect(restATable.restaurantId).toBe(4);
        expect(restATable.status).toBe("DIRTY");
        expect(restBTable.restaurantId).toBe(99);
        expect(restBTable.status).toBe("AVAILABLE");
    });
});
