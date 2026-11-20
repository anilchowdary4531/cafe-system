import { round2 } from "./moneyService.js";
import { getBusinessDate } from "./shiftService.js";

/**
 * Calculate EOD Day Closing Summary for a business date
 */
export const calculateDayClosingSummary = async ({ prisma, restaurantId, businessDate = null }) => {
  const rid = Number(restaurantId);
  if (!rid) return null;

  const targetDate = businessDate ? new Date(businessDate) : getBusinessDate();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  // 1. Fetch all Shifts for the business date
  const shifts = await prisma.cashierShift.findMany({
    where: {
      restaurantId: rid,
      openedAt: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  const unresolvedOpenShifts = shifts.filter((s) => s.status === "OPEN" || s.status === "CLOSING");

  // 2. Aggregate Orders for the business date
  const orders = await prisma.order.findMany({
    where: {
      restaurantId: rid,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    select: {
      id: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      serviceChargeAmount: true,
      total: true,
      status: true,
      paymentStatus: true,
      paymentMode: true,
    },
  });

  const validOrders = orders.filter((o) => o.status !== "CANCELLED");
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED");

  let grossSales = 0;
  let discountAmount = 0;
  let taxAmount = 0;
  let serviceChargeAmount = 0;

  for (const o of validOrders) {
    grossSales += Number(o.total || 0);
    discountAmount += Number(o.discountAmount || 0);
    taxAmount += Number(o.taxAmount || 0);
    serviceChargeAmount += Number(o.serviceChargeAmount || 0);
  }

  // 3. Aggregate Successful Payments for the business date
  const payments = await prisma.payment.findMany({
    where: {
      restaurantId: rid,
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: "SUCCESS",
    },
  });

  const paymentBreakdown = {
    cash: 0,
    upi: 0,
    card: 0,
    cashfree: 0,
    payLater: 0,
    other: 0,
  };

  let totalPaymentsCollected = 0;

  for (const p of payments) {
    const pamt = Number(p.amount || 0);
    totalPaymentsCollected += pamt;
    const method = String(p.paymentMethod || p.method || "CASH").toUpperCase();

    if (method.includes("CASH")) {
      paymentBreakdown.cash = round2(paymentBreakdown.cash + pamt);
    } else if (method.includes("UPI")) {
      paymentBreakdown.upi = round2(paymentBreakdown.upi + pamt);
    } else if (method.includes("CARD")) {
      paymentBreakdown.card = round2(paymentBreakdown.card + pamt);
    } else if (method.includes("CASHFREE") || method.includes("ONLINE")) {
      paymentBreakdown.cashfree = round2(paymentBreakdown.cashfree + pamt);
    } else if (method.includes("PAY_LATER")) {
      paymentBreakdown.payLater = round2(paymentBreakdown.payLater + pamt);
    } else {
      paymentBreakdown.other = round2(paymentBreakdown.other + pamt);
    }
  }

  if (grossSales < totalPaymentsCollected) {
    grossSales = totalPaymentsCollected;
  }

  // 4. KOT count
  const kotCount = await prisma.kitchenOrderTicket.count({
    where: {
      restaurantId: rid,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  // 5. Total cash variance from shifts
  const totalCashVariance = shifts.reduce((sum, s) => sum + Number(s.variance || 0), 0);
  const refundAmount = 0; // Derived from refunds if present

  const netSales = round2(grossSales - refundAmount);

  return {
    businessDate: startOfDay,
    grossSales: round2(grossSales),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    serviceChargeAmount: round2(serviceChargeAmount),
    refundAmount: round2(refundAmount),
    netSales,
    paymentBreakdown,
    totalOrders: validOrders.length,
    cancelledOrders: cancelledOrders.length,
    kotCount,
    totalShifts: shifts.length,
    totalCashVariance: round2(totalCashVariance),
    shifts,
    unresolvedOpenShifts,
    canCloseDay: unresolvedOpenShifts.length === 0,
  };
};

/**
 * Close Business Day
 */
export const closeDay = async ({
  prisma,
  restaurantId,
  businessDate = null,
  notes = "",
  actor = null,
}) => {
  const rid = Number(restaurantId);
  if (!rid) {
    const err = new Error("restaurantId is required");
    err.code = "invalid_input";
    throw err;
  }

  const summary = await calculateDayClosingSummary({ prisma, restaurantId: rid, businessDate });

  if (summary.unresolvedOpenShifts.length > 0) {
    const err = new Error(
      `Cannot perform Day Closing while ${summary.unresolvedOpenShifts.length} open cashier shift(s) exist. Please close all cashier shifts first.`
    );
    err.code = "unresolved_open_shifts";
    err.openShifts = summary.unresolvedOpenShifts;
    throw err;
  }

  const uid = Number(actor?.userId || 0);
  const uname = String(actor?.userName || "Manager");

  return await prisma.$transaction(async (tx) => {
    // Check if day closing record already exists
    const existingDayClose = await tx.dayClosing.findUnique({
      where: {
        restaurantId_businessDate: {
          restaurantId: rid,
          businessDate: summary.businessDate,
        },
      },
    });

    if (existingDayClose && existingDayClose.status === "CLOSED") {
      const err = new Error(`Business day ${summary.businessDate.toISOString().slice(0, 10)} has already been closed.`);
      err.code = "day_already_closed";
      throw err;
    }

    const dayCloseRecord = await tx.dayClosing.upsert({
      where: {
        restaurantId_businessDate: {
          restaurantId: rid,
          businessDate: summary.businessDate,
        },
      },
      create: {
        restaurantId: rid,
        businessDate: summary.businessDate,
        status: "CLOSED",
        grossSales: summary.grossSales,
        discountAmount: summary.discountAmount,
        taxAmount: summary.taxAmount,
        serviceChargeAmount: summary.serviceChargeAmount,
        refundAmount: summary.refundAmount,
        netSales: summary.netSales,
        cashTotal: summary.paymentBreakdown.cash,
        upiTotal: summary.paymentBreakdown.upi,
        cardTotal: summary.paymentBreakdown.card,
        cashfreeTotal: summary.paymentBreakdown.cashfree,
        payLaterTotal: summary.paymentBreakdown.payLater,
        otherTotal: summary.paymentBreakdown.other,
        totalOrders: summary.totalOrders,
        cancelledOrders: summary.cancelledOrders,
        kotCount: summary.kotCount,
        totalShifts: summary.totalShifts,
        totalCashVariance: summary.totalCashVariance,
        notes: notes ? String(notes).trim() : null,
        closedAt: new Date(),
        closedByUserId: uid || null,
      },
      update: {
        status: "CLOSED",
        grossSales: summary.grossSales,
        discountAmount: summary.discountAmount,
        taxAmount: summary.taxAmount,
        serviceChargeAmount: summary.serviceChargeAmount,
        refundAmount: summary.refundAmount,
        netSales: summary.netSales,
        cashTotal: summary.paymentBreakdown.cash,
        upiTotal: summary.paymentBreakdown.upi,
        cardTotal: summary.paymentBreakdown.card,
        cashfreeTotal: summary.paymentBreakdown.cashfree,
        payLaterTotal: summary.paymentBreakdown.payLater,
        otherTotal: summary.paymentBreakdown.other,
        totalOrders: summary.totalOrders,
        cancelledOrders: summary.cancelledOrders,
        kotCount: summary.kotCount,
        totalShifts: summary.totalShifts,
        totalCashVariance: summary.totalCashVariance,
        notes: notes ? String(notes).trim() : null,
        closedAt: new Date(),
        closedByUserId: uid || null,
      },
      include: {
        closedByUser: { select: { id: true, name: true } },
      },
    });

    // Audit Log
    await tx.tableOperationLog.create({
      data: {
        restaurantId: rid,
        operationType: "DAY_CLOSED",
        performedByUserId: uid || null,
        performedByName: uname,
        performedByUserRole: actor?.role || "MANAGER",
        details: {
          dayClosingId: dayCloseRecord.id,
          businessDate: summary.businessDate,
          netSales: summary.netSales,
          totalShifts: summary.totalShifts,
          totalCashVariance: summary.totalCashVariance,
        },
      },
    });

    return {
      dayClosing: dayCloseRecord,
      summary,
    };
  });
};

/**
 * Get Day Closing History
 */
export const getDayClosingHistory = async ({ prisma, restaurantId, page = 1, limit = 20 }) => {
  const rid = Number(restaurantId);
  if (!rid) return { items: [], total: 0, page, limit };

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Number(limit);

  const [items, total] = await Promise.all([
    prisma.dayClosing.findMany({
      where: { restaurantId: rid },
      skip,
      take,
      orderBy: { businessDate: "desc" },
      include: {
        closedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.dayClosing.count({ where: { restaurantId: rid } }),
  ]);

  return {
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};
