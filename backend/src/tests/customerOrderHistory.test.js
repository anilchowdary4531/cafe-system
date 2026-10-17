import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import prisma from "../prisma.js";
import customerRoutes from "../routes/customer.js";

describe("Customer Order History & Phone Format Matching Tests", () => {
  let app;
  let testRestaurant;
  let testOrder10;
  let testOrder12;
  const testPhone10 = "9988112233";
  const testPhone12 = "919988112233";
  const otherCustomerPhone = "919988998899";
  const emptyCustomerPhone = "919911991199";
  const jwtSecret = "test-customer-order-history-secret-123";

  before(async () => {
    app = Fastify({ logger: false });
    await app.register(jwt, { secret: jwtSecret });
    await app.register(customerRoutes);
    await app.ready();

    // Create a dedicated test restaurant
    const timestamp = Date.now();
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: `Order History Test Rest ${timestamp}`,
        slug: `order-history-test-rest-${timestamp}`,
      },
    });

    // Create an order saved with 10-digit phone
    testOrder10 = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-TEST-10-${timestamp}`,
        phone: testPhone10,
        subtotal: 100,
        total: 105,
        status: "PLACED",
      },
    });

    // Create an order saved with 12-digit phone
    testOrder12 = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-TEST-12-${timestamp}`,
        phone: testPhone12,
        subtotal: 200,
        total: 210,
        status: "PREPARING",
      },
    });
  });

  after(async () => {
    try {
      if (testOrder10) await prisma.order.deleteMany({ where: { id: testOrder10.id } });
      if (testOrder12) await prisma.order.deleteMany({ where: { id: testOrder12.id } });
      if (testRestaurant) await prisma.restaurant.deleteMany({ where: { id: testRestaurant.id } });
    } catch {
      // ignore cleanup errors
    }
  });

  it("1. customer orders with 12-digit phone query finds both 10-digit and 12-digit format orders", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.phone, testPhone12);
    assert.ok(Array.isArray(body.groups));
    const restaurantGroup = body.groups.find((g) => g.restaurant?.id === testRestaurant.id);
    assert.ok(restaurantGroup, "Group for test restaurant should be found");
    const orderNos = restaurantGroup.orders.map((o) => o.orderNo);
    assert.ok(orderNos.includes(testOrder10.orderNo), "Order stored as 10-digit should be returned");
    assert.ok(orderNos.includes(testOrder12.orderNo), "Order stored as 12-digit should be returned");
  });

  it("2. customer orders with 10-digit phone query finds both 10-digit and 12-digit format orders", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone10}`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.phone, testPhone12); // normalized to 12-digit
    assert.ok(Array.isArray(body.groups));
    const restaurantGroup = body.groups.find((g) => g.restaurant?.id === testRestaurant.id);
    assert.ok(restaurantGroup, "Group for test restaurant should be found");
    const orderNos = restaurantGroup.orders.map((o) => o.orderNo);
    assert.ok(orderNos.includes(testOrder10.orderNo));
    assert.ok(orderNos.includes(testOrder12.orderNo));
  });

  it("3. customer with no orders returns HTTP 200 and groups: []", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/customer/orders?phone=${emptyCustomerPhone}`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.phone, emptyCustomerPhone);
    assert.deepEqual(body.groups, []);
  });

  it("4. authenticated customer isolation: authenticated token phone is authoritative over query param", async () => {
    const customerToken = app.jwt.sign({
      type: "customer",
      phone: emptyCustomerPhone,
      customerAccountId: 9999,
    });

    // Attempt to spoof query param with another customer phone that has orders
    const res = await app.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    // Effective phone should be the authenticated customer phone
    assert.equal(body.phone, emptyCustomerPhone);
    // Since authenticated customer has no orders, groups should be empty (isolated)
    assert.deepEqual(body.groups, []);
  });

  it("5. missing phone without authentication returns HTTP 400 Phone number is required", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/customer/orders",
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Phone number is required");
  });

  it("5b. invalid/expired token returns HTTP 401 Unauthorized", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
      headers: {
        authorization: "Bearer invalid.expired.token",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Unauthorized");
  });

  it("6. database/query failure returns safe HTTP 500 without leaking internals", async () => {
    const failingApp = Fastify({ logger: false });
    const mockPrisma = {
      order: {
        findMany: async () => {
          throw new Error("Simulated database connection failure");
        },
      },
    };

    await failingApp.register(customerRoutes, { prisma: mockPrisma });
    await failingApp.ready();

    const res = await failingApp.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Failed to fetch customer orders");
    assert.equal(body.stack, undefined);
    assert.equal(body.error, undefined);
  });

  it("7. transient Prisma connection error: attempt 1 fails with P1017, attempt 2 succeeds, returns 200 after exactly 2 attempts", async () => {
    const transientApp = Fastify({ logger: false });
    let attempts = 0;
    const mockPrisma = {
      order: {
        findMany: async () => {
          attempts++;
          if (attempts === 1) {
            const err = new Error("Server has closed the connection");
            err.code = "P1017";
            throw err;
          }
          return [];
        },
      },
    };

    await transientApp.register(customerRoutes, { prisma: mockPrisma });
    await transientApp.ready();

    const res = await transientApp.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(attempts, 2, "Transient error must be retried exactly once (total 2 attempts)");
    const body = JSON.parse(res.body);
    assert.deepEqual(body.groups, []);
  });

  it("7b. transient Prisma connection error: attempt 1 fails with P1001, attempt 2 succeeds, returns 200 after exactly 2 attempts", async () => {
    const transientApp = Fastify({ logger: false });
    let attempts = 0;
    const mockPrisma = {
      order: {
        findMany: async () => {
          attempts++;
          if (attempts === 1) {
            const err = new Error("Can't reach database server at localhost:5432");
            err.code = "P1001";
            throw err;
          }
          return [];
        },
      },
    };

    await transientApp.register(customerRoutes, { prisma: mockPrisma });
    await transientApp.ready();

    const res = await transientApp.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(attempts, 2, "P1001 transient error must retry once and succeed");
    const body = JSON.parse(res.body);
    assert.deepEqual(body.groups, []);
  });

  it("7c. transient Prisma connection error: attempt 1 fails with P2024 pool timeout, attempt 2 succeeds, returns 200 after exactly 2 attempts", async () => {
    const transientApp = Fastify({ logger: false });
    let attempts = 0;
    const mockPrisma = {
      order: {
        findMany: async () => {
          attempts++;
          if (attempts === 1) {
            const err = new Error("Timed out fetching a new connection from the connection pool");
            err.code = "P2024";
            throw err;
          }
          return [];
        },
      },
    };

    await transientApp.register(customerRoutes, { prisma: mockPrisma });
    await transientApp.ready();

    const res = await transientApp.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(attempts, 2, "P2024 pool timeout must retry once and succeed");
    const body = JSON.parse(res.body);
    assert.deepEqual(body.groups, []);
  });

  it("8. persistent Prisma connection error: both attempts fail with P1017, returns 500 with max 2 attempts", async () => {
    const persistentApp = Fastify({ logger: false });
    let attempts = 0;
    const mockPrisma = {
      order: {
        findMany: async () => {
          attempts++;
          const err = new Error("Connection pool timeout");
          err.code = "P2024";
          throw err;
        },
      },
    };

    await persistentApp.register(customerRoutes, { prisma: mockPrisma });
    await persistentApp.ready();

    const res = await persistentApp.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 500);
    assert.equal(attempts, 2, "Persistent transient error must retry exactly once (total 2 attempts maximum)");
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Failed to fetch customer orders");
  });

  it("9. non-transient error: returns 500 with NO retry (exactly 1 attempt)", async () => {
    const nonTransientApp = Fastify({ logger: false });
    let attempts = 0;
    const mockPrisma = {
      order: {
        findMany: async () => {
          attempts++;
          const err = new Error("Unknown field in where clause");
          err.code = "P2002"; // unique constraint or non-connection error
          throw err;
        },
      },
    };

    await nonTransientApp.register(customerRoutes, { prisma: mockPrisma });
    await nonTransientApp.ready();

    const res = await nonTransientApp.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 500);
    assert.equal(attempts, 1, "Non-transient error must not be retried (exactly 1 attempt)");
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Failed to fetch customer orders");
  });

  it("10. response contract remains { phone, groups } with stats and restaurant info", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/customer/orders?phone=${testPhone12}`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok("phone" in body);
    assert.ok("groups" in body);
    const group = body.groups.find((g) => g.restaurant?.id === testRestaurant.id);
    assert.ok(group.stats);
    assert.equal(typeof group.stats.totalOrders, "number");
    assert.equal(typeof group.stats.totalSpend, "number");
    assert.equal(typeof group.stats.activeOrders, "number");
    assert.ok(Array.isArray(group.orders));
  });
});
