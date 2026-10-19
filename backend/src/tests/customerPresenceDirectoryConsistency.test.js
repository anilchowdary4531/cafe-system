import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import superAdminRoutes from "../routes/superAdmin.js";
import { CustomerPresenceManager } from "../realtime/presenceManager.js";

const setupConsistencyApp = async () => {
  const app = fastify();
  await app.register(fastifyJwt, { secret: "test-superadmin-secret-2026" });

  const customerAccounts = [
    {
      id: 101,
      name: "Customer Alpha",
      phone: "+919000000001",
      username: "cust_alpha",
      email: "alpha@test.com",
      isOnline: false,
      lastSeenAt: null,
      createdAt: new Date(),
    },
    {
      id: 102,
      name: "Customer Beta",
      phone: "+919000000002",
      username: "cust_beta",
      email: "beta@test.com",
      isOnline: false,
      lastSeenAt: null,
      createdAt: new Date(),
    },
    {
      id: 103,
      name: "Customer Gamma",
      phone: "+919000000003",
      username: "cust_gamma",
      email: "gamma@test.com",
      isOnline: false,
      lastSeenAt: null,
      createdAt: new Date(),
    },
  ];

  const adminUser = {
    id: 1,
    name: "Admin Tester",
    role: "SUPER_ADMIN",
    email: "super@test.com",
    isActive: true,
    sessionVersion: 1,
  };

  const waiterUser = {
    id: 999,
    name: "Waiter Tester",
    role: "WAITER",
    email: "waiter@test.com",
    isActive: true,
    sessionVersion: 1,
  };

  const mockPrisma = {
    user: {
      findUnique: async ({ where }) => [adminUser, waiterUser].find((u) => u.id === where.id) || null,
      findMany: async () => [adminUser, waiterUser],
    },
    customerAccount: {
      findMany: async () => customerAccounts,
      findUnique: async ({ where }) => customerAccounts.find((c) => c.id === where.id) || null,
      count: async () => customerAccounts.length,
      update: async ({ where, data }) => {
        const item = customerAccounts.find((c) => c.id === where.id);
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
    graceMs: 100, // 100ms for fast testing
  });

  app.presenceManager = presenceManager;

  await superAdminRoutes(app, {
    prisma: mockPrisma,
    STAFF_ACCESS_MODULES: ["dashboard", "users", "customers"],
  });

  await app.ready();

  const superToken = app.jwt.sign({
    id: adminUser.id,
    role: "SUPER_ADMIN",
    sessionVersion: 1,
  });

  return { app, presenceManager, superToken, customerAccounts };
};

test("Customer Presence & Directory Strict Consistency Suite", async (t) => {
  const { app, presenceManager, superToken } = await setupConsistencyApp();

  await t.test("1 & 2. Customer socket connects -> customer becomes online", async () => {
    const socket = { id: "sock-alpha-dev1", join: () => {} };
    await presenceManager.handleCustomerConnected(101, socket);

    assert.equal(presenceManager.isCustomerOnline(101), true);
    assert.equal(presenceManager.getOnlineCount(), 1);
  });

  await t.test("3. Presence aggregate returns onlineCustomers = 1, offlineCustomers = 2, totalCustomers = 3", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.totalCustomers, 3);
    assert.equal(body.onlineCustomers, 1);
    assert.equal(body.offlineCustomers, 2);
    // Invariant: total = online + offline
    assert.equal(body.totalCustomers, body.onlineCustomers + body.offlineCustomers);
  });

  await t.test("4. Directory returns same customer as online, with matching summary", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers",
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.summary.totalCustomers, 3);
    assert.equal(body.summary.onlineCustomers, 1);
    assert.equal(body.summary.offlineCustomers, 2);

    const onlineCusts = body.customers.filter((c) => c.isOnline);
    assert.equal(onlineCusts.length, 1);
    assert.equal(onlineCusts[0].id, 101);
    assert.equal(onlineCusts[0].name, "Customer Alpha");
  });

  await t.test("5, 6 & 7. Customer disconnects -> after grace period aggregate becomes 0, directory becomes offline", async () => {
    await presenceManager.handleCustomerDisconnected("sock-alpha-dev1");

    // During grace period (100ms), customer is still online
    assert.equal(presenceManager.isCustomerOnline(101), true);

    // Wait for grace period to expire
    await new Promise((r) => setTimeout(r, 150));

    // After grace period
    assert.equal(presenceManager.isCustomerOnline(101), false);
    assert.equal(presenceManager.getOnlineCount(), 0);

    const presenceRes = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(presenceRes.statusCode, 200);
    const presenceBody = presenceRes.json();
    assert.equal(presenceBody.onlineCustomers, 0);
    assert.equal(presenceBody.offlineCustomers, 3);
    assert.equal(presenceBody.totalCustomers, 3);

    const dirRes = await app.inject({
      method: "GET",
      url: "/super-admin/customers",
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(dirRes.statusCode, 200);
    const dirBody = dirRes.json();
    assert.equal(dirBody.summary.onlineCustomers, 0);
    assert.equal(dirBody.summary.offlineCustomers, 3);
    assert.equal(dirBody.customers.filter((c) => c.isOnline).length, 0);
  });

  await t.test("8. Customer reconnects within grace period -> cancels timer and remains online", async () => {
    const socket1 = { id: "sock-beta-1", join: () => {} };
    await presenceManager.handleCustomerConnected(102, socket1);
    assert.equal(presenceManager.isCustomerOnline(102), true);

    // Disconnect
    await presenceManager.handleCustomerDisconnected("sock-beta-1");
    // Reconnect within grace period with new socket
    const socket2 = { id: "sock-beta-2", join: () => {} };
    await presenceManager.handleCustomerConnected(102, socket2);

    // Wait past initial grace duration
    await new Promise((r) => setTimeout(r, 150));

    // Customer should remain ONLINE
    assert.equal(presenceManager.isCustomerOnline(102), true);
    assert.equal(presenceManager.getOnlineCount(), 1);

    // Clean up
    await presenceManager.handleCustomerLogout(102);
    assert.equal(presenceManager.isCustomerOnline(102), false);
  });

  await t.test("9. Multiple devices count as one customer (1 customer with 2 devices = 1 online count)", async () => {
    const phoneSocket = { id: "sock-gamma-phone", join: () => {} };
    const tabletSocket = { id: "sock-gamma-tablet", join: () => {} };

    await presenceManager.handleCustomerConnected(103, phoneSocket);
    assert.equal(presenceManager.getOnlineCount(), 1);

    // Second device connects for the same customer
    await presenceManager.handleCustomerConnected(103, tabletSocket);
    // Count MUST STILL BE 1
    assert.equal(presenceManager.getOnlineCount(), 1);

    const res = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(res.json().onlineCustomers, 1);

    // One device disconnects, customer remains ONLINE
    await presenceManager.handleCustomerDisconnected("sock-gamma-phone");
    assert.equal(presenceManager.isCustomerOnline(103), true);
    assert.equal(presenceManager.getOnlineCount(), 1);

    // Clean up
    await presenceManager.handleCustomerLogout(103);
    assert.equal(presenceManager.getOnlineCount(), 0);
  });

  await t.test("10. Multiple customers produce correct aggregate (2 customers online)", async () => {
    const socketA = { id: "sock-a", join: () => {} };
    const socketB = { id: "sock-b", join: () => {} };

    await presenceManager.handleCustomerConnected(101, socketA);
    await presenceManager.handleCustomerConnected(102, socketB);

    assert.equal(presenceManager.getOnlineCount(), 2);

    const presenceRes = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${superToken}` },
    });
    const presenceBody = presenceRes.json();
    assert.equal(presenceBody.totalCustomers, 3);
    assert.equal(presenceBody.onlineCustomers, 2);
    assert.equal(presenceBody.offlineCustomers, 1);

    const dirRes = await app.inject({
      method: "GET",
      url: "/super-admin/customers",
      headers: { authorization: `Bearer ${superToken}` },
    });
    const dirBody = dirRes.json();
    assert.equal(dirBody.summary.onlineCustomers, 2);
    assert.equal(dirBody.summary.offlineCustomers, 1);
    assert.equal(dirBody.customers.filter((c) => c.isOnline).length, 2);

    // Clean up
    await presenceManager.handleCustomerLogout(101);
    await presenceManager.handleCustomerLogout(102);
  });

  await t.test("11. Unauthorized Super Admin presence access is blocked", async () => {
    const resNoAuth = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
    });
    assert.equal(resNoAuth.statusCode, 401);

    const waiterToken = app.jwt.sign({
      id: 999,
      role: "WAITER",
      sessionVersion: 1,
    });
    const resForbidden = await app.inject({
      method: "GET",
      url: "/super-admin/customers/presence",
      headers: { authorization: `Bearer ${waiterToken}` },
    });
    assert.equal(resForbidden.statusCode, 403);
  });

  await t.test("12. Stale sockets do not remain online forever", async () => {
    const socket = { id: "sock-stale-test", join: () => {} };
    await presenceManager.handleCustomerConnected(101, socket);
    assert.equal(presenceManager.isCustomerOnline(101), true);

    await presenceManager.handleCustomerDisconnected("sock-stale-test");
    // Wait for grace period
    await new Promise((r) => setTimeout(r, 150));

    assert.equal(presenceManager.isCustomerOnline(101), false);
    assert.equal(presenceManager.getOnlineCount(), 0);
  });
});
