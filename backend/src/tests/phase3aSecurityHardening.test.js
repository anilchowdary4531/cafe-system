import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { staffLoginRateLimiter } from "../middleware/rateLimiter.js";

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

async function createPhase3aTestApp() {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "phase3a-test-secret-key-12345" });

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
  };

  await routes(app, routeDeps);
  await app.ready();
  return app;
}

test("Phase 3A — Targeted Authentication & Security Hardening Tests", async (t) => {
  const app = await createPhase3aTestApp();
  const ts = Date.now();

  // Reset rate limiter before starting tests
  staffLoginRateLimiter.reset();

  // Create a dedicated test restaurant
  const testRestaurant = await prisma.restaurant.create({
    data: {
      name: `Phase 3A Rest ${ts}`,
      slug: `p3a-rest-${ts}`,
      email: `p3a_${ts}@tiffzy.com`,
    },
  });

  const validPassword = "CorrectPassword123!";
  const validHash = bcrypt.hashSync(validPassword, 10);

  // Helper to create staff user
  const createStaff = async (name, email, role = "STAFF", extra = {}) => {
    return await prisma.user.create({
      data: {
        name,
        email,
        password: extra.password || validHash,
        role,
        restaurantId: testRestaurant.id,
        isActive: extra.isActive !== undefined ? extra.isActive : true,
        designation: extra.designation || null,
        sessionVersion: extra.sessionVersion || 0,
      },
    });
  };

  // Helper to get staff token
  const getStaffToken = (user, role = user.role) => {
    return app.jwt.sign({
      id: user.id,
      phone: user.phone || "",
      role,
      restaurantId: testRestaurant.id,
      branchId: user.branchId || null,
      sessionVersion: user.sessionVersion || 0,
    });
  };

  // TEST 1: Plaintext password fallback no longer works.
  await t.test("TEST 1: Plaintext password fallback no longer works", async () => {
    const plaintextPwd = "UnHashedPassword999";
    const plaintextUser = await createStaff(
      "Plaintext User",
      `plain_${ts}@test.com`,
      "STAFF",
      { password: plaintextPwd } // Not hashed!
    );

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.1" },
      payload: {
        email: plaintextUser.email,
        password: plaintextPwd,
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 2: Valid bcrypt password still works.
  let activeUser = null;
  await t.test("TEST 2: Valid bcrypt password still works", async () => {
    activeUser = await createStaff("Valid User", `valid_${ts}@test.com`, "STAFF");

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.2" },
      payload: {
        email: activeUser.email,
        password: validPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Login success");
    assert.ok(body.token, "Expected token in login response");
    assert.equal(body.user?.email, activeUser.email);
    assert.equal(body.user?.password, undefined, "Password must not be returned");
  });

  // TEST 3: Incorrect password returns: 401 "Invalid email or password"
  await t.test("TEST 3: Incorrect password returns: 401 'Invalid email or password'", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.3" },
      payload: {
        email: activeUser.email,
        password: "WrongPassword999!",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 4: Unknown email returns the SAME: 401 "Invalid email or password"
  await t.test("TEST 4: Unknown email returns the SAME: 401 'Invalid email or password'", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.4" },
      payload: {
        email: `completely_unknown_${ts}@nowhere.com`,
        password: "AnyPassword123!",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 5: Disabled/non-authenticated account cannot be enumerated through different credential responses.
  await t.test("TEST 5: Disabled account with bad password returns 401 'Invalid email or password'", async () => {
    const disabledUser = await createStaff(
      "Disabled User",
      `disabled_${ts}@test.com`,
      "STAFF",
      { isActive: false }
    );

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.5" },
      payload: {
        email: disabledUser.email,
        password: "WrongPassword123!",
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Invalid email or password");
  });

  // TEST 6: Staff password change increments sessionVersion.
  let changePwdUser = null;
  await t.test("TEST 6: Staff password change increments sessionVersion", async () => {
    changePwdUser = await createStaff("Pwd Change User", `pwd_change_${ts}@test.com`, "STAFF", { sessionVersion: 3 });
    const initialToken = getStaffToken(changePwdUser);

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { authorization: `Bearer ${initialToken}` },
      payload: {
        currentPassword: validPassword,
        newPassword: "BrandNewSecurePassword1!",
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);

    const updatedUser = await prisma.user.findUnique({ where: { id: changePwdUser.id } });
    assert.equal(updatedUser.sessionVersion, 4, "sessionVersion must be incremented to 4");
    changePwdUser = updatedUser;
  });

  // TEST 7: Owner password change increments sessionVersion.
  let subordinateUser = null;
  let ownerUser = null;
  await t.test("TEST 7: Owner password change increments sessionVersion", async () => {
    ownerUser = await createStaff("Owner User", `owner_${ts}@test.com`, "OWNER");
    subordinateUser = await createStaff("Subordinate", `sub_${ts}@test.com`, "WAITER", { sessionVersion: 1 });
    const ownerToken = getStaffToken(ownerUser);

    const res = await app.inject({
      method: "PUT",
      url: `/owner/${testRestaurant.id}/staff/${subordinateUser.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        password: "OwnerAssignedPassword1!",
      },
    });

    assert.equal(res.statusCode, 200);
    const updatedSub = await prisma.user.findUnique({ where: { id: subordinateUser.id } });
    assert.equal(updatedSub.sessionVersion, 2, "sessionVersion must be incremented to 2");
    subordinateUser = updatedSub;
  });

  // TEST 8: Role/permission-sensitive staff update invalidates old session.
  await t.test("TEST 8: Role/permission-sensitive staff update invalidates old session", async () => {
    const ownerToken = getStaffToken(ownerUser);
    const targetStaff = await createStaff("Role Target", `role_target_${ts}@test.com`, "WAITER", { sessionVersion: 5 });

    // 1. Updating role increments sessionVersion
    const roleRes = await app.inject({
      method: "PUT",
      url: `/owner/${testRestaurant.id}/staff/${targetStaff.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        role: "MANAGER",
      },
    });
    assert.equal(roleRes.statusCode, 200);
    const afterRole = await prisma.user.findUnique({ where: { id: targetStaff.id } });
    assert.equal(afterRole.sessionVersion, 6, "sessionVersion must increment on role change");

    // 2. Updating access permissions increments sessionVersion
    const accessRes = await app.inject({
      method: "PUT",
      url: `/owner/${testRestaurant.id}/staff/${targetStaff.id}/access`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        access: { billing: true, menu: true },
      },
    });
    assert.equal(accessRes.statusCode, 200);
    const afterAccess = await prisma.user.findUnique({ where: { id: targetStaff.id } });
    assert.equal(afterAccess.sessionVersion, 7, "sessionVersion must increment on access update");

    // 3. Updating non-sensitive profile (name only) does NOT increment sessionVersion
    const nameRes = await app.inject({
      method: "PUT",
      url: `/owner/${testRestaurant.id}/staff/${targetStaff.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Role Target Updated Name",
      },
    });
    assert.equal(nameRes.statusCode, 200);
    const afterName = await prisma.user.findUnique({ where: { id: targetStaff.id } });
    assert.equal(afterName.sessionVersion, 7, "sessionVersion must NOT increment on name-only change");
  });

  // TEST 9: Old JWT is rejected after sessionVersion changes.
  await t.test("TEST 9: Old JWT is rejected after sessionVersion changes", async () => {
    const userToRevoke = await createStaff("Revoke User", `revoke_${ts}@test.com`, "STAFF", { sessionVersion: 10 });
    const oldToken = getStaffToken(userToRevoke);

    // Initial check: token works
    const okRes = await app.inject({
      method: "GET",
      url: "/api/staff/profile/me",
      headers: { authorization: `Bearer ${oldToken}` },
    });
    assert.equal(okRes.statusCode, 200);

    // Increment sessionVersion in DB
    await prisma.user.update({
      where: { id: userToRevoke.id },
      data: { sessionVersion: { increment: 1 } },
    });

    // Old token must now be rejected
    const rejectedRes = await app.inject({
      method: "GET",
      url: "/api/staff/profile/me",
      headers: { authorization: `Bearer ${oldToken}` },
    });
    assert.equal(rejectedRes.statusCode, 401);
    const body = JSON.parse(rejectedRes.body);
    assert.match(body.message, /session expired/i);
  });

  // TEST 10: New login works after password change.
  await t.test("TEST 10: New login works after password change", async () => {
    // Log in with new password set in TEST 6
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.10" },
      payload: {
        email: changePwdUser.email,
        password: "BrandNewSecurePassword1!",
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.token, "New login must return a valid token");

    // The new token works for protected routes
    const profileRes = await app.inject({
      method: "GET",
      url: "/api/staff/profile/me",
      headers: { authorization: `Bearer ${body.token}` },
    });
    assert.equal(profileRes.statusCode, 200);
  });

  // TEST 11: Staff JWT contains an exp claim.
  await t.test("TEST 11: Staff JWT contains an exp claim with 12h expiration", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "10.0.1.11" },
      payload: {
        email: activeUser.email,
        password: validPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const { token } = JSON.parse(res.body);
    const decoded = app.jwt.decode(token);

    assert.ok(decoded, "Token must be decodable");
    assert.ok(decoded.exp, "Staff JWT must contain explicit exp claim");
    assert.ok(decoded.iat, "Staff JWT must contain iat claim");

    // Check expiration duration (~12h = 43200 seconds)
    const duration = decoded.exp - decoded.iat;
    assert.equal(duration, 12 * 3600, "Expiration duration should be exactly 12 hours (43200s)");
  });

  // TEST 12: Expired staff JWT is rejected.
  await t.test("TEST 12: Expired staff JWT is rejected", async () => {
    const expiredToken = app.jwt.sign({
      id: activeUser.id,
      role: "STAFF",
      restaurantId: testRestaurant.id,
      sessionVersion: activeUser.sessionVersion || 0,
      exp: Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/staff/profile/me",
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    assert.equal(res.statusCode, 401);
  });

  // TEST 13: Repeated login attempts trigger HTTP 429 according to the configured rate limit.
  await t.test("TEST 13: Repeated login attempts trigger HTTP 429 after 5 requests", async () => {
    const testIp = "192.168.100.50";

    // First 5 attempts from this IP
    for (let i = 1; i <= 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/login",
        headers: { "x-forwarded-for": testIp },
        payload: {
          email: activeUser.email,
          password: "WrongPassword!",
        },
      });
      assert.equal(res.statusCode, 401, `Attempt ${i} should return 401`);
    }

    // 6th attempt from the same IP must trigger 429
    const blockedRes = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": testIp },
      payload: {
        email: activeUser.email,
        password: "WrongPassword!",
      },
    });

    assert.equal(blockedRes.statusCode, 429);
    const blockedBody = JSON.parse(blockedRes.body);
    assert.equal(blockedBody.error, "Too Many Requests");
    assert.match(blockedBody.message, /too many login attempts/i);
  });

  // TEST 14: Normal successful login is still possible after rate-limit resets.
  await t.test("TEST 14: Normal successful login works after rate-limit window resets", async () => {
    // Reset rate limiter hits
    staffLoginRateLimiter.reset();
    await prisma.user.update({
      where: { id: activeUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null },
    });

    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "192.168.100.50" }, // Same IP as TEST 13
      payload: {
        email: activeUser.email,
        password: validPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.message, "Login success");
  });

  // TEST 15: Customer login behavior remains unchanged.
  await t.test("TEST 15: Customer login behavior remains unchanged", async () => {
    // Customer login route exists and processes invalid input normally
    const res = await app.inject({
      method: "POST",
      url: "/customer/login",
      payload: {
        identifier: "nonexistent_customer",
        password: "anypassword",
      },
    });
    // Customer route returns 401 with customer-specific error
    assert.equal(res.statusCode, 401);
  });

  // TEST 16: Supplier login behavior remains unchanged.
  await t.test("TEST 16: Supplier login behavior remains unchanged", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/supplier/login",
      payload: {
        email: "nonexistent_supplier@test.com",
        password: "anypassword",
      },
    });
    assert.equal(res.statusCode, 401);
  });

  // TEST 17: Magic-link login remains disabled.
  await t.test("TEST 17: Magic-link login remains disabled (returns 403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-link/consume",
      payload: {
        token: "dummy.jwt.token",
      },
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.match(body.message, /discontinued/i);
  });
});
