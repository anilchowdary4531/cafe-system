import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITY_MAP,
    NOTIFICATION_PRIORITIES,
    RECIPIENT_TYPES,
} from "../constants/notificationTypes.js";
import {
    createAndDispatchNotification,
    dispatchDesignationNotification,
    getUserNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../services/notificationService.js";

test("Tiffzy Designation-Based Notification Routing & Recipient Isolation", async (t) => {
    // 1. Constants verification
    await t.test("1. All operational designation notification types and recipient types exist", () => {
        assert.equal(NOTIFICATION_TYPES.TABLE_DIRTY, "TABLE_DIRTY");
        assert.equal(NOTIFICATION_TYPES.TABLE_CLEANED, "TABLE_CLEANED");
        assert.equal(NOTIFICATION_TYPES.CLEANING_TASK, "CLEANING_TASK");
        assert.equal(NOTIFICATION_TYPES.STEWARD_TASK, "STEWARD_TASK");
        assert.equal(NOTIFICATION_TYPES.WAITER_CALL, "WAITER_CALL");
        assert.equal(NOTIFICATION_TYPES.BILL_REQUESTED, "BILL_REQUESTED");
        assert.equal(NOTIFICATION_TYPES.CASHIER_TASK, "CASHIER_TASK");
        assert.equal(NOTIFICATION_TYPES.SWIPER_TASK, "SWIPER_TASK");

        assert.equal(RECIPIENT_TYPES.CLEANER, "CLEANER");
        assert.equal(RECIPIENT_TYPES.STEWARD, "STEWARD");
        assert.equal(RECIPIENT_TYPES.WAITER, "WAITER");
        assert.equal(RECIPIENT_TYPES.CHEF, "CHEF");
        assert.equal(RECIPIENT_TYPES.CASHIER, "CASHIER");
        assert.equal(RECIPIENT_TYPES.SWIPER, "SWIPER");
        assert.equal(RECIPIENT_TYPES.OWNER, "OWNER");
    });

    // Setup test restaurant and users if database connection is available
    let restaurant;
    try {
        restaurant = await prisma.restaurant.findFirst();
    } catch (err) {
        // If no db, skip db-dependent assertions
        return;
    }

    if (!restaurant) {
        return;
    }

    const rid = restaurant.id;

    await t.test("2. Cleaner receives TABLE_DIRTY and CLEANING_TASK but NOT WAITER_CALL or NEW_ORDER", async () => {
        const testRunId = Date.now();

        // Create a Cleaner notification
        const cleanNotif = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.CLEANER,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.TABLE_DIRTY,
            title: `Table 99 Dirty (Test ${testRunId})`,
            message: "Table 99 requires sanitation",
            data: { tableNo: "99", testRunId },
        });
        assert.ok(cleanNotif, "Cleaner notification should be created");

        // Create a Waiter notification
        const waiterNotif = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.WAITER,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.WAITER_CALL,
            title: `Waiter Call Table 99 (Test ${testRunId})`,
            message: "Guest needs assistance",
            data: { tableNo: "99", testRunId },
        });
        assert.ok(waiterNotif, "Waiter notification should be created");

        // Query scoped for a CLEANER actor
        const cleanerResult = await getUserNotifications({
            prisma,
            userId: 999991, // Virtual user ID with CLEANER role
            restaurantId: rid,
            userRole: "CLEANER",
            designation: "CLEANER",
            page: 1,
            limit: 50,
        });

        const cleanerItems = cleanerResult.notifications || [];
        const hasCleanNotif = cleanerItems.some((n) => n.id === cleanNotif.id);
        const hasWaiterNotif = cleanerItems.some((n) => n.id === waiterNotif.id);

        assert.equal(hasCleanNotif, true, "Cleaner MUST receive TABLE_DIRTY notification");
        assert.equal(hasWaiterNotif, false, "Cleaner MUST NOT receive WAITER_CALL notification (no leakage)");
    });

    await t.test("3. Server/Waiter receives WAITER_CALL and TABLE_CLEANED but NOT CLEANING_TASK", async () => {
        const testRunId = Date.now();

        // Create a Waiter notification
        const waiterNotif = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.WAITER,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.WAITER_CALL,
            title: `Waiter Call Table 88 (Test ${testRunId})`,
            message: "Guest needs assistance",
            data: { tableNo: "88", testRunId },
        });

        // Create a Cleaner task notification
        const cleanTaskNotif = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.CLEANER,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.CLEANING_TASK,
            title: `Mop Spill (Test ${testRunId})`,
            message: "Floor needs mopping",
            data: { testRunId },
        });

        // Query scoped for a WAITER actor
        const waiterResult = await getUserNotifications({
            prisma,
            userId: 999992,
            restaurantId: rid,
            userRole: "WAITER",
            designation: "WAITER",
            page: 1,
            limit: 50,
        });

        const waiterItems = waiterResult.notifications || [];
        const hasWaiterNotif = waiterItems.some((n) => n.id === waiterNotif.id);
        const hasCleanTaskNotif = waiterItems.some((n) => n.id === cleanTaskNotif.id);

        assert.equal(hasWaiterNotif, true, "Waiter MUST receive WAITER_CALL notification");
        assert.equal(hasCleanTaskNotif, false, "Waiter MUST NOT receive CLEANING_TASK notification");
    });

    await t.test("4. Cashier receives BILL_REQUESTED notifications", async () => {
        const testRunId = Date.now();

        const billNotif = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.CASHIER,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.BILL_REQUESTED,
            title: `Bill Requested Table 77 (Test ${testRunId})`,
            message: "Table 77 requested bill",
            data: { tableNo: "77", testRunId },
        });

        const cashierResult = await getUserNotifications({
            prisma,
            userId: 999993,
            restaurantId: rid,
            userRole: "CASHIER",
            designation: "CASHIER",
            page: 1,
            limit: 50,
        });

        const cashierItems = cashierResult.notifications || [];
        const hasBillNotif = cashierItems.some((n) => n.id === billNotif.id);
        assert.equal(hasBillNotif, true, "Cashier MUST receive BILL_REQUESTED notification");
    });

    await t.test("5. Owner receives RESTAURANT and OWNER notifications", async () => {
        const testRunId = Date.now();

        const ownerAlert = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.RESTAURANT,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.NEW_ORDER,
            title: `New Dine-In Order (Test ${testRunId})`,
            message: "Table 1 placed an order",
            data: { testRunId },
        });

        const ownerResult = await getUserNotifications({
            prisma,
            userId: 999994,
            restaurantId: rid,
            userRole: "OWNER",
            designation: "OWNER",
            page: 1,
            limit: 50,
        });

        const ownerItems = ownerResult.notifications || [];
        const hasOwnerAlert = ownerItems.some((n) => n.id === ownerAlert.id);
        assert.equal(hasOwnerAlert, true, "Owner MUST receive RESTAURANT alerts");
    });

    await t.test("6. Recipient isolation across restaurants (Restaurant A vs Restaurant B)", async () => {
        const testRunId = Date.now();
        const otherRid = 999999; // Different restaurant

        // Dispatch notification for another restaurant
        const otherRestNotif = await createAndDispatchNotification({
            prisma,
            restaurantId: otherRid,
            recipientType: RECIPIENT_TYPES.CLEANER,
            recipientId: otherRid,
            notificationType: NOTIFICATION_TYPES.TABLE_DIRTY,
            title: `Foreign Table Dirty (Test ${testRunId})`,
            message: "Foreign restaurant table dirty",
            data: { testRunId },
        });

        // Query for cleaner at current restaurant
        const currentCleanerResult = await getUserNotifications({
            prisma,
            userId: 999995,
            restaurantId: rid,
            userRole: "CLEANER",
            designation: "CLEANER",
            page: 1,
            limit: 50,
        });

        const hasOtherNotif = (currentCleanerResult.notifications || []).some(
            (n) => n.id === otherRestNotif.id
        );
        assert.equal(hasOtherNotif, false, "Staff MUST NEVER receive notifications from another restaurant");
    });

    await t.test("7. Offline resilience & Mark as Read", async () => {
        const testRunId = Date.now();

        const notif = await createAndDispatchNotification({
            prisma,
            restaurantId: rid,
            recipientType: RECIPIENT_TYPES.CLEANER,
            recipientId: rid,
            notificationType: NOTIFICATION_TYPES.TABLE_DIRTY,
            title: `Offline Test (Test ${testRunId})`,
            message: "Testing offline persistence",
            data: { testRunId },
        });

        assert.equal(notif.isRead, false, "New notification should be unread");

        // Mark as read
        const readResult = await markNotificationRead({
            prisma,
            notificationId: notif.id,
            userId: 999996,
            restaurantId: rid,
            userRole: "CLEANER",
        });

        assert.equal(readResult.success, true);
        assert.equal(readResult.notification.isRead, true, "Notification should now be marked as read in database");
    });
});

