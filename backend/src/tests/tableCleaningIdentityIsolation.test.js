import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import staffTasksRoutes from "../routes/staffTasks.routes.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { getOrCreateActiveSession, completeSessionAndReleaseTable } from "../services/tableSessionService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN", "WAITER", "SERVER", "CHEF", "STAFF", "CLEANER"];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "cleaning-isolation-jwt-secret-xyz" });

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

test("TABLE IDENTITY & CLEANING STATE ISOLATION REGRESSION SUITE", async (t) => {
  const emittedEvents = [];
  const { app, mockRealtime } = await createTestApp(emittedEvents);

  const timestamp = Date.now();
  const restSlug = `clean-iso-rest-${timestamp}`;

  // 1. Create Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Cleaning Isolation Test Cafe",
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

  // 3. Create Cleaner Staff (active cleaner in restaurant so cleanerExists = true)
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

  // 5. Create the two physical tables that share human-readable numbers
  // Table 1: id=auto, tableNo="1", section="Main Hall"
  const table1 = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "1",
      seats: 4,
      section: "Main Hall",
      cleaningStatus: "CLEAN",
    },
  });

  // Table 2: id=auto, tableNo="table 1", section="Section TABLE"
  const table2 = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "table 1",
      seats: 4,
      section: "Section TABLE",
      cleaningStatus: "CLEAN",
    },
  });

  assert.notEqual(table1.id, table2.id, "Table 1 and Table 2 must have distinct primary keys");

  const ownerToken = app.jwt.sign({
    id: owner.id,
    userId: owner.id,
    name: owner.name,
    email: owner.email,
    role: owner.role,
    restaurantId: restaurant.id,
  });

  const cleanerToken = app.jwt.sign({
    id: cleaner.id,
    userId: cleaner.id,
    name: cleaner.name,
    email: cleaner.email,
    role: cleaner.role,
    designation: cleaner.designation,
    restaurantId: restaurant.id,
  });

  await t.test("SCENARIO 1: Session closure on Main Hall Table 1 marks Table 1 DIRTY and preserves Section TABLE table 1 as CLEAN", async () => {
    // Open session on Table 1
    const session1 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurant.id,
      tableId: table1.id,
      waiterId: server.id,
    });

    assert.equal(session1.tableId, table1.id);
    assert.equal(session1.status, "OPEN");

    // Complete session and release Table 1
    const completionResult = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session1.id,
      realtime: mockRealtime,
      actor: { userId: owner.id, userName: owner.name, role: "OWNER", restaurantId: restaurant.id },
    });

    assert.equal(completionResult.completed, true);

    // Fetch refreshed tables from database
    const dbTable1 = await prisma.diningTable.findUnique({ where: { id: table1.id } });
    const dbTable2 = await prisma.diningTable.findUnique({ where: { id: table2.id } });

    // Table 1 must be DIRTY (awaiting sanitation by Cleaner)
    assert.equal(dbTable1.cleaningStatus, "DIRTY", "Table 1 MUST be DIRTY after session closure");

    // Table 2 MUST REMAIN CLEAN — NO CROSS-CONTAMINATION
    assert.equal(dbTable2.cleaningStatus, "CLEAN", "Table 2 MUST REMAIN CLEAN; fuzzy matching must not corrupt Table 2");

    // Check StaffTask creation: exactly 1 cleaning task created strictly for Table 1
    const cleaningTasks = await prisma.staffTask.findMany({
      where: { restaurantId: restaurant.id, category: "CLEANING", isCompleted: false },
    });

    assert.equal(cleaningTasks.length, 1, "Exactly one cleaning task must be created");
    assert.equal(cleaningTasks[0].tableId, table1.id, "Task tableId must match Table 1 ID");

    // Check GET /owner/:restaurantId/tables API response
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const tablesPayload = JSON.parse(res.payload);
    const apiTable1 = tablesPayload.find((t) => t.id === table1.id);
    const apiTable2 = tablesPayload.find((t) => t.id === table2.id);

    assert.equal(apiTable1.status, "DIRTY", "API Table 1 status must be DIRTY");
    assert.equal(apiTable1.cleaningStatus, "DIRTY", "API Table 1 cleaningStatus must be DIRTY");

    assert.equal(apiTable2.status, "AVAILABLE", "API Table 2 status must be AVAILABLE");
    assert.equal(apiTable2.cleaningStatus, "CLEAN", "API Table 2 cleaningStatus must be CLEAN");
  });

  await t.test("SCENARIO 2: Cleaner completes cleaning task for Table 1 -> Table 1 becomes CLEAN, Table 2 remains CLEAN", async () => {
    const task = await prisma.staffTask.findFirst({
      where: { restaurantId: restaurant.id, tableId: table1.id, isCompleted: false },
    });
    assert.ok(task, "Task must exist for Table 1");

    // Cleaner marks task finish
    const finishRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });

    assert.equal(finishRes.statusCode, 200);

    // Verify DB state
    const dbTable1 = await prisma.diningTable.findUnique({ where: { id: table1.id } });
    const dbTable2 = await prisma.diningTable.findUnique({ where: { id: table2.id } });

    assert.equal(dbTable1.cleaningStatus, "CLEAN", "Table 1 must now be CLEAN");
    assert.equal(dbTable2.cleaningStatus, "CLEAN", "Table 2 must still be CLEAN");

    // Verify API state
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const tablesPayload = JSON.parse(res.payload);
    const apiTable1 = tablesPayload.find((t) => t.id === table1.id);
    const apiTable2 = tablesPayload.find((t) => t.id === table2.id);

    assert.equal(apiTable1.status, "AVAILABLE");
    assert.equal(apiTable1.cleaningStatus, "CLEAN");
    assert.equal(apiTable2.status, "AVAILABLE");
    assert.equal(apiTable2.cleaningStatus, "CLEAN");
  });

  await t.test("SCENARIO 3: REVERSE TEST — Table 2 becomes DIRTY; Table 1 remains CLEAN and unaffected", async () => {
    // Open session on Table 2
    const session2 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurant.id,
      tableId: table2.id,
      waiterId: server.id,
    });

    assert.equal(session2.tableId, table2.id);

    // Complete session on Table 2
    await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session2.id,
      realtime: mockRealtime,
      actor: { userId: owner.id, userName: owner.name, role: "OWNER", restaurantId: restaurant.id },
    });

    const dbTable1 = await prisma.diningTable.findUnique({ where: { id: table1.id } });
    const dbTable2 = await prisma.diningTable.findUnique({ where: { id: table2.id } });

    assert.equal(dbTable1.cleaningStatus, "CLEAN", "Table 1 MUST REMAIN CLEAN");
    assert.equal(dbTable2.cleaningStatus, "DIRTY", "Table 2 MUST BE DIRTY");

    // Direct clean endpoint for Table 2
    const cleanRes = await app.inject({
      method: "POST",
      url: `/api/v1/staff/tables/${table2.id}/clean`,
      headers: { authorization: `Bearer ${cleanerToken}` },
      payload: { restaurantId: restaurant.id },
    });

    assert.equal(cleanRes.statusCode, 200);

    const refreshedTable2 = await prisma.diningTable.findUnique({ where: { id: table2.id } });
    assert.equal(refreshedTable2.cleaningStatus, "CLEAN", "Table 2 must now be CLEAN after direct clean");
  });

  await t.test("SCENARIO 4: Free Table isolation — Freeing Table 1 does NOT touch Table 2 sessions or status", async () => {
    // Open active session on Table 1 and Table 2
    const session1 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurant.id,
      tableId: table1.id,
      waiterId: server.id,
    });

    const session2 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurant.id,
      tableId: table2.id,
      waiterId: server.id,
    });

    // Owner frees Table 1
    const freeRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/tables/${table1.id}/clear`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { force: true, reason: "Manual owner free" },
    });

    assert.equal(freeRes.statusCode, 200);

    // Session 1 must be closed
    const refreshedSess1 = await prisma.tableSession.findUnique({ where: { id: session1.id } });
    assert.equal(refreshedSess1.status, "CLOSED", "Table 1 session must be closed");

    // Session 2 MUST REMAIN OPEN
    const refreshedSess2 = await prisma.tableSession.findUnique({ where: { id: session2.id } });
    assert.equal(refreshedSess2.status, "OPEN", "Table 2 session MUST REMAIN OPEN");

    // Table 1 must be CLEAN & AVAILABLE
    const dbTable1 = await prisma.diningTable.findUnique({ where: { id: table1.id } });
    assert.equal(dbTable1.cleaningStatus, "CLEAN");

    // Table 2 must be OCCUPIED
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const tablesPayload = JSON.parse(res.payload);
    const apiTable1 = tablesPayload.find((t) => t.id === table1.id);
    const apiTable2 = tablesPayload.find((t) => t.id === table2.id);

    assert.equal(apiTable1.status, "AVAILABLE");
    assert.equal(apiTable1.isOccupied, false);

    assert.equal(apiTable2.status, "OCCUPIED");
    assert.equal(apiTable2.isOccupied, true);
  });

  // Cleanup
  await prisma.staffTask.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => {});
  await prisma.restaurant.deleteMany({ where: { id: restaurant.id } }).catch(() => {});
});
