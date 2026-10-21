import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";

test("POST /owner/:restaurantId/staff/:staffId/temp-password - Secure Temporary Password Re-issue", async (t) => {
  const app = Fastify();
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET || "test-jwt-secret-key-1234567890" });
  await routes(app, { prisma });
  await app.ready();

  const randSuffix = Math.floor(Math.random() * 100000);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Temp Pass Rest ${randSuffix}`,
      slug: `temp-pass-rest-${randSuffix}`,
      currency: "INR",
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Owner User",
      email: `owner_${randSuffix}@test.com`,
      phone: "+919999999991",
      role: "OWNER",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("OwnerPass123!", 10),
      sessionVersion: 1,
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: "Server Staff",
      email: `server_${randSuffix}@test.com`,
      phone: "+919999999992",
      role: "WAITER",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("InitialPass123!", 10),
      mustChangePassword: false,
      sessionVersion: 1,
    },
  });

  const chef = await prisma.user.create({
    data: {
      name: "Chef Staff",
      email: `chef_${randSuffix}@test.com`,
      phone: "+919999999993",
      role: "CHEF",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("ChefPass123!", 10),
      sessionVersion: 1,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      name: "Cashier Staff",
      email: `cashier_${randSuffix}@test.com`,
      phone: "+919999999994",
      role: "CASHIER",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("CashierPass123!", 10),
      sessionVersion: 1,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Manager Staff",
      email: `manager_${randSuffix}@test.com`,
      phone: "+919999999995",
      role: "MANAGER",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("ManagerPass123!", 10),
      sessionVersion: 1,
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      name: "Busser Staff",
      email: `busser_${randSuffix}@test.com`,
      phone: "+919999999996",
      role: "WAITER",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("InitialPass123!", 10),
      mustChangePassword: false,
      sessionVersion: 1,
    },
  });

  const ownerToken = app.jwt.sign({
    id: owner.id,
    userId: owner.id,
    email: owner.email,
    role: "OWNER",
    restaurantId: restaurant.id,
    sessionVersion: 1,
  });

  const staffToken = app.jwt.sign({
    id: staff.id,
    userId: staff.id,
    email: staff.email,
    role: "WAITER",
    restaurantId: restaurant.id,
    sessionVersion: 1,
  });

  const chefToken = app.jwt.sign({
    id: chef.id,
    userId: chef.id,
    email: chef.email,
    role: "CHEF",
    restaurantId: restaurant.id,
    sessionVersion: 1,
  });

  const cashierToken = app.jwt.sign({
    id: cashier.id,
    userId: cashier.id,
    email: cashier.email,
    role: "CASHIER",
    restaurantId: restaurant.id,
    sessionVersion: 1,
  });

  const managerToken = app.jwt.sign({
    id: manager.id,
    userId: manager.id,
    email: manager.email,
    role: "MANAGER",
    restaurantId: restaurant.id,
    sessionVersion: 1,
  });

  await t.test("1. WAITER cannot issue temporary passwords (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  await t.test("1b. CHEF cannot issue temporary passwords (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${chefToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  await t.test("1c. CASHIER cannot issue temporary passwords (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  await t.test("1d. MANAGER can issue temporary passwords (200)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff2.id}/temp-password`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.temporaryPassword);
  });

  let issuedTempPassword = "";

  await t.test("2. OWNER can generate temporary password for staff", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.temporaryPassword, "Must return temporaryPassword");
    assert.match(body.temporaryPassword, /^Staff#[a-f0-9]+$/, "Must match format Staff#<hex>");
    issuedTempPassword = body.temporaryPassword;

    // Verify DB state
    const updatedInDb = await prisma.user.findUnique({ where: { id: staff.id } });
    assert.equal(updatedInDb.mustChangePassword, true, "mustChangePassword must be true");
    assert.ok(updatedInDb.temporaryPasswordExpiresAt, "Expiration must be set");
    assert.equal(updatedInDb.sessionVersion, 2, "sessionVersion must be incremented");
    assert.ok(bcrypt.compareSync(issuedTempPassword, updatedInDb.password), "Hash must match temp password");
  });

  await t.test("3. GET staff directory does NOT expose temporary password", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    const foundStaff = body.users.find((u) => u.id === staff.id);
    assert.ok(foundStaff);
    assert.equal(foundStaff.temporaryPassword, undefined, "temporaryPassword must never appear in directory");
    assert.equal(foundStaff.password, undefined, "password must never appear in directory");
    assert.ok(foundStaff.loginLink.includes(`email=${encodeURIComponent(staff.email)}`));
    assert.ok(!foundStaff.loginLink.includes("password"));
  });

  let staffSessionToken = "";

  await t.test("4. Temporary password successfully logs in and requires password change", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staff.email,
        password: issuedTempPassword,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.mustChangePassword, true);
    assert.ok(body.token);
    staffSessionToken = body.token;
  });

  await t.test("5. JWT payload does NOT contain password or password hash", async () => {
    const decoded = app.jwt.decode(staffSessionToken);
    assert.ok(decoded);
    assert.equal(decoded.password, undefined);
    assert.equal(decoded.temporaryPassword, undefined);
    assert.equal(decoded.passwordHash, undefined);
  });

  await t.test("6. Cross-restaurant isolation: Restaurant B cannot reset staff of Restaurant A", async () => {
    const restaurantB = await prisma.restaurant.create({
      data: {
        name: `Rest B ${randSuffix}`,
        slug: `rest-b-${randSuffix}`,
        currency: "INR",
      },
    });
    const ownerB = await prisma.user.create({
      data: {
        name: "Owner B",
        email: `owner_b_${randSuffix}@test.com`,
        phone: "+919999999993",
        role: "OWNER",
        restaurantId: restaurantB.id,
        password: bcrypt.hashSync("OwnerBPass123!", 10),
        sessionVersion: 1,
      },
    });
    const ownerBToken = app.jwt.sign({
      id: ownerB.id,
      userId: ownerB.id,
      email: ownerB.email,
      role: "OWNER",
      restaurantId: restaurantB.id,
      sessionVersion: 1,
    });

    // Owner B tries to reset staff of Restaurant A via restaurant B URL -> 404 Staff not found
    const res1 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantB.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    assert.equal(res1.statusCode, 404);

    // Owner B tries to reset staff of Restaurant A via restaurant A URL -> 403 Forbidden
    const res2 = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    assert.equal(res2.statusCode, 403);

    // Cleanup Restaurant B
    await prisma.user.deleteMany({ where: { restaurantId: restaurantB.id } });
    await prisma.restaurant.delete({ where: { id: restaurantB.id } });
  });

  const permanentPassword = "MyNewPermanentPass123!";

  await t.test("7. Staff member forces new permanent password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: { authorization: `Bearer ${staffSessionToken}` },
      payload: {
        currentPassword: issuedTempPassword,
        newPassword: permanentPassword,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.user?.mustChangePassword, false);

    // Check database state
    const staffFromDb = await prisma.user.findUnique({ where: { id: staff.id } });
    assert.equal(staffFromDb.mustChangePassword, false);
    assert.equal(staffFromDb.temporaryPasswordExpiresAt, null);
    assert.ok(bcrypt.compareSync(permanentPassword, staffFromDb.password));
    // Verify plaintext is not stored
    assert.notEqual(staffFromDb.password, permanentPassword);
  });

  await t.test("8. New permanent password works for subsequent login", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staff.email,
        password: permanentPassword,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.mustChangePassword, false);
    assert.ok(body.token);
  });

  await t.test("9. Old temporary password no longer works", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staff.email,
        password: issuedTempPassword,
      },
    });
    assert.equal(res.statusCode, 401);
  });

  // Cleanup
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.restaurant.delete({ where: { id: restaurant.id } });
  await app.close();
});
