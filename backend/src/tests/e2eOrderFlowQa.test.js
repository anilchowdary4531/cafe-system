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
import {
  completeSessionAndReleaseTable,
  getOrCreateActiveSession,
} from "../services/tableSessionService.js";

test("Tiffzy Comprehensive End-to-End Order Flow QA", async (t) => {
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

  // ==========================================
  // SETUP TEST RESTAURANT, TABLES, MENU ITEMS, USERS
  // ==========================================
  const timestamp = Date.now();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `E2E QA Restaurant ${timestamp}`,
      slug: `e2e-qa-rest-${timestamp}`,
      phone: `+9199887${Math.floor(10000 + Math.random() * 90000)}`,
      email: `e2e_qa_${timestamp}@test.com`,
      kitchenAssignmentMode: "DISPATCHER",
      kitchenSelfPickScope: "ITEMS",
      billingConfig: {
        taxes: [],
        charges: [],
        roundOff: false,
        allowTips: true,
      },
    },
  });

  const altRestaurant = await prisma.restaurant.create({
    data: {
      name: `Alt Restaurant ${timestamp}`,
      slug: `alt-rest-${timestamp}`,
      phone: `+9199886${Math.floor(10000 + Math.random() * 90000)}`,
      email: `alt_qa_${timestamp}@test.com`,
    },
  });

  const table = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "QA-T1",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  // Menu items: Margherita Pizza, Veggie Burger, Mango Juice
  const pizzaMenu = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Margherita Pizza",
      category: "Pizza",
      price: 300,
      isAvailable: true,
    },
  });

  const burgerMenu = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Veggie Burger",
      category: "Burgers",
      price: 150,
      isAvailable: true,
    },
  });

  const juiceMenu = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Mango Juice",
      category: "Beverages",
      price: 80,
      isAvailable: true,
    },
  });

  // Staff users: Senior Chef, Chef A, Chef B, Steward, Cashier, Cleaner
  const seniorChef = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Chef Rajesh (Senior Chef)",
      email: `sr_chef_${timestamp}@test.com`,
      role: "CHEF",
      designation: "Senior Chef",
      password: "hash",
      isActive: true,
    },
  });

  const chefA = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Chef Arjun (Line Chef A)",
      email: `chef_a_${timestamp}@test.com`,
      role: "CHEF",
      designation: "Line Chef",
      password: "hash",
      isActive: true,
    },
  });

  const chefB = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Chef Bilal (Line Chef B)",
      email: `chef_b_${timestamp}@test.com`,
      role: "CHEF",
      designation: "Line Chef",
      password: "hash",
      isActive: true,
    },
  });

  const steward = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Steward Suresh",
      email: `steward_${timestamp}@test.com`,
      role: "STEWARD",
      designation: "Floor Steward",
      password: "hash",
      isActive: true,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Cashier Priya",
      email: `cashier_${timestamp}@test.com`,
      role: "CASHIER",
      designation: "Cashier",
      password: "hash",
      isActive: true,
    },
  });

  const cleaner = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Cleaner Ramesh",
      email: `cleaner_${timestamp}@test.com`,
      role: "CLEANER",
      designation: "Housekeeping",
      password: "hash",
      isActive: true,
    },
  });

  const altSteward = await prisma.user.create({
    data: {
      restaurantId: altRestaurant.id,
      name: "Alt Steward",
      email: `alt_steward_${timestamp}@test.com`,
      role: "STEWARD",
      designation: "Floor Steward",
      password: "hash",
      isActive: true,
    },
  });

  // Fastify app setup
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "tiffzy-test-jwt-secret-qa-key" });
  await app.register(staffTaskRoutes, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES: ["CASHIER", "SWIPER", "CLEANER", "STEWARD", "CHEF", "WAITER", "MANAGER", "OWNER"],
  });
  await app.ready();

  const stewardToken = app.jwt.sign({
    id: steward.id,
    userId: steward.id,
    role: "STEWARD",
    restaurantId: restaurant.id,
  });

  const cashierToken = app.jwt.sign({
    id: cashier.id,
    userId: cashier.id,
    role: "CASHIER",
    restaurantId: restaurant.id,
  });

  const cleanerToken = app.jwt.sign({
    id: cleaner.id,
    userId: cleaner.id,
    role: "CLEANER",
    restaurantId: restaurant.id,
  });

  const altToken = app.jwt.sign({
    id: altSteward.id,
    userId: altSteward.id,
    role: "STEWARD",
    restaurantId: altRestaurant.id,
  });

  // References to be recorded across phases
  let ORDER_ID;
  let ITEM_1_ID;
  let ITEM_2_ID;
  let ITEM_3_ID;
  let ITEM_4_ID;
  let TABLE_ID = table.id;
  let TABLE_SESSION_ID;
  let KOT_ID;
  let KOT_ITEM_1_ID;
  let KOT_ITEM_2_ID;
  let KOT_ITEM_3_ID;
  let KOT_ITEM_4_ID;
  let createdOrder;
  let activeShift;

  // Open cashier shift for settlement
  activeShift = await prisma.cashierShift.create({
    data: {
      restaurantId: restaurant.id,
      userId: cashier.id,
      openingCash: 1000,
      expectedCash: 1000,
      status: "OPEN",
      businessDate: new Date(),
    },
  });

  // ==========================================
  // PHASE 1: ORDER CREATION
  // ==========================================
  await t.test("PHASE 1: Order Creation with duplicate menu items", async () => {
    // 4 items:
    // Item 1: Margherita Pizza, qty 1, notes: "Extra crispy crust"
    // Item 2: Margherita Pizza, qty 2, notes: "Gluten free base"
    // Item 3: Veggie Burger, qty 1, notes: "No onions"
    // Item 4: Mango Juice, qty 1, notes: "Less ice"
    createdOrder = await createOrderByStaff({
      prisma,
      actor: { role: "WAITER", userId: steward.id, userName: "Steward Suresh", restaurantId: restaurant.id },
      input: {
        tableNo: table.tableNo,
        customerName: "Rahul Sharma",
        phone: "9876543210",
        items: [
          { menuItemId: pizzaMenu.id, itemName: pizzaMenu.name, qty: 1, notes: "Extra crispy crust" },
          { menuItemId: pizzaMenu.id, itemName: pizzaMenu.name, qty: 2, notes: "Gluten free base" },
          { menuItemId: burgerMenu.id, itemName: burgerMenu.name, qty: 1, notes: "No onions" },
          { menuItemId: juiceMenu.id, itemName: juiceMenu.name, qty: 1, notes: "Less ice" },
        ],
      },
    });

    assert.ok(createdOrder?.id, "Order created with canonical ID");
    ORDER_ID = createdOrder.id;
    TABLE_SESSION_ID = createdOrder.tableSessionId;

    assert.equal(createdOrder.items.length, 4, "Exactly 4 OrderItems created");

    const item1 = createdOrder.items.find((i) => i.notes === "Extra crispy crust");
    const item2 = createdOrder.items.find((i) => i.notes === "Gluten free base");
    const item3 = createdOrder.items.find((i) => i.notes === "No onions");
    const item4 = createdOrder.items.find((i) => i.notes === "Less ice");

    assert.ok(item1 && item2 && item3 && item4, "All 4 distinct items resolved");

    ITEM_1_ID = item1.id;
    ITEM_2_ID = item2.id;
    ITEM_3_ID = item3.id;
    ITEM_4_ID = item4.id;

    // CRITICAL: Item 1 and Item 2 share menuItemId but MUST have separate OrderItem IDs
    assert.equal(item1.menuItemId, item2.menuItemId, "Item 1 and Item 2 have same menuItemId");
    assert.notEqual(ITEM_1_ID, ITEM_2_ID, "Item 1 and Item 2 have separate canonical OrderItem IDs");
    assert.equal(item1.qty, 1, "Item 1 qty is 1");
    assert.equal(item2.qty, 2, "Item 2 qty is 2");
    assert.equal(item3.qty, 1, "Item 3 qty is 1");
    assert.equal(item4.qty, 1, "Item 4 qty is 1");

    // Subtotal: (300*1) + (300*2) + (150*1) + (80*1) = 300 + 600 + 150 + 80 = 1130
    assert.equal(createdOrder.subtotal, 1130, "Subtotal is 1130");
    assert.equal(createdOrder.total, 1130, "Total is 1130");
    assert.ok(TABLE_SESSION_ID, "TableSession ID linked");
  });

  // ==========================================
  // PHASE 2: SERVER VERIFICATION
  // ==========================================
  await t.test("PHASE 2: Server Verification", async () => {
    const sessionWithOrders = await prisma.tableSession.findUnique({
      where: { id: TABLE_SESSION_ID },
      include: {
        orders: {
          include: { items: true },
        },
        table: true,
      },
    });

    assert.ok(sessionWithOrders, "Session exists");
    assert.equal(sessionWithOrders.tableId, TABLE_ID, "Table matches");
    assert.equal(sessionWithOrders.orders.length, 1, "One active order");

    const serverOrder = sessionWithOrders.orders[0];
    assert.equal(serverOrder.id, ORDER_ID, "Server sees identical Order ID");
    assert.equal(serverOrder.items.length, 4, "Server sees 4 OrderItems");

    const sItem1 = serverOrder.items.find((i) => i.id === ITEM_1_ID);
    const sItem2 = serverOrder.items.find((i) => i.id === ITEM_2_ID);
    const sItem3 = serverOrder.items.find((i) => i.id === ITEM_3_ID);
    const sItem4 = serverOrder.items.find((i) => i.id === ITEM_4_ID);

    assert.ok(sItem1 && sItem2 && sItem3 && sItem4, "All canonical OrderItems exist in Server view");
    assert.equal(sItem1.qty, 1);
    assert.equal(sItem2.qty, 2);
    assert.equal(sItem3.qty, 1);
    assert.equal(sItem4.qty, 1);
  });

  // ==========================================
  // PHASE 3: KOT CREATION & ITEM MAPPING
  // ==========================================
  await t.test("PHASE 3: KOT Creation and 1:1 OrderItem mapping", async () => {
    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: ORDER_ID },
      include: { items: true },
    });

    assert.equal(kots.length, 1, "One KOT ticket for the order");
    const kot = kots[0];
    KOT_ID = kot.id;

    assert.equal(kot.items.length, 4, "KOT has exactly 4 items");

    const k1 = kot.items.find((k) => k.orderItemId === ITEM_1_ID);
    const k2 = kot.items.find((k) => k.orderItemId === ITEM_2_ID);
    const k3 = kot.items.find((k) => k.orderItemId === ITEM_3_ID);
    const k4 = kot.items.find((k) => k.orderItemId === ITEM_4_ID);

    assert.ok(k1 && k2 && k3 && k4, "Every KOTItem maps 1:1 to exact OrderItem");
    assert.notEqual(k1.id, k2.id, "KOT items for Item 1 and Item 2 have distinct KOT item IDs");

    KOT_ITEM_1_ID = k1.id;
    KOT_ITEM_2_ID = k2.id;
    KOT_ITEM_3_ID = k3.id;
    KOT_ITEM_4_ID = k4.id;

    assert.equal(k1.qty, 1);
    assert.equal(k2.qty, 2);
    assert.equal(k3.qty, 1);
    assert.equal(k4.qty, 1);
  });

  // ==========================================
  // PHASE 4: SENIOR CHEF DISPATCH
  // ==========================================
  await t.test("PHASE 4: Senior Chef Dispatch - mixed item assignment", async () => {
    // Mixed assignment:
    // Item 1 -> Chef A
    // Item 2 -> Chef B
    // Item 3 -> Chef A
    // Item 4 -> remain unassigned
    await assignItemToChef({
      prisma,
      restaurantId: restaurant.id,
      itemId: KOT_ITEM_1_ID,
      chefId: chefA.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
      realtime: mockRealtime,
    });

    await assignItemToChef({
      prisma,
      restaurantId: restaurant.id,
      itemId: KOT_ITEM_2_ID,
      chefId: chefB.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
      realtime: mockRealtime,
    });

    await assignItemToChef({
      prisma,
      restaurantId: restaurant.id,
      itemId: KOT_ITEM_3_ID,
      chefId: chefA.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
      realtime: mockRealtime,
    });

    // Verify DB state
    const kotItems = await prisma.kitchenOrderTicketItem.findMany({
      where: { kotId: KOT_ID },
    });

    const item1 = kotItems.find((k) => k.id === KOT_ITEM_1_ID);
    const item2 = kotItems.find((k) => k.id === KOT_ITEM_2_ID);
    const item3 = kotItems.find((k) => k.id === KOT_ITEM_3_ID);
    const item4 = kotItems.find((k) => k.id === KOT_ITEM_4_ID);

    assert.equal(item1.assignedChefId, chefA.id, "Item 1 assigned to Chef A");
    assert.equal(item2.assignedChefId, chefB.id, "Item 2 assigned to Chef B");
    assert.equal(item3.assignedChefId, chefA.id, "Item 3 assigned to Chef A");
    assert.equal(item4.assignedChefId, null, "Item 4 remains unassigned");
  });

  // ==========================================
  // PHASE 5: CHEF A STATION VERIFICATION
  // ==========================================
  await t.test("PHASE 5: Chef A Station shows ONLY Item 1 and Item 3", async () => {
    const chefARes = await getChefAssignedItems({
      prisma,
      restaurantId: restaurant.id,
      chefId: chefA.id,
      requestingActor: { id: chefA.id, userId: chefA.id, role: "CHEF" },
    });

    const chefAItems = chefARes.items;
    const chefAItemIds = chefAItems.map((i) => i.id);
    assert.ok(chefAItemIds.includes(KOT_ITEM_1_ID), "Chef A has Item 1");
    assert.ok(chefAItemIds.includes(KOT_ITEM_3_ID), "Chef A has Item 3");
    assert.ok(!chefAItemIds.includes(KOT_ITEM_2_ID), "Chef A does NOT have Item 2");
    assert.ok(!chefAItemIds.includes(KOT_ITEM_4_ID), "Chef A does NOT have Item 4");

    // Chef A starts cooking Item 1
    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_1_ID,
      nextStatus: "PREPARING",
      actor: { userId: chefA.id, userName: chefA.name, role: "CHEF" },
    });

    const refreshedItem1 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_1_ID } });
    const refreshedItem3 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_3_ID } });

    assert.equal(refreshedItem1.status, "PREPARING", "Item 1 is PREPARING");
    assert.equal(refreshedItem3.status, "PENDING", "Item 3 remains PENDING/ASSIGNED");
  });

  // ==========================================
  // PHASE 6: MULTI-CHEF CONSISTENCY (CHEF B)
  // ==========================================
  await t.test("PHASE 6: Chef B Station shows Item 2, starts cooking", async () => {
    const chefBRes = await getChefAssignedItems({
      prisma,
      restaurantId: restaurant.id,
      chefId: chefB.id,
      requestingActor: { id: chefB.id, userId: chefB.id, role: "CHEF" },
    });

    const chefBItems = chefBRes.items;
    const chefBItemIds = chefBItems.map((i) => i.id);
    assert.ok(chefBItemIds.includes(KOT_ITEM_2_ID), "Chef B has Item 2");
    assert.ok(!chefBItemIds.includes(KOT_ITEM_1_ID), "Chef B does NOT have Item 1");
    assert.ok(!chefBItemIds.includes(KOT_ITEM_3_ID), "Chef B does NOT have Item 3");

    // Chef B starts cooking Item 2
    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_2_ID,
      nextStatus: "PREPARING",
      actor: { userId: chefB.id, userName: chefB.name, role: "CHEF" },
    });

    const refreshedItem2 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_2_ID } });
    assert.equal(refreshedItem2.status, "PREPARING", "Item 2 is PREPARING");
  });

  // ==========================================
  // PHASE 7: READY TRANSITION FOR ITEM 1
  // ==========================================
  await t.test("PHASE 7: Item 1 becomes READY; others remain unchanged", async () => {
    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_1_ID,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name, role: "CHEF" },
    });

    const items = await prisma.kitchenOrderTicketItem.findMany({ where: { kotId: KOT_ID } });
    const i1 = items.find((i) => i.id === KOT_ITEM_1_ID);
    const i2 = items.find((i) => i.id === KOT_ITEM_2_ID);
    const i3 = items.find((i) => i.id === KOT_ITEM_3_ID);
    const i4 = items.find((i) => i.id === KOT_ITEM_4_ID);

    assert.equal(i1.status, "READY", "Item 1 is READY");
    assert.equal(i2.status, "PREPARING", "Item 2 is still PREPARING");
    assert.equal(i3.status, "PENDING", "Item 3 is still PENDING");
    assert.equal(i4.status, "PENDING", "Item 4 is still PENDING");

    // Parent order must NOT be READY because only 1 of 4 items is ready
    const order = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    assert.notEqual(order.status, "READY", "Order does NOT become READY prematurely");
    assert.equal(order.status, "PREPARING", "Order is PREPARING");
  });

  // ==========================================
  // PHASE 8: PARTIAL ORDER STATE CONSISTENCY
  // ==========================================
  await t.test("PHASE 8: Partial Order State Consistency", async () => {
    const kot = await prisma.kitchenOrderTicket.findUnique({
      where: { id: KOT_ID },
      include: { items: true },
    });

    assert.notEqual(kot.status, "READY", "KOT is not fully READY");
    assert.equal(kot.status, "PREPARING", "KOT is in PREPARING status");

    const readyCount = kot.items.filter((i) => i.status === "READY").length;
    const preparingCount = kot.items.filter((i) => i.status === "PREPARING").length;
    const pendingCount = kot.items.filter((i) => i.status === "PENDING").length;

    assert.equal(readyCount, 1, "Exactly 1 item is READY");
    assert.equal(preparingCount, 1, "Exactly 1 item is PREPARING");
    assert.equal(pendingCount, 2, "Exactly 2 items are PENDING");
  });

  // ==========================================
  // PHASE 9: STEWARD FOOD RUNNER - DELIVER ITEM 1
  // ==========================================
  await t.test("PHASE 9: Steward Food Runner sees READY item, delivers it", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/staff/food-runner-items",
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });

    assert.equal(listRes.statusCode, 200, "Food runner items query returns 200");
    const listBody = JSON.parse(listRes.payload);
    assert.equal(listBody.success, true);

    const runnerItems = listBody.items;
    const r1 = runnerItems.find((i) => i.id === KOT_ITEM_1_ID);
    const r2 = runnerItems.find((i) => i.id === KOT_ITEM_2_ID);

    assert.ok(r1, "Item 1 is present in food runner queue");
    assert.ok(!r2, "Item 2 (cooking) is NOT in food runner queue");

    // Steward delivers Item 1
    const deliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${KOT_ITEM_1_ID}/delivered`,
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });

    assert.equal(deliverRes.statusCode, 200, "Item 1 delivered successfully");
    const dItem1 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_1_ID } });
    assert.equal(dItem1.status, "SERVED", "Item 1 status is now SERVED");

    // Items 2, 3, 4 unchanged
    const dItem2 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_2_ID } });
    assert.equal(dItem2.status, "PREPARING");
  });

  // ==========================================
  // PHASE 10: CONTINUE REMAINING ITEMS (2 & 3)
  // ==========================================
  await t.test("PHASE 10: Complete Item 2 and Item 3 lifecycle", async () => {
    // Item 2: Chef B marks READY
    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_2_ID,
      nextStatus: "READY",
      actor: { userId: chefB.id, userName: chefB.name, role: "CHEF" },
    });

    // Steward delivers Item 2
    const del2 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${KOT_ITEM_2_ID}/delivered`,
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });
    assert.equal(del2.statusCode, 200);

    const i2 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_2_ID } });
    assert.equal(i2.status, "SERVED", "Item 2 is SERVED");

    // Item 3: Chef A starts cooking -> READY
    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_3_ID,
      nextStatus: "PREPARING",
      actor: { userId: chefA.id, userName: chefA.name, role: "CHEF" },
    });

    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_3_ID,
      nextStatus: "READY",
      actor: { userId: chefA.id, userName: chefA.name, role: "CHEF" },
    });

    // Steward delivers Item 3
    const del3 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${KOT_ITEM_3_ID}/delivered`,
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });
    assert.equal(del3.statusCode, 200);

    const i3 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_3_ID } });
    assert.equal(i3.status, "SERVED", "Item 3 is SERVED");
  });

  // ==========================================
  // PHASE 11: SELF-PICK TEST ON ITEM 4
  // ==========================================
  await t.test("PHASE 11: Self-pick concurrency and completion on Item 4", async () => {
    // Toggle kitchen mode to SELF_PICK
    await updateKitchenConfig({
      prisma,
      restaurantId: restaurant.id,
      mode: "SELF_PICK",
      scope: "ITEMS",
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });

    // Concurrently Chef A and Chef B attempt to self-pick Item 4
    const results = await Promise.allSettled([
      selfPickItem({
        prisma,
        restaurantId: restaurant.id,
        itemId: KOT_ITEM_4_ID,
        chefId: chefA.id,
        actor: { userId: chefA.id, userName: chefA.name },
        realtime: mockRealtime,
      }),
      selfPickItem({
        prisma,
        restaurantId: restaurant.id,
        itemId: KOT_ITEM_4_ID,
        chefId: chefB.id,
        actor: { userId: chefB.id, userName: chefB.name },
        realtime: mockRealtime,
      }),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    assert.equal(successes.length, 1, "Exactly one chef claimed Item 4");
    assert.equal(failures.length, 1, "Second chef received conflict rejection");
    const errStatus = failures[0].reason.status || failures[0].reason.statusCode;
    assert.equal(errStatus, 409, "Conflict error code 409");

    const winnerId = successes[0].value.item.assignedChefId;
    assert.ok([chefA.id, chefB.id].includes(winnerId), "Winner is one of the two chefs");

    // Winning chef marks Item 4 READY
    await updateKotItemStatus({
      prisma,
      restaurantId: restaurant.id,
      kotId: KOT_ID,
      itemId: KOT_ITEM_4_ID,
      nextStatus: "READY",
      actor: { userId: winnerId, userName: "Winner Chef", role: "CHEF" },
    });

    // Steward delivers Item 4
    const del4 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${KOT_ITEM_4_ID}/delivered`,
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });
    assert.equal(del4.statusCode, 200);

    const i4 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: KOT_ITEM_4_ID } });
    assert.equal(i4.status, "SERVED", "Item 4 is SERVED");

    // All 4 items are now SERVED!
    // KOT ticket status transitions to SERVED and parent order transitions to DELIVERED
    const finalKot = await prisma.kitchenOrderTicket.findUnique({ where: { id: KOT_ID } });
    const finalOrder = await prisma.order.findUnique({ where: { id: ORDER_ID } });

    assert.equal(finalKot.status, "SERVED", "KOT ticket transitions to SERVED");
    assert.equal(finalOrder.status, "DELIVERED", "Parent order transitions to DELIVERED");
  });

  // ==========================================
  // PHASE 12 - 15: REALTIME & OWNER VERIFICATION
  // ==========================================
  await t.test("PHASE 12-15: Realtime Events & Owner Consistency", async () => {
    // Check emitted events captured in mockRealtime
    const itemAssignedEvents = emittedEvents.filter((e) => e.event === "kitchen:item_assigned");
    assert.ok(itemAssignedEvents.length >= 3, "kitchen:item_assigned events recorded");

    // Owner view matches DB
    const ownerOrder = await prisma.order.findUnique({
      where: { id: ORDER_ID },
      include: { items: true },
    });

    assert.equal(ownerOrder.id, ORDER_ID);
    assert.equal(ownerOrder.items.length, 4);
    assert.equal(ownerOrder.status, "DELIVERED");
    assert.equal(ownerOrder.total, createdOrder.total);
  });

  // ==========================================
  // PHASE 16 & 17: CASHIER & SWIPER AUTHORITATIVE TOTALS
  // ==========================================
  await t.test("PHASE 16 & 17: Cashier & Swiper Authoritative Total Verification", async () => {
    // Reject tampered amount
    const mismatchRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: ORDER_ID,
        paymentMethod: "CASH",
        amount: 500, // Mismatch with authoritative total
        shiftId: activeShift.id,
      },
    });

    assert.equal(mismatchRes.statusCode, 400, "Tampered amount rejected with 400");
    const mismatchBody = JSON.parse(mismatchRes.payload);
    assert.equal(mismatchBody.code, "amount_mismatch");
  });

  // ==========================================
  // PHASE 18: PAYMENT SETTLEMENT & SESSION CLOSURE
  // ==========================================
  await t.test("PHASE 18: Settle Bill with authoritative total & transition table to DIRTY", async () => {
    const settleRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: ORDER_ID,
        paymentMethod: "CASH",
        amount: createdOrder.total,
        shiftId: activeShift.id,
      },
    });

    assert.equal(settleRes.statusCode, 200, "Settlement succeeds with authoritative total");
    const settleBody = JSON.parse(settleRes.payload);
    assert.equal(settleBody.success, true);

    const paidOrder = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    assert.ok(["PAID", "SUCCESS"].includes(paidOrder.paymentStatus), "Order paymentStatus is PAID or SUCCESS");

    const closedSession = await prisma.tableSession.findUnique({ where: { id: TABLE_SESSION_ID } });
    assert.equal(closedSession.status, "CLOSED", "TableSession is CLOSED");

    const tableAfterPayment = await prisma.diningTable.findUnique({ where: { id: TABLE_ID } });
    assert.equal(tableAfterPayment.cleaningStatus, "DIRTY", "Table cleaningStatus is DIRTY");
  });

  // ==========================================
  // PHASE 19: CLEANER WORKFLOW & STRICT SANITATION GATE
  // ==========================================
  await t.test("PHASE 19: Table cleaning workflow and strict sanitation gate", async () => {
    // Reseating on DIRTY table is blocked by sanitation gate
    await assert.rejects(
      async () => {
        await getOrCreateActiveSession({
          prisma,
          restaurantId: restaurant.id,
          tableId: TABLE_ID,
        });
      },
      (err) => err.code === "table_dirty" || /DIRTY/i.test(err.message),
      "Sanitation gate threw table_dirty"
    );

    // Cleaner finds cleaning task
    const cleanTask = await prisma.staffTask.findFirst({
      where: { tableId: TABLE_ID, roleTarget: "CLEANER" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(cleanTask, "Cleaning task exists");

    // Cleaner finishes task
    const finishRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${cleanTask.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
      query: { restaurantId: String(restaurant.id) },
    });
    assert.equal(finishRes.statusCode, 200, "Cleaning task finished");

    const cleanTable = await prisma.diningTable.findUnique({ where: { id: TABLE_ID } });
    assert.equal(cleanTable.cleaningStatus, "CLEAN", "Table cleaningStatus is now CLEAN");
  });

  // ==========================================
  // PHASE 21: NEGATIVE TESTS (17 INVARIANTS)
  // ==========================================
  await t.test("PHASE 21: Negative Tests & Invariant Protections", async () => {
    // 1 & 2: Chef A attempting to access Chef B's station returns 403 FORBIDDEN_STATION_ACCESS
    await assert.rejects(
      async () => {
        await getChefAssignedItems({
          prisma,
          restaurantId: restaurant.id,
          chefId: chefB.id,
          requestingActor: { id: chefA.id, userId: chefA.id, role: "CHEF", designation: "Line Chef" },
        });
      },
      (err) => err.status === 403 && err.code === "FORBIDDEN_STATION_ACCESS",
      "Chef A access to Chef B station rejected"
    );

    // 5: Steward cannot deliver a non-ready item
    const dummyKotItem = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: KOT_ID,
        orderItemId: ITEM_1_ID,
        itemName: "Test Item",
        qty: 1,
        status: "PREPARING",
      },
    });

    const badDeliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${dummyKotItem.id}/delivered`,
      headers: { authorization: `Bearer ${stewardToken}` },
      query: { restaurantId: String(restaurant.id) },
    });
    assert.equal(badDeliverRes.statusCode, 400, "Cannot deliver PREPARING item");
    await prisma.kitchenOrderTicketItem.delete({ where: { id: dummyKotItem.id } });

    // 10: Paid order cannot be paid twice
    const doublePayRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: ORDER_ID,
        paymentMethod: "CASH",
        amount: createdOrder.total,
        shiftId: activeShift.id,
      },
    });
    assert.equal(doublePayRes.statusCode, 400, "Double settlement rejected");
    const doublePayBody = JSON.parse(doublePayRes.payload);
    assert.equal(doublePayBody.code, "already_paid");

    // 13: Tenant isolation: Alt restaurant token rejected on food runner items
    const crossRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${KOT_ITEM_1_ID}/delivered`,
      headers: { authorization: `Bearer ${altToken}` },
      query: { restaurantId: String(altRestaurant.id) },
    });
    assert.equal(crossRes.statusCode, 404, "Cross-restaurant access rejected");
  });

  // Cleanup
  await app.close();
  await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: restaurant.id } } }).catch(() => {});
  await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurant.id } } }).catch(() => {});
  await prisma.payment.deleteMany({ where: { order: { restaurantId: restaurant.id } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.staffTask.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.cashierShift.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.restaurant.deleteMany({ where: { id: { in: [restaurant.id, altRestaurant.id] } } }).catch(() => {});
});
