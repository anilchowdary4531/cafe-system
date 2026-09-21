import { createOrderByStaff } from "./orderService.js";
import { computeBill, toPriceSubunitItems } from "./billingService.js";

const ACTIVE_STATUSES = ["OPEN", "BILLING", "PAID"];

export const getMinutesElapsed = (openedAt) => {
  if (!openedAt) return 0;
  const t = new Date(openedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
};

export const getOrCreateActiveSession = async ({
  prisma,
  restaurantId,
  tableId,
  waiterId = null,
  waiterName = null,
  guestCount = 1,
} = {}) => {
  const rid = Number(restaurantId);
  const tid = Number(tableId);

  if (!rid || !tid) {
    const err = new Error("restaurantId and tableId are required");
    err.code = "invalid_input";
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findUnique({
      where: { id: tid },
      select: { id: true, tableNo: true, restaurantId: true, seats: true },
    });

    if (!table || Number(table.restaurantId) !== rid) {
      const err = new Error("Table not found or restaurant mismatch");
      err.code = "table_not_found";
      throw err;
    }

    // Atomic lookup for active session
    let session = await tx.tableSession.findFirst({
      where: {
        tableId: tid,
        restaurantId: rid,
        status: { in: ACTIVE_STATUSES },
      },
      include: {
        orders: {
          include: {
            items: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      session = await tx.tableSession.create({
        data: {
          restaurantId: rid,
          tableId: tid,
          tableNo: table.tableNo,
          waiterId: waiterId ? Number(waiterId) : null,
          waiterName: waiterName ? String(waiterName).trim() : null,
          guestCount: Math.max(1, Number(guestCount || 1)),
          status: "OPEN",
          openedAt: new Date(),
        },
        include: {
          orders: {
            include: { items: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    return session;
  });
};

export const getActiveSessionForTable = async ({ prisma, tableId, restaurantId } = {}) => {
  const tid = Number(tableId);
  const where = {
    tableId: tid,
    status: { in: ACTIVE_STATUSES },
  };
  if (restaurantId) where.restaurantId = Number(restaurantId);

  const session = await prisma.tableSession.findFirst({
    where,
    include: {
      orders: {
        include: { items: true },
        orderBy: { createdAt: "asc" },
      },
      table: true,
    },
  });

  if (!session) return null;

  return {
    ...session,
    elapsedMinutes: getMinutesElapsed(session.openedAt),
  };
};

export const getActiveSessionsForRestaurant = async ({ prisma, restaurantId } = {}) => {
  const rid = Number(restaurantId);

  const sessions = await prisma.tableSession.findMany({
    where: {
      restaurantId: rid,
      status: { in: ACTIVE_STATUSES },
    },
    include: {
      orders: {
        include: { items: true },
        orderBy: { createdAt: "asc" },
      },
      table: true,
    },
    orderBy: { openedAt: "desc" },
  });

  return sessions.map((session) => ({
    ...session,
    elapsedMinutes: getMinutesElapsed(session.openedAt),
  }));
};

export const recalculateSessionTotals = async ({ prisma, sessionId }) => {
  const sid = Number(sessionId);
  const session = await prisma.tableSession.findUnique({
    where: { id: sid },
    include: {
      restaurant: {
        select: {
          taxEnabled: true,
          taxType: true,
          defaultTaxPercent: true,
          serviceChargeEnabled: true,
          serviceChargePercent: true,
        },
      },
      orders: {
        where: { status: { not: "CANCELLED" } },
        include: { items: true },
      },
    },
  });

  if (!session) return null;

  // Aggregate items across all non-cancelled orders in this session
  const allOrderItems = [];
  session.orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      allOrderItems.push({
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        priceSubunit: Math.round(Number(item.price || 0) * 100),
        qty: item.qty,
      });
    });
  });

  const rest = session.restaurant || {};
  const discountSubunit = Math.round(Number(session.discountAmount || 0) * 100);

  const bill = computeBill({
    items: allOrderItems,
    taxEnabled: Boolean(rest.taxEnabled),
    taxType: rest.taxType || "EXCLUSIVE",
    taxPercent: rest.defaultTaxPercent || 5,
    serviceChargeEnabled: Boolean(rest.serviceChargeEnabled),
    serviceChargePercent: rest.serviceChargePercent || 0,
    discountSubunit,
  });

  return prisma.tableSession.update({
    where: { id: sid },
    data: {
      subtotal: bill.subtotal,
      taxAmount: bill.taxAmount,
      serviceChargeAmount: bill.serviceChargeAmount,
      total: bill.total,
    },
    include: {
      orders: {
        include: { items: true },
        orderBy: { createdAt: "asc" },
      },
      table: true,
    },
  });
};

export const addOrderToTableSession = async ({
  prisma,
  actor,
  tableId,
  restaurantId,
  items,
  notes,
  customerName,
  phone,
  guestCount,
} = {}) => {
  const rid = Number(restaurantId || actor?.restaurantId);
  const tid = Number(tableId);

  // 1. Get or create active session atomically
  const session = await getOrCreateActiveSession({
    prisma,
    restaurantId: rid,
    tableId: tid,
    waiterId: actor?.userId || null,
    waiterName: actor?.userName || null,
    guestCount: guestCount || 1,
  });

  // 2. Create Order linked to this TableSession
  const order = await createOrderByStaff({
    prisma,
    actor,
    input: {
      tableNo: session.tableNo,
      tableSessionId: session.id,
      items,
      notes,
      customerName,
      phone,
      fulfillment: "DINE_IN",
    },
  });

  // Link tableSessionId on order explicitly
  await prisma.order.update({
    where: { id: order.id },
    data: { tableSessionId: session.id },
  });

  // 3. Recalculate table session running totals
  const updatedSession = await recalculateSessionTotals({ prisma, sessionId: session.id });

  return {
    order,
    session: updatedSession,
  };
};

export const generateSessionBill = async ({ prisma, sessionId, discountAmount = 0 } = {}) => {
  const sid = Number(sessionId);

  const session = await prisma.tableSession.findUnique({
    where: { id: sid },
  });

  if (!session) {
    const err = new Error("Session not found");
    err.code = "session_not_found";
    throw err;
  }

  await prisma.tableSession.update({
    where: { id: sid },
    data: {
      status: "BILLING",
      billedAt: new Date(),
      discountAmount: Number(discountAmount || 0),
    },
  });

  return recalculateSessionTotals({ prisma, sessionId: sid });
};

export const updateSessionPaymentStatus = async ({
  prisma,
  sessionId,
  paymentMode,
  paymentStatus,
} = {}) => {
  const sid = Number(sessionId);
  const statusUpper = String(paymentStatus || "").toUpperCase();

  const session = await prisma.tableSession.findUnique({ where: { id: sid } });
  if (!session) return null;

  if (statusUpper === "SUCCESS" || statusUpper === "PAID") {
    const updated = await prisma.tableSession.update({
      where: { id: sid },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
      include: {
        orders: { include: { items: true } },
        table: true,
      },
    });
    return updated;
  }

  return session;
};

export const closeTableSession = async ({ prisma, sessionId } = {}) => {
  const sid = Number(sessionId);

  const session = await prisma.tableSession.findUnique({ where: { id: sid } });
  if (!session) {
    const err = new Error("Session not found");
    err.code = "session_not_found";
    throw err;
  }

  const updated = await prisma.tableSession.update({
    where: { id: sid },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
    include: {
      orders: { include: { items: true } },
      table: true,
    },
  });

  return updated;
};
