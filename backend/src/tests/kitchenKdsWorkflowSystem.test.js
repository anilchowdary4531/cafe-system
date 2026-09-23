import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
    createKotsForOrder,
    getNextKotNumber,
    updateKotStatus,
    updateKotItemStatus,
    updateKotPriority,
    reprintKot,
    dispatchKotPrint,
} from "../services/kotService.js";

test("Feature 19 - Kitchen KDS & KOT Operations Workflow Integration Suite", async (t) => {
    let testRestaurant = null;
    let testRestaurantB = null;
    let hotStation = null;
    let barStation = null;
    let pizzaItem = null;
    let cokeItem = null;
    let testOrder = null;

    t.before(async () => {
        // 1. Setup primary test restaurant
        testRestaurant = await prisma.restaurant.create({
            data: {
                name: "KDS Master Bistro",
                slug: `kds-bistro-${Date.now()}`,
                nextKotNumber: 101,
            },
        });

        // 2. Setup secondary test restaurant for tenant isolation testing
        testRestaurantB = await prisma.restaurant.create({
            data: {
                name: "KDS Isolated Cafe",
                slug: `kds-isolated-${Date.now()}`,
                nextKotNumber: 1,
            },
        });

        // 3. Create Kitchen Stations for primary restaurant
        hotStation = await prisma.kitchenStation.create({
            data: {
                restaurantId: testRestaurant.id,
                name: "HOT KITCHEN",
                code: "HOT",
                description: "Main Cooking & Pizza Station",
                isDefault: true,
            },
        });

        barStation = await prisma.kitchenStation.create({
            data: {
                restaurantId: testRestaurant.id,
                name: "BAR",
                code: "BAR",
                description: "Beverage & Cocktail Station",
                isDefault: false,
            },
        });

        // 4. Create Menu Items routed to specific stations
        pizzaItem = await prisma.menuItem.create({
            data: {
                restaurantId: testRestaurant.id,
                name: "Gourmet Pizza",
                category: "Mains",
                price: 450,
                kitchenStationId: hotStation.id,
                prepTimeMinutes: 20,
            },
        });

        cokeItem = await prisma.menuItem.create({
            data: {
                restaurantId: testRestaurant.id,
                name: "Chilled Coke",
                category: "Beverages",
                price: 80,
                kitchenStationId: barStation.id,
                prepTimeMinutes: 5,
            },
        });
    });

    t.after(async () => {
        // Cleanup created records
        if (testRestaurant) {
            await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: testRestaurant.id } } });
            await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: testRestaurant.id } });
            await prisma.orderItem.deleteMany({ where: { order: { restaurantId: testRestaurant.id } } });
            await prisma.order.deleteMany({ where: { restaurantId: testRestaurant.id } });
            await prisma.menuItem.deleteMany({ where: { restaurantId: testRestaurant.id } });
            await prisma.kitchenStation.deleteMany({ where: { restaurantId: testRestaurant.id } });
            await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
        }
        if (testRestaurantB) {
            await prisma.restaurant.delete({ where: { id: testRestaurantB.id } });
        }
    });

    await t.test("1. KOT sequence numbering is backend-authoritative & sequential", async () => {
        const res1 = await getNextKotNumber(prisma, testRestaurant.id);
        const res2 = await getNextKotNumber(prisma, testRestaurant.id);

        assert.strictEqual(res1.seq, 101);
        assert.strictEqual(res1.kotNo, "KOT-101");
        assert.strictEqual(res2.seq, 102);
        assert.strictEqual(res2.kotNo, "KOT-102");
    });

    await t.test("2. Multi-station order routing splits items into station-specific KOTs", async () => {
        // Create an order containing 1 Gourmet Pizza (HOT KITCHEN) and 1 Chilled Coke (BAR)
        testOrder = await prisma.order.create({
            data: {
                restaurantId: testRestaurant.id,
                orderNo: `ORD-KDS-${Date.now()}`,
                orderSource: "QR",
                tableNo: "12",
                status: "PLACED",
                priority: "HIGH",
                subtotal: 530,
                total: 530,
                notes: "Extra crispy crust",
                items: {
                    create: [
                        {
                            menuItemId: pizzaItem.id,
                            itemName: pizzaItem.name,
                            variantName: "Large",
                            variantPrice: 450,
                            selectedModifiers: [{ name: "Extra Cheese" }, { name: "No Onion" }],
                            qty: 1,
                            price: 450,
                            total: 450,
                        },
                        {
                            menuItemId: cokeItem.id,
                            itemName: cokeItem.name,
                            qty: 2,
                            price: 80,
                            total: 160,
                        },
                    ],
                },
            },
            include: { items: true },
        });

        const createdKots = await createKotsForOrder({
            prisma,
            order: testOrder,
            actor: { userId: 99, userName: "Waiter Alex" },
        });

        assert.strictEqual(createdKots.length, 2, "Order with items for 2 stations must create 2 separate KOTs");

        const hotKot = createdKots.find((k) => k.stationId === hotStation.id);
        const barKot = createdKots.find((k) => k.stationId === barStation.id);

        assert.ok(hotKot, "HOT KITCHEN KOT ticket must exist");
        assert.ok(barKot, "BAR KOT ticket must exist");

        // Verify Hot Kitchen Ticket
        assert.strictEqual(hotKot.stationName, "HOT KITCHEN");
        assert.strictEqual(hotKot.priority, "HIGH");
        assert.strictEqual(hotKot.estimatedPrepTimeMinutes, 20);
        assert.strictEqual(hotKot.items.length, 1);
        assert.strictEqual(hotKot.items[0].itemName, "Gourmet Pizza");
        assert.strictEqual(hotKot.items[0].variantName, "Large");
        assert.strictEqual(hotKot.items[0].selectedModifiers[0].name, "Extra Cheese");

        // Verify Bar Ticket
        assert.strictEqual(barKot.stationName, "BAR");
        assert.strictEqual(barKot.priority, "HIGH");
        assert.strictEqual(barKot.estimatedPrepTimeMinutes, 5);
        assert.strictEqual(barKot.items.length, 1);
        assert.strictEqual(barKot.items[0].itemName, "Chilled Coke");
        assert.strictEqual(barKot.items[0].qty, 2);
    });

    await t.test("3. KOT state transitions and invalid status rejection", async () => {
        const kots = await prisma.kitchenOrderTicket.findMany({ where: { orderId: testOrder.id } });
        const hotKot = kots.find((k) => k.stationId === hotStation.id);

        // Advance to PREPARING
        const res1 = await updateKotStatus({
            prisma,
            kotId: hotKot.id,
            restaurantId: testRestaurant.id,
            nextStatus: "PREPARING",
        });

        assert.strictEqual(res1.status || res1.kot?.status, "PREPARING");

        // Attempt invalid status
        await assert.rejects(
            async () => {
                await updateKotStatus({
                    prisma,
                    kotId: hotKot.id,
                    restaurantId: testRestaurant.id,
                    nextStatus: "INVALID_STATUS_NAME",
                });
            },
            /Invalid KOT status/i
        );
    });

    await t.test("4. Item-level status updates & parent Order readiness auto-sync", async () => {
        const kots = await prisma.kitchenOrderTicket.findMany({
            where: { orderId: testOrder.id },
            include: { items: true },
        });

        const hotKot = kots.find((k) => k.stationId === hotStation.id);
        const barKot = kots.find((k) => k.stationId === barStation.id);

        // Mark Bar item READY
        const resBar = await updateKotItemStatus({
            prisma,
            kotId: barKot.id,
            itemId: barKot.items[0].id,
            restaurantId: testRestaurant.id,
            nextStatus: "READY",
            actor: { userId: 5, userName: "Bartender Sam" },
        });

        assert.strictEqual(resBar.kot.status, "READY", "Bar KOT should auto-advance to READY when all its items are READY");

        // Check parent order is still PREPARING because Hot Kitchen KOT is not ready yet
        const midOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
        assert.strictEqual(midOrder.status, "PREPARING");

        // Mark Hot Kitchen item READY
        const resHot = await updateKotItemStatus({
            prisma,
            kotId: hotKot.id,
            itemId: hotKot.items[0].id,
            restaurantId: testRestaurant.id,
            nextStatus: "READY",
            actor: { userId: 12, userName: "Chef Gordon" },
        });

        assert.strictEqual(resHot.kot.status, "READY");

        // Now parent order MUST be READY since all KOTs for the order are READY
        const finalOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
        assert.strictEqual(finalOrder.status, "READY", "Parent Order status must sync to READY when all station KOTs are READY");
    });

    await t.test("5. Order & KOT priority updates with authorization scoping", async () => {
        const kots = await prisma.kitchenOrderTicket.findMany({ where: { orderId: testOrder.id } });
        const hotKot = kots[0];

        const updatedKot = await updateKotPriority({
            prisma,
            kotId: hotKot.id,
            restaurantId: testRestaurant.id,
            priority: "URGENT",
        });

        assert.strictEqual(updatedKot.priority, "URGENT");

        const updatedOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
        assert.strictEqual(updatedOrder.priority, "URGENT");
    });

    await t.test("6. KOT Reprint increments count without duplicate items or revenue corruption", async () => {
        const kots = await prisma.kitchenOrderTicket.findMany({ where: { orderId: testOrder.id }, include: { items: true } });
        const targetKot = kots[0];

        const result = await reprintKot({
            prisma,
            kotId: targetKot.id,
            restaurantId: testRestaurant.id,
        });

        const reloadedKot = await prisma.kitchenOrderTicket.findUnique({
            where: { id: targetKot.id },
            include: { items: true },
        });

        assert.strictEqual(reloadedKot.reprintCount, 1, "Reprint count must increment");
        assert.strictEqual(reloadedKot.items.length, targetKot.items.length, "Reprint must NOT duplicate items");

        const order = await prisma.order.findUnique({ where: { id: testOrder.id } });
        assert.strictEqual(order.total, 530, "Billing total must remain unaltered during reprint");
    });

    await t.test("7. Cross-tenant isolation blocks unauthorized access", async () => {
        const kots = await prisma.kitchenOrderTicket.findMany({ where: { orderId: testOrder.id } });
        const targetKot = kots[0];

        // Attempting to update Restaurant A's KOT using Restaurant B's ID must fail
        await assert.rejects(
            async () => {
                await updateKotStatus({
                    prisma,
                    kotId: targetKot.id,
                    restaurantId: testRestaurantB.id,
                    nextStatus: "SERVED",
                });
            },
            /kot_not_found/i
        );
    });

    await t.test("8. Printer failure handling preserves KOT state for retry", async () => {
        const kots = await prisma.kitchenOrderTicket.findMany({ where: { orderId: testOrder.id } });
        const targetKot = kots[0];

        // Attempt dispatch without mapped IP printer
        const res = await dispatchKotPrint({ prisma, kotId: targetKot.id });

        assert.strictEqual(res.ok, false);
        assert.ok(res.message);

        const reloadedKot = await prisma.kitchenOrderTicket.findUnique({ where: { id: targetKot.id } });
        assert.ok(reloadedKot, "KOT must NOT be deleted or dropped when printer is missing or fails");
    });
});
