import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import {
  buildStaffLoginPayload,
  getEffectiveStaffRole,
  inferRoleFromDesignation,
  mapDesignationToSystemRole,
  resolveStaffRedirectPath,
  generateStaffLoginToken,
  consumeStaffLoginToken,
} from "../services/staffSessionService.js";

test("Staff Designation & System Role Canonical Synchronization Flow", async (t) => {
  const app = Fastify();
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET || "test-jwt-secret-key-1234567890" });
  await routes(app, { prisma });
  await app.ready();

  const randSuffix = Math.floor(10000 + Math.random() * 90000);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Canonical Sync Cafe ${randSuffix}`,
      slug: `canonical-sync-${randSuffix}`,
      currency: "INR",
    },
  });

  const otherRestaurant = await prisma.restaurant.create({
    data: {
      name: `Other Cafe ${randSuffix}`,
      slug: `other-cafe-${randSuffix}`,
      currency: "INR",
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Owner Admin",
      email: `owner_${randSuffix}@test.com`,
      phone: "+91998877" + randSuffix,
      role: "OWNER",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("OwnerPass123!", 10),
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

  // Create staff initially as SWIPER
  const staffEmployee = await prisma.user.create({
    data: {
      name: `Worker Employee ${randSuffix}`,
      email: `worker_${randSuffix}@test.com`,
      phone: "+91991122" + randSuffix,
      role: "STAFF",
      designation: "Swiper",
      restaurantId: restaurant.id,
      password: bcrypt.hashSync("WorkerPass123!", 10),
      sessionVersion: 1,
      isActive: true,
    },
  });

  await t.test("1. SWIPER -> CLEANER: designation = CLEANER, role = STAFF, route = /staff/cleaner", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurant.id}/staff/${staffEmployee.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: staffEmployee.name,
        email: staffEmployee.email,
        phone: staffEmployee.phone,
        designation: "Cleaner",
        role: "SWIPER", // Stale draft role passed by frontend
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.message, "Staff user updated");
    assert.equal(body.user.designation, "Cleaner");
    assert.equal(body.user.role, "STAFF", "Role must be canonical STAFF for Cleaner designation");

    // Verify DB
    const dbUser = await prisma.user.findUnique({ where: { id: staffEmployee.id } });
    assert.equal(dbUser.designation, "Cleaner");
    assert.equal(dbUser.role, "STAFF");

    // Verify operational routing
    const effectiveRole = getEffectiveStaffRole(dbUser);
    assert.equal(effectiveRole, "CLEANER");
    assert.equal(resolveStaffRedirectPath(effectiveRole), "/staff/cleaner");
  });

  await t.test("2. CLEANER -> SWIPER: designation = SWIPER, role = STAFF, route = /staff/swiper", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurant.id}/staff/${staffEmployee.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: staffEmployee.name,
        email: staffEmployee.email,
        phone: staffEmployee.phone,
        designation: "Swiper",
        role: "CLEANER", // Stale role from previous state
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.designation, "Swiper");
    assert.equal(body.user.role, "STAFF", "Role must be canonical STAFF for Swiper designation");

    // Verify DB
    const dbUser = await prisma.user.findUnique({ where: { id: staffEmployee.id } });
    assert.equal(dbUser.designation, "Swiper");
    assert.equal(dbUser.role, "STAFF");

    // Verify operational routing
    const effectiveRole = getEffectiveStaffRole(dbUser);
    assert.equal(effectiveRole, "SWIPER");
    assert.equal(resolveStaffRedirectPath(effectiveRole), "/staff/swiper");
  });

  await t.test("3. SERVER -> CLEANER: designation = CLEANER, role = STAFF", async () => {
    // First set staff to Server
    await prisma.user.update({
      where: { id: staffEmployee.id },
      data: { designation: "Server", role: "WAITER" },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurant.id}/staff/${staffEmployee.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: staffEmployee.name,
        email: staffEmployee.email,
        phone: staffEmployee.phone,
        designation: "Cleaner",
        role: "WAITER", // Stale role
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.designation, "Cleaner");
    assert.equal(body.user.role, "STAFF");

    const dbUser = await prisma.user.findUnique({ where: { id: staffEmployee.id } });
    assert.equal(dbUser.designation, "Cleaner");
    assert.equal(dbUser.role, "STAFF");
  });

  await t.test("4. CLEANER -> SERVER: designation = SERVER, role = WAITER", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurant.id}/staff/${staffEmployee.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: staffEmployee.name,
        email: staffEmployee.email,
        phone: staffEmployee.phone,
        designation: "Server",
        role: "STAFF", // Stale role from Cleaner
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.designation, "Server");
    assert.equal(body.user.role, "WAITER");

    const dbUser = await prisma.user.findUnique({ where: { id: staffEmployee.id } });
    assert.equal(dbUser.designation, "Server");
    assert.equal(dbUser.role, "WAITER");
    const effectiveRole = getEffectiveStaffRole(dbUser);
    assert.equal(effectiveRole, "WAITER");
    assert.equal(resolveStaffRedirectPath(effectiveRole), "/server");
  });

  await t.test("5. Staff Directory displays current designation and role consistently", async () => {
    // Set to Cleaner
    await app.inject({
      method: "PUT",
      url: `/owner/${restaurant.id}/staff/${staffEmployee.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { designation: "Cleaner" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurant.id}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    const found = body.users.find((u) => u.id === staffEmployee.id);
    assert.ok(found);
    assert.equal(found.designation, "Cleaner");
    assert.equal(found.role, "STAFF");
    assert.notEqual(found.role, "SWIPER");
  });

  await t.test("6. Profile returns current designation (Cleaner, not Swiper)", async () => {
    const currentStaff = await prisma.user.findUnique({ where: { id: staffEmployee.id } });
    const staffToken = app.jwt.sign({
      id: staffEmployee.id,
      userId: staffEmployee.id,
      email: staffEmployee.email,
      role: "STAFF",
      restaurantId: restaurant.id,
      sessionVersion: currentStaff.sessionVersion,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff/profile/me",
      headers: { authorization: `Bearer ${staffToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.success);
    assert.equal(body.user.designation, "Cleaner");
    assert.notEqual(body.user.designation, "Swiper");
  });

  await t.test("7. Login routing follows current designation via login token consume", async () => {
    const tokenInfo = await generateStaffLoginToken({
      prisma,
      staffId: staffEmployee.id,
      restaurantId: restaurant.id,
      frontendUrl: "http://localhost:5173",
    });

    const consumeRes = await consumeStaffLoginToken({
      prisma,
      app,
      token: tokenInfo.rawToken,
    });

    assert.equal(consumeRes.user.designation, "Cleaner");
    assert.equal(consumeRes.redirectPath, "/staff/cleaner");
  });

  await t.test("8. Existing authorization behavior and tenant isolation remain intact", async () => {
    const otherOwner = await prisma.user.create({
      data: {
        name: "Other Owner",
        email: `other_owner_${randSuffix}@test.com`,
        phone: "+91990011" + randSuffix,
        role: "OWNER",
        restaurantId: otherRestaurant.id,
        password: bcrypt.hashSync("OtherPass123!", 10),
        sessionVersion: 1,
      },
    });

    const otherOwnerToken = app.jwt.sign({
      id: otherOwner.id,
      userId: otherOwner.id,
      email: otherOwner.email,
      role: "OWNER",
      restaurantId: otherRestaurant.id,
      sessionVersion: 1,
    });

    const unauthorizedRes = await app.inject({
      method: "PUT",
      url: `/owner/${otherRestaurant.id}/staff/${staffEmployee.id}`,
      headers: { authorization: `Bearer ${otherOwnerToken}` },
      payload: { designation: "Manager", role: "MANAGER" },
    });

    assert.equal(unauthorizedRes.statusCode, 404);
  });
});
