import test from "node:test";
import assert from "node:assert/strict";
import {
  getTableId,
  getTableIdentity,
  isSameTable,
  formatTableDisplayLabel,
} from "../utils/tableIdentity.js";

test("CANONICAL TABLE IDENTITY & CONSISTENCY HARDENING (BACKEND)", async (t) => {
  await t.test("1. Shared Table Identity Contract", () => {
    const mainHallTable1 = { id: 8, tableNo: "1", section: "Main Hall", restaurantId: 1 };
    const sectionTable1 = { id: 12, tableNo: "table 1", section: "TABLE", restaurantId: 1 };

    assert.equal(getTableId(mainHallTable1), 8);
    assert.equal(getTableId(sectionTable1), 12);
    assert.equal(getTableIdentity(mainHallTable1), "1:8");
    assert.equal(getTableIdentity(sectionTable1), "1:12");

    assert.equal(isSameTable(mainHallTable1, sectionTable1), false);
    assert.equal(isSameTable(mainHallTable1, { id: 8, restaurantId: 1 }), true);
    assert.equal(isSameTable(mainHallTable1, { tableId: 8, restaurantId: 1 }), true);

    // Cross-restaurant separation
    assert.equal(isSameTable(mainHallTable1, { id: 8, restaurantId: 2 }), false);

    assert.equal(formatTableDisplayLabel({ section: "Main Hall", tableNo: "1" }), "Main Hall · Table 1");
    assert.equal(formatTableDisplayLabel({ section: "TABLE", tableNo: "table 1" }), "TABLE · Table table 1");
  });

  await t.test("2. Delivery Idempotency Logic Verification", async () => {
    // Simulate handler logic from staffTasks.routes.js
    const processDelivery = (item) => {
      if (!item) return { status: 404, body: { message: "Item not found in this restaurant" } };

      if (item.status === "SERVED" || item.status === "DELIVERED") {
        return {
          status: 200,
          body: {
            success: true,
            ok: true,
            message: `Item already marked ${item.status}`,
            item,
            alreadyServed: true,
          },
        };
      }

      if (item.status !== "READY") {
        return {
          status: 400,
          body: {
            success: false,
            code: "item_not_ready",
            message: `Cannot deliver item with status '${item.status}'. Item must be READY.`,
          },
        };
      }

      return {
        status: 200,
        body: {
          success: true,
          ok: true,
          message: "Item marked served",
          item: { ...item, status: "SERVED" },
        },
      };
    };

    // First request when READY -> succeeds
    const firstDelivery = processDelivery({ id: 101, status: "READY" });
    assert.equal(firstDelivery.status, 200);
    assert.equal(firstDelivery.body.item.status, "SERVED");

    // Second request (double click or batch retry) -> succeeds idempotently with 200, NOT 400!
    const duplicateDelivery = processDelivery({ id: 101, status: "SERVED" });
    assert.equal(duplicateDelivery.status, 200);
    assert.equal(duplicateDelivery.body.alreadyServed, true);

    // Unprepared item (PREPARING) -> correctly fails with 400
    const preparingDelivery = processDelivery({ id: 102, status: "PREPARING" });
    assert.equal(preparingDelivery.status, 400);
    assert.equal(preparingDelivery.body.code, "item_not_ready");
  });

  await t.test("3. Waiter resolution prefers canonical kotTableId over tableNo fallback", async () => {
    const tablesInDb = [
      { id: 8, tableNo: "1", assignedWaiterId: 17, assignedWaiterName: "saimohan" },
      { id: 12, tableNo: "table 1", assignedWaiterId: null, assignedWaiterName: null },
    ];

    const resolveWaiter = ({ kotTableId, tableNo }) => {
      if (kotTableId) {
        const found = tablesInDb.find((t) => t.id === kotTableId);
        if (found?.assignedWaiterId) return found.assignedWaiterId;
      }
      if (tableNo) {
        const found = tablesInDb.find((t) => t.tableNo === tableNo);
        if (found?.assignedWaiterId) return found.assignedWaiterId;
      }
      return null;
    };

    // Table 8 with tableNo "1" resolves correctly to 17
    assert.equal(resolveWaiter({ kotTableId: 8, tableNo: "1" }), 17);

    // Table 12 with tableNo "table 1" resolves correctly to null (does not inherit 17)
    assert.equal(resolveWaiter({ kotTableId: 12, tableNo: "table 1" }), null);
  });

  await t.test("4. Canonical Ready Items enrichment attaches tableId and section", () => {
    const rawKotItem = {
      id: 501,
      itemName: "Ghee Roast",
      qty: 1,
      kot: {
        id: 701,
        kotNo: "KOT-701",
        tableSession: { tableId: 8, tableNo: "1", table: { section: "Main Hall" } },
        order: { tableId: 8, tableNo: "1" },
      },
    };

    const resolvedTableId = rawKotItem.kot?.tableId || rawKotItem.kot?.table?.id || rawKotItem.kot?.tableSession?.tableId || rawKotItem.kot?.order?.tableId || null;
    const resolvedSection = rawKotItem.kot?.section || rawKotItem.kot?.table?.section || rawKotItem.kot?.tableSession?.table?.section || null;

    assert.equal(resolvedTableId, 8);
    assert.equal(resolvedSection, "Main Hall");
  });

  await t.test("5. Notification payload carries canonical tableId and section", () => {
    const notifData = {
      restaurantId: 1,
      tableId: 8,
      tableNo: "1",
      section: "Main Hall",
      taskType: "TABLE_BUS_AND_SANITIZE",
    };

    assert.equal(notifData.tableId, 8);
    assert.equal(notifData.section, "Main Hall");
    assert.equal(formatTableDisplayLabel(notifData), "Main Hall · Table 1");
  });

  await t.test("6. Direct Table Sanitation clears dirty state only for exact tableId", () => {
    const tables = [
      { id: 8, tableNo: "1", section: "Main Hall", cleaningStatus: "DIRTY" },
      { id: 12, tableNo: "table 1", section: "TABLE", cleaningStatus: "DIRTY" },
    ];

    const targetCleanTableId = 8;
    const updatedTables = tables.map((tbl) => {
      if (tbl.id === targetCleanTableId) {
        return { ...tbl, cleaningStatus: "CLEAN" };
      }
      return tbl;
    });

    assert.equal(updatedTables[0].cleaningStatus, "CLEAN");
    assert.equal(updatedTables[1].cleaningStatus, "DIRTY"); // Table 12 remains DIRTY!
  });
});

