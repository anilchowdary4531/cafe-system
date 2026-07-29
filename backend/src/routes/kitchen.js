import prisma from "../prisma.js";

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

            const order = await prisma.order.update({
                where: {
                    id: Number(id),
                },
                data: {
                    status,
                },
                include: {
                    items: true,
                },
            });

            return order;
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
                },

                orderBy: {
                    createdAt: "asc",
                },
            });

            return orders;
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

            const order = await prisma.order.update({
                where: {
                    id: Number(id),
                },
                data: {
                    status,
                },
                include: {
                    items: true,
                },
            });

            return order;
        } catch (error) {
            console.error("Failed to update table order:", error);

            return reply.code(500).send({
                message: "Failed to update table order",
            });
        }
    });

}