import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import {
  STAFF_OFFLINE_GRACE_PERIOD_HOURS,
  STAFF_OFFLINE_GRACE_PERIOD_MS,
  refreshStaffSession,
  invalidateStaffSession,
  issueStaffSession,
} from "../services/staffSessionService.js";

const STAFF_ACCESS_MODULES = [
  "dashboard", "billing", "orders", "menu", "inventory", "tables", "kitchen",
  "printers", "analytics", "reports", "paylater", "shifts", "supply", "delivery",
  "delivery_partners", "customers", "discounts", "loyalty", "staff", "settings", "notifications"
];

const defaultAccessByRole = (role) => {
  const normalizedRole = String(role || "STAFF").toUpperCase();
  if (normalizedRole === "OWNER") return STAFF_ACCESS_MODULES.reduce((acc, k) => ({ ...acc, [k]: true }), {});
  return { dashboard: true, notifications: true };
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

const buildTestApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "test-jwt-secret-staff-auth-refresh-xyz" });

  const routeDeps = {
    prisma,
    buildQrTargetUrl: () => "http://localhost:5173",
    FRONTEND_URL: "http://localhost:5173",
    STAFF_ACCESS_MODULES,
    STAFF_ALLOWED_ROLES: ["OWNER", "MANAGER", "WAITER", "SERVER", "CHEF", "CASHIER", "STAFF", "STEWARD", "CLEANER", "SWIPER"],
    normalizeAccess,
    normalizeDbPermissions,
    serializeAccess: (a, r) => JSON.stringify(normalizeAccess(a, r)),
    realtime: {
      notifyRole: () => {},
      notifyUser: () => {},
      notifyRestaurant: () => {},
    },
  };

  await routes(app, routeDeps);
  await app.ready();
  return app;
};

test("Staff Authentication & Refresh Token Architecture", async (t) => {
  const app = await buildTestApp();

  t.after(async () => {
    await app.close();
  });

  const uniqueSuffix = Date.now();
  const testRestaurant = await prisma.restaurant.create({
    data: {
      name: `Refresh Test Rest ${uniqueSuffix}`,
      slug: `refresh-test-rest-${uniqueSuffix}`,
      city: "Hyderabad",
      state: "Telangana",
    },
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const staffUser = await prisma.user.create({
    data: {
      name: "Test Server",
      email: `test_server_${uniqueSuffix}@tiffzy.com`,
      password: passwordHash,
      role: "WAITER",
      designation: "Server",
      restaurantId: testRestaurant.id,
      sessionVersion: 1,
      isActive: true,
    },
  });

  await t.test("72-hour offline grace period constants are correctly configured", () => {
    assert.equal(STAFF_OFFLINE_GRACE_PERIOD_HOURS, 72, "Grace period hours must be exactly 72");
    assert.equal(STAFF_OFFLINE_GRACE_PERIOD_MS, 72 * 60 * 60 * 1000, "Grace period ms must be 259,200,000");
  });

  await t.test("Staff login returns both access token and refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      headers: { "x-forwarded-for": "172.16.254.1" },
      payload: {
        email: staffUser.email,
        password: "Password123!",
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.token, "Access token must be present");
    assert.ok(body.refreshToken, "Refresh token must be present");

    const decodedAccess = app.jwt.decode(body.token);
    const decodedRefresh = app.jwt.decode(body.refreshToken);

    assert.equal(decodedAccess.id, staffUser.id);
    assert.equal(decodedRefresh.id, staffUser.id);
    assert.equal(decodedRefresh.tokenType, "staff_refresh");
    assert.ok(decodedRefresh.exp > decodedAccess.exp, "Refresh token must have longer lifespan than access token");
  });

  await t.test("POST /auth/staff/refresh rotates access token with valid refresh token", async () => {
    const session = await issueStaffSession({
      prisma,
      app,
      user: staffUser,
      effectiveRole: "WAITER",
    });

    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/staff/refresh",
      payload: {
        refreshToken: session.refreshToken,
      },
    });

    assert.equal(refreshRes.statusCode, 200);
    const refreshBody = JSON.parse(refreshRes.body);
    assert.ok(refreshBody.token, "Must return fresh access token");
    assert.ok(refreshBody.refreshToken, "Must return fresh refresh token");
    assert.equal(refreshBody.user.id, staffUser.id);
  });

  await t.test("POST /auth/staff/refresh rejects invalid or malformed refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff/refresh",
      payload: {
        refreshToken: "not-a-valid-jwt-token",
      },
    });

    assert.equal(res.statusCode, 401);
  });

  await t.test("POST /auth/staff/refresh rejects when sessionVersion is incremented (revoked session)", async () => {
    const session = await issueStaffSession({
      prisma,
      app,
      user: staffUser,
      effectiveRole: "WAITER",
    });
    const { refreshToken } = session;

    // Invalidate session on server (increment sessionVersion)
    await invalidateStaffSession({ prisma, userId: staffUser.id });

    // Attempt refresh with old refresh token
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff/refresh",
      payload: { refreshToken },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "SESSION_VERSION_MISMATCH");
  });

  await t.test("POST /auth/staff/logout revokes refresh token on explicit logout", async () => {
    // Re-fetch staffUser with latest sessionVersion
    const currentUser = await prisma.user.findUnique({ where: { id: staffUser.id } });
    const session = await issueStaffSession({
      prisma,
      app,
      user: currentUser,
      effectiveRole: "WAITER",
    });
    const { token, refreshToken } = session;

    // Call logout endpoint
    const logoutRes = await app.inject({
      method: "POST",
      url: "/auth/staff/logout",
      headers: { authorization: `Bearer ${token}` },
      payload: { refreshToken },
    });
    assert.equal(logoutRes.statusCode, 200);

    // Ensure refresh with that token now fails
    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/staff/refresh",
      payload: { refreshToken },
    });
    assert.equal(refreshRes.statusCode, 401);
  });

  await t.test("POST /auth/staff/refresh fails for disabled/inactive staff account", async () => {
    const disabledUser = await prisma.user.create({
      data: {
        name: "Disabled Chef",
        email: `disabled_chef_${uniqueSuffix}@tiffzy.com`,
        password: passwordHash,
        role: "CHEF",
        designation: "Head Chef",
        restaurantId: testRestaurant.id,
        sessionVersion: 1,
        isActive: false, // Disabled
      },
    });

    // Manually issue refresh token for this user
    const refreshToken = app.jwt.sign(
      { id: disabledUser.id, role: "CHEF", sessionVersion: 1, tokenType: "staff_refresh", isRefresh: true },
      { expiresIn: "30d" }
    );

    const res = await app.inject({
      method: "POST",
      url: "/auth/staff/refresh",
      payload: { refreshToken },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "ACCOUNT_INACTIVE");
  });

  await t.test("All staff designations (Owner, Manager, Chef, Server, Steward, Cashier, Cleaner, Swiper) can issue & refresh sessions", async () => {
    const designations = [
      { designation: "Owner", expectedRole: "OWNER" },
      { designation: "General Manager", expectedRole: "MANAGER" },
      { designation: "Senior Chef", expectedRole: "CHEF" },
      { designation: "Line Chef", expectedRole: "CHEF" },
      { designation: "Server", expectedRole: "WAITER" },
      { designation: "Steward", expectedRole: "STEWARD" },
      { designation: "Cashier", expectedRole: "CASHIER" },
      { designation: "Cleaner", expectedRole: "CLEANER" },
      { designation: "Swiper", expectedRole: "SWIPER" },
    ];

    for (const d of designations) {
      const u = await prisma.user.create({
        data: {
          name: `Staff ${d.designation} ${uniqueSuffix}`,
          email: `staff_${d.designation.replace(/\s+/g, "_").toLowerCase()}_${uniqueSuffix}@tiffzy.com`,
          password: passwordHash,
          role: "STAFF",
          designation: d.designation,
          restaurantId: testRestaurant.id,
          sessionVersion: 1,
          isActive: true,
        },
      });

      const session = await issueStaffSession({
        prisma,
        app,
        user: u,
        effectiveRole: d.expectedRole,
      });

      assert.ok(session.token, `Must issue access token for ${d.designation}`);
      assert.ok(session.refreshToken, `Must issue refresh token for ${d.designation}`);

      const refreshed = await refreshStaffSession({
        prisma,
        app,
        refreshToken: session.refreshToken,
        normalizeDbPermissions,
      });

      assert.equal(refreshed.user.role, d.expectedRole, `Role for ${d.designation} must match`);
    }
  });

  // Cleanup test restaurant and users
  await prisma.user.deleteMany({ where: { restaurantId: testRestaurant.id } });
  await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
});
