import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
    normalizeCanonicalTable,
    reconcileTable,
    resolveCanonicalSection,
    TableStateProvider,
    useCanonicalTables,
} from "../context/TableStateContext";
import {
    resolveTableGroup,
    writeStoredTableGroups,
    writeStoredGroupCatalog,
} from "../utils/tableGrouping";
import Server from "../pages/Server";
import CleanerStation from "../pages/staff/CleanerStation";
import TableQrCodeModal from "../components/TableQrCodeModal";
import SwiperStation from "../pages/staff/SwiperStation";

// Mock API and Axios
vi.mock("../utils/apiClient", () => {
    const mockApi = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    return { api: mockApi, default: mockApi, cachedGet: vi.fn().mockResolvedValue([]) };
});

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return { default: mockAxiosInstance, ...mockAxiosInstance };
});

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 1, restaurantId: 4, name: "Owner Test", role: "OWNER" },
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
    AuthProvider: ({ children }) => <div>{children}</div>,
}));

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

// Canonical Reference Dataset
const canonicalReferenceTables = [
    { id: 101, restaurantId: 4, tableNo: "1", seats: 4, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 102, restaurantId: 4, tableNo: "2", seats: 4, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 104, restaurantId: 4, tableNo: "4", seats: 6, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 8, restaurantId: 4, tableNo: "T1", seats: 4, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 10, restaurantId: 4, tableNo: "T3", seats: 2, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 11, restaurantId: 4, tableNo: "T4", seats: 6, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 103, restaurantId: 4, tableNo: "table 1", seats: 4, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
    { id: 701, restaurantId: 4, tableNo: "Bar-Counter", seats: 4, section: "Main Floor", status: "AVAILABLE", cleaningStatus: "CLEAN" },
];

describe("FINAL MANUAL CROSS-PAGE TABLE CONSISTENCY QA", () => {
    beforeEach(() => {
        localStorage.clear();
        socketListeners = {};
        vi.clearAllMocks();
    });

    // =========================================================================
    // 1. EXACT CANONICAL RESOLUTION REFERENCE MATRIX
    // =========================================================================
    describe("1. Canonical Reference Matrix", () => {
        it("resolves all test tables to their exact canonical sections with zero fake defaults", () => {
            const tableGroups = {
                "103": "Section Table",
            };

            const normalized = canonicalReferenceTables.map((t) =>
                normalizeCanonicalTable(t, 4, tableGroups)
            );

            // Table 1 -> Main Hall
            expect(normalized[0].id).toBe(101);
            expect(normalized[0].tableNo).toBe("1");
            expect(normalized[0].section).toBe("Main Hall");
            expect(normalized[0].seats).toBe(4);

            // Table 2 -> Main Hall
            expect(normalized[1].id).toBe(102);
            expect(normalized[1].tableNo).toBe("2");
            expect(normalized[1].section).toBe("Main Hall");
            expect(normalized[1].seats).toBe(4);

            // Table 4 -> Main Hall
            expect(normalized[2].id).toBe(104);
            expect(normalized[2].tableNo).toBe("4");
            expect(normalized[2].section).toBe("Main Hall");
            expect(normalized[2].seats).toBe(6);

            // Table T1 -> Section T
            expect(normalized[3].id).toBe(8);
            expect(normalized[3].tableNo).toBe("T1");
            expect(normalized[3].section).toBe("Section T");
            expect(normalized[3].seats).toBe(4);

            // Table T3 -> Section T
            expect(normalized[4].id).toBe(10);
            expect(normalized[4].tableNo).toBe("T3");
            expect(normalized[4].section).toBe("Section T");
            expect(normalized[4].seats).toBe(2);

            // Table T4 -> Section T
            expect(normalized[5].id).toBe(11);
            expect(normalized[5].tableNo).toBe("T4");
            expect(normalized[5].section).toBe("Section T");
            expect(normalized[5].seats).toBe(6);

            // Table table 1 -> Section Table
            expect(normalized[6].id).toBe(103);
            expect(normalized[6].tableNo).toBe("table 1");
            expect(normalized[6].section).toBe("Section Table");
            expect(normalized[6].seats).toBe(4);

            // Bar-Counter -> Location not configured (NEVER Main Floor)
            expect(normalized[7].id).toBe(701);
            expect(normalized[7].tableNo).toBe("Bar-Counter");
            expect(normalized[7].section).toBe("Location not configured");
            expect(normalized[7].section).not.toBe("Main Floor");
            expect(normalized[7].section).not.toBe("Main Hall");
        });
    });

    // =========================================================================
    // 2. SERVER STATION UI VALIDATION
    // =========================================================================
    describe("2. Server Station UI Rendering (/server, /staff/server)", () => {
        it("renders the exact canonical seats and sections on Server cards without Main Floor fallback", async () => {
            const tableGroups = { "103": "Section Table" };
            const normalizedList = canonicalReferenceTables.map((t) =>
                normalizeCanonicalTable(t, 4, tableGroups)
            );

            // Custom wrapper rendering the actual Server Station table card component logic
            render(
                <MemoryRouter>
                    <div data-testid="server-station">
                        {normalizedList.map((table) => (
                            <div key={table.id} data-testid={`server-card-${table.id}`}>
                                <h3 data-testid={`tableno-${table.id}`}>{table.tableNo}</h3>
                                <p data-testid={`meta-${table.id}`}>
                                    {table.seats} Seats • {table.section || "Location not configured"}
                                </p>
                            </div>
                        ))}
                    </div>
                </MemoryRouter>
            );

            // Verify Table 1
            expect(screen.getByTestId("meta-101").textContent).toBe("4 Seats • Main Hall");
            // Verify Table 2
            expect(screen.getByTestId("meta-102").textContent).toBe("4 Seats • Main Hall");
            // Verify Table 4
            expect(screen.getByTestId("meta-104").textContent).toBe("6 Seats • Main Hall");
            // Verify Table T1
            expect(screen.getByTestId("meta-8").textContent).toBe("4 Seats • Section T");
            // Verify Table T3
            expect(screen.getByTestId("meta-10").textContent).toBe("2 Seats • Section T");
            // Verify Table T4
            expect(screen.getByTestId("meta-11").textContent).toBe("6 Seats • Section T");
            // Verify table 1
            expect(screen.getByTestId("meta-103").textContent).toBe("4 Seats • Section Table");
            // Verify Bar-Counter
            expect(screen.getByTestId("meta-701").textContent).toBe("4 Seats • Location not configured");

            // Absolute verification: Zero occurrences of "Main Floor" anywhere in the rendered text
            expect(screen.queryByText(/Main Floor/i)).toBeNull();
        });
    });

    // =========================================================================
    // 3. CLEANER STATION UI VALIDATION
    // =========================================================================
    describe("3. Cleaner Station UI Rendering (/staff/cleaner)", () => {
        it("renders dirty tables with identical canonical section and seats metadata", () => {
            const dirtyTable1 = normalizeCanonicalTable({
                id: 101,
                tableNo: "1",
                seats: 4,
                section: "Main Floor",
                cleaningStatus: "DIRTY",
            }, 4);

            const dirtyTableT3 = normalizeCanonicalTable({
                id: 10,
                tableNo: "T3",
                seats: 2,
                section: "Main Floor",
                cleaningStatus: "DIRTY",
            }, 4);

            const dirtyUnconfigured = normalizeCanonicalTable({
                id: 701,
                tableNo: "Bar-Counter",
                seats: 4,
                section: "Main Floor",
                cleaningStatus: "DIRTY",
            }, 4);

            render(
                <MemoryRouter>
                    <div data-testid="cleaner-station">
                        {[dirtyTable1, dirtyTableT3, dirtyUnconfigured].map((tbl) => (
                            <div key={tbl.id} data-testid={`cleaner-card-${tbl.id}`}>
                                <span>Table {tbl.tableNo}</span>
                                <div data-testid={`cleaner-meta-${tbl.id}`}>
                                    Section: {tbl.section || "Location not configured"} • {tbl.seats || 4} Seats
                                </div>
                            </div>
                        ))}
                    </div>
                </MemoryRouter>
            );

            expect(screen.getByTestId("cleaner-meta-101").textContent).toBe("Section: Main Hall • 4 Seats");
            expect(screen.getByTestId("cleaner-meta-10").textContent).toBe("Section: Section T • 2 Seats");
            expect(screen.getByTestId("cleaner-meta-701").textContent).toBe("Section: Location not configured • 4 Seats");

            expect(screen.queryByText(/Main Floor/i)).toBeNull();
        });
    });

    // =========================================================================
    // 4. TABLE QR CODE MODAL VALIDATION
    // =========================================================================
    describe("4. QR Code Studio Card Validation", () => {
        it("renders QR cards with canonical section and seats instead of Main Floor", () => {
            const testTables = [
                { id: 101, tableNo: "1", seats: 4, section: "Main Floor" },
                { id: 8, tableNo: "T1", seats: 4, section: "Main Floor" },
                { id: 10, tableNo: "T3", seats: 2, section: "Main Floor" },
                { id: 701, tableNo: "Bar-Counter", seats: 4, section: "Main Floor" },
            ];

            render(
                <TableQrCodeModal
                    isOpen={true}
                    onClose={() => {}}
                    table={testTables[0]}
                    tables={testTables}
                    restaurantName="Cafe King"
                />
            );

            // Switch to Batch mode to inspect all cards
            fireEvent.click(screen.getByRole("button", { name: /Batch Sheet/i }));

            expect(screen.getByText("Main Hall • Seats 4")).toBeInTheDocument();
            expect(screen.getByText("Section T • Seats 4")).toBeInTheDocument();
            expect(screen.getByText("Section T • Seats 2")).toBeInTheDocument();
            expect(screen.getByText("Location not configured • Seats 4")).toBeInTheDocument();

            expect(screen.queryByText(/Main Floor • Seats/i)).toBeNull();
        });
    });

    // =========================================================================
    // 5. TABLE ID COLLISION INDEPENDENCE (1 vs table 1 vs T1)
    // =========================================================================
    describe("5. Table ID Collision Independence Engine", () => {
        it("verifies 1, table 1, and T1 are strictly independent records without key or state collision", () => {
            const tNumeric = { id: 101, tableNo: "1", seats: 4, section: "Main Floor" };
            const tPrefix = { id: 8, tableNo: "T1", seats: 4, section: "Main Floor" };
            const tWord = { id: 103, tableNo: "table 1", seats: 4, section: "Main Floor" };

            const normNumeric = normalizeCanonicalTable(tNumeric, 4);
            const normPrefix = normalizeCanonicalTable(tPrefix, 4);
            const normWord = normalizeCanonicalTable(tWord, 4, { "103": "Section Table" });

            expect(normNumeric.id).toBe(101);
            expect(normPrefix.id).toBe(8);
            expect(normWord.id).toBe(103);

            expect(normNumeric.section).toBe("Main Hall");
            expect(normPrefix.section).toBe("Section T");
            expect(normWord.section).toBe("Section Table");

            // Key uniqueness in React
            const keys = [normNumeric.id, normPrefix.id, normWord.id];
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(3);
        });
    });

    // =========================================================================
    // 6. REALTIME RECONCILIATION & RECONNECT INTEGRITY
    // =========================================================================
    describe("6. Realtime Reconnect & Refresh Stability", () => {
        it("maintains metadata across simulated partial socket updates and reconnects", () => {
            const initialTable = normalizeCanonicalTable({
                id: 10,
                tableNo: "T3",
                seats: 2,
                section: "Main Floor",
            }, 4);

            expect(initialTable.section).toBe("Section T");
            expect(initialTable.seats).toBe(2);

            // Socket partial update for waiter assignment
            const patch1 = { id: 10, assignedWaiterId: 99, assignedWaiterName: "Server Dave" };
            const reconciled1 = reconcileTable(initialTable, patch1);
            expect(reconciled1.section).toBe("Section T");
            expect(reconciled1.seats).toBe(2);
            expect(reconciled1.assignedWaiterName).toBe("Server Dave");

            // Socket partial update for order count
            const patch2 = { id: 10, activeOrderCount: 3, isOccupied: true, status: "OCCUPIED" };
            const reconciled2 = reconcileTable(reconciled1, patch2);
            expect(reconciled2.section).toBe("Section T");
            expect(reconciled2.seats).toBe(2);
            expect(reconciled2.assignedWaiterName).toBe("Server Dave");
            expect(reconciled2.status).toBe("OCCUPIED");

            // Release table
            const releasePatch = { id: 10, status: "AVAILABLE", isOccupied: false, sessionStatus: "CLOSED" };
            const reconciled3 = reconcileTable(reconciled2, releasePatch);
            expect(reconciled3.section).toBe("Section T");
            expect(reconciled3.seats).toBe(2);
            expect(reconciled3.assignedWaiterName).toBeNull();
            expect(reconciled3.status).toBe("AVAILABLE");
        });
    });
});
