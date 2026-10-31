import prisma from "../prisma.js";
import { createAndDispatchNotification } from "../services/notificationService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";
import { updateOrderStatus } from "../services/orderService.js";

export default async function (fastify) {

    // ============================================
    // ALL ACTIVE DIRECT / POS / TABLE ORDERS
    // ============================================
    fastify.get("/owner/kitchen/orders/:restaurantId", async (req, reply) => {
        try {
            const { restaurantId } = req.params;

            const orders = await prisma.order.findMany({
                where: {
                    restaurantId: Number(restaurantId),
                    status: {
                        in: ["PLACED", "ACCEPTED", "PREPARING", "READY"],
                    },
                },
                include: {
                    items: true,
                },
                orderBy: {
                    createdAt: "asc",
                },
            });

            return orders;
        } catch (error) {
            console.error("Failed to fetch kitchen orders:", error);

            return reply.code(500).send({
                message: "Failed to fetch kitchen orders",
            });
        }
    });


    // ============================================
    // UPDATE ORDER STATUS
    // ============================================
    fastify.put("/owner/kitchen/order/:id/status", async (req, reply) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const allowedStatuses = [
                "PLACED",
                "ACCEPTED",
                "PREPARING",
                "READY",
                "DELIVERED",
                "CANCELLED",
            ];

            if (!allowedStatuses.includes(status)) {
                return reply.code(400).send({
                    message: "Invalid order status",
                });
            }

            const updated = await updateOrderStatus({
                prisma,
                actor: req.staffActor || { role: "KITCHEN", userId: null },
                orderId: Number(id),
                nextStatus: status,
                notes: req.body?.notes,
                changedByName: req.body?.changedByName || "Kitchen",
            });

            const io = fastify.io || fastify.server?.io;
            const staff = fastify.staff || fastify.server?.staff;
            const rid = Number(updated.restaurantId || 0);

            if (rid) {
                if (io) {
                    io.to(`restaurant_${rid}`).emit("order:updated", updated);
                    io.to(`restaurant:${rid}`).emit("order:updated", updated);
                }
                if (staff) {
                    staff.to(`restaurant_${rid}`).emit("order:updated", updated);
                    staff.to(`restaurant:${rid}`).emit("order:updated", updated);
                }
                const tableId = updated.tableId || updated.tableSession?.tableId;
                if (tableId) {
                    const tableUpdatePayload = {
                        restaurantId: rid,
                        tableId,
                        id: tableId,
                        tableNo: updated.tableNo,
                        activeOrderStatus: status,
                        version: Date.now(),
                    };
                    if (io) {
                        io.to(`restaurant_${rid}`).emit("table:updated", tableUpdatePayload);
                        io.to(`restaurant:${rid}`).emit("table:updated", tableUpdatePayload);
                    }
                    if (staff) {
                        staff.to(`restaurant_${rid}`).emit("table:updated", tableUpdatePayload);
                        staff.to(`restaurant:${rid}`).emit("table:updated", tableUpdatePayload);
                    }
                }
            }

            if (status === "READY" && updated?.restaurantId) {
                try {
                    const tableId = updated.tableId || updated.tableSession?.tableId || null;
                    await createAndDispatchNotification({
                        prisma,
                        realtime: fastify.realtime || { io: fastify.io, staff: fastify.staff },
                        recipientType: RECIPIENT_TYPES.RESTAURANT,
                        recipientId: updated.restaurantId,
                        restaurantId: updated.restaurantId,
                        orderId: updated.id,
                        notificationType: NOTIFICATION_TYPES.FOOD_READY || "FOOD_READY",
                        title: `🔔 Order Ready — Table ${updated.tableNo || "Takeaway"}`,
                        message: `Order #${updated.orderNo || updated.id} for Table ${updated.tableNo || "Takeaway"} is ready to serve!`,
                        data: {
                            orderId: updated.id,
                            tableId,
                            tableNo: updated.tableNo,
                            orderNo: updated.orderNo,
                            restaurantId: updated.restaurantId,
                            status: "READY",
                        },
                        idempotencyKey: `order_ready_${updated.id}_${updated.updatedAt?.getTime() || Date.now()}`,
                    }).catch((err) => console.warn("[KitchenRoute] READY notification warning:", err?.message));
                } catch (notifErr) {
                    console.warn("[KitchenRoute] Failed to send READY notification:", notifErr?.message);
                }
            }

            return updated;
        } catch (error) {
            console.error("Failed to update order status:", error);

            return reply.code(500).send({
                message: "Failed to update order status",
            });
        }
    });


    // ============================================
    // ACTIVE TABLE ORDERS
    // ============================================
    fastify.get("/owner/kitchen/table-items/:restaurantId", async (req, reply) => {
        try {
            const { restaurantId } = req.params;

            const orders = await prisma.order.findMany({
                where: {
                    restaurantId: Number(restaurantId),

                    // Only orders associated with a table
                    tableNo: {
                        not: null,
                    },

                    status: {
                        in: ["PLACED", "ACCEPTED", "PREPARING", "READY"],
                    },
                },

                include: {
                    items: true,
                    tableSession: {
                        select: { id: true, tableId: true, tableNo: true },
                    },
                },

                orderBy: {
                    createdAt: "asc",
                },
            });

            return orders.map((o) => ({
                ...o,
                tableId: o.tableSession?.tableId ? Number(o.tableSession.tableId) : null,
            }));
        } catch (error) {
            console.error("Failed to fetch table orders:", error);

            return reply.code(500).send({
                message: "Failed to fetch table orders",
            });
        }
    });


    // ============================================
    // UPDATE TABLE ORDER STATUS
    // ============================================
    fastify.put("/owner/kitchen/table-item/:id/status", async (req, reply) => {
        try {
            // Here :id represents the ORDER ID
            const { id } = req.params;
            const { status } = req.body;

            const allowedStatuses = [
                "PLACED",
                "ACCEPTED",
                "PREPARING",
                "READY",
                "DELIVERED",
                "CANCELLED",
            ];

            if (!allowedStatuses.includes(status)) {
                return reply.code(400).send({
                    message: "Invalid order status",
                });
            }

            const updated = await updateOrderStatus({
                prisma,
                actor: req.staffActor || { role: "KITCHEN", userId: null },
                orderId: Number(id),
                nextStatus: status,
                notes: req.body?.notes,
                changedByName: req.body?.changedByName || "Kitchen",
            });

            const io = fastify.io || fastify.server?.io;
            const staff = fastify.staff || fastify.server?.staff;
            const rid = Number(updated.restaurantId || 0);

            if (rid) {
                if (io) {
                    io.to(`restaurant_${rid}`).emit("order:updated", updated);
                    io.to(`restaurant:${rid}`).emit("order:updated", updated);
                }
                if (staff) {
                    staff.to(`restaurant_${rid}`).emit("order:updated", updated);
                    staff.to(`restaurant:${rid}`).emit("order:updated", updated);
                }
                const tableId = updated.tableId || updated.tableSession?.tableId;
                if (tableId) {
                    const tableUpdatePayload = {
                        restaurantId: rid,
                        tableId,
                        id: tableId,
                        tableNo: updated.tableNo,
                        activeOrderStatus: status,
                        version: Date.now(),
                    };
                    if (io) {
                        io.to(`restaurant_${rid}`).emit("table:updated", tableUpdatePayload);
                        io.to(`restaurant:${rid}`).emit("table:updated", tableUpdatePayload);
                    }
                    if (staff) {
                        staff.to(`restaurant_${rid}`).emit("table:updated", tableUpdatePayload);
                        staff.to(`restaurant:${rid}`).emit("table:updated", tableUpdatePayload);
                    }
                }
            }

            return updated;
        } catch (error) {
            console.error("Failed to update table order:", error);

            return reply.code(500).send({
                message: "Failed to update table order",
            });
        }
    });

}