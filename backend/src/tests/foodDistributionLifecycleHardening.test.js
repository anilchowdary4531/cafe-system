import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import staffTaskRoutes from "../routes/staffTasks.routes.js";
import ownerRoutes from "../routes/owner.js";
import { updateKotItemStatus } from "../services/kotService.js";

test("Tiffzy Food Distribution Lifecycle Production Hardening Test Suite", async (t) => {
  const emittedEvents = [];
  const mockRealtime = {
    io: {
      to: (room) => ({
        emit: (event, data) => emittedEvents.push({ ns: "io", room, event, data }),
      }),
      of: () => mockRealtime.staff,
    },
    staff: {
      to: (room) => ({
        emit: (event, data) => emittedEvents.push({ ns: "staff", room, event, data }),
      }),
    },
  };

  const JWT_SECRET = "test-secret-food-dist-9999";
  const app = Fastify();
  await app.register(fastifyJwt, { secret: JWT_SECRET });

  app.addHook("onRequest", async (req) => {
    req.prisma = prisma;
  });

  const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "SERVER", "CHEF", "CASHIER", "STEWARD", "CLEANER", "SWIPER", "STAFF"];

  await app.register(staffTaskRoutes, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES,
  });

  await app.register(ownerRoutes, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES,
  });

  await app.ready();

  const ts = Date.now();
  const rest = await prisma.restaurant.create({
    data: {
      name: `Dist Rest ${ts}`,
      slug: `dist-rest-${ts}`,
      phone: `+9198711${Math.floor(10000 + Math.random() * 90000)}`,
      email: `dist_${ts}@test.com`,
    },
  });

  // Create Table 1 (Main Hall) and Table 2 (Section TABLE table 1)
  const mainHallTable = await prisma.diningTable.create({
    data: {
      restaurantId: rest.id,
      tableNo: "1",
      section: "Main Hall",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  const sectionTable = await prisma.diningTable.create({
    data: {
      restaurantId: rest.id,
      tableNo: "table 1",
      section: "TABLE",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  const serverUser = await prisma.user.create({
    data: {
      restaurantId: rest.id,
      name: "Server Suresh",
      email: `server_suresh_${ts}@test.com`,
      role: "SERVER",
      designation: "Server",
      password: "hash",
    },
  });

  const serverToken = app.jwt.sign({
    id: serverUser.id,
    userId: serverUser.id,
    role: "SERVER",
    restaurantId: rest.id,
  });

  // Table sessions
  const mainSession = await prisma.tableSession.create({
    data: {
      restaurantId: rest.id,
      tableId: mainHallTable.id,
      tableNo: "1",
      waiterId: serverUser.id,
      status: "ACTIVE",
    },
  });

  const sectionSession = await prisma.tableSession.create({
    data: {
      restaurantId: rest.id,
      tableId: sectionTable.id,
      tableNo: "table 1",
      status: "ACTIVE",
    },
  });

  // Create multi-item Order for Main Hall Table
  const orderMain = await prisma.order.create({
    data: {
      restaurantId: rest.id,
      tableSessionId: mainSession.id,
      tableNo: "1",
      orderNo: `ORD-DIST-MAIN-${ts}`,
      status: "READY",
      subtotal: 500,
      total: 500,
      createdByUserId: serverUser.id,
    },
  });

  const kotMain = await prisma.kitchenOrderTicket.create({
    data: {
      restaurantId: rest.id,
      orderId: orderMain.id,
      tableSessionId: mainSession.id,
      kotNo: `KOT-M-${ts}`,
      sequenceNumber: 1,
      status: "READY",
      tableNo: "1",
      waiterId: serverUser.id,
      waiterName: serverUser.name,
    },
  });

  const itemA = await prisma.kitchenOrderTicketItem.create({
    data: {
      kotId: kotMain.id,
      itemName: "Butter Chicken",
      qty: 1,
      status: "READY",
    },
  });

  const itemB = await prisma.kitchenOrderTicketItem.create({
    data: {
      kotId: kotMain.id,
      itemName: "Garlic Naan",
      qty: 2,
      status: "READY",
    },
  });

  // Create Order for Section TABLE table 1
  const orderSection = await prisma.order.create({
    data: {
      restaurantId: rest.id,
      tableSessionId: sectionSession.id,
      tableNo: "table 1",
      orderNo: `ORD-DIST-SEC-${ts}`,
      status: "READY",
      subtotal: 200,
      total: 200,
    },
  });

  const kotSection = await prisma.kitchenOrderTicket.create({
    data: {
      restaurantId: rest.id,
      orderId: orderSection.id,
      tableSessionId: sectionSession.id,
      kotNo: `KOT-S-${ts}`,
      sequenceNumber: 1,
      status: "READY",
      tableNo: "table 1",
    },
  });

  const itemSection = await prisma.kitchenOrderTicketItem.create({
    data: {
      kotId: kotSection.id,
      itemName: "Masala Chai",
      qty: 1,
      status: "READY",
    },
  });

  await t.test("1. Delivery of READY item executes without Prisma error & resolves canonical table", async () => {
    emittedEvents.length = 0;

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${itemA.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
      query: { restaurantId: String(rest.id) },
    });

    assert.equal(res.statusCode, 200, "Must return HTTP 200 without Prisma crash");
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.item.id, itemA.id);
    assert.equal(body.item.status, "SERVED");
    assert.equal(body.tableId, mainHallTable.id, "Resolves canonical mainHallTable.id");
    assert.equal(body.tableNo, "1");
    assert.equal(body.section, "Main Hall");
  });

  await t.test("2. Multi-item semantics: Item A served, KOT and Order stay READY because Item B is still READY", async () => {
    const kotInDb = await prisma.kitchenOrderTicket.findUnique({
      where: { id: kotMain.id },
    });
    const orderInDb = await prisma.order.findUnique({
      where: { id: orderMain.id },
    });

    assert.equal(kotInDb.status, "READY", "KOT remains READY since Item B is still READY");
    assert.equal(orderInDb.status, "READY", "Order remains READY since Item B is still READY");
  });

  await t.test("3. Delivery of Item B: KOT becomes SERVED and Order transitions to DELIVERED", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${itemB.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
      query: { restaurantId: String(rest.id) },
    });

    assert.equal(res.statusCode, 200);

    const kotInDb = await prisma.kitchenOrderTicket.findUnique({
      where: { id: kotMain.id },
    });
    const orderInDb = await prisma.order.findUnique({
      where: { id: orderMain.id },
    });

    assert.equal(kotInDb.status, "SERVED", "KOT transitions to SERVED when all active items are served");
    assert.equal(orderInDb.status, "DELIVERED", "Order transitions to DELIVERED when all KOTs are served");
  });

  await t.test("4. Idempotency: Double-clicking / retrying delivery returns HTTP 200 with alreadyServed: true", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${itemA.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
      query: { restaurantId: String(rest.id) },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.alreadyServed, true, "Reports alreadyServed: true");
    assert.equal(body.item.status, "SERVED");
  });

  await t.test("5. Persistent Notification is created with unique idempotencyKey and restaurant recipient", async () => {
    const notifs = await prisma.notification.findMany({
      where: {
        restaurantId: rest.id,
        orderId: orderMain.id,
        notificationType: "ORDER_DELIVERED",
      },
    });

    assert.ok(notifs.length > 0, "Persistent notification was created in database");
    const restNotif = notifs.find((n) => n.recipientType === "RESTAURANT");
    assert.ok(restNotif, "Found notification for RESTAURANT / Owner");
    assert.match(restNotif.idempotencyKey, /food_served_rest_/);

    // Verify no duplicates created by the retry in step 4
    const itemANotifs = notifs.filter((n) => n.idempotencyKey?.includes(`_${itemA.id}_`));
    assert.equal(itemANotifs.length, 2, "Exactly 1 user notif and 1 restaurant notif for itemA (no dupes from retry)");
  });

  await t.test("6. Canonical Table Isolation: Main Hall Table 1 (id: 8) vs Section TABLE table 1 (id: 12)", async () => {
    // Section table order and item must be completely untouched
    const sectionItemInDb = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: itemSection.id },
    });
    const sectionKotInDb = await prisma.kitchenOrderTicket.findUnique({
      where: { id: kotSection.id },
    });
    const sectionOrderInDb = await prisma.order.findUnique({
      where: { id: orderSection.id },
    });

    assert.equal(sectionItemInDb.status, "READY", "Section TABLE item remains READY");
    assert.equal(sectionKotInDb.status, "READY", "Section TABLE KOT remains READY");
    assert.equal(sectionOrderInDb.status, "READY", "Section TABLE Order remains READY");

    // All events emitted for itemA / itemB had tableId = mainHallTable.id, NEVER sectionTable.id
    const foodDeliveredEvents = emittedEvents.filter((e) => e.event === "food:delivered");
    assert.ok(foodDeliveredEvents.length > 0, "food:delivered events were broadcast");
    for (const ev of foodDeliveredEvents) {
      if (ev.data.itemId === itemA.id || ev.data.itemId === itemB.id) {
        assert.equal(ev.data.tableId, mainHallTable.id, "Table ID strictly matches Main Hall Table");
        assert.notEqual(ev.data.tableId, sectionTable.id, "Table ID never leaks to Section Table");
      }
    }
  });

  await t.test("7. Realtime events include table:updated with canonical tableId", async () => {
    const tableUpdatedEvents = emittedEvents.filter((e) => e.event === "table:updated");
    assert.ok(tableUpdatedEvents.length > 0, "table:updated events were emitted");
    const forMain = tableUpdatedEvents.find((e) => e.data.tableId === mainHallTable.id);
    assert.ok(forMain, "Found table:updated event for Main Hall Table ID");
    assert.equal(forMain.data.section, "Main Hall");
  });
});
