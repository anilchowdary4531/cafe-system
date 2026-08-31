import { prisma } from '../config/prisma.js';
import { createAndDispatchNotification } from '../services/notificationService.js';
import { RECIPIENT_TYPES, NOTIFICATION_TYPES } from '../constants/notificationTypes.js';

// 🔢 ORDER NUMBER
function makeOrderNo() {
    return `ORD-${Date.now()}`;
}

// ✅ GET MENU
export async function getRestaurantMenu(req, reply) {
    const { slug } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
        where: { slug },
        include: {
            menuItems: {
                where: { isAvailable: true },
                orderBy: { id: 'desc' },
            },
        },
    });

    if (!restaurant) {
        return reply.code(404).send({ message: 'Restaurant not found' });
    }

    return {
        restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            logo: restaurant.logo,
            taxEnabled: restaurant.taxEnabled,
            defaultTaxPercent: restaurant.defaultTaxPercent,
        },
        menu: restaurant.menuItems,
    };
}

// ✅ PLACE ORDER (FINAL CLEAN VERSION)
export async function placeCustomerOrder(req, reply) {
    const { slug } = req.params;

    const {
        customerName,
        phone,
        tableNumber,
        notes,
        items = [],
    } = req.body || {};

    // 🔍 FIND RESTAURANT
    const restaurant = await prisma.restaurant.findUnique({
        where: { slug },
    });

    if (!restaurant) {
        return reply.code(404).send({ message: 'Restaurant not found' });
    }

    if (!items.length) {
        return reply.code(400).send({ message: 'No items selected' });
    }

    // 🔍 FETCH MENU ITEMS
    const ids = items.map((i) => Number(i.id));

    const dbItems = await prisma.menuItem.findMany({
        where: {
            id: { in: ids },
            restaurantId: restaurant.id,
            isAvailable: true,
        },
    });

    const map = new Map(dbItems.map((i) => [i.id, i]));

    // 🧠 NORMALIZE ITEMS
    const normalized = items.map((raw) => {
        const db = map.get(Number(raw.id));
        const rawPrice = Number(raw.price);
        const hasValidRawPrice = raw.price !== undefined && raw.price !== null && !Number.isNaN(rawPrice) && rawPrice >= 0;

        if (!db && !hasValidRawPrice) {
            throw new Error(`Invalid item ID: ${raw.id}`);
        }

        const qty = Number(raw.qty || 1);
        const price = hasValidRawPrice ? rawPrice : Number(db.price);

        return {
            menuItemId: db?.id || null,
            itemName: db?.name || String(raw.name || raw.itemName || "Item").trim(),
            qty,
            price,
            total: qty * price,
        };
    });

    // 💰 CALCULATIONS
    const subtotal = normalized.reduce((a, b) => a + b.total, 0);
    const taxAmount = 0;
    const serviceChargeAmount = 0;
    const total = subtotal;

    // 💾 CREATE ORDER
    const order = await prisma.order.create({
        data: {
            restaurantId: restaurant.id,
            orderNo: makeOrderNo(),
            customerName,
            phone,
            tableNo: tableNumber,
            notes,
            subtotal,
            taxAmount,
            serviceChargeAmount,
            total,
            paymentStatus: 'PENDING',
            status: 'PLACED',
            items: {
                create: normalized,
            },
        },
        include: {
            items: true,
        },
    });

    // 🔥 REAL-TIME SOCKET EMIT & NOTIFICATIONS
    const io = req.server.io;

    if (io) {
        io.to(`restaurant_${restaurant.id}`).emit("new_order", order);
        io.to(`restaurant:${restaurant.id}`).emit("new_order", order);
    }

    // 🔔 Create DB Notifications for Restaurant Owner & Customer
    try {
        const orderSummaryText = `New order #${order.orderNo} for ₹${order.total}${order.customerName ? ` from ${order.customerName}` : ''}${order.tableNo ? ` (Table ${order.tableNo})` : ''}.`;
        
        await createAndDispatchNotification({
            prisma,
            realtime: { io },
            recipientType: RECIPIENT_TYPES.RESTAURANT,
            recipientId: restaurant.id,
            restaurantId: restaurant.id,
            orderId: order.id,
            notificationType: NOTIFICATION_TYPES.NEW_ORDER,
            title: "🔔 New Order Received!",
            message: orderSummaryText,
            data: { orderId: order.id, orderNo: order.orderNo, total: order.total, tableNo: order.tableNo },
            idempotencyKey: `order_created_rest_${order.id}`,
        }).catch((e) => console.log("Notif dispatch error:", e?.message));

        if (phone) {
          const customerRecord = await prisma.customer.findFirst({ where: { phone: String(phone).trim() } });
          if (customerRecord) {
              await createAndDispatchNotification({
                  prisma,
                  realtime: { io },
                  recipientType: RECIPIENT_TYPES.CUSTOMER,
                  recipientId: customerRecord.id,
                  restaurantId: restaurant.id,
                  orderId: order.id,
                  notificationType: NOTIFICATION_TYPES.ORDER_PLACED,
                  title: "Order Placed Successfully! 🛒",
                  message: `Your order #${order.orderNo} for ₹${order.total} has been received by ${restaurant.name}.`,
                  data: { orderId: order.id, orderNo: order.orderNo, total: order.total },
                  idempotencyKey: `order_created_cust_${order.id}`,
              }).catch((e) => console.log("Notif dispatch error:", e?.message));
          }
        }
    } catch (notifErr) {
        console.log("Order notification failed:", notifErr?.message);
    }

    return {
        message: 'Order placed successfully',
        order,
    };
}