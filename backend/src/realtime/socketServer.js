import { getPresenceManager } from "./presenceManager.js";
import { Server as SocketIOServer } from "socket.io";
import { createOrderByStaff, updateOrderStatus } from "../services/orderService.js";
import { createAndDispatchNotification } from "../services/notificationService.js";
import { RECIPIENT_TYPES, NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { dispatchKotPrint } from "../services/kotService.js";
import { getPhoneVariants } from "../services/phoneService.js";

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

  const presenceManager = getPresenceManager({ prisma, io, staffNamespace: staff });
  presenceManager.startupReset().catch((err) => {
    console.error("[socketServer] presenceManager startupReset error:", err?.message);
  });
  if (app) {
    app.presenceManager = presenceManager;
    app.io = io;
    app.staff = staff;
  }

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
    const uid = Number(actor.userId || 0);

    const rooms = [];
    if (rid) {
      rooms.push(restaurantRoom(rid));
      rooms.push(`restaurant_${rid}`);
    }
    if (rid && bid) rooms.push(branchRoom(rid, bid));
    if (uid) {
      rooms.push(`user:${uid}`);
      rooms.push(`user_${uid}`);
    }
    if (rooms.length) socket.join(rooms);

    if (actor.role === "SUPER_ADMIN") {
      socket.join("superadmin");
      socket.join("admin");
      presenceManager.getPresenceCounts().then((counts) => {
        socket.emit("customer:presence_updated", counts);
      }).catch(() => {});
    }

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

  io.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
      if (token && app?.jwt) {
        try {
          const decoded = app.jwt.verify(String(token));
          if (decoded) {
            socket.data.user = decoded;
            const cid = Number(decoded.customerAccountId || (decoded.type === "customer" ? decoded.id : 0));
            if (cid) {
              socket.data.customerAccountId = cid;
            }
            if (decoded.role === "SUPER_ADMIN") {
              socket.data.isSuperAdmin = true;
            }
          }
        } catch (jwtErr) {
          // Non-fatal handshake token validation failure
        }
      }
    } catch {
      // ignore
    }
    next();
  });

  // Handle root socket connections for delivery rooms and tracking
  io.on("connection", (socket) => {
    if (socket.data?.isSuperAdmin) {
      socket.join("superadmin");
      socket.join("admin");
      presenceManager.getPresenceCounts().then((counts) => {
        socket.emit("customer:presence_updated", counts);
      }).catch(() => {});
    }

    if (socket.data?.customerAccountId) {
      presenceManager.handleCustomerConnected(socket.data.customerAccountId, socket);
    }

    socket.on("authenticate", async (payload, ack) => {
      try {
        const token = payload?.token || payload?.authToken;
        if (!token || !app?.jwt) {
          safeAck(ack, { ok: false, message: "Missing token" });
          return;
        }
        const decoded = app.jwt.verify(String(token));
        const cid = Number(decoded?.customerAccountId || (decoded?.type === "customer" ? decoded?.id : 0));
        if (cid) {
          socket.data.customerAccountId = cid;
          await presenceManager.handleCustomerConnected(cid, socket);
          safeAck(ack, { ok: true, customerId: cid });
        } else if (decoded?.role === "SUPER_ADMIN") {
          socket.join("superadmin");
          socket.join("admin");
          const counts = await presenceManager.getPresenceCounts();
          socket.emit("customer:presence_updated", counts);
          safeAck(ack, { ok: true, role: "SUPER_ADMIN" });
        } else {
          safeAck(ack, { ok: false, message: "Unauthorized for customer presence" });
        }
      } catch (err) {
        safeAck(ack, { ok: false, message: err?.message || "auth_failed" });
      }
    });

    socket.on("customer:logout", async (payload, ack) => {
      const cid = socket.data?.customerAccountId || Number(payload?.customerId || 0);
      if (cid) {
        await presenceManager.handleCustomerLogout(cid);
        safeAck(ack, { ok: true });
      }
    });

    socket.on("disconnect", () => {
      presenceManager.handleCustomerDisconnected(socket.id);
    });
    socket.on("join_delivery_room", (payload) => {
      const did = payload?.deliveryId || payload?.id;
      const oid = payload?.orderId;
      if (did) socket.join(`delivery:${did}`);
      if (oid) socket.join(`order_${oid}`);
    });

    socket.on("leave_delivery_room", (payload) => {
      const did = payload?.deliveryId || payload?.id;
      const oid = payload?.orderId;
      if (did) socket.leave(`delivery:${did}`);
      if (oid) socket.leave(`order_${oid}`);
    });

    socket.on("join_supplier_room", (payload) => {
      const sid = payload?.supplierId || payload?.id;
      if (sid) {
        socket.join(`supplier_${sid}`);
        socket.join(`supplier:${sid}`);
      }
    });

    socket.on("join_restaurant_room", (payload) => {
      const rid = payload?.restaurantId;
      if (rid) {
        socket.join(`restaurant_${rid}`);
        socket.join(`restaurant:${rid}`);
      }
    });

    socket.on("join_table_room", (payload) => {
      const sid = payload?.sessionId || payload?.tableSessionId;
      const tid = payload?.tableId;
      const rid = payload?.restaurantId;
      if (sid) socket.join(`session_${sid}`);
      if (tid) socket.join(`table_${tid}`);
      if (rid) socket.join(`restaurant_${rid}`);
    });

    socket.on("join_customer_room", async (payload) => {
      const token = payload?.token || payload?.authToken || socket.handshake?.auth?.token || socket.handshake?.query?.token;
      if (token && app?.jwt) {
        try {
          const decoded = app.jwt.verify(String(token));
          const cid = Number(decoded?.customerAccountId || (decoded?.type === "customer" ? decoded?.id : 0));
          if (cid) {
            socket.data.customerAccountId = cid;
            await presenceManager.handleCustomerConnected(cid, socket);
          }
        } catch {
          // ignore
        }
      } else if (socket.data?.customerAccountId) {
        await presenceManager.handleCustomerConnected(socket.data.customerAccountId, socket);
      }
      const cid = payload?.customerId || payload?.id;
      const ids = Array.isArray(payload?.customerIds) ? payload.customerIds : (cid ? [cid] : []);
      ids.forEach((id) => {
        if (id) {
          socket.join(`customer_${id}`);
          socket.join(`customer:${id}`);
        }
      });
      const phone = payload?.phone;
      if (phone && prisma) {
        try {
          const variants = getPhoneVariants(phone);
          const [account, custs] = await Promise.all([
            prisma.customerAccount.findFirst({ where: { phone: { in: variants } }, select: { id: true } }),
            prisma.customer.findMany({ where: { phone: { in: variants } }, select: { id: true } }),
          ]);
          if (account?.id) {
            socket.join(`customer_${account.id}`);
            socket.join(`customer:${account.id}`);
          }
          custs.forEach((c) => {
            socket.join(`customer_${c.id}`);
            socket.join(`customer:${c.id}`);
          });
        } catch {
          // ignore
        }
      }
    });

    socket.on("leave_customer_room", (payload) => {
      const cid = payload?.customerId || payload?.id;
      const ids = Array.isArray(payload?.customerIds) ? payload.customerIds : (cid ? [cid] : []);
      ids.forEach((id) => {
        if (id) {
          socket.leave(`customer_${id}`);
          socket.leave(`customer:${id}`);
        }
      });
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
    if (io) {
      io.to(`restaurant_${rid}`).emit("order:updated", order);
      io.to(`restaurant:${rid}`).emit("order:updated", order);
      if (order?.tableSessionId) {
        io.to(`session_${order.tableSessionId}`).emit("order:status_updated", order);
      }
    }
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

  const emitTableAssignmentUpdated = (payload) => {
    const rid = Number(payload?.restaurantId || 0);
    if (!rid) return;
    if (staff) {
      staff.to(restaurantRoom(rid)).emit("table:updated", payload);
      staff.to(`restaurant_${rid}`).emit("table:updated", payload);
      staff.to(restaurantRoom(rid)).emit("table:waiter_assigned", payload);
      staff.to(`restaurant_${rid}`).emit("table:waiter_assigned", payload);
      if (payload?.assignedWaiterId) {
        staff.to(`user:${payload.assignedWaiterId}`).emit("table:waiter_assigned", payload);
        staff.to(`user_${payload.assignedWaiterId}`).emit("table:waiter_assigned", payload);
      }
    }
    if (io) {
      io.to(`restaurant_${rid}`).emit("table:updated", payload);
      io.to(`restaurant:${rid}`).emit("table:updated", payload);
      io.to(`restaurant_${rid}`).emit("table:waiter_assigned", payload);
      io.to(`restaurant:${rid}`).emit("table:waiter_assigned", payload);
    }
  };

  const emitToKitchenRoom = ({ restaurantId, event, payload, targetUserIds = [] } = {}) => {
    emitToKitchen({ io, staff, restaurantId, event, payload, targetUserIds });
  };

  return {
    io,
    staff,
    presenceManager,
    emitOrderCreated,
    emitOrderUpdated,
    emitTableSessionUpdated,
    emitTableAssignmentUpdated,
    emitReservationUpdated,
    emitInventoryUpdated,
    emitToKitchen: emitToKitchenRoom,
  };
};

export const emitToKitchen = ({ io, staff, restaurantId, event, payload, targetUserIds = [] } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!rid) return;
  const targetIds = Array.isArray(targetUserIds) ? targetUserIds.filter(Boolean) : (targetUserIds ? [targetUserIds] : []);

  // 1. Emit to /staff namespace (primary for staff frontend)
  if (staff) {
    try {
      staff.to(restaurantRoom(rid)).emit(event, payload);
      staff.to(`restaurant_${rid}`).emit(event, payload);
      for (const uid of targetIds) {
        staff.to(`user:${uid}`).emit(event, payload);
        staff.to(`user_${uid}`).emit(event, payload);
      }
    } catch (e) {
      console.error("[emitToKitchen staff error]", e?.message);
    }
  }

  // 2. Also emit to root io namespace for compatibility
  if (io) {
    try {
      if (typeof io.of === "function") {
        try {
          const s = io.of("/staff");
          s.to(restaurantRoom(rid)).emit(event, payload);
          s.to(`restaurant_${rid}`).emit(event, payload);
          for (const uid of targetIds) {
            s.to(`user:${uid}`).emit(event, payload);
            s.to(`user_${uid}`).emit(event, payload);
          }
        } catch {}
      }
      io.to(restaurantRoom(rid)).emit(event, payload);
      io.to(`restaurant_${rid}`).emit(event, payload);
      for (const uid of targetIds) {
        io.to(`user:${uid}`).emit(event, payload);
        io.to(`user_${uid}`).emit(event, payload);
      }
    } catch (e) {
      console.error("[emitToKitchen io error]", e?.message);
    }
  }
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

