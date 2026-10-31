import React from "react";
import { describe, it, expect } from "vitest";
import { getCanonicalTableIdentity, formatTableDisplayLabel } from "../utils/tableIdentity.js";

// Canonical Table Normalizer matching OwnerLayout.jsx
const normalizeTableRows = (rows) => {
    const rawList = Array.isArray(rows) ? rows : (rows && Array.isArray(rows.tables) ? rows.tables : []);
    const seenTableIds = new Set();
    const list = [];
    for (const item of rawList) {
        if (item?.id) {
            const sid = String(item.id);
            if (seenTableIds.has(sid)) continue;
            seenTableIds.add(sid);
        }
        list.push(item);
    }
    return list.map((table, index) => {
        const sessionMatchesTable = Boolean(
            table?.activeSession &&
            table.activeSession.tableId &&
            String(table.activeSession.tableId) === String(table.id)
        );
        const activeSessionForTable = sessionMatchesTable ? table.activeSession : null;

        const rawActiveOrders = Array.isArray(table?.activeOrders)
            ? table.activeOrders
                  .filter((order) => {
                      const orderTableId = order?.targetTableId || order?.tableId;
                      return Boolean(orderTableId && String(orderTableId) === String(table?.id));
                  })
                  .map((order) => ({
                      id: order?.id,
                      orderNo: order?.orderNo || "",
                      status: String(order?.status || "").toUpperCase(),
                      paymentStatus: String(order?.paymentStatus || order?.payment_status || "PENDING").toUpperCase(),
                      createdAt: order?.createdAt || null,
                      total: Number(order?.total || 0),
                  }))
            : [];

        const seenActiveOrderIds = new Set();
        const deduplicatedActiveOrders = [];
        for (const ord of rawActiveOrders) {
            const oid = ord?.id ? Number(ord.id) : null;
            if (oid) {
                if (seenActiveOrderIds.has(oid)) continue;
                seenActiveOrderIds.add(oid);
            }
            deduplicatedActiveOrders.push(ord);
        }

        const hasActiveOrders = deduplicatedActiveOrders.length > 0;
        const hasActiveSession = Boolean(
            activeSessionForTable &&
            activeSessionForTable.status !== "CLOSED" &&
            activeSessionForTable.status !== "CANCELLED"
        );
        const isDirty = table?.cleaningStatus === "DIRTY" || table?.status === "DIRTY";
        const isOccupied = !isDirty && (hasActiveOrders || hasActiveSession);
        const activeOrders = isOccupied ? deduplicatedActiveOrders : [];
        const activeOrderCount = isOccupied ? activeOrders.length : 0;
        const activeOrderStatus = isOccupied ? (activeOrders[0]?.status || null) : null;

        const serverNameFromSession = isOccupied ? activeSessionForTable?.waiterName : null;
        const serverIdFromSession = isOccupied ? activeSessionForTable?.waiterId : null;
        const assignedServer = serverNameFromSession || (table?.assignedWaiterId ? (table?.assignedWaiterName || table?.assignedServer || null) : null);
        const assignedWaiterName = serverNameFromSession || (table?.assignedWaiterId ? (table?.assignedWaiterName || null) : null);
        const assignedWaiterId = serverIdFromSession || (table?.assignedWaiterId ? Number(table.assignedWaiterId) : null);

        const occupiedSince = isOccupied
            ? (activeSessionForTable?.createdAt || activeOrders[0]?.createdAt || null)
            : null;

        return {
            ...table,
            tableNo: String(table?.tableNo || "").trim(),
            cleaningStatus: isDirty ? "DIRTY" : (table?.cleaningStatus || "CLEAN"),
            status: isDirty ? "DIRTY" : (isOccupied ? "OCCUPIED" : "AVAILABLE"),
            assignedWaiterId,
            assignedWaiterName,
            assignedServer,
            isOccupied,
            occupiedSince,
            activeOrderCount,
            activeOrderStatus,
            activeOrders,
            activeSession: activeSessionForTable,
            assignmentKey: table?.id
                ? `table-id-${table.id}`
                : `table-no-${String(table?.tableNo || "").trim().toLowerCase() || index}`,
            key: table?.id ? `table-id-${table.id}` : `${table?.tableNo || "table"}-${index}`,
        };
    });
};

// Realtime socket handler simulation matching OwnerLayout.jsx
const applyTableUpdated = (tables, payload) => {
    if (!payload || typeof payload !== "object") return tables;
    const targetId = payload.tableId || payload.id;
    if (!targetId) return tables; // Strict canonical identity: fail closed if no tableId

    const isDirty = payload.cleaningStatus === "DIRTY" || payload.status === "DIRTY";
    return tables.map((t) => {
        if (String(t.id) === String(targetId)) {
            return {
                ...t,
                status: isDirty ? "DIRTY" : (payload.status || "AVAILABLE"),
                cleaningStatus: isDirty ? "DIRTY" : "CLEAN",
                isOccupied: Boolean(payload.isOccupied),
            };
        }
        return t;
    });
};

describe("PHASE 14: FRONTEND TABLE IDENTITY & CLEANING ISOLATION SUITE", () => {
    it("1. Canonical table identity helper generates unique identity keys and deterministic display labels", () => {
        expect(getCanonicalTableIdentity({ restaurantId: 1, tableId: 101 })).toBe("1:101");
        expect(getCanonicalTableIdentity({ restaurantId: 1, tableId: 102 })).toBe("1:102");
        expect(getCanonicalTableIdentity({ restaurantId: 1, tableId: null })).toBe(null);

        expect(formatTableDisplayLabel({ section: "Main Hall", tableNo: "1" })).toBe("Main Hall · Table 1");
        expect(formatTableDisplayLabel({ section: "Section TABLE", tableNo: "table 1" })).toBe("Section TABLE · Table table 1");
    });

    it("2. Main Hall (tableId: 101, tableNo: '1') and Section TABLE (tableId: 102, tableNo: 'table 1') are isolated", () => {
        const rawTables = [
            {
                id: 101,
                tableNo: "1",
                section: "Main Hall",
                cleaningStatus: "CLEAN",
                status: "AVAILABLE",
            },
            {
                id: 102,
                tableNo: "table 1",
                section: "Section TABLE",
                cleaningStatus: "CLEAN",
                status: "AVAILABLE",
            },
        ];

        const normalized = normalizeTableRows(rawTables);
        expect(normalized).toHaveLength(2);
        expect(normalized[0].assignmentKey).toBe("table-id-101");
        expect(normalized[1].assignmentKey).toBe("table-id-102");
        expect(normalized[0].status).toBe("AVAILABLE");
        expect(normalized[1].status).toBe("AVAILABLE");
    });

    it("3. Order with targetTableId: 101 and tableNo: '1' attaches ONLY to tableId 101, NOT tableId 102", () => {
        const rawTables = [
            {
                id: 101,
                tableNo: "1",
                section: "Main Hall",
                cleaningStatus: "CLEAN",
                activeOrders: [
                    {
                        id: 901,
                        targetTableId: 101,
                        tableId: 101,
                        tableNo: "1",
                        orderNo: "CK-101-1",
                        status: "CONFIRMED",
                        paymentStatus: "PENDING",
                    },
                ],
                activeSession: {
                    id: 301,
                    tableId: 101,
                    tableNo: "1",
                    status: "OPEN",
                    waiterId: 55,
                    waiterName: "Alice",
                },
            },
            {
                id: 102,
                tableNo: "table 1",
                section: "Section TABLE",
                cleaningStatus: "CLEAN",
                activeOrders: [],
                activeSession: null,
            },
        ];

        const normalized = normalizeTableRows(rawTables);
        const t101 = normalized.find((t) => t.id === 101);
        const t102 = normalized.find((t) => t.id === 102);

        expect(t101.isOccupied).toBe(true);
        expect(t101.activeOrderCount).toBe(1);
        expect(t101.activeOrders[0].id).toBe(901);
        expect(t101.assignedServer).toBe("Alice");

        expect(t102.isOccupied).toBe(false);
        expect(t102.activeOrderCount).toBe(0);
        expect(t102.activeOrders).toHaveLength(0);
        expect(t102.assignedServer).toBe(null);
    });

    it("4. Realtime socket event with tableId: 101 updates ONLY tableId 101", () => {
        const initialTables = [
            { id: 101, tableNo: "1", status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
            { id: 102, tableNo: "table 1", status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        ];

        const updated = applyTableUpdated(initialTables, {
            tableId: 101,
            tableNo: "1",
            status: "DIRTY",
            cleaningStatus: "DIRTY",
            isOccupied: false,
        });

        const t101 = updated.find((t) => t.id === 101);
        const t102 = updated.find((t) => t.id === 102);

        expect(t101.status).toBe("DIRTY");
        expect(t101.cleaningStatus).toBe("DIRTY");
        expect(t102.status).toBe("AVAILABLE");
        expect(t102.cleaningStatus).toBe("CLEAN");
    });

    it("5. Malformed realtime socket event with tableNo: '1' but NO tableId fails closed (does not touch any table)", () => {
        const initialTables = [
            { id: 101, tableNo: "1", status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
            { id: 102, tableNo: "table 1", status: "AVAILABLE", cleaningStatus: "CLEAN", isOccupied: false },
        ];

        // Intentionally malformed payload with no tableId
        const updated = applyTableUpdated(initialTables, {
            tableNo: "1",
            status: "DIRTY",
            cleaningStatus: "DIRTY",
            isOccupied: false,
        });

        const t101 = updated.find((t) => t.id === 101);
        const t102 = updated.find((t) => t.id === 102);

        expect(t101.status).toBe("AVAILABLE");
        expect(t101.cleaningStatus).toBe("CLEAN");
        expect(t102.status).toBe("AVAILABLE");
        expect(t102.cleaningStatus).toBe("CLEAN");
    });
});
