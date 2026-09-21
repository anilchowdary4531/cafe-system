import prisma from "../prisma.js";
import {
  getOrCreateActiveSession,
  getActiveSessionForTable,
  getActiveSessionsForRestaurant,
  addOrderToTableSession,
  generateSessionBill,
  updateSessionPaymentStatus,
  closeTableSession,
} from "../services/tableSessionService.js";

const getEmitter = (req) => req.server?.realtime?.emitTableSessionUpdated || req.realtime?.emitTableSessionUpdated || null;
const getOrderEmitter = (req) => req.server?.realtime?.emitOrderCreated || req.realtime?.emitOrderCreated || null;

export async function openSession(req, reply) {
  try {
    const tableId = Number(req.params.tableId);
    const { restaurantId, guestCount = 1, waiterId, waiterName } = req.body || {};
    const rid = Number(restaurantId || req.params.restaurantId || req.staffActor?.restaurantId || 1);

    if (!tableId) {
      return reply.code(400).send({ success: false, message: "tableId is required" });
    }

    const session = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId,
      waiterId: waiterId || req.staffActor?.userId || null,
      waiterName: waiterName || req.staffActor?.name || null,
      guestCount,
    });

    const emit = getEmitter(req);
    if (emit) emit(session);

    return reply.send({ success: true, session });
  } catch (err) {
    console.error("[TableSession] openSession error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to open session" });
  }
}

export async function getSession(req, reply) {
  try {
    const tableId = Number(req.params.tableId);
    const sessionId = Number(req.params.sessionId);
    const restaurantId = req.params.restaurantId ? Number(req.params.restaurantId) : undefined;

    if (sessionId) {
      const session = await prisma.tableSession.findUnique({
        where: { id: sessionId },
        include: {
          orders: {
            include: { items: true },
            orderBy: { createdAt: "asc" },
          },
          table: true,
        },
      });
      if (!session) {
        return reply.code(404).send({ success: false, message: "Session not found" });
      }
      return reply.send({ success: true, session });
    }

    if (!tableId) {
      return reply.code(400).send({ success: false, message: "tableId or sessionId is required" });
    }

    const session = await getActiveSessionForTable({ prisma, tableId, restaurantId });
    if (!session) {
      return reply.send({ success: true, session: null, message: "No active session for table" });
    }

    return reply.send({ success: true, session });
  } catch (err) {
    console.error("[TableSession] getSession error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to fetch session" });
  }
}

export async function getActiveRestaurantSessions(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId);
    if (!restaurantId) {
      return reply.code(400).send({ success: false, message: "restaurantId is required" });
    }

    const sessions = await getActiveSessionsForRestaurant({ prisma, restaurantId });
    return reply.send({ success: true, sessions });
  } catch (err) {
    console.error("[TableSession] getActiveRestaurantSessions error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to fetch active sessions" });
  }
}

export async function addItems(req, reply) {
  try {
    const tableId = Number(req.params.tableId);
    const { restaurantId, items, notes, customerName, phone, guestCount } = req.body || {};
    const rid = Number(restaurantId || req.params.restaurantId || req.staffActor?.restaurantId);

    if (!tableId || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ success: false, message: "tableId and non-empty items array are required" });
    }

    const actor = {
      restaurantId: rid,
      userId: req.staffActor?.userId || null,
      role: req.staffActor?.role || "STAFF",
    };

    const { order, session } = await addOrderToTableSession({
      prisma,
      actor,
      tableId,
      restaurantId: rid,
      items,
      notes,
      customerName,
      phone,
      guestCount,
    });

    const emitSession = getEmitter(req);
    if (emitSession) emitSession(session);

    const emitOrder = getOrderEmitter(req);
    if (emitOrder) emitOrder(order);

    return reply.send({ success: true, order, session });
  } catch (err) {
    console.error("[TableSession] addItems error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to add items to session" });
  }
}

export async function generateBill(req, reply) {
  try {
    const sessionId = Number(req.params.sessionId);
    const { discountAmount = 0 } = req.body || {};

    if (!sessionId) {
      return reply.code(400).send({ success: false, message: "sessionId is required" });
    }

    const session = await generateSessionBill({ prisma, sessionId, discountAmount });

    const emitSession = getEmitter(req);
    if (emitSession) emitSession(session);

    return reply.send({ success: true, session });
  } catch (err) {
    console.error("[TableSession] generateBill error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to generate bill" });
  }
}

export async function updatePaymentStatus(req, reply) {
  try {
    const sessionId = Number(req.params.sessionId);
    const { paymentMode, paymentStatus } = req.body || {};

    if (!sessionId || !paymentStatus) {
      return reply.code(400).send({ success: false, message: "sessionId and paymentStatus are required" });
    }

    const session = await updateSessionPaymentStatus({ prisma, sessionId, paymentMode, paymentStatus });

    const emitSession = getEmitter(req);
    if (emitSession && session) emitSession(session);

    return reply.send({ success: true, session });
  } catch (err) {
    console.error("[TableSession] updatePaymentStatus error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to update payment status" });
  }
}

export async function closeSession(req, reply) {
  try {
    const sessionId = Number(req.params.sessionId || req.body?.sessionId);

    if (!sessionId) {
      return reply.code(400).send({ success: false, message: "sessionId is required" });
    }

    const session = await closeTableSession({ prisma, sessionId });

    const emitSession = getEmitter(req);
    if (emitSession) emitSession(session);

    return reply.send({ success: true, session });
  } catch (err) {
    console.error("[TableSession] closeSession error:", err);
    return reply.code(500).send({ success: false, message: err.message || "Failed to close session" });
  }
}

// Backward compatible handlers
export async function getRunningBill(req, reply) {
  return getSession(req, reply);
}

export async function getTableSession(req, reply) {
  return getSession(req, reply);
}