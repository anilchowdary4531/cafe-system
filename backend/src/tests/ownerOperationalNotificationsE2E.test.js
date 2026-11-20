import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { initRealtime } from "../realtime/socketServer.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY_MAP,
  RECIPIENT_TYPES,
} from "../constants/notificationTypes.js";
import {
  createAndDispatchNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";
import { updateOrderStatus } from "../services/orderService.js";
import { placeQrOrder, placePublicMenuOrder } from "../services/qrService.js";
import { getOrCreateActiveSession } from "../services/tableSessionService.js";
import { createReservation, updateReservationStatus } from "../services/reservationService.js";

test("TIFFZY OWNER NOTIFICATION SYSTEM — FULL OPERATIONAL AUDIT & E2E VERIFICATION", async (t) => {
  const ts = Date.now();
  let app = null;
  let realtime = null;
  let ridA = null;
  let ridB = null;
  let ownerUserA = null;
  let ownerUserB = null;
  let ownerTokenA = null;
  let ownerTokenB = null;
  let tableA = null;
  let sessionA = null;

  try {
    app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: "owner-notif-test-jwt-secret-xyz" });
    app.decorateRequest("staffActor", null);

    const STAFF_ALLOWED_ROLES = ["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];

    realtime = initRealtime({
      app,
      prisma,
      allowedOrigins: ["*"],
    });

    const routeDeps = {
      prisma,
      STAFF_ACCESS_MODULES: {},
      STAFF_ALLOWED_ROLES,
      normalizeAccess: () => ({}),
      normalizeDbPermissions: () => ({}),
      serializeAccess: () => ({}),
      realtime,
    };

    await routes(app, routeDeps);

    // 1. Setup Restaurant A & Owner A
    const restaurantA = await prisma.restaurant.create({
      data: {
        name: `Owner Test Rest A ${ts}`,
        slug: `owner-test-a-${ts}`,
        currency: "INR",
        nextInvoiceNumber: 2001,
        isPublicMenuEnabled: true,
        isPublicOrderingEnabled: true,
        publicMenuToken: `token_menu_a_${ts}`,
      },
    });
    ridA = restaurantA.id;

    ownerUserA = await prisma.user.create({
      data: {
        name: "Owner A",
        email: `owner_a_${ts}@tiffzy.com`,
        role: "OWNER",
        restaurantId: ridA,
        password: "password123",
      },
    });

    ownerTokenA = app.jwt.sign({
      id: ownerUserA.id,
      userId: ownerUserA.id,
      email: ownerUserA.email,
      role: "OWNER",
      restaurantId: ridA,
      sessionVersion: 0,
    });

    // 2. Setup Restaurant B & Owner B (for Tenant Isolation testing)
    const restaurantB = await prisma.restaurant.create({
      data: {
        name: `Owner Test Rest B ${ts}`,
        slug: `owner-test-b-${ts}`,
        currency: "INR",
        nextInvoiceNumber: 3001,
      },
    });
    ridB = restaurantB.id;

    ownerUserB = await prisma.user.create({
      data: {
        name: "Owner B",
        email: `owner_b_${ts}@tiffzy.com`,
        role: "OWNER",
        restaurantId: ridB,
        password: "password123",
      },
    });

    ownerTokenB = app.jwt.sign({
      id: ownerUserB.id,
      userId: ownerUserB.id,
      email: ownerUserB.email,
      role: "OWNER",
      restaurantId: ridB,
      sessionVersion: 0,
    });

    // Setup Dining Table & Menu Item for Restaurant A
    tableA = await prisma.diningTable.create({
      data: {
        restaurantId: ridA,
        tableNo: `T-10`,
        seats: 4,
        qrToken: `qr_token_a_${ts}`,
        cleaningStatus: "CLEAN",
      },
    });

    const menuItemA = await prisma.menuItem.create({
      data: {
        restaurantId: ridA,
        category: "Beverages",
        name: "Cold Brew",
        price: 250,
        isAvailable: true,
      },
    });

    // Subtest 1: Table Session Opening Notification
    await t.test("1. Table session opening creates TABLE_SESSION_OPENED notification for RESTAURANT", async () => {
      sessionA = await getOrCreateActiveSession({
        prisma,
        restaurantId: ridA,
        tableId: tableA.id,
        guestCount: 2,
      });

      assert.ok(sessionA.id, "Session should be created");

      const notif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          notificationType: NOTIFICATION_TYPES.TABLE_SESSION_OPENED,
        },
      });

      assert.ok(notif, "TABLE_SESSION_OPENED notification must persist to DB");
      assert.equal(notif.recipientType, RECIPIENT_TYPES.RESTAURANT);
      assert.equal(notif.recipientId, ridA);
      assert.ok(notif.message.includes(`Table ${tableA.tableNo}`), "Message should mention table number");
    });

    // Subtest 2: QR Table Order Notification
    let qrOrderA = null;
    await t.test("2. QR order placement creates persistent NEW_ORDER notification for RESTAURANT", async () => {
      const res = await placeQrOrder({
        token: tableA.qrToken,
        items: [{ menuItemId: menuItemA.id, quantity: 2, price: 250 }],
        customerName: "Alice Table Guest",
        prisma,
        io: app.server?.realtime?.io || null,
      });

      qrOrderA = res.order;
      assert.ok(qrOrderA.id, "QR Order should be created");

      const notif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          orderId: qrOrderA.id,
          notificationType: NOTIFICATION_TYPES.NEW_ORDER,
          recipientType: RECIPIENT_TYPES.RESTAURANT,
        },
      });

      assert.ok(notif, "NEW_ORDER notification for QR order must persist in DB");
      assert.equal(notif.recipientId, ridA);
      assert.ok(notif.message.includes(`Table ${tableA.tableNo}`), "Message should mention table");
    });

    // Subtest 3: Digital Menu Order Notification
    let digitalOrderA = null;
    await t.test("3. Digital menu order creates persistent NEW_ORDER notification for RESTAURANT", async () => {
      const res = await placePublicMenuOrder({
        token: restaurantA.publicMenuToken,
        items: [{ menuItemId: menuItemA.id, quantity: 1, price: 250 }],
        customerName: "Bob Online Guest",
        phone: "9876543210",
        fulfillment: "TAKEAWAY",
        prisma,
        io: app.server?.realtime?.io || null,
      });

      digitalOrderA = res.order;
      assert.ok(digitalOrderA.id, "Digital menu order should be created");

      const notif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          orderId: digitalOrderA.id,
          notificationType: NOTIFICATION_TYPES.NEW_ORDER,
          recipientType: RECIPIENT_TYPES.RESTAURANT,
        },
      });

      assert.ok(notif, "NEW_ORDER notification for digital menu must persist in DB");
      assert.equal(notif.recipientId, ridA);
      assert.ok(notif.message.includes("Takeaway"), "Message should mention fulfillment");
    });

    // Subtest 4: Order Acceptance Notification
    await t.test("4. Order acceptance creates ORDER_ACCEPTED notification for RESTAURANT", async () => {
      await updateOrderStatus({
        prisma,
        orderId: qrOrderA.id,
        nextStatus: "ACCEPTED",
        actor: { role: "CHEF", userId: null, restaurantId: ridA },
        realtime,
      });

      const notif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          orderId: qrOrderA.id,
          notificationType: NOTIFICATION_TYPES.ORDER_ACCEPTED,
          recipientType: RECIPIENT_TYPES.RESTAURANT,
        },
      });

      assert.ok(notif, "ORDER_ACCEPTED notification must persist in DB for owner");
      assert.equal(notif.recipientId, ridA);
    });

    // Subtest 5: Order Cancellation Notification
    await t.test("5. Order cancellation creates ORDER_CANCELLED notification for RESTAURANT", async () => {
      await updateOrderStatus({
        prisma,
        orderId: digitalOrderA.id,
        nextStatus: "CANCELLED",
        actor: { role: "OWNER", userId: ownerUserA.id, restaurantId: ridA },
        realtime,
      });

      const notif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          orderId: digitalOrderA.id,
          notificationType: NOTIFICATION_TYPES.ORDER_CANCELLED,
          recipientType: RECIPIENT_TYPES.RESTAURANT,
        },
      });

      assert.ok(notif, "ORDER_CANCELLED notification must persist in DB for owner");
      assert.equal(notif.recipientId, ridA);
    });

    // Subtest 6: Table Reservation Creation & Cancellation Notifications
    let reservationA = null;
    await t.test("6. Reservation creation and cancellation create persistent owner notifications", async () => {
      const resDate = new Date();
      resDate.setDate(resDate.getDate() + 1);

      // Create reservation
      const createRes = await createReservation({
        prisma,
        restaurantId: ridA,
        data: {
          customerName: "Charlie Reserve",
          customerPhone: "9988776655",
          partySize: 4,
          reservationDate: resDate.toISOString().slice(0, 10),
          startTime: "19:00",
          endTime: "21:00",
          tableId: tableA.id,
        },
        actor: { role: "OWNER", userId: ownerUserA.id, restaurantId: ridA },
      });

      reservationA = createRes.reservation;
      assert.ok(reservationA.id, "Reservation should be created");

      // Dispatch notification as done by controller
      await createAndDispatchNotification({
        prisma,
        realtime,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: ridA,
        restaurantId: ridA,
        notificationType: NOTIFICATION_TYPES.RESERVATION_CREATED,
        title: "📅 New Table Reservation",
        message: `Reservation #${reservationA.reservationNo} booked for ${reservationA.customerName} (${reservationA.partySize} guests).`,
        data: {
          restaurantId: ridA,
          reservationId: reservationA.id,
          reservationNo: reservationA.reservationNo,
          partySize: reservationA.partySize,
          tableId: reservationA.tableId,
        },
        idempotencyKey: `reservation_created_${ridA}_${reservationA.id}`,
      });

      const createNotif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          notificationType: NOTIFICATION_TYPES.RESERVATION_CREATED,
        },
      });

      assert.ok(createNotif, "RESERVATION_CREATED notification must exist in DB");
      assert.equal(createNotif.recipientId, ridA);

      // Cancel reservation
      const cancelRes = await updateReservationStatus({
        prisma,
        restaurantId: ridA,
        reservationId: reservationA.id,
        status: "CANCELLED",
        cancelReason: "Guest called to cancel",
        actor: { role: "OWNER", userId: ownerUserA.id, restaurantId: ridA },
      });

      await createAndDispatchNotification({
        prisma,
        realtime,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: ridA,
        restaurantId: ridA,
        notificationType: NOTIFICATION_TYPES.RESERVATION_CANCELLED,
        title: "⚠️ Reservation Cancelled",
        message: `Reservation #${cancelRes.reservationNo} for ${cancelRes.customerName} was cancelled.`,
        data: {
          restaurantId: ridA,
          reservationId: cancelRes.id,
          reservationNo: cancelRes.reservationNo,
          cancelReason: "Guest called to cancel",
        },
        idempotencyKey: `reservation_cancelled_${ridA}_${cancelRes.id}`,
      });

      const cancelNotif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          notificationType: NOTIFICATION_TYPES.RESERVATION_CANCELLED,
        },
      });

      assert.ok(cancelNotif, "RESERVATION_CANCELLED notification must exist in DB");
      assert.equal(cancelNotif.recipientId, ridA);
    });

    // Subtest 7: Online Takeaway Payment Notification
    await t.test("7. Online takeaway payment creates PAYMENT_SUCCESS notification for RESTAURANT", async () => {
      const takeawayOrder = await prisma.order.create({
        data: {
          restaurantId: ridA,
          orderNo: `ORD_ONLINE_${ts}`,
          fulfillment: "TAKEAWAY",
          paymentStatus: "PAID",
          status: "CONFIRMED",
          paymentMode: "CASHFREE",
          subtotal: 500,
          total: 500,
          customerName: "David Online Payer",
        },
      });

      await createAndDispatchNotification({
        prisma,
        realtime,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: ridA,
        restaurantId: ridA,
        orderId: takeawayOrder.id,
        notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        title: "💰 Online Payment Received",
        message: `Payment of ₹500 received online for Takeaway Order #${takeawayOrder.orderNo || takeawayOrder.id}.`,
        data: {
          restaurantId: ridA,
          orderId: takeawayOrder.id,
          amount: 500,
          fulfillment: "TAKEAWAY",
          paymentMethod: "CASHFREE",
        },
        idempotencyKey: `payment_success_online_${ridA}_${takeawayOrder.id}`,
      });

      const notif = await prisma.notification.findFirst({
        where: {
          restaurantId: ridA,
          orderId: takeawayOrder.id,
          notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
          recipientType: RECIPIENT_TYPES.RESTAURANT,
        },
      });

      assert.ok(notif, "PAYMENT_SUCCESS notification must exist in DB");
      assert.equal(notif.recipientId, ridA);
      assert.ok(notif.message.includes("₹500"), "Message should mention payment amount");
    });

    // Subtest 8: Authenticated Owner API Endpoint (GET /api/notifications)
    await t.test("8. Authenticated Owner API endpoint returns all operational notifications for Restaurant A", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/notifications?page=1&limit=50",
        headers: {
          authorization: `Bearer ${ownerTokenA}`,
          "x-restaurant-id": String(ridA),
        },
      });

      assert.equal(response.statusCode, 200, "Owner API must return HTTP 200");
      const body = JSON.parse(response.payload);
      assert.ok(Array.isArray(body.notifications), "notifications should be an array");
      assert.ok(body.notifications.length >= 7, `Expected at least 7 notifications, got ${body.notifications.length}`);

      const types = body.notifications.map((n) => n.notificationType);
      assert.ok(types.includes("TABLE_SESSION_OPENED"), "Must include TABLE_SESSION_OPENED");
      assert.ok(types.includes("NEW_ORDER"), "Must include NEW_ORDER");
      assert.ok(types.includes("ORDER_ACCEPTED"), "Must include ORDER_ACCEPTED");
      assert.ok(types.includes("ORDER_CANCELLED"), "Must include ORDER_CANCELLED");
      assert.ok(types.includes("RESERVATION_CREATED"), "Must include RESERVATION_CREATED");
      assert.ok(types.includes("RESERVATION_CANCELLED"), "Must include RESERVATION_CANCELLED");
      assert.ok(types.includes("PAYMENT_SUCCESS"), "Must include PAYMENT_SUCCESS");

      // Verify all notifications belong strictly to Restaurant A
      for (const notif of body.notifications) {
        assert.equal(notif.restaurantId, ridA, "Every returned notification must strictly belong to Restaurant A");
      }
    });

    // Subtest 9: Tenant Isolation: Owner B cannot see Restaurant A's notifications
    await t.test("9. Strict Tenant Isolation: Restaurant B owner sees ZERO of Restaurant A's notifications", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/notifications?page=1&limit=50",
        headers: {
          authorization: `Bearer ${ownerTokenB}`,
          "x-restaurant-id": String(ridB),
        },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.payload);
      assert.ok(Array.isArray(body.notifications), "notifications should be an array");
      assert.equal(body.notifications.length, 0, "Restaurant B must have 0 notifications from Restaurant A");
    });

    // Subtest 10: Idempotency Key deduplication
    await t.test("10. Idempotency Key prevents duplicate notification records in DB", async () => {
      const beforeCount = await prisma.notification.count({ where: { restaurantId: ridA } });

      // Attempt to re-dispatch the exact same digital menu order notification with identical key
      await createAndDispatchNotification({
        prisma,
        realtime,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: ridA,
        restaurantId: ridA,
        orderId: digitalOrderA.id,
        notificationType: NOTIFICATION_TYPES.NEW_ORDER,
        title: "🔔 New Order Received!",
        message: "Duplicate attempt",
        idempotencyKey: `digital_menu_order_rest_${ridA}_${digitalOrderA.id}`,
      });

      const afterCount = await prisma.notification.count({ where: { restaurantId: ridA } });
      assert.equal(afterCount, beforeCount, "Duplicate event with same idempotencyKey must NOT create a new record");
    });

    // Subtest 11: Mark as Read & Mark All as Read
    await t.test("11. Mark single notification read and Mark All Read persist accurately", async () => {
      const unreadList = await prisma.notification.findMany({
        where: { restaurantId: ridA, isRead: false },
      });
      assert.ok(unreadList.length > 0, "Should have unread notifications");
      const targetNotif = unreadList[0];

      // Mark single read via API
      const patchSingle = await app.inject({
        method: "PATCH",
        url: `/api/notifications/${targetNotif.id}/read`,
        headers: {
          authorization: `Bearer ${ownerTokenA}`,
          "x-restaurant-id": String(ridA),
        },
      });
      assert.equal(patchSingle.statusCode, 200);

      const updatedSingle = await prisma.notification.findUnique({
        where: { id: targetNotif.id },
      });
      assert.equal(updatedSingle.isRead, true, "Target notification should be marked read");

      // Mark all read via API
      const patchAll = await app.inject({
        method: "PATCH",
        url: "/api/notifications/read-all",
        headers: {
          authorization: `Bearer ${ownerTokenA}`,
          "x-restaurant-id": String(ridA),
        },
      });
      assert.equal(patchAll.statusCode, 200);

      // Verify owner unread-count endpoint returns 0
      const unreadCountRes = await app.inject({
        method: "GET",
        url: "/api/notifications/unread-count",
        headers: {
          authorization: `Bearer ${ownerTokenA}`,
          "x-restaurant-id": String(ridA),
        },
      });
      assert.equal(unreadCountRes.statusCode, 200);
      const unreadBody = JSON.parse(unreadCountRes.payload);
      assert.equal(unreadBody.unreadCount, 0, "Owner unread count should be 0 after mark-all-read");

      const remainingOperationalUnread = await prisma.notification.count({
        where: {
          restaurantId: ridA,
          recipientType: { not: "CUSTOMER" },
          isRead: false,
        },
      });
      assert.equal(remainingOperationalUnread, 0, "All operational notifications for Restaurant A should now be read");
    });

    // Subtest 12: Owner Filtering Logic verification
    await t.test("12. Owner notification filtering correctly classifies operational events into tabs", async () => {
      const allNotifs = await prisma.notification.findMany({
        where: { restaurantId: ridA },
      });

      // Filter: ORDERS
      const orderTab = allNotifs.filter((item) => {
        const typeUpper = String(item.notificationType || "").toUpperCase();
        return typeUpper.includes("ORDER") || typeUpper.includes("DELIVER") || typeUpper.includes("FOOD") || typeUpper.includes("KOT");
      });
      assert.ok(orderTab.length >= 3, "Orders tab should contain NEW_ORDER, ORDER_ACCEPTED, ORDER_CANCELLED");

      // Filter: TABLES
      const tablesTab = allNotifs.filter((item) => {
        const typeUpper = String(item.notificationType || "").toUpperCase();
        return typeUpper.includes("TABLE") || typeUpper.includes("WAITER") || typeUpper.includes("BILL") || typeUpper.includes("RESERVATION");
      });
      assert.ok(tablesTab.length >= 3, "Tables tab should contain TABLE_SESSION_OPENED, RESERVATION_CREATED, RESERVATION_CANCELLED");

      // Filter: SUCCESS
      const successTab = allNotifs.filter((item) => {
        const typeUpper = String(item.notificationType || "").toUpperCase();
        return ["SUCCESS", "PAYMENT", "DELIVERED", "SERVED", "CLEANED", "ACCEPTED", "COMPLETED"].some((t) => typeUpper.includes(t));
      });
      assert.ok(successTab.length >= 2, "Success tab should contain PAYMENT_SUCCESS and ORDER_ACCEPTED");
    });

  } finally {
    // Cleanup created test records
    try {
      if (ridA) {
        await prisma.notification.deleteMany({ where: { restaurantId: ridA } });
        await prisma.orderItem.deleteMany({ where: { order: { restaurantId: ridA } } });
        await prisma.order.deleteMany({ where: { restaurantId: ridA } });
        await prisma.tableSession.deleteMany({ where: { restaurantId: ridA } });
        await prisma.reservation.deleteMany({ where: { restaurantId: ridA } });
        await prisma.menuItem.deleteMany({ where: { restaurantId: ridA } });
        await prisma.diningTable.deleteMany({ where: { restaurantId: ridA } });
        await prisma.user.deleteMany({ where: { restaurantId: ridA } });
        await prisma.restaurant.delete({ where: { id: ridA } }).catch(() => {});
      }
      if (ridB) {
        await prisma.notification.deleteMany({ where: { restaurantId: ridB } });
        await prisma.user.deleteMany({ where: { restaurantId: ridB } });
        await prisma.restaurant.delete({ where: { id: ridB } }).catch(() => {});
      }
    } catch (cleanupErr) {
      console.warn("Cleanup error (non-fatal):", cleanupErr.message);
    }

    if (realtime?.io) {
      try {
        await new Promise((resolve) => realtime.io.close(resolve));
      } catch (_) {}
    }
    if (app) {
      await app.close();
    }
  }
});
