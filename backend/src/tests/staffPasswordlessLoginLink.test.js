import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { hashStaffLoginToken } from "../services/staffSessionService.js";

test("Secure Passwordless Staff Login Link System — Complete Scenarios (A - P)", async (t) => {
  const app = Fastify();
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET || "test-jwt-secret-key-1234567890" });
  await routes(app, { prisma });
  await app.ready();

  const rand = Math.floor(Math.random() * 1000000);

  // Setup Restaurant A and Restaurant B
  const restaurantA = await prisma.restaurant.create({
    data: {
      name: `Rest A ${rand}`,
      slug: `rest-a-${rand}`,
      currency: "INR",
    },
  });

  const restaurantB = await prisma.restaurant.create({
    data: {
      name: `Rest B ${rand}`,
      slug: `rest-b-${rand}`,
      currency: "INR",
    },
  });

  // Setup Users in Restaurant A
  const ownerA = await prisma.user.create({
    data: {
      name: "Owner A",
      email: `owner_a_${rand}@test.com`,
      phone: `+9198${rand}1`,
      role: "OWNER",
      restaurantId: restaurantA.id,
      password: bcrypt.hashSync("OwnerPass123!", 10),
      sessionVersion: 1,
    },
  });

  const staffA = await prisma.user.create({
    data: {
      name: "Server A",
      email: `server_a_${rand}@test.com`,
      phone: `+9198${rand}2`,
      role: "WAITER",
      designation: "Server",
      restaurantId: restaurantA.id,
      password: bcrypt.hashSync("ServerPass123!", 10),
      sessionVersion: 1,
      isActive: true,
    },
  });

  const chefA = await prisma.user.create({
    data: {
      name: "Chef A",
      email: `chef_a_${rand}@test.com`,
      phone: `+9198${rand}3`,
      role: "CHEF",
      designation: "Chef",
      restaurantId: restaurantA.id,
      password: bcrypt.hashSync("ChefPass123!", 10),
      sessionVersion: 1,
      isActive: true,
    },
  });

  const seniorChefA = await prisma.user.create({
    data: {
      name: "Senior Chef A",
      email: `sr_chef_${rand}@test.com`,
      phone: `+9198${rand}6`,
      role: "CHEF",
      designation: "Senior Chef",
      restaurantId: restaurantA.id,
      password: bcrypt.hashSync("SrChefPass123!", 10),
      sessionVersion: 1,
      isActive: true,
    },
  });

  const managerA = await prisma.user.create({
    data: {
      name: "Manager A",
      email: `manager_${rand}@test.com`,
      phone: `+9198${rand}7`,
      role: "MANAGER",
      designation: "Manager",
      restaurantId: restaurantA.id,
      password: bcrypt.hashSync("ManagerPass123!", 10),
      sessionVersion: 1,
      isActive: true,
    },
  });

  // Setup Users in Restaurant B
  const ownerB = await prisma.user.create({
    data: {
      name: "Owner B",
      email: `owner_b_${rand}@test.com`,
      phone: `+9198${rand}4`,
      role: "OWNER",
      restaurantId: restaurantB.id,
      password: bcrypt.hashSync("OwnerBPass123!", 10),
      sessionVersion: 1,
    },
  });

  const staffB = await prisma.user.create({
    data: {
      name: "Server B",
      email: `server_b_${rand}@test.com`,
      phone: `+9198${rand}5`,
      role: "WAITER",
      designation: "Server",
      restaurantId: restaurantB.id,
      password: bcrypt.hashSync("ServerBPass123!", 10),
      sessionVersion: 1,
      isActive: true,
    },
  });

  // Helper tokens
  const ownerAToken = app.jwt.sign({
    id: ownerA.id,
    phone: ownerA.phone,
    role: "OWNER",
    restaurantId: restaurantA.id,
    sessionVersion: 1,
  });

  const ownerBToken = app.jwt.sign({
    id: ownerB.id,
    phone: ownerB.phone,
    role: "OWNER",
    restaurantId: restaurantB.id,
    sessionVersion: 1,
  });

  const staffAToken = app.jwt.sign({
    id: staffA.id,
    phone: staffA.phone,
    role: "WAITER",
    restaurantId: restaurantA.id,
    sessionVersion: 1,
  });

  // Cleanup helper
  t.after(async () => {
    try {
      await prisma.staffLoginToken.deleteMany({
        where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerA.id, staffA.id, chefA.id, seniorChefA.id, managerA.id, ownerB.id, staffB.id] } },
      });
      await prisma.restaurant.deleteMany({
        where: { id: { in: [restaurantA.id, restaurantB.id] } },
      });
    } catch {
      // ignore
    }
  });

  // Scenario A: Owner can generate login link
  let generatedTokenA;
  let generatedUrlA;
  await t.test("A. Owner can generate login link", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.loginUrl, "loginUrl must be present");
    assert.ok(body.token, "raw token must be present in generation response");
    assert.ok(body.expiresAt, "expiresAt must be present");
    assert.equal(body.expiresInMinutes, 10);
    assert.equal(body.singleUse, true);

    generatedTokenA = body.token;
    generatedUrlA = body.loginUrl;
  });

  // Scenario B: Non-owner cannot generate login link
  await t.test("B. Non-owner cannot generate login link", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${chefA.id}/login-link`,
      headers: { authorization: `Bearer ${staffAToken}` }, // WAITER role
    });

    assert.ok(res.statusCode === 401 || res.statusCode === 403, `Expected 401/403 but got ${res.statusCode}`);
  });

  // Scenario J & K: Password never in URL and never returned by endpoint
  await t.test("J & K. Password is never in URL and never returned in response", async () => {
    assert.ok(!generatedUrlA.toLowerCase().includes("password"));
    assert.ok(!generatedUrlA.toLowerCase().includes("initialpass"));
    assert.ok(!generatedUrlA.includes(staffA.password));

    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const body = JSON.parse(res.body);
    assert.equal(body.password, undefined);
    assert.equal(body.passwordHash, undefined);
    // Refresh generatedTokenA with this fresh one
    generatedTokenA = body.token;
  });

  // Scenario L: Token is stored as hash, NOT plaintext in database
  await t.test("L. Token is stored securely as SHA-256 hash at rest, never plaintext", async () => {
    const expectedHash = hashStaffLoginToken(generatedTokenA);
    const tokenInDb = await prisma.staffLoginToken.findUnique({
      where: { tokenHash: expectedHash },
    });

    assert.ok(tokenInDb, "Record must exist by tokenHash");
    assert.equal(tokenInDb.staffId, staffA.id);
    assert.equal(tokenInDb.restaurantId, restaurantA.id);
    assert.equal(tokenInDb.purpose, "STAFF_LOGIN");
    assert.equal(tokenInDb.usedAt, null);

    // Verify raw token is NOT in any text column of the model
    const allTokens = await prisma.staffLoginToken.findMany({
      where: { staffId: staffA.id },
    });
    for (const record of allTokens) {
      assert.notEqual(record.tokenHash, generatedTokenA, "rawToken must NEVER be in tokenHash column");
    }
  });

  // Scenario C, D, I: Correct staff receives authentication without privilege escalation
  let sessionTokenReceived;
  await t.test("C, D & I. Correct staff receives authentication with exact role (no privilege escalation)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: generatedTokenA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Login success");
    assert.ok(body.token, "Must return standard staff session token");
    assert.ok(body.user, "Must return user payload");
    assert.equal(body.user.id, staffA.id);
    assert.equal(body.user.role, "WAITER", "Role must remain exactly WAITER, never escalated to OWNER");
    assert.equal(body.redirectPath, "/server");
    assert.equal(body.user.password, undefined, "User password must NEVER be in user payload");

    sessionTokenReceived = body.token;

    // Verify token record in DB is now atomically marked as used
    const expectedHash = hashStaffLoginToken(generatedTokenA);
    const updatedRecord = await prisma.staffLoginToken.findUnique({
      where: { tokenHash: expectedHash },
    });
    assert.ok(updatedRecord.usedAt !== null, "usedAt must be populated after login");
  });

  // Scenario E: Token cannot be replayed
  await t.test("E. Token cannot be replayed (single-use enforced)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: generatedTokenA },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.message.includes("already been used"), "Must state token already used");
  });

  // Scenario F: Expired token rejected
  await t.test("F. Expired token rejected", async () => {
    // Generate fresh token and expire it manually in DB
    const genRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const { token } = JSON.parse(genRes.body);

    const hash = hashStaffLoginToken(token);
    await prisma.staffLoginToken.update({
      where: { tokenHash: hash },
      data: { expiresAt: new Date(Date.now() - 60000) }, // 1 min in past
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.message.includes("expired"), "Must state token expired");
  });

  // Scenario G: Disabled staff rejected
  await t.test("G. Disabled staff rejected even with unexpired token", async () => {
    // Create token while active
    const genRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${chefA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const { token } = JSON.parse(genRes.body);

    // Deactivate staff
    await prisma.user.update({
      where: { id: chefA.id },
      data: { isActive: false },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token },
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.ok(body.message.toLowerCase().includes("disabled") || body.message.toLowerCase().includes("contact owner"));

    // Reactivate for further tests
    await prisma.user.update({
      where: { id: chefA.id },
      data: { isActive: true },
    });
  });

  // Scenario H: Restaurant isolation
  await t.test("H. Restaurant isolation: Owner A cannot generate for Staff B, and cross-restaurant usage fails", async () => {
    // Owner A attempts to generate link for Staff B (Restaurant B)
    const genRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffB.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    assert.equal(genRes.statusCode, 404, "Owner A cannot generate login link for staff of Restaurant B");

    // Owner B generates link for Staff B
    const genResB = await app.inject({
      method: "POST",
      url: `/owner/${restaurantB.id}/staff/${staffB.id}/login-link`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    assert.equal(genResB.statusCode, 200);
    const { token: tokenB } = JSON.parse(genResB.body);

    // If tokenB record were somehow altered to belong to restaurantA, consumption fails
    const hashB = hashStaffLoginToken(tokenB);
    await prisma.staffLoginToken.update({
      where: { tokenHash: hashB },
      data: { restaurantId: restaurantA.id }, // tamper
    });

    const tamperRes = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: tokenB },
    });
    assert.equal(tamperRes.statusCode, 403, "Tampered restaurant token must return 403");
  });

  // Scenario N: Normal password login still works
  await t.test("N. Normal email + password staff login still works identically", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staffA.email,
        password: "ServerPass123!",
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Login success");
    assert.ok(body.token);
    assert.equal(body.user.id, staffA.id);
  });

  // Scenario O: Multiple staff accounts receive independent tokens
  await t.test("O. Multiple staff accounts receive independent tokens", async () => {
    const res1 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const res2 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${chefA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });

    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 200);

    const token1 = JSON.parse(res1.body).token;
    const token2 = JSON.parse(res2.body).token;

    assert.notEqual(token1, token2, "Tokens must be unique per staff");
    assert.notEqual(hashStaffLoginToken(token1), hashStaffLoginToken(token2));
  });

  // Scenario P: Generating a second link invalidates the previous link
  await t.test("P. Generating a second link invalidates the previous unconsumed link", async () => {
    const res1 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const token1 = JSON.parse(res1.body).token;

    const res2 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${staffA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const token2 = JSON.parse(res2.body).token;

    // Token 1 should now be invalidated
    const use1 = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: token1 },
    });
    assert.equal(use1.statusCode, 401, "First token must be invalidated when a second link is generated");

    // Token 2 should succeed
    const use2 = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: token2 },
    });
    assert.equal(use2.statusCode, 200, "Second token must succeed");
  });

  // Role redirect path verification
  await t.test("Role-based workstation redirect path is correct", async () => {
    // Generate for Chef -> /kitchen
    const chefGen = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${chefA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const chefBody = JSON.parse(chefGen.body);
    const chefToken = chefBody.token;
    assert.ok(chefBody.loginUrl.includes("/login?mode=staff&token="));
    assert.ok(!chefBody.loginUrl.includes("password"));

    const chefRes = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: chefToken },
    });
    assert.equal(chefRes.statusCode, 200);
    const chefAuth = JSON.parse(chefRes.body);
    assert.equal(chefAuth.redirectPath, "/kitchen");
    assert.equal(chefAuth.user.role, "CHEF");
    assert.equal(chefAuth.user.id, chefA.id);
    assert.equal(chefAuth.user.restaurantId, restaurantA.id);

    // Generate for Senior Chef -> /kitchen
    const srChefGen = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${seniorChefA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const srChefBody = JSON.parse(srChefGen.body);
    const srChefToken = srChefBody.token;
    assert.ok(srChefBody.loginUrl.includes("/login?mode=staff&token="));

    const srChefRes = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: srChefToken },
    });
    assert.equal(srChefRes.statusCode, 200);
    const srChefAuth = JSON.parse(srChefRes.body);
    assert.equal(srChefAuth.redirectPath, "/kitchen");
    assert.equal(srChefAuth.user.role, "CHEF");
    assert.equal(srChefAuth.user.designation, "Senior Chef");

    // Generate for Manager -> /owner/staff
    const managerGen = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${managerA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const managerBody = JSON.parse(managerGen.body);
    const managerToken = managerBody.token;
    assert.ok(managerBody.loginUrl.includes("/login?mode=staff&token="));

    const managerRes = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: managerToken },
    });
    assert.equal(managerRes.statusCode, 200);
    const managerAuth = JSON.parse(managerRes.body);
    assert.equal(managerAuth.redirectPath, "/owner/staff");
    assert.equal(managerAuth.user.role, "MANAGER");

    // Attempt to alter token -> must fail
    const tamperedRes = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: managerToken.slice(0, -6) + "ffffff" },
    });
    assert.equal(tamperedRes.statusCode, 401, "Altered token must be rejected");

    // Generate for Owner -> /owner/staff
    const ownerGen = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff/${ownerA.id}/login-link`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const ownerToken = JSON.parse(ownerGen.body).token;

    const ownerRes = await app.inject({
      method: "POST",
      url: "/auth/staff-login-link",
      payload: { token: ownerToken },
    });
    assert.equal(ownerRes.statusCode, 200);
    assert.equal(JSON.parse(ownerRes.body).redirectPath, "/owner/staff");
  });
});
