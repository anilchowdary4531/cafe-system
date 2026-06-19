import {
    openSession,
    getSession,
    addItems,
    closeSession,
} from "../controllers/tableSessionsController.js";

import { getTableSession } from "../controllers/tableSessionsController.js";

export default async function (fastify) {

    // ✅ EXISTING (KEEP)
    fastify.post("/owner/table/:tableId/open", openSession);
    fastify.get("/owner/session/:sessionId", getSession);
    fastify.post("/owner/session/:sessionId/add-items", addItems);
    fastify.post("/owner/session/:sessionId/close", closeSession);

    // 🔥 NEW (FRONTEND FRIENDLY)

    // 👉 GET OR CREATE SESSION BY TABLE
    fastify.get("/tables/:tableId/session", async (req, reply) => {
        const { tableId } = req.params;

        let session = await fastify.prisma.tableSession.findFirst({
            where: {
                tableId: Number(tableId),
                status: "OPEN",
            },
            include: { items: true },
        });

        if (!session) {
            const table = await fastify.prisma.diningTable.findUnique({
                where: { id: Number(tableId) },
            });

            session = await fastify.prisma.tableSession.create({
                data: {
                    tableId: table.id,
                    restaurantId: table.restaurantId,
                },
                include: { items: true },
            });
        }

        return session;
    });

    // 👉 ADD ITEM (TABLE BASED)
    fastify.post("/tables/:tableId/add-item", async (req, reply) => {
        const { tableId } = req.params;
        const { menuItemId, qty = 1 } = req.body;

        const session = await fastify.prisma.tableSession.findFirst({
            where: {
                tableId: Number(tableId),
                status: "OPEN",
            },
        });

        const item = await fastify.prisma.menuItem.findUnique({
            where: { id: Number(menuItemId) },
        });

        await fastify.prisma.tableOrderItem.create({
            data: {
                sessionId: session.id,
                menuItemId: item.id,
                itemName: item.name,
                qty,
                price: item.price,
                total: item.price * qty,
            },
        });

        return { message: "Item added" };
    });

    // 👉 CLOSE BILL (TABLE BASED)
    fastify.post("/tables/:tableId/close", async (req, reply) => {
        const { tableId } = req.params;

        const session = await fastify.prisma.tableSession.findFirst({
            where: {
                tableId: Number(tableId),
                status: "OPEN",
            },
        });

        await fastify.prisma.tableSession.update({
            where: { id: session.id },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
            },
        });

        return { message: "Bill closed" };
    });
}
