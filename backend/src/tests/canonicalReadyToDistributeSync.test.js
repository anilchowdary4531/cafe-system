import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import staffTaskRoutes from "../routes/staffTasks.routes.js";
import ownerRoutes from "../routes/owner.js";
import { createOrderByStaff } from "../services/orderService.js";
import { updateKotItemStatus } from "../services/kotService.js";

test("Tiffzy Canonical Ready-to-Distribute Sync Test Suite", async (t) => {
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

  const JWT_SECRET = "test-secret-canonical-sync-9999";
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

  // 1. Setup Test Restaurant A and Test Restaurant B (for tenant isolation)
  const ts = Date.now();
  const restA = await prisma.restaurant.create({
    data: {
      name: `Sync Rest A ${ts}`,
      slug: `sync-rest-a-${ts}`,
      phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
      email: `sync_a_${ts}@test.com`,
    },
  });

  const restB = await prisma.restaurant.create({
    data: {
      name: `Sync Rest B ${ts}`,
      slug: `sync-rest-b-${ts}`,
      phone: `+9198764${Math.floor(10000 + Math.random() * 90000)}`,
      email: `sync_b_${ts}@test.com`,
    },
  });

  const tableA1 = await prisma.diningTable.create({
    data: {
      restaurantId: restA.id,
      tableNo: "T10",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  const tableB1 = await prisma.diningTable.create({
    data: {
      restaurantId: restB.id,
      tableNo: "TB1",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  const menuPizza = await prisma.menuItem.create({
    data: {
      restaurantId: restA.id,
      name: "Tandoori Pizza",
      category: "Pizza",
      price: 350,
      isAvailable: true,
    },
  });

  const menuCoffee = await prisma.menuItem.create({
    data: {
      restaurantId: restA.id,
      name: "Cold Coffee",
      category: "Beverages",
      price: 120,
      isAvailable: true,
    },
  });

  const menuBurger = await prisma.menuItem.create({
    data: {
      restaurantId: restA.id,
      name: "Paneer Burger",
      category: "Burgers",
      price: 180,
      isAvailable: true,
    },
  });

  const serverA = await prisma.user.create({
    data: {
      restaurantId: restA.id,
      name: "Server Anita",
      email: `server_anita_${ts}@test.com`,
      role: "SERVER",
      designation: "Server",
      password: "pass",
      isActive: true,
    },
  });

  const serverB = await prisma.user.create({
    data: {
      restaurantId: restB.id,
      name: "Server Bob",
      email: `server_bob_${ts}@test.com`,
      role: "SERVER",
      designation: "Server",
      password: "pass",
      isActive: true,
    },
  });

  const chefA = await prisma.user.create({
    data: {
      restaurantId: restA.id,
      name: "Chef Vikram",
      email: `chef_vikram_${ts}@test.com`,
      role: "CHEF",
      designation: "Line Chef",
      password: "pass",
      isActive: true,
    },
  });

  const serverAToken = app.jwt.sign({
    id: serverA.id,
    userId: serverA.id,
    restaurantId: restA.id,
    role: "SERVER",
    designation: "Server",
    name: serverA.name,
  });

  const serverBToken = app.jwt.sign({
    id: serverB.id,
    userId: serverB.id,
    restaurantId: restB.id,
    role: "SERVER",
    designation: "Server",
    name: serverB.name,
  });

  let createdKotItems = [];

  // A. Create Order with 3 items (Pizza, Coffee, Burger)
  await t.test("A. Order creates 3 canonical KOT items", async () => {
    const order = await createOrderByStaff({
      prisma,
      actor: { userId: serverA.id, role: "SERVER", restaurantId: restA.id, name: serverA.name },
      input: {
        tableNo: "T10",
        orderSource: "WAITER",
        items: [
          { menuItemId: menuPizza.id, name: menuPizza.name, qty: 1, price: 350 },
          { menuItemId: menuCoffee.id, name: menuCoffee.name, qty: 1, price: 120 },
          { menuItemId: menuBurger.id, name: menuBurger.name, qty: 1, price: 180 },
        ],
      },
    });

    assert.ok(order.id, "Order created");
    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: order.id },
      include: { items: true },
    });
    assert.ok(kots.length > 0, "KOT created");

    createdKotItems = kots.flatMap((k) => k.items);
    assert.equal(createdKotItems.length, 3, "3 KOTItems created in database");
    assert.ok(createdKotItems.every((it) => it.status === "PENDING"), "All items initially PENDING");
  });

  // B. Server queue is initially empty (0 items ready)
  await t.test("B. Server queue shows 0 ready items when all items are PENDING", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.items.length, 0, "Initial ready queue count is 0");
  });

  // C. Partial order readiness: Chef marks ONLY Pizza READY, Coffee PREPARING, Burger PENDING
  await t.test("C. Partial Order: 1 item READY, 1 PREPARING, 1 PENDING -> Server queue shows exactly 1 item", async () => {
    const pizzaItem = createdKotItems.find((it) => it.itemName === "Tandoori Pizza");
    const coffeeItem = createdKotItems.find((it) => it.itemName === "Cold Coffee");

    // Chef starts preparing Coffee
    await updateKotItemStatus({
      prisma,
      kotId: coffeeItem.kotId,
      itemId: coffeeItem.id,
      restaurantId: restA.id,
      nextStatus: "PREPARING",
      actor: { userId: chefA.id, userName: chefA.name },
    });

    // Chef marks Pizza READY
    await updateKotItemStatus({
      prisma,
      kotId: pizzaItem.kotId,
      itemId: pizzaItem.id,
      restaurantId: restA.id,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name },
    });

    // Check Server distribution queue
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.items.length, 1, "Server sees exactly 1 item ready to distribute");

    const readyItem = body.items[0];
    assert.equal(readyItem.id, pizzaItem.id, "Queue exposes exact canonical KOTItem.id");
    assert.equal(readyItem.itemName, "Tandoori Pizza");
    assert.equal(readyItem.tableNo, "T10");
    assert.equal(readyItem.status, "READY");
    assert.ok(readyItem.kotId, "kotId exposed");
    assert.ok(readyItem.orderId, "orderId exposed");
    assert.equal(readyItem.restaurantId, restA.id, "restaurantId exposed");

    // Check parent order status is still PREPARING (NOT fully DELIVERED or READY)
    const orderInDb = await prisma.order.findUnique({
      where: { id: readyItem.orderId },
    });
    assert.equal(orderInDb.status, "PREPARING", "Order remains PREPARING (partial order not lost)");
  });

  // D. Multiple READY items: Chef marks Coffee READY as well
  await t.test("D. Multiple READY items: Queue length strictly equals count of ready items", async () => {
    const coffeeItem = createdKotItems.find((it) => it.itemName === "Cold Coffee");

    // Chef marks Coffee READY
    await updateKotItemStatus({
      prisma,
      kotId: coffeeItem.kotId,
      itemId: coffeeItem.id,
      restaurantId: restA.id,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.items.length, 2, "Server queue shows exactly 2 ready items");
    const itemIds = body.items.map((it) => it.id);
    assert.ok(itemIds.includes(createdKotItems[0].id), "Contains Pizza");
    assert.ok(itemIds.includes(coffeeItem.id), "Contains Coffee");
  });

  // E. Distribute Pizza: READY -> SERVED removes exactly that item
  await t.test("E. Server distributes Pizza: removes exactly 1 item, Coffee remains READY", async () => {
    const pizzaItem = createdKotItems.find((it) => it.itemName === "Tandoori Pizza");

    const deliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${pizzaItem.id}/delivered`,
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    assert.equal(deliverRes.statusCode, 200);

    // Queue must now contain only 1 item (Coffee)
    const queueRes = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    const body = JSON.parse(queueRes.payload);
    assert.equal(body.items.length, 1, "Queue decremented to exactly 1 item");
    assert.equal(body.items[0].itemName, "Cold Coffee", "Coffee remains waiting at the pass");

    // In DB, Pizza is SERVED
    const pizzaInDb = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: pizzaItem.id },
    });
    assert.equal(pizzaInDb.status, "SERVED", "Pizza status is SERVED in database");

    // Burger is still PENDING
    const burgerItem = createdKotItems.find((it) => it.itemName === "Paneer Burger");
    const burgerInDb = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: burgerItem.id },
    });
    assert.equal(burgerInDb.status, "PENDING", "Burger remains PENDING");
  });

  // F. Already served item cannot reappear
  await t.test("F. Already served item cannot reappear in queue", async () => {
    const pizzaItem = createdKotItems.find((it) => it.itemName === "Tandoori Pizza");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    const body = JSON.parse(res.payload);
    assert.ok(!body.items.some((it) => it.id === pizzaItem.id), "Pizza does not reappear");
  });

  // G. Duplicate item names remain separate canonical items
  await t.test("G. Duplicate menu items in same order remain distinct KOTItem IDs", async () => {
    const dupOrder = await createOrderByStaff({
      prisma,
      actor: { userId: serverA.id, role: "SERVER", restaurantId: restA.id, name: serverA.name },
      input: {
        tableNo: "T10",
        orderSource: "WAITER",
        items: [
          { menuItemId: menuCoffee.id, name: menuCoffee.name, qty: 1, price: 120 },
          { menuItemId: menuCoffee.id, name: menuCoffee.name, qty: 1, price: 120 },
        ],
      },
    });

    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: dupOrder.id },
      include: { items: true },
    });
    const dupKotItems = kots.flatMap((k) => k.items);
    assert.equal(dupKotItems.length, 2, "Two distinct KOTItem records created");
    assert.notEqual(dupKotItems[0].id, dupKotItems[1].id, "KOTItem IDs are distinct");

    // Mark both READY
    await updateKotItemStatus({
      prisma,
      kotId: dupKotItems[0].kotId,
      itemId: dupKotItems[0].id,
      restaurantId: restA.id,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name },
    });
    await updateKotItemStatus({
      prisma,
      kotId: dupKotItems[1].kotId,
      itemId: dupKotItems[1].id,
      restaurantId: restA.id,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name },
    });

    // Deliver ONLY the first one
    await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${dupKotItems[0].id}/delivered`,
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    const queueRes = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });

    const body = JSON.parse(queueRes.payload);
    const dupIdsInQueue = body.items.map((it) => it.id);
    assert.ok(!dupIdsInQueue.includes(dupKotItems[0].id), "First duplicate item was removed");
    assert.ok(dupIdsInQueue.includes(dupKotItems[1].id), "Second duplicate item remains in queue");
  });

  // H. Tenant Isolation: Restaurant B server cannot see Restaurant A ready items
  await t.test("H. Tenant Isolation: Restaurant B cannot see Restaurant A ready items", async () => {
    // Restaurant B queries food runner items
    const resB = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverBToken}` },
      query: { restaurantId: String(restB.id) },
    });

    assert.equal(resB.statusCode, 200);
    const bodyB = JSON.parse(resB.payload);
    assert.equal(bodyB.items.length, 0, "Restaurant B queue is empty; zero items leaked from Restaurant A");

    // Restaurant B server attempts to deliver Restaurant A item -> 404 forbidden/not found
    const leakItem = createdKotItems[1]; // Coffee from Restaurant A
    const leakAttempt = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${leakItem.id}/delivered`,
      headers: { authorization: `Bearer ${serverBToken}` },
      query: { restaurantId: String(restB.id) },
    });

    assert.equal(leakAttempt.statusCode, 404, "Cross-tenant item delivery rejected with 404");
  });

  // I. Owner /kitchen/ready-items returns identical canonical items
  await t.test("I. Owner endpoint /owner/:restaurantId/kitchen/ready-items returns identical canonical items", async () => {
    const ownerToken = app.jwt.sign({
      id: 999,
      userId: 999,
      restaurantId: restA.id,
      role: "OWNER",
      designation: "Owner",
      name: "Owner Rest A",
    });

    const ownerRes = await app.inject({
      method: "GET",
      url: `/owner/${restA.id}/kitchen/ready-items`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(ownerRes.statusCode, 200);
    const ownerBody = JSON.parse(ownerRes.payload);
    assert.ok(ownerBody.items.length >= 1, "Owner sees the exact canonical ready items");

    const staffRes = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${serverAToken}` },
      query: { restaurantId: String(restA.id) },
    });
    const staffBody = JSON.parse(staffRes.payload);

    assert.equal(ownerBody.items.length, staffBody.items.length, "Owner and Server item counts strictly agree");
    assert.deepEqual(
      ownerBody.items.map((i) => i.id).sort(),
      staffBody.items.map((i) => i.id).sort(),
      "Owner and Server have the exact same KOTItem IDs"
    );
  });
});
