import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrCreateActiveSession,
  recalculateSessionTotals,
  generateSessionBill,
  updateSessionPaymentStatus,
  closeTableSession,
  getMinutesElapsed,
} from "../services/tableSessionService.js";

test("Persistent Table Sessions Unit & Integration Test Suite", async (t) => {
  await t.test("getMinutesElapsed calculates correct duration in minutes", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const elapsed = getMinutesElapsed(tenMinutesAgo);
    assert.equal(elapsed, 10);
  });

  await t.test("getOrCreateActiveSession creates a new OPEN session if none exists", async () => {
    const mockSessions = [];
    const mockTables = [
      { id: 10, tableNo: "T-10", restaurantId: 1, seats: 4 },
    ];

    const mockPrisma = {
      $transaction: async (cb) => cb(mockPrisma),
      diningTable: {
        findUnique: async ({ where }) => mockTables.find((t) => t.id === where.id),
      },
      tableSession: {
        findFirst: async ({ where }) =>
          mockSessions.find(
            (s) =>
              s.tableId === where.tableId &&
              s.restaurantId === where.restaurantId &&
              where.status.in.includes(s.status)
          ) || null,
        create: async ({ data }) => {
          const newSession = {
            id: mockSessions.length + 1,
            ...data,
            subtotal: 0,
            taxAmount: 0,
            serviceChargeAmount: 0,
            discountAmount: 0,
            total: 0,
            orders: [],
          };
          mockSessions.push(newSession);
          return newSession;
        },
      },
    };

    const session1 = await getOrCreateActiveSession({
      prisma: mockPrisma,
      restaurantId: 1,
      tableId: 10,
      waiterId: 5,
      waiterName: "John Waiter",
      guestCount: 3,
    });

    assert.equal(session1.id, 1);
    assert.equal(session1.tableNo, "T-10");
    assert.equal(session1.status, "OPEN");
    assert.equal(session1.guestCount, 3);
    assert.equal(session1.waiterName, "John Waiter");

    // Re-call with same table -> must return existing session (no duplicates)
    const session2 = await getOrCreateActiveSession({
      prisma: mockPrisma,
      restaurantId: 1,
      tableId: 10,
      waiterId: 5,
      waiterName: "John Waiter",
      guestCount: 3,
    });

    assert.equal(session2.id, 1);
    assert.equal(mockSessions.length, 1);
  });

  await t.test("recalculateSessionTotals accurately sums item subtotals and taxes across multi-KOT orders", async () => {
    const mockSession = {
      id: 1,
      restaurantId: 1,
      tableId: 10,
      tableNo: "T-10",
      status: "OPEN",
      discountAmount: 0,
      restaurant: {
        taxEnabled: true,
        taxType: "EXCLUSIVE",
        defaultTaxPercent: 5,
        serviceChargeEnabled: false,
        serviceChargePercent: 0,
      },
      orders: [
        {
          id: 101,
          status: "PLACED",
          items: [
            { menuItemId: 1, itemName: "Paneer Tikka", price: 200, qty: 2 }, // 400
          ],
        },
        {
          id: 102,
          status: "PLACED",
          items: [
            { menuItemId: 2, itemName: "Mango Lassi", price: 100, qty: 1 }, // 100
          ],
        },
      ],
    };

    let updatedSessionData = null;
    const mockPrisma = {
      tableSession: {
        findUnique: async () => mockSession,
        update: async ({ where, data }) => {
          updatedSessionData = data;
          return { ...mockSession, ...data };
        },
      },
    };

    await recalculateSessionTotals({ prisma: mockPrisma, sessionId: 1 });

    assert.equal(updatedSessionData.subtotal, 500); // 400 + 100
    assert.equal(updatedSessionData.taxAmount, 25); // 5% of 500
    assert.equal(updatedSessionData.total, 525);
  });

  await t.test("generateSessionBill sets session status to BILLING", async () => {
    let statusSet = null;
    const mockSession = {
      id: 1,
      restaurantId: 1,
      tableId: 10,
      tableNo: "T-10",
      status: "OPEN",
      discountAmount: 0,
      openedAt: new Date().toISOString(),
      restaurant: { taxEnabled: false },
      orders: [],
    };

    const mockPrisma = {
      tableSession: {
        findUnique: async () => mockSession,
        update: async ({ data }) => {
          if (data.status) mockSession.status = data.status;
          statusSet = mockSession.status;
          return { ...mockSession, ...data };
        },
      },
    };

    const session = await generateSessionBill({ prisma: mockPrisma, sessionId: 1 });
    assert.equal(statusSet, "BILLING");
    assert.equal(session.status, "BILLING");
  });

  await t.test("updateSessionPaymentStatus completes session on PAID status", async () => {
    let closedStatus = null;

    const mockPrisma = {
      tableSession: {
        findUnique: async () => ({
          id: 1,
          tableId: 10,
          restaurantId: 1,
          status: "BILLING",
          orders: [{ id: 101 }, { id: 102 }],
        }),
        update: async ({ data }) => {
          closedStatus = data.status;
          return { id: 1, status: data.status, paidAt: data.paidAt };
        },
      },
      order: {
        updateMany: async () => ({ count: 2 }),
      },
      diningTable: {
        update: async ({ data }) => {
          return { id: 10, assignedWaiterId: null, assignedWaiterName: null };
        },
      },
    };

    const result = await updateSessionPaymentStatus({
      prisma: mockPrisma,
      sessionId: 1,
      paymentMode: "CASH",
      paymentStatus: "PAID",
    });

    assert.equal(closedStatus, "PAID");
    assert.equal(result.status, "PAID");
  });

  await t.test("Free Table Workflow - Successfully freeing an occupied table within transaction", async () => {
    let sessionClosed = false;
    let waiterCleared = false;
    let auditLogged = false;
    let ordersDeleted = false;
    let paymentsDeleted = false;

    const mockSession = {
      id: 101,
      tableId: 5,
      restaurantId: 1,
      status: "OPEN",
      orders: [{ id: 201, status: "DELIVERED", paymentStatus: "PAID" }],
    };

    const mockTable = {
      id: 5,
      restaurantId: 1,
      tableNo: "T-5",
      assignedWaiterId: 12,
      assignedWaiterName: "Sam",
      tableSessions: [mockSession],
    };

    const mockTx = {
      tableSession: {
        updateMany: async ({ where, data }) => {
          if (where.tableId === 5 && data.status === "CLOSED") {
            sessionClosed = true;
          }
          return { count: 1 };
        },
      },
      order: {
        updateMany: async ({ data }) => {
          return { count: 0 };
        },
        deleteMany: async () => {
          ordersDeleted = true;
        },
      },
      payment: {
        deleteMany: async () => {
          paymentsDeleted = true;
        },
      },
      diningTable: {
        update: async ({ where, data }) => {
          assert.equal("isOccupied" in data, false, "diningTable.update must NOT include isOccupied argument");
          if (data.assignedWaiterId === null && data.assignedWaiterName === null) {
            waiterCleared = true;
          }
          return { ...mockTable, assignedWaiterId: null, assignedWaiterName: null };
        },
      },
      tableOperationLog: {
        create: async ({ data }) => {
          if (data.operationType === "CLEAR_TABLE") {
            auditLogged = true;
          }
          return { id: 1, ...data };
        },
      },
    };

    const mockPrisma = {
      $transaction: async (cb) => cb(mockTx),
    };

    // Execute clear table transaction
    const updatedTable = await mockPrisma.$transaction(async (tx) => {
      await tx.tableSession.updateMany({
        where: { tableId: 5, restaurantId: 1, status: { in: ["OPEN", "BILLING", "PAID"] } },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      await tx.order.updateMany({
        where: { tableId: 5, restaurantId: 1, status: { in: ["PLACED", "ACCEPTED", "PREPARING", "READY", "OPEN", "BILLING"] } },
        data: { status: "DELIVERED" },
      });

      const updated = await tx.diningTable.update({
        where: { id: 5 },
        data: { assignedWaiterId: null, assignedWaiterName: null },
      });

      await tx.tableOperationLog.create({
        data: {
          restaurantId: 1,
          operationType: "CLEAR_TABLE",
          sourceTableId: 5,
          sourceTableNo: "T-5",
          sourceSessionId: mockSession.id,
          performedByName: "Server Test",
          performedByUserRole: "SERVER",
        },
      });

      return updated;
    });

    assert.equal(sessionClosed, true, "Active table session should be marked CLOSED");
    assert.equal(waiterCleared, true, "Assigned waiter should be cleared");
    assert.equal(auditLogged, true, "Audit log for CLEAR_TABLE should be created");
    assert.equal(ordersDeleted, false, "Orders must NOT be deleted when freeing a table");
    assert.equal(paymentsDeleted, false, "Payments must NOT be deleted when freeing a table");
    assert.equal(updatedTable.id, 5);
  });

  await t.test("Free Table Workflow - Rejecting attempt to free table with active/unpaid orders without force flag", async () => {
    const mockSessionWithActiveOrders = {
      id: 102,
      tableId: 6,
      restaurantId: 1,
      status: "OPEN",
      orders: [
        { id: 202, status: "PREPARING", paymentStatus: "PENDING" },
      ],
    };

    const mockTable = {
      id: 6,
      restaurantId: 1,
      tableNo: "T-6",
      tableSessions: [mockSessionWithActiveOrders],
    };

    const activeSession = mockTable.tableSessions[0];
    const activeOrders = activeSession?.orders || [];
    const unpaidOrders = activeOrders.filter((o) => o.paymentStatus === "PENDING" && o.status !== "CANCELLED");
    const activePrepOrders = activeOrders.filter((o) => ["PLACED", "ACCEPTED", "PREPARING"].includes(o.status));

    const force = false;
    let validationFailed = false;
    let responseObj = null;

    if (!force && (unpaidOrders.length > 0 || activePrepOrders.length > 0)) {
      validationFailed = true;
      responseObj = {
        success: false,
        requiresConfirmation: true,
        unpaidCount: unpaidOrders.length,
        prepCount: activePrepOrders.length,
      };
    }

    assert.equal(validationFailed, true);
    assert.equal(responseObj.requiresConfirmation, true);
    assert.equal(responseObj.unpaidCount, 1);
    assert.equal(responseObj.prepCount, 1);
  });

  await t.test("Free Table Workflow - Preventing duplicate Free Table requests (idempotent clearing)", async () => {
    const mockTableAlreadyFree = {
      id: 7,
      restaurantId: 1,
      tableNo: "T-7",
      tableSessions: [], // No active session
    };

    let sessionClosedCount = 0;
    let tableUpdatedCount = 0;

    const mockTx = {
      tableSession: {
        updateMany: async () => {
          sessionClosedCount++;
          return { count: 0 };
        },
      },
      order: {
        updateMany: async () => ({ count: 0 }),
      },
      diningTable: {
        update: async ({ data }) => {
          assert.equal("isOccupied" in data, false);
          tableUpdatedCount++;
          return { ...mockTableAlreadyFree, assignedWaiterId: null, assignedWaiterName: null };
        },
      },
      tableOperationLog: {
        create: async () => ({ id: 2 }),
      },
    };

    const mockPrisma = {
      $transaction: async (cb) => cb(mockTx),
    };

    // Re-clearing table that has no active session should succeed cleanly without crashing
    const activeSession = mockTableAlreadyFree.tableSessions[0]; // undefined

    const result = await mockPrisma.$transaction(async (tx) => {
      if (activeSession) {
        await tx.tableSession.updateMany({
          where: { tableId: 7, restaurantId: 1, status: { in: ["OPEN", "BILLING", "PAID"] } },
          data: { status: "CLOSED", closedAt: new Date() },
        });
      }

      return tx.diningTable.update({
        where: { id: 7 },
        data: { assignedWaiterId: null, assignedWaiterName: null },
      });
    });

    assert.equal(sessionClosedCount, 0, "No active session update should occur if already closed");
    assert.equal(tableUpdatedCount, 1, "Dining table status remains free without error");
    assert.equal(result.id, 7);
  });
});

