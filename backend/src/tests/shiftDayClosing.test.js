import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
  openShift,
  getCurrentShift,
  recordCashMovement,
  calculateExpectedCash,
  closeShift,
  reopenShift,
  getShiftHistory,
} from "../services/shiftService.js";
import {
  calculateDayClosingSummary,
  closeDay,
  getDayClosingHistory,
} from "../services/dayClosingService.js";
import { recordSessionPayment } from "../services/splitBillingService.js";

test("Feature 10: Cashier Shift Opening, Cash Reconciliation, and Day Closing Suite", async (t) => {
  // Setup Test Restaurant & User
  const timestamp = Date.now();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Shift Test Cafe ${timestamp}`,
      slug: `shift-test-cafe-${timestamp}`,
      email: `shift_${timestamp}@tiffzy.com`,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: "Ramesh Cashier",
      email: `ramesh_${timestamp}@tiffzy.com`,
      password: "hashedpassword123",
      role: "CASHIER",
      restaurantId: restaurant.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Anil Manager",
      email: `manager_${timestamp}@tiffzy.com`,
      password: "hashedpassword123",
      role: "MANAGER",
      restaurantId: restaurant.id,
    },
  });

  let activeShiftId = null;

  await t.test("1. Open Shift - valid opening cash and duplicate prevention", async () => {
    const shift = await openShift({
      prisma,
      restaurantId: restaurant.id,
      userId: user.id,
      openingCash: 5000,
      notes: "Morning Shift",
      terminalId: "POS-01",
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    assert.ok(shift.id > 0);
    assert.equal(shift.status, "OPEN");
    assert.equal(shift.openingCash, 5000);
    assert.equal(shift.expectedCash, 5000);

    activeShiftId = shift.id;

    // Test duplicate open shift prevention for same terminal
    await assert.rejects(
      async () => {
        await openShift({
          prisma,
          restaurantId: restaurant.id,
          userId: user.id,
          openingCash: 3000,
          terminalId: "POS-01",
          actor: { userId: user.id, userName: user.name, role: "CASHIER" },
        });
      },
      (err) => {
        return err.code === "duplicate_open_shift";
      }
    );
  });

  await t.test("2. Get Current Active Shift", async () => {
    const current = await getCurrentShift({
      prisma,
      restaurantId: restaurant.id,
      userId: user.id,
      terminalId: "POS-01",
    });

    assert.ok(current);
    assert.equal(current.id, activeShiftId);
    assert.equal(current.status, "OPEN");
    assert.equal(current.expectedCash, 5000);
  });

  await t.test("3. Record Cash In and Cash Out Movements", async () => {
    // Add Cash In ₹2,000 (Change Float added by manager)
    const inRes = await recordCashMovement({
      prisma,
      restaurantId: restaurant.id,
      shiftId: activeShiftId,
      type: "CASH_IN",
      amount: 2000,
      reason: "Manager change money",
      actor: { userId: manager.id, userName: manager.name, role: "MANAGER" },
    });

    assert.equal(inRes.expectedCash, 7000);

    // Record Cash Out ₹500 (Supplier payout / Petty cash)
    const outRes = await recordCashMovement({
      prisma,
      restaurantId: restaurant.id,
      shiftId: activeShiftId,
      type: "CASH_OUT",
      amount: 500,
      reason: "Petty cash supplier payment",
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    assert.equal(outRes.expectedCash, 6500);
  });

  await t.test("4. Sales & Payment Method Separation (Cash vs UPI)", async () => {
    // Setup dining table & table session
    const table = await prisma.diningTable.create({
      data: {
        restaurantId: restaurant.id,
        tableNo: `T-${timestamp}`,
      },
    });

    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        tableNo: table.tableNo,
        total: 6000,
        status: "OPEN",
      },
    });

    // Record Cash payment ₹1,000 (Increases physical cash drawer)
    const cashPay = await recordSessionPayment({
      prisma,
      restaurantId: restaurant.id,
      tableSessionId: session.id,
      paymentMode: "CASH",
      amount: 1000,
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    assert.ok(cashPay.payment.id);
    assert.equal(cashPay.payment.shiftId, activeShiftId);

    // Expected cash: 5000 (Opening) + 2000 (Cash In) - 500 (Cash Out) + 1000 (Cash Sale) = 7500
    const exp1 = await calculateExpectedCash({ prisma, shiftId: activeShiftId });
    assert.equal(exp1, 7500);

    // Record UPI payment ₹5,000 (Digital payment - MUST NOT affect physical cash)
    const upiPay = await recordSessionPayment({
      prisma,
      restaurantId: restaurant.id,
      tableSessionId: session.id,
      paymentMode: "UPI",
      amount: 5000,
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    assert.ok(upiPay.payment.id);

    // Physical expected cash remains ₹7,500
    const exp2 = await calculateExpectedCash({ prisma, shiftId: activeShiftId });
    assert.equal(exp2, 7500);
  });

  await t.test("5. Shift Reconciliation & Variance Calculation", async () => {
    // Actual counted cash = ₹7,450 (Shortage of -₹50)
    const closeRes = await closeShift({
      prisma,
      restaurantId: restaurant.id,
      shiftId: activeShiftId,
      actualCash: 7450,
      varianceReason: "Cash drawer counting difference",
      notes: "Closed morning shift",
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    assert.equal(closeRes.shift.status, "CLOSED");
    assert.equal(closeRes.shift.expectedCash, 7500);
    assert.equal(closeRes.shift.actualCash, 7450);
    assert.equal(closeRes.shift.variance, -50);
    assert.equal(closeRes.paymentSummary.cash, 1000);
    assert.equal(closeRes.paymentSummary.upi, 5000);
    assert.equal(closeRes.paymentSummary.totalSales, 6000);
  });

  await t.test("6. Prevent Cash Operations on Closed Shift", async () => {
    await assert.rejects(
      async () => {
        await recordCashMovement({
          prisma,
          restaurantId: restaurant.id,
          shiftId: activeShiftId,
          type: "CASH_IN",
          amount: 100,
          actor: { userId: user.id, userName: user.name, role: "CASHIER" },
        });
      },
      (err) => {
        return err.code === "shift_not_open";
      }
    );

    // Duplicate close prevention
    await assert.rejects(
      async () => {
        await closeShift({
          prisma,
          restaurantId: restaurant.id,
          shiftId: activeShiftId,
          actualCash: 7450,
          actor: { userId: user.id, userName: user.name, role: "CASHIER" },
        });
      },
      (err) => {
        return err.code === "shift_already_closed";
      }
    );
  });

  await t.test("7. Reopen Shift by Manager", async () => {
    const reopened = await reopenShift({
      prisma,
      restaurantId: restaurant.id,
      shiftId: activeShiftId,
      reason: "Need to adjust cash entry",
      actor: { userId: manager.id, userName: manager.name, role: "MANAGER" },
    });

    assert.equal(reopened.status, "OPEN");

    // Re-close shift
    await closeShift({
      prisma,
      restaurantId: restaurant.id,
      shiftId: activeShiftId,
      actualCash: 7500,
      varianceReason: "Corrected count",
      actor: { userId: manager.id, userName: manager.name, role: "MANAGER" },
    });
  });

  await t.test("8. Shift History Query", async () => {
    const history = await getShiftHistory({
      prisma,
      restaurantId: restaurant.id,
      page: 1,
      limit: 10,
    });

    assert.ok(history.items.length >= 1);
    assert.equal(history.total, 1);
    assert.equal(history.items[0].id, activeShiftId);
  });

  await t.test("9. Day Closing Workflow & Unresolved Open Shift Safety", async () => {
    // Open a second shift to test open shift blocking rule
    const shift2 = await openShift({
      prisma,
      restaurantId: restaurant.id,
      userId: user.id,
      openingCash: 2000,
      terminalId: "POS-02",
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    // Attempt Day Close while shift2 is OPEN -> Should be REJECTED!
    await assert.rejects(
      async () => {
        await closeDay({
          prisma,
          restaurantId: restaurant.id,
          actor: { userId: manager.id, userName: manager.name, role: "MANAGER" },
        });
      },
      (err) => {
        return err.code === "unresolved_open_shifts" && err.openShifts.length > 0;
      }
    );

    // Close shift2
    await closeShift({
      prisma,
      restaurantId: restaurant.id,
      shiftId: shift2.id,
      actualCash: 2000,
      actor: { userId: user.id, userName: user.name, role: "CASHIER" },
    });

    // Now Day Close should SUCCEED
    const dayCloseRes = await closeDay({
      prisma,
      restaurantId: restaurant.id,
      notes: "Successful EOD day close",
      actor: { userId: manager.id, userName: manager.name, role: "MANAGER" },
    });

    assert.ok(dayCloseRes.dayClosing.id);
    assert.equal(dayCloseRes.dayClosing.status, "CLOSED");
    assert.equal(dayCloseRes.dayClosing.totalShifts, 2);
    assert.equal(dayCloseRes.dayClosing.netSales, 6000);
    assert.equal(dayCloseRes.dayClosing.cashTotal, 1000);
    assert.equal(dayCloseRes.dayClosing.upiTotal, 5000);

    // Fetch Day Closing History
    const dayHistory = await getDayClosingHistory({
      prisma,
      restaurantId: restaurant.id,
    });

    assert.equal(dayHistory.items.length, 1);
    assert.equal(dayHistory.items[0].status, "CLOSED");
  });

  // Cleanup test data
  await prisma.cashMovement.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.payment.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.dayClosing.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.cashierShift.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.restaurant.delete({ where: { id: restaurant.id } });
});
