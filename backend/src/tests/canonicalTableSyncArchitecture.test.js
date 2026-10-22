import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-canonical-sync-secret-key-4321" });

  const requireOwnerRouteAuth = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma,
      allowedRoles: STAFF_ALLOWED_ROLES,
      matchRestaurantParam: "restaurantId",
    });
    if (!actor) return reply;
    req.staffActor = actor;
    req.user = { id: actor.userId, name: actor.userName, role: actor.role };
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

  const buildQrTargetUrl = (slug, tableNo) => `/menu/${slug}?table=${tableNo}`;

  await ownerRoutes(app, {
    prisma,
    realtime: mockRealtime,
    buildQrTargetUrl,
  });

  return app;
}

test("Canonical Table State Synchronization Backend Architecture", async (t) => {
  const emittedEvents = [];
  const app = await createTestApp(emittedEvents);

  const timestamp = Date.now();
  const restaurantSlug = `canonical-test-resto-${timestamp}`;

  // 1. Setup Test Restaurant, Staff, Table 2 and Table T2
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Cafe King Canonical",
      slug: restaurantSlug,
      addressLine1: "123 Sovereign Way",
      city: "Hyderabad",
      country: "India",
      currency: "INR",
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Owner King",
      email: `owner-${timestamp}@cafeking.com`,
      password: "password123",
      role: "OWNER",
    },
  });

  const waiterUser = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Kamalesh",
      email: `kamalesh-${timestamp}@cafeking.com`,
      password: "password123",
      role: "WAITER",
    },
  });

  const table2 = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "2",
      seats: 4,
      section: "Main Floor",
    },
  });

  const tableT2 = await prisma.diningTable.create({
    data: {
      restaurantId: restaurant.id,
      tableNo: "T2",
      seats: 2,
      section: "Terrace",
    },
  });

  const ownerToken = app.jwt.sign({
    id: ownerUser.id,
    userId: ownerUser.id,
    restaurantId: restaurant.id,
    name: ownerUser.name,
    role: "OWNER",
  });

  await t.test("TEST A: Assign Table 2 -> Kamalesh emits canonical event with version and server fields", async () => {
    emittedEvents.length = 0;

    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/tables/${table2.id}/assign-waiter`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { waiterId: waiterUser.id, reason: "Assigned via Owner Panel" },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);

    // Verify Socket.IO emitted canonical table:updated and table:waiter_assigned
    const updateEvents = emittedEvents.filter((e) => e.event === "table:updated");
    assert.ok(updateEvents.length > 0, "Must emit table:updated");

    const payload = updateEvents[0].data;
    assert.equal(payload.restaurantId, restaurant.id);
    assert.equal(payload.tableId, table2.id);
    assert.equal(payload.id, table2.id);
    assert.equal(payload.tableNo, "2");
    assert.equal(payload.assignedWaiterId, waiterUser.id);
    assert.equal(payload.assignedWaiterName, "Kamalesh");
    assert.equal(payload.assignedServer, "Kamalesh");
    assert.equal(payload.assignedServerId, waiterUser.id);
    assert.equal(payload.assignedServerName, "Kamalesh");
    assert.ok(payload.version > 0, "Must include monotonic version timestamp");
    assert.ok(payload.updatedAt, "Must include updatedAt ISO string");
  });

  await t.test("TEST B: Table T2 is NOT affected by Table 2 assignment (Table 2 vs T2 isolation)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const tables = JSON.parse(res.payload);
    
    const fetchedTable2 = tables.find((t) => t.id === table2.id);
    const fetchedTableT2 = tables.find((t) => t.id === tableT2.id);

    assert.equal(fetchedTable2.assignedWaiterName, "Kamalesh");
    assert.equal(fetchedTable2.assignedServer, "Kamalesh");

    assert.equal(fetchedTableT2.assignedWaiterId, null);
    assert.equal(fetchedTableT2.assignedWaiterName, null);
    assert.equal(fetchedTableT2.assignedServer, null);
    assert.notEqual(fetchedTable2.id, fetchedTableT2.id);
  });

  await t.test("TEST C: Clear / Free Table 2 emits AVAILABLE, unassigned, version, and closed session", async () => {
    emittedEvents.length = 0;

    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/tables/${table2.id}/clear`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { clearWaiter: true, reason: "Owner freed table" },
    });

    assert.equal(res.statusCode, 200);

    const clearEvents = emittedEvents.filter((e) => e.event === "table:updated");
    assert.ok(clearEvents.length > 0, "Must emit table:updated on clear");

    const clearPayload = clearEvents[0].data;
    assert.equal(clearPayload.status, "AVAILABLE");
    assert.equal(clearPayload.isOccupied, false);
    assert.equal(clearPayload.assignedWaiterId, null);
    assert.equal(clearPayload.assignedWaiterName, null);
    assert.equal(clearPayload.assignedServer, null);
    assert.equal(clearPayload.assignedServerId, null);
    assert.equal(clearPayload.assignedServerName, null);
    assert.equal(clearPayload.activeOrderCount, 0);
    assert.deepEqual(clearPayload.activeOrders, []);
    assert.ok(clearPayload.version > 0);
  });

  await t.test("TEST D: Authoritative bill calculation correctly includes active unpaid orders", async () => {
    // Create an unpaid order for Table 2
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableNo: "2",
        orderNo: `ORD-CANONICAL-${timestamp}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 672.00,
        total: 672.00,
        items: {
          create: [
            {
              itemName: "Paneer Butter Masala",
              qty: 2,
              price: 336.00,
              total: 672.00,
            },
          ],
        },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/tables/2/bill?tableId=${table2.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const bill = JSON.parse(res.payload);
    assert.equal(bill.authoritativeTotal, 672.00);
    assert.equal(bill.total, 672.00);
    assert.equal(bill.orders.length, 1);
    assert.equal(bill.cleared, false);

    // Cleanup created order
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  // Cleanup DB records
  await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.restaurant.delete({ where: { id: restaurant.id } });
});
