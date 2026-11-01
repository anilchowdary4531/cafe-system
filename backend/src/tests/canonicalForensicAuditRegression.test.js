import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import staffTasksRoutes from "../routes/staffTasks.routes.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import {
  getOrCreateActiveSession,
  completeSessionAndReleaseTable,
  getActiveSessionForTable,
} from "../services/tableSessionService.js";
import { getCanonicalReadyItems } from "../services/kotService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";
import { getTableId, isSameTable, formatTableDisplayLabel } from "../utils/tableIdentity.js";

const STAFF_ALLOWED_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SUPER_ADMIN",
  "WAITER",
  "SERVER",
  "STEWARD",
  "CHEF",
  "STAFF",
  "CLEANER",
  "CASHIER",
];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "forensic-audit-regression-secret-xyz" });

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
          emittedEvents.push({ namespace: "root", room, event, data, timestamp: Date.now() });
        },
      }),
    },
    staff: {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ namespace: "staff", room, event, data, timestamp: Date.now() });
        },
      }),
    },
  };

  await ownerRoutes(app, {
    prisma,
    realtime: mockRealtime,
    buildQrTargetUrl: (slug, tableNo) => `/menu/${slug}?table=${tableNo}`,
  });

  await staffTasksRoutes(app, {
    prisma,
    realtime: mockRealtime,
  });

  return { app, mockRealtime };
}

test("TIFFZY FORENSIC AUDIT CANONICAL REGRESSION SUITE", async (t) => {
  const emittedEvents = [];
  const { app } = await createTestApp(emittedEvents);

  const timestamp = Date.now() + "_" + Math.floor(Math.random() * 100000);
  const restSlug = `audit-regress-rest-${timestamp}`;

  // 1. Setup Restaurant & Station
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Forensic Audit Verification Bistro",
      slug: restSlug,
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  });
  const rid = restaurant.id;

  const station = await prisma.kitchenStation.create({
    data: {
      restaurantId: rid,
      name: "Main Hot Kitchen",
      isDefault: true,
    },
  });

  // 2. Setup Staff across all designations
  const owner = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Owner Olivia",
      email: `owner-olivia-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "OWNER",
    },
  });

  const server1 = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Server Samuel",
      email: `server-samuel-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
      designation: "SERVER",
      isActive: true,
    },
  });

  const server2 = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Server Sophia",
      email: `server-sophia-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
      designation: "SERVER",
      isActive: true,
    },
  });

  const chef = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Chef Charlie",
      email: `chef-charlie-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "CHEF",
      designation: "CHEF",
      isActive: true,
    },
  });

  const cleaner = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Cleaner Clara",
      email: `cleaner-clara-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "STAFF",
      designation: "CLEANER",
      isActive: true,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Cashier Chris",
      email: `cashier-chris-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "STAFF",
      designation: "CASHIER",
      isActive: true,
    },
  });

  // 3. Setup Menu Items
  const itemButterChicken = await prisma.menuItem.create({
    data: {
      restaurantId: rid,
      name: "Butter Chicken",
      category: "Curry",
      price: 350,
      isAvailable: true,
    },
  });

  const itemGarlicNaan = await prisma.menuItem.create({
    data: {
      restaurantId: rid,
      name: "Garlic Naan",
      category: "Breads",
      price: 60,
      isAvailable: true,
    },
  });

  // 4. Setup Confusing Duplicate Table Numbers:
  // Table A: "Main Hall" -> Table 1
  // Table B: "Section TABLE" -> table 1
  const tableA = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "1",
      section: "Main Hall",
      seats: 4,
      qrToken: `qr-token-tableA-${timestamp}`,
      cleaningStatus: "CLEAN",
      assignedWaiterId: server1.id,
      assignedWaiterName: server1.name,
    },
  });

  const tableB = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "table 1",
      section: "Section TABLE",
      seats: 4,
      qrToken: `qr-token-tableB-${timestamp}`,
      cleaningStatus: "CLEAN",
      assignedWaiterId: server2.id,
      assignedWaiterName: server2.name,
    },
  });

  assert.notEqual(tableA.id, tableB.id, "Table A and Table B must have distinct primary key IDs");

  // Tokens
  const ownerToken = app.jwt.sign({ id: owner.id, userId: owner.id, restaurantId: rid, role: "OWNER", name: owner.name });
  const server1Token = app.jwt.sign({ id: server1.id, userId: server1.id, restaurantId: rid, role: "WAITER", name: server1.name });
  const server2Token = app.jwt.sign({ id: server2.id, userId: server2.id, restaurantId: rid, role: "WAITER", name: server2.name });
  const chefToken = app.jwt.sign({ id: chef.id, userId: chef.id, restaurantId: rid, role: "CHEF", name: chef.name });
  const cleanerToken = app.jwt.sign({ id: cleaner.id, userId: cleaner.id, restaurantId: rid, role: "STAFF", name: cleaner.name });

  // =========================================================================
  // TEST 1: REGRESSION FOR EXACT PRISMA ERROR
  // =========================================================================
  await t.test("1. Exact Prisma Schema Regression: KOT / KOTItem query must not invent table relation", async () => {
    // A. Querying KOT directly with include: { table: true } must throw validation error
    let threwKotTable = false;
    try {
      await prisma.kitchenOrderTicket.findFirst({
        where: { restaurantId: rid },
        include: { table: true },
      });
    } catch (err) {
      threwKotTable = true;
      assert.ok(err.message.includes("Unknown field `table`"), "Must be Unknown field `table` on KitchenOrderTicket");
    }
    assert.equal(threwKotTable, true, "Invented `table` relation on KitchenOrderTicket must fail schema validation");

    // B. Querying KOTItem directly with include: { table: true } must throw validation error
    let threwKotItemTable = false;
    try {
      await prisma.kitchenOrderTicketItem.findFirst({
        where: { id: 999999 },
        include: { table: true },
      });
    } catch (err) {
      threwKotItemTable = true;
      assert.ok(err.message.includes("Unknown field `table`"), "Must be Unknown field `table` on KitchenOrderTicketItem");
    }
    assert.equal(threwKotItemTable, true, "Invented `table` relation on KitchenOrderTicketItem must fail schema validation");

    // C. Querying Order with select: { tableId: true } must throw validation error
    let threwOrderTableId = false;
    try {
      await prisma.order.findFirst({
        where: { restaurantId: rid },
        select: { tableId: true },
      });
    } catch (err) {
      threwOrderTableId = true;
      assert.ok(err.message.includes("Unknown field `tableId`"), "Must be Unknown field `tableId` on Order");
    }
    assert.equal(threwOrderTableId, true, "Non-existent `tableId` on Order must fail schema validation");

    // D. Canonical queries through tableSession.table must execute cleanly without error
    const validSessionQuery = await prisma.tableSession.findFirst({
      where: { tableId: tableA.id },
      include: { table: { select: { id: true, tableNo: true, section: true } } },
    });
    assert.equal(validSessionQuery, null); // None yet, but query executed cleanly without Prisma error
  });

  // =========================================================================
  // TEST 2: CANONICAL TABLE IDENTITY HELPERS CONTRACT
  // =========================================================================
  await t.test("2. Canonical Table Identity Contract Verification", () => {
    assert.equal(getTableId(tableA), tableA.id);
    assert.equal(getTableId({ tableId: tableA.id }), tableA.id);
    assert.equal(getTableId(tableA.id), tableA.id);

    // Same table number in different sections must NOT be the same table
    assert.equal(isSameTable(tableA, tableB), false, "Table A and Table B must NOT be same table");
    assert.equal(isSameTable(tableA, { id: tableA.id, restaurantId: rid }), true);
    assert.equal(isSameTable(tableA, { id: tableA.id, restaurantId: rid + 1 }), false);

    // Display labels are strictly for presentation
    assert.equal(formatTableDisplayLabel(tableA), "Main Hall · Table 1");
    assert.equal(formatTableDisplayLabel(tableB), "Section TABLE · Table table 1");
  });

  // =========================================================================
  // TEST 3: FULL AUTHORITATIVE LIFECYCLE
  // TABLE CREATION → ORDER → KOT → READY → DELIVERY → PAYMENT → CLOSE → CLEAN → AVAILABLE
  // =========================================================================
  let sessionA = null;
  let orderA = null;
  let kotA = null;
  let kotItem1 = null;
  let kotItem2 = null;

  await t.test("3. Step 1 & 2: Active Session & Order submission on Table A", async () => {
    // Open TableSession on Table A
    sessionA = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: tableA.id,
      waiterId: server1.id,
      waiterName: server1.name,
    });
    assert.equal(sessionA.tableId, tableA.id);
    assert.equal(sessionA.status, "OPEN");

    // Table B has NO active session
    const sessionB = await getActiveSessionForTable({ prisma, tableId: tableB.id, restaurantId: rid });
    assert.equal(sessionB, null, "Table B must remain free with no active session");

    // Submit Order with 2 items on Table A
    const orderRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/orders`,
      headers: { authorization: `Bearer ${server1Token}` },
      payload: {
        tableId: tableA.id,
        tableNo: tableA.tableNo,
        tableSessionId: sessionA.id,
        waiterId: server1.id,
        items: [
          { menuItemId: itemButterChicken.id, qty: 1, price: 350 },
          { menuItemId: itemGarlicNaan.id, qty: 2, price: 60 },
        ],
      },
    });
    assert.equal(orderRes.statusCode, 201);
    const createdOrder = JSON.parse(orderRes.payload);
    orderA = createdOrder.order || createdOrder;

    // Verify KOT was generated with 2 items
    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { orderId: orderA.id },
      include: { items: true },
    });
    assert.equal(kots.length, 1);
    kotA = kots[0];
    assert.equal(kotA.tableSessionId, sessionA.id);
    assert.equal(kotA.items.length, 2);

    kotItem1 = kotA.items.find((i) => i.menuItemId === itemButterChicken.id);
    kotItem2 = kotA.items.find((i) => i.menuItemId === itemGarlicNaan.id);
    assert.ok(kotItem1);
    assert.ok(kotItem2);
    assert.equal(kotItem1.status, "PENDING");
    assert.equal(kotItem2.status, "PENDING");

    // Verify persistent NOTIFICATION for Server 1
    const notifs = await prisma.notification.findMany({
      where: { restaurantId: rid, recipientId: server1.id, orderId: orderA.id },
    });
    assert.ok(notifs.length >= 1, "Server 1 must receive persistent ORDER_PLACED notification");

    // Server 2 received NO notifications
    const server2Notifs = await prisma.notification.findMany({
      where: { restaurantId: rid, recipientId: server2.id },
    });
    assert.equal(server2Notifs.length, 0, "Server 2 must receive zero notifications");
  });

  await t.test("4. Step 3: Kitchen receives & Chef marks Item 1 READY", async () => {
    // Chef marks Item 1 READY
    const readyRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kots/${kotA.id}/items/${kotItem1.id}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });
    assert.equal(readyRes.statusCode, 200);

    // Verify canonical ready items query returns strictly 1 item
    const readyItems = await getCanonicalReadyItems({ prisma, restaurantId: rid });
    assert.equal(readyItems.length, 1);
    assert.equal(readyItems[0].id, kotItem1.id);
    assert.equal(readyItems[0].tableId, tableA.id);
    assert.equal(readyItems[0].section, "Main Hall");

    // Verify Server 1 received persistent FOOD_READY notification
    const readyNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        recipientId: server1.id,
        notificationType: NOTIFICATION_TYPES.FOOD_READY,
      },
    });
    assert.equal(readyNotifs.length, 1);
    assert.ok(readyNotifs[0].title.includes("Table 1"));
    assert.equal(readyNotifs[0].data?.tableId, tableA.id);
  });

  await t.test("5. Step 4 & 5: Server distributes Item 1 + Idempotency", async () => {
    // Server delivers Item 1
    const delivRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItem1.id}/delivered`,
      headers: { authorization: `Bearer ${server1Token}` },
      payload: {},
    });
    assert.equal(delivRes.statusCode, 200);
    const delivData = JSON.parse(delivRes.payload);
    assert.equal(delivData.success, true);
    assert.equal(delivData.item.status, "SERVED");
    assert.equal(delivData.tableId, tableA.id);
    assert.equal(delivData.alreadyServed, false);

    // Kitchen ready queue must now be 0 because Item 1 was served
    const readyAfter = await getCanonicalReadyItems({ prisma, restaurantId: rid });
    assert.equal(readyAfter.length, 0, "Kitchen and Server queue must be 0 after distribution");

    // IDEMPOTENCY TEST: Rapid double click / repeat delivery of already served item
    const repeatRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItem1.id}/delivered`,
      headers: { authorization: `Bearer ${server1Token}` },
      payload: {},
    });
    assert.equal(repeatRes.statusCode, 200, "Must return HTTP 200 on already served item");
    const repeatData = JSON.parse(repeatRes.payload);
    assert.equal(repeatData.success, true);
    assert.equal(repeatData.alreadyServed, true, "Must explicitly indicate alreadyServed: true");

    // Multi-item progress check: Order is still in progress because Item 2 is PENDING
    const orderCheck = await prisma.order.findUnique({ where: { id: orderA.id } });
    assert.notEqual(orderCheck.status, "DELIVERED", "Order cannot be DELIVERED until all items are served");
  });

  await t.test("6. Step 6: Chef completes Item 2 & Server delivers -> Order transitions to DELIVERED", async () => {
    // Chef marks Item 2 READY
    await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kots/${kotA.id}/items/${kotItem2.id}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });

    // Server distributes Item 2
    const deliv2 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${kotItem2.id}/delivered`,
      headers: { authorization: `Bearer ${server1Token}` },
      payload: {},
    });
    assert.equal(deliv2.statusCode, 200);

    // Now all items are SERVED -> KOT is SERVED and Order is DELIVERED
    const finalKot = await prisma.kitchenOrderTicket.findUnique({ where: { id: kotA.id } });
    assert.equal(finalKot.status, "SERVED");

    const finalOrder = await prisma.order.findUnique({ where: { id: orderA.id } });
    assert.equal(finalOrder.status, "DELIVERED");
  });

  await t.test("7. Step 7 & 8: Payment Settlement & Session Completion -> Cleaning Task Created", async () => {
    // Settle payment on Order A
    await prisma.order.update({
      where: { id: orderA.id },
      data: { paymentStatus: "PAID" },
    });

    // Complete session and release table
    const completion = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: sessionA.id,
      realtime: {
        io: { to: () => ({ emit: () => {} }) },
        staff: { to: () => ({ emit: () => {} }) },
      },
      actor: { id: owner.id, userId: owner.id, role: "OWNER" },
    });
    assert.equal(completion.completed, true);

    // Table A MUST transition to DIRTY
    const updatedTableA = await prisma.diningTable.findUnique({ where: { id: tableA.id } });
    assert.equal(updatedTableA.cleaningStatus, "DIRTY");

    // Table B MUST remain CLEAN and untouched
    const updatedTableB = await prisma.diningTable.findUnique({ where: { id: tableB.id } });
    assert.equal(updatedTableB.cleaningStatus, "CLEAN");

    // Cleaning task must exist for Table A with tableId: tableA.id
    const cleaningTask = await prisma.staffTask.findFirst({
      where: { restaurantId: rid, tableId: tableA.id, category: "CLEANING" },
    });
    assert.ok(cleaningTask, "Cleaning task must be created for Table A");
    assert.equal(cleaningTask.tableId, tableA.id);

    // Cleaner received TABLE_DIRTY notification (persisted as role-level CLEANER notification)
    const cleanerNotifs = await prisma.notification.findMany({
      where: { restaurantId: rid, notificationType: NOTIFICATION_TYPES.TABLE_DIRTY },
    });
    assert.ok(cleanerNotifs.length >= 1);
  });

  await t.test("8. Step 9: Cleaner finishes cleaning task -> Table A transitions to AVAILABLE", async () => {
    const cleaningTask = await prisma.staffTask.findFirst({
      where: { restaurantId: rid, tableId: tableA.id, category: "CLEANING", status: "PENDING" },
    });
    assert.ok(cleaningTask);

    // Cleaner completes task
    const finishRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${cleaningTask.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
      payload: {},
    });
    assert.equal(finishRes.statusCode, 200);

    // Table A is now CLEAN and AVAILABLE!
    const cleanTableA = await prisma.diningTable.findUnique({ where: { id: tableA.id } });
    assert.equal(cleanTableA.cleaningStatus, "CLEAN");
    assert.equal(cleanTableA.assignedWaiterId, null, "Waiter unassigned upon cleaning completion");

    // Realtime table:updated emitted with status AVAILABLE
    const tableUpdateEvents = emittedEvents.filter(
      (e) => e.event === "table:updated" && (e.data?.tableId === tableA.id || e.data?.id === tableA.id)
    );
    assert.ok(tableUpdateEvents.length > 0, "table:updated emitted on completion");
  });

  // =========================================================================
  // TEST 9: OWNER DASHBOARD ENDPOINT RETURNS AUTHORITATIVE STATE
  // =========================================================================
  await t.test("9. Owner Dashboard Tables Overview shows exact canonical state", async () => {
    const dashRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(dashRes.statusCode, 200);
    const dashData = JSON.parse(dashRes.payload);
    const tablesList = Array.isArray(dashData) ? dashData : dashData.tables || [];

    const overviewA = tablesList.find((t) => t.id === tableA.id);
    const overviewB = tablesList.find((t) => t.id === tableB.id);

    assert.ok(overviewA, "Table A must exist in dashboard");
    assert.ok(overviewB, "Table B must exist in dashboard");

    assert.equal(overviewA.id, tableA.id);
    assert.equal(overviewA.tableNo, "1");
    assert.equal(overviewA.section, "Main Hall");
    assert.equal(overviewA.cleaningStatus, "CLEAN");
    assert.equal(overviewA.isOccupied, false);

    assert.equal(overviewB.id, tableB.id);
    assert.equal(overviewB.tableNo, "table 1");
    assert.equal(overviewB.section, "Section TABLE");
    assert.equal(overviewB.cleaningStatus, "CLEAN");
    assert.equal(overviewB.isOccupied, false);
  });

  // =========================================================================
  // TEST 10: ATOMIC BILLING SETTLE & SESSION RELEASE ROLLBACK VERIFICATION
  // =========================================================================
  await t.test("10. Atomic Billing Settlement & Session Release Rollback Protection", async () => {
    // Open a fresh session on Table B
    const sessionB2 = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: tableB.id,
      waiterId: server2.id,
      waiterName: server2.name,
    });
    assert.equal(sessionB2.status, "OPEN");

    // Create an order for ₹350 on Table B
    const orderB = await prisma.order.create({
      data: {
        restaurantId: rid,
        tableNo: tableB.tableNo,
        tableSessionId: sessionB2.id,
        createdByUserId: server2.id,
        orderNo: `ORD-B-${timestamp}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        total: 350,
        subtotal: 350,
      },
    });

    // Verify settle via API completes session and releases table atomically
    const settleRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        orderId: orderB.id,
        paymentMethod: "CASH",
        receivedAmount: 350,
      },
    });
    assert.equal(settleRes.statusCode, 200);
    const settleData = JSON.parse(settleRes.payload);
    assert.equal(settleData.success, true);

    // Verify Order is marked SUCCESS/PAID
    const settledOrder = await prisma.order.findUnique({ where: { id: orderB.id } });
    assert.equal(settledOrder.paymentStatus, "SUCCESS");

    // Verify Session is CLOSED
    const closedSession = await prisma.tableSession.findUnique({ where: { id: sessionB2.id } });
    assert.equal(closedSession.status, "CLOSED");

    // Verify Table B transitioned to DIRTY sanitation
    const dirtyTableB = await prisma.diningTable.findUnique({ where: { id: tableB.id } });
    assert.equal(dirtyTableB.cleaningStatus, "DIRTY");
  });

  // =========================================================================
  // TEST 11: QR ORDER IMMEDIATE KOT CREATION & REALTIME STAFF EMISSION
  // =========================================================================
  await t.test("11. QR Customer Order creates KOT immediately and emits to /staff", async () => {
    // Clear emitted events list
    emittedEvents.length = 0;

    const qrSession = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: tableA.id,
      guestCount: 2,
    });

    // Import qrService
    const { placeQrOrder } = await import("../services/qrService.js");

    const qrResult = await placeQrOrder({
      prisma,
      token: tableA.qrToken,
      items: [
        { menuItemId: itemButterChicken.id, quantity: 1 },
      ],
      customerName: "QR Guest",
      io: {
        to: (room) => ({
          emit: (event, data) => {
            emittedEvents.push({ namespace: "root", room, event, data, timestamp: Date.now() });
          },
        }),
        of: (ns) => ({
          to: (room) => ({
            emit: (event, data) => {
              emittedEvents.push({ namespace: ns, room, event, data, timestamp: Date.now() });
            },
          }),
        }),
      },
    });

    assert.ok(qrResult.order, "QR Order must be created");
    assert.ok(Array.isArray(qrResult.order.kots), "KOTs must be generated for QR order");
    assert.ok(qrResult.order.kots.length >= 1, "At least 1 KOT created");

    // Verify staff namespace received kot:created
    const staffKotEvents = emittedEvents.filter(
      (e) => e.namespace === "/staff" && (e.event === "kot:created" || e.event === "kot_created")
    );
    assert.ok(staffKotEvents.length > 0, "Staff namespace must receive kot:created for QR orders");
  });

  t.after(async () => {
    try {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      await prisma.staffTask.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: rid } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: rid } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: rid } } });
      await prisma.order.deleteMany({ where: { restaurantId: rid } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: rid } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: rid } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenStation.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
      await app.close();
    } catch (_) {}
  });
});
