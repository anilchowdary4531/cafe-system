import prisma from "../prisma.js";

export default async function (fastify) {
    // GET MENU BY RESTAURANT SLUG
    fastify.get("/customer/menu/:slug", async (req) => {
        const { slug } = req.params;

        const restaurant = await prisma.restaurant.findUnique({
            where: { slug },
            include: {
                menuItems: {
                    where: { isAvailable: true },
                    orderBy: { id: "desc" },
                },
            },
        });

        return restaurant;
    });

    // GET / CREATE OPEN SESSION BY TABLE
    fastify.post("/customer/open-table", async (req) => {
        const { restaurantId, tableNo } = req.body;

        const table = await prisma.diningTable.findFirst({
            where: { restaurantId, tableNo },
        });

        let session = await prisma.tableSession.findFirst({
            where: {
                restaurantId,
                tableId: table.id,
                status: "OPEN",
            },
        });

        if (!session) {
            session = await prisma.tableSession.create({
                data: {
                    restaurantId,
                    tableId: table.id,
                    guestCount: 1,
                },
            });

            await prisma.diningTable.update({
                where: { id: table.id },
                data: { status: "OPEN" },
            });
        }

        return session;
    });

    // PLACE ORDER TO RUNNING BILL
    fastify.post("/customer/order", async (req) => {
        const { sessionId, items } = req.body;

        for (const item of items) {
            await prisma.tableOrderItem.create({
                data: {
                    sessionId,
                    menuItemId: item.id,
                    itemName: item.name,
                    qty: item.qty,
                    price: item.price,
                    total: item.qty * item.price,
                },
            });
        }

        const rows = await prisma.tableOrderItem.findMany({
            where: { sessionId },
        });

        const subtotal = rows.reduce(
            (sum, x) => sum + x.total,
            0
        );

        const taxAmount = 0;

        await prisma.tableSession.update({
            where: { id: sessionId },
            data: {
                subtotal,
                taxAmount,
                total: subtotal,
            },
        });

        return { success: true };
    });

    // LIVE BILL
    fastify.get("/customer/bill/:sessionId", async (req) => {
        const { sessionId } = req.params;

        return prisma.tableSession.findUnique({
            where: { id: Number(sessionId) },
            include: {
                items: true,
                table: true,
            },
        });
    });
}