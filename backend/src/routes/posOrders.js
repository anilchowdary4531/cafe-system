import prisma from "../prisma.js";
import { calculateBill } from "../services/billingService.js";

/**
 * Legacy POS Order Endpoint
 * Secured to enforce authenticated restaurant context, tenant isolation,
 * authoritative database menu item price lookup, and billingService.calculateBill().
 */
export default async function (fastify) {
    fastify.post("/owner/pos-order", async (req, reply) => {
        try {
            // Enforce authenticated restaurant context
            const actor = req.staffActor || req.user;
            const authRestaurantId = Number(actor?.restaurantId || 0);

            const {
                restaurantId,
                customerName,
                paymentMode,
                items = [],
                tip = 0,
            } = req.body || {};

            const requestedRid = Number(restaurantId);

            // Cross-tenant access protection
            if (authRestaurantId && requestedRid && authRestaurantId !== requestedRid && actor?.role !== "SUPER_ADMIN") {
                return reply.code(403).send({ message: "restaurant_access_denied" });
            }

            const rid = authRestaurantId || requestedRid;
            if (!rid) {
                return reply.code(400).send({ message: "restaurantId is required" });
            }

            const restaurant = await prisma.restaurant.findUnique({
                where: { id: rid },
                select: {
                    id: true,
                    name: true,
                    taxEnabled: true,
                    taxType: true,
                    defaultTaxPercent: true,
                    serviceChargeEnabled: true,
                    serviceChargePercent: true,
                    billingConfig: true,
                },
            });

            if (!restaurant) {
                return reply.code(404).send({ message: "Restaurant not found" });
            }

            const rawItems = Array.isArray(items) ? items : [];
            if (!rawItems.length) {
                return reply.code(400).send({ message: "items_required" });
            }

            const itemIds = [
                ...new Set(
                    rawItems
                        .map((it) => Number(it?.menuItemId || it?.id || 0))
                        .filter((id) => id > 0)
                ),
            ];

            // Fetch authoritative item records from database for this restaurant
            const dbItems = await prisma.menuItem.findMany({
                where: {
                    id: { in: itemIds },
                    restaurantId: rid,
                    isAvailable: true,
                },
            });

            const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));

            // Validate items and discard client-supplied prices
            const authoritativeItems = [];
            for (const rawItem of rawItems) {
                const itemId = Number(rawItem?.menuItemId || rawItem?.id || 0);
                const dbItem = dbItemMap.get(itemId);
                if (!dbItem) {
                    return reply.code(400).send({ message: `invalid_menu_item: ${itemId}` });
                }
                const qty = Math.max(1, Number(rawItem.qty || 1));
                authoritativeItems.push({
                    menuItemId: dbItem.id,
                    itemName: dbItem.name,
                    price: Number(dbItem.price),
                    qty,
                });
            }

            // Authoritative bill calculation via billingService
            const bill = calculateBill({
                items: authoritativeItems.map((item) => ({
                    price: item.price,
                    qty: item.qty,
                })),
                orderType: "POS",
                billingConfig: restaurant.billingConfig,
                taxEnabled: Boolean(restaurant.taxEnabled),
                taxType: restaurant.taxType,
                taxPercent: restaurant.defaultTaxPercent,
                serviceChargeEnabled: Boolean(restaurant.serviceChargeEnabled),
                serviceChargePercent: restaurant.serviceChargePercent,
                tip,
            });

            const count = await prisma.order.count({
                where: { restaurantId: rid },
            });

            const orderNo = `POS-${count + 1}`;

            const order = await prisma.order.create({
                data: {
                    restaurantId: rid,
                    orderNo,
                    orderSource: "POS",
                    fulfillment: "POS",
                    customerName: customerName || "POS Customer",
                    subtotal: bill.subtotal,
                    taxAmount: bill.taxAmount,
                    serviceChargeAmount: bill.serviceChargeAmount,
                    discountAmount: bill.discountAmount,
                    total: bill.total,
                    billingSnapshot: bill.snapshot,
                    paymentMode: paymentMode || "CASH",
                    paymentStatus: "PAID",
                    status: "PLACED",

                    items: {
                        create: authoritativeItems.map((item) => ({
                            menuItemId: item.menuItemId,
                            itemName: item.itemName,
                            qty: item.qty,
                            price: item.price,
                            total: item.qty * item.price,
                        })),
                    },
                },
                include: { items: true },
            });

            return reply.send(order);
        } catch (err) {
            console.error("[posOrders error]:", err);
            return reply.code(500).send({ message: err.message, stack: err.stack });
        }
    });
}