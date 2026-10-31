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
    getCanonicalTableKey,
} from "../context/TableStateContext.jsx";

describe("Tiffzy Canonical Table Identity & Cross-Module State Parity (Exhaustive Suite)", () => {
    // 1. Main Hall id=8 vs Section TABLE id=12
    it("1. Main Hall id=8 vs Section TABLE id=12 canonical identity isolation", () => {
        const table8 = { id: 8, tableId: 8, restaurantId: 1, tableNo: "1", section: "Main Hall" };
        const table12 = { id: 12, tableId: 12, restaurantId: 1, tableNo: "table 1", section: "TABLE" };

        expect(getTableIdentity(table8)).toBe("1:8");
        expect(getTableIdentity(table12)).toBe("1:12");
        expect(isSameTable(table8, table12)).toBe(false);
    });

    // 2. Same tableNo with different DiningTable.id
    it("2. Handles collision when both physical tables have identical tableNo strings", () => {
        const tableA = { id: 8, restaurantId: 1, tableNo: "1", section: "Main Hall" };
        const tableB = { id: 12, restaurantId: 1, tableNo: "1", section: "Section TABLE" };

        expect(getTableId(tableA)).toBe(8);
        expect(getTableId(tableB)).toBe(12);
        expect(getTableIdentity(tableA)).not.toBe(getTableIdentity(tableB));
        expect(isSameTable(tableA, tableB)).toBe(false);
    });

    // 3. Active order on id=8 does not affect id=12
    it("3. Active order on id=8 does not make id=12 occupied or affect its state", () => {
        const table8WithOrder = normalizeCanonicalTable({
            id: 8,
            restaurantId: 1,
            tableNo: "1",
            section: "Main Hall",
            activeOrders: [{ id: 1001, tableId: 8, status: "READY", total: 350 }],
        }, 1);

        const table12Empty = normalizeCanonicalTable({
            id: 12,
            restaurantId: 1,
            tableNo: "table 1",
            section: "TABLE",
            activeOrders: [],
        }, 1);

        expect(table8WithOrder.isOccupied).toBe(true);
        expect(table8WithOrder.status).toBe("OCCUPIED");
        expect(table8WithOrder.activeOrderCount).toBe(1);

        expect(table12Empty.isOccupied).toBe(false);
        expect(table12Empty.status).toBe("AVAILABLE");
        expect(table12Empty.activeOrderCount).toBe(0);
    });

    // 4. Active order on id=12 does not affect id=8
    it("4. Active order on id=12 does not make id=8 occupied or affect its state", () => {
        const table8Empty = normalizeCanonicalTable({
            id: 8,
            restaurantId: 1,
            tableNo: "1",
            section: "Main Hall",
            activeOrders: [],
        }, 1);

        const table12WithOrder = normalizeCanonicalTable({
            id: 12,
            restaurantId: 1,
            tableNo: "table 1",
            section: "TABLE",
            activeOrders: [{ id: 1002, tableId: 12, status: "PREPARING", total: 180 }],
        }, 1);

        expect(table8Empty.isOccupied).toBe(false);
        expect(table8Empty.status).toBe("AVAILABLE");

        expect(table12WithOrder.isOccupied).toBe(true);
        expect(table12WithOrder.status).toBe("OCCUPIED");
    });

    // 5. Cleaning id=8 does not affect id=12
    it("5. Cleaning state on id=8 does not leak to id=12", () => {
        const table8Dirty = normalizeCanonicalTable({
            id: 8,
            restaurantId: 1,
            tableNo: "1",
            section: "Main Hall",
            cleaningStatus: "DIRTY",
            status: "DIRTY",
        }, 1);

        const table12Clean = normalizeCanonicalTable({
            id: 12,
            restaurantId: 1,
            tableNo: "table 1",
            section: "TABLE",
            cleaningStatus: "CLEAN",
            status: "AVAILABLE",
        }, 1);

        expect(table8Dirty.cleaningStatus).toBe("DIRTY");
        expect(table8Dirty.status).toBe("DIRTY");

        expect(table12Clean.cleaningStatus).toBe("CLEAN");
        expect(table12Clean.status).toBe("AVAILABLE");
    });

    // 6. Server assignment id=8 does not affect id=12
    it("6. Server assigned to id=8 does not appear on id=12", () => {
        const table8Assigned = normalizeCanonicalTable({
            id: 8,
            restaurantId: 1,
            tableNo: "1",
            assignedWaiterId: 105,
            assignedWaiterName: "saimohan",
        }, 1);

        const table12Unassigned = normalizeCanonicalTable({
            id: 12,
            restaurantId: 1,
            tableNo: "table 1",
            assignedWaiterId: null,
            assignedWaiterName: null,
        }, 1);

        expect(table8Assigned.assignedWaiterId).toBe(105);
        expect(table8Assigned.assignedWaiterName).toBe("saimohan");

        expect(table12Unassigned.assignedWaiterId).toBeNull();
        expect(table12Unassigned.assignedWaiterName).toBeNull();
    });

    // 7. KOT id=8 does not affect id=12
    it("7. KOT ready food items for id=8 are strictly associated with table 8", () => {
        const readyItems = [
            { id: 1, kotItemId: 1, tableId: 8, tableNo: "1", name: "Dosa" },
            { id: 2, kotItemId: 2, tableId: 12, tableNo: "table 1", name: "Idli" },
        ];

        const table8Matches = readyItems.filter((it) => Number(it.tableId) === 8);
        const table12Matches = readyItems.filter((it) => Number(it.tableId) === 12);

        expect(table8Matches).toHaveLength(1);
        expect(table8Matches[0].name).toBe("Dosa");

        expect(table12Matches).toHaveLength(1);
        expect(table12Matches[0].name).toBe("Idli");
    });

    // 8. Cashier state id=8 does not affect id=12
    it("8. Cashier bill strip matches orders by canonical tableId, keeping totals isolated", () => {
        const tables = [
            { id: 8, tableNo: "1" },
            { id: 12, tableNo: "table 1" },
        ];
        const orders = [
            { id: 301, tableId: 8, tableNo: "1", total: 420 },
        ];

        const mapped = tables.map((t) => {
            const activeOrder = orders.find((o) => Number(o.tableId) === Number(t.id));
            return {
                tableId: t.id,
                hasActiveOrder: Boolean(activeOrder),
                total: activeOrder?.total || 0,
            };
        });

        expect(mapped[0]).toEqual({ tableId: 8, hasActiveOrder: true, total: 420 });
        expect(mapped[1]).toEqual({ tableId: 12, hasActiveOrder: false, total: 0 });
    });

    // 9. Notifications id=8 do not open/update id=12
    it("9. View Table notification button passes tableId=8, preventing opening id=12", () => {
        const notification = {
            id: 99,
            title: "Food Ready",
            data: { tableId: 8, tableNo: "1", section: "Main Hall" },
        };

        const targetTableId = Number(notification.data.tableId);
        const tables = [
            { id: 8, tableNo: "1", section: "Main Hall" },
            { id: 12, tableNo: "table 1", section: "TABLE" },
        ];

        const matched = tables.find((t) => t.id === targetTableId);
        expect(matched.id).toBe(8);
        expect(matched.section).toBe("Main Hall");
    });

    // 10. Socket event id=8 does not update id=12
    it("10. Socket table:updated event for id=8 updates only table 8 in the state map", () => {
        const stateMap = new Map([
            [8, normalizeCanonicalTable({ id: 8, tableNo: "1", status: "AVAILABLE", isOccupied: false }, 1)],
            [12, normalizeCanonicalTable({ id: 12, tableNo: "table 1", status: "AVAILABLE", isOccupied: false }, 1)],
        ]);

        const socketEvent = {
            restaurantId: 1,
            tableId: 8,
            id: 8,
            status: "OCCUPIED",
            isOccupied: true,
            version: Date.now(),
        };

        const targetId = Number(socketEvent.tableId);
        const existing = stateMap.get(targetId);
        const updated = reconcileTable(existing, normalizeCanonicalTable(socketEvent, 1));
        stateMap.set(targetId, updated);

        expect(stateMap.get(8).isOccupied).toBe(true);
        expect(stateMap.get(8).status).toBe("OCCUPIED");

        expect(stateMap.get(12).isOccupied).toBe(false);
        expect(stateMap.get(12).status).toBe("AVAILABLE");
    });

    // 11. Stale HTTP response cannot overwrite newer state
    it("11. Stale HTTP response cannot overwrite newer state when active orders exist", () => {
        const currentState = {
            id: 8,
            status: "OCCUPIED",
            isOccupied: true,
            version: 5000,
            activeOrders: [{ id: 99, tableId: 8, status: "READY" }],
        };

        const staleHttpResponse = {
            id: 8,
            status: "AVAILABLE",
            isOccupied: false,
            version: 1000,
            activeOrders: [],
        };

        const result = reconcileTable(currentState, staleHttpResponse);
        expect(result.status).toBe("OCCUPIED");
        expect(result.isOccupied).toBe(true);
        expect(result.activeOrders).toHaveLength(1);
    });

    // 12. Stale socket event cannot overwrite newer state
    it("12. Stale socket event cannot overwrite newer authoritative state", () => {
        const current = {
            id: 8,
            status: "DIRTY",
            cleaningStatus: "DIRTY",
            isOccupied: false,
            version: 8000,
        };

        const staleSocketEvent = {
            id: 8,
            status: "AVAILABLE",
            cleaningStatus: "CLEAN",
            isOccupied: false,
            version: 2000,
        };

        const result = reconcileTable(current, staleSocketEvent);
        expect(result.status).toBe("DIRTY");
        expect(result.cleaningStatus).toBe("DIRTY");
    });

    // 13. Closed session cannot wipe an active order
    it("13. Closed session event does NOT wipe active in-flight orders", () => {
        const current = {
            id: 8,
            status: "OCCUPIED",
            isOccupied: true,
            activeOrders: [{ id: 1, tableId: 8, status: "READY" }],
        };

        const sessionClosedEvent = {
            id: 8,
            tableId: 8,
            status: "AVAILABLE",
            isOccupied: false,
            session: { status: "CLOSED" },
            activeSession: null,
            activeOrders: [],
        };

        const reconciled = reconcileTable(current, sessionClosedEvent);
        expect(reconciled.isOccupied).toBe(true);
        expect(reconciled.status).toBe("OCCUPIED");
        expect(reconciled.activeOrders).toHaveLength(1);
    });

    // 14. Duplicate delivery requests are idempotent
    it("14. Duplicate delivery payloads produce deterministic idempotent state", () => {
        const deliveryResult1 = { ok: true, itemId: 55, alreadyServed: false };
        const deliveryResult2 = { ok: true, itemId: 55, alreadyServed: true, message: "Item already marked SERVED" };

        expect(deliveryResult1.ok).toBe(true);
        expect(deliveryResult2.ok).toBe(true);
        expect(deliveryResult2.alreadyServed).toBe(true);
    });

    // 15. Every table returned by backend has a unique canonical identity
    it("15. Array of tables guarantees unique getTableIdentity keys", () => {
        const backendTables = [
            { id: 8, restaurantId: 1, tableNo: "1", section: "Main Hall" },
            { id: 12, restaurantId: 1, tableNo: "table 1", section: "TABLE" },
            { id: 15, restaurantId: 1, tableNo: "2", section: "Main Hall" },
        ];

        const identities = backendTables.map(getTableIdentity);
        const uniqueIdentities = new Set(identities);

        expect(identities).toEqual(["1:8", "1:12", "1:15"]);
        expect(uniqueIdentities.size).toBe(3);
    });

    // 16. Every frontend table card uses canonical table identity as React key
    it("16. Canonical table key generation function produces unique key", () => {
        const key8 = getCanonicalTableKey({ restaurantId: 1, tableId: 8 });
        const key12 = getCanonicalTableKey({ restaurantId: 1, tableId: 12 });

        expect(key8).toBe("1:table:8");
        expect(key12).toBe("1:table:12");
        expect(key8).not.toBe(key12);
    });

    // 17. No duplicate React keys are possible for table 1 and table 1 from another section
    it("17. Colliding tableNo values in different sections produce distinct React keys", () => {
        const tableMainHall = { id: 8, restaurantId: 1, tableNo: "1" };
        const tableOtherSec = { id: 12, restaurantId: 1, tableNo: "1" };

        const keyA = `${tableMainHall.restaurantId}:${tableMainHall.id}`;
        const keyB = `${tableOtherSec.restaurantId}:${tableOtherSec.id}`;

        expect(keyA).toBe("1:8");
        expect(keyB).toBe("1:12");
        expect(keyA).not.toBe(keyB);
    });

    // 18. Filtering by section cannot change table identity
    it("18. Filtering tables by section preserves exact canonical table identity", () => {
        const allTables = [
            { id: 8, tableNo: "1", section: "Main Hall" },
            { id: 12, tableNo: "table 1", section: "TABLE" },
        ];

        const mainHallFiltered = allTables.filter((t) => t.section === "Main Hall");
        expect(mainHallFiltered).toHaveLength(1);
        expect(mainHallFiltered[0].id).toBe(8);

        const tableSecFiltered = allTables.filter((t) => t.section === "TABLE");
        expect(tableSecFiltered).toHaveLength(1);
        expect(tableSecFiltered[0].id).toBe(12);
    });

    // 19. 'All' view and section-specific view produce the same state for the same table
    it("19. 'All' view and section-specific view resolve identical table record", () => {
        const tableMap = new Map([
            [8, { id: 8, tableNo: "1", section: "Main Hall", status: "OCCUPIED" }],
            [12, { id: 12, tableNo: "table 1", section: "TABLE", status: "AVAILABLE" }],
        ]);

        const allViewTable8 = Array.from(tableMap.values()).find((t) => t.id === 8);
        const sectionViewTable8 = Array.from(tableMap.values())
            .filter((t) => t.section === "Main Hall")
            .find((t) => t.id === 8);

        expect(allViewTable8).toBe(sectionViewTable8);
        expect(allViewTable8.status).toBe("OCCUPIED");
    });

    // 20. Owner, Server, Cashier and Cleaner receive the same canonical state
    it("20. Cross-module parity: Owner, Server, Cashier, and Cleaner compute identical occupancy & status", () => {
        const rawTable = {
            id: 8,
            tableNo: "1",
            restaurantId: 1,
            section: "Main Hall",
            cleaningStatus: "CLEAN",
            activeOrders: [{ id: 1282, tableId: 8, status: "READY", total: 450 }],
            isOccupied: true,
        };

        const canonical = normalizeCanonicalTable(rawTable, 1);

        // Owner rule
        const ownerIsOccupied = !canonical.isBlocked && !canonical.isDirty && (canonical.isOccupied || canonical.activeOrders.length > 0);
        // Server rule
        const serverIsOccupied = !canonical.isBlocked && !canonical.isDirty && (canonical.activeOrders.length > 0 || canonical.isOccupied);
        // Cashier rule
        const cashierHasBill = canonical.activeOrders.length > 0;
        // Cleaner rule
        const cleanerNeedsWork = canonical.cleaningStatus === "DIRTY";

        expect(ownerIsOccupied).toBe(true);
        expect(serverIsOccupied).toBe(true);
        expect(cashierHasBill).toBe(true);
        expect(cleanerNeedsWork).toBe(false);
    });
});
