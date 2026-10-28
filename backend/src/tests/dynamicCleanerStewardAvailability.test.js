import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import {
  getActiveStaffByCapability,
  hasActiveCleaner,
  hasActiveSteward,
  handleStaffLifecycleChange,
} from "../services/staffManagementService.js";
import { completeSessionAndReleaseTable } from "../services/tableSessionService.js";

test("Tiffzy Dynamic Cleaner & Steward Availability Based On Owner Staff Designations", async (t) => {
  const app = Fastify();
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET || "test-jwt-secret-key-1234567890" });
  await routes(app, { prisma });
  await app.ready();

  const randSuffix = Math.floor(100000 + Math.random() * 900000);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Dynamic Capability Cafe ${randSuffix}`,
      slug: `dynamic-cafe-${randSuffix}`,
      currency: "INR",
    },
  });
  const restaurantId = restaurant.id;

  const owner = await prisma.user.create({
    data: {
      name: "Owner Admin",
      email: `owner_${randSuffix}@test.com`,
      phone: "+91991" + randSuffix,
      role: "OWNER",
      restaurantId,
      password: bcrypt.hashSync("OwnerPass123!", 10),
      sessionVersion: 1,
    },
  });

  const ownerToken = app.jwt.sign({
    id: owner.id,
    userId: owner.id,
    role: "OWNER",
    restaurantId,
    sessionVersion: 1,
  });

  const serverUser = await prisma.user.create({
    data: {
      name: "Server Alex",
      email: `server_${randSuffix}@test.com`,
      phone: "+91992" + randSuffix,
      role: "WAITER",
      designation: "Server",
      restaurantId,
      password: bcrypt.hashSync("ServerPass123!", 10),
      sessionVersion: 1,
    },
  });

  const serverToken = app.jwt.sign({
    id: serverUser.id,
    userId: serverUser.id,
    role: "WAITER",
    restaurantId,
    sessionVersion: 1,
  });

  // Table for testing payment & cleaning flows
  const diningTable = await prisma.diningTable.create({
    data: {
      restaurantId,
      tableNo: `T-${randSuffix}`,
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  // ==========================================
  // CLEANER TESTS (1 - 10)
  // ==========================================

  await t.test("1. No Cleaner exists -> Cleaner capability disabled", async () => {
    const caps = await getActiveStaffByCapability({ prisma, restaurantId });
    assert.equal(caps.hasCleaner, false);
    assert.equal(caps.cleanerCount, 0);

    const cleanerAvailable = await hasActiveCleaner({ prisma, restaurantId });
    assert.equal(cleanerAvailable, false);

    // Backend endpoint returns correct capabilities
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantId}/capabilities`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.capabilities.hasCleaner, false);
    assert.equal(body.capabilities.cleanerCount, 0);

    // Creating cleaning task should be rejected
    const taskRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/tasks/request",
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        restaurantId,
        title: "Clean table",
        category: "CLEANING",
        roleTarget: "CLEANER",
      },
    });
    assert.equal(taskRes.statusCode, 400);
    const taskBody = JSON.parse(taskRes.payload);
    assert.equal(taskBody.code, "cleaner_unavailable");
  });

  let cleaner1;
  await t.test("2. One Cleaner added -> Cleaner capability enabled", async () => {
    const addRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantId}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Ravi Cleaner",
        email: `cleaner1_${randSuffix}@test.com`,
        phone: "+91993" + randSuffix,
        role: "STAFF",
        designation: "Cleaner",
      },
    });
    assert.equal(addRes.statusCode, 200);
    const addBody = JSON.parse(addRes.payload);
    cleaner1 = addBody.user;
    assert.equal(addBody.capabilities.hasCleaner, true);
    assert.equal(addBody.capabilities.cleanerCount, 1);

    const cleanerAvailable = await hasActiveCleaner({ prisma, restaurantId });
    assert.equal(cleanerAvailable, true);
  });

  let cleaner2;
  await t.test("3. Two Cleaners exist (including Housekeeping) -> Cleaner capability enabled", async () => {
    const addRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantId}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Anita Housekeeping",
        email: `cleaner2_${randSuffix}@test.com`,
        phone: "+91994" + randSuffix,
        role: "STAFF",
        designation: "Housekeeping",
      },
    });
    assert.equal(addRes.statusCode, 200);
    const addBody = JSON.parse(addRes.payload);
    cleaner2 = addBody.user;
    assert.equal(addBody.capabilities.hasCleaner, true);
    assert.equal(addBody.capabilities.cleanerCount, 2);
  });

  await t.test("4. Delete one of two Cleaners -> Cleaner remains enabled", async () => {
    const delRes = await app.inject({
      method: "DELETE",
      url: `/owner/${restaurantId}/staff/${cleaner2.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    const delBody = JSON.parse(delRes.payload);
    assert.equal(delBody.capabilities.hasCleaner, true);
    assert.equal(delBody.capabilities.cleanerCount, 1);

    const cleanerAvailable = await hasActiveCleaner({ prisma, restaurantId });
    assert.equal(cleanerAvailable, true);
  });

  await t.test("6. Deactivate last Cleaner -> Cleaner becomes disabled", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/owner/${restaurantId}/staff/${cleaner1.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });
    assert.equal(patchRes.statusCode, 200);
    const patchBody = JSON.parse(patchRes.payload);
    assert.equal(patchBody.capabilities.hasCleaner, false);
    assert.equal(patchBody.capabilities.cleanerCount, 0);

    const cleanerAvailable = await hasActiveCleaner({ prisma, restaurantId });
    assert.equal(cleanerAvailable, false);
  });

  await t.test("7. Reactivate Cleaner -> Cleaner becomes enabled", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/owner/${restaurantId}/staff/${cleaner1.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: true },
    });
    assert.equal(patchRes.statusCode, 200);
    const patchBody = JSON.parse(patchRes.payload);
    assert.equal(patchBody.capabilities.hasCleaner, true);
    assert.equal(patchBody.capabilities.cleanerCount, 1);
  });

  await t.test("8. Payment with active Cleaner -> existing cleaning lifecycle works (DIRTY & task created)", async () => {
    // Create an active session on diningTable
    const session = await prisma.tableSession.create({
      data: {
        restaurantId,
        tableId: diningTable.id,
        tableNo: diningTable.tableNo,
        status: "OPEN",
      },
    });

    const result = await completeSessionAndReleaseTable({
      prisma,
      restaurantId,
      tableId: diningTable.id,
      tableSessionId: session.id,
      actor: { id: owner.id, name: owner.name, role: "OWNER" },
    });

    assert.equal(result.completed, true);

    const tableAfterPayment = await prisma.diningTable.findUnique({ where: { id: diningTable.id } });
    assert.equal(tableAfterPayment.cleaningStatus, "DIRTY");

    const cleaningTask = await prisma.staffTask.findFirst({
      where: { tableId: diningTable.id, roleTarget: "CLEANER", status: "PENDING" },
    });
    assert.ok(cleaningTask);
    assert.equal(cleaningTask.roleTarget, "CLEANER");
  });

  await t.test("10. Existing Cleaner assignment deleted/deactivated -> no orphaned assignment remains", async () => {
    // Check cleaning task exists and assign to cleaner1
    const pendingTask = await prisma.staffTask.findFirst({
      where: { tableId: diningTable.id, status: "PENDING" },
    });
    assert.ok(pendingTask);

    await prisma.staffTask.update({
      where: { id: pendingTask.id },
      data: { assignedTo: cleaner1.id, status: "ACCEPTED" },
    });

    // Deactivate cleaner1 via PATCH endpoint -> since cleaner1 is last cleaner, task is auto-cancelled and table is released
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/owner/${restaurantId}/staff/${cleaner1.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });
    assert.equal(patchRes.statusCode, 200);

    const updatedTask = await prisma.staffTask.findUnique({ where: { id: pendingTask.id } });
    assert.equal(updatedTask.status, "CANCELLED");

    const updatedTable = await prisma.diningTable.findUnique({ where: { id: diningTable.id } });
    assert.equal(updatedTable.cleaningStatus, "CLEAN");
  });

  await t.test("5. Delete last Cleaner -> Cleaner becomes disabled", async () => {
    const delRes = await app.inject({
      method: "DELETE",
      url: `/owner/${restaurantId}/staff/${cleaner1.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    const delBody = JSON.parse(delRes.payload);
    assert.equal(delBody.capabilities.hasCleaner, false);
    assert.equal(delBody.capabilities.cleanerCount, 0);

    const cleanerAvailable = await hasActiveCleaner({ prisma, restaurantId });
    assert.equal(cleanerAvailable, false);
  });

  await t.test("9. Payment with no Cleaner -> table auto-releases to CLEAN, no orphaned task", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId,
        tableId: diningTable.id,
        tableNo: diningTable.tableNo,
        status: "OPEN",
      },
    });

    const result = await completeSessionAndReleaseTable({
      prisma,
      restaurantId,
      tableId: diningTable.id,
      tableSessionId: session.id,
      actor: { id: owner.id, name: owner.name, role: "OWNER" },
    });

    assert.equal(result.completed, true);

    const tableAfterPayment = await prisma.diningTable.findUnique({ where: { id: diningTable.id } });
    assert.equal(tableAfterPayment.cleaningStatus, "CLEAN");

    const orphanedTask = await prisma.staffTask.findFirst({
      where: { tableId: diningTable.id, roleTarget: "CLEANER", status: "PENDING" },
    });
    assert.equal(orphanedTask, null);
  });

  // ==========================================
  // STEWARD TESTS (11 - 19)
  // ==========================================

  await t.test("11. No Steward exists -> Steward capability disabled", async () => {
    const caps = await getActiveStaffByCapability({ prisma, restaurantId });
    assert.equal(caps.hasSteward, false);
    assert.equal(caps.stewardCount, 0);

    const stewardAvailable = await hasActiveSteward({ prisma, restaurantId });
    assert.equal(stewardAvailable, false);

    // Attempting to create steward assistance task fails with steward_unavailable
    const taskRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/tasks/request",
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        restaurantId,
        title: "Table assistance",
        category: "SERVICE",
        roleTarget: "STEWARD",
      },
    });
    assert.equal(taskRes.statusCode, 400);
    const taskBody = JSON.parse(taskRes.payload);
    assert.equal(taskBody.code, "steward_unavailable");
  });

  let steward1;
  await t.test("12. One Steward added -> Steward capability enabled", async () => {
    const addRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantId}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Dev Steward",
        email: `steward1_${randSuffix}@test.com`,
        phone: "+91995" + randSuffix,
        role: "WAITER",
        designation: "Steward",
      },
    });
    assert.equal(addRes.statusCode, 200);
    const addBody = JSON.parse(addRes.payload);
    steward1 = addBody.user;
    assert.equal(addBody.capabilities.hasSteward, true);
    assert.equal(addBody.capabilities.stewardCount, 1);

    const stewardAvailable = await hasActiveSteward({ prisma, restaurantId });
    assert.equal(stewardAvailable, true);
  });

  let steward2;
  await t.test("13. Two Stewards exist -> Steward capability enabled", async () => {
    const addRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantId}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Karan Steward",
        email: `steward2_${randSuffix}@test.com`,
        phone: "+91996" + randSuffix,
        role: "WAITER",
        designation: "Steward",
      },
    });
    assert.equal(addRes.statusCode, 200);
    const addBody = JSON.parse(addRes.payload);
    steward2 = addBody.user;
    assert.equal(addBody.capabilities.hasSteward, true);
    assert.equal(addBody.capabilities.stewardCount, 2);
  });

  await t.test("14. Delete one of two Stewards -> Steward remains enabled", async () => {
    const delRes = await app.inject({
      method: "DELETE",
      url: `/owner/${restaurantId}/staff/${steward2.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    const delBody = JSON.parse(delRes.payload);
    assert.equal(delBody.capabilities.hasSteward, true);
    assert.equal(delBody.capabilities.stewardCount, 1);
  });

  await t.test("16. Deactivate last Steward -> Steward becomes disabled", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/owner/${restaurantId}/staff/${steward1.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });
    assert.equal(patchRes.statusCode, 200);
    const patchBody = JSON.parse(patchRes.payload);
    assert.equal(patchBody.capabilities.hasSteward, false);
    assert.equal(patchBody.capabilities.stewardCount, 0);

    const stewardAvailable = await hasActiveSteward({ prisma, restaurantId });
    assert.equal(stewardAvailable, false);
  });

  await t.test("17. Reactivate Steward -> Steward becomes enabled", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/owner/${restaurantId}/staff/${steward1.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: true },
    });
    assert.equal(patchRes.statusCode, 200);
    const patchBody = JSON.parse(patchRes.payload);
    assert.equal(patchBody.capabilities.hasSteward, true);
    assert.equal(patchBody.capabilities.stewardCount, 1);
  });

  let activeStewardTask;
  await t.test("18. Existing Steward flow remains functional when Steward is enabled", async () => {
    const taskRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/tasks/request",
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        restaurantId,
        title: "Water request",
        category: "SERVICE",
        roleTarget: "STEWARD",
      },
    });
    assert.equal(taskRes.statusCode, 201);
    const taskBody = JSON.parse(taskRes.payload);
    activeStewardTask = taskBody.task;
    assert.equal(activeStewardTask.roleTarget, "STEWARD");
    assert.equal(activeStewardTask.status, "PENDING");
  });

  await t.test("19. No orphaned Steward assignment after staff deletion", async () => {
    // Assign task to steward1
    await prisma.staffTask.update({
      where: { id: activeStewardTask.id },
      data: { assignedTo: steward1.id, status: "ACCEPTED" },
    });

    // Delete last steward
    const delRes = await app.inject({
      method: "DELETE",
      url: `/owner/${restaurantId}/staff/${steward1.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.statusCode, 200);

    // Verify task is cancelled, not left hanging with deleted staff
    const updatedTask = await prisma.staffTask.findUnique({ where: { id: activeStewardTask.id } });
    assert.equal(updatedTask.status, "CANCELLED");

    const caps = await getActiveStaffByCapability({ prisma, restaurantId });
    assert.equal(caps.hasSteward, false);
    assert.equal(caps.stewardCount, 0);
  });

  await t.test("15. Delete last Steward -> Steward becomes disabled", async () => {
    const stewardAvailable = await hasActiveSteward({ prisma, restaurantId });
    assert.equal(stewardAvailable, false);
  });

  // Cleanup test artifacts
  await prisma.staffTask.deleteMany({ where: { restaurantId } }).catch(() => {});
  await prisma.tableSession.deleteMany({ where: { restaurantId } }).catch(() => {});
  await prisma.diningTable.deleteMany({ where: { restaurantId } }).catch(() => {});
  await prisma.staffAccess.deleteMany({ where: { restaurantId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { restaurantId } }).catch(() => {});
  await prisma.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
});
