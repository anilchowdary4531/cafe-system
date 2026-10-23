import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import { inferRoleFromDesignation } from "../services/staffSessionService.js";
import staffTaskRoutes from "../routes/staffTasks.routes.js";
import { completeSessionAndReleaseTable, getOrCreateActiveSession } from "../services/tableSessionService.js";
import { openShift, getCurrentShift } from "../services/shiftService.js";

test("Designations 4-9: Role & Designation Inference Matrix", () => {
  assert.equal(inferRoleFromDesignation("STEWARD"), "STEWARD");
  assert.equal(inferRoleFromDesignation("Steward Floor Runner"), "STEWARD");
  assert.equal(inferRoleFromDesignation("CLEANER"), "CLEANER");
  assert.equal(inferRoleFromDesignation("Housekeeping Cleaner"), "CLEANER");
  assert.equal(inferRoleFromDesignation("SWIPER"), "SWIPER");
  assert.equal(inferRoleFromDesignation("Tableside Swiper Runner"), "SWIPER");
  assert.equal(inferRoleFromDesignation("CASHIER"), "CASHIER");
  assert.equal(inferRoleFromDesignation("Head Cashier"), "CASHIER");
  assert.equal(inferRoleFromDesignation("CHEF"), "CHEF");
  assert.equal(inferRoleFromDesignation("Senior Chef"), "CHEF");
  assert.equal(inferRoleFromDesignation("SERVER"), "WAITER");
  assert.equal(inferRoleFromDesignation("WAITER"), "WAITER");
  assert.equal(inferRoleFromDesignation("MANAGER"), "MANAGER");
  assert.equal(inferRoleFromDesignation("OWNER"), "OWNER");
  assert.equal(inferRoleFromDesignation("unknown"), null);
});

test("Designations 4-9: Table Cleaning State & Task Lifecycle", async (t) => {
  const emittedEvents = [];
  const mockRealtime = {
    io: {
      to: (room) => ({
        emit: (event, data) => emittedEvents.push({ ns: "io", room, event, data }),
      }),
    },
    staff: {
      to: (room) => ({
        emit: (event, data) => emittedEvents.push({ ns: "staff", room, event, data }),
      }),
    },
  };

  // Create test restaurant and dining table
  const testRestaurant = await prisma.restaurant.create({
    data: {
      name: "Tiffzy Designation Test Cafe " + Date.now(),
      slug: "tiffzy-desig-test-" + Date.now(),
      phone: "+919876543210",
      email: `desig_${Date.now()}@test.com`,
    },
  });

  const testTable = await prisma.diningTable.create({
    data: {
      restaurantId: testRestaurant.id,
      tableNo: "T99",
      seats: 4,
      cleaningStatus: "CLEAN",
    },
  });

  // Create a cleaner user
  const cleanerUser = await prisma.user.create({
    data: {
      name: "Test Cleaner",
      email: `cleaner_${Date.now()}@test.com`,
      phone: "+9199999" + Math.floor(10000 + Math.random() * 90000),
      password: "hashedpassword123",
      role: "CLEANER",
      isActive: true,
    },
  });

  await prisma.staffAccess.create({
    data: {
      restaurantId: testRestaurant.id,
      userId: cleanerUser.id,
      role: "CLEANER",
      permissions: ["cleaning_tasks.view", "cleaning_tasks.execute"],
    },
  });

  // Setup Fastify App with staffTaskRoutes
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-jwt-secret-desig4to9" });
  await staffTaskRoutes(app, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES: ["OWNER", "MANAGER", "WAITER", "SERVER", "CHEF", "CASHIER", "STEWARD", "CLEANER", "SWIPER", "STAFF"],
  });

  const cleanerToken = app.jwt.sign({
    userId: cleanerUser.id,
    restaurantId: testRestaurant.id,
    role: "CLEANER",
    designation: "CLEANER",
  });

  await t.test("1. Session release transitions table to DIRTY and creates StaffTask", async () => {
    // Create active session first
    const activeSession = await getOrCreateActiveSession({
      prisma,
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
      guestCount: 2,
    });
    assert.ok(activeSession, "Session created");

    // Simulate table session release
    const result = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: activeSession.id,
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
      realtime: mockRealtime,
      actor: cleanerUser,
    });

    const updatedTable = await prisma.diningTable.findUnique({
      where: { id: testTable.id },
    });

    assert.equal(updatedTable.cleaningStatus, "DIRTY");

    // Verify task created for cleaner
    const task = await prisma.staffTask.findFirst({
      where: {
        restaurantId: testRestaurant.id,
        tableId: testTable.id,
        taskType: "TABLE_BUS_AND_SANITIZE",
      },
    });

    assert.ok(task, "Cleaning task must be created");
    assert.equal(task.status, "PENDING");

    // Verify realtime events emitted
    const dirtyEvent = emittedEvents.find((e) => e.event === "cleaner:table_dirty");
    assert.ok(dirtyEvent, "Must emit cleaner:table_dirty");
  });

  await t.test("2. Cleaner accepts, starts, and finishes cleaning task", async () => {
    const task = await prisma.staffTask.findFirst({
      where: {
        restaurantId: testRestaurant.id,
        tableId: testTable.id,
      },
    });

    // Accept
    const acceptRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/accept`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });
    assert.equal(acceptRes.statusCode, 200);
    const acceptedTask = JSON.parse(acceptRes.payload).task;
    assert.equal(acceptedTask.status, "ACCEPTED");

    // Start
    const startRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/start`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });
    assert.equal(startRes.statusCode, 200);
    const inProgressTask = JSON.parse(startRes.payload).task;
    assert.equal(inProgressTask.status, "IN_PROGRESS");

    // Finish
    const finishRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });
    assert.equal(finishRes.statusCode, 200);
    const finishedTask = JSON.parse(finishRes.payload).task;
    assert.equal(finishedTask.status, "COMPLETED");

    // Table must now be CLEAN
    const tableAfterClean = await prisma.diningTable.findUnique({
      where: { id: testTable.id },
    });
    assert.equal(tableAfterClean.cleaningStatus, "CLEAN");

    // Realtime events
    const cleanEvent = emittedEvents.find((e) => e.event === "cleaner:table_cleaned");
    assert.ok(cleanEvent, "Must emit cleaner:table_cleaned");

    const tableUpdateEvent = emittedEvents.find((e) => e.event === "table:updated" && e.data.status === "AVAILABLE");
    assert.ok(tableUpdateEvent, "Must emit table:updated with status AVAILABLE");
  });

  await t.test("3. Cashier discount request dispatches manager approval event", async () => {
    const cashierToken = app.jwt.sign({
      userId: cleanerUser.id,
      restaurantId: testRestaurant.id,
      role: "CASHIER",
      designation: "CASHIER",
    });

    const discRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/cashier/discount-request",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: 99,
        tableNo: "T99",
        discountAmount: 50,
        discountReason: "Customer VIP Goodwill",
      },
    });

    assert.equal(discRes.statusCode, 200);
    const body = JSON.parse(discRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.request.discountAmount, 50);

    const approvalEvent = emittedEvents.find((e) => e.event === "manager:approval_requested");
    assert.ok(approvalEvent, "Must emit manager:approval_requested");
    assert.equal(approvalEvent.data.discountAmount, 50);
  });

  await t.test("5. Steward assistance task creation emits realtime alert", async () => {
    const stewardToken = app.jwt.sign({
      userId: cleanerUser.id,
      restaurantId: testRestaurant.id,
      role: "STEWARD",
      designation: "STEWARD",
    });

    const assistRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/tasks/request",
      headers: { authorization: `Bearer ${stewardToken}` },
      payload: {
        category: "SERVICE",
        taskType: "WATER_REFILL",
        title: "Water refill Table T99",
        tableId: testTable.id,
        priority: "MEDIUM",
      },
    });

    assert.equal(assistRes.statusCode, 201);
    const body = JSON.parse(assistRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.task.status, "PENDING");

    const assistEvent = emittedEvents.find((e) => e.event === "steward:assistance_requested");
    assert.ok(assistEvent, "Must emit steward:assistance_requested");
  });

  await t.test("6. Cashier shift opening and cash drawer tracking", async () => {
    const shift = await openShift({
      prisma,
      restaurantId: testRestaurant.id,
      userId: cleanerUser.id,
      openingCash: 500,
      notes: "Morning shift drawer",
      terminalId: "DESK-1",
    });

    assert.ok(shift.id);
    assert.equal(shift.openingCash, 500);
    assert.equal(shift.status, "OPEN");

    const current = await getCurrentShift({
      prisma,
      restaurantId: testRestaurant.id,
      userId: cleanerUser.id,
      terminalId: "DESK-1",
    });

    assert.equal(current.id, shift.id);
    assert.equal(current.expectedCash, 500);

    // Clean up shift
    await prisma.cashierShift.delete({ where: { id: shift.id } });
  });

  await t.test("7. Multi-tenant isolation: other restaurant staff cannot view tasks", async () => {
    const otherRestaurant = await prisma.restaurant.create({
      data: {
        name: "Other Restaurant " + Date.now(),
        slug: "other-rest-" + Date.now(),
        phone: "+919876543299",
        email: `other_${Date.now()}@test.com`,
      },
    });

    const otherToken = app.jwt.sign({
      userId: cleanerUser.id,
      restaurantId: otherRestaurant.id,
      role: "CLEANER",
      designation: "CLEANER",
    });

    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/staff/tasks",
      headers: { authorization: `Bearer ${otherToken}` },
    });

    assert.equal(getRes.statusCode, 200);
    const tasks = JSON.parse(getRes.payload).tasks;
    assert.equal(tasks.length, 0, "Other restaurant cannot see test restaurant's tasks");

    await prisma.restaurant.delete({ where: { id: otherRestaurant.id } });
  });

  await t.test("8. Strict Sanitation: Reseating is rejected on DIRTY table", async () => {
    // Manually mark table as DIRTY
    await prisma.diningTable.update({
      where: { id: testTable.id },
      data: { cleaningStatus: "DIRTY" },
    });

    await assert.rejects(
      async () => {
        await getOrCreateActiveSession({
          prisma,
          restaurantId: testRestaurant.id,
          tableId: testTable.id,
          guestCount: 2,
        });
      },
      (err) => {
        assert.equal(err.code, "table_dirty");
        return true;
      },
      "Reseating a dirty table must throw table_dirty error"
    );

    // Reset table back to CLEAN
    await prisma.diningTable.update({
      where: { id: testTable.id },
      data: { cleaningStatus: "CLEAN" },
    });
  });

  await t.test("9. Concurrency Protection: Second worker cannot accept an already claimed task", async () => {
    // Create a new task
    const task = await prisma.staffTask.create({
      data: {
        restaurantId: testRestaurant.id,
        tableId: testTable.id,
        title: "Clean Table T99 Concurrency Test",
        category: "CLEANING",
        taskType: "TABLE_BUS_AND_SANITIZE",
        roleTarget: "CLEANER",
        status: "PENDING",
      },
    });

    // Cleaner 1 claims task
    const cleaner1Token = app.jwt.sign({
      userId: cleanerUser.id,
      restaurantId: testRestaurant.id,
      role: "CLEANER",
    });

    const accept1 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/accept`,
      headers: { authorization: `Bearer ${cleaner1Token}` },
    });
    assert.equal(accept1.statusCode, 200);

    // Cleaner 2 attempts to claim same task
    const cleaner2User = await prisma.user.create({
      data: {
        name: "Test Cleaner 2",
        email: `cleaner2_${Date.now()}@test.com`,
        phone: "+9199998" + Math.floor(10000 + Math.random() * 90000),
        password: "hashedpassword123",
        role: "CLEANER",
        isActive: true,
      },
    });

    const cleaner2Token = app.jwt.sign({
      userId: cleaner2User.id,
      restaurantId: testRestaurant.id,
      role: "CLEANER",
    });

    const accept2 = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/accept`,
      headers: { authorization: `Bearer ${cleaner2Token}` },
    });
    assert.equal(accept2.statusCode, 409, "Must return 409 Conflict when task already claimed");

    // Clean up task & user
    await prisma.staffTask.delete({ where: { id: task.id } });
    await prisma.user.delete({ where: { id: cleaner2User.id } });
  });

  await t.test("10. Report Issue on Task by Steward or Cleaner", async () => {
    const task = await prisma.staffTask.create({
      data: {
        restaurantId: testRestaurant.id,
        tableId: testTable.id,
        title: "Steward assistance issue test",
        category: "SERVICE",
        taskType: "ASSISTANCE",
        roleTarget: "STEWARD",
        status: "PENDING",
      },
    });

    const stewardToken = app.jwt.sign({
      userId: cleanerUser.id,
      restaurantId: testRestaurant.id,
      role: "STEWARD",
    });

    const issueRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${task.id}/report-issue`,
      headers: { authorization: `Bearer ${stewardToken}` },
      payload: {
        issueDescription: "Spilled hot beverage, glass broken on floor",
        priority: "URGENT",
      },
    });

    assert.equal(issueRes.statusCode, 200);
    const body = JSON.parse(issueRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.task.priority, "URGENT");
    assert.ok(body.task.description.includes("Spilled hot beverage"));

    // Clean up task
    await prisma.staffTask.delete({ where: { id: task.id } });
  });

  await t.test("11. Authoritative Bill Settlement via /api/v1/staff/billing/settle", async () => {
    // Open a cashier shift
    const shift = await openShift({
      prisma,
      restaurantId: testRestaurant.id,
      userId: cleanerUser.id,
      openingCash: 1000,
      terminalId: "DESK-SETTLE",
    });

    // Create an order with items
    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: "ORD-SETTLE-001",
        tableNo: "T99",
        subtotal: 600,
        taxAmount: 30,
        total: 630,
        paymentStatus: "PENDING",
        items: {
          create: [
            {
              itemName: "Paneer Butter Masala",
              price: 300,
              qty: 2,
              total: 600,
            },
          ],
        },
      },
    });

    const cashierUser = await prisma.user.create({
      data: {
        name: "Test Cashier Settle",
        email: `cashier_settle_${Date.now()}@test.com`,
        phone: "+9199996" + Math.floor(10000 + Math.random() * 90000),
        password: "hashedpassword123",
        role: "CASHIER",
        isActive: true,
      },
    });

    const cashierToken = app.jwt.sign({
      userId: cashierUser.id,
      restaurantId: testRestaurant.id,
      role: "CASHIER",
    });

    // 11a. Reject mismatched amount
    const mismatchRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: order.id,
        paymentMethod: "CASH",
        amount: 500, // Mismatch with authoritative 630
        shiftId: shift.id,
      },
    });
    assert.equal(mismatchRes.statusCode, 400);
    const mismatchBody = JSON.parse(mismatchRes.payload);
    assert.equal(mismatchBody.code, "amount_mismatch");

    // 11b. Settle with authoritative amount
    const settleRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: order.id,
        paymentMethod: "CASH",
        amount: 630,
        shiftId: shift.id,
      },
    });
    assert.equal(settleRes.statusCode, 200);
    const settleBody = JSON.parse(settleRes.payload);
    assert.equal(settleBody.success, true);
    assert.equal(settleBody.authoritativeTotal, 630);

    // Verify order is PAID
    const paidOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(paidOrder.paymentStatus, "SUCCESS");

    // Verify CashierShift expectedCash updated: 1000 + 630 = 1630
    const updatedShift = await prisma.cashierShift.findUnique({ where: { id: shift.id } });
    assert.equal(updatedShift.expectedCash, 1630);

    // Clean up
    await prisma.cashMovement.deleteMany({ where: { shiftId: shift.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.cashierShift.delete({ where: { id: shift.id } });
    await prisma.user.delete({ where: { id: cashierUser.id } });
  });

  await t.test("12. Swiper cannot modify amount or apply discount", async () => {
    const swiperUser = await prisma.user.create({
      data: {
        name: "Test Swiper Runner",
        email: `swiper_${Date.now()}@test.com`,
        phone: "+9199997" + Math.floor(10000 + Math.random() * 90000),
        password: "hashedpassword123",
        role: "SWIPER",
        isActive: true,
      },
    });

    const swiperToken = app.jwt.sign({
      userId: swiperUser.id,
      restaurantId: testRestaurant.id,
      role: "SWIPER",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${swiperToken}` },
      payload: {
        orderId: 999,
        paymentMethod: "CARD",
        discountAmount: 100, // Forbidden for swiper
      },
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes("Swiper runner cannot alter bill amounts"));

    await prisma.user.delete({ where: { id: swiperUser.id } });
  });

  // Final cleanup
  await prisma.staffTask.deleteMany({ where: { restaurantId: testRestaurant.id } });
  await prisma.staffAccess.deleteMany({ where: { restaurantId: testRestaurant.id } });
  await prisma.diningTable.deleteMany({ where: { restaurantId: testRestaurant.id } });
  await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
  await prisma.user.delete({ where: { id: cleanerUser.id } });

  await app.close();
});
