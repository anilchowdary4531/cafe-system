import { prisma } from '../config/prisma.js';

const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

function buildQrUrl(slug, tableNo) {
    return `${frontendBase}/r/${slug}?table=${encodeURIComponent(tableNo)}`;
}

export async function getTables(req) {
    const restaurantId = Number(req.params.restaurantId);

    return prisma.diningTable.findMany({
        where: { restaurantId },
        orderBy: { id: 'desc' },
    });
}

export async function createTable(req, reply) {
    const restaurantId = Number(req.params.restaurantId);
    const { tableNo, seats, isActive } = req.body || {};

    if (!tableNo) {
        return reply.code(400).send({ message: 'Table number required' });
    }

    const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { slug: true },
    });

    const table = await prisma.diningTable.create({
        data: {
            restaurantId,
            tableNo,
            seats: Number(seats || 4),
            isActive: isActive ?? true,
            qrCodeUrl: buildQrUrl(restaurant.slug, tableNo),
        },
    });

    return table;
}

export async function updateTable(req) {
    const tableId = Number(req.params.tableId);
    const { tableNo, seats, isActive, qrCodeUrl } = req.body || {};

    return prisma.diningTable.update({
        where: { id: tableId },
        data: {
            tableNo,
            seats: seats !== undefined ? Number(seats) : undefined,
            isActive,
            qrCodeUrl,
        },
    });
}

export async function deleteTable(req) {
    const tableId = Number(req.params.tableId);
    await prisma.diningTable.delete({ where: { id: tableId } });
    return { message: 'Table deleted' };
}

export async function regenerateQr(req) {
    const tableId = Number(req.params.tableId);

    const table = await prisma.diningTable.findUnique({
        where: { id: tableId },
        include: { restaurant: true },
    });

    const qrCodeUrl = buildQrUrl(table.restaurant.slug, table.tableNo);

    return prisma.diningTable.update({
        where: { id: tableId },
        data: { qrCodeUrl },
    });
}
export const getTableSession = async (req, reply) => {
    const { tableId } = req.params;

    let session = await prisma.tableSession.findFirst({
        where: {
            tableId: Number(tableId),
            status: "OPEN",
        },
        include: {
            items: true,
        },
    });

    // create if not exists
    if (!session) {
        const table = await prisma.diningTable.findUnique({
            where: { id: Number(tableId) },
        });

        session = await prisma.tableSession.create({
            data: {
                tableId: table.id,
                restaurantId: table.restaurantId,
                status: "OPEN",
            },
            include: { items: true },
        });
    }

    return session;
};

/**
 * ADD ITEM TO SESSION
 */
export const addItemToSession = async (req, reply) => {
    const { tableId } = req.params;
    const { menuItemId, qty = 1 } = req.body;

    const session = await prisma.tableSession.findFirst({
        where: {
            tableId: Number(tableId),
            status: "OPEN",
        },
    });

    const item = await prisma.menuItem.findUnique({
        where: { id: Number(menuItemId) },
    });

    const total = item.price * qty;

    await prisma.tableOrderItem.create({
        data: {
            sessionId: session.id,
            menuItemId: item.id,
            itemName: item.name,
            qty,
            price: item.price,
            total,
        },
    });

    // 🔁 recalc totals
    const items = await prisma.tableOrderItem.findMany({
        where: { sessionId: session.id },
    });

    const subtotal = items.reduce((a, b) => a + b.total, 0);

    await prisma.tableSession.update({
        where: { id: session.id },
        data: {
            subtotal,
            total: subtotal,
        },
    });

    return { message: "Item added" };
};

/**
 * CLOSE SESSION
 */
export const closeSession = async (req, reply) => {
    const { tableId } = req.params;

    const session = await prisma.tableSession.findFirst({
        where: {
            tableId: Number(tableId),
            status: "OPEN",
        },
    });

    await prisma.tableSession.update({
        where: { id: session.id },
        data: {
            status: "CLOSED",
            closedAt: new Date(),
        },
    });

    return { message: "Bill closed" };
};