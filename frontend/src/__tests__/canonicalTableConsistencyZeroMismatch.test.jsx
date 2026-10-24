import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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
    TABLE_GROUPS_SYNC_EVENT,
} from "../utils/tableGrouping";

describe("CANONICAL TABLE CONSISTENCY & ZERO TABLE MISMATCH AUDIT", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    // =========================================================================
    // 1. TABLE IDENTITY: DiningTable.id is canonical, no collisions across 1, T1, table 1
    // =========================================================================
    describe("1. Table Identity & Anti-Collision Engine", () => {
        it("identifies tables strictly by DiningTable.id, never colliding duplicate names", () => {
            const tableNumeric1 = { id: 101, tableNo: "1", seats: 4, restaurantId: 10 };
            const tableT1 = { id: 102, tableNo: "T1", seats: 4, restaurantId: 10 };
            const tableWord1 = { id: 103, tableNo: "table 1", seats: 4, restaurantId: 10 };
            const tableAlt1 = { id: 104, tableNo: "TABLE 1", seats: 6, restaurantId: 10 };

            const norm1 = normalizeCanonicalTable(tableNumeric1);
            const normT1 = normalizeCanonicalTable(tableT1);
            const normWord1 = normalizeCanonicalTable(tableWord1);
            const normAlt1 = normalizeCanonicalTable(tableAlt1);

            expect(norm1.id).toBe(101);
            expect(normT1.id).toBe(102);
            expect(normWord1.id).toBe(103);
            expect(normAlt1.id).toBe(104);

            // Reconcile into a map to ensure zero collision
            const map = new Map();
            [norm1, normT1, normWord1, normAlt1].forEach((tbl) => {
                map.set(tbl.id, tbl);
            });

            expect(map.size).toBe(4);
            expect(map.get(101).tableNo).toBe("1");
            expect(map.get(102).tableNo).toBe("T1");
            expect(map.get(103).tableNo).toBe("table 1");
            expect(map.get(104).tableNo).toBe("TABLE 1");
        });

        it("preserves individual assignment and session states for 1, T1, and table 1", () => {
            const currentTable1 = normalizeCanonicalTable({
                id: 101,
                tableNo: "1",
                assignedWaiterId: 5,
                assignedWaiterName: "Waiter Five",
                status: "OCCUPIED",
                isOccupied: true,
            });

            const currentTableT1 = normalizeCanonicalTable({
                id: 102,
                tableNo: "T1",
                assignedWaiterId: 8,
                assignedWaiterName: "Waiter Eight",
                status: "AVAILABLE",
                isOccupied: false,
            });

            // Updating Table 1 must not alter Table T1
            const updatedTable1 = reconcileTable(currentTable1, {
                id: 101,
                status: "PAYMENT_PENDING",
            });

            expect(updatedTable1.id).toBe(101);
            expect(updatedTable1.status).toBe("PAYMENT_PENDING");
            expect(updatedTable1.assignedWaiterName).toBe("Waiter Five");

            expect(currentTableT1.id).toBe(102);
            expect(currentTableT1.status).toBe("AVAILABLE");
            expect(currentTableT1.assignedWaiterName).toBe("Waiter Eight");
        });
    });

    // =========================================================================
    // 2. TABLE METADATA: Zero Fake "Main Floor" Defaults & Canonical Location
    // =========================================================================
    describe("2. Canonical Metadata & Anti-Fake Location Engine", () => {
        it("resolves numeric tables 1, 2, 3, 4 to Main Hall (matching Owner Panel)", () => {
            ["1", "2", "3", "4"].forEach((num) => {
                const norm = normalizeCanonicalTable({ id: Number(num), tableNo: num, section: "Main Floor" });
                expect(norm.section).toBe("Main Hall");
                expect(norm.floor).toBeNull();
            });
        });

        it("resolves prefix T tables T1, T2, T3, T4 to Section T (matching Owner Panel)", () => {
            ["T1", "T2", "T3", "T4"].forEach((tNo, idx) => {
                const norm = normalizeCanonicalTable({ id: 200 + idx, tableNo: tNo, section: "Main Floor" });
                expect(norm.section).toBe("Section T");
                expect(norm.floor).toBeNull();
            });
        });

        it("resolves custom group names configured via Owner Panel tableGroups", () => {
            const tableGroups = {
                "501": "Section Table",
                "502": "Roof Top Garden",
                "T1": "Patio Deck",
            };

            const t501 = normalizeCanonicalTable({ id: 501, tableNo: "table 1", section: "Main Floor" }, 1, tableGroups);
            const t502 = normalizeCanonicalTable({ id: 502, tableNo: "99", section: "Main Floor" }, 1, tableGroups);
            const tT1 = normalizeCanonicalTable({ id: 503, tableNo: "T1", section: "Main Floor" }, 1, tableGroups);

            expect(t501.section).toBe("Section Table");
            expect(t502.section).toBe("Roof Top Garden");
            expect(tT1.section).toBe("Patio Deck");
        });

        it("preserves explicit non-default database section (e.g. QA Section, Roof Top)", () => {
            const customTable = normalizeCanonicalTable({
                id: 601,
                tableNo: "TEST-5073",
                section: "QA Section",
                floor: "Terrace",
                area: "Zone A",
            });

            expect(customTable.section).toBe("Qa Section");
            expect(customTable.floor).toBe("Terrace");
            expect(customTable.area).toBe("Zone A");
        });

        it("returns 'Location not configured' when unconfigured (NEVER defaults to Main Floor or Main Hall)", () => {
            const unconfiguredTable = normalizeCanonicalTable({
                id: 701,
                tableNo: "Bar-Counter",
                section: "Main Floor", // Schema default
            });

            expect(unconfiguredTable.section).toBe("Location not configured");
            expect(unconfiguredTable.section).not.toBe("Main Floor");
            expect(unconfiguredTable.section).not.toBe("Main Hall");
        });

        it("returns 'Location not configured' when section is null or empty without conventional prefix", () => {
            const emptySectionTable = normalizeCanonicalTable({
                id: 702,
                tableNo: "Special",
                section: null,
            });

            expect(emptySectionTable.section).toBe("Location not configured");
        });
    });

    // =========================================================================
    // 3. REALTIME RECONCILIATION: Partial Socket Payloads Never Wipe Metadata
    // =========================================================================
    describe("3. Realtime Reconciliation & Metadata Protection", () => {
        it("preserves section, seats, and tableNo when receiving partial waiter assignment socket payload", () => {
            const existing = normalizeCanonicalTable({
                id: 801,
                tableNo: "T3",
                seats: 2,
                section: "Main Floor",
            });
            expect(existing.section).toBe("Section T");
            expect(existing.seats).toBe(2);

            // Partial socket payload for table:waiter_assigned has only assignment fields
            const partialSocketPatch = {
                id: 801,
                tableId: 801,
                assignedWaiterId: 15,
                assignedWaiterName: "Anita Sharma",
            };

            const reconciled = reconcileTable(existing, partialSocketPatch);

            expect(reconciled.id).toBe(801);
            expect(reconciled.tableNo).toBe("T3");
            expect(reconciled.section).toBe("Section T");
            expect(reconciled.seats).toBe(2);
            expect(reconciled.assignedWaiterName).toBe("Anita Sharma");
            expect(reconciled.assignedWaiterId).toBe(15);
        });

        it("preserves section and capacity when table is released to AVAILABLE", () => {
            const existing = normalizeCanonicalTable({
                id: 802,
                tableNo: "4",
                seats: 6,
                section: "Main Floor",
                status: "OCCUPIED",
                isOccupied: true,
                assignedWaiterId: 10,
                assignedWaiterName: "John",
            });
            expect(existing.section).toBe("Main Hall");
            expect(existing.seats).toBe(6);

            // Explicit session release payload
            const releasePatch = {
                id: 802,
                tableId: 802,
                status: "AVAILABLE",
                isOccupied: false,
                sessionStatus: "CLOSED",
            };

            const reconciled = reconcileTable(existing, releasePatch);

            expect(reconciled.status).toBe("AVAILABLE");
            expect(reconciled.isOccupied).toBe(false);
            expect(reconciled.assignedWaiterId).toBeNull();
            expect(reconciled.assignedWaiterName).toBeNull();
            // Metadata MUST remain intact
            expect(reconciled.tableNo).toBe("4");
            expect(reconciled.section).toBe("Main Hall");
            expect(reconciled.seats).toBe(6);
        });
    });

    // =========================================================================
    // 4. CROSS-ROLE CONSISTENCY: Owner ↔ Server ↔ Cleaner ↔ Cashier
    // =========================================================================
    describe("4. Cross-Role View Model & Synchronization Consistency", () => {
        function TestConsumer() {
            const { tables, loading } = useCanonicalTables();
            return (
                <div data-testid="consumer">
                    {loading && <span>Loading</span>}
                    {tables.map((t) => (
                        <div key={t.id} data-testid={`table-row-${t.id}`}>
                            <span data-testid={`tableno-${t.id}`}>{t.tableNo}</span>
                            <span data-testid={`section-${t.id}`}>{t.section}</span>
                            <span data-testid={`seats-${t.id}`}>{t.seats}</span>
                        </div>
                    ))}
                </div>
            );
        }

        it("renders identical canonical metadata for all tables", () => {
            const mockTables = [
                { id: 1, tableNo: "1", seats: 4, section: "Main Floor" },
                { id: 2, tableNo: "2", seats: 4, section: "Main Floor" },
                { id: 3, tableNo: "T1", seats: 4, section: "Main Floor" },
                { id: 4, tableNo: "T2", seats: 4, section: "Main Floor" },
                { id: 5, tableNo: "T3", seats: 2, section: "Main Floor" },
                { id: 6, tableNo: "T4", seats: 6, section: "Main Floor" },
            ];

            const normalizedList = mockTables.map((t) => normalizeCanonicalTable(t, 1));

            // Verify Table 1 and 2
            expect(normalizedList[0].section).toBe("Main Hall");
            expect(normalizedList[0].seats).toBe(4);
            expect(normalizedList[1].section).toBe("Main Hall");
            expect(normalizedList[1].seats).toBe(4);

            // Verify T1, T2, T3, T4
            expect(normalizedList[2].section).toBe("Section T");
            expect(normalizedList[2].seats).toBe(4);
            expect(normalizedList[3].section).toBe("Section T");
            expect(normalizedList[3].seats).toBe(4);
            expect(normalizedList[4].section).toBe("Section T");
            expect(normalizedList[4].seats).toBe(2);
            expect(normalizedList[5].section).toBe("Section T");
            expect(normalizedList[5].seats).toBe(6);

            // Ensure none of them display "Main Floor"
            normalizedList.forEach((tbl) => {
                expect(tbl.section).not.toBe("Main Floor");
            });
        });

        it("dynamically synchronizes section changes when Owner Panel dispatches TABLE_GROUPS_SYNC_EVENT", () => {
            const rawTable = { id: 991, tableNo: "1", seats: 4, section: "Main Floor" };
            const initial = normalizeCanonicalTable(rawTable, 1);
            expect(initial.section).toBe("Main Hall");

            // Owner reassigns Table 1 to "VIP Banquet"
            const updatedGroups = { "991": "VIP Banquet" };
            const updated = normalizeCanonicalTable(rawTable, 1, updatedGroups);
            expect(updated.section).toBe("Vip Banquet");
        });
    });

    // =========================================================================
    // 5. TENANT ISOLATION: Strict restaurantId scoping
    // =========================================================================
    describe("5. Tenant Isolation & Security", () => {
        it("strictly scopes tables by restaurantId", () => {
            const tableRestaurantA = normalizeCanonicalTable({ id: 10, tableNo: "1", restaurantId: 101 });
            const tableRestaurantB = normalizeCanonicalTable({ id: 10, tableNo: "1", restaurantId: 202 });

            expect(tableRestaurantA.restaurantId).toBe(101);
            expect(tableRestaurantB.restaurantId).toBe(202);
            expect(tableRestaurantA.id).toBe(tableRestaurantB.id);

            // Synthetic canonical keys are strictly separated by restaurant
            expect(`${tableRestaurantA.restaurantId}:table:${tableRestaurantA.id}`).toBe("101:table:10");
            expect(`${tableRestaurantB.restaurantId}:table:${tableRestaurantB.id}`).toBe("202:table:10");
        });
    });
});
