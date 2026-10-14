import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { logAuditEvent, getAuditLogs, sanitizeAuditDetails, extractRequestMetadata } from "../services/auditLogService.js";
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
  if (normalizedUrl.includes("/audit-logs") || normalizedUrl.includes("/audit")) {
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

async function createPhase3dTestApp({ onOtpGenerated } = {}) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "phase3d-audit-secret-test-key-9999" });

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

test("Phase 3D-1 — Security Audit Logging Backend Suite (47 Requirements)", async (t) => {
  const ts = Date.now();
  const capturedOtps = new Map();

  const app = await createPhase3dTestApp({
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

  // Create test restaurants
  const restaurantA = await prisma.restaurant.create({
    data: {
      name: `Audit Rest A ${ts}`,
      slug: `audit-rest-a-${ts}`,
      email: `audit_a_${ts}@tiffzy.com`,
    },
  });

  const restaurantB = await prisma.restaurant.create({
    data: {
      name: `Audit Rest B ${ts}`,
      slug: `audit-rest-b-${ts}`,
      email: `audit_b_${ts}@tiffzy.com`,
    },
  });

  const defaultPassword = "Password123!";
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);

  // Seed users for Restaurant A
  const ownerA = await prisma.user.create({
    data: {
      name: "Owner A",
      email: `owner_a_${ts}@example.com`,
      phone: `+919111${String(ts).slice(-6)}`,
      password: passwordHash,
      role: "OWNER",
      restaurantId: restaurantA.id,
      isActive: true,
      sessionVersion: 1,
    },
  });

  const managerA = await prisma.user.create({
    data: {
      name: "Manager A",
      email: `manager_a_${ts}@example.com`,
      phone: `+919222${String(ts).slice(-6)}`,
      password: passwordHash,
      role: "MANAGER",
      restaurantId: restaurantA.id,
      isActive: true,
      sessionVersion: 1,
    },
  });

  const waiterA = await prisma.user.create({
    data: {
      name: "Waiter A",
      email: `waiter_a_${ts}@example.com`,
      phone: `+919333${String(ts).slice(-6)}`,
      password: passwordHash,
      role: "WAITER",
      restaurantId: restaurantA.id,
      isActive: true,
      sessionVersion: 1,
    },
  });

  const tempStaffA = await prisma.user.create({
    data: {
      name: "Temp Staff A",
      email: `temp_a_${ts}@example.com`,
      phone: `+919444${String(ts).slice(-6)}`,
      password: passwordHash,
      role: "STAFF",
      restaurantId: restaurantA.id,
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 7 * 86400000),
      sessionVersion: 1,
    },
  });

  // Seed owner for Restaurant B
  const ownerB = await prisma.user.create({
    data: {
      name: "Owner B",
      email: `owner_b_${ts}@example.com`,
      phone: `+919555${String(ts).slice(-6)}`,
      password: passwordHash,
      role: "OWNER",
      restaurantId: restaurantB.id,
      isActive: true,
      sessionVersion: 1,
    },
  });

  // Seed SUPER_ADMIN
  const superAdmin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: `super_${ts}@example.com`,
      phone: `+919666${String(ts).slice(-6)}`,
      password: passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      sessionVersion: 1,
    },
  });

  const getLoginToken = async (email, password = defaultPassword) => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email, password },
    });
    const body = JSON.parse(res.body);
    return body.token;
  };

  // ----------------------------------------------------
  // TEST 1: Existing POS audit logging still works
  // ----------------------------------------------------
  await t.test("1. Existing POS audit logging still works", async () => {
    const log = await logAuditEvent({
      prisma,
      restaurantId: restaurantA.id,
      actor: { id: waiterA.id, name: waiterA.name, role: waiterA.role },
      action: "WAITER_ASSIGNED",
      entity: "TABLE",
      entityId: "101",
      details: { tableNo: "T1", reason: "Standard shift assignment" },
    });

    assert.ok(log?.id);
    assert.equal(log.action, "WAITER_ASSIGNED");
    assert.equal(log.restaurantId, restaurantA.id);

    // Verify other POS actions
    const discountLog = await logAuditEvent({
      prisma,
      restaurantId: restaurantA.id,
      action: "ORDER_DISCOUNT_APPLIED",
      entity: "ORDER",
      entityId: "501",
      details: { discountAmount: 50 },
    });
    assert.ok(discountLog?.id);
    assert.equal(discountLog.action, "ORDER_DISCOUNT_APPLIED");
  });

  // ----------------------------------------------------
  // TEST 2: Successful staff login creates AUTH_LOGIN_SUCCESS
  // ----------------------------------------------------
  await t.test("2. Successful staff login creates AUTH_LOGIN_SUCCESS", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "user-agent": "TiffzyTestBrowser/1.0" },
      payload: { email: waiterA.email, password: defaultPassword },
    });
    assert.equal(res.statusCode, 200);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_LOGIN_SUCCESS",
        entityId: String(waiterA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_LOGIN_SUCCESS audit log must exist");
    assert.equal(log.entity, "USER");
    assert.equal(log.status, "SUCCESS");
    assert.equal(log.severity, "INFO");
    assert.equal(log.userAgent, "TiffzyTestBrowser/1.0");
  });

  // ----------------------------------------------------
  // TEST 3: Failed staff login creates AUTH_LOGIN_FAILURE
  // ----------------------------------------------------
  await t.test("3. Failed staff login creates AUTH_LOGIN_FAILURE", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "user-agent": "TiffzyTestBrowser/1.0" },
      payload: { email: waiterA.email, password: "WrongPassword999!" },
    });
    assert.equal(res.statusCode, 401);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_LOGIN_FAILURE",
        entityId: String(waiterA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_LOGIN_FAILURE audit log must exist");
    assert.equal(log.status, "FAILURE");
    assert.equal(log.severity, "WARN");
    assert.equal(log.details?.reason, "INVALID_CREDENTIALS");
  });

  // ----------------------------------------------------
  // TEST 4: Unknown email does not create fake user audit record
  // ----------------------------------------------------
  await t.test("4. Unknown email does not create fake user audit record", async () => {
    resetAllLimiters();
    const unknownEmail = `totally_unknown_${ts}@nowhere.com`;
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: unknownEmail, password: "SomePassword123!" },
    });
    assert.equal(res.statusCode, 401);

    const fakeLog = await prisma.auditLog.findFirst({
      where: {
        OR: [
          { actorName: { contains: `totally_unknown_${ts}` } },
          { details: { path: ["email"], equals: unknownEmail } },
        ],
      },
    });
    assert.equal(fakeLog, null, "Unknown email must not create an audit record");
  });

  // ----------------------------------------------------
  // TEST 5: Account lock creates AUTH_ACCOUNT_LOCKED
  // ----------------------------------------------------
  await t.test("5. Account lock creates AUTH_ACCOUNT_LOCKED", async () => {
    // Create dedicated user for lockout test
    const lockUser = await prisma.user.create({
      data: {
        name: "Lockout Test User",
        email: `lockout_audit_${ts}@example.com`,
        phone: `+919777${String(ts).slice(-6)}`,
        password: passwordHash,
        role: "STAFF",
        restaurantId: restaurantA.id,
        isActive: true,
      },
    });

    // Send 5 incorrect attempts (threshold is 5)
    for (let i = 0; i < 5; i++) {
      resetAllLimiters();
      await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: lockUser.email, password: "BadPassword!" },
      });
    }

    const lockedLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_ACCOUNT_LOCKED",
        entityId: String(lockUser.id),
      },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(lockedLog, "AUTH_ACCOUNT_LOCKED audit record must be recorded");
    assert.equal(lockedLog.status, "LOCKED");
    assert.equal(lockedLog.severity, "WARN");
    assert.equal(lockedLog.details?.threshold, 5);
  });

  // ----------------------------------------------------
  // TEST 6: Password change creates AUTH_PASSWORD_CHANGED
  // ----------------------------------------------------
  await t.test("6. Password change creates AUTH_PASSWORD_CHANGED", async () => {
    const normalStaff = await prisma.user.create({
      data: {
        name: "Normal Staff",
        email: `normal_change_${ts}@example.com`,
        phone: `+919888${String(ts).slice(-6)}`,
        password: passwordHash,
        role: "STAFF",
        restaurantId: restaurantA.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    const staffToken = await getLoginToken(normalStaff.email, defaultPassword);
    const newPwd = "BrandNewPassword123!";
    const res = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { currentPassword: defaultPassword, newPassword: newPwd },
    });
    assert.equal(res.statusCode, 200);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_PASSWORD_CHANGED",
        entityId: String(normalStaff.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_PASSWORD_CHANGED must be recorded");
    assert.equal(log.status, "SUCCESS");
    assert.equal(log.severity, "INFO");
  });

  // ----------------------------------------------------
  // TEST 7: Forced password change creates AUTH_FORCED_PASSWORD_CHANGE
  // ----------------------------------------------------
  await t.test("7. Forced password change creates AUTH_FORCED_PASSWORD_CHANGE", async () => {
    const forcedToken = await getLoginToken(tempStaffA.email, defaultPassword);
    const res = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: { authorization: `Bearer ${forcedToken}` },
      payload: { currentPassword: defaultPassword, newPassword: "ForcedNewPassword123!" },
    });
    assert.equal(res.statusCode, 200);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_FORCED_PASSWORD_CHANGE",
        entityId: String(tempStaffA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_FORCED_PASSWORD_CHANGE must be recorded");
    assert.equal(log.status, "SUCCESS");
    assert.equal(log.severity, "INFO");
  });

  // ----------------------------------------------------
  // TEST 8: Forgot-password request creates AUTH_PASSWORD_RESET_REQUESTED
  // ----------------------------------------------------
  await t.test("8. Forgot-password request creates AUTH_PASSWORD_RESET_REQUESTED", async () => {
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: managerA.email },
    });
    assert.equal(res.statusCode, 200);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_PASSWORD_RESET_REQUESTED",
        entityId: String(managerA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_PASSWORD_RESET_REQUESTED must be recorded");
    assert.equal(log.status, "SUCCESS");
    assert.equal(log.severity, "INFO");
    assert.equal(log.details?.channel, "email");
  });

  // ----------------------------------------------------
  // TEST 9: OTP sent creates AUTH_OTP_SENT
  // ----------------------------------------------------
  await t.test("9. OTP sent creates AUTH_OTP_SENT", async () => {
    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_OTP_SENT",
        entityId: String(managerA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_OTP_SENT must be recorded");
    assert.equal(log.entity, "OTP");
    assert.equal(log.status, "SUCCESS");
  });

  // ----------------------------------------------------
  // TEST 10: OTP verification creates AUTH_OTP_VERIFIED
  // ----------------------------------------------------
  await t.test("10. OTP verification creates AUTH_OTP_VERIFIED", async () => {
    resetAllLimiters();
    const validOtp = capturedOtps.get(managerA.email.toLowerCase());
    assert.ok(validOtp, "Captured OTP must exist for managerA");

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: managerA.email, otp: validOtp },
    });
    assert.equal(res.statusCode, 200);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_OTP_VERIFIED",
        entityId: String(managerA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_OTP_VERIFIED must be recorded");
    assert.equal(log.status, "SUCCESS");
    assert.equal(log.severity, "INFO");
  });

  // ----------------------------------------------------
  // TEST 11: Invalid OTP creates AUTH_OTP_FAILED
  // ----------------------------------------------------
  await t.test("11. Invalid OTP creates AUTH_OTP_FAILED", async () => {
    resetAllLimiters();
    // Request fresh OTP so session exists
    await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: managerA.email },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: managerA.email, otp: "999999" },
    });
    assert.equal(res.statusCode, 401);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_OTP_FAILED",
        entityId: String(managerA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_OTP_FAILED must be recorded");
    assert.equal(log.status, "FAILURE");
    assert.equal(log.severity, "WARN");
  });

  // ----------------------------------------------------
  // TEST 12: OTP expiry creates AUTH_OTP_EXPIRED where the flow detects expiry
  // ----------------------------------------------------
  await t.test("12. OTP expiry creates AUTH_OTP_EXPIRED where the flow detects expiry", async () => {
    // Upsert expired OTP in db
    await prisma.authOtp.upsert({
      where: { phone_actorType: { phone: managerA.email.toLowerCase(), actorType: "STAFF_PASSWORD_RESET" } },
      update: { expiresAt: new Date(Date.now() - 60000), attempts: 0 },
      create: {
        phone: managerA.email.toLowerCase(),
        actorType: "STAFF_PASSWORD_RESET",
        otpHash: bcrypt.hashSync("123456", 10),
        expiresAt: new Date(Date.now() - 60000),
        attempts: 0,
        lastSentAt: new Date(),
      },
    });

    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify-otp",
      payload: { email: managerA.email, otp: "123456" },
    });
    assert.equal(res.statusCode, 400);

    const log = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_OTP_EXPIRED",
        entityId: String(managerA.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "AUTH_OTP_EXPIRED must be recorded");
    assert.equal(log.status, "FAILURE");
    assert.equal(log.severity, "WARN");
  });

  // ----------------------------------------------------
  // TEST 13 & 14: Password reset creates AUTH_PASSWORD_RESET_COMPLETED & AUTH_SESSION_INVALIDATED
  // ----------------------------------------------------
  await t.test("13 & 14. Password reset creates AUTH_PASSWORD_RESET_COMPLETED & AUTH_SESSION_INVALIDATED", async () => {
    const resetUser = await prisma.user.create({
      data: {
        name: "Reset User",
        email: `reset_test_${ts}@example.com`,
        phone: `+919999${String(ts).slice(-6)}`,
        password: passwordHash,
        role: "STAFF",
        restaurantId: restaurantA.id,
        sessionVersion: 1,
        isActive: true,
      },
    });

    const resetToken = app.jwt.sign(
      {
        purpose: "STAFF_PASSWORD_RESET",
        userId: resetUser.id,
        email: resetUser.email,
        restaurantId: resetUser.restaurantId,
        sessionVersion: resetUser.sessionVersion,
      },
      { expiresIn: "15m" }
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: { resetToken, newPassword: "ResetPassword123!" },
    });
    assert.equal(res.statusCode, 200);

    const completedLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_PASSWORD_RESET_COMPLETED",
        entityId: String(resetUser.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(completedLog, "AUTH_PASSWORD_RESET_COMPLETED must be recorded");
    assert.equal(completedLog.status, "SUCCESS");

    const sessionLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "AUTH_SESSION_INVALIDATED",
        entityId: String(resetUser.id),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(sessionLog, "AUTH_SESSION_INVALIDATED must be recorded");
    assert.equal(sessionLog.details?.reason, "PASSWORD_RESET");
  });

  // ----------------------------------------------------
  // TEST 15 & 16: Temporary password issuance is logged & value is NOT logged
  // ----------------------------------------------------
  let createdStaffId = null;
  await t.test("15 & 16. Temporary password issuance is logged and value is NOT logged", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "New Temp Staff",
        email: `new_temp_${ts}@example.com`,
        phone: `+919001${String(ts).slice(-6)}`,
        role: "WAITER",
        isTemporaryPassword: true,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    createdStaffId = body.user.id;

    const tempIssuedLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_TEMP_PASSWORD_ISSUED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(tempIssuedLog, "STAFF_TEMP_PASSWORD_ISSUED must be logged");
    assert.equal(tempIssuedLog.status, "SUCCESS");

    // Value must not be logged
    const detailsStr = JSON.stringify(tempIssuedLog.details || {});
    assert.equal(detailsStr.includes("Staff#"), false, "Temporary password must not appear in audit details");
    assert.equal(detailsStr.includes("password"), false);
  });

  // ----------------------------------------------------
  // TEST 17: Staff creation is logged (STAFF_CREATED)
  // ----------------------------------------------------
  await t.test("17. Staff creation is logged (STAFF_CREATED)", async () => {
    const createLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_CREATED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(createLog, "STAFF_CREATED must be recorded");
    assert.equal(createLog.entity, "STAFF");
    assert.equal(createLog.actorRole, "OWNER");
    assert.equal(createLog.details?.role, "WAITER");
  });

  // ----------------------------------------------------
  // TEST 18: Staff update is logged (STAFF_UPDATED)
  // ----------------------------------------------------
  await t.test("18. Staff update is logged (STAFF_UPDATED)", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurantA.id}/staff/${createdStaffId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: "Updated Temp Staff Name" },
    });
    assert.equal(res.statusCode, 200);

    const updateLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_UPDATED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(updateLog, "STAFF_UPDATED must be logged");
    assert.equal(updateLog.status, "SUCCESS");
    assert.ok(updateLog.details?.updatedFields?.includes("name"));
  });

  // ----------------------------------------------------
  // TEST 19: Staff role change is logged (STAFF_ROLE_CHANGED)
  // ----------------------------------------------------
  await t.test("19. Staff role change is logged (STAFF_ROLE_CHANGED)", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurantA.id}/staff/${createdStaffId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { role: "CASHIER" },
    });
    assert.equal(res.statusCode, 200);

    const roleLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_ROLE_CHANGED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(roleLog, "STAFF_ROLE_CHANGED must be logged");
    assert.equal(roleLog.details?.previousRole, "WAITER");
    assert.equal(roleLog.details?.newRole, "CASHIER");
  });

  // ----------------------------------------------------
  // TEST 20: Staff permission change is logged (STAFF_ACCESS_UPDATED)
  // ----------------------------------------------------
  await t.test("20. Staff permission change is logged (STAFF_ACCESS_UPDATED)", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restaurantA.id}/staff/${createdStaffId}/access`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { access: { orders: true, billing: true } },
    });
    assert.equal(res.statusCode, 200);

    const accessLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_ACCESS_UPDATED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(accessLog, "STAFF_ACCESS_UPDATED must be logged");
    assert.equal(accessLog.status, "SUCCESS");
    assert.ok(Array.isArray(accessLog.details?.changedModules));
  });

  // ----------------------------------------------------
  // TEST 21: Staff status change is logged (STAFF_STATUS_CHANGED)
  // ----------------------------------------------------
  await t.test("21. Staff status change is logged (STAFF_STATUS_CHANGED)", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "PATCH",
      url: `/owner/${restaurantA.id}/staff/${createdStaffId}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });
    assert.equal(res.statusCode, 200);

    const statusLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_STATUS_CHANGED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(statusLog, "STAFF_STATUS_CHANGED must be logged");
    assert.equal(statusLog.details?.previousStatus, "ACTIVE");
    assert.equal(statusLog.details?.newStatus, "DISABLED");
  });

  // ----------------------------------------------------
  // TEST 22: Staff deletion is logged (STAFF_DELETED)
  // ----------------------------------------------------
  await t.test("22. Staff deletion is logged (STAFF_DELETED)", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "DELETE",
      url: `/owner/${restaurantA.id}/staff/${createdStaffId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);

    const deleteLog = await prisma.auditLog.findFirst({
      where: {
        restaurantId: restaurantA.id,
        action: "STAFF_DELETED",
        entityId: String(createdStaffId),
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(deleteLog, "STAFF_DELETED must be logged");
    assert.equal(deleteLog.status, "SUCCESS");
    assert.equal(deleteLog.actorRole, "OWNER");
  });

  // ----------------------------------------------------
  // TEST 23 to 27: Audit record integrity (restaurantId, actor, entity, severity, status)
  // ----------------------------------------------------
  await t.test("23-27. Audit record schema integrity", async () => {
    const log = await prisma.auditLog.findFirst({
      where: { restaurantId: restaurantA.id, action: "STAFF_CREATED" },
    });
    assert.ok(log);
    assert.equal(log.restaurantId, restaurantA.id, "23. Audit record contains restaurantId");
    assert.equal(log.actorRole, "OWNER", "24. Audit actor role is correct");
    assert.equal(log.entity, "STAFF", "25. Target entity is correct");
    assert.equal(log.severity, "INFO", "26. Severity is correct");
    assert.equal(log.status, "SUCCESS", "27. Status is correct");
  });

  // ----------------------------------------------------
  // TEST 28 & 29: IP address & User-Agent captured safely
  // ----------------------------------------------------
  await t.test("28 & 29. IP address & User-Agent captured safely", async () => {
    const dummyReq = {
      ip: "192.168.1.100",
      headers: { "user-agent": "Mozilla/5.0 SecurityScanner" },
    };
    const meta = extractRequestMetadata(dummyReq);
    assert.equal(meta.ipAddress, "192.168.1.100");
    assert.equal(meta.userAgent, "Mozilla/5.0 SecurityScanner");

    // Also verify persistence in DB
    const log = await logAuditEvent({
      prisma,
      restaurantId: restaurantA.id,
      action: "AUTH_LOGIN_SUCCESS",
      entity: "USER",
      entityId: "123",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    assert.equal(log.ipAddress, "192.168.1.100");
    assert.equal(log.userAgent, "Mozilla/5.0 SecurityScanner");
  });

  // ----------------------------------------------------
  // TEST 30 to 34: Sensitive data scrubbing in audit details
  // ----------------------------------------------------
  await t.test("30-34. Sensitive data scrubbing (password, hash, otp, token, jwt)", () => {
    const dirty = {
      safeField: "value123",
      password: "PlainTextPassword",
      passwordHash: "$2a$10$abcdef...",
      currentPassword: "OldPassword",
      newPassword: "NewPassword",
      otp: "123456",
      otpHash: "$2a$10$xyz...",
      resetToken: "header.payload.signature",
      jwt: "jwt.token.string",
      authorization: "Bearer 123",
      cookie: "session=abc",
      nested: {
        safeNumber: 42,
        secretPassword: "nestedSecret",
        token: "nestedToken",
      },
    };

    const clean = sanitizeAuditDetails(dirty);
    assert.equal(clean.safeField, "value123");
    assert.equal(clean.password, undefined, "30. Password is scrubbed");
    assert.equal(clean.passwordHash, undefined, "31. Password hash is scrubbed");
    assert.equal(clean.otp, undefined, "32. OTP is scrubbed");
    assert.equal(clean.resetToken, undefined, "33. Reset token is scrubbed");
    assert.equal(clean.jwt, undefined, "34. JWT is scrubbed");
    assert.equal(clean.nested.safeNumber, 42);
    assert.equal(clean.nested.secretPassword, undefined);
    assert.equal(clean.nested.token, undefined);
  });

  // ----------------------------------------------------
  // TEST 35: Low-privilege staff cannot access audit API
  // ----------------------------------------------------
  await t.test("35. Low-privilege staff cannot access audit API", async () => {
    const waiterToken = await getLoginToken(waiterA.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs`,
      headers: { authorization: `Bearer ${waiterToken}` },
    });
    assert.equal(res.statusCode, 403, "WAITER role must receive 403");
  });

  // ----------------------------------------------------
  // TEST 36: OWNER can access own restaurant audit logs
  // ----------------------------------------------------
  await t.test("36. OWNER can access own restaurant audit logs", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.logs));
  });

  // ----------------------------------------------------
  // TEST 37: MANAGER can access own restaurant audit logs
  // ----------------------------------------------------
  await t.test("37. MANAGER can access own restaurant audit logs", async () => {
    const managerToken = await getLoginToken(managerA.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
  });

  // ----------------------------------------------------
  // TEST 38: SUPER_ADMIN can access permitted audit logs
  // ----------------------------------------------------
  await t.test("38. SUPER_ADMIN can access permitted audit logs", async () => {
    const superToken = await getLoginToken(superAdmin.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs`,
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
  });

  // ----------------------------------------------------
  // TEST 39: Cross-tenant audit access is rejected
  // ----------------------------------------------------
  await t.test("39. Cross-tenant audit access is rejected", async () => {
    const ownerBToken = await getLoginToken(ownerB.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    assert.equal(res.statusCode, 403, "Owner of Restaurant B cannot access Restaurant A logs");
  });

  // ----------------------------------------------------
  // TEST 40: Audit filters continue working
  // ----------------------------------------------------
  await t.test("40. Audit filters continue working", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs?action=STAFF_CREATED&entity=STAFF&severity=INFO&status=SUCCESS`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.logs.length >= 1);
    for (const l of body.logs) {
      assert.equal(l.action, "STAFF_CREATED");
      assert.equal(l.entity, "STAFF");
      assert.equal(l.severity, "INFO");
      assert.equal(l.status, "SUCCESS");
    }
  });

  // ----------------------------------------------------
  // TEST 41: Audit pagination continues working
  // ----------------------------------------------------
  await t.test("41. Audit pagination continues working", async () => {
    const ownerToken = await getLoginToken(ownerA.email, defaultPassword);
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/audit-logs?limit=2&page=1`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 2);
    assert.ok(body.pagination.total >= 2);
    assert.ok(body.pagination.totalPages >= 1);
    assert.equal(body.logs.length, 2);
  });

  // ----------------------------------------------------
  // TEST 42: Audit logging failure does not break primary login/business operation
  // ----------------------------------------------------
  await t.test("42. Audit logging failure does not break primary login/business operation", async () => {
    // Monkey-patch prisma.auditLog.create to throw an intentional database error
    const originalCreate = prisma.auditLog.create;
    prisma.auditLog.create = async () => {
      throw new Error("Simulated database failure during audit write");
    };

    try {
      resetAllLimiters();
      // Attempt login when auditLog DB write fails
      const res = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: waiterA.email, password: defaultPassword },
      });
      assert.equal(res.statusCode, 200, "Primary login must succeed even if audit log write fails");
      const body = JSON.parse(res.body);
      assert.equal(body.message, "Login success");
    } finally {
      // Restore original create function
      prisma.auditLog.create = originalCreate;
    }
  });

  // ----------------------------------------------------
  // TEST 43: Magic-link authentication remains disabled
  // ----------------------------------------------------
  await t.test("43. Magic-link authentication remains disabled", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-link/consume",
      payload: { token: "some_magic_token" },
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.ok(body.message.includes("discontinued"));
  });

  // ----------------------------------------------------
  // TEST 44: Phase 3A security remains intact
  // ----------------------------------------------------
  await t.test("44. Phase 3A security remains intact", async () => {
    // Generic response on non-existent account
    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: `nonexistent_${ts}@example.com`, password: "password123" },
    });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // ----------------------------------------------------
  // TEST 45: Phase 3B-1 security remains intact (expired temp password)
  // ----------------------------------------------------
  await t.test("45. Phase 3B-1 security remains intact (expired temp password rejected)", async () => {
    const expiredStaff = await prisma.user.create({
      data: {
        name: "Expired Temp Staff",
        email: `expired_temp_${ts}@example.com`,
        phone: `+919002${String(ts).slice(-6)}`,
        password: passwordHash,
        role: "STAFF",
        restaurantId: restaurantA.id,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        isActive: true,
      },
    });

    resetAllLimiters();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: expiredStaff.email, password: defaultPassword },
    });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // ----------------------------------------------------
  // TEST 46: Phase 3B-2 security remains intact (invalid reset token rejected)
  // ----------------------------------------------------
  await t.test("46. Phase 3B-2 security remains intact (tampered reset token rejected)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      payload: { resetToken: "tampered.jwt.token", newPassword: "NewSecretPassword!" },
    });
    assert.equal(res.statusCode, 401);
  });

  // ----------------------------------------------------
  // TEST 47: Phase 3C lockout remains intact (active lockout rejection)
  // ----------------------------------------------------
  await t.test("47. Phase 3C lockout remains intact (locked account rejected without revealing lock)", async () => {
    const lockedAccount = await prisma.user.create({
      data: {
        name: "Active Lock User",
        email: `active_lock_${ts}@example.com`,
        phone: `+919003${String(ts).slice(-6)}`,
        password: passwordHash,
        role: "STAFF",
        restaurantId: restaurantA.id,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        isActive: true,
      },
    });

    resetAllLimiters();
    // Attempt with correct password while locked
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: lockedAccount.email, password: defaultPassword },
    });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // Teardown
  t.after(async () => {
    try {
      await prisma.auditLog.deleteMany({
        where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
      });
      await prisma.user.deleteMany({
        where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: superAdmin.id },
      });
      await prisma.restaurant.deleteMany({
        where: { id: { in: [restaurantA.id, restaurantB.id] } },
      });
    } catch (e) {
      // ignore teardown errors
    }
    await app.close();
  });
});
