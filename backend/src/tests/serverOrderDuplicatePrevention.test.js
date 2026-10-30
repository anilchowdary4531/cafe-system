import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { createOrderByStaff } from "../services/orderService.js";
import { createAndDispatchNotification, getUserNotifications } from "../services/notificationService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN", "WAITER", "SERVER", "CHEF"];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-jwt-secret-duplicate-prevention-xyz" });

  const requireOwnerRouteAuth = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma,
      allowedRoles: STAFF_ALLOWED_ROLES,
      matchRestaurantParam: "restaurantId",
    });
    if (!actor) return reply;
    req.staffActor = actor;
    req.user = { id: actor.userId, name: actor.userName, role: actor.role, restaurantId: actor.restaurantId };
    return null;
  };

  app.addHook("onRoute", (routeOptions) => {
    const url = String(routeOptions?.url || "");
    if (!url.startsWith("/owner/") && !url.startsWith("/api/owner/")) return;
    const existing = routeOptions.preHandler
      ? Array.isArray(routeOptions.preHandler)
        ? routeOptions.preHandler
        : [routeOptions.preHandler]
      : [];
    routeOptions.preHandler = [...existing, requireOwnerRouteAuth];
  });

  const mockRealtime = {
    io: {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ namespace: "root", room, event, data });
        },
      }),
    },
    staff: {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ namespace: "staff", room, event, data });
        },
      }),
    },
  };

  await app.register(ownerRoutes, {
    realtime: mockRealtime,
    buildQrTargetUrl: (slug, tableNo) => `/menu/${slug}?table=${tableNo}`,
  });
  await app.ready();
  return { app, mockRealtime };
}

test("SERVER ORDER DUPLICATE PREVENTION & LIVE ORDER INTEGRITY TEST SUITE", async (t) => {
  const emittedEvents = [];
  const { app, mockRealtime } = await createTestApp(emittedEvents);

  const timestamp = Date.now();
  const slug = `server-order-dup-${timestamp}`;

  // 1. Setup Restaurant, Tables, Menu Items, and Staff
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Server Order Test Restaurant ${timestamp}`,
      slug,
      invoicePrefix: "SRV",
      nextInvoiceNumber: 1001,
      taxEnabled: false,
      serviceChargeEnabled: false,
    },
  });

  const table1 = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "1",
      seats: 4,
    },
  });

  const menuItem1 = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      category: "Main Course",
      name: `Paneer Butter Masala ${timestamp}`,
      price: 240,
      isAvailable: true,
    },
  });

  const menuItem2 = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      category: "Breads",
      name: `Garlic Naan ${timestamp}`,
      price: 60,
      isAvailable: true,
    },
  });

  const server = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Ramesh Server",
      email: `ramesh-${timestamp}@example.com`,
      password: "test-password-hash-123",
      role: "WAITER",
      designation: "Server",
      isActive: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Owner Alice",
      email: `owner-${timestamp}@example.com`,
      password: "test-password-hash-123",
      role: "OWNER",
      designation: "Owner",
      isActive: true,
    },
  });

  const serverToken = app.jwt.sign({
    id: server.id,
    userId: server.id,
    name: server.name,
    email: server.email,
    role: "WAITER",
    designation: "Server",
    restaurantId: restaurant.id,
  });

  const ownerToken = app.jwt.sign({
    id: owner.id,
    userId: owner.id,
    name: owner.name,
    email: owner.email,
    role: "OWNER",
    designation: "Owner",
    restaurantId: restaurant.id,
  });

  let firstOrder = null;
  const clientOperationId1 = `srv_ord_t1_${timestamp}_single_sub`;

  // TEST 1: Server submits Table 1 order once -> exactly 1 Order record
  await t.test("TEST 1: Server submits Table 1 order once -> exactly 1 Order record", async () => {
    emittedEvents.length = 0;
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        clientOperationId: clientOperationId1,
        idempotencyKey: clientOperationId1,
        tableId: table1.id,
        tableNo: table1.tableNo,
        waiterId: server.id,
        waiterName: server.name,
        items: [{ menuItemId: menuItem1.id, qty: 1 }],
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.order, "Order must be returned");
    firstOrder = body.order;
    assert.ok(firstOrder.id, "Order must have an ID");

    // Verify exactly 1 order exists in DB for this clientOperationId
    const ordersInDb = await prisma.order.findMany({
      where: { restaurantId: restaurant.id, clientOperationId: clientOperationId1 },
    });
    assert.equal(ordersInDb.length, 1, "Exactly 1 order record must exist in DB");
    assert.equal(ordersInDb[0].id, firstOrder.id);
  });

  // TEST 2: Same submit request is repeated/retried with same clientOperationId -> still exactly 1 Order record, same ID returned
  await t.test("TEST 2: Same submit request is repeated/retried with same clientOperationId -> still exactly 1 Order record, same ID returned", async () => {
    const resRetry = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        clientOperationId: clientOperationId1,
        idempotencyKey: clientOperationId1,
        tableId: table1.id,
        tableNo: table1.tableNo,
        waiterId: server.id,
        waiterName: server.name,
        items: [{ menuItemId: menuItem1.id, qty: 1 }],
      },
    });

    assert.equal(resRetry.statusCode, 201);
    const bodyRetry = JSON.parse(resRetry.payload);
    assert.equal(bodyRetry.success, true);
    assert.equal(bodyRetry.order.id, firstOrder.id, "Idempotent retry must return the exact same order ID");

    // DB must still have exactly 1 order
    const totalOrders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id },
    });
    assert.equal(totalOrders.length, 1, "Total orders in restaurant must still be exactly 1");
  });

  // TEST 3: Owner receives initial API order list + realtime -> exactly 1 order displayed in activeOrders
  await t.test("TEST 3: Owner tables endpoint returns Table 1 with exactly 1 active order", async () => {
    const resTables = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(resTables.statusCode, 200);
    const tables = JSON.parse(resTables.payload);
    const t1 = tables.find((t) => t.id === table1.id);
    assert.ok(t1, "Table 1 must exist");
    assert.equal(t1.activeOrders.length, 1, "Table 1 must have exactly 1 active order");
    assert.equal(t1.activeOrders[0].id, firstOrder.id);
  });

  // TEST 4: Server receives notification -> exactly 1 notification created
  await t.test("TEST 4: Server receives notification -> exactly 1 notification created with idempotency", async () => {
    const serverNotifications = await prisma.notification.findMany({
      where: {
        restaurantId: restaurant.id,
        recipientId: server.id,
        notificationType: NOTIFICATION_TYPES.ORDER_PLACED,
      },
    });

    assert.equal(serverNotifications.length, 1, "Server must receive exactly 1 ORDER_PLACED notification");
    assert.equal(serverNotifications[0].orderId, firstOrder.id);
  });

  // TEST 5: Two genuinely separate orders submitted for the same table (different clientOperationId / subsequent order) -> both orders created and distinct
  let secondOrder = null;
  const clientOperationId2 = `srv_ord_t1_${timestamp}_second_order`;

  await t.test("TEST 5: Legitimate subsequent order for same table creates second distinct order", async () => {
    const resOrder2 = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        clientOperationId: clientOperationId2,
        idempotencyKey: clientOperationId2,
        tableId: table1.id,
        tableNo: table1.tableNo,
        waiterId: server.id,
        waiterName: server.name,
        items: [{ menuItemId: menuItem2.id, qty: 2 }],
      },
    });

    assert.equal(resOrder2.statusCode, 201);
    const body2 = JSON.parse(resOrder2.payload);
    secondOrder = body2.order;
    assert.notEqual(secondOrder.id, firstOrder.id, "Second order must have distinct ID");

    // Both orders exist in DB
    const allTableOrders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id },
    });
    assert.equal(allTableOrders.length, 2, "Restaurant must now have 2 distinct orders");

    // Table 1 now has 2 active orders
    const resTables = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const tables = JSON.parse(resTables.payload);
    const t1 = tables.find((t) => t.id === table1.id);
    assert.equal(t1.activeOrders.length, 2, "Table 1 legitimately has 2 active orders");
    const activeOrderIds = t1.activeOrders.map((o) => o.id);
    assert.ok(activeOrderIds.includes(firstOrder.id));
    assert.ok(activeOrderIds.includes(secondOrder.id));
  });

  // TEST 6: One order creates intended KOT workflow exactly once without duplicate KOT tickets
  await t.test("TEST 6: Each order creates its KOT tickets without duplicate KOTs", async () => {
    const kotsOrder1 = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: firstOrder.id },
    });
    assert.ok(kotsOrder1.length >= 1, "Order 1 must have at least 1 KOT");

    const kotsOrder2 = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: secondOrder.id },
    });
    assert.ok(kotsOrder2.length >= 1, "Order 2 must have at least 1 KOT");

    // Ensure retry with clientOperationId1 didn't create extra KOTs
    const retryOrder = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restaurant.id, role: "WAITER", userId: server.id, userName: server.name },
      input: {
        clientOperationId: clientOperationId1,
        idempotencyKey: clientOperationId1,
        tableNo: table1.tableNo,
        items: [{ menuItemId: menuItem1.id, qty: 1 }],
      },
    });
    assert.equal(retryOrder.id, firstOrder.id);

    const kotsAfterRetry = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: firstOrder.id },
    });
    assert.equal(kotsAfterRetry.length, kotsOrder1.length, "KOT count must remain identical after idempotent retry");
  });

  // TEST 7: Designation notification routing remains correct
  await t.test("TEST 7: Designation notification routing remains correct", async () => {
    const notifs = await getUserNotifications({
      prisma,
      recipientId: server.id,
      userId: server.id,
      restaurantId: restaurant.id,
      effectiveRole: "WAITER",
      designation: "Server",
    });

    assert.ok(Array.isArray(notifs.notifications));
    assert.ok(notifs.notifications.some((n) => n.notificationType === NOTIFICATION_TYPES.ORDER_PLACED));
  });

  // TEST 8: Server order creation generates persistent NEW_ORDER notification for Owner/Restaurant
  await t.test("TEST 8: Server order creation generates persistent NEW_ORDER notification for Owner/Restaurant", async () => {
    const ownerNotifs = await getUserNotifications({
      prisma,
      recipientId: owner.id,
      userId: owner.id,
      restaurantId: restaurant.id,
      effectiveRole: "OWNER",
      designation: "Owner",
      role: "OWNER",
    });

    assert.ok(Array.isArray(ownerNotifs.notifications), "Owner notifications must be an array");
    const orderNotif = ownerNotifs.notifications.find(
      (n) => n.notificationType === NOTIFICATION_TYPES.NEW_ORDER && n.orderId === firstOrder.id
    );
    assert.ok(orderNotif, "Owner notification log must contain NEW_ORDER notification for firstOrder");
    assert.equal(orderNotif.title, "🔔 New Order Received!");
    assert.ok(orderNotif.message.includes(`Table ${table1.tableNo}`), "Message must reference Table 1");

    // Also verify directly in DB table
    const dbNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: restaurant.id,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: restaurant.id,
        notificationType: NOTIFICATION_TYPES.NEW_ORDER,
      },
    });
    assert.ok(dbNotifs.length >= 1, "At least 1 NEW_ORDER notification exists in DB for restaurant");
  });

  // TEST 9: Idempotent retries do NOT duplicate Owner NEW_ORDER notifications, while subsequent order creates distinct notification
  await t.test("TEST 9: Owner NEW_ORDER notification idempotency and distinct subsequent order notification", async () => {
    // Check notifications for order 1
    const order1Notifs = await prisma.notification.findMany({
      where: {
        restaurantId: restaurant.id,
        orderId: firstOrder.id,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        notificationType: NOTIFICATION_TYPES.NEW_ORDER,
      },
    });
    assert.equal(order1Notifs.length, 1, "Exactly 1 NEW_ORDER notification must exist for firstOrder");

    // Check notifications for order 2
    const order2Notifs = await prisma.notification.findMany({
      where: {
        restaurantId: restaurant.id,
        orderId: secondOrder.id,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        notificationType: NOTIFICATION_TYPES.NEW_ORDER,
      },
    });
    assert.equal(order2Notifs.length, 1, "Exactly 1 NEW_ORDER notification must exist for secondOrder");
    assert.notEqual(order1Notifs[0].id, order2Notifs[0].id, "Order 1 and Order 2 must have distinct notifications");
  });

  // TEST 10: Strict Table Identity & Session Isolation — Table with similar number in another section
  await t.test("TEST 10: Strict Table Identity & Session Isolation across sections with similar numbers", async () => {
    // Create Table B with tableNo "table 1" in Section "TABLE" (Table 1 has tableNo "1" in "Main Hall")
    const tableB = await prisma.diningTable.create({
      data: {
        restaurantId: restaurant.id,
        tableNo: "table 1",
        section: "TABLE",
        seats: 4,
      },
    });

    const resTables = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resTables.statusCode, 200);
    const tables = JSON.parse(resTables.payload);

    const fetchedTable1 = tables.find((t) => t.id === table1.id);
    const fetchedTableB = tables.find((t) => t.id === tableB.id);

    assert.ok(fetchedTable1, "Table 1 must exist");
    assert.ok(fetchedTableB, "Table B must exist");

    // Table 1 has active orders and active session
    assert.equal(fetchedTable1.isOccupied, true, "Table 1 must be occupied");
    assert.equal(fetchedTable1.activeOrders.length, 2, "Table 1 must have 2 active orders");
    assert.equal(fetchedTable1.assignedWaiterName, server.name, "Table 1 has Server Ramesh");

    // Table B MUST BE AVAILABLE with 0 active orders and NO assigned server
    assert.equal(fetchedTableB.isOccupied, false, "Table B must NOT be occupied");
    assert.equal(fetchedTableB.status, "AVAILABLE", "Table B status must be AVAILABLE");
    assert.equal(fetchedTableB.activeOrders.length, 0, "Table B must have 0 active orders");
    assert.equal(fetchedTableB.activeSession, null, "Table B must NOT inherit Table 1 activeSession");
    assert.equal(fetchedTableB.assignedWaiterName, null, "Table B must NOT inherit Table 1 assigned server");
    assert.equal(fetchedTableB.assignedServer, null, "Table B assignedServer must be null");
  });
});
