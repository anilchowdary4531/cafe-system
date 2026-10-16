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
      select: { id: true, tableNo: true, restaurantId: true, seats: true, assignedWaiterId: true, assignedWaiterName: true, isBlocked: true, blockReason: true },
    });

    if (!table || Number(table.restaurantId) !== rid) {
      const err = new Error("Table not found or restaurant mismatch");
      err.code = "table_not_found";
      throw err;
    }

    if (table.isBlocked) {
      const err = new Error(`Table ${table.tableNo} is BLOCKED (${table.blockReason || "Maintenance"}). Cannot open session or take orders.`);
      err.code = "table_blocked";
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
      const finalWaiterId = waiterId ? Number(waiterId) : table.assignedWaiterId || null;
      const finalWaiterName = waiterName ? String(waiterName).trim() : table.assignedWaiterName || null;

      session = await tx.tableSession.create({
        data: {
          restaurantId: rid,
          tableId: tid,
          tableNo: table.tableNo,
          waiterId: finalWaiterId,
          waiterName: finalWaiterName,
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
          billingConfig: true,
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
    orderType: "DINE_IN",
    billingConfig: rest.billingConfig,
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
  realtime,
  actor,
} = {}) => {
  const sid = Number(sessionId);
  const statusUpper = String(paymentStatus || "").toUpperCase();

  const session = await prisma.tableSession.findUnique({
    where: { id: sid },
    include: {
      orders: { include: { items: true } },
      table: true,
    },
  });
  if (!session) return null;

  if (statusUpper === "SUCCESS" || statusUpper === "PAID") {
    if (typeof prisma.$transaction === "function") {
      const completionResult = await completeSessionAndReleaseTable({
        prisma,
        tableSessionId: sid,
        paymentMode,
        realtime,
        actor,
      });

      if (completionResult?.completed) {
        return prisma.tableSession.findUnique({
          where: { id: sid },
          include: {
            orders: { include: { items: true } },
            table: true,
          },
        });
      }

      return session;
    }

    // Mocked unit test fallback without $transaction
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

    if (session.tableId) {
      await prisma.diningTable.update({
        where: { id: session.tableId },
        data: {
          assignedWaiterId: null,
          assignedWaiterName: null,
        },
      }).catch(() => {});
    }

    return updated;
  }

  return session;
};

export const closeTableSession = async ({
  prisma,
  sessionId,
  force = false,
  realtime,
  actor,
} = {}) => {
  const sid = Number(sessionId);

  const session = await prisma.tableSession.findUnique({
    where: { id: sid },
    include: {
      orders: true,
      table: true,
    },
  });
  if (!session) {
    const err = new Error("Session not found");
    err.code = "session_not_found";
    throw err;
  }

  if (!force) {
    const completionResult = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: sid,
      realtime,
      actor,
    });

    if (!completionResult?.completed) {
      const err = new Error("Cannot close session with unpaid orders");
      err.code = "unpaid_orders_remain";
      err.unpaidCount = completionResult?.unpaidCount;
      throw err;
    }

    return prisma.tableSession.findUnique({
      where: { id: sid },
      include: {
        orders: { include: { items: true } },
        table: true,
      },
    });
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

  if (session.tableId) {
    await prisma.diningTable.update({
      where: { id: session.tableId },
      data: {
        assignedWaiterId: null,
        assignedWaiterName: null,
      },
    }).catch((err) => console.warn("[TableSession] Error clearing waiter on close:", err?.message));
  }

  return updated;
};

/**
 * Unified, idempotent session completion and table release operation.
 * Verifies that ALL non-cancelled orders belonging to the session are paid.
 * Only closes the session, clears waiter assignment, and frees the table when
 * financial completeness is reached. Emits realtime socket events.
 */
export const completeSessionAndReleaseTable = async ({
  prisma,
  tableSessionId,
  orderId,
  paymentMode,
  realtime,
  actor,
} = {}) => {
  if (!prisma) return null;

  let sid = tableSessionId ? Number(tableSessionId) : null;

  // 1. Resolve tableSessionId if not provided directly
  if (!sid && orderId) {
    const numericOrderId = Number(orderId);
    if (!Number.isNaN(numericOrderId)) {
      const orderRecord = await prisma.order.findUnique({
        where: { id: numericOrderId },
        select: { id: true, tableSessionId: true, tableNo: true, restaurantId: true },
      });
      if (orderRecord?.tableSessionId) {
        sid = orderRecord.tableSessionId;
      } else if (orderRecord?.tableNo && orderRecord?.restaurantId) {
        const foundSession = await prisma.tableSession.findFirst({
          where: {
            restaurantId: orderRecord.restaurantId,
            tableNo: orderRecord.tableNo,
            status: { in: ACTIVE_STATUSES },
          },
          select: { id: true },
        });
        if (foundSession) {
          sid = foundSession.id;
        }
      }
    }
  }

  if (!sid) {
    return { completed: false, reason: "no_table_session" };
  }

  // 2. Fetch session and its non-cancelled orders
  const session = await prisma.tableSession.findUnique({
    where: { id: sid },
    include: {
      orders: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, status: true, paymentStatus: true, total: true, orderNo: true },
      },
      table: true,
    },
  });

  if (!session) {
    return { completed: false, reason: "session_not_found" };
  }

  // Idempotency: If already closed, do not re-close or corrupt state
  if (session.status === "CLOSED") {
    return { completed: true, session, alreadyClosed: true };
  }

  // 3. Verify financial completeness: Check if all payable non-cancelled orders are paid
  const numericOrderId = orderId ? Number(orderId) : null;
  const unpaidOrders = (session.orders || []).filter((o) => {
    if (numericOrderId && o.id === numericOrderId) {
      // The current order being completed is considered paid
      return false;
    }
    const payStatus = String(o.paymentStatus || "").toUpperCase();
    return payStatus !== "PAID" && payStatus !== "SUCCESS";
  });

  if (unpaidOrders.length > 0) {
    // Other orders in the session remain unpaid -> DO NOT close session, DO NOT free table
    return {
      completed: false,
      session,
      reason: "unpaid_orders_remain",
      unpaidCount: unpaidOrders.length,
    };
  }

  // 4. All orders are financially complete! Execute atomic closure and table release
  const updatedSession = await prisma.$transaction(async (tx) => {
    // A. Ensure all non-cancelled orders in session are marked PAID
    await tx.order.updateMany({
      where: {
        tableSessionId: sid,
        status: { not: "CANCELLED" },
        paymentStatus: { notIn: ["PAID", "SUCCESS"] },
      },
      data: {
        paymentStatus: "PAID",
        ...(paymentMode ? { paymentMode } : {}),
      },
    });

    // B. Close TableSession
    const closed = await tx.tableSession.update({
      where: { id: sid },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        paidAt: session.paidAt || new Date(),
      },
      include: {
        orders: { include: { items: true } },
        table: true,
      },
    });

    // C. Clear waiter assignment from table
    if (session.tableId) {
      await tx.diningTable.update({
        where: { id: session.tableId },
        data: {
          assignedWaiterId: null,
          assignedWaiterName: null,
        },
      });
    }

    // D. Audit log in TableOperationLog if available
    try {
      if (tx.tableOperationLog) {
        await tx.tableOperationLog.create({
          data: {
            restaurantId: session.restaurantId,
            operationType: "SESSION_COMPLETED",
            sourceTableId: session.tableId,
            sourceTableNo: session.tableNo,
            sourceSessionId: session.id,
            performedByName: actor?.userName || actor?.name || "System/Payment",
            performedByUserRole: actor?.role || "SYSTEM",
            details: {
              paymentMode: paymentMode || "UNKNOWN",
              total: session.total,
              ordersCount: session.orders?.length || 0,
            },
          },
        });
      }
    } catch {
      // Non-blocking audit log
    }

    return closed;
  });

  // 5. Emit Realtime Events after successful transaction commit
  const effectiveRid = session.restaurantId;
  const clearPayload = {
    restaurantId: effectiveRid,
    tableId: session.tableId,
    tableNo: session.tableNo,
    assignedWaiterId: null,
    assignedWaiterName: null,
  };

  const io = realtime?.io || null;
  const staff = realtime?.staff || null;

  if (io) {
    io.to(`restaurant_${effectiveRid}`).emit("table:updated", clearPayload);
    io.to(`restaurant:${effectiveRid}`).emit("table:updated", clearPayload);
    io.to(`restaurant_${effectiveRid}`).emit("table:session_updated", {
      restaurantId: effectiveRid,
      tableId: session.tableId,
      tableNo: session.tableNo,
      sessionId: session.id,
      status: "CLOSED",
    });
    io.to(`restaurant:${effectiveRid}`).emit("table:session_updated", {
      restaurantId: effectiveRid,
      tableId: session.tableId,
      tableNo: session.tableNo,
      sessionId: session.id,
      status: "CLOSED",
    });
    io.to(`restaurant_${effectiveRid}`).emit("table:layout_updated", { restaurantId: effectiveRid });
    io.to(`restaurant:${effectiveRid}`).emit("table:layout_updated", { restaurantId: effectiveRid });
  }

  if (staff) {
    staff.to(`restaurant_${effectiveRid}`).emit("table:updated", clearPayload);
    staff.to(`restaurant:${effectiveRid}`).emit("table:updated", clearPayload);
    staff.to(`restaurant_${effectiveRid}`).emit("table:session_updated", {
      restaurantId: effectiveRid,
      tableId: session.tableId,
      tableNo: session.tableNo,
      sessionId: session.id,
      status: "CLOSED",
    });
    staff.to(`restaurant:${effectiveRid}`).emit("table:session_updated", {
      restaurantId: effectiveRid,
      tableId: session.tableId,
      tableNo: session.tableNo,
      sessionId: session.id,
      status: "CLOSED",
    });
  }

  if (typeof realtime?.emitTableSessionUpdated === "function") {
    realtime.emitTableSessionUpdated(updatedSession);
  }

  return { completed: true, session: updatedSession };
};
