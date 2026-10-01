import { normalizePhone, isValidPhone } from "./phoneService.js";
import {
  resolveDateRange,
  isQualifyingOrder,
  getDistinctVisitDates,
  calculateAvgVisitInterval,
  classifyCustomerSegment,
  matchesSegmentFilter,
  calculateCrmSummary,
} from "./customerAnalyticsService.js";

const normalizeEmail = (email) => {
  if (!email) return null;
  const trimmed = String(email).trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
};

export const getCustomerStats = async ({ prisma, restaurantId, customerId }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);

  if (!rId || !cId) {
    return {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      cancelledOrders: 0,
      totalRefunded: 0,
      distinctVisits: 0,
      avgVisitIntervalDays: null,
      segment: "NO_ORDERS",
      isRepeat: false,
    };
  }

  const [restaurant, orders, payments] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: rId },
      select: { timezone: true },
    }),
    prisma.order.findMany({
      where: { restaurantId: rId, customerId: cId },
      select: {
        id: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        order: { restaurantId: rId, customerId: cId },
        status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
      },
      select: { amount: true },
    }),
  ]);

  const timezone = restaurant?.timezone || "Asia/Kolkata";
  const validOrders = orders.filter((o) => isQualifyingOrder(o));
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
  const totalRefunded = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const grossSpent = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalSpent = Math.max(0, Number((grossSpent - totalRefunded).toFixed(2)));
  const totalOrders = validOrders.length;
  const averageOrderValue = totalOrders > 0 ? Number((totalSpent / totalOrders).toFixed(2)) : 0;
  const firstOrderAt = validOrders.length > 0 ? validOrders[0].createdAt : null;
  const lastOrderAt = validOrders.length > 0 ? validOrders[validOrders.length - 1].createdAt : null;

  const distinctVisitDates = getDistinctVisitDates(validOrders, timezone);
  const distinctVisits = distinctVisitDates.length;
  const avgVisitIntervalDays = calculateAvgVisitInterval(distinctVisitDates);

  const segment = classifyCustomerSegment({
    lifetimeOrders: totalOrders,
    lifetimeSpend: totalSpent,
    lastOrderAt,
    firstOrderAt,
  });

  return {
    totalOrders,
    totalSpent,
    averageOrderValue,
    firstOrderAt,
    lastOrderAt,
    cancelledOrders,
    totalRefunded,
    distinctVisits,
    avgVisitIntervalDays,
    segment,
    isRepeat: totalOrders >= 2,
  };
};

export const searchCustomers = async ({
  prisma,
  restaurantId,
  query = "",
  page = 1,
  limit = 20,
  status = "ACTIVE",
  sortBy = "createdAt",
  sortOrder = "desc",
  range = "all",
  startDate,
  endDate,
  segment = "ALL",
  minOrders,
  maxOrders,
  minSpend,
  maxSpend,
  frequentThreshold = 5,
  highSpendThreshold = 5000,
}) => {
  const rId = Number(restaurantId);
  if (!rId) throw new Error("Invalid restaurant ID");

  const p = Math.max(1, Number(page || 1));
  const l = Math.min(100, Math.max(1, Number(limit || 20)));
  const skip = (p - 1) * l;

  // 1. Fetch restaurant info for timezone
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rId },
    select: { timezone: true },
  });
  const timezone = restaurant?.timezone || "Asia/Kolkata";

  // 2. Resolve date range
  const dateRange = resolveDateRange({ range, startDate, endDate, timezone });
  const hasDateFilter = Boolean(dateRange.start && dateRange.end);

  // 3. Build customer base WHERE clause
  const whereClause = {
    restaurantId: rId,
  };

  if (status && status !== "ALL") {
    whereClause.status = String(status).toUpperCase();
  }

  const q = String(query || "").trim();
  if (q) {
    const qNum = Number(q);
    const isIdSearch = Number.isInteger(qNum) && qNum > 0 && qNum <= 2147483647;

    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      ...(isIdSearch ? [{ id: qNum }] : []),
    ];
  }

  // 4. Fetch all matching customers for this restaurant with their orders & refunds
  // Single round-trip without N+1 queries, selecting only essential aggregate fields
  const customers = await prisma.customer.findMany({
    where: whereClause,
    select: {
      id: true,
      restaurantId: true,
      name: true,
      phone: true,
      email: true,
      status: true,
      notes: true,
      tags: true,
      rewardPoints: true,
      createdAt: true,
      updatedAt: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          payments: {
            where: { status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] } },
            select: { amount: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          orders: true,
          reservations: true,
          addresses: true,
        },
      },
    },
  });

  // Thresholds configuration
  const thresholds = {
    frequentThreshold: Number(frequentThreshold || 5),
    highSpendThreshold: Number(highSpendThreshold || 5000),
    recentlyInactiveDays: 30,
    longTermInactiveDays: 90,
    reactivationGapDays: 60,
  };

  // 5. Enrich each customer with metrics
  const enrichedCustomers = customers.map((c) => {
    const allValidOrders = (c.orders || []).filter((o) => isQualifyingOrder(o));
    const lifetimeOrders = allValidOrders.length;

    // Refund calculations
    let totalRefunds = 0;
    for (const o of allValidOrders) {
      if (Array.isArray(o.payments)) {
        for (const pmt of o.payments) {
          totalRefunds += Number(pmt.amount || 0);
        }
      }
    }

    const grossLifetimeSpend = allValidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const lifetimeSpent = Math.max(0, Number((grossLifetimeSpend - totalRefunds).toFixed(2)));

    const firstOrderAt = allValidOrders.length > 0 ? allValidOrders[0].createdAt : null;
    const lastOrderAt = allValidOrders.length > 0 ? allValidOrders[allValidOrders.length - 1].createdAt : null;

    // Distinct visit calculations
    const lifetimeDistinctVisitDates = getDistinctVisitDates(allValidOrders, timezone);
    const distinctVisits = lifetimeDistinctVisitDates.length;
    const avgVisitIntervalDays = calculateAvgVisitInterval(lifetimeDistinctVisitDates);

    const averageOrderValue = lifetimeOrders > 0
      ? Number((lifetimeSpent / lifetimeOrders).toFixed(2))
      : 0;

    // Period-specific metrics
    let periodOrders = lifetimeOrders;
    let periodSpent = lifetimeSpent;
    let periodVisits = distinctVisits;
    let prevOrderBeforePeriodAt = null;

    if (hasDateFilter) {
      const pOrders = allValidOrders.filter((o) => {
        const orderTime = new Date(o.createdAt).getTime();
        return orderTime >= dateRange.start.getTime() && orderTime <= dateRange.end.getTime();
      });

      const priorOrders = allValidOrders.filter((o) => {
        return new Date(o.createdAt).getTime() < dateRange.start.getTime();
      });

      if (priorOrders.length > 0) {
        prevOrderBeforePeriodAt = priorOrders[priorOrders.length - 1].createdAt;
      }

      periodOrders = pOrders.length;
      const grossPeriodSpend = pOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      periodSpent = Math.max(0, Number(grossPeriodSpend.toFixed(2)));
      periodVisits = getDistinctVisitDates(pOrders, timezone).length;
    }

    const customerSegment = classifyCustomerSegment({
      lifetimeOrders,
      lifetimeSpend: lifetimeSpent,
      lastOrderAt,
      periodOrders,
      firstOrderAt,
      prevOrderBeforePeriodAt,
      thresholds,
    });

    const { orders, ...rest } = c;
    return {
      ...rest,
      totalOrders: lifetimeOrders,
      totalSpent: lifetimeSpent,
      periodOrders,
      periodSpent,
      distinctVisits,
      periodVisits,
      firstOrderAt,
      lastOrderAt,
      avgVisitIntervalDays,
      averageOrderValue,
      segment: customerSegment,
      isRepeat: lifetimeOrders >= 2,
    };
  });

  // 6. Apply Segment & Numerical Threshold Filters
  let filtered = enrichedCustomers;

  if (segment && segment !== "ALL") {
    filtered = filtered.filter((c) =>
      matchesSegmentFilter(
        c.segment,
        segment,
        { lifetimeOrders: c.totalOrders, lifetimeSpend: c.totalSpent, lastOrderAt: c.lastOrderAt },
        thresholds
      )
    );
  }

  if (minOrders !== undefined && minOrders !== "") {
    const minO = Number(minOrders);
    if (!isNaN(minO)) {
      filtered = filtered.filter((c) => (hasDateFilter ? c.periodOrders : c.totalOrders) >= minO);
    }
  }

  if (maxOrders !== undefined && maxOrders !== "") {
    const maxO = Number(maxOrders);
    if (!isNaN(maxO)) {
      filtered = filtered.filter((c) => (hasDateFilter ? c.periodOrders : c.totalOrders) <= maxO);
    }
  }

  if (minSpend !== undefined && minSpend !== "") {
    const minS = Number(minSpend);
    if (!isNaN(minS)) {
      filtered = filtered.filter((c) => (hasDateFilter ? c.periodSpent : c.totalSpent) >= minS);
    }
  }

  if (maxSpend !== undefined && maxSpend !== "") {
    const maxS = Number(maxSpend);
    if (!isNaN(maxS)) {
      filtered = filtered.filter((c) => (hasDateFilter ? c.periodSpent : c.totalSpent) <= maxS);
    }
  }

  // 7. Calculate Global Summary KPIs across all filtered customers
  const summary = calculateCrmSummary({
    customers: filtered,
    dateRange,
  });

  // 8. Global Database-Consistent Sorting across the entire dataset
  const sortDir = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return sortDir * (a.name || "").localeCompare(b.name || "");
      case "orderCount":
      case "totalOrders":
        return sortDir * (a.totalOrders - b.totalOrders);
      case "periodOrders":
        return sortDir * (a.periodOrders - b.periodOrders);
      case "totalSpend":
      case "totalSpent":
        return sortDir * (a.totalSpent - b.totalSpent);
      case "periodSpent":
        return sortDir * (a.periodSpent - b.periodSpent);
      case "lastOrderDate":
      case "lastOrderAt": {
        const tA = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        const tB = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        return sortDir * (tA - tB);
      }
      case "firstOrderDate":
      case "firstOrderAt": {
        const tA = a.firstOrderAt ? new Date(a.firstOrderAt).getTime() : 0;
        const tB = b.firstOrderAt ? new Date(b.firstOrderAt).getTime() : 0;
        return sortDir * (tA - tB);
      }
      case "averageOrderValue":
      case "avgOrderValue":
        return sortDir * (a.averageOrderValue - b.averageOrderValue);
      case "visitInterval":
      case "avgVisitIntervalDays": {
        const vA = a.avgVisitIntervalDays !== null && a.avgVisitIntervalDays !== undefined ? a.avgVisitIntervalDays : Infinity;
        const vB = b.avgVisitIntervalDays !== null && b.avgVisitIntervalDays !== undefined ? b.avgVisitIntervalDays : Infinity;
        return sortDir * (vA - vB);
      }
      case "updatedAt": {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return sortDir * (tA - tB);
      }
      default: // createdAt
        return sortDir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  });

  // 9. Paginate the globally sorted records
  const totalCount = filtered.length;
  const paginatedItems = filtered.slice(skip, skip + l);

  return {
    items: paginatedItems,
    summary,
    pagination: {
      total: totalCount,
      page: p,
      limit: l,
      totalPages: Math.ceil(totalCount / l) || 1,
    },
    filterMeta: {
      range,
      rangeLabel: dateRange.label,
      startDate: dateRange.start ? dateRange.start.toISOString() : null,
      endDate: dateRange.end ? dateRange.end.toISOString() : null,
      segment,
      timezone,
    },
  };
};

export const getCustomerDirectorySummary = async ({
  prisma,
  restaurantId,
  range = "all",
  startDate,
  endDate,
  frequentThreshold = 5,
  highSpendThreshold = 5000,
}) => {
  const result = await searchCustomers({
    prisma,
    restaurantId,
    range,
    startDate,
    endDate,
    page: 1,
    limit: 1, // Summary is computed over all matching records
    status: "ALL",
    frequentThreshold,
    highSpendThreshold,
  });
  return result.summary;
};

export const exportCustomerDirectory = async ({
  prisma,
  restaurantId,
  query = "",
  status = "ACTIVE",
  sortBy = "createdAt",
  sortOrder = "desc",
  range = "all",
  startDate,
  endDate,
  segment = "ALL",
  minOrders,
  maxOrders,
  minSpend,
  maxSpend,
  frequentThreshold = 5,
  highSpendThreshold = 5000,
}) => {
  const result = await searchCustomers({
    prisma,
    restaurantId,
    query,
    page: 1,
    limit: 10000, // Export up to 10k records
    status,
    sortBy,
    sortOrder,
    range,
    startDate,
    endDate,
    segment,
    minOrders,
    maxOrders,
    minSpend,
    maxSpend,
    frequentThreshold,
    highSpendThreshold,
  });

  const headers = [
    "Customer ID",
    "Name",
    "Phone",
    "Email",
    "Status",
    "Segment",
    "Lifetime Orders",
    "Lifetime Spend (INR)",
    "Period Orders",
    "Period Spend (INR)",
    "First Order Date",
    "Last Visit Date",
    "Avg Visit Interval (Days)",
    "Avg Order Value (INR)",
    "Repeat Customer",
    "Joined Date",
  ];

  const rows = result.items.map((c) => [
    c.id,
    c.name || "Guest Customer",
    c.phone,
    c.email || "",
    c.status,
    c.segment,
    c.totalOrders,
    c.totalSpent,
    c.periodOrders,
    c.periodSpent,
    c.firstOrderAt ? new Date(c.firstOrderAt).toISOString().split("T")[0] : "",
    c.lastOrderAt ? new Date(c.lastOrderAt).toISOString().split("T")[0] : "",
    c.avgVisitIntervalDays !== null && c.avgVisitIntervalDays !== undefined ? c.avgVisitIntervalDays : "N/A",
    c.averageOrderValue,
    c.isRepeat ? "Yes" : "No",
    c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : "",
  ]);

  return {
    headers,
    rows,
    summary: result.summary,
    totalRecords: result.items.length,
    rangeLabel: result.filterMeta?.rangeLabel || "All Time",
  };
};

export const getCustomerById = async ({ prisma, restaurantId, customerId }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  if (!rId || !cId) return null;

  const customer = await prisma.customer.findFirst({
    where: { id: cId, restaurantId: rId },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      },
      orders: {
        include: {
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      reservations: {
        orderBy: { reservationDate: "desc" },
        take: 30,
      },
      payLaterAccounts: {
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
      customerNotifications: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!customer) return null;

  const stats = await getCustomerStats({ prisma, restaurantId: rId, customerId: cId });

  // Fetch payment records for customer orders
  const orderIds = customer.orders.map((o) => o.id);
  const rawPayments = orderIds.length
    ? await prisma.payment.findMany({
        where: { orderId: { in: orderIds } },
        select: {
          id: true,
          orderId: true,
          amount: true,
          paymentMethod: true,
          status: true,
          transactionId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const payments = rawPayments.map((p) => ({
    ...p,
    paymentMode: p.paymentMethod || "CASH",
  }));

  // Build factual activity timeline
  const activity = [];
  activity.push({
    id: `create-${customer.id}`,
    type: "CUSTOMER_CREATED",
    title: "Customer Registered",
    description: `Customer profile created`,
    timestamp: customer.createdAt,
  });

  for (const o of customer.orders) {
    activity.push({
      id: `order-${o.id}`,
      type: "ORDER_PLACED",
      title: `Order #${o.orderNo}`,
      description: `Placed ${o.orderSource || "POS"} order for ₹${o.total} (${o.status})`,
      timestamp: o.createdAt,
    });
  }

  for (const r of customer.reservations) {
    activity.push({
      id: `res-${r.id}`,
      type: "RESERVATION_CREATED",
      title: `Reservation #${r.reservationNo}`,
      description: `Booked table for ${r.guestCount} guests on ${new Date(r.reservationDate).toLocaleDateString()} (${r.status})`,
      timestamp: r.reservationDate,
    });
  }

  for (const a of customer.addresses) {
    activity.push({
      id: `addr-${a.id}`,
      type: "ADDRESS_ADDED",
      title: `Saved Address (${a.label})`,
      description: `${a.line1}, ${a.city || ""}`,
      timestamp: a.createdAt,
    });
  }

  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    ...customer,
    stats,
    payments,
    activity,
  };
};

export const createCustomer = async ({ prisma, restaurantId, input, userId }) => {
  const rId = Number(restaurantId);
  if (!rId) return { ok: false, status: 400, message: "Invalid restaurant ID" };

  const rawPhone = String(input.phone || "").trim();
  const normalizedPhone = normalizePhone(rawPhone);

  if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
    return { ok: false, status: 400, message: "Valid phone number is required" };
  }

  const name = String(input.name || "").trim() || null;
  const email = normalizeEmail(input.email);
  const notes = input.notes ? String(input.notes).trim() : null;
  const tags = input.tags ? String(input.tags).trim() : null;
  const status = String(input.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  const gender = input.gender ? String(input.gender).trim() : null;

  // Check duplicate phone within restaurant
  const existingPhone = await prisma.customer.findUnique({
    where: {
      restaurantId_phone: {
        restaurantId: rId,
        phone: normalizedPhone,
      },
    },
  });

  if (existingPhone) {
    return {
      ok: false,
      status: 409,
      duplicate: true,
      existingCustomer: existingPhone,
      message: "Customer with this phone number already exists in this restaurant.",
    };
  }

  // Secondary duplicate check by email if supplied
  if (email) {
    const existingEmail = await prisma.customer.findFirst({
      where: {
        restaurantId: rId,
        email: { equals: email, mode: "insensitive" },
      },
    });

    if (existingEmail) {
      return {
        ok: false,
        status: 409,
        duplicate: true,
        existingCustomer: existingEmail,
        message: "Customer with this email address already exists in this restaurant.",
      };
    }
  }

  const customer = await prisma.customer.create({
    data: {
      restaurantId: rId,
      name,
      phone: normalizedPhone,
      email,
      notes,
      tags,
      status,
      dateOfBirth,
      gender,
    },
  });

  // Log table/operation log for audit
  try {
    if (prisma.tableOperationLog) {
      await prisma.tableOperationLog.create({
        data: {
          restaurantId: rId,
          operationType: "CUSTOMER_CREATED",
          performedByUserId: Number(userId) || null,
          details: { customerId: customer.id, name: customer.name, phone: customer.phone },
        },
      }).catch(() => {});
    }
  } catch (_) {}

  return { ok: true, customer };
};

export const updateCustomer = async ({ prisma, restaurantId, customerId, input, userId }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  if (!rId || !cId) return { ok: false, status: 400, message: "Invalid parameters" };

  const existing = await prisma.customer.findFirst({
    where: { id: cId, restaurantId: rId },
  });

  if (!existing) return { ok: false, status: 404, message: "Customer not found" };

  const patch = input && typeof input === "object" ? input : {};
  const updateData = {};

  if (patch.name !== undefined) {
    updateData.name = patch.name ? String(patch.name).trim() : null;
  }

  if (patch.phone !== undefined) {
    const normPhone = normalizePhone(patch.phone);
    if (!normPhone || !isValidPhone(normPhone)) {
      return { ok: false, status: 400, message: "Invalid phone number format" };
    }
    if (normPhone !== existing.phone) {
      const conflict = await prisma.customer.findUnique({
        where: {
          restaurantId_phone: {
            restaurantId: rId,
            phone: normPhone,
          },
        },
      });
      if (conflict) {
        return { ok: false, status: 409, message: "Another customer already has this phone number." };
      }
      updateData.phone = normPhone;
    }
  }

  if (patch.email !== undefined) {
    const normEmail = normalizeEmail(patch.email);
    if (normEmail && normEmail !== existing.email) {
      const conflict = await prisma.customer.findFirst({
        where: {
          restaurantId: rId,
          email: { equals: normEmail, mode: "insensitive" },
          id: { not: cId },
        },
      });
      if (conflict) {
        return { ok: false, status: 409, message: "Another customer already has this email address." };
      }
    }
    updateData.email = normEmail;
  }

  if (patch.notes !== undefined) {
    updateData.notes = patch.notes ? String(patch.notes).trim() : null;
  }

  if (patch.tags !== undefined) {
    updateData.tags = patch.tags ? String(patch.tags).trim() : null;
  }

  if (patch.status !== undefined) {
    updateData.status = String(patch.status).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  }

  if (patch.dateOfBirth !== undefined) {
    updateData.dateOfBirth = patch.dateOfBirth ? new Date(patch.dateOfBirth) : null;
  }

  if (patch.gender !== undefined) {
    updateData.gender = patch.gender ? String(patch.gender).trim() : null;
  }

  const updatedCustomer = await prisma.customer.update({
    where: { id: cId },
    data: updateData,
  });

  // Audit Log
  try {
    if (prisma.tableOperationLog) {
      await prisma.tableOperationLog.create({
        data: {
          restaurantId: rId,
          operationType: "CUSTOMER_UPDATED",
          performedByUserId: Number(userId) || null,
          details: { customerId: cId, changes: Object.keys(updateData) },
        },
      }).catch(() => {});
    }
  } catch (_) {}

  return { ok: true, customer: updatedCustomer };
};

export const mergeCustomers = async ({
  prisma,
  restaurantId,
  sourceCustomerId,
  targetCustomerId,
  userId,
  userRole,
}) => {
  const rId = Number(restaurantId);
  const sId = Number(sourceCustomerId);
  const tId = Number(targetCustomerId);

  if (!rId || !sId || !tId) {
    return { ok: false, status: 400, message: "Missing or invalid customer IDs" };
  }

  if (sId === tId) {
    return { ok: false, status: 400, message: "Source and target customers must be different" };
  }

  const [sourceCustomer, targetCustomer] = await Promise.all([
    prisma.customer.findFirst({ where: { id: sId, restaurantId: rId } }),
    prisma.customer.findFirst({ where: { id: tId, restaurantId: rId } }),
  ]);

  if (!sourceCustomer || !targetCustomer) {
    return { ok: false, status: 404, message: "Source or target customer not found in this restaurant" };
  }

  // Perform transactional merge
  const result = await prisma.$transaction(async (tx) => {
    // 1. Move Orders
    const ordersReassigned = await tx.order.updateMany({
      where: { customerId: sId, restaurantId: rId },
      data: { customerId: tId },
    });

    // 2. Move Reservations
    const reservationsReassigned = await tx.reservation.updateMany({
      where: { customerId: sId, restaurantId: rId },
      data: { customerId: tId },
    });

    // 3. Move CustomerAddresses
    const addressesReassigned = await tx.customerAddress.updateMany({
      where: { customerId: sId },
      data: { customerId: tId, isDefault: false },
    });

    // 4. Move PayLater Accounts & Transactions
    const payLaterAccReassigned = await tx.payLaterAccount.updateMany({
      where: { customerId: sId, restaurantId: rId },
      data: { customerId: tId },
    });

    const payLaterTxReassigned = await tx.payLaterTransaction.updateMany({
      where: { customerId: sId, restaurantId: rId },
      data: { customerId: tId },
    });

    // 5. Move Customer Notifications
    const notifsReassigned = await tx.customerNotification.updateMany({
      where: { customerId: sId, restaurantId: rId },
      data: { customerId: tId },
    });

    // 6. Inherit notes / tags / email if target missing
    const updateTarget = {};
    if (!targetCustomer.email && sourceCustomer.email) updateTarget.email = sourceCustomer.email;
    if (!targetCustomer.notes && sourceCustomer.notes) updateTarget.notes = sourceCustomer.notes;
    else if (sourceCustomer.notes && targetCustomer.notes) {
      updateTarget.notes = `${targetCustomer.notes}\n[Merged Note]: ${sourceCustomer.notes}`;
    }
    if (!targetCustomer.tags && sourceCustomer.tags) updateTarget.tags = sourceCustomer.tags;

    if (Object.keys(updateTarget).length > 0) {
      await tx.customer.update({
        where: { id: tId },
        data: updateTarget,
      });
    }

    // 7. Soft-delete/Archive Source Customer
    const archivedSource = await tx.customer.update({
      where: { id: sId },
      data: {
        status: "INACTIVE",
        notes: `[MERGED INTO CUSTOMER #${tId} (${targetCustomer.name || targetCustomer.phone})] ${sourceCustomer.notes || ""}`.trim(),
      },
    });

    // 8. Log Audit Record
    try {
      if (tx.tableOperationLog) {
        await tx.tableOperationLog.create({
          data: {
            restaurantId: rId,
            operationType: "CUSTOMER_MERGED",
            performedByUserId: Number(userId) || null,
            details: {
              sourceCustomerId: sId,
              sourcePhone: sourceCustomer.phone,
              targetCustomerId: tId,
              targetPhone: targetCustomer.phone,
              ordersMoved: ordersReassigned.count,
              reservationsMoved: reservationsReassigned.count,
              addressesMoved: addressesReassigned.count,
              timestamp: new Date(),
            },
          },
        }).catch(() => {});
      }
    } catch (_) {}

    return {
      merged: true,
      sourceCustomerId: sId,
      targetCustomerId: tId,
      ordersMoved: ordersReassigned.count,
      reservationsMoved: reservationsReassigned.count,
      addressesMoved: addressesReassigned.count,
    };
  });

  return { ok: true, result };
};

export const listCustomerAddresses = async ({ prisma, restaurantId, customerId }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  if (!rId || !cId) return [];

  return prisma.customerAddress.findMany({
    where: {
      customerId: cId,
      customer: { restaurantId: rId },
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
};

export const addCustomerAddress = async ({ prisma, restaurantId, customerId, input }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  if (!rId || !cId) return { ok: false, status: 400, message: "Invalid customer or restaurant ID" };

  const customer = await prisma.customer.findFirst({
    where: { id: cId, restaurantId: rId },
  });
  if (!customer) return { ok: false, status: 404, message: "Customer not found" };

  const patch = input && typeof input === "object" ? input : {};
  const label = String(patch.label || "Home").trim() || "Home";
  const line1 = String(patch.line1 || patch.addressLine1 || "").trim();
  const line2 = patch.line2 || patch.addressLine2 ? String(patch.line2 || patch.addressLine2).trim() : null;
  const city = patch.city ? String(patch.city).trim() : null;
  const state = patch.state || patch.mandal ? String(patch.state || patch.mandal).trim() : null;
  const postalCode = patch.postalCode || patch.pincode ? String(patch.postalCode || patch.pincode).trim() : null;
  const name = patch.recipientName || patch.name ? String(patch.recipientName || patch.name).trim() : customer.name;
  const phone = patch.phone ? String(patch.phone).trim() : customer.phone;
  const notes = patch.notes ? String(patch.notes).trim() : null;
  const isDefault = Boolean(patch.isDefault);

  if (!line1) return { ok: false, status: 400, message: "Address line 1 is required" };

  const existingCount = await prisma.customerAddress.count({ where: { customerId: cId } });

  if (isDefault || existingCount === 0) {
    await prisma.customerAddress.updateMany({
      where: { customerId: cId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.create({
    data: {
      customerId: cId,
      label,
      name,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      notes,
      isDefault: isDefault || existingCount === 0,
    },
  });

  return { ok: true, address };
};

export const updateCustomerAddress = async ({ prisma, restaurantId, customerId, addressId, input }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  const aId = Number(addressId);
  if (!rId || !cId || !aId) return { ok: false, status: 400, message: "Invalid parameters" };

  const existing = await prisma.customerAddress.findFirst({
    where: { id: aId, customerId: cId, customer: { restaurantId: rId } },
  });
  if (!existing) return { ok: false, status: 404, message: "Address not found" };

  const patch = input && typeof input === "object" ? input : {};
  const isDefault = patch.isDefault !== undefined ? Boolean(patch.isDefault) : existing.isDefault;

  if (isDefault && !existing.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId: cId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.update({
    where: { id: aId },
    data: {
      label: patch.label !== undefined ? String(patch.label).trim() : existing.label,
      name: patch.name !== undefined ? (patch.name ? String(patch.name).trim() : null) : existing.name,
      phone: patch.phone !== undefined ? (patch.phone ? String(patch.phone).trim() : null) : existing.phone,
      line1: patch.line1 !== undefined ? String(patch.line1).trim() : existing.line1,
      line2: patch.line2 !== undefined ? (patch.line2 ? String(patch.line2).trim() : null) : existing.line2,
      city: patch.city !== undefined ? (patch.city ? String(patch.city).trim() : null) : existing.city,
      state: patch.state !== undefined ? (patch.state ? String(patch.state).trim() : null) : existing.state,
      postalCode: patch.postalCode !== undefined ? (patch.postalCode ? String(patch.postalCode).trim() : null) : existing.postalCode,
      notes: patch.notes !== undefined ? (patch.notes ? String(patch.notes).trim() : null) : existing.notes,
      isDefault,
    },
  });

  return { ok: true, address };
};

export const deleteCustomerAddress = async ({ prisma, restaurantId, customerId, addressId }) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  const aId = Number(addressId);
  if (!rId || !cId || !aId) return { ok: false, status: 400, message: "Invalid parameters" };

  const existing = await prisma.customerAddress.findFirst({
    where: { id: aId, customerId: cId, customer: { restaurantId: rId } },
    select: { id: true, isDefault: true },
  });
  if (!existing) return { ok: false, status: 404, message: "Address not found" };

  await prisma.customerAddress.delete({ where: { id: aId } });

  if (existing.isDefault) {
    const nextDefault = await prisma.customerAddress.findFirst({
      where: { customerId: cId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (nextDefault) {
      await prisma.customerAddress.update({
        where: { id: nextDefault.id },
        data: { isDefault: true },
      });
    }
  }

  return { ok: true };
};
