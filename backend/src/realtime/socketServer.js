import { Server as SocketIOServer } from "socket.io";
import { createOrderByStaff, updateOrderStatus } from "../services/orderService.js";
import { createAndDispatchNotification } from "../services/notificationService.js";
import { RECIPIENT_TYPES, NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { dispatchKotPrint } from "../services/kotService.js";

const restaurantRoom = (restaurantId) => `restaurant:${Number(restaurantId || 0)}`;
const branchRoom = (restaurantId, branchId) => `branch:${Number(restaurantId || 0)}:${Number(branchId || 0)}`;

const safeAck = (ack, payload) => {
  if (typeof ack === "function") {
    try {
      ack(payload);
    } catch {
      // ignore
    }
  }
};

export const initRealtime = ({ app, prisma, allowedOrigins = [], isOriginAllowed } = {}) => {
  const origins = Array.isArray(allowedOrigins) ? allowedOrigins.filter(Boolean) : [];

  const io = new SocketIOServer(app.server, {
    cors: {
      origin:
        typeof isOriginAllowed === "function"
          ? (origin, cb) => cb(null, isOriginAllowed(origin))
          : origins.length
            ? origins
            : true,
      credentials: true,
    },
  });

  const staff = io.of("/staff");

  staff.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token || "";
      if (!token) return next(new Error("unauthorized"));
      const decoded = app.jwt.verify(String(token));
      if (String(decoded?.type || "") === "customer") return next(new Error("forbidden"));
      socket.data.actor = {
        userId: Number(decoded?.id || 0) || null,
        role: String(decoded?.role || "").toUpperCase(),
        restaurantId: Number(decoded?.restaurantId || 0) || null,
        branchId: Number(decoded?.branchId || 0) || null,
      };
      if (!socket.data.actor.restaurantId && socket.data.actor.role !== "SUPER_ADMIN") return next(new Error("unauthorized"));
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  staff.on("connection", (socket) => {
    const actor = socket.data.actor || {};
    const rid = Number(actor.restaurantId || 0);
    const bid = Number(actor.branchId || 0);

    const rooms = [];
    if (rid) rooms.push(restaurantRoom(rid));
    if (rid && bid) rooms.push(branchRoom(rid, bid));
    if (rooms.length) socket.join(rooms);

    socket.on("order:create", async (payload, ack) => {
      try {
        const order = await createOrderByStaff({ prisma, actor, input: payload });
        await emitOrderCreated(order);
        safeAck(ack, { ok: true, order });
      } catch (err) {
        safeAck(ack, { ok: false, message: err?.message || "create_failed", code: err?.code || "" });
      }
    });

    socket.on("order:updateStatus", async (payload, ack) => {
      try {
        const orderId = Number(payload?.orderId || payload?.id || 0);
        const status = payload?.status;
        const updated = await updateOrderStatus({
          prisma,
          actor,
          orderId,
          nextStatus: status,
          notes: payload?.notes,
          changedByName: payload?.changedByName,
        });
        emitOrderUpdated(updated);
        safeAck(ack, { ok: true, order: updated });
      } catch (err) {
        safeAck(ack, { ok: false, message: err?.message || "update_failed", code: err?.code || "" });
      }
    });
  });

  const emitOrderCreated = async (order) => {
    const rid = Number(order?.restaurantId || 0);
    const bid = Number(order?.branchId || 0);
    if (!rid) return;
    let chain = staff.to(restaurantRoom(rid));
    if (bid) chain = chain.to(branchRoom(rid, bid));
    chain.emit("order:created", order);

    // Also broadcast to root Socket.IO rooms for restaurant subscribers
    if (io) {
      io.to(`restaurant_${rid}`).emit("new_order", order);
      io.to(`restaurant:${rid}`).emit("new_order", order);
    }

    // Broadcast station KOTs to kitchen & trigger thermal print dispatch
    const kots = Array.isArray(order?.kots) ? order.kots : [];
    for (const kot of kots) {
      chain.emit("kot:created", kot);
      if (io) {
        io.to(`restaurant_${rid}`).emit("kot:created", kot);
        io.to(`restaurant:${rid}`).emit("kot:created", kot);
      }
      dispatchKotPrint({ prisma, kotId: kot.id })
        .then((res) => {
          if (res?.kot) {
            chain.emit("kot:printed", res.kot);
            if (io) {
              io.to(`restaurant_${rid}`).emit("kot:printed", res.kot);
              io.to(`restaurant:${rid}`).emit("kot:printed", res.kot);
            }
          }
        })
        .catch(() => {});
    }

    // Dispatch notification to DB & realtime notification event for restaurant/owner
    try {
      const orderNo = order.orderNo || `#${order.id || ""}`;
      const total = order.total ? `₹${order.total}` : "";
      const tableInfo = order.tableNo ? `Table ${order.tableNo}` : "Takeaway / POS";
      const summaryText = `New order ${orderNo} (${tableInfo}) for ${total}.`;

      await createAndDispatchNotification({
        prisma,
        realtime: { io },
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: rid,
        restaurantId: rid,
        orderId: order.id,
        notificationType: NOTIFICATION_TYPES.NEW_ORDER,
        title: "🔔 New Order Received!",
        message: summaryText,
        data: { orderId: order.id, orderNo: order.orderNo, total: order.total, tableNo: order.tableNo },
        idempotencyKey: `staff_order_rest_${order.id}`,
      }).catch((e) => console.log("Staff order notification dispatch error:", e?.message));
    } catch (notifErr) {
      console.log("Order notification dispatch error:", notifErr?.message);
    }
  };

  const emitOrderUpdated = (order) => {
    const rid = Number(order?.restaurantId || 0);
    const bid = Number(order?.branchId || 0);
    if (!rid) return;
    let chain = staff.to(restaurantRoom(rid));
    if (bid) chain = chain.to(branchRoom(rid, bid));
    chain.emit("order:updated", order);
  };

  const emitTableSessionUpdated = (session) => {
    const rid = Number(session?.restaurantId || 0);
    if (!rid) return;
    staff.to(restaurantRoom(rid)).emit("table:session_updated", session);
    if (io) {
      io.to(`restaurant_${rid}`).emit("table:session_updated", session);
      io.to(`restaurant:${rid}`).emit("table:session_updated", session);
    }
  };

  const emitReservationUpdated = (reservation) => {
    const rid = Number(reservation?.restaurantId || 0);
    if (!rid) return;
    staff.to(restaurantRoom(rid)).emit("reservation:updated", reservation);
    if (io) {
      io.to(`restaurant_${rid}`).emit("reservation:updated", reservation);
      io.to(`restaurant:${rid}`).emit("reservation:updated", reservation);
    }
  };

  const emitInventoryUpdated = (restaurantId, data = {}) => {
    const rid = Number(restaurantId || 0);
    if (!rid) return;
    staff.to(restaurantRoom(rid)).emit("inventory:stock-updated", data);
    if (io) {
      io.to(`restaurant_${rid}`).emit("inventory:stock-updated", data);
      io.to(`restaurant:${rid}`).emit("inventory:stock-updated", data);
    }
  };

  return {
    io,
    staff,
    emitOrderCreated,
    emitOrderUpdated,
    emitTableSessionUpdated,
    emitReservationUpdated,
    emitInventoryUpdated,
  };
};

export const emitInventoryUpdated = (io, restaurantId, data = {}) => {
  const rid = Number(restaurantId || 0);
  if (!rid) return;
  try {
    if (io) {
      if (typeof io.of === "function") {
        io.of("/staff").to(`restaurant:${rid}`).emit("inventory:stock-updated", data);
      }
      if (typeof io.to === "function") {
        io.to(`restaurant_${rid}`).emit("inventory:stock-updated", data);
        io.to(`restaurant:${rid}`).emit("inventory:stock-updated", data);
      }
    }
  } catch (err) {
    console.log("Socket inventory broadcast error:", err?.message);
  }
};

