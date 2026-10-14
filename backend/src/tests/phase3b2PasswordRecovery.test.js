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

async function createPhase3b2TestApp({ onOtpGenerated } = {}) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "phase3b2-recovery-secret-test-key-9999" });

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

test("Phase 3B-2 — Staff & Owner Password Recovery & OTP Security Suite", async (t) => {
  const ts = Date.now();
  const capturedOtps = new Map();

  const app = await createPhase3b2TestApp({
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

  // Create test restaurant and accounts
  const testRestaurant = await prisma.restaurant.create({
    data: {
      name: `Phase 3B2 Rest ${ts}`,
      slug: `p3b2-rest-${ts}`,
      email: `p3b2_${ts}@tiffzy.com`,
    },
  });

  const initialStaffPassword = "InitialStaffPassword123!";
  const staffUser = await prisma.user.create({
    data: {
      name: "Recovery Staff",
      email: `staff_rec_${ts}@tiffzy.com`,
      phone: "+919111111111",
      password: bcrypt.hashSync(initialStaffPassword, 10),
      role: "WAITER",
      designation: "WAITER",
      isActive: true,
      restaurantId: testRestaurant.id,
      sessionVersion: 1,
      mustChangePassword: false,
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      name: "Recovery Owner",
      email: `owner_rec_${ts}@tiffzy.com`,
      phone: "+919222222222",
      password: bcrypt.hashSync("OwnerSecret123!", 10),
      role: "OWNER",
      isActive: true,
      restaurantId: testRestaurant.id,
      sessionVersion: 1,
      mustChangePassword: false,
    },
  });

  const getStaffToken = (u) => {
    return app.jwt.sign({
      id: u.id,
      email: u.email,
      role: u.role,
      restaurantId: u.restaurantId,
      branchId: u.branchId || null,
      sessionVersion: u.sessionVersion || 1,
      mustChangePassword: Boolean(u.mustChangePassword),
    });
  };

  const initialStaffToken = getStaffToken(staffUser);

  let validStaffForgotResponse = null;
  let nonExistentForgotResponse = null;
  let staffResetToken = null;

  // TEST 1: Forgot password request for valid staff account
  await t.test("TEST 1: Forgot password request for valid staff account", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });

    assert.equal(res.statusCode, 200);
    validStaffForgotResponse = JSON.parse(res.body);
    assert.equal(
      validStaffForgotResponse.message,
      "If an account exists, recovery instructions have been sent."
    );
  });

  // TEST 2: Forgot password request for nonexistent account
  await t.test("TEST 2: Forgot password request for nonexistent account", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: `nonexistent_${ts}@tiffzy.com` },
    });

    assert.equal(res.statusCode, 200);
    nonExistentForgotResponse = JSON.parse(res.body);
  });

  // TEST 3: Valid and nonexistent responses are indistinguishable
  await t.test("TEST 3: Valid and nonexistent responses are indistinguishable", async () => {
    assert.deepEqual(
      validStaffForgotResponse,
      nonExistentForgotResponse,
      "Responses for existing and nonexistent accounts must be identical"
    );
  });

  // TEST 4: Owner recovery
  await t.test("TEST 4: Owner recovery request succeeds", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: ownerUser.email },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "If an account exists, recovery instructions have been sent.");
    assert.ok(capturedOtps.has(ownerUser.email.toLowerCase()), "OTP must be generated for eligible owner");
  });

  // TEST 5: Staff recovery
  await t.test("TEST 5: Staff recovery request generates OTP", async () => {
    assert.ok(capturedOtps.has(staffUser.email.toLowerCase()), "OTP must be generated for staff user");
  });

  // TEST 6: OTP is hashed in storage
  await t.test("TEST 6: OTP is hashed in storage", async () => {
    const record = await prisma.authOtp.findUnique({
      where: {
        phone_actorType: {
          phone: staffUser.email.toLowerCase(),
          actorType: "STAFF_PASSWORD_RESET",
        },
      },
    });

    assert.ok(record, "AuthOtp DB record must exist");
    assert.ok(record.otpHash.startsWith("$2"), "otpHash in database must be bcrypt hash");
    const sentOtp = capturedOtps.get(staffUser.email.toLowerCase());
    assert.ok(sentOtp, "Captured OTP must exist");
    const matches = bcrypt.compareSync(sentOtp, record.otpHash);
    assert.equal(matches, true, "Bcrypt hash must match sent OTP");
  });

  // TEST 7: OTP is never returned by API
  await t.test("TEST 7: OTP is never returned by API", async () => {
    assert.equal(validStaffForgotResponse.otp, undefined);
    assert.equal(validStaffForgotResponse.devOtp, undefined);
    assert.equal(validStaffForgotResponse.code, undefined);
    assert.equal(validStaffForgotResponse.otpDebug, undefined);
    assert.equal(validStaffForgotResponse.resetToken, undefined);
  });

  // TEST 8: OTP expiry enforced
  await t.test("TEST 8: OTP expiry enforced", async () => {
    resetAllLimiters();
    const sentOtp = capturedOtps.get(staffUser.email.toLowerCase());
    // Simulate expired timestamp in DB
    await prisma.authOtp.update({
      where: {
        phone_actorType: {
          phone: staffUser.email.toLowerCase(),
          actorType: "STAFF_PASSWORD_RESET",
        },
      },
      data: { expiresAt: new Date(Date.now() - 60000) },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: staffUser.email, otp: sentOtp },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.message.toLowerCase().includes("expired"));
  });

  // TEST 9: OTP attempt limit enforced
  await t.test("TEST 9: OTP attempt limit enforced", async () => {
    resetAllLimiters();
    // Clean old OTP and request fresh OTP
    await prisma.authOtp.deleteMany({
      where: { phone: staffUser.email.toLowerCase(), actorType: "STAFF_PASSWORD_RESET" },
    });

    await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });

    // Send 5 invalid attempts
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password/verify-otp",
        payload: { email: staffUser.email, otp: "000000" },
      });
      assert.equal(res.statusCode, 401, `Attempt ${i + 1} must be rejected with 401`);
    }

    // 6th attempt should be blocked with 429
    const sixthRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: staffUser.email, otp: "000000" },
    });
    assert.equal(sixthRes.statusCode, 429, "6th attempt must trigger 429 too many attempts");
  });

  // TEST 10: OTP single-use enforced
  await t.test("TEST 10: OTP single-use enforced", async () => {
    resetAllLimiters();
    await prisma.authOtp.deleteMany({
      where: { phone: staffUser.email.toLowerCase(), actorType: "STAFF_PASSWORD_RESET" },
    });

    await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });
    const freshOtp = capturedOtps.get(staffUser.email.toLowerCase());

    // First verification succeeds
    const firstVerify = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: staffUser.email, otp: freshOtp },
    });
    assert.equal(firstVerify.statusCode, 200);

    // Second verification with same OTP must fail
    const secondVerify = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: staffUser.email, otp: freshOtp },
    });
    assert.notEqual(secondVerify.statusCode, 200, "Reusing single-use OTP must fail");
  });

  // TEST 11: Resend cooldown enforced
  await t.test("TEST 11: Resend cooldown enforced", async () => {
    resetAllLimiters();
    // Request first OTP
    const firstReq = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });
    assert.equal(firstReq.statusCode, 200);

    // Immediate second request within 30s cooldown must return 429
    const secondReq = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });
    assert.equal(secondReq.statusCode, 429, "Immediate resend within cooldown must return 429");
  });

  // Clear cooldown for subsequent tests
  await prisma.authOtp.deleteMany({
    where: { phone: staffUser.email.toLowerCase(), actorType: "STAFF_PASSWORD_RESET" },
  });

  // Request fresh OTP for testing verification
  resetAllLimiters();
  await app.inject({
    method: "POST",
    url: "/api/auth/forgot-password",
    payload: { email: staffUser.email },
  });
  const staffActiveOtp = capturedOtps.get(staffUser.email.toLowerCase());

  // TEST 12: Invalid OTP rejected
  await t.test("TEST 12: Invalid OTP rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: staffUser.email, otp: "999999" },
    });
    assert.equal(res.statusCode, 401);
  });

  // TEST 13: Valid OTP accepted
  await t.test("TEST 13: Valid OTP accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: staffUser.email, otp: staffActiveOtp },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.resetToken, "Response must include resetToken");
    staffResetToken = body.resetToken;
  });

  // TEST 14: Reset authorization cannot access normal APIs
  await t.test("TEST 14: Reset authorization cannot access normal APIs", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${testRestaurant.id}/orders`,
      headers: { authorization: `Bearer ${staffResetToken}` },
    });

    assert.equal(res.statusCode, 403, "Reset token must be denied access to operational APIs");
  });

  // TEST 15: Reset authorization cannot access Owner APIs
  await t.test("TEST 15: Reset authorization cannot access Owner APIs", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${testRestaurant.id}/staff`,
      headers: { authorization: `Bearer ${staffResetToken}` },
    });

    assert.equal(res.statusCode, 403, "Reset token must be denied access to Owner APIs");
  });

  const newStaffPermanentPassword = "NewPermanentStaffPassword123!";
  let currentSessionVersion = staffUser.sessionVersion;

  // TEST 16: Successful password reset
  await t.test("TEST 16: Successful password reset", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: {
        resetToken: staffResetToken,
        newPassword: newStaffPermanentPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
  });

  // Fetch updated user from DB
  const updatedStaffFromDb = await prisma.user.findUnique({ where: { id: staffUser.id } });

  // TEST 17: New password is bcrypt hashed
  await t.test("TEST 17: New password is bcrypt hashed", async () => {
    assert.ok(updatedStaffFromDb.password.startsWith("$2"), "Password must be bcrypt hashed");
    assert.equal(bcrypt.compareSync(newStaffPermanentPassword, updatedStaffFromDb.password), true);
  });

  // TEST 18: mustChangePassword cleared
  await t.test("TEST 18: mustChangePassword cleared", async () => {
    assert.equal(updatedStaffFromDb.mustChangePassword, false);
  });

  // TEST 19: temporaryPasswordExpiresAt cleared
  await t.test("TEST 19: temporaryPasswordExpiresAt cleared", async () => {
    assert.equal(updatedStaffFromDb.temporaryPasswordExpiresAt, null);
  });

  // TEST 20: sessionVersion incremented
  await t.test("TEST 20: sessionVersion incremented", async () => {
    assert.equal(updatedStaffFromDb.sessionVersion, currentSessionVersion + 1);
  });

  // TEST 21: Previous JWT invalidated
  await t.test("TEST 21: Previous JWT invalidated", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${testRestaurant.id}/orders`,
      headers: { authorization: `Bearer ${initialStaffToken}` },
    });

    assert.equal(res.statusCode, 401, "Old JWT must be rejected due to sessionVersion mismatch");
  });

  // TEST 22: Reset authorization consumed
  await t.test("TEST 22: Reset authorization consumed", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: {
        resetToken: staffResetToken,
        newPassword: "AnotherNewPassword123!",
      },
    });

    assert.equal(res.statusCode, 401, "Reusing consumed resetToken must be rejected with 401");
  });

  // TEST 23: Old password no longer works
  await t.test("TEST 23: Old password no longer works", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staffUser.email,
        password: initialStaffPassword,
      },
    });

    assert.equal(res.statusCode, 401, "Old password must be rejected");
  });

  // TEST 24: New password works
  let freshPermanentToken = null;
  await t.test("TEST 24: New password works for login", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staffUser.email,
        password: newStaffPermanentPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.mustChangePassword, false);
    assert.ok(body.token);
    freshPermanentToken = body.token;
  });

  // TEST 25: Disabled account cannot regain access
  await t.test("TEST 25: Disabled account cannot regain access", async () => {
    resetAllLimiters();
    // Disable staff
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { isActive: false },
    });

    // Login rejected
    const loginRes = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: staffUser.email,
        password: newStaffPermanentPassword,
      },
    });
    assert.equal(loginRes.statusCode, 403, "Disabled account cannot log in");

    // Clean old OTP
    await prisma.authOtp.deleteMany({
      where: { phone: staffUser.email.toLowerCase(), actorType: "STAFF_PASSWORD_RESET" },
    });

    // Request recovery for disabled account
    const forgotRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });
    assert.equal(forgotRes.statusCode, 200);

    // No new OTP should have been generated
    const checkOtp = await prisma.authOtp.findUnique({
      where: {
        phone_actorType: {
          phone: staffUser.email.toLowerCase(),
          actorType: "STAFF_PASSWORD_RESET",
        },
      },
    });
    assert.equal(checkOtp, null, "Disabled account must not be issued recovery OTP");
  });

  // TEST 26: Disabled account response remains generic
  await t.test("TEST 26: Disabled account response remains generic", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: staffUser.email },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "If an account exists, recovery instructions have been sent.");
  });

  // Re-enable staff for remaining tests
  await prisma.user.update({
    where: { id: staffUser.id },
    data: { isActive: true },
  });

  // TEST 27: Tenant A cannot reset Tenant B account
  await t.test("TEST 27: Tenant A cannot reset Tenant B account", async () => {
    resetAllLimiters();
    const otherRestaurant = await prisma.restaurant.create({
      data: {
        name: `Other Rest ${ts}`,
        slug: `other-rec-${ts}`,
        email: `other_rec_${ts}@tiffzy.com`,
      },
    });

    // Attempt recovery for staffUser (in testRestaurant) specifying otherRestaurant.id
    const crossRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: {
        email: staffUser.email,
        restaurantId: otherRestaurant.id,
      },
    });

    assert.equal(crossRes.statusCode, 200, "Response remains generic to avoid leakage");

    // Clear and check that no OTP was created for staffUser with otherRestaurant
    const record = await prisma.authOtp.findUnique({
      where: {
        phone_actorType: {
          phone: staffUser.email.toLowerCase(),
          actorType: "STAFF_PASSWORD_RESET",
        },
      },
    });
    assert.equal(record, null, "Cross-tenant recovery attempt must not generate OTP");
  });

  // TEST 28: Rate limiting works
  await t.test("TEST 28: Rate limiting works on forgot-password endpoint", async () => {
    resetAllLimiters();
    // 5 allowed requests
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: `random_${i}_${ts}@tiffzy.com` },
      });
      assert.equal(res.statusCode, 200);
    }

    // 6th request within window must return 429
    const limitedRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: `random_6_${ts}@tiffzy.com` },
    });
    assert.equal(limitedRes.statusCode, 429, "6th request must trigger rate limit 429");
  });

  // TEST 29: Magic-link authentication remains disabled
  await t.test("TEST 29: Magic-link authentication remains disabled", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-link/consume",
      payload: { token: "some-magic-token" },
    });

    assert.equal(res.statusCode, 403, "Magic-link consume endpoint must return 403");
  });

  // TEST 30: Phase 1 authorization remains intact
  await t.test("TEST 30: Phase 1 authorization remains intact", async () => {
    const unauthRes = await app.inject({
      method: "POST",
      url: `/owner/${testRestaurant.id}/staff`,
      payload: { name: "Attacker", email: "att@test.com", phone: "+919999999999" },
    });
    assert.equal(unauthRes.statusCode, 401, "Unauthenticated staff creation must fail with 401");
  });

  // TEST 31: Phase 2 Staff Management security remains intact
  await t.test("TEST 31: Phase 2 Staff Management security remains intact", async () => {
    const ownerToken = getStaffToken(ownerUser);
    const getStaffRes = await app.inject({
      method: "GET",
      url: `/owner/${testRestaurant.id}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(getStaffRes.statusCode, 200);
    const body = JSON.parse(getStaffRes.body);
    assert.ok(Array.isArray(body.users), "Must return users array");
    for (const u of body.users) {
      assert.equal(u.password, undefined, "Directory must never expose password hash");
      assert.equal(u.temporaryPassword, undefined, "Directory must never expose temporary password");
    }
  });

  // TEST 32: Phase 3A security remains intact
  await t.test("TEST 32: Phase 3A security remains intact", async () => {
    resetAllLimiters();
    const badLoginRes = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: staffUser.email, password: "WrongPassword999!" },
    });
    assert.equal(badLoginRes.statusCode, 401);
    const body = JSON.parse(badLoginRes.body);
    assert.equal(body.message, "Invalid email or password", "Generic error message preserved");
  });

  // TEST 33: Phase 3B-1 temporary-password behavior remains intact
  await t.test("TEST 33: Phase 3B-1 temporary-password behavior remains intact", async () => {
    resetAllLimiters();
    // Create staff with temporary password
    const tempStaff = await prisma.user.create({
      data: {
        name: "Temp Staff",
        email: `temp_${ts}@tiffzy.com`,
        password: bcrypt.hashSync("TempPass123!", 10),
        role: "WAITER",
        isActive: true,
        restaurantId: testRestaurant.id,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    // Logging in with temporary password indicates mustChangePassword = true
    const tempLoginRes = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: tempStaff.email, password: "TempPass123!" },
    });
    assert.equal(tempLoginRes.statusCode, 200);
    const tempLoginBody = JSON.parse(tempLoginRes.body);
    assert.equal(tempLoginBody.mustChangePassword, true);

    // Operational API access blocked before password change
    const blockedRes = await app.inject({
      method: "GET",
      url: `/owner/${testRestaurant.id}/orders`,
      headers: { authorization: `Bearer ${tempLoginBody.token}` },
    });
    assert.equal(blockedRes.statusCode, 403);
    assert.equal(JSON.parse(blockedRes.body).code, "PASSWORD_CHANGE_REQUIRED");

    // Recovering password clears mustChangePassword
    await prisma.authOtp.deleteMany({
      where: { phone: tempStaff.email.toLowerCase(), actorType: "STAFF_PASSWORD_RESET" },
    });
    await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: tempStaff.email },
    });
    const tempRecOtp = capturedOtps.get(tempStaff.email.toLowerCase());

    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: tempStaff.email, otp: tempRecOtp },
    });
    assert.equal(verifyRes.statusCode, 200);
    const recToken = JSON.parse(verifyRes.body).resetToken;

    const resetRes = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: { resetToken: recToken, newPassword: "PermanentAfterRecovery123!" },
    });
    assert.equal(resetRes.statusCode, 200);

    const refreshedTempStaff = await prisma.user.findUnique({ where: { id: tempStaff.id } });
    assert.equal(refreshedTempStaff.mustChangePassword, false, "Recovery must clear mustChangePassword");
    assert.equal(refreshedTempStaff.temporaryPasswordExpiresAt, null, "Recovery must clear expiry");
  });

  // Teardown test data
  try {
    await prisma.authOtp.deleteMany({
      where: {
        phone: { contains: `${ts}` },
      },
    });
    await prisma.staffAccess.deleteMany({
      where: { user: { email: { contains: `${ts}` } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: `${ts}` } },
    });
    await prisma.restaurant.deleteMany({
      where: { slug: { contains: `${ts}` } },
    });
  } catch (err) {
    // ignore cleanup errors
  }

  await app.close();
});
