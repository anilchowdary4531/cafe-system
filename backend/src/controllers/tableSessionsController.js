import prisma from "../prisma.js";

export async function openSession(req, reply) {
    const { tableId } = req.params;
    const { guestCount = 1, restaurantId } = req.body;

    const session = await prisma.tableSession.create({
        data: {
            tableId: Number(tableId),
            restaurantId,
            guestCount,
            status: "OPEN",
        },
    });

    await prisma.diningTable.update({
        where: { id: Number(tableId) },
        data: { status: "OPEN" },
    });

    reply.send(session);
}

export async function getSession(req, reply) {
    const { sessionId } = req.params;

    const session = await prisma.tableSession.findUnique({
        where: { id: Number(sessionId) },
        include: {
            items: {
                orderBy: { createdAt: "asc" },
            },
            table: true,
        },
    });

    reply.send(session);
}

export async function addItems(req, reply) {
    const { sessionId } = req.params;
    const { items } = req.body;

    for (const item of items) {
        await prisma.tableOrderItem.create({
            data: {
                sessionId: Number(sessionId),
                menuItemId: item.menuItemId,
                itemName: item.itemName,
                qty: item.qty,
                price: item.price,
                total: item.qty * item.price,
            },
        });
    }

    const rows = await prisma.tableOrderItem.findMany({
        where: { sessionId: Number(sessionId) },
    });

    const subtotal = rows.reduce((a, b) => a + b.total, 0);
    const taxAmount = +(subtotal * 0.05).toFixed(2);
    const total = subtotal + taxAmount;

    await prisma.tableSession.update({
        where: { id: Number(sessionId) },
        data: { subtotal, taxAmount, total },
    });

    reply.send({ success: true });
}

export async function closeSession(req, reply) {
    const { sessionId } = req.params;

    const session = await prisma.tableSession.update({
        where: { id: Number(sessionId) },
        data: {
            status: "CLOSED",
            paymentStatus: "PAID",
            closedAt: new Date(),
        },
        include: { table: true },
    });

    await prisma.diningTable.update({
        where: { id: session.tableId },
        data: { status: "FREE" },
    });

    reply.send(session);
}

export async function getRunningBill(req, reply) {
    const { tableNo } = req.params;

    const session = await req.server.prisma.tableSession.findFirst({
        where: {
            table: {
                tableNo: tableNo,
            },
            status: "OPEN",
        },
        include: {
            items: true,
        },
    });

    if (!session) {
        return reply.code(404).send({
            message: "No active session",
        });
    }

    return session;
}

export async function getTableSession(req, reply) {
    try {
        const tableId = Number(req.params.tableId);

        if (!tableId) {
            return reply.code(400).send({ message: "Invalid tableId" });
        }

        // ✅ FIND ACTIVE SESSION DIRECTLY (BEST APPROACH)
        const session = await prisma.tableSession.findFirst({
            where: {
                tableId,
                status: "OPEN",
            },
            include: {
                items: true,
            },
        });

        // ✅ IF NO SESSION → CREATE ONE (AUTO CREATE FLOW)
        if (!session) {
            const newSession = await prisma.tableSession.create({
                data: {
                    tableId,
                    restaurantId: 1, // 🔥 replace dynamically later
                    status: "OPEN",
                },
            });

            return newSession;
        }

        return session;
    } catch (err) {
        console.error(err);
        return reply.code(500).send({
            message: "Failed to get session",
            error: err.message,
        });
    }
}