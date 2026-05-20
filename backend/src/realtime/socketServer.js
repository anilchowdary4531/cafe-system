import { Server as SocketIOServer } from "socket.io";
import { createOrderByStaff, updateOrderStatus } from "../services/orderService.js";

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
        emitOrderCreated(order);
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

  const emitOrderCreated = (order) => {
    const rid = Number(order?.restaurantId || 0);
    const bid = Number(order?.branchId || 0);
    if (!rid) return;
    let chain = staff.to(restaurantRoom(rid));
    if (bid) chain = chain.to(branchRoom(rid, bid));
    chain.emit("order:created", order);
  };

  const emitOrderUpdated = (order) => {
    const rid = Number(order?.restaurantId || 0);
    const bid = Number(order?.branchId || 0);
    if (!rid) return;
    let chain = staff.to(restaurantRoom(rid));
    if (bid) chain = chain.to(branchRoom(rid, bid));
    chain.emit("order:updated", order);
  };

  return {
    io,
    staff,
    emitOrderCreated,
    emitOrderUpdated,
  };
};
