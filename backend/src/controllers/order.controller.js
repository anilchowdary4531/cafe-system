import { prisma } from '../config/prisma.js';

const allowed = [
    'PLACED',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'DELIVERED',
    'CANCELLED',
];

// ✅ LIVE ORDERS
export async function getLiveOrders(req) {
    const restaurantId = Number(req.params.restaurantId);

    return prisma.order.findMany({
        where: {
            restaurantId,
            status: {
                in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'],
            },
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
    });
}

// ✅ KITCHEN QUEUE
export async function getKitchenQueue(req) {
    const restaurantId = Number(req.params.restaurantId);

    return prisma.order.findMany({
        where: {
            restaurantId,
            status: {
                in: ['ACCEPTED', 'PREPARING'],
            },
        },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
    });
}

// ✅ UPDATE STATUS + REAL-TIME
export async function updateOrderStatus(req, reply) {
    const restaurantId = Number(req.params.restaurantId);
    const orderId = Number(req.params.orderId);
    const nextStatus = String(req.body?.status || '').toUpperCase();

    if (!allowed.includes(nextStatus)) {
        return reply.code(400).send({ message: 'Invalid status' });
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
    });

    if (!order || order.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: 'Order not found' });
    }

    const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
        include: { items: true },
    });

    // 🔥 SOCKET EMIT (STEP 6)
    const io = req.server.io; // for Fastify

    if (io) {
        io.to(`restaurant_${updated.restaurantId}`).emit(
            "order_updated",
            updated
        );
    }

    return {
        message: 'Order status updated',
        order: updated,
    };
}

// ✅ HISTORY
export async function getOrderHistory(req) {
    const restaurantId = Number(req.params.restaurantId);

    return prisma.order.findMany({
        where: {
            restaurantId,
            status: {
                in: ['DELIVERED', 'CANCELLED'],
            },
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
}
async function getOrCreateSession(restaurantId, tableNo) {
    let session = await prisma.tableSession.findFirst({
        where: {
            restaurantId,
            table: {
                tableNo: tableNo,
            },
            status: "OPEN",
        },
        include: { table: true },
    });

    if (!session) {
        const table = await prisma.diningTable.findFirst({
            where: { restaurantId, tableNo },
        });

        session = await prisma.tableSession.create({
            data: {
                restaurantId,
                tableId: table.id,
            },
        });
    }

    return session;
}
export async function getRunningBill(req, reply) {
    const { restaurantId, tableNo } = req.params;

    const session = await prisma.tableSession.findFirst({
        where: {
            restaurantId: Number(restaurantId),
            tableNo,
            status: "OPEN",
        },
        include: {
            orders: {
                include: { items: true },
            },
        },
    });

    if (!session) {
        return reply.send({ total: 0, orders: [] });
    }

    const total = session.orders.reduce(
        (sum, o) => sum + o.total,
        0
    );

    return {
        sessionId: session.id,
        total,
        orders: session.orders,
    };
}

export async function closeSession(req, reply) {
    const { sessionId } = req.params;

    await prisma.tableSession.update({
        where: { id: Number(sessionId) },
        data: {
            status: "CLOSED",
            closedAt: new Date(),
        },
    });

    return { message: "Bill closed" };
}
export async function placeCustomerOrder(req, reply) {
    const { slug } = req.params;
    const { tableNumber, items = [] } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
        where: { slug },
    });

    if (!restaurant) {
        return reply.code(404).send({ message: "Restaurant not found" });
    }

    // ✅ SESSION LINK
    const session = await getOrCreateSession(
        restaurant.id,
        tableNumber
    );

    const ids = items.map(i => Number(i.id));

    const dbItems = await prisma.menuItem.findMany({
        where: {
            id: { in: ids },
            restaurantId: restaurant.id,
        },
    });

    const map = new Map(dbItems.map(i => [i.id, i]));

    const normalized = items.map(raw => {
        const db = map.get(Number(raw.id));
        const qty = Number(raw.qty || 1);

        return {
            menuItemId: db.id,
            itemName: db.name,
            qty,
            price: db.price,
            total: qty * db.price,
        };
    });

    const total = normalized.reduce((a, b) => a + b.total, 0);

    const order = await prisma.order.create({
        data: {
            restaurantId: restaurant.id,
            sessionId: session.id, // 🔥 KEY LINE
            orderNo: `ORD-${Date.now()}`,
            tableNo: tableNumber,
            status: "PLACED",
            total,
            items: {
                create: normalized,
            },
        },
        include: { items: true },
    });

    // 🔥 SOCKET
    req.server.io
        .to(`restaurant_${restaurant.id}`)
        .emit("new_order", order);

    return { order };
}