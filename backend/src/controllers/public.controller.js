import { prisma } from '../config/prisma.js';
import { createAndDispatchNotification } from '../services/notificationService.js';
import { RECIPIENT_TYPES, NOTIFICATION_TYPES } from '../constants/notificationTypes.js';
import { getOrCreateActiveSession, recalculateSessionTotals } from '../services/tableSessionService.js';
import { createKotsForOrder, dispatchKotPrint } from '../services/kotService.js';

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
        tableNo: altTableNo,
        notes,
        fulfillment,
        items = [],
    } = req.body || {};

    const rawTableNo = tableNumber || altTableNo;
    const cleanTableNo = rawTableNo ? String(rawTableNo).trim() : null;

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
    const ids = items.map((i) => Number(i.id || i.menuItemId)).filter(Boolean);

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
        const db = map.get(Number(raw.id || raw.menuItemId));
        const rawPrice = Number(raw.price);
        const hasValidRawPrice = raw.price !== undefined && raw.price !== null && !Number.isNaN(rawPrice) && rawPrice >= 0;

        if (!db && !hasValidRawPrice) {
            throw new Error(`Invalid item ID: ${raw.id}`);
        }

        const qty = Number(raw.qty || raw.quantity || 1);
        const price = hasValidRawPrice ? rawPrice : Number(db.price);

        return {
            menuItemId: db?.id || null,
            itemName: db?.name || String(raw.name || raw.itemName || "Item").trim(),
            variantName: raw.variantName || null,
            selectedModifiers: raw.modifiers || null,
            qty,
            price,
            total: qty * price,
        };
    });

    // 💰 CALCULATIONS
    const subtotal = normalized.reduce((a, b) => a + b.total, 0);
    let taxAmount = 0;
    if (restaurant.taxEnabled && restaurant.defaultTaxPercent) {
        taxAmount = (subtotal * Number(restaurant.defaultTaxPercent)) / 100;
    }
    let serviceChargeAmount = 0;
    if (restaurant.serviceChargeEnabled && restaurant.serviceChargePercent) {
        serviceChargeAmount = (subtotal * Number(restaurant.serviceChargePercent)) / 100;
    }
    const total = subtotal + taxAmount + serviceChargeAmount;

    // 🏷️ LINK TABLE & TABLE SESSION
    let tableSessionId = null;
    let targetTable = null;

    if (cleanTableNo) {
        targetTable = await prisma.diningTable.findFirst({
            where: { restaurantId: restaurant.id, tableNo: cleanTableNo },
        });

        if (targetTable) {
            const activeSession = await getOrCreateActiveSession({
                prisma,
                restaurantId: restaurant.id,
                tableId: targetTable.id,
                guestCount: 1,
            });
            tableSessionId = activeSession.id;
        }
    }

    // 💾 CREATE ORDER
    const order = await prisma.order.create({
        data: {
            restaurantId: restaurant.id,
            orderNo: makeOrderNo(),
            orderSource: cleanTableNo ? "QR" : "ONLINE",
            fulfillment: fulfillment ? String(fulfillment).toUpperCase() : (cleanTableNo ? "DINE_IN" : "DELIVERY"),
            customerName: customerName ? String(customerName).trim() : (cleanTableNo ? `Table ${cleanTableNo} Guest` : "Customer"),
            phone: phone ? String(phone).trim() : null,
            tableNo: cleanTableNo,
            tableSessionId,
            notes: notes ? String(notes).trim() : null,
            subtotal,
            taxAmount,
            serviceChargeAmount,
            total,
            paymentStatus: 'PENDING',
            status: 'PLACED',
            items: {
                create: normalized.map((item) => ({
                    menuItemId: item.menuItemId,
                    itemName: item.itemName,
                    variantName: item.variantName,
                    selectedModifiers: item.selectedModifiers,
                    qty: item.qty,
                    price: item.price,
                    total: item.total,
                })),
            },
            statusEvents: {
                create: {
                    status: 'PLACED',
                    source: cleanTableNo ? 'QR' : 'ONLINE',
                },
            },
        },
        include: {
            items: true,
        },
    });

    // 🎫 CREATE KOTS FOR KITCHEN
    try {
        const kots = await createKotsForOrder({
            prisma,
            order,
        });
        order.kots = kots;
    } catch (kotErr) {
        console.warn("[placeCustomerOrder] KOT creation warning:", kotErr?.message);
    }

    // 📊 RECALCULATE TABLE SESSION TOTALS
    let updatedSession = null;
    if (tableSessionId) {
        try {
            updatedSession = await recalculateSessionTotals({ prisma, sessionId: tableSessionId });
        } catch (sessErr) {
            console.warn("[placeCustomerOrder] Session recalculate warning:", sessErr?.message);
        }
    }

    // 🔥 REAL-TIME SOCKET EMIT & NOTIFICATIONS
    const io = req.server.io;

    if (io) {
        const restRoom1 = `restaurant_${restaurant.id}`;
        const restRoom2 = `restaurant:${restaurant.id}`;

        io.to(restRoom1).emit("new_order", order);
        io.to(restRoom2).emit("new_order", order);
        io.to(restRoom1).emit("order:created", order);
        io.to(restRoom2).emit("order:created", order);

        if (Array.isArray(order.kots)) {
            for (const kot of order.kots) {
                io.to(restRoom1).emit("kot:created", kot);
                io.to(restRoom2).emit("kot:created", kot);
                dispatchKotPrint({ prisma, kotId: kot.id }).catch(() => {});
            }
        }

        if (updatedSession && targetTable) {
            io.to(restRoom1).emit("table:session_updated", updatedSession);
            io.to(restRoom2).emit("table:session_updated", updatedSession);
            io.to(restRoom1).emit("table:updated", { tableId: targetTable.id, status: updatedSession.status });
            io.to(restRoom2).emit("table:updated", { tableId: targetTable.id, status: updatedSession.status });
        }
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
        session: updatedSession,
    };
}