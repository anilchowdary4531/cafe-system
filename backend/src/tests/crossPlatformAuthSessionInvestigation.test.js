import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { verifyAuth } from "../middleware/auth.js";

const TEST_JWT_SECRET = "cross_platform_auth_session_test_secret_key_2026";

const buildTestApp = async (secret = TEST_JWT_SECRET) => {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret });

  app.decorateRequest("staffActor", null);

  app.get("/api/staff-protected", async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, { prisma });
    if (!actor) return;
    return { ok: true, actor };
  });

  app.get("/api/auth-protected", { preHandler: [verifyAuth] }, async (req, reply) => {
    return { ok: true, user: req.user };
  });

  await app.ready();
  return app;
};

test("Cross-Platform Authentication Session Investigation Test Suite", async (t) => {
  const app = await buildTestApp();

  let testUser;
  t.before(async () => {
    const uniqueEmail = `session_investigation_${Date.now()}@tiffzytest.com`;
    testUser = await prisma.user.create({
      data: {
        email: uniqueEmail,
        password: "hashed_dummy_password",
        role: "OWNER",
        name: "Investigation Owner",
        phone: "+919999888877",
        isActive: true,
        sessionVersion: 1,
      },
    });
  });

  t.after(async () => {
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await app.close();
  });

  await t.test("A. Valid token returns 200 OK and resolves staff actor", async () => {
    const validToken = app.jwt.sign({
      id: testUser.id,
      role: "OWNER",
      type: "staff",
      sessionVersion: 1,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${validToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.actor.userId, testUser.id);
  });

  await t.test("B. Expired token returns 401 with structured TOKEN_EXPIRED code", async () => {
    // Generate a token already expired (exp in the past)
    const expiredToken = app.jwt.sign({
      id: testUser.id,
      role: "OWNER",
      type: "staff",
      sessionVersion: 1,
      exp: Math.floor(Date.now() / 1000) - 100,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.code, "TOKEN_EXPIRED");
  });

  await t.test("C. Invalid signature returns 401 with structured INVALID_TOKEN code", async () => {
    const rogueApp = Fastify();
    await rogueApp.register(fastifyJwt, { secret: "different_secret_key" });
    const invalidSignatureToken = rogueApp.jwt.sign({
      id: testUser.id,
      role: "OWNER",
      type: "staff",
      sessionVersion: 1,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${invalidSignatureToken}` },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.code, "INVALID_TOKEN");
  });

  await t.test("D. Missing token returns 401 with structured code", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/staff-protected",
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.code, "INVALID_TOKEN");
  });

  await t.test("E. SessionVersion mismatch returns 401 with SESSION_VERSION_MISMATCH code", async () => {
    // DB has sessionVersion = 1, token has sessionVersion = 0
    const staleVersionToken = app.jwt.sign({
      id: testUser.id,
      role: "OWNER",
      type: "staff",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${staleVersionToken}` },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.code, "SESSION_VERSION_MISMATCH");
    assert.equal(body.message, "Session expired. Please log in again.");
  });

  await t.test("F. Backend restart simulation: unexpired token remains valid across server re-instantiations", async () => {
    const serverA = await buildTestApp(TEST_JWT_SECRET);
    const tokenFromA = serverA.jwt.sign({
      id: testUser.id,
      role: "OWNER",
      type: "staff",
      sessionVersion: 1,
    });

    // Simulate server restart (new Fastify instance created with same JWT_SECRET)
    const serverB = await buildTestApp(TEST_JWT_SECRET);
    const res = await serverB.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${tokenFromA}` },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
    await serverA.close();
    await serverB.close();
  });

  await t.test("G. Multi-process simulation: token signed by Worker 1 verifies identically on Worker 2", async () => {
    const worker1 = await buildTestApp(TEST_JWT_SECRET);
    const worker2 = await buildTestApp(TEST_JWT_SECRET);

    const tokenFromWorker1 = worker1.jwt.sign({
      id: testUser.id,
      role: "OWNER",
      type: "staff",
      sessionVersion: 1,
    });

    const resFromWorker2 = await worker2.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${tokenFromWorker1}` },
    });

    assert.equal(resFromWorker2.statusCode, 200);
    assert.equal(resFromWorker2.json().ok, true);
    await worker1.close();
    await worker2.close();
  });

  await t.test("H. Role isolation: Customer token is forbidden on staff operational endpoints", async () => {
    const customerToken = app.jwt.sign({
      type: "customer",
      phone: "+919999888877",
      customerAccountId: 9999,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff-protected",
      headers: { authorization: `Bearer ${customerToken}` },
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.json().message, "Staff access required");
  });

  await t.test("I. verifyAuth middleware returns structured TOKEN_EXPIRED on expired tokens", async () => {
    const expiredToken = app.jwt.sign({
      type: "customer",
      phone: "+919999888877",
      exp: Math.floor(Date.now() / 1000) - 100,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/auth-protected",
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.json().code, "TOKEN_EXPIRED");
  });
});
