import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import superAdminRoutes from "../routes/superAdmin.js";

const STAFF_ACCESS_MODULES = ["dashboard", "orders", "menu", "tables", "kitchen", "analytics", "finance", "staff", "settings", "notifications"];

function createMockPrisma() {
  const db = {
    restaurants: [],
    users: [
      { id: 1, name: "Super Admin", email: "admin@tiffzy.com", role: "SUPER_ADMIN", isActive: true, sessionVersion: 0 },
    ],
    staffAccess: [],
  };

  return {
    db,
    restaurant: {
      findUnique: async ({ where }) => db.restaurants.find((r) => r.slug === where.slug) || null,
      findMany: async () => db.restaurants,
    },
    user: {
      findUnique: async ({ where }) => {
        if (where.email) return db.users.find((u) => u.email === where.email) || null;
        if (where.id) return db.users.find((u) => u.id === where.id) || null;
        return null;
      },
    },
    $transaction: async (fn) => {
      const tx = {
        restaurant: {
          create: async ({ data }) => {
            const newRes = { id: db.restaurants.length + 1, createdAt: new Date(), updatedAt: new Date(), ...data };
            db.restaurants.push(newRes);
            return newRes;
          },
        },
        user: {
          create: async ({ data }) => {
            const newUser = { id: db.users.length + 1, createdAt: new Date(), ...data };
            db.users.push(newUser);
            return newUser;
          },
        },
        staffAccess: {
          create: async ({ data }) => {
            const newAccess = { id: db.staffAccess.length + 1, ...data };
            db.staffAccess.push(newAccess);
            return newAccess;
          },
        },
      };
      return await fn(tx);
    },
  };
}

async function buildTestApp(prismaMock) {
  const app = Fastify();
  app.decorateRequest("staffActor", null);
  await app.register(fastifyJwt, { secret: "test-superadmin-secret" });

  await superAdminRoutes(app, { prisma: prismaMock, STAFF_ACCESS_MODULES });
  await app.ready();

  const token = app.jwt.sign({ id: 1, role: "SUPER_ADMIN", type: "staff", sessionVersion: 0 });
  const authHeader = { authorization: `Bearer ${token}` };

  return { app, authHeader };
}

test("Super Admin Create Restaurant Endpoint - Input Validation", async () => {
  const prismaMock = createMockPrisma();
  const { app, authHeader } = await buildTestApp(prismaMock);

  // 1. Missing required fields -> 400
  const res1 = await app.inject({
    method: "POST",
    url: "/super-admin/restaurants",
    headers: authHeader,
    payload: { name: "" },
  });
  assert.equal(res1.statusCode, 400);
  assert.match(res1.json().message, /required/i);

  // 2. Short password -> 400
  const res2 = await app.inject({
    method: "POST",
    url: "/super-admin/restaurants",
    headers: authHeader,
    payload: {
      name: "Cafe Mocha",
      ownerName: "Alice",
      ownerEmail: "alice@mocha.com",
      ownerPassword: "123",
    },
  });
  assert.equal(res2.statusCode, 400);
  assert.match(res2.json().message, /at least 6 characters/i);

  await app.close();
});

test("Super Admin Create Restaurant Endpoint - Duplicate Checks and Creation", async () => {
  const prismaMock = createMockPrisma();
  const { app, authHeader } = await buildTestApp(prismaMock);

  // 1. Successfully create first restaurant
  const payload = {
    name: "Tiffzy Express",
    slug: "tiffzy-express",
    ownerName: "Bob Smith",
    ownerEmail: "bob@tiffzy.com",
    ownerPhone: "9876543210",
    ownerPassword: "secretpassword",
    city: "Hyderabad",
    state: "Telangana",
    defaultTaxPercent: 5,
  };

  const res1 = await app.inject({
    method: "POST",
    url: "/super-admin/restaurants",
    headers: authHeader,
    payload,
  });

  assert.equal(res1.statusCode, 201);
  const data1 = res1.json();
  assert.equal(data1.restaurant.name, "Tiffzy Express");
  assert.equal(data1.restaurant.slug, "tiffzy-express");
  assert.equal(data1.owner.email, "bob@tiffzy.com");
  assert.equal(data1.owner.role, "OWNER");

  // Verify database record creation
  assert.equal(prismaMock.db.restaurants.length, 1);
  assert.equal(prismaMock.db.users.length, 2); // 1 super admin + 1 new owner
  assert.equal(prismaMock.db.staffAccess.length, 1);
  assert.equal(prismaMock.db.staffAccess[0].permissions.dashboard, true);

  // 2. Duplicate slug -> 409
  const res2 = await app.inject({
    method: "POST",
    url: "/super-admin/restaurants",
    headers: authHeader,
    payload: {
      ...payload,
      ownerEmail: "different@tiffzy.com",
    },
  });
  assert.equal(res2.statusCode, 409);
  assert.match(res2.json().message, /slug already exists/i);

  // 3. Duplicate email -> 409
  const res3 = await app.inject({
    method: "POST",
    url: "/super-admin/restaurants",
    headers: authHeader,
    payload: {
      ...payload,
      slug: "brand-new-slug",
    },
  });
  assert.equal(res3.statusCode, 409);
  assert.match(res3.json().message, /owner email already exists/i);

  await app.close();
});

