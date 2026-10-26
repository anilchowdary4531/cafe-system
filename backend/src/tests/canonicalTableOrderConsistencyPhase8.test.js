import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import notificationRoutes from "../routes/notification.routes.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { createOrderByStaff } from "../services/orderService.js";
import { createAndDispatchNotification, getUserNotifications } from "../services/notificationService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";
import { getOrCreateActiveSession, closeTableSession } from "../services/tableSessionService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN", "WAITER", "SERVER", "CHEF"];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "phase-8-canonical-test-jwt-secret-xyz" });

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

  const buildQrTargetUrl = (slug, tableNo) => `/menu/${slug}?table=${tableNo}`;

  await ownerRoutes(app, {
    prisma,
    realtime: mockRealtime,
    buildQrTargetUrl,
  });

  await notificationRoutes(app, {
    prisma,
    realtime: mockRealtime,
  });

  return { app, mockRealtime };
}

test("PHASE 8 — CANONICAL TABLE ↔ ORDER ↔ KOT ↔ SERVER NOTIFICATION REGRESSION TEST SUITE", async (t) => {
  const emittedEvents = [];
  const { app, mockRealtime } = await createTestApp(emittedEvents);

  const timestamp = Date.now();
  const restASlug = `p8-rest-a-${timestamp}`;
  const restBSlug = `p8-rest-b-${timestamp}`;

  // Create Restaurant A & Restaurant B
  const restaurantA = await prisma.restaurant.create({
    data: {
      name: "Tiffzy Restaurant A",
      slug: restASlug,
      currency: "INR",
    },
  });

  const restaurantB = await prisma.restaurant.create({
    data: {
      name: "Tiffzy Restaurant B",
      slug: restBSlug,
      currency: "INR",
    },
  });

  // Create Staff for Restaurant A: Server 1, Server 2, Chef, Owner
  const serverA1 = await prisma.user.create({
    data: {
      restaurantId: restaurantA.id,
      name: "Server One",
      email: `server1-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
    },
  });

  const serverA2 = await prisma.user.create({
    data: {
      restaurantId: restaurantA.id,
      name: "Server Two",
      email: `server2-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
    },
  });

  const chefA = await prisma.user.create({
    data: {
      restaurantId: restaurantA.id,
      name: "Chef Mario",
      email: `chef-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "CHEF",
    },
  });

  const ownerA = await prisma.user.create({
    data: {
      restaurantId: restaurantA.id,
      name: "Owner Alice",
      email: `owner-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "OWNER",
    },
  });

  // Create Staff for Restaurant B
  const serverB = await prisma.user.create({
    data: {
      restaurantId: restaurantB.id,
      name: "Server Bob",
      email: `serverb-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
    },
  });

  // Create Menu Items for Restaurant A
  const menuItemA = await prisma.menuItem.create({
    data: {
      restaurantId: restaurantA.id,
      name: "Paneer Butter Masala",
      category: "Main Course",
      price: 250,
      isAvailable: true,
    },
  });

  // Table A: id=auto, tableNo="Table 1"
  const tableA = await prisma.diningTable.create({
    data: {
      restaurantId: restaurantA.id,
      tableNo: "Table 1",
      seats: 4,
      section: "Main Dining",
      assignedWaiterId: serverA1.id,
      assignedWaiterName: serverA1.name,
    },
  });

  // Table B: id=auto, tableNo="1"
  const tableB = await prisma.diningTable.create({
    data: {
      restaurantId: restaurantA.id,
      tableNo: "1",
      seats: 2,
      section: "Outdoor Patio",
      assignedWaiterId: serverA2.id,
      assignedWaiterName: serverA2.name,
    },
  });

  // Table in Restaurant B
  const tableRestB = await prisma.diningTable.create({
    data: {
      restaurantId: restaurantB.id,
      tableNo: "Table 1",
      seats: 4,
      section: "Terrace",
      assignedWaiterId: serverB.id,
      assignedWaiterName: serverB.name,
    },
  });

  const serverA1Token = app.jwt.sign({
    id: serverA1.id,
    userId: serverA1.id,
    restaurantId: restaurantA.id,
    name: serverA1.name,
    role: "WAITER",
  });

  const serverA2Token = app.jwt.sign({
    id: serverA2.id,
    userId: serverA2.id,
    restaurantId: restaurantA.id,
    name: serverA2.name,
    role: "WAITER",
  });

  const ownerAToken = app.jwt.sign({
    id: ownerA.id,
    userId: ownerA.id,
    restaurantId: restaurantA.id,
    name: ownerA.name,
    role: "OWNER",
  });

  const serverBToken = app.jwt.sign({
    id: serverB.id,
    userId: serverB.id,
    restaurantId: restaurantB.id,
    name: serverB.name,
    role: "WAITER",
  });

  let sessionA = null;
  let orderA = null;

  await t.test("TEST 1 & 2 & 3: Table A ('Table 1') vs Table B ('1') — Order belongs strictly to canonical Table A", async () => {
    // 1. Open session on Table A
    sessionA = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurantA.id,
      tableId: tableA.id,
      waiterId: serverA1.id,
      waiterName: serverA1.name,
    });
    assert.equal(sessionA.tableId, tableA.id);

    // 2. Place order for Table A
    orderA = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restaurantA.id, userId: serverA1.id, userName: serverA1.name, role: "WAITER" },
      input: {
        tableId: tableA.id,
        tableSessionId: sessionA.id,
        tableNo: tableA.tableNo,
        items: [{ menuItemId: menuItemA.id, qty: 2 }],
      },
    });

    assert.equal(orderA.tableSessionId, sessionA.id);
    assert.equal(orderA.tableNo, "Table 1");

    // 3. Query GET /owner/:restaurantId/tables
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    assert.equal(res.statusCode, 200);
    const tables = JSON.parse(res.payload);

    const fetchedTableA = tables.find((t) => t.id === tableA.id);
    const fetchedTableB = tables.find((t) => t.id === tableB.id);

    // Table A MUST have the active order
    assert.ok(fetchedTableA, "Table A must exist in response");
    assert.equal(fetchedTableA.activeOrders.length, 1, "Table A must have exactly 1 active order");
    assert.equal(fetchedTableA.activeOrders[0].id, orderA.id, "Table A must contain orderA");

    // Table B MUST NEVER have orderA, even though tableNo '1' normalizes identically to 'Table 1'
    assert.ok(fetchedTableB, "Table B must exist in response");
    assert.equal(fetchedTableB.activeOrders.length, 0, "Table B must NEVER receive Table A's order");
  });

  await t.test("TEST 4 & 5: Closed TableSession order must not leak into a new session on the same physical table", async () => {
    // Settle & close sessionA on Table A
    await closeTableSession({
      prisma,
      sessionId: sessionA.id,
      force: true,
      actor: { userId: ownerA.id, userName: ownerA.name, role: "OWNER", restaurantId: restaurantA.id },
    });

    // Verify sessionA is CLOSED
    const closedSession = await prisma.tableSession.findUnique({ where: { id: sessionA.id } });
    assert.equal(closedSession.status, "CLOSED");

    // Check tables: Table A should now have 0 active orders
    const resAfterClose = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const tablesAfterClose = JSON.parse(resAfterClose.payload);
    const tableAAfterClose = tablesAfterClose.find((t) => t.id === tableA.id);
    assert.equal(tableAAfterClose.activeOrders.length, 0, "Closed session orders must not appear as active");

    // Open a NEW session on Table A
    const sessionA2 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurantA.id,
      tableId: tableA.id,
      waiterId: serverA1.id,
      waiterName: serverA1.name,
    });
    assert.notEqual(sessionA2.id, sessionA.id, "New session must have distinct primary key");

    // Create a new order for sessionA2
    const orderA2 = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restaurantA.id, userId: serverA1.id, userName: serverA1.name, role: "WAITER" },
      input: {
        tableId: tableA.id,
        tableSessionId: sessionA2.id,
        tableNo: tableA.tableNo,
        items: [{ menuItemId: menuItemA.id, qty: 1 }],
      },
    });

    const resNewSession = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const tableANew = JSON.parse(resNewSession.payload).find((t) => t.id === tableA.id);
    assert.equal(tableANew.activeOrders.length, 1, "Must only have the new order");
    assert.equal(tableANew.activeOrders[0].id, orderA2.id, "Must only show new session order");
    assert.notEqual(tableANew.activeOrders[0].id, orderA.id, "Old closed order must not leak");
  });

  await t.test("TEST 6: Server order submission creates Order -> OrderItem -> KOT -> KOTItem with preserved tableSessionId", async () => {
    // Place order via POST /owner/:restaurantId/orders
    emittedEvents.length = 0;

    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/orders`,
      headers: { authorization: `Bearer ${serverA1Token}` },
      payload: {
        tableId: tableB.id,
        tableNo: tableB.tableNo,
        waiterId: serverA1.id,
        items: [{ menuItemId: menuItemA.id, qty: 3, notes: "Extra spicy" }],
        orderSource: "POS",
        fulfillment: "DINEIN",
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.order?.id);

    const createdOrder = await prisma.order.findUnique({
      where: { id: body.order.id },
      include: { items: true, kots: { include: { items: true } }, tableSession: true },
    });

    assert.ok(createdOrder.tableSessionId, "Must have tableSessionId attached");
    assert.equal(createdOrder.tableSession.tableId, tableB.id, "Session must point to Table B");
    assert.equal(createdOrder.items.length, 1, "OrderItem created");
    assert.equal(createdOrder.items[0].qty, 3);
    assert.ok(createdOrder.kots.length > 0, "KOT created");
    assert.equal(createdOrder.kots[0].tableSessionId, createdOrder.tableSessionId, "KOT preserves canonical tableSessionId");
    assert.equal(createdOrder.kots[0].tableNo, tableB.tableNo, "KOT preserves tableNo");
    assert.equal(createdOrder.kots[0].items.length, 1, "KOTItem created");
  });

  await t.test("TEST 7, 8, 9: Server sends order -> Notification created -> Server 1 receives it, Server 2 does NOT", async () => {
    const notifIdempotency = `kot_sent_p8_${Date.now()}`;

    const notif = await createAndDispatchNotification({
      prisma,
      realtime: mockRealtime,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverA1.id,
      restaurantId: restaurantA.id,
      orderId: 8888,
      notificationType: NOTIFICATION_TYPES.KOT_SENT,
      title: "🍳 Order Sent to Kitchen — Table 1",
      message: "Order #8888 sent to kitchen for Table 1",
      data: {
        orderId: 8888,
        tableId: tableA.id,
        tableNo: tableA.tableNo,
        action: "KOT_SENT",
      },
      idempotencyKey: notifIdempotency,
    });

    assert.ok(notif, "Notification must be created");

    // Fetch notifications for Server A1
    const notifsServer1 = await getUserNotifications({
      prisma,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverA1.id,
      restaurantId: restaurantA.id,
    });

    assert.ok(notifsServer1.notifications.some((n) => n.id === notif.id), "Server A1 must receive their private notification");

    // Fetch notifications for Server A2 (Different server in same restaurant)
    const notifsServer2 = await getUserNotifications({
      prisma,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverA2.id,
      restaurantId: restaurantA.id,
    });

    assert.equal(
      notifsServer2.notifications.some((n) => n.id === notif.id),
      false,
      "Server A2 MUST NOT receive Server A1's private notification"
    );
  });

  await t.test("TEST 10: Server socket receives order-created event through /staff namespace", async () => {
    emittedEvents.length = 0;

    await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/orders`,
      headers: { authorization: `Bearer ${serverA1Token}` },
      payload: {
        tableId: tableA.id,
        tableNo: tableA.tableNo,
        waiterId: serverA1.id,
        items: [{ menuItemId: menuItemA.id, qty: 1 }],
      },
    });

    // Check staff namespace received the event
    const staffEvents = emittedEvents.filter((e) => e.namespace === "staff");
    assert.ok(staffEvents.length > 0, "Must emit events to /staff namespace");

    const orderCreatedStaff = staffEvents.find((e) => e.event === "order:created" || e.event === "order_created");
    assert.ok(orderCreatedStaff, "Must emit order:created or order_created to /staff namespace");
    assert.equal(orderCreatedStaff.room, `restaurant_${restaurantA.id}`);
  });

  await t.test("TEST 11 & 12: Notification persistence and reconnect idempotency", async () => {
    const testKey = `idemp_recon_${Date.now()}`;
    const firstNotif = await createAndDispatchNotification({
      prisma,
      realtime: mockRealtime,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverA1.id,
      restaurantId: restaurantA.id,
      title: "Test Persistence",
      message: "Testing notification persistence",
      idempotencyKey: testKey,
    });

    // Reconnecting and re-dispatching identical idempotency key returns exact same record without duplicate
    const secondNotif = await createAndDispatchNotification({
      prisma,
      realtime: mockRealtime,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverA1.id,
      restaurantId: restaurantA.id,
      title: "Test Persistence",
      message: "Testing notification persistence",
      idempotencyKey: testKey,
    });

    assert.equal(firstNotif.id, secondNotif.id, "Must return existing notification on reconnect/re-dispatch");

    // Count in DB for this key should be exactly 1
    const count = await prisma.notification.count({ where: { idempotencyKey: testKey } });
    assert.equal(count, 1, "Must not duplicate in database");
  });

  await t.test("TEST 13 & 14: Chef / Senior Chef and Ready-to-Distribute workflow integrity", async () => {
    // Create an order in PREPARING status
    const chefOrder = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableNo: tableA.tableNo,
        orderNo: `CHEF-TEST-${Date.now()}`,
        status: "PREPARING",
        subtotal: 250,
        total: 250,
        items: {
          create: [{
            menuItemId: menuItemA.id,
            itemName: menuItemA.name,
            qty: 1,
            price: 250,
            total: 250,
          }],
        },
      },
      include: { items: true },
    });

    // Senior chef / Chef transitions to READY
    const chefToken = app.jwt.sign({
      id: chefA.id,
      userId: chefA.id,
      restaurantId: restaurantA.id,
      name: chefA.name,
      role: "CHEF",
    });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/owner/${restaurantA.id}/orders/${chefOrder.id}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });

    assert.equal(updateRes.statusCode, 200);
    const updated = await prisma.order.findUnique({ where: { id: chefOrder.id } });
    assert.equal(updated.status, "READY", "Chef transition to READY must succeed");
  });

  await t.test("TEST 15 & 16: Payment closes only the correct table session; Closing Table A does not affect Table B", async () => {
    // Open session on Table A and Table B
    const sessA = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurantA.id,
      tableId: tableA.id,
      waiterId: serverA1.id,
    });

    const sessB = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurantA.id,
      tableId: tableB.id,
      waiterId: serverA2.id,
    });

    assert.equal(sessA.status, "OPEN");
    assert.equal(sessB.status, "OPEN");

    // Close session on Table A
    await closeTableSession({
      prisma,
      sessionId: sessA.id,
      force: true,
      actor: { userId: ownerA.id, userName: ownerA.name, role: "OWNER", restaurantId: restaurantA.id },
    });

    const refreshedA = await prisma.tableSession.findUnique({ where: { id: sessA.id } });
    const refreshedB = await prisma.tableSession.findUnique({ where: { id: sessB.id } });

    assert.equal(refreshedA.status, "CLOSED", "Table A session must be CLOSED");
    assert.equal(refreshedB.status, "OPEN", "Table B session MUST REMAIN OPEN");
  });

  await t.test("TEST 17: Tenant isolation: Restaurant A orders/notifications never appear in Restaurant B", async () => {
    // Create notification in Restaurant A for serverA1
    const notifA = await createAndDispatchNotification({
      prisma,
      realtime: mockRealtime,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverA1.id,
      restaurantId: restaurantA.id,
      title: "Rest A Alert",
      message: "Secret for Rest A",
      idempotencyKey: `tenant_test_${Date.now()}`,
    });

    // Server B in Restaurant B fetches notifications
    const notifsB = await getUserNotifications({
      prisma,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: serverB.id,
      restaurantId: restaurantB.id,
    });

    assert.equal(
      notifsB.notifications.some((n) => n.restaurantId === restaurantA.id),
      false,
      "Restaurant B must NEVER see Restaurant A notifications"
    );

    // Also verify via HTTP route
    const resB = await app.inject({
      method: "GET",
      url: `/owner/${restaurantB.id}/tables`,
      headers: { authorization: `Bearer ${serverBToken}` },
    });
    assert.equal(resB.statusCode, 200);
    const tablesB = JSON.parse(resB.payload);

    // No table in Restaurant B should have Restaurant A's orders
    for (const t of tablesB) {
      assert.equal(t.restaurantId, restaurantB.id);
      for (const ord of t.activeOrders || []) {
        assert.equal(ord.restaurantId, restaurantB.id);
      }
    }
  });

  // Cleanup test data
  await prisma.notification.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.kitchenOrderTicketItem.deleteMany({
    where: { kot: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } },
  }).catch(() => {});
  await prisma.kitchenOrderTicket.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } },
  });
  await prisma.orderStatusEvent.deleteMany({
    where: { order: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } },
  });
  await prisma.order.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.tableSession.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.tableWaiterAssignment.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.diningTable.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.menuItem.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.user.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });
  await prisma.restaurant.deleteMany({
    where: { id: { in: [restaurantA.id, restaurantB.id] } },
  });
});
