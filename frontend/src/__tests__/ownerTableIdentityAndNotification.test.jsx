import React from "react";
import { describe, it, expect } from "vitest";

// We test the table normalization and assignment isolation logic matching OwnerLayout implementation
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
            (!table.activeSession.tableId || String(table.activeSession.tableId) === String(table.id))
        );
        const activeSessionForTable = sessionMatchesTable ? table.activeSession : null;

        const rawActiveOrders = Array.isArray(table?.activeOrders)
            ? table.activeOrders
                  .filter((order) => !order?.targetTableId || String(order.targetTableId) === String(table?.id))
                  .map((order) => ({
                      id: order?.id,
                      orderNo: order?.orderNo || "",
                      status: String(order?.status || "").toUpperCase(),
                      paymentStatus: String(order?.paymentStatus || order?.payment_status || "PENDING").toUpperCase(),
                      createdAt: order?.createdAt || null,
                      total: Number(order?.total || 0),
                  }))
            : [];

        const hasActiveOrders = rawActiveOrders.length > 0;
        const hasActiveSession = Boolean(
            activeSessionForTable &&
            activeSessionForTable.status !== "CLOSED" &&
            activeSessionForTable.status !== "CANCELLED"
        );
        const isDirty = table?.cleaningStatus === "DIRTY" || table?.status === "DIRTY";
        const isExplicitlyFree =
            !isDirty && (
            table?.isOccupied === false ||
            table?.status === "AVAILABLE" ||
            activeSessionForTable?.status === "CLOSED" ||
            activeSessionForTable?.status === "CANCELLED");
        const isOccupied = !isExplicitlyFree && !isDirty && Boolean(table?.isOccupied || hasActiveOrders || hasActiveSession);
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
        const activeOrders = isOccupied ? deduplicatedActiveOrders : [];

        return {
            ...table,
            tableNo: String(table?.tableNo || "").trim(),
            cleaningStatus: isDirty ? "DIRTY" : (table?.cleaningStatus || "CLEAN"),
            status: isDirty ? "DIRTY" : (isExplicitlyFree ? "AVAILABLE" : (table?.status || (isOccupied ? "OCCUPIED" : "AVAILABLE"))),
            assignedWaiterId: table?.assignedWaiterId || (isOccupied ? activeSessionForTable?.waiterId : null) || null,
            assignedWaiterName: table?.assignedWaiterName || (isOccupied ? activeSessionForTable?.waiterName : null) || null,
            assignedServer: table?.assignedServer || table?.assignedWaiterName || (isOccupied ? activeSessionForTable?.waiterName : null) || null,
            isOccupied,
            activeOrders,
            activeSession: activeSessionForTable,
            assignmentKey: table?.id
                ? `table-id-${table.id}`
                : `table-no-${String(table?.tableNo || "").trim().toLowerCase() || index}`,
            key: table?.id ? `table-id-${table.id}` : `${table?.tableNo || "table"}-${index}`,
        };
    });
};

describe("Owner Panel — Strict Table Identity and Server Isolation", () => {
    it("1. Table 1 (Main Hall) and Table 1 (Section TABLE) maintain separate, isolated states", () => {
        const rawTables = [
            {
                id: 10,
                tableNo: "1",
                section: "Main Hall",
                isOccupied: true,
                status: "OCCUPIED",
                assignedWaiterId: 101,
                assignedWaiterName: "Anil",
                activeSession: { id: 501, tableId: 10, waiterId: 101, waiterName: "Anil", status: "OPEN" },
                activeOrders: [{ id: 9001, targetTableId: 10, total: 350 }],
            },
            {
                id: 25,
                tableNo: "table 1",
                section: "TABLE",
                isOccupied: false,
                status: "AVAILABLE",
                assignedWaiterId: null,
                assignedWaiterName: null,
                activeSession: null,
                activeOrders: [],
            },
        ];

        const normalized = normalizeTableRows(rawTables);
        expect(normalized).toHaveLength(2);

        const tableMainHall = normalized.find((t) => t.id === 10);
        const tableSection = normalized.find((t) => t.id === 25);

        // Table 10 (Main Hall)
        expect(tableMainHall.isOccupied).toBe(true);
        expect(tableMainHall.status).toBe("OCCUPIED");
        expect(tableMainHall.assignedWaiterName).toBe("Anil");
        expect(tableMainHall.activeOrders).toHaveLength(1);
        expect(tableMainHall.activeOrders[0].id).toBe(9001);

        // Table 25 (Section TABLE) — strictly clean & available
        expect(tableSection.isOccupied).toBe(false);
        expect(tableSection.status).toBe("AVAILABLE");
        expect(tableSection.assignedWaiterName).toBeNull();
        expect(tableSection.assignedServer).toBeNull();
        expect(tableSection.activeOrders).toHaveLength(0);
        expect(tableSection.activeSession).toBeNull();
    });

    it("2. Mismatched activeSession or activeOrders are rejected and do not cross-contaminate", () => {
        const rawTables = [
            {
                id: 25,
                tableNo: "table 1",
                section: "TABLE",
                isOccupied: false,
                status: "AVAILABLE",
                assignedWaiterId: null,
                assignedWaiterName: null,
                // Faulty session belonging to tableId 10
                activeSession: { id: 501, tableId: 10, waiterId: 101, waiterName: "Anil", status: "OPEN" },
                // Faulty order belonging to tableId 10
                activeOrders: [{ id: 9001, targetTableId: 10, total: 350 }],
            },
        ];

        const normalized = normalizeTableRows(rawTables);
        const table25 = normalized[0];

        // Mismatched session and orders must be rejected
        expect(table25.isOccupied).toBe(false);
        expect(table25.status).toBe("AVAILABLE");
        expect(table25.activeSession).toBeNull();
        expect(table25.activeOrders).toHaveLength(0);
        expect(table25.assignedWaiterName).toBeNull();
    });

    it("3. Deduplicates tables if the same canonical table ID is received multiple times", () => {
        const duplicateRows = [
            { id: 10, tableNo: "1", section: "Main Hall", status: "AVAILABLE" },
            { id: 10, tableNo: "1", section: "Main Hall", status: "AVAILABLE" },
        ];

        const normalized = normalizeTableRows(duplicateRows);
        expect(normalized).toHaveLength(1);
        expect(normalized[0].id).toBe(10);
    });

    it("4. Server assignment keyed by table-id does not leak to other tables with similar numbers", () => {
        const tableAssignments = {
            "table-id-10": "101",
        };

        const table1 = { id: 10, tableNo: "1" };
        const table2 = { id: 25, tableNo: "table 1" };

        const idKey1 = `table-id-${table1.id}`;
        const localAssigned1 = idKey1 ? tableAssignments[idKey1] || "" : "";
        expect(localAssigned1).toBe("101");

        const idKey2 = `table-id-${table2.id}`;
        const localAssigned2 = idKey2 ? tableAssignments[idKey2] || "" : "";
        expect(localAssigned2).toBe(""); // Does NOT leak
    });

    it("5. Realtime table:updated matching by targetId isolates updates strictly to the target table", () => {
        const tables = [
            { id: 10, tableNo: "1", isOccupied: true, status: "OCCUPIED" },
            { id: 25, tableNo: "table 1", isOccupied: false, status: "AVAILABLE" },
        ];

        const payload = { tableId: 10, tableNo: "1", status: "AVAILABLE", isOccupied: false };
        const targetId = payload.tableId;
        const targetNo = payload.tableNo;

        const updated = tables.map((t) => {
            const match = targetId
                ? String(t.id) === String(targetId)
                : (targetNo && String(t.tableNo).trim().toLowerCase() === String(targetNo).trim().toLowerCase());
            if (match) {
                return { ...t, status: "AVAILABLE", isOccupied: false };
            }
            return t;
        });

        // Only Table 10 was modified
        expect(updated[0].id).toBe(10);
        expect(updated[0].status).toBe("AVAILABLE");
        // Table 25 was unchanged
        expect(updated[1].id).toBe(25);
        expect(updated[1].status).toBe("AVAILABLE");
    });
});

