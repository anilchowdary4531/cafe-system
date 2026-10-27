import { testPrinterConnection } from "../services/escposService.js";
import { dispatchKotPrint, reprintKot, updateKotStatus, updateKotItemStatus, updateKotPriority, createKotsForOrder, getCanonicalReadyItems } from "../services/kotService.js";
import prisma from "../prisma.js";
import { emitToKitchen } from "../realtime/socketServer.js";
import { getKitchenWorkload } from "../services/kitchenAssignmentService.js";
import { createAndDispatchNotification } from "../services/notificationService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";

/**
 * Fetch KOTs for a restaurant with status, station, priority, source, table & search query filters
 */
const getStartOfBusinessDay = (dateStrOrObj = new Date(), timezone = "Asia/Kolkata") => {
  let year, month, day;
  if (typeof dateStrOrObj === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStrOrObj)) {
    [year, month, day] = dateStrOrObj.split("-");
  } else {
    const d = dateStrOrObj instanceof Date ? dateStrOrObj : new Date(dateStrOrObj);
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    const parts = formatter.format(d);
    [year, month, day] = parts.split("-");
  }
  return new Date(`${year}-${month}-${day}T00:00:00.000+05:30`);
};

const getEndOfBusinessDay = (dateStrOrObj = new Date(), timezone = "Asia/Kolkata") => {
  let year, month, day;
  if (typeof dateStrOrObj === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStrOrObj)) {
    [year, month, day] = dateStrOrObj.split("-");
  } else {
    const d = dateStrOrObj instanceof Date ? dateStrOrObj : new Date(dateStrOrObj);
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    const parts = formatter.format(d);
    [year, month, day] = parts.split("-");
  }
  return new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);
};

/**
 * Fetch KOTs for a restaurant with status, station, priority, source, table, scope, date & search query filters
 */
export const getKots = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const {
      status,
      stationId,
      priority,
      source,
      tableNo,
      tableSessionId,
      q,
      scope = "today",
      preset = "yesterday",
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const db = req.prisma || prisma;

    // Determine timezone (default Asia/Kolkata)
    let timezone = "Asia/Kolkata";
    try {
      const rest = await db.restaurantProfile.findUnique({
        where: { restaurantId },
        select: { timezone: true },
      });
      if (rest?.timezone) timezone = rest.timezone;
    } catch (_) {}

    const where = { restaurantId };

    if (scope === "history") {
      let start, end;
      if (startDate || endDate) {
        start = startDate ? getStartOfBusinessDay(startDate, timezone) : getStartOfBusinessDay(new Date(Date.now() - 30 * 86400000), timezone);
        end = endDate ? getEndOfBusinessDay(endDate, timezone) : getEndOfBusinessDay(new Date(), timezone);
      } else if (preset === "today") {
        start = getStartOfBusinessDay(new Date(), timezone);
        end = getEndOfBusinessDay(new Date(), timezone);
      } else if (preset === "last7days") {
        start = getStartOfBusinessDay(new Date(Date.now() - 6 * 86400000), timezone);
        end = getEndOfBusinessDay(new Date(), timezone);
      } else if (preset === "last30days") {
        start = getStartOfBusinessDay(new Date(Date.now() - 29 * 86400000), timezone);
        end = getEndOfBusinessDay(new Date(), timezone);
      } else {
        // Default preset for History: "yesterday"
        const yday = new Date(Date.now() - 86400000);
        start = getStartOfBusinessDay(yday, timezone);
        end = getEndOfBusinessDay(yday, timezone);
      }
      where.createdAt = { gte: start, lte: end };
    } else if (scope === "today" || scope === "live") {
      // Live KOTs (Today + active unserved KOTs)
      const startToday = getStartOfBusinessDay(new Date(), timezone);
      where.OR = [
        { createdAt: { gte: startToday } },
        {
          status: { in: ["PENDING", "PRINTED", "PRINT_FAILED", "PREPARING", "READY"] },
        },
      ];
    }

    if (status && status !== "ALL") where.status = String(status).toUpperCase();
    if (stationId && stationId !== "ALL") where.stationId = Number(stationId);
    if (priority && priority !== "ALL") where.priority = String(priority).toUpperCase();
    if (tableNo && tableNo !== "ALL") where.tableNo = String(tableNo).trim();
    if (tableSessionId) where.tableSessionId = Number(tableSessionId);

    const orderWhere = {};
    if (source && source !== "ALL") {
      const srcUpper = String(source).toUpperCase();
      orderWhere.orderSource = srcUpper.includes("QR") ? "QR_ORDER" : srcUpper.includes("WAITER") ? "WAITER" : srcUpper.includes("POS") ? "POS" : srcUpper;
    }

    if (Object.keys(orderWhere).length > 0) {
      where.order = orderWhere;
    }

    if (q) {
      const queryStr = String(q).trim();
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { kotNo: { contains: queryStr, mode: "insensitive" } },
          { tableNo: { contains: queryStr, mode: "insensitive" } },
          { order: { orderNo: { contains: queryStr, mode: "insensitive" } } },
          { order: { customerName: { contains: queryStr, mode: "insensitive" } } },
          { items: { some: { itemName: { contains: queryStr, mode: "insensitive" } } } },
        ],
      });
    }

    // Auto-backfill KOT records for unlinked orders
    try {
      const unlinkedOrders = await db.order.findMany({
        where: { restaurantId, kots: { none: {} } },
        include: { items: true },
        take: 50,
        orderBy: { createdAt: "desc" },
      });
      if (unlinkedOrders.length > 0) {
        for (const order of unlinkedOrders) {
          await createKotsForOrder({ prisma: db, order }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[getKots] Auto backfill warning:", e?.message);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || (scope === "history" ? 20 : 100)));

    const [kots, total] = await Promise.all([
      db.kitchenOrderTicket.findMany({
        where,
        skip: scope === "history" ? (pageNum - 1) * limitNum : 0,
        take: limitNum,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        include: {
          items: true,
          station: { include: { printer: true } },
          order: {
            select: {
              id: true,
              orderNo: true,
              orderSource: true,
              customerName: true,
              tableNo: true,
              status: true,
              priority: true,
              total: true,
              subtotal: true,
              taxAmount: true,
              discountAmount: true,
              createdAt: true,
              items: true,
              statusEvents: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      }),
      db.kitchenOrderTicket.count({ where }),
    ]);

    return res.send({
      ok: true,
      kots,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("getKots error:", err);
    return res.status(500).send({ message: err?.message || "Failed to fetch KOTs" });
  }
};

const resolveWaiterIdForKot = async ({ prisma: db, kot, order }) => {
  if (kot?.waiterId) return Number(kot.waiterId);
  if (kot?.tableSessionId) {
    const session = await db.tableSession.findUnique({
      where: { id: kot.tableSessionId },
      select: { waiterId: true },
    });
    if (session?.waiterId) return Number(session.waiterId);
  }
  if (kot?.restaurantId && kot?.tableNo) {
    const table = await db.diningTable.findFirst({
      where: { restaurantId: kot.restaurantId, tableNo: String(kot.tableNo).trim() },
      select: { assignedWaiterId: true },
    });
    if (table?.assignedWaiterId) return Number(table.assignedWaiterId);
  }
  if (order?.createdByUserId) return Number(order.createdByUserId);
  return null;
};

/**
 * Update KOT Status (PENDING, ACCEPTED, PREPARING, READY, SERVED, CANCELLED)
 */
export const updateStatus = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);
    const { status } = req.body;

    if (!restaurantId || !kotId) return res.status(400).send({ message: "Missing required IDs" });

    const actor = req.staffActor || (req.user ? { userId: req.user.id, userName: req.user.name || req.user.email } : null);

    const updatedKot = await updateKotStatus({
      prisma: req.prisma || prisma,
      kotId,
      restaurantId,
      nextStatus: status,
      actor,
    });
    const updatedOrder = updatedKot?.order || null;

    // Realtime notification & broadcast (staff + io)
    const io = req.server?.io || req.server?.realtime?.io || req.app?.get?.("io");
    const staff = req.server?.staff || req.server?.realtime?.staff;
    emitToKitchen({
      io,
      staff,
      restaurantId,
      event: "kot:status_updated",
      payload: updatedKot,
    });

    if (String(status).toUpperCase() === "READY") {
      try {
        const waiterId = await resolveWaiterIdForKot({ prisma: req.prisma || prisma, kot: updatedKot, order: updatedOrder });
        if (waiterId) {
          const tableLabel = updatedKot?.tableNo ? `Table ${updatedKot.tableNo}` : "Takeaway";
          const orderLabel = updatedOrder?.orderNo ? `Order #${updatedOrder.orderNo}` : (updatedKot?.orderId ? `Order #${updatedKot.orderId}` : "");
          await createAndDispatchNotification({
            prisma: req.prisma || prisma,
            realtime: { io, staff },
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: waiterId,
            orderId: updatedKot?.orderId ? Number(updatedKot.orderId) : null,
            restaurantId,
            notificationType: NOTIFICATION_TYPES.FOOD_READY,
            title: `Food Ready — ${tableLabel}`,
            message: `Food ready for ${tableLabel}${orderLabel ? ` — ${orderLabel}` : ""}.`,
            idempotencyKey: `kot_ready_${restaurantId}_${kotId}_${waiterId}_READY`,
            data: {
              restaurantId,
              orderId: updatedKot?.orderId ? Number(updatedKot.orderId) : null,
              orderNo: updatedOrder?.orderNo || (updatedKot?.orderId ? String(updatedKot.orderId) : null),
              kotId: Number(kotId),
              tableId: updatedKot?.tableId ? Number(updatedKot.tableId) : null,
              tableSessionId: updatedKot?.tableSessionId ? Number(updatedKot.tableSessionId) : null,
              tableNo: updatedKot?.tableNo || null,
              recipientId: waiterId,
            },
          }).catch((e) => console.warn("[kot.controller] KOT ready notification error:", e?.message));
        }
      } catch (notifErr) {
        console.warn("[kot.controller] Failed to dispatch KOT ready notification:", notifErr?.message);
      }
    }

    if (updatedOrder) {
      if (staff) {
        staff.to(`restaurant_${restaurantId}`).emit("order:updated", updatedOrder);
        staff.to(`restaurant:${restaurantId}`).emit("order:updated", updatedOrder);
        if (updatedOrder.tableNo) {
          staff.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableNo: updatedOrder.tableNo });
          staff.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableNo: updatedOrder.tableNo });
        }
      }
      if (io) {
        io.to(`restaurant_${restaurantId}`).emit("order:updated", updatedOrder);
        io.to(`restaurant:${restaurantId}`).emit("order:updated", updatedOrder);
        if (updatedOrder.tableNo) {
          io.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableNo: updatedOrder.tableNo });
          io.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableNo: updatedOrder.tableNo });
        }
      }
    }

    // Refresh and emit updated workload
    getKitchenWorkload({ prisma: req.prisma || prisma, restaurantId })
      .then((workload) => emitToKitchen({ io, staff, restaurantId, event: "kitchen:workload_updated", payload: workload }))
      .catch(() => {});

    return res.send({ ok: true, kot: updatedKot, order: updatedOrder });
  } catch (err) {
    console.error("updateKotStatus error:", err);
    return res.status(500).send({ message: err?.message || "Failed to update KOT status" });
  }
};

/**
 * Update Item-Level KDS Status (PENDING, PREPARING, READY, CANCELLED)
 */
export const updateItemStatus = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || 0);
    let kotId = Number(req.params.kotId || 0);
    const itemId = Number(req.params.itemId || 0);
    const { status } = req.body || {};

    if (!restaurantId || !itemId) {
      return res.status(400).send({ message: "Missing required parameters" });
    }

    const db = req.prisma || prisma;
    if (!kotId) {
      const itemRecord = await db.kitchenOrderTicketItem.findUnique({
        where: { id: itemId },
        select: { kotId: true },
      });
      kotId = Number(itemRecord?.kotId || 0);
    }

    if (!kotId) {
      return res.status(404).send({ message: "KOT for item not found" });
    }

    const actor = req.staffActor || (req.user ? { userId: req.user.id, userName: req.user.name || req.user.email } : null);

    const { kot, order } = await updateKotItemStatus({
      prisma: db,
      kotId,
      itemId,
      restaurantId,
      nextStatus: status,
      actor,
    });

    const updatedItem = (kot?.items || []).find((it) => it.id === itemId);

    // Realtime notification & broadcast (staff + io)
    const io = req.server?.io || req.server?.realtime?.io || req.app?.get?.("io");
    const staff = req.server?.staff || req.server?.realtime?.staff;

    emitToKitchen({
      io,
      staff,
      restaurantId,
      event: "kot:item_updated",
      payload: { kotId, itemId, status, kot, item: updatedItem },
      targetUserIds: updatedItem?.assignedChefId ? [updatedItem.assignedChefId] : [],
    });

    emitToKitchen({
      io,
      staff,
      restaurantId,
      event: "kitchen:item_status_updated",
      payload: { kotId, itemId, status, kot, item: updatedItem },
      targetUserIds: updatedItem?.assignedChefId ? [updatedItem.assignedChefId] : [],
    });

    if (String(status).toUpperCase() === "READY") {
      emitToKitchen({
        io,
        staff,
        restaurantId,
        event: "kitchen:item_ready",
        payload: { kotId, itemId, status, kot, item: updatedItem },
      });

      // Dispatch persistent notification for the assigned Server / Waiter
      try {
        const waiterId = await resolveWaiterIdForKot({ prisma: db, kot, order });
        if (waiterId) {
          const tableLabel = kot?.tableNo ? `Table ${kot.tableNo}` : "Takeaway";
          const orderLabel = order?.orderNo ? `Order #${order.orderNo}` : (kot?.orderId ? `Order #${kot.orderId}` : "");
          const title = `Food Ready — ${tableLabel}`;
          const message = `${updatedItem?.itemName || "Food item"} is ready for ${tableLabel}${orderLabel ? ` (${orderLabel})` : ""}.`;

          await createAndDispatchNotification({
            prisma: db,
            realtime: { io, staff },
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: waiterId,
            orderId: kot?.orderId ? Number(kot.orderId) : null,
            restaurantId,
            notificationType: NOTIFICATION_TYPES.FOOD_READY,
            title,
            message,
            idempotencyKey: `food_ready_${restaurantId}_${itemId}_${waiterId}_READY`,
            data: {
              restaurantId,
              orderId: kot?.orderId ? Number(kot.orderId) : null,
              orderNo: order?.orderNo || (kot?.orderId ? String(kot.orderId) : null),
              kotId: Number(kotId),
              kotItemId: Number(itemId),
              orderItemId: updatedItem?.orderItemId ? Number(updatedItem.orderItemId) : null,
              tableId: kot?.tableId ? Number(kot.tableId) : null,
              tableSessionId: kot?.tableSessionId ? Number(kot.tableSessionId) : null,
              tableNo: kot?.tableNo || null,
              recipientId: waiterId,
            },
          }).catch((e) => console.warn("[kot.controller] Item ready notification error:", e?.message));
        }
      } catch (notifErr) {
        console.warn("[kot.controller] Failed to dispatch item ready notification:", notifErr?.message);
      }
    } else if (String(status).toUpperCase() === "SERVED" || String(status).toUpperCase() === "DELIVERED") {
      emitToKitchen({
        io,
        staff,
        restaurantId,
        event: "kitchen:item_served",
        payload: { kotId, itemId, status: "SERVED", kot, item: updatedItem },
      });

      // Dispatch persistent notification for server delivery confirmation
      try {
        const waiterId = await resolveWaiterIdForKot({ prisma: db, kot, order });
        if (waiterId) {
          const tableLabel = kot?.tableNo ? `Table ${kot.tableNo}` : "Takeaway";
          const orderLabel = order?.orderNo ? `Order #${order.orderNo}` : (kot?.orderId ? `Order #${kot.orderId}` : "");
          await createAndDispatchNotification({
            prisma: db,
            realtime: { io, staff },
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: waiterId,
            orderId: kot?.orderId ? Number(kot.orderId) : null,
            restaurantId,
            notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
            title: `Food Delivered — ${tableLabel}`,
            message: `${updatedItem?.itemName || "Food item"} delivered to ${tableLabel}${orderLabel ? ` (${orderLabel})` : ""}.`,
            idempotencyKey: `food_served_${restaurantId}_${itemId}_${waiterId}_SERVED`,
            data: {
              restaurantId,
              orderId: kot?.orderId ? Number(kot.orderId) : null,
              orderNo: order?.orderNo || (kot?.orderId ? String(kot.orderId) : null),
              kotId: Number(kotId),
              kotItemId: Number(itemId),
              tableSessionId: kot?.tableSessionId ? Number(kot.tableSessionId) : null,
              tableNo: kot?.tableNo || null,
              recipientId: waiterId,
            },
          }).catch((e) => console.warn("[kot.controller] Item served notification error:", e?.message));
        }
      } catch (notifErr) {
        console.warn("[kot.controller] Failed to dispatch item served notification:", notifErr?.message);
      }
    }

    emitToKitchen({
      io,
      staff,
      restaurantId,
      event: "kot:status_updated",
      payload: kot,
    });

    if (order) {
      if (staff) {
        staff.to(`restaurant_${restaurantId}`).emit("order:updated", order);
        staff.to(`restaurant:${restaurantId}`).emit("order:updated", order);
        if (order.tableNo) {
          staff.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableNo: order.tableNo });
          staff.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableNo: order.tableNo });
        }
      }
      if (io) {
        io.to(`restaurant_${restaurantId}`).emit("order:updated", order);
        io.to(`restaurant:${restaurantId}`).emit("order:updated", order);
        if (order.tableNo) {
          io.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableNo: order.tableNo });
          io.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableNo: order.tableNo });
        }
      }
    }

    // Refresh and emit updated workload
    getKitchenWorkload({ prisma: db, restaurantId })
      .then((workload) => emitToKitchen({ io, staff, restaurantId, event: "kitchen:workload_updated", payload: workload }))
      .catch(() => {});

    return res.send({ ok: true, kot, order, item: updatedItem });
  } catch (err) {
    console.error("updateItemStatus error:", err);
    return res.status(500).send({ message: err?.message || "Failed to update item status" });
  }
};

/**
 * Authoritative Controller: GET /owner/:restaurantId/kitchen/ready-items
 * Returns all eligible READY items for service distribution queue
 */
export const getReadyItemsController = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || req.staffActor?.restaurantId || req.query?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    const items = await getCanonicalReadyItems({ prisma: db, restaurantId });
    return res.send({
      ok: true,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("getReadyItemsController error:", err);
    return res.status(500).send({ message: err?.message || "Failed to fetch ready items" });
  }
};

/**
 * Update KOT Priority (NORMAL, HIGH, URGENT)
 */
export const updatePriority = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);
    const { priority } = req.body;

    if (!restaurantId || !kotId || !priority) {
      return res.status(400).send({ message: "Missing required parameters" });
    }

    const updated = await updateKotPriority({
      prisma: req.prisma || prisma,
      kotId,
      restaurantId,
      priority,
    });

    const io = req.server?.io || req.app?.get?.("io");
    if (io) {
      io.to(`restaurant_${restaurantId}`).emit("kot:priority_updated", updated);
      io.to(`restaurant:${restaurantId}`).emit("kot:priority_updated", updated);
      io.to(`restaurant_${restaurantId}`).emit("kot:status_updated", updated);
      io.to(`restaurant:${restaurantId}`).emit("kot:status_updated", updated);
    }

    return res.send({ ok: true, kot: updated });
  } catch (err) {
    console.error("updatePriority error:", err);
    return res.status(500).send({ message: err?.message || "Failed to update priority" });
  }
};

/**
 * Fetch KDS Live Workload Metrics
 */
export const getWorkloadMetrics = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    const kots = await db.kitchenOrderTicket.findMany({
      where: {
        restaurantId,
        status: { in: ["PENDING", "ACCEPTED", "PRINTED", "PREPARING", "READY"] },
      },
      select: {
        id: true,
        status: true,
        priority: true,
        createdAt: true,
        estimatedPrepTimeMinutes: true,
      },
    });

    const now = Date.now();
    let newCount = 0;
    let preparingCount = 0;
    let readyCount = 0;
    let overdueCount = 0;
    let urgentCount = 0;
    let totalPrepMinutes = 0;
    let completedCount = 0;

    for (const kot of kots) {
      if (kot.status === "PENDING" || kot.status === "ACCEPTED" || kot.status === "PRINTED") {
        newCount++;
      } else if (kot.status === "PREPARING") {
        preparingCount++;
      } else if (kot.status === "READY") {
        readyCount++;
      }

      if (kot.priority === "URGENT" || kot.priority === "HIGH") {
        urgentCount++;
      }

      const elapsedMinutes = Math.floor((now - new Date(kot.createdAt).getTime()) / 60000);
      const estPrep = kot.estimatedPrepTimeMinutes || 15;
      if (kot.status !== "READY" && elapsedMinutes > estPrep) {
        overdueCount++;
      }

      totalPrepMinutes += elapsedMinutes;
      completedCount++;
    }

    const averagePrepMinutes = completedCount > 0 ? Math.round(totalPrepMinutes / completedCount) : 0;

    return res.send({
      ok: true,
      metrics: {
        newCount,
        preparingCount,
        readyCount,
        overdueCount,
        urgentCount,
        averagePrepMinutes,
        totalActiveCount: kots.length,
      },
    });
  } catch (err) {
    console.error("getWorkloadMetrics error:", err);
    return res.status(500).send({ message: err?.message || "Failed to fetch kitchen workload metrics" });
  }
};

/**
 * Reprint KOT
 */
export const triggerReprint = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const kotId = Number(req.params.kotId || 0);

    if (!restaurantId || !kotId) return res.status(400).send({ message: "Missing required IDs" });

    const result = await reprintKot({
      prisma: req.prisma,
      kotId,
      restaurantId,
    });

    return res.send({ ok: true, result });
  } catch (err) {
    console.error("triggerReprint error:", err);
    return res.status(500).send({ message: err?.message || "Failed to reprint KOT" });
  }
};

/**
 * PRINTER MANAGEMENT & TESTING
 */
export const getPrinters = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    const printers = await db.printer.findMany({
      where: { restaurantId },
      include: { stations: true },
      orderBy: { createdAt: "asc" },
    });

    return res.send({ ok: true, printers });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to fetch printers" });
  }
};

export const createPrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const { name, connectionType, ipAddress, port, paperWidth, isBillingPrinter } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).send({ message: "Printer name is required" });
    }

    const db = req.prisma || prisma;
    const printer = await db.printer.create({
      data: {
        restaurantId,
        name: String(name).trim(),
        connectionType: connectionType || "NETWORK",
        ipAddress: ipAddress ? String(ipAddress).trim() : null,
        port: port ? Number(port) : 9100,
        paperWidth: paperWidth || "80mm",
        isBillingPrinter: Boolean(isBillingPrinter),
        isActive: true,
      },
    });

    return res.send({ ok: true, printer });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to create printer" });
  }
};

export const updatePrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const printerId = Number(req.params.printerId || 0);

    const db = req.prisma || prisma;
    const printer = await db.printer.update({
      where: { id: printerId, restaurantId },
      data: {
        ...(req.body.name ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.connectionType ? { connectionType: req.body.connectionType } : {}),
        ...(req.body.ipAddress !== undefined ? { ipAddress: req.body.ipAddress ? String(req.body.ipAddress).trim() : null } : {}),
        ...(req.body.port ? { port: Number(req.body.port) } : {}),
        ...(req.body.paperWidth ? { paperWidth: req.body.paperWidth } : {}),
        ...(req.body.isBillingPrinter !== undefined ? { isBillingPrinter: Boolean(req.body.isBillingPrinter) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
      },
    });

    return res.send({ ok: true, printer });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to update printer" });
  }
};

export const deletePrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const printerId = Number(req.params.printerId || 0);

    const db = req.prisma || prisma;
    await db.printer.delete({
      where: { id: printerId, restaurantId },
    });

    return res.send({ ok: true, message: "Printer deleted" });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to delete printer" });
  }
};

export const testPrinter = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const printerId = Number(req.params.printerId || 0);

    const db = req.prisma || prisma;
    const printer = await db.printer.findFirst({
      where: { id: printerId, restaurantId },
    });

    if (!printer) return res.status(404).send({ message: "Printer not found" });

    const result = await testPrinterConnection({
      ipAddress: printer.ipAddress,
      port: printer.port || 9100,
      timeoutMs: 3000,
    });

    return res.send({ ok: true, printer, result });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Printer test failed" });
  }
};

/**
 * KITCHEN STATION MANAGEMENT
 */
export const getStations = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const db = req.prisma || prisma;
    let stations = await db.kitchenStation.findMany({
      where: { restaurantId },
      include: { printer: true, _count: { select: { menuItems: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Auto-create default HOT KITCHEN station if restaurant has no stations yet
    if (stations.length === 0) {
      const defaultStation = await db.kitchenStation.create({
        data: {
          restaurantId,
          name: "HOT KITCHEN",
          code: "HOT",
          description: "Default Main Kitchen Station",
          isDefault: true,
          isActive: true,
        },
        include: { printer: true, _count: { select: { menuItems: true } } },
      });
      stations = [defaultStation];
    }

    return res.send({ ok: true, stations });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to fetch stations" });
  }
};

export const createStation = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

    const { name, code, description, printerId, isDefault } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).send({ message: "Station name is required" });
    }

    const db = req.prisma || prisma;
    const station = await db.kitchenStation.create({
      data: {
        restaurantId,
        name: String(name).trim().toUpperCase(),
        code: code ? String(code).trim().toUpperCase() : String(name).slice(0, 3).toUpperCase(),
        description: description ? String(description).trim() : null,
        printerId: printerId ? Number(printerId) : null,
        isDefault: Boolean(isDefault),
        isActive: true,
      },
      include: { printer: true },
    });

    return res.send({ ok: true, station });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to create station" });
  }
};

export const updateStation = async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
    const stationId = Number(req.params.stationId || 0);

    const db = req.prisma || prisma;
    const station = await db.kitchenStation.update({
      where: { id: stationId, restaurantId },
      data: {
        ...(req.body.name ? { name: String(req.body.name).trim().toUpperCase() } : {}),
        ...(req.body.code !== undefined ? { code: req.body.code ? String(req.body.code).trim().toUpperCase() : null } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description ? String(req.body.description).trim() : null } : {}),
        ...(req.body.printerId !== undefined ? { printerId: req.body.printerId ? Number(req.body.printerId) : null } : {}),
        ...(req.body.isDefault !== undefined ? { isDefault: Boolean(req.body.isDefault) } : {}),
        ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
      },
      include: { printer: true },
    });

    return res.send({ ok: true, station });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Failed to update station" });
  }
};
