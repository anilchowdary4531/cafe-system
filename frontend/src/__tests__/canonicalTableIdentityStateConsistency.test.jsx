import React from "react";
import { describe, it, expect } from "vitest";
import {
    getTableIdentity,
    getTableId,
    isSameTable,
    formatTableDisplayLabel,
} from "../utils/tableIdentity.js";
import {
    normalizeCanonicalTable,
    reconcileTable,
} from "../context/TableStateContext.jsx";

describe("Canonical Table Identity & State Consistency Hardening", () => {
    describe("1. Shared Table Identity Helper", () => {
        it("strictly distinguishes Main Hall Table 1 (id: 8) from Section TABLE table 1 (id: 12)", () => {
            const mainHallTable1 = { id: 8, tableNo: "1", section: "Main Hall", restaurantId: 1 };
            const sectionTable1 = { id: 12, tableNo: "table 1", section: "TABLE", restaurantId: 1 };

            expect(getTableId(mainHallTable1)).toBe(8);
            expect(getTableId(sectionTable1)).toBe(12);

            expect(getTableIdentity(mainHallTable1)).toBe("1:8");
            expect(getTableIdentity(sectionTable1)).toBe("1:12");

            expect(isSameTable(mainHallTable1, sectionTable1)).toBe(false);
            expect(isSameTable(mainHallTable1, { id: 8, tableId: 8, restaurantId: 1 })).toBe(true);
        });

        it("formats display labels cleanly without losing section differentiation", () => {
            expect(formatTableDisplayLabel({ section: "Main Hall", tableNo: "1" })).toBe("Main Hall · Table 1");
            expect(formatTableDisplayLabel({ section: "TABLE", tableNo: "table 1" })).toBe("TABLE · Table table 1");
        });
    });

    describe("2. Canonical Occupancy & Destructive isExplicitlyFree Protection", () => {
        it("CASE 1: Table 8 with active in-flight order and closed session is OCCUPIED (never erased)", () => {
            const rawTable8 = {
                id: 8,
                tableNo: "1",
                restaurantId: 1,
                section: "Main Hall",
                status: "OCCUPIED",
                isOccupied: true,
                session: { status: "CLOSED" },
                activeSession: null,
                activeOrders: [
                    {
                        id: 1282,
                        orderNo: "CK-202610310528-1-1282",
                        targetTableId: 8,
                        tableId: 8,
                        status: "READY",
                        total: 450,
                    },
                ],
                activeOrderCount: 1,
                assignedWaiterId: 17,
                assignedWaiterName: "saimohan",
            };

            const normalized = normalizeCanonicalTable(rawTable8, 1);
            expect(normalized.isOccupied).toBe(true);
            expect(normalized.status).toBe("OCCUPIED");
            expect(normalized.activeOrders).toHaveLength(1);
            expect(normalized.activeOrderCount).toBe(1);
            expect(normalized.assignedWaiterName).toBe("saimohan");
        });

        it("CASE 2: Table 12 with 0 active orders and clean status is AVAILABLE", () => {
            const rawTable12 = {
                id: 12,
                tableNo: "table 1",
                restaurantId: 1,
                section: "TABLE",
                status: "AVAILABLE",
                isOccupied: false,
                session: { status: "CLOSED" },
                activeSession: null,
                activeOrders: [],
                activeOrderCount: 0,
                assignedWaiterId: null,
                assignedWaiterName: null,
            };

            const normalized = normalizeCanonicalTable(rawTable12, 1);
            expect(normalized.isOccupied).toBe(false);
            expect(normalized.status).toBe("AVAILABLE");
            expect(normalized.activeOrders).toHaveLength(0);
            expect(normalized.activeOrderCount).toBe(0);
        });

        it("CASE 3: Both tables have independent orders - zero cross-table pollution", () => {
            const rawTable8 = {
                id: 8,
                tableNo: "1",
                restaurantId: 1,
                activeOrders: [{ id: 101, tableId: 8, status: "READY" }],
            };
            const rawTable12 = {
                id: 12,
                tableNo: "table 1",
                restaurantId: 1,
                activeOrders: [{ id: 102, tableId: 12, status: "PREPARING" }],
            };

            const norm8 = normalizeCanonicalTable(rawTable8, 1);
            const norm12 = normalizeCanonicalTable(rawTable12, 1);

            expect(norm8.isOccupied).toBe(true);
            expect(norm8.activeOrders[0].id).toBe(101);

            expect(norm12.isOccupied).toBe(true);
            expect(norm12.activeOrders[0].id).toBe(102);

            expect(norm8.id).not.toBe(norm12.id);
        });

        it("CASE 4: Session status CLOSED does NOT override active orders in reconcileTable", () => {
            const currentTable = {
                id: 8,
                tableNo: "1",
                restaurantId: 1,
                status: "AVAILABLE",
                isOccupied: false,
                version: 1000,
                activeOrders: [],
            };

            const incomingAuthoritative = {
                id: 8,
                tableNo: "1",
                restaurantId: 1,
                status: "OCCUPIED",
                isOccupied: true,
                session: { status: "CLOSED" }, // Stale or missing session
                activeOrders: [{ id: 1282, tableId: 8, status: "READY" }],
                version: 2000,
            };

            const reconciled = reconcileTable(currentTable, incomingAuthoritative);
            expect(reconciled.isOccupied).toBe(true);
            expect(reconciled.status).toBe("OCCUPIED");
            expect(reconciled.activeOrders).toHaveLength(1);
        });

        it("CASE 5: Fresh authoritative HTTP response containing active orders is NOT rejected by stale version comparison", () => {
            const currentFromSocket = {
                id: 8,
                tableNo: "1",
                restaurantId: 1,
                status: "AVAILABLE",
                isOccupied: false,
                version: 999999, // Stamped with Date.now() on socket event
                activeOrders: [],
            };

            const incomingBackendSnapshot = {
                id: 8,
                tableNo: "1",
                restaurantId: 1,
                status: "OCCUPIED",
                isOccupied: true,
                version: 100000, // Older DB table.updatedAt timestamp
                activeOrders: [{ id: 1282, tableId: 8, status: "READY" }],
            };

            const reconciled = reconcileTable(currentFromSocket, incomingBackendSnapshot);
            expect(reconciled.isOccupied).toBe(true);
            expect(reconciled.status).toBe("OCCUPIED");
            expect(reconciled.activeOrders).toHaveLength(1);
        });
    });

    describe("3. Ready Food and Cashier Table Matching Isolation", () => {
        it("matches ready items by canonical tableId first, preventing cross-table food alerts", () => {
            const selectedTable8 = { id: 8, tableNo: "1", section: "Main Hall" };
            const readyItems = [
                { id: 201, kotItemId: 201, tableId: 8, tableNo: "1", section: "Main Hall", name: "Masala Dosa" },
                { id: 202, kotItemId: 202, tableId: 12, tableNo: "table 1", section: "TABLE", name: "Filter Coffee" },
            ];

            const table8Items = readyItems.filter((it) => {
                const tId = Number(selectedTable8.id);
                const itTid = Number(it.tableId || it.order?.tableId || 0);
                if (tId && itTid) return itTid === tId;
                return String(it.tableNo || "").trim() === String(selectedTable8.tableNo || "").trim();
            });

            expect(table8Items).toHaveLength(1);
            expect(table8Items[0].id).toBe(201);
            expect(table8Items[0].name).toBe("Masala Dosa");
        });

        it("matches Cashier bill strip by canonical tableId first, preventing bill association errors", () => {
            const tables = [
                { id: 8, tableNo: "1", section: "Main Hall" },
                { id: 12, tableNo: "table 1", section: "TABLE" },
            ];

            const orders = [
                { id: 501, tableId: 8, tableNo: "1", total: 450, paymentStatus: "PENDING" },
                { id: 502, tableId: 12, tableNo: "table 1", total: 120, paymentStatus: "PENDING" },
            ];

            const tableStrip = tables.map((t) => {
                const tid = Number(t.id);
                const activeOrder = orders.find((o) => {
                    const oTid = Number(o.tableId || o.tableSession?.tableId || 0);
                    if (tid && oTid) return oTid === tid;
                    return !oTid && String(o.tableNo || "").trim() === String(t.tableNo || "").trim();
                });
                return {
                    tableId: tid,
                    orderId: activeOrder?.id,
                    total: activeOrder?.total,
                };
            });

            expect(tableStrip[0]).toEqual({ tableId: 8, orderId: 501, total: 450 });
            expect(tableStrip[1]).toEqual({ tableId: 12, orderId: 502, total: 120 });
        });
    });
});

