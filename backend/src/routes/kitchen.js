import prisma from "../prisma.js";

export default async function (fastify) {
    // ALL ACTIVE DIRECT / POS ORDERS
    fastify.get("/owner/kitchen/orders/:restaurantId", async (req) => {
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
    });

    // UPDATE ORDER STATUS
    fastify.put("/owner/kitchen/order/:id/status", async (req) => {
        const { id } = req.params;
        const { status } = req.body;

        return prisma.order.update({
            where: { id: Number(id) },
            data: { status },
        });
    });

    // ACTIVE RUNNING BILL ITEMS
    fastify.get("/owner/kitchen/table-items/:restaurantId", async (req) => {
        const { restaurantId } = req.params;

        return prisma.tableOrderItem.findMany({
            where: {
                session: {
                    restaurantId: Number(restaurantId),
                    status: "OPEN",
                },
                status: {
                    in: ["PLACED", "PREPARING", "READY"],
                },
            },
            include: {
                session: {
                    include: {
                        table: true,
                    },
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });
    });

    // UPDATE TABLE ITEM STATUS
    fastify.put("/owner/kitchen/table-item/:id/status", async (req) => {
        const { id } = req.params;
        const { status } = req.body;

        return prisma.tableOrderItem.update({
            where: { id: Number(id) },
            data: { status },
        });
    });


}