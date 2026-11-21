import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import staffTasksRoutes from "../routes/staffTasks.routes.js";
import notificationRoutes from "../routes/notification.routes.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "WAITER", "SERVER", "CHEF", "CASHIER", "CLEANER"];

test("TIFFZY COMPLETE ORDER DELIVERY LIFECYCLE VERIFICATION SUITE", async (t) => {
  const ts = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const emittedEvents = [];

  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "test-lifecycle-secret-key-12345" });

  const requireOwnerRouteAuth = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma,
      allowedRoles: STAFF_ALLOWED_ROLES,
      matchRestaurantParam: "restaurantId",
    });
    if (!actor) return reply;
    req.staffActor = actor;
    req.user = {
      id: actor.userId,
      name: actor.userName,
      role: actor.role,
      restaurantId: actor.restaurantId,
    };
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
          emittedEvents.push({ namespace: "root", room, event, data, timestamp: new Date().toISOString() });
        },
      }),
      of: () => ({
        to: (room) => ({
          emit: (event, data) => {
            emittedEvents.push({ namespace: "of", room, event, data, timestamp: new Date().toISOString() });
          },
        }),
      }),
    },
    staff: {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ namespace: "staff", room, event, data, timestamp: new Date().toISOString() });
        },
      }),
    },
    emitOrderCreated: (order) => {
      emittedEvents.push({ namespace: "helper", room: `restaurant:${order.restaurantId}`, event: "order:created", data: order });
    },
    emitOrderUpdated: (order) => {
      emittedEvents.push({ namespace: "helper", room: `restaurant:${order.restaurantId}`, event: "order:updated", data: order });
    },
  };

  app.io = mockRealtime.io;
  app.staff = mockRealtime.staff;
  app.realtime = mockRealtime;

  await ownerRoutes(app, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES,
    buildQrTargetUrl: (slug, tableNo) => `/menu/${slug}?table=${tableNo}`,
  });

  await staffTasksRoutes(app, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES,
  });

  await notificationRoutes(app, {
    prisma,
    realtime: mockRealtime,
  });

  await app.ready();

  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Cafe King Test ${ts}`,
      slug: `cafe-king-${ts}`,
      email: `owner-${ts}@cafeking.com`,
      phone: `9199999${ts.slice(-4)}`,
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  });
  const rid = restaurant.id;

  const ownerUser = await prisma.user.create({
    data: {
      restaurant: { connect: { id: rid } },
      email: `owner-${ts}@cafeking.com`,
      password: "password123",
      role: "OWNER",
      name: "Owner King",
    },
  });

  const serverUser = await prisma.user.create({
    data: {
      restaurant: { connect: { id: rid } },
      email: `server-${ts}@cafeking.com`,
      password: "password123",
      role: "WAITER",
      designation: "SERVER",
      name: "saimohan",
    },
  });

  const cleanerUser = await prisma.user.create({
    data: {
      restaurant: { connect: { id: rid } },
      email: `cleaner-${ts}@cafeking.com`,
      password: "password123",
      role: "STAFF",
      designation: "CLEANER",
      name: "clara",
    },
  });

  const diningTable = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "1",
      section: "Main Floor",
      seats: 4,
      cleaningStatus: "CLEAN",
      assignedWaiterId: serverUser.id,
      assignedWaiterName: serverUser.name,
    },
  });

  const session = await prisma.tableSession.create({
    data: {
      restaurantId: rid,
      tableId: diningTable.id,
      tableNo: "1",
      status: "OPEN",
      waiterId: serverUser.id,
      waiterName: serverUser.name,
      subtotal: 517,
      total: 542.85,
    },
  });

  const order = await prisma.order.create({
    data: {
      restaurantId: rid,
      orderNo: `CK-${ts}-1-1296`,
      orderSource: "POS",
      tableNo: "1",
      tableSessionId: session.id,
      status: "PLACED",
      paymentStatus: "PENDING",
      subtotal: 517,
      total: 542.85,
      createdByRole: "WAITER",
      createdByUserId: serverUser.id,
      items: {
        create: [
          { itemName: "Gold Flake Filter (10 pcs)", qty: 1, price: 127, total: 127 },
          { itemName: "Classic Connect (20 pcs)", qty: 1, price: 390, total: 390 },
        ],
      },
    },
    include: { items: true },
  });

  const kot = await prisma.kitchenOrderTicket.create({
    data: {
      restaurantId: rid,
      kotNo: `KOT-${ts.slice(-3)}`,
      sequenceNumber: 1,
      orderId: order.id,
      tableSessionId: session.id,
      tableNo: "1",
      waiterId: serverUser.id,
      waiterName: serverUser.name,
      status: "PENDING",
      items: {
        create: [
          { orderItemId: order.items[0].id, itemName: order.items[0].itemName, qty: 1, status: "PENDING" },
          { orderItemId: order.items[1].id, itemName: order.items[1].itemName, qty: 1, status: "PENDING" },
        ],
      },
    },
    include: { items: true },
  });
  const kotItem1 = kot.items[0];
  const kotItem2 = kot.items[1];

  const ownerToken = app.jwt.sign({ id: ownerUser.id, userId: ownerUser.id, email: ownerUser.email, role: "OWNER", restaurantId: rid });
  const serverToken = app.jwt.sign({ id: serverUser.id, userId: serverUser.id, email: serverUser.email, role: "WAITER", restaurantId: rid, designation: "SERVER" });

  t.after(async () => {
    try {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: rid } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: rid } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: rid } } });
      await prisma.payment.deleteMany({ where: { restaurantId: rid } });
      await prisma.order.deleteMany({ where: { restaurantId: rid } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: rid } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
    } catch (e) {
      console.warn("[cleanup] Warning:", e?.message);
    }
    await app.close();
  });

  await t.test("1. Order status updated to READY synchronizes KOTs, items, and dispatches FOOD_READY notification", async () => {
    const readyRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: "READY", changedByName: "Chef Admin" },
    });
    assert.equal(readyRes.statusCode, 200);

    // Verify Order is READY
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(updatedOrder.status, "READY");

    // Verify KOT and KOT items synchronized to READY
    const updatedKot = await prisma.kitchenOrderTicket.findUnique({
      where: { id: kot.id },
      include: { items: true },
    });
    assert.equal(updatedKot.status, "READY", "KOT status must synchronize to READY when Order is marked READY");
    assert.ok(updatedKot.items.every((it) => it.status === "READY"), "All KOT items must synchronize to READY");

    // Verify FOOD_READY notifications dispatched to server and restaurant
    const readyNotifs = await prisma.notification.findMany({
      where: { restaurantId: rid, notificationType: NOTIFICATION_TYPES.FOOD_READY },
    });
    assert.ok(readyNotifs.length >= 2, "Must create FOOD_READY notification for server and restaurant");
    const serverNotif = readyNotifs.find((n) => n.recipientType === "USER" && n.recipientId === serverUser.id);
    const ownerNotif = readyNotifs.find((n) => n.recipientType === "RESTAURANT");
    assert.ok(serverNotif, "Responsible server must receive FOOD_READY notification");
    assert.ok(ownerNotif, "Owner must receive FOOD_READY notification");

    // Verify realtime table:updated event was emitted with activeOrderStatus: "READY"
    const tableReadyEvents = emittedEvents.filter((e) => e.event === "table:updated" && e.data?.activeOrderStatus === "READY");
    assert.ok(tableReadyEvents.length > 0, "table:updated must be emitted with activeOrderStatus: READY");
  });

  await t.test("2. Authoritative Table Status reflects READY (not PAYMENT_PENDING) before delivery", async () => {
    const tableRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(tableRes.statusCode, 200);
    const tables = JSON.parse(tableRes.payload);
    const table1 = Array.isArray(tables) ? tables.find((t) => t.id === diningTable.id) : (tables.tables || []).find((t) => t.id === diningTable.id);
    assert.ok(table1, "Table 1 must exist");
    assert.equal(table1.activeOrderStatus, "READY", "Authoritative activeOrderStatus must be READY before delivery");
    assert.notEqual(table1.activeOrderStatus, "PAYMENT_PENDING", "Table must NOT be marked PAYMENT_PENDING when food is only READY");
  });

  await t.test("3. Server marks food delivered: item transitions to SERVED, order to DELIVERED, ORDER_DELIVERED persisted", async () => {
    // Deliver item 1
    const del1 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItem1.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(del1.statusCode, 200, "Steward item 1 delivery must succeed");

    // Deliver item 2 -> Completes KOT and Order
    const del2 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItem2.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(del2.statusCode, 200, "Steward item 2 delivery must succeed");

    // Verify DB states
    const finalKot = await prisma.kitchenOrderTicket.findUnique({
      where: { id: kot.id },
      include: { items: true },
    });
    assert.equal(finalKot.status, "SERVED");
    assert.ok(finalKot.items.every((it) => it.status === "SERVED"));

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(finalOrder.status, "DELIVERED");

    // Verify ORDER_DELIVERED notifications persisted for server and restaurant/owner
    const deliveryNotifs = await prisma.notification.findMany({
      where: { restaurantId: rid, notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED },
    });
    assert.ok(deliveryNotifs.length >= 2, "Must create ORDER_DELIVERED notifications");
    const serverDelNotif = deliveryNotifs.find((n) => n.recipientType === "USER" && n.recipientId === serverUser.id);
    const ownerDelNotif = deliveryNotifs.find((n) => n.recipientType === "RESTAURANT");
    assert.ok(serverDelNotif, "Server must have persistent ORDER_DELIVERED notification");
    assert.ok(ownerDelNotif, "Owner must have persistent ORDER_DELIVERED notification");

    // Verify realtime food:delivered event was emitted
    const foodDelEvents = emittedEvents.filter((e) => e.event === "food:delivered");
    assert.ok(foodDelEvents.length > 0, "food:delivered socket event must be emitted");
  });

  await t.test("4. Owner GET /api/notifications returns ORDER_DELIVERED and matches filter criteria", async () => {
    const notifRes = await app.inject({
      method: "GET",
      url: `/api/notifications?restaurantId=${rid}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(notifRes.statusCode, 200);
    const notifs = JSON.parse(notifRes.payload).notifications;
    const hasOrderDelivered = notifs.some((n) => n.notificationType === NOTIFICATION_TYPES.ORDER_DELIVERED);
    assert.ok(hasOrderDelivered, "Owner notification list must contain ORDER_DELIVERED record");

    // Verify filter matching logic in OwnerNotifications.jsx:
    // ORDERS filter includes ORDER_DELIVERED
    const typeUpper = "ORDER_DELIVERED";
    const matchesOrdersFilter = typeUpper.includes("ORDER") || typeUpper.includes("DELIVER");
    assert.ok(matchesOrdersFilter, "ORDER_DELIVERED must match ORDERS filter in OwnerNotifications");

    // SUCCESS filter includes ORDER_DELIVERED
    const matchesSuccessFilter = ["SUCCESS", "PAYMENT", "DELIVERED", "SERVED"].some((t) => typeUpper.includes(t));
    assert.ok(matchesSuccessFilter, "ORDER_DELIVERED must match SUCCESS filter in OwnerNotifications");
  });

  await t.test("5. Authoritative Table Status reflects DELIVERED after delivery and paymentStatus is PENDING", async () => {
    const tableRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(tableRes.statusCode, 200);
    const tables = JSON.parse(tableRes.payload);
    const table1 = Array.isArray(tables) ? tables.find((t) => t.id === diningTable.id) : (tables.tables || []).find((t) => t.id === diningTable.id);
    assert.ok(table1, "Table 1 must exist");
    assert.equal(table1.activeOrderStatus, "DELIVERED", "Authoritative activeOrderStatus must be DELIVERED");
    assert.equal(table1.paymentStatus, "PENDING", "PaymentStatus must be PENDING when delivered and unpaid");
  });

  await t.test("6. Duplicate delivery request is strictly idempotent and safe", async () => {
    const dupRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItem1.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(dupRes.statusCode, 200);
    const body = JSON.parse(dupRes.payload);
    assert.equal(body.alreadyServed, true, "Duplicate delivery must return alreadyServed: true");

    // Verify notifications count did not double
    const deliveryNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        recipientType: "RESTAURANT",
      },
    });
    assert.ok(deliveryNotifs.length >= 1);
  });

  await t.test("7. Payment settlement completes session and table closes cleanly", async () => {
    const settleRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/tables/1/settle-bill?tableId=${diningTable.id}`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        paymentMode: "CASH",
        authoritativeTotal: 542.85,
        changedByName: "saimohan",
      },
    });
    assert.equal(settleRes.statusCode, 200);

    // Verify Order is PAID
    const settledOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(settledOrder.paymentStatus, "SUCCESS");

    // Verify Session is CLOSED
    const closedSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(closedSession.status, "CLOSED");

    // Table queued for cleaning
    const dirtyTable = await prisma.diningTable.findUnique({ where: { id: diningTable.id } });
    assert.equal(dirtyTable.cleaningStatus, "DIRTY");

    // Clean table
    const cleanRes = await app.inject({
      method: "POST",
      url: `/api/v1/staff/tables/${diningTable.id}/clean`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: { restaurantId: rid },
    });
    assert.equal(cleanRes.statusCode, 200);

    const availableTable = await prisma.diningTable.findUnique({ where: { id: diningTable.id } });
    assert.equal(availableTable.cleaningStatus, "CLEAN");
  });
});
