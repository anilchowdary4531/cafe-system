import { round2 } from "./moneyService.js";

/**
 * Get Business Date string (YYYY-MM-DD) normalized to start of day UTC
 */
export const getBusinessDate = (inputDate = new Date(), timezone = "Asia/Kolkata") => {
  const d = inputDate instanceof Date ? inputDate : new Date(inputDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
};

/**
 * Get Current Active Shift for a restaurant & terminal / cashier
 */
export const getCurrentShift = async ({ prisma, restaurantId, userId, terminalId = "MAIN" }) => {
  const rid = Number(restaurantId);
  if (!rid) return null;

  const where = {
    restaurantId: rid,
    status: { in: ["OPEN", "CLOSING"] },
  };

  if (terminalId) {
    where.terminalId = String(terminalId);
  }

  const shift = await prisma.cashierShift.findFirst({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      closedByUser: { select: { id: true, name: true } },
      approvedByUser: { select: { id: true, name: true } },
      cashMovements: { orderBy: { createdAt: "asc" } },
      payments: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          method: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { openedAt: "desc" },
  });

  if (!shift) return null;

  // Re-calculate expected cash on the fly for authoritative view
  const expectedCash = await calculateExpectedCash({ prisma, shiftId: shift.id });

  return {
    ...shift,
    expectedCash,
  };
};

/**
 * Open a New Cashier Shift
 */
export const openShift = async ({
  prisma,
  restaurantId,
  userId,
  openingCash = 0,
  notes = "",
  terminalId = "MAIN",
  actor = null,
}) => {
  const rid = Number(restaurantId);
  const uid = Number(userId || actor?.userId || 0);
  const term = String(terminalId || "MAIN").trim();
  const openingAmount = round2(Number(openingCash || 0));

  if (!rid || !uid) {
    const err = new Error("restaurantId and userId are required to open a shift");
    err.code = "invalid_input";
    throw err;
  }

  if (openingAmount < 0) {
    const err = new Error("Opening cash must be non-negative");
    err.code = "invalid_opening_cash";
    throw err;
  }

  const businessDate = getBusinessDate();

  return await prisma.$transaction(async (tx) => {
    // Check if shift is already open for this terminal
    const existingActive = await tx.cashierShift.findFirst({
      where: {
        restaurantId: rid,
        terminalId: term,
        status: { in: ["OPEN", "CLOSING"] },
      },
    });

    if (existingActive) {
      const err = new Error(`An active cashier shift (ID: #${existingActive.id}) is already open for terminal '${term}'. Please close it first.`);
      err.code = "duplicate_open_shift";
      err.existingShift = existingActive;
      throw err;
    }

    // Create the new Shift record
    const newShift = await tx.cashierShift.create({
      data: {
        restaurantId: rid,
        userId: uid,
        terminalId: term,
        status: "OPEN",
        businessDate,
        openedAt: new Date(),
        openingCash: openingAmount,
        expectedCash: openingAmount,
        notes: notes ? String(notes).trim() : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Record initial OPENING_CASH movement
    await tx.cashMovement.create({
      data: {
        shiftId: newShift.id,
        restaurantId: rid,
        type: "OPENING_CASH",
        amount: openingAmount,
        reason: notes || "Shift Opening Float",
        performedByUserId: uid,
        performedByName: actor?.userName || newShift.user?.name || "Cashier",
      },
    });

    // Audit Log
    await tx.tableOperationLog.create({
      data: {
        restaurantId: rid,
        operationType: "SHIFT_OPENED",
        performedByUserId: uid,
        performedByName: actor?.userName || newShift.user?.name || "Cashier",
        performedByUserRole: actor?.role || "CASHIER",
        details: {
          shiftId: newShift.id,
          openingCash: openingAmount,
          terminalId: term,
          businessDate,
        },
      },
    });

    return newShift;
  });
};

/**
 * Record a Cash Movement (CASH_IN, CASH_OUT, CASH_SALE, CASH_REFUND)
 */
export const recordCashMovement = async ({
  prisma,
  restaurantId,
  shiftId,
  type,
  amount,
  reason = "",
  paymentId = null,
  actor = null,
}) => {
  const rid = Number(restaurantId);
  const sid = Number(shiftId);
  const moveType = String(type || "").toUpperCase();
  const amt = round2(Number(amount || 0));

  if (!rid || !sid || amt <= 0) {
    const err = new Error("restaurantId, shiftId, and positive amount are required");
    err.code = "invalid_input";
    throw err;
  }

  const validTypes = ["OPENING_CASH", "CASH_SALE", "CASH_REFUND", "CASH_IN", "CASH_OUT", "CLOSING_ADJUSTMENT"];
  if (!validTypes.includes(moveType)) {
    const err = new Error(`Invalid cash movement type '${moveType}'`);
    err.code = "invalid_movement_type";
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const shift = await tx.cashierShift.findFirst({
      where: { id: sid, restaurantId: rid },
    });

    if (!shift) {
      const err = new Error("Shift not found");
      err.code = "shift_not_found";
      throw err;
    }

    if (shift.status !== "OPEN") {
      const err = new Error(`Cannot record cash movement on a shift with status '${shift.status}'`);
      err.code = "shift_not_open";
      throw err;
    }

    const uid = Number(actor?.userId || shift.userId);
    const uname = String(actor?.userName || "Staff");

    const movement = await tx.cashMovement.create({
      data: {
        shiftId: sid,
        restaurantId: rid,
        type: moveType,
        amount: amt,
        reason: reason ? String(reason).trim() : null,
        paymentId: paymentId ? Number(paymentId) : null,
        performedByUserId: uid,
        performedByName: uname,
      },
    });

    // Update Expected Cash on Shift
    const newExpected = await calculateExpectedCash({ prisma: tx, shiftId: sid });

    const updatedShift = await tx.cashierShift.update({
      where: { id: sid },
      data: { expectedCash: newExpected },
      include: {
        cashMovements: { orderBy: { createdAt: "asc" } },
      },
    });

    // Audit Log for Cash In / Out
    if (["CASH_IN", "CASH_OUT"].includes(moveType)) {
      await tx.tableOperationLog.create({
        data: {
          restaurantId: rid,
          operationType: moveType,
          performedByUserId: uid,
          performedByName: uname,
          performedByUserRole: actor?.role || "STAFF",
          details: {
            shiftId: sid,
            type: moveType,
            amount: amt,
            reason,
            newExpectedCash: newExpected,
          },
        },
      });
    }

    return { movement, shift: updatedShift, expectedCash: newExpected };
  });
};

/**
 * Server-Authoritative Expected Cash Calculation
 * Expected = Opening Cash + Cash Sales + Cash In - Cash Refunds - Cash Out
 */
export const calculateExpectedCash = async ({ prisma, shiftId }) => {
  const sid = Number(shiftId);
  if (!sid) return 0;

  const movements = await prisma.cashMovement.findMany({
    where: { shiftId: sid },
    select: { type: true, amount: true },
  });

  let total = 0;
  for (const m of movements) {
    const amt = Number(m.amount || 0);
    switch (m.type) {
      case "OPENING_CASH":
      case "CASH_SALE":
      case "CASH_IN":
        total += amt;
        break;
      case "CASH_REFUND":
      case "CASH_OUT":
        total -= amt;
        break;
      case "CLOSING_ADJUSTMENT":
        total += amt;
        break;
    }
  }

  return round2(Math.max(0, total));
};

/**
 * Close Cashier Shift & Perform Cash Reconciliation
 */
export const closeShift = async ({
  prisma,
  restaurantId,
  shiftId,
  actualCash,
  varianceReason = "",
  notes = "",
  actor = null,
}) => {
  const rid = Number(restaurantId);
  const sid = Number(shiftId);
  const countedCash = round2(Number(actualCash));

  if (!rid || !sid || Number.isNaN(countedCash) || countedCash < 0) {
    const err = new Error("restaurantId, shiftId, and valid non-negative actualCash count are required");
    err.code = "invalid_input";
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Pessimistic lock / verify status
    const shift = await tx.cashierShift.findFirst({
      where: { id: sid, restaurantId: rid },
      include: {
        payments: { where: { status: "SUCCESS" } },
        cashMovements: true,
      },
    });

    if (!shift) {
      const err = new Error("Shift not found");
      err.code = "shift_not_found";
      throw err;
    }

    if (shift.status === "CLOSED" || shift.status === "CANCELLED") {
      const err = new Error(`Shift #${sid} has already been closed.`);
      err.code = "shift_already_closed";
      throw err;
    }

    // Set shift to CLOSING to block concurrent modifications
    await tx.cashierShift.update({
      where: { id: sid },
      data: { status: "CLOSING" },
    });

    // 2. Authoritative expected cash calculation
    const expectedCash = await calculateExpectedCash({ prisma: tx, shiftId: sid });

    // 3. Variance calculation
    const variance = round2(countedCash - expectedCash);

    // If variance is non-zero, record variance reason
    if (Math.abs(variance) > 0.01 && !varianceReason && !notes) {
      varianceReason = "Cash variance observed during close count";
    }

    // 4. Summarize Payment Methods linked to shift
    const payments = await tx.payment.findMany({
      where: { shiftId: sid, status: "SUCCESS" },
    });

    const paymentSummary = {
      cash: 0,
      upi: 0,
      card: 0,
      cashfree: 0,
      payLater: 0,
      totalSales: 0,
    };

    for (const p of payments) {
      const pamt = Number(p.amount || 0);
      const method = String(p.paymentMethod || p.method || "CASH").toUpperCase();

      paymentSummary.totalSales = round2(paymentSummary.totalSales + pamt);

      if (method.includes("CASH")) {
        paymentSummary.cash = round2(paymentSummary.cash + pamt);
      } else if (method.includes("UPI")) {
        paymentSummary.upi = round2(paymentSummary.upi + pamt);
      } else if (method.includes("CARD")) {
        paymentSummary.card = round2(paymentSummary.card + pamt);
      } else if (method.includes("CASHFREE") || method.includes("ONLINE")) {
        paymentSummary.cashfree = round2(paymentSummary.cashfree + pamt);
      } else if (method.includes("PAY_LATER")) {
        paymentSummary.payLater = round2(paymentSummary.payLater + pamt);
      } else {
        paymentSummary.cashfree = round2(paymentSummary.cashfree + pamt);
      }
    }

    const uid = Number(actor?.userId || shift.userId);
    const uname = String(actor?.userName || "Manager");

    // 5. Update shift to CLOSED
    const closedShift = await tx.cashierShift.update({
      where: { id: sid },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByUserId: uid,
        expectedCash,
        actualCash: countedCash,
        variance,
        varianceReason: varianceReason ? String(varianceReason).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        closedByUser: { select: { id: true, name: true } },
        cashMovements: { orderBy: { createdAt: "asc" } },
      },
    });

    // 6. Record Audit Event
    await tx.tableOperationLog.create({
      data: {
        restaurantId: rid,
        operationType: "SHIFT_CLOSED",
        performedByUserId: uid,
        performedByName: uname,
        performedByUserRole: actor?.role || "STAFF",
        details: {
          shiftId: sid,
          openingCash: shift.openingCash,
          expectedCash,
          actualCash: countedCash,
          variance,
          varianceReason,
          paymentSummary,
        },
      },
    });

    return {
      shift: closedShift,
      paymentSummary,
    };
  });
};

/**
 * Reopen a Closed Shift (Manager/Owner Only)
 */
export const reopenShift = async ({ prisma, restaurantId, shiftId, reason = "", actor }) => {
  const rid = Number(restaurantId);
  const sid = Number(shiftId);

  if (!rid || !sid) {
    const err = new Error("restaurantId and shiftId are required");
    err.code = "invalid_input";
    throw err;
  }

  const role = String(actor?.role || "").toUpperCase();
  if (role !== "OWNER" && role !== "MANAGER" && role !== "SUPER_ADMIN") {
    const err = new Error("Only Managers or Owners can reopen a closed shift");
    err.code = "forbidden";
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const shift = await tx.cashierShift.findFirst({
      where: { id: sid, restaurantId: rid },
    });

    if (!shift) {
      const err = new Error("Shift not found");
      err.code = "shift_not_found";
      throw err;
    }

    if (shift.status !== "CLOSED") {
      const err = new Error(`Shift #${sid} is not closed (current status: '${shift.status}')`);
      err.code = "shift_not_closed";
      throw err;
    }

    const updatedShift = await tx.cashierShift.update({
      where: { id: sid },
      data: {
        status: "OPEN",
        closedAt: null,
        closedByUserId: null,
        notes: shift.notes ? `${shift.notes}\n[Reopened by ${actor?.userName}: ${reason}]` : `Reopened: ${reason}`,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        cashMovements: { orderBy: { createdAt: "asc" } },
      },
    });

    await tx.tableOperationLog.create({
      data: {
        restaurantId: rid,
        operationType: "SHIFT_REOPENED",
        performedByUserId: actor?.userId || null,
        performedByName: actor?.userName || "Manager",
        performedByUserRole: actor?.role || "MANAGER",
        details: {
          shiftId: sid,
          reason,
          previousClosingDetails: {
            closedAt: shift.closedAt,
            actualCash: shift.actualCash,
            variance: shift.variance,
          },
        },
      },
    });

    return updatedShift;
  });
};

/**
 * Get Shift History with Filters
 */
export const getShiftHistory = async ({
  prisma,
  restaurantId,
  startDate = null,
  endDate = null,
  cashierId = null,
  status = null,
  terminalId = null,
  page = 1,
  limit = 20,
}) => {
  const rid = Number(restaurantId);
  if (!rid) return { items: [], total: 0, page, limit };

  const where = { restaurantId: rid };

  if (cashierId) where.userId = Number(cashierId);
  if (status) where.status = String(status);
  if (terminalId) where.terminalId = String(terminalId);

  if (startDate || endDate) {
    where.openedAt = {};
    if (startDate) where.openedAt.gte = new Date(startDate);
    if (endDate) where.openedAt.lte = new Date(endDate);
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Number(limit);

  const [items, total] = await Promise.all([
    prisma.cashierShift.findMany({
      where,
      skip,
      take,
      orderBy: { openedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        closedByUser: { select: { id: true, name: true } },
        approvedByUser: { select: { id: true, name: true } },
        cashMovements: { orderBy: { createdAt: "asc" } },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            method: true,
            status: true,
          },
        },
      },
    }),
    prisma.cashierShift.count({ where }),
  ]);

  return {
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};
