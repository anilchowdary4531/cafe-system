import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import superAdminRoutes from "../routes/superAdmin.js";
import { CustomerPresenceManager } from "../realtime/presenceManager.js";

// Setup helper for testing Super Admin presence routes
const buildTestApp = async () => {
  const app = fastify();
  await app.register(fastifyJwt, { secret: "super-secret-test-jwt-key" });

  const mockCustomerAccounts = [
    {
      id: 1,
      name: "Ramesh Kumar",
      phone: "+919876543210",
      username: "ramesh",
      email: "ramesh@example.com",
      isOnline: false,
      lastSeenAt: new Date(Date.now() - 3600000), // 1 hr ago
      createdAt: new Date(),
    },
    {
      id: 2,
      name: "Sita Sharma",
      phone: "+919876543211",
      username: "sita",
      email: "sita@example.com",
      isOnline: false,
      lastSeenAt: null,
      createdAt: new Date(),
    },
  ];

  const mockUsers = [
    {
      id: 99,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      email: "admin@tiffzy.com",
      sessionVersion: 0,
      status: "ACTIVE",
    },
    {
      id: 50,
      name: "Waiter Bob",
      role: "WAITER",
      email: "waiter@tiffzy.com",
      sessionVersion: 0,
      status: "ACTIVE",
    },
  ];

  const mockPrisma = {
    user: {
      findUnique: async ({ where }) => mockUsers.find((u) => u.id === where.id) || null,
      findMany: async () => mockUsers,
    },
    customerAccount: {
      findMany: async () => mockCustomerAccounts,
      findUnique: async ({ where }) => mockCustomerAccounts.find((c) => c.id === where.id) || null,
      count: async () => mockCustomerAccounts.length,
      update: async ({ where, data }) => {
        const item = mockCustomerAccounts.find((c) => c.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
    customer: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
  };

  const presenceManager = new CustomerPresenceManager({
    prisma: mockPrisma,
    graceMs: 100,
  });

  app.presenceManager = presenceManager;

  const deps = {
    prisma: mockPrisma,
    STAFF_ACCESS_MODULES: ["DASHBOARD", "SETTINGS", "USERS"],
  };

  await superAdminRoutes(app, deps);
  await app.ready();

  const superAdminToken = app.jwt.sign({
    id: 99,
    role: "SUPER_ADMIN",
    type: "staff",
    sessionVersion: 0,
  });

  const waiterToken = app.jwt.sign({
    id: 50,
    role: "WAITER",
    type: "staff",
    sessionVersion: 0,
  });

  return { app, mockPrisma, presenceManager, superAdminToken, waiterToken };
};

test("Super Admin Customer Presence APIs — Security & Functional Audit", async (t) => {
  const { app, presenceManager, superAdminToken, waiterToken } = await buildTestApp();

  await t.test("1. Unauthorized request (no token) -> Rejected 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test("2. Non-SuperAdmin role (WAITER) -> Forbidden 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${waiterToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  await t.test("3. Authorized Super Admin -> Returns aggregate presence counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.totalCustomers, 2);
    assert.equal(body.onlineCustomers, 0);
    assert.equal(body.offlineCustomers, 2);
  });

  await t.test("4. Alias /api/superadmin/customers/presence works identically", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/superadmin/customers/presence",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.totalCustomers, 2);
  });

  await t.test("5. Realtime presence reflection in aggregate endpoint", async () => {
    // Connect Customer 1
    await presenceManager.handleCustomerConnected(1, { id: "test-socket-1" });

    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.totalCustomers, 2);
    assert.equal(body.onlineCustomers, 1);
    assert.equal(body.offlineCustomers, 1);
  });

  await t.test("6. Individual presence endpoint /super-admin/customers/:id/presence", async () => {
    // Customer 1 is online
    const resOnline = await app.inject({
      method: "GET",
      url: "/super-admin/customers/1/presence",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(resOnline.statusCode, 200);
    const bodyOnline = JSON.parse(resOnline.body);
    assert.equal(bodyOnline.customerId, 1);
    assert.equal(bodyOnline.isOnline, true);
    assert.ok(bodyOnline.lastSeenAt);

    // Customer 2 is offline
    const resOffline = await app.inject({
      method: "GET",
      url: "/super-admin/customers/2/presence",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(resOffline.statusCode, 200);
    const bodyOffline = JSON.parse(resOffline.body);
    assert.equal(bodyOffline.customerId, 2);
    assert.equal(bodyOffline.isOnline, false);
  });

  await t.test("7. GET /super-admin/customers includes presence fields (isOnline, lastSeenAt)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.customers));
    assert.equal(body.customers.length, 2);

    const c1 = body.customers.find((c) => c.id === 1);
    assert.ok(c1);
    assert.equal(c1.isOnline, true);
    assert.ok(c1.lastSeenAt);

    const c2 = body.customers.find((c) => c.id === 2);
    assert.ok(c2);
    assert.equal(c2.isOnline, false);

    assert.equal(body.summary.totalCustomers, 2);
    assert.equal(body.summary.onlineCustomers, 1);
    assert.equal(body.summary.offlineCustomers, 1);
  });

  await app.close();
});
