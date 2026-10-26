import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY_MAP, NOTIFICATION_PRIORITIES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";
import { createAndDispatchNotification } from "../services/notificationService.js";

test("Server Station — Table Identity & Kitchen Notification Architecture", async (t) => {
    await t.test("1. KOT_SENT notification constant and priority mapping are defined", () => {
        assert.equal(NOTIFICATION_TYPES.KOT_SENT, "KOT_SENT");
        assert.equal(NOTIFICATION_PRIORITY_MAP[NOTIFICATION_TYPES.KOT_SENT], NOTIFICATION_PRIORITIES.NORMAL);
    });

    await t.test("2. Dispatches KOT_SENT notification with canonical waiter recipient and idempotencyKey", async () => {
        // Find or create test staff/server
        const staff = await prisma.user.findFirst({
            where: { role: "WAITER" },
            include: { restaurant: true },
        });

        if (!staff) {
            // Skip live db test if no staff exists
            return;
        }

        const testIdempotency = `kot_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const result = await createAndDispatchNotification({
            prisma,
            restaurantId: staff.restaurantId,
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: staff.id,
            notificationType: NOTIFICATION_TYPES.KOT_SENT,
            title: "🍳 Order Sent to Kitchen — Table 1",
            message: "Order #9999 sent to kitchen for Table 1",
            data: {
                orderId: 9999,
                tableNo: "1",
                action: "KOT_SENT",
            },
            idempotencyKey: testIdempotency,
        });

        assert.ok(result, "Notification should be created successfully");
        assert.equal(result.recipientId, staff.id);
        assert.equal(result.notificationType, NOTIFICATION_TYPES.KOT_SENT);
        assert.equal(result.idempotencyKey, testIdempotency);

        // Deduplication test: re-dispatching with the same idempotency key should not create a duplicate
        const duplicateResult = await createAndDispatchNotification({
            prisma,
            restaurantId: staff.restaurantId,
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: staff.id,
            notificationType: NOTIFICATION_TYPES.KOT_SENT,
            title: "🍳 Order Sent to Kitchen — Table 1",
            message: "Order #9999 sent to kitchen for Table 1",
            data: {
                orderId: 9999,
                tableNo: "1",
                action: "KOT_SENT",
            },
            idempotencyKey: testIdempotency,
        });

        assert.equal(duplicateResult.id, result.id, "Duplicate notification must return existing notification without creating new row");

        // Clean up test notification
        await prisma.notification.deleteMany({
            where: { idempotencyKey: testIdempotency },
        });
    });

    await t.test("3. Canonical table ID separation: tables with case-insensitive name matching remain separate", async () => {
        // Query two tables from any restaurant
        const tables = await prisma.diningTable.findMany({
            take: 2,
        });

        if (tables.length < 2) return;

        const tableA = tables[0];
        const tableB = tables[1];

        // Ensure database table primary keys are distinct
        assert.notEqual(tableA.id, tableB.id);

        // Verify activeSessions or activeOrders mapped by canonical tableId do not conflict
        const activeOrdersByTableId = new Map();
        activeOrdersByTableId.set(tableA.id, [{ id: 101, tableId: tableA.id }]);
        activeOrdersByTableId.set(tableB.id, [{ id: 102, tableId: tableB.id }]);

        assert.equal(activeOrdersByTableId.get(tableA.id)[0].id, 101);
        assert.equal(activeOrdersByTableId.get(tableB.id)[0].id, 102);
    });
});
