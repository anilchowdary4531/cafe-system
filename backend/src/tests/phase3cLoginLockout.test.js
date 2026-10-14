import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import {
  staffLoginRateLimiter,
  staffForgotPasswordRateLimiter,
  staffVerifyOtpRateLimiter,
  staffResetPasswordRateLimiter,
} from "../middleware/rateLimiter.js";

const OWNER_MANAGEMENT_ROLES = ["OWNER", "MANAGER", "SUPER_ADMIN"];
const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];
const STAFF_ACCESS_MODULES = [
  "dashboard", "billing", "orders", "menu", "inventory", "tables", "kitchen",
  "printers", "analytics", "reports", "paylater", "shifts", "supply", "delivery",
  "delivery_partners", "customers", "discounts", "loyalty", "staff", "settings", "notifications"
];

const defaultAccessByRole = (role) => {
  const normalizedRole = String(role || "STAFF").toUpperCase();
  if (normalizedRole === "OWNER") return STAFF_ACCESS_MODULES.reduce((acc, k) => ({ ...acc, [k]: true }), {});
  if (normalizedRole === "MANAGER") return {
    dashboard: true, billing: true, orders: true, menu: true, inventory: true, tables: true,
    kitchen: true, printers: true, analytics: true, reports: true, paylater: true, shifts: true,
    supply: true, delivery: true, delivery_partners: true, customers: true, discounts: true,
    loyalty: true, staff: true, settings: false, notifications: true
  };
  return {
    dashboard: true, billing: false, orders: false, menu: false, inventory: false, tables: false,
    kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
    supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
    loyalty: false, staff: false, settings: false, notifications: true
  };
};

const normalizeAccess = (rawAccess, role) => {
  const fallback = defaultAccessByRole(role);
  if (!rawAccess || typeof rawAccess !== "object") return fallback;
  return STAFF_ACCESS_MODULES.reduce((acc, k) => {
    acc[k] = rawAccess[k] === undefined ? fallback[k] : Boolean(rawAccess[k]);
    return acc;
  }, {});
};

const normalizeDbPermissions = (permissions, role) => {
  let parsed = permissions;
  if (typeof permissions === "string") {
    try { parsed = JSON.parse(permissions); } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== "object") return defaultAccessByRole(role);
  return normalizeAccess(parsed, role);
};

const serializeAccess = (access, role) => JSON.stringify(normalizeAccess(access, role));

const isSensitiveOwnerRoute = (url, method) => {
  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedUrl.includes("/staff")) {
    if (normalizedMethod !== "GET") return true;
  }
  if (normalizedUrl.includes("/finance") || normalizedUrl.includes("/settlements")) {
    return true;
  }
  if (normalizedUrl.includes("/settings") && normalizedMethod !== "GET") {
    return true;
  }
  if (normalizedUrl.includes("/assets") && (normalizedMethod === "DELETE" || normalizedMethod === "POST")) {
    return true;
  }
  return false;
};

async function createPhase3cTestApp({ onOtpGenerated } = {}) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "phase3c-lockout-secret-test-key-7777" });

  const requireOwnerRouteAuth = async (req, reply) => {
    const routeUrl = String(req.routeOptions?.url || req.raw?.url || req.url || "");
    const method = String(req.method || "GET").toUpperCase();
    const isSensitive = isSensitiveOwnerRoute(routeUrl, method);
    const allowedRoles = isSensitive ? OWNER_MANAGEMENT_ROLES : STAFF_ALLOWED_ROLES;

    const actor = await requireStaffJwt(req, reply, {
      prisma,
      allowedRoles,
      matchRestaurantParam: "restaurantId",
    });
    if (!actor) return reply;
    req.staffActor = actor;
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
    io: { to: () => ({ emit: () => {} }) },
    broadcastToRestaurant: () => {},
  };

  const routeDeps = {
    prisma,
    buildQrTargetUrl: (slug, tableNo) => `/menu/${slug}?table=${tableNo}`,
    FRONTEND_URL: "http://localhost:5173",
    STAFF_ACCESS_MODULES,
    STAFF_ALLOWED_ROLES,
    normalizeAccess,
    normalizeDbPermissions,
    serializeAccess,
    realtime: mockRealtime,
    onOtpGenerated,
  };

  await routes(app, routeDeps);
  await app.ready();
  return app;
}

test("Phase 3C — Failed Login Tracking & Account Lockout Security Suite", async (t) => {
  const ts = Date.now();
  const capturedOtps = new Map();

  const app = await createPhase3cTestApp({
    onOtpGenerated: ({ email, otp }) => {
      if (email) capturedOtps.set(email.toLowerCase(), otp);
    },
  });

  const resetAllLimiters = () => {
    staffLoginRateLimiter.reset();
    staffForgotPasswordRateLimiter.reset();
    staffVerifyOtpRateLimiter.reset();
    staffResetPasswordRateLimiter.reset();
  };
  resetAllLimiters();

  // Create test restaurant
  const testRestaurant = await prisma.restaurant.create({
    data: {
      name: `Phase 3C Rest ${ts}`,
      slug: `p3c-rest-${ts}`,
      email: `p3c_${ts}@tiffzy.com`,
    },
  });

  const correctPassword = "CorrectPassword123!";
  const staffEmail = `staff_lockout_${ts}@example.com`;

  // Create staff user
  const staffUser = await prisma.user.create({
    data: {
      name: "Lockout Test Staff",
      email: staffEmail,
      phone: "+919333333333",
      password: bcrypt.hashSync(correctPassword, 10),
      role: "STAFF",
      designation: "Server",
      restaurantId: testRestaurant.id,
      isActive: true,
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
    },
  });

  // TEST 1: Unknown email returns generic invalid credentials response
  await t.test("TEST 1: Unknown email returns generic invalid credentials response", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.1" },
      payload: {
        email: `unknown_user_${ts}@nowhere.com`,
        password: "SomePassword123!",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 2: Unknown email does not create a User/security record
  await t.test("TEST 2: Unknown email does not create a User/security record", async () => {
    const unknown = await prisma.user.findUnique({
      where: { email: `unknown_user_${ts}@nowhere.com` },
    });
    assert.equal(unknown, null);
  });

  // TEST 3: Wrong password increments failedLoginAttempts
  await t.test("TEST 3: Wrong password increments failedLoginAttempts", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.2" },
      payload: {
        email: staffEmail,
        password: "WrongPasswordAttempt1!",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");

    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.failedLoginAttempts, 1);
  });

  // TEST 4: lastFailedLoginAt is recorded
  await t.test("TEST 4: lastFailedLoginAt is recorded", async () => {
    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.ok(userInDb.lastFailedLoginAt instanceof Date, "lastFailedLoginAt should be a Date");
    const diff = Math.abs(Date.now() - userInDb.lastFailedLoginAt.getTime());
    assert.ok(diff < 5000, "lastFailedLoginAt should be approximately current timestamp");
  });

  // TEST 5: Attempts 1–4 do not lock the account
  await t.test("TEST 5: Attempts 1–4 do not lock the account", async () => {
    // Attempt 2
    resetAllLimiters();
    await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.3" },
      payload: { email: staffEmail, password: "WrongPasswordAttempt2!" },
    });
    let userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.failedLoginAttempts, 2);
    assert.equal(userInDb.lockedUntil, null);

    // Attempt 3
    resetAllLimiters();
    await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.4" },
      payload: { email: staffEmail, password: "WrongPasswordAttempt3!" },
    });
    userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.failedLoginAttempts, 3);
    assert.equal(userInDb.lockedUntil, null);

    // Attempt 4
    resetAllLimiters();
    await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.5" },
      payload: { email: staffEmail, password: "WrongPasswordAttempt4!" },
    });
    userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.failedLoginAttempts, 4);
    assert.equal(userInDb.lockedUntil, null);
  });

  // TEST 6: Threshold attempt locks the account
  await t.test("TEST 6: Threshold attempt locks the account", async () => {
    resetAllLimiters();
    // Attempt 5 reaches the threshold (default 5)
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.6" },
      payload: { email: staffEmail, password: "WrongPasswordAttempt5!" },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");

    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.failedLoginAttempts, 5);
    assert.ok(userInDb.lockedUntil instanceof Date, "lockedUntil should be set on reaching threshold");
  });

  // TEST 7: lockedUntil is approximately configured duration in the future
  await t.test("TEST 7: lockedUntil is approximately configured duration in the future", async () => {
    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    const durationMs = 15 * 60 * 1000; // 15 minutes default
    const expectedExpiry = Date.now() + durationMs;
    const diff = Math.abs(userInDb.lockedUntil.getTime() - expectedExpiry);
    assert.ok(diff < 10000, `lockedUntil should be ~15m in future (diff: ${diff}ms)`);
  });

  // TEST 8: Locked account returns generic authentication error
  await t.test("TEST 8: Locked account returns generic authentication error", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.7" },
      payload: { email: staffEmail, password: "WrongPasswordAttempt6!" },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 9: Locked account does not authenticate with the correct password
  await t.test("TEST 9: Locked account does not authenticate with the correct password", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.8" },
      payload: { email: staffEmail, password: correctPassword },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
    assert.equal(body.token, undefined, "Token must not be issued for locked account");
  });

  // TEST 10: Lockout state is not exposed in response
  await t.test("TEST 10: Lockout state is not exposed in response", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.9" },
      payload: { email: staffEmail, password: correctPassword },
    });

    const raw = res.body.toLowerCase();
    assert.ok(!raw.includes("lock"), "Response must not mention locked/lockout");
    assert.ok(!raw.includes("attempt"), "Response must not mention remaining attempts");
    assert.ok(!raw.includes("minute"), "Response must not reveal lockout duration");
    assert.ok(!raw.includes("threshold"), "Response must not reveal threshold");
  });

  // TEST 11: Expired lockout permits login again
  await t.test("TEST 11: Expired lockout permits login again", async () => {
    resetAllLimiters();
    // Simulate expired lock by updating lockedUntil into the past
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { lockedUntil: new Date(Date.now() - 5000) },
    });

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.10" },
      payload: { email: staffEmail, password: correctPassword },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Login success");
    assert.ok(body.token, "Token should be issued after lock expires");
  });

  // TEST 12: Successful login clears failedLoginAttempts
  await t.test("TEST 12: Successful login clears failedLoginAttempts", async () => {
    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.failedLoginAttempts, 0);
  });

  // TEST 13: Successful login clears lastFailedLoginAt
  await t.test("TEST 13: Successful login clears lastFailedLoginAt", async () => {
    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.lastFailedLoginAt, null);
  });

  // TEST 14: Successful login clears lockedUntil
  await t.test("TEST 14: Successful login clears lockedUntil", async () => {
    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(userInDb.lockedUntil, null);
  });

  // TEST 15: Wrong password after lock expiration starts counting again
  await t.test("TEST 15: Wrong password after lock expiration starts counting again", async () => {
    resetAllLimiters();
    // Simulate expired lock on user who reached threshold
    await prisma.user.update({
      where: { id: staffUser.id },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 10000),
      },
    });

    // Wrong password after expiration
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.10.11" },
      payload: { email: staffEmail, password: "WrongAfterExpired!" },
    });

    assert.equal(res.statusCode, 401);
    const userInDb = await prisma.user.findUnique({ where: { id: staffUser.id } });
    // Counter should restart from 1, NOT 6
    assert.equal(userInDb.failedLoginAttempts, 1);
    assert.equal(userInDb.lockedUntil, null);
  });

  // TEST 16: Existing staff IP rate limiter still works
  await t.test("TEST 16: Existing staff IP rate limiter still works", async () => {
    staffLoginRateLimiter.reset();
    const testIp = "192.168.100.50";

    // First 5 attempts from this IP proceed to auth
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/login",
        headers: { "x-forwarded-for": testIp },
        payload: { email: `some_unrelated_${i}@example.com`, password: "pwd" },
      });
      assert.equal(res.statusCode, 401);
    }

    // 6th attempt triggers 429
    const blockedRes = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": testIp },
      payload: { email: `some_unrelated_6@example.com`, password: "pwd" },
    });
    assert.equal(blockedRes.statusCode, 429);
    const body = JSON.parse(blockedRes.body);
    assert.equal(body.error, "Too Many Requests");
  });

  // TEST 17: Account lockout and IP rate limiting operate independently
  await t.test("TEST 17: Account lockout and IP rate limiting operate independently", async () => {
    // Reset staffUser
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
    });

    // 5 different IPs each send 1 failed attempt to the same account
    for (let i = 1; i <= 5; i++) {
      const distinctIp = `172.16.0.${i}`;
      const res = await app.inject({
        method: "POST",
        url: "/login",
        headers: { "x-forwarded-for": distinctIp },
        payload: { email: staffEmail, password: "DistributedAttackPwd!" },
      });
      assert.equal(res.statusCode, 401);
    }

    // The account itself is now locked due to 5 failures across distinct IPs
    const lockedUser = await prisma.user.findUnique({ where: { id: staffUser.id } });
    assert.equal(lockedUser.failedLoginAttempts, 5);
    assert.ok(lockedUser.lockedUntil instanceof Date);

    // A completely clean IP (172.16.0.99) with correct password is still rejected due to account lockout
    const attemptFromCleanIp = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "172.16.0.99" },
      payload: { email: staffEmail, password: correctPassword },
    });
    assert.equal(attemptFromCleanIp.statusCode, 401, "Account lockout must block attempts even from fresh IPs");
  });

  // TEST 18: Temporary-password wrong password increments failure count
  let tempStaffUser;
  const tempPlaintext = "TempPassword123#";
  await t.test("TEST 18: Temporary-password wrong password increments failure count", async () => {
    resetAllLimiters();
    tempStaffUser = await prisma.user.create({
      data: {
        name: "Temp Staff",
        email: `temp_staff_${ts}@example.com`,
        phone: "+919444444444",
        password: bcrypt.hashSync(tempPlaintext, 10),
        role: "WAITER",
        restaurantId: testRestaurant.id,
        isActive: true,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.20.1" },
      payload: {
        email: tempStaffUser.email,
        password: "BadTempPasswordAttempt!",
      },
    });

    assert.equal(res.statusCode, 401);
    const dbUser = await prisma.user.findUnique({ where: { id: tempStaffUser.id } });
    assert.equal(dbUser.failedLoginAttempts, 1);
  });

  // TEST 19: Valid temporary password still triggers Phase 3B-1 password-change workflow
  await t.test("TEST 19: Valid temporary password still triggers Phase 3B-1 password-change workflow", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.20.2" },
      payload: {
        email: tempStaffUser.email,
        password: tempPlaintext,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.mustChangePassword, true);
    assert.equal(body.message, "Password change required");
    assert.ok(body.token);

    // Also verify failedLoginAttempts reset to 0
    const dbUser = await prisma.user.findUnique({ where: { id: tempStaffUser.id } });
    assert.equal(dbUser.failedLoginAttempts, 0);
  });

  // TEST 20: Successful Phase 3B-2 password reset clears lockout state
  await t.test("TEST 20: Successful Phase 3B-2 password reset clears lockout state", async () => {
    resetAllLimiters();
    // Put tempStaffUser into locked state
    await prisma.user.update({
      where: { id: tempStaffUser.id },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Request forgot password OTP
    const forgotRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: tempStaffUser.email },
    });
    assert.equal(forgotRes.statusCode, 200);

    const otp = capturedOtps.get(tempStaffUser.email.toLowerCase());
    assert.ok(otp, "OTP should be captured");

    // Verify OTP
    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: tempStaffUser.email, otp },
    });
    assert.equal(verifyRes.statusCode, 200);
    const { resetToken } = JSON.parse(verifyRes.body);

    // Reset password with token
    const newPermanentPassword = "BrandNewPermanentPassword999!";
    const resetRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: { resetToken, newPassword: newPermanentPassword },
    });
    assert.equal(resetRes.statusCode, 200);

    // Verify lockout state is cleared
    const updatedUser = await prisma.user.findUnique({ where: { id: tempStaffUser.id } });
    assert.equal(updatedUser.failedLoginAttempts, 0);
    assert.equal(updatedUser.lastFailedLoginAt, null);
    assert.equal(updatedUser.lockedUntil, null);
    assert.equal(updatedUser.mustChangePassword, false);
  });

  // TEST 21: Password reset still increments sessionVersion
  await t.test("TEST 21: Password reset still increments sessionVersion", async () => {
    const updatedUser = await prisma.user.findUnique({ where: { id: tempStaffUser.id } });
    assert.ok(updatedUser.sessionVersion > 0, "sessionVersion should be incremented");
  });

  // TEST 22: Deactivated account cannot authenticate
  let deactivatedUser;
  await t.test("TEST 22: Deactivated account cannot authenticate", async () => {
    resetAllLimiters();
    deactivatedUser = await prisma.user.create({
      data: {
        name: "Deactivated Staff",
        email: `deactivated_${ts}@example.com`,
        password: bcrypt.hashSync("ValidPassword123!", 10),
        role: "WAITER",
        restaurantId: testRestaurant.id,
        isActive: false,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.30.1" },
      payload: {
        email: deactivatedUser.email,
        password: "ValidPassword123!",
      },
    });

    // Must not authenticate
    assert.notEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.token, undefined);
  });

  // TEST 23: Deactivated account still returns generic error
  await t.test("TEST 23: Deactivated account still returns generic error", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.30.2" },
      payload: {
        email: deactivatedUser.email,
        password: "WrongPassword123!",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 24: Tenant isolation remains intact
  await t.test("TEST 24: Tenant isolation remains intact", async () => {
    resetAllLimiters();
    const otherRestaurant = await prisma.restaurant.create({
      data: {
        name: `Other Rest ${ts}`,
        slug: `other-rest-${ts}`,
        email: `other_${ts}@tiffzy.com`,
      },
    });

    // Attempting reset with wrong restaurantId is denied
    const otherStaff = await prisma.user.create({
      data: {
        name: "Other Staff",
        email: `other_staff_${ts}@example.com`,
        password: bcrypt.hashSync("Pwd123!", 10),
        role: "STAFF",
        restaurantId: otherRestaurant.id,
      },
    });

    // Request recovery for otherStaff
    const forgotRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: otherStaff.email },
    });
    assert.equal(forgotRes.statusCode, 200);

    const otp = capturedOtps.get(otherStaff.email.toLowerCase());
    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: otherStaff.email, otp },
    });
    const { resetToken } = JSON.parse(verifyRes.body);

    // Mismatched restaurantId
    const resetRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: {
        resetToken,
        newPassword: "BrandNewSecurePassword1!",
        restaurantId: testRestaurant.id, // Mismatch!
      },
    });
    assert.equal(resetRes.statusCode, 403);
    const body = JSON.parse(resetRes.body);
    assert.ok(body.message.includes("Tenant mismatch"));
  });

  // TEST 25: Failed-login fields are not exposed through staff APIs
  await t.test("TEST 25: Failed-login fields are not exposed through staff APIs", async () => {
    resetAllLimiters();
    // Re-enable staffUser and log in
    await prisma.user.update({
      where: { id: staffUser.id },
      data: {
        failedLoginAttempts: 2,
        lastFailedLoginAt: new Date(),
        lockedUntil: null,
      },
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.40.1" },
      payload: { email: staffEmail, password: correctPassword },
    });
    const loginBody = JSON.parse(loginRes.body);
    const token = loginBody.token;

    // Check login user payload
    assert.equal(loginBody.user.failedLoginAttempts, undefined);
    assert.equal(loginBody.user.lastFailedLoginAt, undefined);
    assert.equal(loginBody.user.lockedUntil, undefined);

    // Check profile API
    const profileRes = await app.inject({
      method: "GET",
      url: "/api/staff/profile/me",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(profileRes.statusCode, 200);
    const profileBody = JSON.parse(profileRes.body);
    assert.equal(profileBody.user.failedLoginAttempts, undefined);
    assert.equal(profileBody.user.lastFailedLoginAt, undefined);
    assert.equal(profileBody.user.lockedUntil, undefined);
  });

  // TEST 26: Failed-login fields are not included in JWT claims
  await t.test("TEST 26: Failed-login fields are not included in JWT claims", async () => {
    resetAllLimiters();
    const loginRes = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.40.2" },
      payload: { email: staffEmail, password: correctPassword },
    });
    const loginBody = JSON.parse(loginRes.body);
    const decoded = app.jwt.decode(loginBody.token);

    assert.equal(decoded.failedLoginAttempts, undefined);
    assert.equal(decoded.lastFailedLoginAt, undefined);
    assert.equal(decoded.lockedUntil, undefined);
  });

  // TEST 27: Magic-link authentication remains disabled
  await t.test("TEST 27: Magic-link authentication remains disabled", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-link/consume",
      payload: { token: "some-sample-token" },
    });
    assert.equal(res.statusCode, 403);
  });

  // TEST 28: Phase 1 authorization remains intact
  await t.test("TEST 28: Phase 1 authorization remains intact", async () => {
    // Unauthenticated access to owner routes is blocked
    const res = await app.inject({
      method: "POST",
      url: `/owner/${testRestaurant.id}/staff`,
      payload: { name: "Unauthorized Staff" },
    });
    assert.equal(res.statusCode, 401);
  });

  // TEST 29: Phase 2 Staff Management security remains intact
  await t.test("TEST 29: Phase 2 Staff Management security remains intact", async () => {
    // Owner user creates staff
    const ownerPassword = "OwnerSecurePassword123!";
    const ownerUser = await prisma.user.create({
      data: {
        name: "Owner For Phase 2 Test",
        email: `owner_p2_${ts}@tiffzy.com`,
        password: bcrypt.hashSync(ownerPassword, 10),
        role: "OWNER",
        restaurantId: testRestaurant.id,
      },
    });

    const ownerLoginRes = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.50.1" },
      payload: { email: ownerUser.email, password: ownerPassword },
    });
    const ownerToken = JSON.parse(ownerLoginRes.body).token;

    // Create staff without password -> should auto-generate temporary password
    const createRes = await app.inject({
      method: "POST",
      url: `/owner/${testRestaurant.id}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "New Auto-Temp Staff",
        email: `auto_temp_${ts}@tiffzy.com`,
        phone: "+919555555555",
        role: "WAITER",
      },
    });

    assert.equal(createRes.statusCode, 200);
    const createBody = JSON.parse(createRes.body);
    assert.ok(createBody.temporaryPassword, "Temporary password must be returned once on creation");
    assert.equal(createBody.user.mustChangePassword, true);
    assert.equal(createBody.user.password, undefined, "Password hash must not be exposed");
  });

  // TEST 30: Phase 3A security hardening remains intact
  await t.test("TEST 30: Phase 3A security hardening remains intact", async () => {
    // Plaintext password comparison does NOT succeed
    const userWithHashed = await prisma.user.create({
      data: {
        name: "Hash Staff",
        email: `hash_staff_${ts}@example.com`,
        password: bcrypt.hashSync("RealPass123!", 10),
        role: "STAFF",
        restaurantId: testRestaurant.id,
      },
    });

    // Provide the hash string itself as password (plaintext fallback attack)
    const attackRes = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.60.1" },
      payload: {
        email: userWithHashed.email,
        password: userWithHashed.password,
      },
    });
    assert.equal(attackRes.statusCode, 401, "Hash string as plaintext password must be rejected");
  });

  // TEST 31: Phase 3B-1 temporary-password security remains intact
  await t.test("TEST 31: Phase 3B-1 temporary-password security remains intact", async () => {
    // Expired temporary password rejected
    const expiredTempUser = await prisma.user.create({
      data: {
        name: "Expired Temp Staff",
        email: `expired_temp_${ts}@example.com`,
        password: bcrypt.hashSync("TempPass123!", 10),
        role: "STAFF",
        restaurantId: testRestaurant.id,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() - 10000), // Expired!
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.70.1" },
      payload: {
        email: expiredTempUser.email,
        password: "TempPass123!",
      },
    });
    assert.equal(res.statusCode, 401, "Expired temporary password must be rejected");
  });

  // TEST 32: Phase 3B-2 password-recovery security remains intact
  await t.test("TEST 32: Phase 3B-2 password-recovery security remains intact", async () => {
    resetAllLimiters();
    const recoveryUser = await prisma.user.create({
      data: {
        name: "Recovery User",
        email: `recovery_test_${ts}@example.com`,
        password: bcrypt.hashSync("OldPass123!", 10),
        role: "STAFF",
        restaurantId: testRestaurant.id,
      },
    });

    // Request recovery
    const forgotRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      headers: { "x-forwarded-for": "10.0.90.1" },
      payload: { email: recoveryUser.email },
    });
    assert.equal(forgotRes.statusCode, 200);

    const correctOtp = capturedOtps.get(recoveryUser.email.toLowerCase());
    assert.ok(correctOtp, "captured OTP must exist");

    // Enter wrong OTP 5 times to test attempt limit
    for (let i = 0; i < 5; i++) {
      staffVerifyOtpRateLimiter.reset();
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password/verify-otp",
        headers: { "x-forwarded-for": "10.0.90.2" },
        payload: { email: recoveryUser.email, otp: "000000" },
      });
      assert.equal(res.statusCode, 401, `Attempt ${i + 1} should return 401`);
    }

    // Now 6th attempt (even with correct OTP) is rejected because OTP record hit max attempts
    staffVerifyOtpRateLimiter.reset();
    const finalVerifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      headers: { "x-forwarded-for": "10.0.90.2" },
      payload: { email: recoveryUser.email, otp: correctOtp },
    });
    assert.equal(finalVerifyRes.statusCode, 429);
    const body = JSON.parse(finalVerifyRes.body);
    assert.ok(body.message.toLowerCase().includes("attempts"));
  });
});
