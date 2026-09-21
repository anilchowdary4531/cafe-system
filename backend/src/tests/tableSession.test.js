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
    let tableStatusSet = null;

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
          return { id: 1, status: data.status, closedAt: data.closedAt };
        },
      },
      order: {
        updateMany: async () => ({ count: 2 }),
      },
      diningTable: {
        update: async ({ data }) => {
          tableStatusSet = data;
          return { id: 10, isOccupied: false };
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
});
