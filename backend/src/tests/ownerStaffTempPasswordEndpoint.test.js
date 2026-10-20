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

  await t.test("1. WAITER cannot issue temporary passwords (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurant.id}/staff/${staff.id}/temp-password`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.statusCode, 403);
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
  });

  // Cleanup
  await prisma.user.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.restaurant.delete({ where: { id: restaurant.id } });
  await app.close();
});
