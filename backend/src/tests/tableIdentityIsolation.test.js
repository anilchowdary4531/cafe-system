import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import staffTasksRoutes from "../routes/staffTasks.routes.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { getOrCreateActiveSession, completeSessionAndReleaseTable } from "../services/tableSessionService.js";
import { getUserNotifications } from "../services/notificationService.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN", "WAITER", "SERVER", "CHEF", "STAFF", "CLEANER"];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "table-identity-isolation-jwt-secret-xyz" });

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

test("TABLE IDENTITY & CLEANING ISOLATION SUITE (PHASES 12 & 13)", async (t) => {
  const emittedEvents = [];
  const { app, mockRealtime } = await createTestApp(emittedEvents);

  const timestamp = Date.now() + "_" + Math.floor(Math.random() * 100000);
  const restSlug = `table-iso-rest-${timestamp}`;

  // 1. Create Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Table Identity Isolation Cafe",
      slug: restSlug,
      currency: "INR",
    },
  });

  // 2. Create Owner
  const owner = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Owner Alice",
      email: `owner-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "OWNER",
    },
  });

  // 3. Create Cleaner Staff
  const cleaner = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Cleaner John",
      email: `cleaner-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "STAFF",
      designation: "CLEANER",
      isActive: true,
    },
  });

  // 4. Create Server Staff
  const server = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Server Bob",
      email: `server-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
      designation: "SERVER",
      isActive: true,
    },
  });

  const ownerToken = app.jwt.sign({
    id: owner.id,
    userId: owner.id,
    restaurantId: restaurant.id,
    role: "OWNER",
    name: owner.name,
  });

  // 5. Create DiningTable A ("Main Hall" / Table 1)
  const tableA = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "1",
      section: "Main Hall",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  // 6. Create DiningTable B ("Section TABLE" / table 1)
  const tableB = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "table 1",
      section: "Section TABLE",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  assert.notEqual(tableA.id, tableB.id, "Table A and Table B MUST have different primary key IDs");

  // Helper to fetch tables overview
  const getTablesOverview = async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    return Array.isArray(data) ? data : data.tables || [];
  };

  // TEST 1 & 2: Order on A does not appear on B; Order on B does not appear on A
  await t.test("1 & 2. Order isolation between Table A and Table B", async () => {
    const sessionA = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurant.id,
      tableId: tableA.id,
    });

    const orderA = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableSessionId: sessionA.id,
        tableNo: tableA.tableNo,
        orderNo: `ORD-A-${Date.now()}`,
        status: "PLACED",
        paymentStatus: "PENDING",
        subtotal: 250,
        total: 250,
      },
    });

    const tables = await getTablesOverview();
    const ovA = tables.find((t) => t.id === tableA.id);
    const ovB = tables.find((t) => t.id === tableB.id);

    assert.equal(ovA.activeOrders.some((o) => o.id === orderA.id), true, "Order A must appear on Table A");
    assert.equal(ovB.activeOrders.some((o) => o.id === orderA.id), false, "Order A must NOT appear on Table B");
    assert.equal(ovB.activeOrderCount, 0, "Table B must have zero active orders");
  });

  // TEST 3 & 4: Session on A does not appear on B; Session on B does not appear on A
  await t.test("3 & 4. Session isolation between Table A and Table B", async () => {
    const tables = await getTablesOverview();
    const ovA = tables.find((t) => t.id === tableA.id);
    const ovB = tables.find((t) => t.id === tableB.id);

    assert.ok(ovA.activeSession, "Table A must have an active session");
    assert.equal(ovA.isOccupied, true, "Table A must be occupied");
    assert.equal(ovB.activeSession, null, "Table B must have NO active session");
    assert.equal(ovB.isOccupied, false, "Table B must NOT be occupied");
  });

  // TEST 5 & 6: Server assignment on A does not appear on B
  await t.test("5 & 6. Server assignment on A does not appear on B", async () => {
    await prisma.diningTable.update({
      where: { id: tableA.id },
      data: {
        assignedWaiterId: server.id,
        assignedWaiterName: server.name,
      },
    });

    const tables = await getTablesOverview();
    const ovA = tables.find((t) => t.id === tableA.id);
    const ovB = tables.find((t) => t.id === tableB.id);

    assert.equal(ovA.assignedWaiterId, server.id, "Table A must have assigned server");
    assert.equal(ovB.assignedWaiterId, null, "Table B must NOT inherit Table A server");
  });

  // TEST 7 & 8: KOT on A does not appear on B
  await t.test("7 & 8. KOT isolation between Table A and Table B", async () => {
    const sessionA = await prisma.tableSession.findFirst({
      where: { tableId: tableA.id, status: "OPEN" },
    });
    const orderA = await prisma.order.findFirst({
      where: { tableSessionId: sessionA.id },
    });

    const kotA = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurant.id,
        orderId: orderA.id,
        tableSessionId: sessionA.id,
        tableNo: tableA.tableNo,
        status: "PREPARING",
        kotNo: `KOT-A-${Date.now()}`,
        sequenceNumber: 1,
      },
    });

    assert.ok(kotA.id, "KOT created for Table A");
    const kotForB = await prisma.kitchenOrderTicket.findMany({
      where: { tableSession: { tableId: tableB.id } },
    });
    assert.equal(kotForB.length, 0, "No KOT should exist for Table B");
  });

  // TEST 9, 10, 11, 12, 13, 14, 15, 16, 17: Session close, Dirty State, Cleaning Task & Notification Isolation
  await t.test("9-17. Dirty state, cleaning task and notification isolation", async () => {
    emittedEvents.length = 0;

    const sessionA = await prisma.tableSession.findFirst({
      where: { tableId: tableA.id, status: "OPEN" },
    });

    const orderA = await prisma.order.findFirst({
      where: { tableSessionId: sessionA.id },
    });
    if (orderA) {
      await prisma.order.update({
        where: { id: orderA.id },
        data: { paymentStatus: "PAID" },
      });
    }

    // Close session on Table A
    const closeRes1 = await completeSessionAndReleaseTable({
      prisma,
      sessionId: sessionA.id,
      tableId: tableA.id,
      restaurantId: restaurant.id,
      paymentMode: "CASH",
      realtime: mockRealtime,
      actor: { userId: owner.id, userName: owner.name, role: "OWNER" },
    });

    assert.equal(closeRes1.completed, true, "Session closure 1 must succeed");

    // Phase 13 / Test 17: Process session closure / dirty transition TWICE
    const closeRes2 = await completeSessionAndReleaseTable({
      prisma,
      sessionId: sessionA.id,
      tableId: tableA.id,
      restaurantId: restaurant.id,
      paymentMode: "CASH",
      realtime: mockRealtime,
      actor: { userId: owner.id, userName: owner.name, role: "OWNER" },
    });
    assert.equal(closeRes2.completed, true, "Second closure must return completed without duplicating");
    assert.equal(closeRes2.alreadyClosed, true, "Must flag alreadyClosed");

    // Verify DB state of Table A vs Table B
    const refreshedA = await prisma.diningTable.findUnique({ where: { id: tableA.id } });
    const refreshedB = await prisma.diningTable.findUnique({ where: { id: tableB.id } });

    assert.equal(refreshedA.cleaningStatus, "DIRTY", "Table A must be marked DIRTY");
    assert.equal(refreshedB.cleaningStatus, "CLEAN", "Table B MUST remain CLEAN");

    // Verify StaffTasks for Cleaner
    const tasksA = await prisma.staffTask.findMany({
      where: { restaurantId: restaurant.id, tableId: tableA.id, category: "CLEANING" },
    });
    const tasksB = await prisma.staffTask.findMany({
      where: { restaurantId: restaurant.id, tableId: tableB.id, category: "CLEANING" },
    });

    assert.equal(tasksA.length, 1, "Exactly ONE cleaner task must exist for Table A");
    assert.equal(tasksB.length, 0, "ZERO cleaner tasks must exist for Table B");

    // Verify Cleaner Notifications
    const cleanerNotifs = await getUserNotifications({
      prisma,
      userId: cleaner.id,
      restaurantId: restaurant.id,
      userRole: "CLEANER",
      designation: "CLEANER",
      page: 1,
      limit: 50,
    });

    const dirtyNotifsA = (cleanerNotifs.notifications || []).filter(
      (n) => n.notificationType === NOTIFICATION_TYPES.TABLE_DIRTY && n.data?.tableId === tableA.id
    );
    const dirtyNotifsB = (cleanerNotifs.notifications || []).filter(
      (n) => n.notificationType === NOTIFICATION_TYPES.TABLE_DIRTY && n.data?.tableId === tableB.id
    );

    assert.equal(dirtyNotifsA.length, 1, "Cleaner must receive exactly ONE notification for Table A (no duplicates)");
    assert.equal(dirtyNotifsB.length, 0, "Cleaner must receive ZERO notifications for Table B");

    // Verify Owner Panel API representation
    const tables = await getTablesOverview();
    const ovA = tables.find((t) => t.id === tableA.id);
    const ovB = tables.find((t) => t.id === tableB.id);

    assert.equal(ovA.status, "DIRTY", "Table A status in Owner Panel must be DIRTY");
    assert.equal(ovA.cleaningStatus, "DIRTY", "Table A cleaningStatus must be DIRTY");
    assert.equal(ovB.status, "AVAILABLE", "Table B status in Owner Panel must be AVAILABLE");
    assert.equal(ovB.cleaningStatus, "CLEAN", "Table B cleaningStatus must be CLEAN");

    // Verify Realtime event isolation
    const tableUpdatedA = emittedEvents.filter(
      (e) => e.event === "table:updated" && (e.data?.tableId === tableA.id || e.data?.id === tableA.id)
    );
    const tableUpdatedB = emittedEvents.filter(
      (e) => e.event === "table:updated" && (e.data?.tableId === tableB.id || e.data?.id === tableB.id)
    );

    assert.ok(tableUpdatedA.length > 0, "Realtime table:updated emitted for Table A");
    assert.equal(tableUpdatedB.length, 0, "Realtime table:updated MUST NOT be emitted for Table B");
  });

  // TEST 18: Completing cleaner task A changes only A
  await t.test("18. Completing cleaner task on Table A frees only Table A", async () => {
    const taskA = await prisma.staffTask.findFirst({
      where: { restaurantId: restaurant.id, tableId: tableA.id, category: "CLEANING" },
    });

    const cleanerToken = app.jwt.sign({
      id: cleaner.id,
      userId: cleaner.id,
      restaurantId: restaurant.id,
      role: "STAFF",
      designation: "CLEANER",
      name: cleaner.name,
    });

    const completeRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${taskA.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });

    assert.equal(completeRes.statusCode, 200, "Cleaner task completion must succeed");

    const refreshedA = await prisma.diningTable.findUnique({ where: { id: tableA.id } });
    const refreshedB = await prisma.diningTable.findUnique({ where: { id: tableB.id } });

    assert.equal(refreshedA.cleaningStatus, "CLEAN", "Table A must now be CLEAN");
    assert.equal(refreshedB.cleaningStatus, "CLEAN", "Table B must remain CLEAN");
  });

  // TEST 19: Completing cleaner task B changes only B (Reverse test)
  await t.test("19. Completing cleaner task on Table B changes only Table B", async () => {
    const sessionB = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurant.id,
      tableId: tableB.id,
    });

    await completeSessionAndReleaseTable({
      prisma,
      sessionId: sessionB.id,
      tableId: tableB.id,
      restaurantId: restaurant.id,
      paymentMode: "CASH",
      realtime: mockRealtime,
      actor: { userId: owner.id, userName: owner.name, role: "OWNER" },
    });

    const midA = await prisma.diningTable.findUnique({ where: { id: tableA.id } });
    const midB = await prisma.diningTable.findUnique({ where: { id: tableB.id } });

    assert.equal(midA.cleaningStatus, "CLEAN", "Table A must remain CLEAN when Table B closes");
    assert.equal(midB.cleaningStatus, "DIRTY", "Table B must become DIRTY");

    const taskB = await prisma.staffTask.findFirst({
      where: { restaurantId: restaurant.id, tableId: tableB.id, category: "CLEANING", isCompleted: false },
    });

    const cleanerToken = app.jwt.sign({
      id: cleaner.id,
      userId: cleaner.id,
      restaurantId: restaurant.id,
      role: "STAFF",
      designation: "CLEANER",
      name: cleaner.name,
    });

    const completeRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${taskB.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });
    assert.equal(completeRes.statusCode, 200);

    const finalA = await prisma.diningTable.findUnique({ where: { id: tableA.id } });
    const finalB = await prisma.diningTable.findUnique({ where: { id: tableB.id } });

    assert.equal(finalA.cleaningStatus, "CLEAN", "Table A must remain CLEAN");
    assert.equal(finalB.cleaningStatus, "CLEAN", "Table B must become CLEAN");
  });

  // TEST 20: No tableNo-based fallback cross-associates Table A and Table B
  await t.test("20. No tableNo-based fallback cross-associates Table A and Table B", async () => {
    // Both tables have identical or overlapping display names "1" and "table 1"
    const tables = await getTablesOverview();
    const ovA = tables.find((t) => t.id === tableA.id);
    const ovB = tables.find((t) => t.id === tableB.id);

    assert.equal(ovA.id, tableA.id);
    assert.equal(ovB.id, tableB.id);
    assert.equal(ovA.tableNo, "1");
    assert.equal(ovB.tableNo, "table 1");
    assert.equal(ovA.status, "AVAILABLE");
    assert.equal(ovB.status, "AVAILABLE");
  });

  // Cleanup fixtures
  await prisma.staffTask.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.restaurant.deleteMany({ where: { id: restaurant.id } }).catch(() => {});
});
