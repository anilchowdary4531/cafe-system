import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import staffTaskRoutes from "../routes/staffTasks.routes.js";
import { createOrderByStaff } from "../services/orderService.js";
import {
  assignItemToChef,
  selfPickItem,
  getChefAssignedItems,
  updateKitchenConfig,
} from "../services/kitchenAssignmentService.js";
import { updateKotItemStatus } from "../services/kotService.js";
import { completeSessionAndReleaseTable, getOrCreateActiveSession } from "../services/tableSessionService.js";

test("Tiffzy Canonical Order + Item + Chef Flow Consistency", async (t) => {
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

  // 1. Setup Test Restaurant, Menu Items, Table, and Chefs
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Consistency Rest ${Date.now()}`,
      slug: `consistency-rest-${Date.now()}`,
      phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
      email: `consistency_${Date.now()}@test.com`,
      kitchenAssignmentMode: "SELF_PICK",
      kitchenSelfPickScope: "ITEMS",
    },
  });

  const altRestaurant = await prisma.restaurant.create({
    data: {
      name: `Alt Rest ${Date.now()}`,
      slug: `alt-rest-${Date.now()}`,
      phone: `+9198764${Math.floor(10000 + Math.random() * 90000)}`,
      email: `alt_${Date.now()}@test.com`,
    },
  });

  const table = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "C1",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  const menuItemA = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Tandoori Paneer Tikka",
      category: "Starters",
      price: 250,
      isAvailable: true,
    },
  });

  const menuItemB = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Garlic Butter Naan",
      category: "Breads",
      price: 60,
      isAvailable: true,
    },
  });

  const chefA = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Chef Arjun",
      email: `chef_a_${Date.now()}@test.com`,
      role: "CHEF",
      designation: "Line Chef",
      password: "hash123",
      isActive: true,
    },
  });

  const chefB = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Chef Bilal",
      email: `chef_b_${Date.now()}@test.com`,
      role: "CHEF",
      designation: "Line Chef",
      password: "hash123",
      isActive: true,
    },
  });

  const seniorChef = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Executive Chef Rajesh",
      email: `sr_chef_${Date.now()}@test.com`,
      role: "CHEF",
      designation: "Senior Chef",
      password: "hash123",
      isActive: true,
    },
  });

  const stewardUser = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Steward Suresh",
      email: `steward_${Date.now()}@test.com`,
      role: "STEWARD",
      designation: "Floor Steward",
      password: "hash123",
      isActive: true,
    },
  });

  const cleanerUser = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Cleaner Ramesh",
      email: `cleaner_${Date.now()}@test.com`,
      role: "CLEANER",
      designation: "Housekeeping",
      password: "hash123",
      isActive: true,
    },
  });

  const altStewardUser = await prisma.user.create({
    data: {
      restaurantId: altRestaurant.id,
      name: "Alt Steward",
      email: `alt_steward_${Date.now()}@test.com`,
      role: "STEWARD",
      designation: "Floor Steward",
      password: "hash123",
      isActive: true,
    },
  });

  // Fastify app for testing endpoints
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-secret-tiffzy-jwt-consistency" });
  await app.register(staffTaskRoutes, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES: ["CASHIER", "SWIPER", "CLEANER", "STEWARD", "CHEF", "WAITER", "MANAGER", "OWNER"],
  });
  await app.ready();

  const stewardToken = app.jwt.sign({
    id: stewardUser.id,
    userId: stewardUser.id,
    role: "STEWARD",
    restaurantId: restaurant.id,
  });

  const cleanerToken = app.jwt.sign({
    id: cleanerUser.id,
    userId: cleanerUser.id,
    role: "CLEANER",
    restaurantId: restaurant.id,
  });

  let createdOrder = null;
  let kotItems = [];

  await t.test("1 & 2: Order creates correct canonical items and duplicate menu items remain separate OrderItems", async () => {
    // Order contains 2 separate items of MenuItem A (e.g. customized differently or separate entries) + 1 of MenuItem B
    createdOrder = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restaurant.id, userId: stewardUser.id, role: "WAITER", userName: "Server" },
      input: {
        tableNo: "C1",
        items: [
          { menuItemId: menuItemA.id, qty: 1, notes: "Extra spicy" },
          { menuItemId: menuItemA.id, qty: 2, notes: "Mild spice" },
          { menuItemId: menuItemB.id, qty: 3 },
        ],
      },
    });

    assert.ok(createdOrder.id, "Order created with ID");
    assert.equal(createdOrder.items.length, 3, "Order has exactly 3 separate order items");

    const [item1, item2, item3] = createdOrder.items;
    assert.notEqual(item1.id, item2.id, "Duplicate menu items have distinct canonical IDs");
    assert.equal(item1.menuItemId, menuItemA.id);
    assert.equal(item2.menuItemId, menuItemA.id);
    assert.equal(item1.qty, 1);
    assert.equal(item2.qty, 2);
  });

  await t.test("3: KOT references exact OrderItems", async () => {
    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: createdOrder.id },
      include: { items: true },
    });

    assert.ok(kots.length >= 1, "At least 1 KOT created");
    kotItems = kots.flatMap((k) => k.items);
    assert.equal(kotItems.length, 3, "KOT contains all 3 order items");

    const orderItemIds = createdOrder.items.map((i) => i.id);
    for (const ki of kotItems) {
      assert.ok(ki.orderItemId, "KOT item references an orderItemId");
      assert.ok(orderItemIds.includes(ki.orderItemId), "orderItemId belongs to the parent order");
    }
  });

  await t.test("4 & 5: Senior Chef assigns one item; other items remain unassigned", async () => {
    const targetItem = kotItems[0];
    const res = await assignItemToChef({
      prisma,
      restaurantId: restaurant.id,
      itemId: targetItem.id,
      chefId: chefA.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name },
      realtime: mockRealtime,
    });

    assert.ok(res.ok, "Item assigned successfully");
    assert.equal(res.item.assignedChefId, chefA.id);

    // Verify database state: item 0 assigned, items 1 & 2 unassigned
    const dbItems = await prisma.kitchenOrderTicketItem.findMany({
      where: { id: { in: kotItems.map((k) => k.id) } },
      orderBy: { id: "asc" },
    });

    assert.equal(dbItems[0].assignedChefId, chefA.id, "Target item assigned to Chef A");
    assert.equal(dbItems[1].assignedChefId, null, "Item 2 remains unassigned");
    assert.equal(dbItems[2].assignedChefId, null, "Item 3 remains unassigned");
  });

  await t.test("6: Chef sees only assigned items; cannot view other stations unless privileged", async () => {
    const chefAItems = await getChefAssignedItems({
      prisma,
      restaurantId: restaurant.id,
      chefId: chefA.id,
      requestingActor: { userId: chefA.id, role: "CHEF" },
    });

    assert.equal(chefAItems.items.length, 1, "Chef A sees exactly their 1 assigned item");
    assert.equal(chefAItems.items[0].id, kotItems[0].id);

    // Chef B cannot spy on Chef A's station
    await assert.rejects(
      async () => {
        await getChefAssignedItems({
          prisma,
          restaurantId: restaurant.id,
          chefId: chefA.id,
          requestingActor: { userId: chefB.id, role: "CHEF", designation: "Line Chef" },
        });
      },
      (err) => err.status === 403,
      "Unauthorized chef blocked from another chef's station"
    );

    // Senior Chef is privileged and can inspect Chef A's station
    const srChefView = await getChefAssignedItems({
      prisma,
      restaurantId: restaurant.id,
      chefId: chefA.id,
      requestingActor: { userId: seniorChef.id, role: "CHEF", designation: "Senior Chef" },
    });
    assert.equal(srChefView.items.length, 1, "Senior Chef can monitor station");
  });

  await t.test("7 & 8: Chef self-pick is atomic; two chefs cannot claim the same item", async () => {
    const availableItem = kotItems[1]; // unassigned

    // Both Chef A and Chef B concurrently attempt to self-pick availableItem
    const [resultA, resultB] = await Promise.allSettled([
      selfPickItem({
        prisma,
        restaurantId: restaurant.id,
        itemId: availableItem.id,
        chefId: chefA.id,
        actor: { userId: chefA.id, userName: chefA.name },
        realtime: mockRealtime,
      }),
      selfPickItem({
        prisma,
        restaurantId: restaurant.id,
        itemId: availableItem.id,
        chefId: chefB.id,
        actor: { userId: chefB.id, userName: chefB.name },
        realtime: mockRealtime,
      }),
    ]);

    const successes = [resultA, resultB].filter((r) => r.status === "fulfilled");
    const rejections = [resultA, resultB].filter((r) => r.status === "rejected");

    assert.equal(successes.length, 1, "Exactly one chef wins atomic claim");
    assert.equal(rejections.length, 1, "Second chef receives 409 conflict");
    assert.equal(rejections[0].reason.status, 409, "Conflict status is HTTP 409");
  });

  await t.test("9, 10 & 11: Item status transition to PREPARING and READY; other items remain unchanged", async () => {
    const itemToCook = kotItems[0];
    const kotId = itemToCook.kotId;

    // Start cooking
    const prepRes = await updateKotItemStatus({
      prisma,
      kotId,
      itemId: itemToCook.id,
      restaurantId: restaurant.id,
      nextStatus: "PREPARING",
      actor: { userId: chefA.id, userName: chefA.name },
    });

    assert.equal(prepRes.kot.status, "PREPARING", "KOT becomes PREPARING");

    // Other items must remain unchanged
    const otherItem = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: kotItems[2].id },
    });
    assert.equal(otherItem.status, "PENDING", "Unrelated item remains PENDING");

    // Mark item READY
    const readyRes = await updateKotItemStatus({
      prisma,
      kotId,
      itemId: itemToCook.id,
      restaurantId: restaurant.id,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name },
    });

    const updatedDbItem = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: itemToCook.id },
    });
    assert.equal(updatedDbItem.status, "READY");
    assert.ok(updatedDbItem.readyAt, "readyAt timestamp recorded");
    assert.equal(updatedDbItem.preparedByName, chefA.name, "preparedByName recorded");
  });

  await t.test("12 & 13: Steward food runner fetches READY item and delivers it", async () => {
    // GET /api/v1/staff/food-runner-items
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });

    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.ok(listBody.items.length >= 1, "At least 1 ready item waiting at pass");

    const readyRunnerItem = listBody.items.find((it) => it.id === kotItems[0].id);
    assert.ok(readyRunnerItem, "Chef A's ready item is in the runner list");
    assert.equal(readyRunnerItem.kot?.tableNo, "C1");

    // PUT /api/v1/staff/food-runner-items/:itemId/delivered
    const deliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${readyRunnerItem.id}/delivered`,
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });

    assert.equal(deliverRes.statusCode, 200);
    const deliverBody = JSON.parse(deliverRes.payload);
    assert.equal(deliverBody.item.status, "SERVED", "Item transitioned to SERVED");
  });

  await t.test("14 & 15: Cross-restaurant tenant isolation on runner item delivery", async () => {
    // Attempting to deliver item using altRestaurant token or cross-tenant query
    const altToken = app.jwt.sign({
      id: altStewardUser.id,
      userId: altStewardUser.id,
      role: "STEWARD",
      restaurantId: altRestaurant.id,
    });

    const crossRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItems[0].id}/delivered`,
      headers: { authorization: `Bearer ${altToken}` },
      query: { restaurantId: String(altRestaurant.id) },
    });

    assert.equal(crossRes.statusCode, 404, "Cross-restaurant item delivery rejected");
  });

  await t.test("16 & 17: Table cleaning workflow and strict sanitation gate", async () => {
    // Release table session into DIRTY status
    const releaseRes = await completeSessionAndReleaseTable({
      prisma,
      orderId: createdOrder.id,
      performedByName: "Cashier",
      realtime: mockRealtime,
    });

    assert.ok(releaseRes.completed);
    const tableAfterRelease = await prisma.diningTable.findUnique({ where: { id: table.id } });
    assert.equal(tableAfterRelease.cleaningStatus, "DIRTY");

    // Reseating on DIRTY table must be blocked by table sanitation gate
    await assert.rejects(
      async () => {
        await getOrCreateActiveSession({
          prisma,
          restaurantId: restaurant.id,
          tableId: table.id,
        });
      },
      (err) => err.code === "table_dirty" || /DIRTY/i.test(err.message),
      "Sanitation gate threw table_dirty"
    );

    // Cleaner completes cleaning task
    const cleanTask = await prisma.staffTask.findFirst({
      where: { tableId: table.id, roleTarget: "CLEANER" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(cleanTask, "Cleaner task exists");

    const finishRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${cleanTask.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
      query: { restaurantId: String(restaurant.id) },
    });
    assert.equal(finishRes.statusCode, 200);

    const refreshedTable = await prisma.diningTable.findUnique({ where: { id: table.id } });
    assert.equal(refreshedTable.cleaningStatus, "CLEAN", "Table is now CLEAN");
  });

  // Cleanup
  await app.close();
  await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: restaurant.id } } }).catch(() => {});
  await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurant.id } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.staffTask.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.restaurant.deleteMany({ where: { id: { in: [restaurant.id, altRestaurant.id] } } }).catch(() => {});
});
