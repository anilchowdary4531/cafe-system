import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getCanonicalTableKey,
    normalizeCanonicalTable,
    reconcileTable,
    TableStateProvider,
    useCanonicalTables,
} from "../context/TableStateContext";

// Mock socket
let socketListeners = {};
const mockSocket = {
    on: vi.fn((event, cb) => {
        socketListeners[event] = cb;
    }),
    off: vi.fn((event) => {
        delete socketListeners[event];
    }),
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        connected: true,
    }),
}));

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 1, restaurantId: 10, name: "Owner King", role: "OWNER" },
    }),
}));

vi.mock("axios", () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: {
                tables: [
                    {
                        id: 2,
                        tableNo: "2",
                        restaurantId: 10,
                        status: "AVAILABLE",
                        isOccupied: false,
                        assignedWaiterId: null,
                        assignedWaiterName: null,
                        version: 1000,
                    },
                    {
                        id: 6,
                        tableNo: "T2",
                        restaurantId: 10,
                        status: "AVAILABLE",
                        isOccupied: false,
                        assignedWaiterId: null,
                        assignedWaiterName: null,
                        version: 1000,
                    },
                ],
            },
        }),
    },
}));

function ConsumerComponent() {
    const { tables, getTable, occupiedCount, freeCount } = useCanonicalTables();
    return (
        <div>
            <div data-testid="table-count">{tables.length}</div>
            <div data-testid="occupied-count">{occupiedCount}</div>
            <div data-testid="free-count">{freeCount}</div>
            {tables.map((t) => (
                <div key={t.id} data-testid={`table-${t.id}`}>
                    <span data-testid={`table-no-${t.id}`}>{t.tableNo}</span>
                    <span data-testid={`table-status-${t.id}`}>{t.status}</span>
                    <span data-testid={`table-server-${t.id}`}>{t.assignedServer || "Unassigned"}</span>
                </div>
            ))}
        </div>
    );
}

describe("Zero-Mismatch Canonical Table State Architecture", () => {
    beforeEach(() => {
        socketListeners = {};
        vi.clearAllMocks();
    });

    describe("Step 3: Canonical Table Identity", () => {
        it("constructs canonical key with restaurantId + database tableId", () => {
            const key1 = getCanonicalTableKey({ restaurantId: 10, tableId: 2 });
            const key2 = getCanonicalTableKey({ restaurantId: 10, tableId: 6 });
            const key3 = getCanonicalTableKey({ restaurantId: 20, tableId: 2 });

            expect(key1).toBe("10:table:2");
            expect(key2).toBe("10:table:6");
            expect(key3).toBe("20:table:2");

            // Table 2 (id: 2) and Table T2 (id: 6) MUST have different canonical keys!
            expect(key1).not.toBe(key2);
            // Restaurant isolation: Restaurant 10 vs 20 Table 2 must be different!
            expect(key1).not.toBe(key3);
        });
    });

    describe("Step 2 & 7: Canonical Normalization & Free Table State", () => {
        it("normalizes an occupied table correctly", () => {
            const raw = {
                id: 2,
                tableNo: "2",
                restaurantId: 10,
                status: "OCCUPIED",
                isOccupied: true,
                assignedWaiterId: 101,
                assignedWaiterName: "Kamalesh",
                activeOrders: [{ id: 1, total: 672 }],
                activeOrderStatus: "PREPARING",
                updatedAt: "2026-10-22T10:00:00.000Z",
            };

            const canonical = normalizeCanonicalTable(raw, 10);
            expect(canonical.status).toBe("OCCUPIED");
            expect(canonical.isOccupied).toBe(true);
            expect(canonical.assignedServer).toBe("Kamalesh");
            expect(canonical.assignedServerId).toBe(101);
            expect(canonical.activeOrderCount).toBe(1);
        });

        it("normalizes a freed table to AVAILABLE, Unassigned, with zero active orders", () => {
            const raw = {
                id: 2,
                tableNo: "2",
                restaurantId: 10,
                status: "AVAILABLE",
                isOccupied: false,
                session: { status: "CLOSED" },
                assignedWaiterId: null,
                assignedWaiterName: null,
            };

            const canonical = normalizeCanonicalTable(raw, 10);
            expect(canonical.status).toBe("AVAILABLE");
            expect(canonical.isOccupied).toBe(false);
            expect(canonical.assignedServer).toBe(null);
            expect(canonical.assignedServerId).toBe(null);
            expect(canonical.activeOrders).toEqual([]);
            expect(canonical.activeOrderCount).toBe(0);
            expect(canonical.sessionStatus).toBe("CLOSED");
        });
    });

    describe("Step 10: Race Condition Protection (Reconcile Monotonic Versioning)", () => {
        it("rejects a stale HTTP/Socket response with strictly older version", () => {
            const current = {
                id: 2,
                tableNo: "2",
                status: "AVAILABLE",
                isOccupied: false,
                assignedServer: null,
                version: 2000,
                updatedAt: new Date(2000).toISOString(),
            };

            // Stale late response with version 1000 saying table is still OCCUPIED
            const staleIncoming = {
                id: 2,
                tableNo: "2",
                status: "OCCUPIED",
                isOccupied: true,
                assignedServer: "Kamalesh",
                version: 1000,
                updatedAt: new Date(1000).toISOString(),
            };

            const result = reconcileTable(current, staleIncoming);
            // Stale response must be rejected: current AVAILABLE state preserved!
            expect(result.status).toBe("AVAILABLE");
            expect(result.isOccupied).toBe(false);
            expect(result.assignedServer).toBe(null);
        });

        it("accepts a newer incoming update with greater version", () => {
            const current = {
                id: 2,
                tableNo: "2",
                status: "AVAILABLE",
                isOccupied: false,
                assignedServer: null,
                version: 2000,
            };

            const newerIncoming = {
                id: 2,
                tableNo: "2",
                status: "OCCUPIED",
                isOccupied: true,
                assignedServer: "Kamalesh",
                assignedWaiterId: 101,
                assignedWaiterName: "Kamalesh",
                version: 3000,
            };

            const result = reconcileTable(current, newerIncoming);
            expect(result.status).toBe("OCCUPIED");
            expect(result.isOccupied).toBe(true);
            expect(result.assignedServer).toBe("Kamalesh");
        });
    });

    describe("Step 6, 7 & 14: Multi-Consumer Synchronization & Table Isolation", () => {
        it("synchronizes assignment and release across consumers with strict Table 2 vs T2 isolation", async () => {
            render(
                <TableStateProvider>
                    <ConsumerComponent />
                </TableStateProvider>
            );

            // Wait for initial render with 2 tables
            await screen.findByTestId("table-2");
            await screen.findByTestId("table-6");

            expect(screen.getByTestId("table-server-2").textContent).toBe("Unassigned");
            expect(screen.getByTestId("table-server-6").textContent).toBe("Unassigned");

            // TEST A: Assign Table 2 -> Kamalesh via Socket
            act(() => {
                if (socketListeners["table:waiter_assigned"]) {
                    socketListeners["table:waiter_assigned"]({
                        restaurantId: 10,
                        tableId: 2,
                        id: 2,
                        tableNo: "2",
                        assignedWaiterId: 101,
                        assignedWaiterName: "Kamalesh",
                        version: Date.now() + 1000,
                    });
                }
            });

            // Table 2 must show Kamalesh
            expect(screen.getByTestId("table-server-2").textContent).toBe("Kamalesh");
            // Table T2 (id: 6) MUST remain Unassigned!
            expect(screen.getByTestId("table-server-6").textContent).toBe("Unassigned");

            // TEST C: Free Table 2
            act(() => {
                if (socketListeners["table:updated"]) {
                    socketListeners["table:updated"]({
                        restaurantId: 10,
                        tableId: 2,
                        id: 2,
                        tableNo: "2",
                        status: "AVAILABLE",
                        isOccupied: false,
                        assignedWaiterId: null,
                        assignedWaiterName: null,
                        assignedServer: null,
                        activeOrders: [],
                        version: Date.now() + 2000,
                    });
                }
            });

            // Table 2 must be immediately AVAILABLE and Unassigned!
            expect(screen.getByTestId("table-status-2").textContent).toBe("AVAILABLE");
            expect(screen.getByTestId("table-server-2").textContent).toBe("Unassigned");
            expect(screen.getByTestId("table-server-6").textContent).toBe("Unassigned");
        });
    });
});
