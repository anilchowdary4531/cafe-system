import { round2 } from "./moneyService.js";

/**
 * Date Range Helper: Converts ISO date strings or presets to Start & End Date objects
 */
export const parseReportDateRange = (startDateStr, endDateStr) => {
  let start = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let end = endDateStr ? new Date(endDateStr) : new Date();

  if (Number.isNaN(start.getTime())) start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(end.getTime())) end = new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * 1. SALES REPORT
 */
export const getSalesReport = async ({
  prisma,
  restaurantId,
  startDate,
  endDate,
  orderType = null,
  paymentMethod = null,
  page = 1,
  limit = 50,
}) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    createdAt: { gte: start, lte: end },
    status: { not: "CANCELLED" },
  };

  if (orderType) {
    where.OR = [
      { fulfillment: { equals: String(orderType), mode: "insensitive" } },
      { orderSource: { equals: String(orderType), mode: "insensitive" } },
    ];
  }

  if (paymentMethod) {
    where.paymentMode = { equals: String(paymentMethod), mode: "insensitive" };
  }

  const [orders, totalOrdersCount] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        payments: { where: { status: "SUCCESS" } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  // Aggregate all matching orders for summary totals
  const allOrders = await prisma.order.findMany({
    where,
    select: {
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      serviceChargeAmount: true,
      total: true,
      paymentMode: true,
      createdAt: true,
      items: { select: { qty: true } },
    },
  });

  let grossSales = 0;
  let discountAmount = 0;
  let taxAmount = 0;
  let serviceChargeAmount = 0;
  let totalItemsSold = 0;

  const trendMap = {};

  for (const o of allOrders) {
    const sub = Number(o.subtotal || o.total || 0);
    const disc = Number(o.discountAmount || 0);
    const tax = Number(o.taxAmount || 0);
    const sc = Number(o.serviceChargeAmount || 0);

    grossSales += sub;
    discountAmount += disc;
    taxAmount += tax;
    serviceChargeAmount += sc;

    const itemsCount = (o.items || []).reduce((sum, i) => sum + (i.qty || 1), 0);
    totalItemsSold += itemsCount;

    const dateKey = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!trendMap[dateKey]) {
      trendMap[dateKey] = { date: dateKey, grossSales: 0, discountAmount: 0, taxAmount: 0, netSales: 0, orderCount: 0 };
    }
    trendMap[dateKey].grossSales = round2(trendMap[dateKey].grossSales + sub);
    trendMap[dateKey].discountAmount = round2(trendMap[dateKey].discountAmount + disc);
    trendMap[dateKey].taxAmount = round2(trendMap[dateKey].taxAmount + tax);
    trendMap[dateKey].netSales = round2(trendMap[dateKey].netSales + (sub - disc + tax + sc));
    trendMap[dateKey].orderCount += 1;
  }

  // Payment method totals for the period
  const payments = await prisma.payment.findMany({
    where: {
      restaurantId: rid,
      createdAt: { gte: start, lte: end },
      status: "SUCCESS",
    },
    select: { amount: true, paymentMethod: true, method: true },
  });

  const paymentBreakdown = { cash: 0, upi: 0, card: 0, cashfree: 0, payLater: 0, other: 0 };
  for (const p of payments) {
    const amt = Number(p.amount || 0);
    const m = String(p.paymentMethod || p.method || "CASH").toUpperCase();
    if (m.includes("CASH")) paymentBreakdown.cash = round2(paymentBreakdown.cash + amt);
    else if (m.includes("UPI")) paymentBreakdown.upi = round2(paymentBreakdown.upi + amt);
    else if (m.includes("CARD")) paymentBreakdown.card = round2(paymentBreakdown.card + amt);
    else if (m.includes("CASHFREE") || m.includes("ONLINE")) paymentBreakdown.cashfree = round2(paymentBreakdown.cashfree + amt);
    else if (m.includes("PAY_LATER")) paymentBreakdown.payLater = round2(paymentBreakdown.payLater + amt);
    else paymentBreakdown.other = round2(paymentBreakdown.other + amt);
  }

  const refunds = await prisma.payment.aggregate({
    where: { restaurantId: rid, createdAt: { gte: start, lte: end }, status: "REFUNDED" },
    _sum: { amount: true },
  });

  const refundAmount = Number(refunds._sum?.amount || 0);
  const netSales = round2(grossSales - discountAmount + taxAmount + serviceChargeAmount - refundAmount);
  const avgOrderValue = allOrders.length > 0 ? round2(netSales / allOrders.length) : 0;

  const salesTrend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    summary: {
      grossSales: round2(grossSales),
      discountAmount: round2(discountAmount),
      taxAmount: round2(taxAmount),
      serviceChargeAmount: round2(serviceChargeAmount),
      refundAmount: round2(refundAmount),
      netSales,
      totalOrders: allOrders.length,
      totalItemsSold,
      avgOrderValue,
      paymentBreakdown,
    },
    salesTrend,
    orders,
    pagination: { page: Number(page), limit: Number(limit), total: totalOrdersCount, totalPages: Math.ceil(totalOrdersCount / limit) },
  };
};

/**
 * 2. GST / TAX REPORT
 */
export const getGstTaxReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: { taxEnabled: true, taxType: true, defaultTaxPercent: true },
  });

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: rid,
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      orderNo: true,
      invoiceNo: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      total: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const taxMap = {};
  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTaxCollected = 0;

  for (const o of orders) {
    const sub = Number(o.subtotal || 0);
    const disc = Number(o.discountAmount || 0);
    const taxable = Math.max(0, sub - disc);
    const tax = Number(o.taxAmount || 0);

    const cgst = round2(tax / 2);
    const sgst = round2(tax / 2);
    const igst = 0;

    totalTaxableValue += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalTaxCollected += tax;

    const dateKey = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!taxMap[dateKey]) {
      taxMap[dateKey] = { date: dateKey, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, orderCount: 0 };
    }

    taxMap[dateKey].taxableValue = round2(taxMap[dateKey].taxableValue + taxable);
    taxMap[dateKey].cgst = round2(taxMap[dateKey].cgst + cgst);
    taxMap[dateKey].sgst = round2(taxMap[dateKey].sgst + sgst);
    taxMap[dateKey].igst = round2(taxMap[dateKey].igst + igst);
    taxMap[dateKey].totalTax = round2(taxMap[dateKey].totalTax + tax);
    taxMap[dateKey].orderCount += 1;
  }

  const dailyTaxBreakdown = Object.values(taxMap).sort((a, b) => a.date.localeCompare(b.date));

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const paginatedOrders = orders.slice(skip, skip + Number(limit)).map((o) => {
    const taxable = Math.max(0, Number(o.subtotal || 0) - Number(o.discountAmount || 0));
    const tax = Number(o.taxAmount || 0);
    return {
      ...o,
      taxableValue: round2(taxable),
      cgst: round2(tax / 2),
      sgst: round2(tax / 2),
      igst: 0,
      totalTax: round2(tax),
    };
  });

  return {
    restaurantTaxConfig: restaurant,
    summary: {
      totalTaxableValue: round2(totalTaxableValue),
      totalCgst: round2(totalCgst),
      totalSgst: round2(totalSgst),
      totalIgst: round2(totalIgst),
      totalTaxCollected: round2(totalTaxCollected),
      orderCount: orders.length,
    },
    dailyTaxBreakdown,
    orders: paginatedOrders,
    pagination: { page: Number(page), limit: Number(limit), total: orders.length, totalPages: Math.ceil(orders.length / limit) },
  };
};

/**
 * 3. ITEM SALES REPORT
 */
export const getItemSalesReport = async ({
  prisma,
  restaurantId,
  startDate,
  endDate,
  category = null,
  search = null,
  page = 1,
  limit = 50,
}) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const orderItemWhere = {
    order: {
      restaurantId: rid,
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
    },
  };

  if (search) {
    orderItemWhere.itemName = { contains: String(search), mode: "insensitive" };
  }

  const orderItems = await prisma.orderItem.findMany({
    where: orderItemWhere,
    include: {
      order: { select: { id: true, createdAt: true, discountAmount: true, subtotal: true } },
    },
  });

  const itemMap = {};

  for (const item of orderItems) {
    const name = item.itemName;
    const variant = item.variantName ? ` (${item.variantName})` : "";
    const key = `${name}${variant}`;

    if (!itemMap[key]) {
      itemMap[key] = {
        itemName: name,
        variantName: item.variantName || null,
        qty: 0,
        unitPrice: item.price,
        grossSales: 0,
        discountAmount: 0,
        netSales: 0,
      };
    }

    const qty = Number(item.qty || 1);
    const total = Number(item.total || item.price * qty);

    itemMap[key].qty += qty;
    itemMap[key].grossSales = round2(itemMap[key].grossSales + total);
    itemMap[key].netSales = round2(itemMap[key].netSales + total);
  }

  let results = Object.values(itemMap).sort((a, b) => b.grossSales - a.grossSales);

  const totalItemsCount = results.length;
  const totalQtySold = results.reduce((sum, i) => sum + i.qty, 0);
  const totalGrossSales = results.reduce((sum, i) => sum + i.grossSales, 0);

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const paginatedItems = results.slice(skip, skip + Number(limit));

  return {
    summary: {
      totalItemsCount,
      totalQtySold,
      totalGrossSales: round2(totalGrossSales),
    },
    items: paginatedItems,
    pagination: { page: Number(page), limit: Number(limit), total: totalItemsCount, totalPages: Math.ceil(totalItemsCount / limit) },
  };
};

/**
 * 4. CATEGORY SALES REPORT
 */
export const getCategorySalesReport = async ({ prisma, restaurantId, startDate, endDate }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId: rid },
    select: { id: true, name: true, category: true },
  });

  const categoryByItemName = {};
  for (const mi of menuItems) {
    categoryByItemName[mi.name.toLowerCase()] = mi.category || "General";
  }

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        restaurantId: rid,
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
    },
  });

  const catMap = {};
  let grandTotalSales = 0;

  for (const item of orderItems) {
    const cat = categoryByItemName[item.itemName.toLowerCase()] || "General";
    if (!catMap[cat]) {
      catMap[cat] = { category: cat, itemsSold: 0, totalQty: 0, grossSales: 0, netSales: 0 };
    }

    const qty = Number(item.qty || 1);
    const total = Number(item.total || item.price * qty);

    catMap[cat].itemsSold += 1;
    catMap[cat].totalQty += qty;
    catMap[cat].grossSales = round2(catMap[cat].grossSales + total);
    catMap[cat].netSales = round2(catMap[cat].netSales + total);
    grandTotalSales += total;
  }

  const categories = Object.values(catMap).map((c) => ({
    ...c,
    salesPercentage: grandTotalSales > 0 ? round2((c.netSales / grandTotalSales) * 100) : 0,
  })).sort((a, b) => b.netSales - a.netSales);

  return {
    summary: {
      totalCategories: categories.length,
      grandTotalSales: round2(grandTotalSales),
    },
    categories,
  };
};

/**
 * 5. WAITER / SERVER REPORT
 */
export const getWaiterReport = async ({ prisma, restaurantId, startDate, endDate }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const sessions = await prisma.tableSession.findMany({
    where: {
      restaurantId: rid,
      openedAt: { gte: start, lte: end },
    },
    include: {
      orders: { include: { items: true, payments: { where: { status: "SUCCESS" } } } },
    },
  });

  const waiterMap = {};

  for (const s of sessions) {
    const waiterName = s.waiterName || "Unassigned Server";
    if (!waiterMap[waiterName]) {
      waiterMap[waiterName] = {
        waiterName,
        sessionCount: 0,
        orderCount: 0,
        itemsServed: 0,
        grossSales: 0,
        netSales: 0,
        cashCollections: 0,
        digitalCollections: 0,
        cancelledOrders: 0,
      };
    }

    waiterMap[waiterName].sessionCount += 1;

    for (const o of s.orders) {
      if (o.status === "CANCELLED") {
        waiterMap[waiterName].cancelledOrders += 1;
        continue;
      }

      waiterMap[waiterName].orderCount += 1;
      const orderTotal = Number(o.total || 0);
      waiterMap[waiterName].grossSales = round2(waiterMap[waiterName].grossSales + Number(o.subtotal || orderTotal));
      waiterMap[waiterName].netSales = round2(waiterMap[waiterName].netSales + orderTotal);

      const itemsQty = (o.items || []).reduce((sum, i) => sum + (i.qty || 1), 0);
      waiterMap[waiterName].itemsServed += itemsQty;

      for (const p of o.payments || []) {
        const pamt = Number(p.amount || 0);
        const m = String(p.paymentMethod || p.method || "CASH").toUpperCase();
        if (m.includes("CASH")) waiterMap[waiterName].cashCollections = round2(waiterMap[waiterName].cashCollections + pamt);
        else waiterMap[waiterName].digitalCollections = round2(waiterMap[waiterName].digitalCollections + pamt);
      }
    }
  }

  const waiters = Object.values(waiterMap).sort((a, b) => b.netSales - a.netSales);

  return {
    summary: {
      totalServers: waiters.length,
      totalSessionsHandled: sessions.length,
    },
    waiters,
  };
};

/**
 * 6. KOT REPORT
 */
export const getKotReport = async ({
  prisma,
  restaurantId,
  startDate,
  endDate,
  status = null,
  stationId = null,
  page = 1,
  limit = 50,
}) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    createdAt: { gte: start, lte: end },
  };

  if (status) where.status = String(status);
  if (stationId) where.stationId = Number(stationId);

  const [kots, total] = await Promise.all([
    prisma.kitchenOrderTicket.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { items: true, station: true },
    }),
    prisma.kitchenOrderTicket.count({ where }),
  ]);

  const allKots = await prisma.kitchenOrderTicket.findMany({
    where: { restaurantId: rid, createdAt: { gte: start, lte: end } },
    select: { status: true, stationName: true },
  });

  const statusSummary = { total: allKots.length, pending: 0, preparing: 0, ready: 0, served: 0, cancelled: 0 };
  const stationSummary = {};

  for (const k of allKots) {
    const s = String(k.status || "").toLowerCase();
    if (s.includes("pending")) statusSummary.pending += 1;
    else if (s.includes("preparing")) statusSummary.preparing += 1;
    else if (s.includes("ready")) statusSummary.ready += 1;
    else if (s.includes("served")) statusSummary.served += 1;
    else if (s.includes("cancelled")) statusSummary.cancelled += 1;

    const stName = k.stationName || "Main Kitchen";
    stationSummary[stName] = (stationSummary[stName] || 0) + 1;
  }

  return {
    summary: statusSummary,
    stationSummary,
    kots,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * 7. CANCELLED ORDER / BILL REPORT
 */
export const getCancellationReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    createdAt: { gte: start, lte: end },
    status: "CANCELLED",
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        statusEvents: { where: { status: "CANCELLED" } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalCancelledAmount = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const formattedOrders = orders.map((o) => {
    const event = o.statusEvents?.[0] || {};
    return {
      id: o.id,
      orderNo: o.orderNo,
      tableNo: o.tableNo || "N/A",
      customerName: o.customerName || "Guest",
      cancelledAmount: o.total,
      reason: event.notes || o.notes || "Order cancelled by staff",
      cancelledBy: event.changedByName || o.createdByRole || "Staff",
      cancelledAt: event.createdAt || o.updatedAt,
      paymentStatus: o.paymentStatus,
      itemsCount: (o.items || []).length,
    };
  });

  return {
    summary: {
      totalCancelledOrders: total,
      totalCancelledAmount: round2(totalCancelledAmount),
    },
    cancellations: formattedOrders,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * 8. PAYMENT & SPLIT PAYMENT REPORT
 */
export const getPaymentReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    createdAt: { gte: start, lte: end },
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { order: { select: { orderNo: true, tableNo: true } } },
    }),
    prisma.payment.count({ where }),
  ]);

  const allPayments = await prisma.payment.findMany({
    where,
    select: { amount: true, paymentMethod: true, method: true, status: true },
  });

  const methodSummary = { cash: 0, upi: 0, card: 0, cashfree: 0, payLater: 0, other: 0 };
  let totalCollected = 0;
  let totalRefunded = 0;

  for (const p of allPayments) {
    const amt = Number(p.amount || 0);
    if (p.status === "REFUNDED") {
      totalRefunded += amt;
      continue;
    }
    if (p.status !== "SUCCESS" && p.status !== "PAID") continue;

    totalCollected += amt;
    const m = String(p.paymentMethod || p.method || "CASH").toUpperCase();
    if (m.includes("CASH")) methodSummary.cash = round2(methodSummary.cash + amt);
    else if (m.includes("UPI")) methodSummary.upi = round2(methodSummary.upi + amt);
    else if (m.includes("CARD")) methodSummary.card = round2(methodSummary.card + amt);
    else if (m.includes("CASHFREE") || m.includes("ONLINE")) methodSummary.cashfree = round2(methodSummary.cashfree + amt);
    else if (m.includes("PAY_LATER")) methodSummary.payLater = round2(methodSummary.payLater + amt);
    else methodSummary.other = round2(methodSummary.other + amt);
  }

  return {
    summary: {
      totalCollected: round2(totalCollected),
      totalRefunded: round2(totalRefunded),
      netCollected: round2(totalCollected - totalRefunded),
      methodSummary,
    },
    payments,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * 9. DISCOUNT REPORT
 */
export const getDiscountReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    createdAt: { gte: start, lte: end },
    discountAmount: { gt: 0 },
    status: { not: "CANCELLED" },
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ]);

  const totalDiscountAmount = orders.reduce((sum, o) => sum + Number(o.discountAmount || 0), 0);
  const avgDiscountPerOrder = total > 0 ? round2(totalDiscountAmount / total) : 0;

  return {
    summary: {
      totalDiscountedOrders: total,
      totalDiscountAmount: round2(totalDiscountAmount),
      avgDiscountPerOrder,
    },
    orders,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * 10. TABLE / DINE-IN REPORT
 */
export const getTableReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    openedAt: { gte: start, lte: end },
  };

  const [sessions, total] = await Promise.all([
    prisma.tableSession.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { openedAt: "desc" },
    }),
    prisma.tableSession.count({ where }),
  ]);

  let totalGuests = 0;
  let totalGrossSales = 0;
  let totalDurationMinutes = 0;

  const formattedSessions = sessions.map((s) => {
    const guests = Number(s.guestCount || 1);
    const totalAmt = Number(s.total || 0);

    totalGuests += guests;
    totalGrossSales += totalAmt;

    let duration = 0;
    if (s.closedAt && s.openedAt) {
      duration = Math.max(0, Math.round((new Date(s.closedAt) - new Date(s.openedAt)) / (1000 * 60)));
      totalDurationMinutes += duration;
    }

    return {
      id: s.id,
      tableNo: s.tableNo,
      waiterName: s.waiterName || "Unassigned",
      guestCount: guests,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      durationMinutes: duration,
      total: totalAmt,
    };
  });

  const avgSessionDuration = total > 0 ? Math.round(totalDurationMinutes / total) : 0;
  const avgBillPerSession = total > 0 ? round2(totalGrossSales / total) : 0;

  return {
    summary: {
      totalSessions: total,
      totalGuests,
      totalGrossSales: round2(totalGrossSales),
      avgBillPerSession,
      avgSessionDurationMinutes: avgSessionDuration,
    },
    sessions: formattedSessions,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * 11. SHIFT / DAY CLOSING REPORT
 */
export const getShiftReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    openedAt: { gte: start, lte: end },
  };

  const [shifts, total] = await Promise.all([
    prisma.cashierShift.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { openedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, role: true } },
        closedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.cashierShift.count({ where }),
  ]);

  let totalOpening = 0;
  let totalExpected = 0;
  let totalActual = 0;
  let totalVariance = 0;

  for (const s of shifts) {
    totalOpening += Number(s.openingCash || 0);
    totalExpected += Number(s.expectedCash || 0);
    totalActual += Number(s.actualCash || 0);
    totalVariance += Number(s.variance || 0);
  }

  return {
    summary: {
      totalShifts: total,
      totalOpeningCash: round2(totalOpening),
      totalExpectedCash: round2(totalExpected),
      totalActualCash: round2(totalActual),
      totalVariance: round2(totalVariance),
    },
    shifts,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * 12. INVENTORY CONSUMPTION REPORT
 */
export const getInventoryConsumptionReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const rawMaterials = await prisma.rawMaterial.findMany({
    where: { restaurantId: rid },
    include: {
      movements: {
        where: { createdAt: { gte: start, lte: end } },
      },
    },
  });

  const consumptionList = rawMaterials.map((rm) => {
    let purchases = 0;
    let orderConsumption = 0;
    let wastage = 0;
    let adjustments = 0;

    for (const m of rm.movements || []) {
      const q = Math.abs(Number(m.quantity || 0));
      if (m.movementType === "PURCHASE") purchases += q;
      else if (m.movementType === "SALE") orderConsumption += q;
      else if (m.movementType === "WASTAGE") wastage += q;
      else if (m.movementType === "ADJUSTMENT_IN") adjustments += q;
      else if (m.movementType === "ADJUSTMENT_OUT") adjustments -= q;
    }

    return {
      id: rm.id,
      name: rm.name,
      baseUnit: rm.baseUnit,
      currentStock: rm.currentStock,
      minimumStock: rm.minimumStock,
      purchases,
      orderConsumption,
      wastage,
      adjustments,
    };
  }).sort((a, b) => b.orderConsumption - a.orderConsumption);

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const paginatedList = consumptionList.slice(skip, skip + Number(limit));

  return {
    summary: {
      totalRawMaterials: rawMaterials.length,
    },
    materials: paginatedList,
    pagination: { page: Number(page), limit: Number(limit), total: rawMaterials.length, totalPages: Math.ceil(rawMaterials.length / limit) },
  };
};

/**
 * 13. WASTAGE REPORT
 */
export const getWastageReport = async ({ prisma, restaurantId, startDate, endDate, page = 1, limit = 50 }) => {
  const rid = Number(restaurantId);
  const { start, end } = parseReportDateRange(startDate, endDate);

  const where = {
    restaurantId: rid,
    movementType: "WASTAGE",
    createdAt: { gte: start, lte: end },
  };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip: (Math.max(1, Number(page)) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { rawMaterial: { select: { name: true, baseUnit: true } } },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  const totalWastageCost = movements.reduce((sum, m) => sum + Number(m.totalCost || 0), 0);

  const formattedWastage = movements.map((m) => ({
    id: m.id,
    rawMaterialName: m.rawMaterial?.name || "Raw Material",
    baseUnit: m.rawMaterial?.baseUnit || "pcs",
    quantity: Math.abs(Number(m.quantity || 0)),
    unitCost: m.unitCost,
    totalCost: m.totalCost,
    reason: m.notes || "Wastage reported",
    performedByName: m.performedByName || "Staff",
    createdAt: m.createdAt,
  }));

  return {
    summary: {
      totalWastageEvents: total,
      totalWastageCost: round2(totalWastageCost),
    },
    wastage: formattedWastage,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
  };
};
