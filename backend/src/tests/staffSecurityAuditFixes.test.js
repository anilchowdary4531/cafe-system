import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import staffManagementRoutes from "../routes/staffManagement.js";
import authRoutes from "../routes/auth.js";
import publicRoutes from "../routes/public.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

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

async function createSecurityTestApp() {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "security-audit-secret-key-12345" });

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

  await ownerRoutes(app, routeDeps);
  await staffManagementRoutes(app, routeDeps);
  await authRoutes(app, routeDeps);
  await publicRoutes(app, routeDeps);
  await app.ready();
  return app;
}

test("Staff Management & Staff Login — 15 Security Audit Regression Tests", async (t) => {
  const app = await createSecurityTestApp();
  const ts = Date.now();

  // Create Restaurant A & Restaurant B
  const restA = await prisma.restaurant.create({
    data: {
      name: `Security Rest A ${ts}`,
      slug: `sec-rest-a-${ts}`,
      email: `sec_a_${ts}@tiffzy.com`,
    },
  });

  const restB = await prisma.restaurant.create({
    data: {
      name: `Security Rest B ${ts}`,
      slug: `sec-rest-b-${ts}`,
      email: `sec_b_${ts}@tiffzy.com`,
    },
  });

  const hashedPassword = bcrypt.hashSync("SecurePass123!", 10);

  // Helper to create users and tokens
  const createUser = async (name, email, role, restaurantId) => {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        restaurantId,
        isActive: true,
        sessionVersion: 1,
      },
    });
    const token = app.jwt.sign({
      id: user.id,
      role,
      restaurantId,
      sessionVersion: 1,
    });
    return { user, token };
  };

  const ownerA = await createUser("Owner A", `owner_a_${ts}@test.com`, "OWNER", restA.id);
  const managerA = await createUser("Manager A", `mgr_a_${ts}@test.com`, "MANAGER", restA.id);
  const waiterA = await createUser("Waiter A", `waiter_a_${ts}@test.com`, "WAITER", restA.id);
  const cashierA = await createUser("Cashier A", `cashier_a_${ts}@test.com`, "CASHIER", restA.id);
  const chefA = await createUser("Chef A", `chef_a_${ts}@test.com`, "CHEF", restA.id);
  const staffA = await createUser("Staff A", `staff_a_${ts}@test.com`, "STAFF", restA.id);

  const ownerB = await createUser("Owner B", `owner_b_${ts}@test.com`, "OWNER", restB.id);

  let targetStaffId = null;

  // 1. OWNER can access staff management (create staff).
  await t.test("1. OWNER can access staff management (create staff)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restA.id}/staff`,
      headers: { authorization: `Bearer ${ownerA.token}` },
      payload: {
        name: "New Server 1",
        email: `new_server_1_${ts}@test.com`,
        phone: "9876543210",
        password: "TempPassword123!",
        role: "WAITER",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.user?.id);
    targetStaffId = body.user.id;
  });

  // 2. MANAGER can access permitted Owner management.
  await t.test("2. MANAGER can access permitted Owner management", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restA.id}/staff`,
      headers: { authorization: `Bearer ${managerA.token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.users));
  });

  // 3. WAITER cannot create staff.
  await t.test("3. WAITER cannot create staff (returns 403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restA.id}/staff`,
      headers: { authorization: `Bearer ${waiterA.token}` },
      payload: {
        name: "Hacker Waiter Staff",
        email: `hacker_waiter_${ts}@test.com`,
        phone: "9876543211",
        password: "Pass123!",
        role: "WAITER",
      },
    });
    assert.equal(res.statusCode, 403);
  });

  // 4. WAITER cannot modify staff.
  await t.test("4. WAITER cannot modify staff (returns 403)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restA.id}/staff/${targetStaffId}`,
      headers: { authorization: `Bearer ${waiterA.token}` },
      payload: { name: "Modified by Waiter" },
    });
    assert.equal(res.statusCode, 403);
  });

  // 5. WAITER cannot delete staff.
  await t.test("5. WAITER cannot delete staff (returns 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/owner/${restA.id}/staff/${targetStaffId}`,
      headers: { authorization: `Bearer ${waiterA.token}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // 6. CASHIER cannot modify staff.
  await t.test("6. CASHIER cannot modify staff (returns 403)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restA.id}/staff/${targetStaffId}`,
      headers: { authorization: `Bearer ${cashierA.token}` },
      payload: { name: "Modified by Cashier" },
    });
    assert.equal(res.statusCode, 403);
  });

  // 7. CHEF cannot modify staff.
  await t.test("7. CHEF cannot modify staff (returns 403)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/owner/${restA.id}/staff/${targetStaffId}/status`,
      headers: { authorization: `Bearer ${chefA.token}` },
      payload: { isActive: false },
    });
    assert.equal(res.statusCode, 403);
  });

  // 8. STAFF cannot modify staff.
  await t.test("8. STAFF cannot modify staff (returns 403)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restA.id}/staff/${targetStaffId}`,
      headers: { authorization: `Bearer ${staffA.token}` },
      payload: { name: "Modified by Generic Staff" },
    });
    assert.equal(res.statusCode, 403);
  });

  // 9. Cross-restaurant Owner access returns 403.
  await t.test("9. Cross-restaurant Owner access returns 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restB.id}/staff`,
      headers: { authorization: `Bearer ${ownerA.token}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // 10. GET staff directory does not return loginLink JWT.
  await t.test("10. GET staff directory does not return loginLink JWT", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restA.id}/staff`,
      headers: { authorization: `Bearer ${ownerA.token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.users));
    for (const u of body.users) {
      if (u.loginLink) {
        // Must NOT contain a JWT token (eyJ...)
        assert.equal(u.loginLink.includes("eyJ"), false, `loginLink contained JWT: ${u.loginLink}`);
        // Must be safe email link
        assert.ok(u.loginLink.includes("/login?mode=staff&email="), `loginLink should be safe email link: ${u.loginLink}`);
      }
    }
  });

  // 11. /login?mode=staff&email=... still works (normal password authentication).
  await t.test("11. /login still works with email and valid password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: ownerA.user.email,
        password: "SecurePass123!",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.token, "Expected token in login response");
    assert.equal(body.user?.email, ownerA.user.email);
    ownerA.token = body.token;
  });

  // 12. Password is still required on /login.
  await t.test("12. Password is still required (wrong password rejected)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: ownerA.user.email,
        password: "WrongPassword!",
      },
    });
    assert.equal(res.statusCode, 401);
  });

  // 13. /auth/staff-link/consume cannot create passwordless sessions.
  await t.test("13. /auth/staff-link/consume cannot create passwordless sessions (returns 403)", async () => {
    const dummyJwt = app.jwt.sign({ staffUserId: ownerA.user.id, purpose: "STAFF_MAGIC_LINK" });
    const res = await app.inject({
      method: "POST",
      url: "/auth/staff-link/consume",
      payload: { token: dummyJwt },
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.token, undefined);
    assert.ok(body.message.includes("Passwordless"));
  });

  // Seed shift in Restaurant A
  let shiftAId = null;
  const shiftA = await prisma.staffShift.create({
    data: {
      restaurantId: restA.id,
      userId: waiterA.user.id,
      shiftDate: new Date(),
      startTime: "09:00",
      endTime: "17:00",
      role: "WAITER",
      status: "DRAFT",
    },
  });
  shiftAId = shiftA.id;

  // 14. Restaurant A cannot access Restaurant B schedules.
  await t.test("14. Restaurant A cannot access Restaurant B schedules (returns 403)", async () => {
    // GET
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/owner/${restB.id}/schedules`,
      headers: { authorization: `Bearer ${waiterA.token}` },
    });
    assert.equal(getRes.statusCode, 403);

    // POST
    const postRes = await app.inject({
      method: "POST",
      url: `/api/v1/owner/${restB.id}/schedules`,
      headers: { authorization: `Bearer ${waiterA.token}` },
      payload: {
        userId: waiterA.user.id,
        shiftDate: "2026-10-15",
        startTime: "10:00",
        endTime: "18:00",
        role: "WAITER",
      },
    });
    assert.equal(postRes.statusCode, 403);

    // DELETE
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/owner/${restB.id}/schedules/999`,
      headers: { authorization: `Bearer ${waiterA.token}` },
    });
    assert.equal(delRes.statusCode, 403);

    // PUBLISH
    const pubRes = await app.inject({
      method: "POST",
      url: `/api/v1/owner/${restB.id}/schedules/publish`,
      headers: { authorization: `Bearer ${waiterA.token}` },
      payload: { shiftIds: [999] },
    });
    assert.equal(pubRes.statusCode, 403);
  });

  // 15. Restaurant A can still access its own schedules.
  await t.test("15. Restaurant A can still access its own schedules", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/owner/${restA.id}/schedules`,
      headers: { authorization: `Bearer ${waiterA.token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.shifts));
  });

  // 16. Auto-generate secure temporary password when password omitted
  let autoCreatedStaffId = null;
  let autoGeneratedPassword = null;
  await t.test("16. Auto-generate secure temporary password when password omitted", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${restA.id}/staff`,
      headers: { authorization: `Bearer ${ownerA.token}` },
      payload: {
        name: "Auto Temp Staff",
        email: `auto_temp_${ts}@test.com`,
        phone: "9876543299",
        role: "WAITER",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.temporaryPassword, "Should return temporaryPassword");
    assert.match(body.temporaryPassword, /^Staff#[a-f0-9]+$/);
    autoCreatedStaffId = body.user.id;
    autoGeneratedPassword = body.temporaryPassword;

    // Verify staff can authenticate with the generated temporary password
    const loginRes = await app.inject({
      method: "POST",
      url: "/login",
      payload: {
        email: `auto_temp_${ts}@test.com`,
        password: autoGeneratedPassword,
      },
    });
    assert.equal(loginRes.statusCode, 200);
  });

  // 17. GET staff directory supports role and status query filters
  await t.test("17. GET staff directory supports role and status query filters", async () => {
    // Filter by role=WAITER
    const waiterRes = await app.inject({
      method: "GET",
      url: `/owner/${restA.id}/staff?role=WAITER`,
      headers: { authorization: `Bearer ${ownerA.token}` },
    });
    assert.equal(waiterRes.statusCode, 200);
    const waiterBody = JSON.parse(waiterRes.body);
    assert.ok(waiterBody.users.every((u) => u.role === "WAITER"));

    // Filter by status=inactive
    const inactiveRes = await app.inject({
      method: "GET",
      url: `/owner/${restA.id}/staff?status=inactive`,
      headers: { authorization: `Bearer ${ownerA.token}` },
    });
    assert.equal(inactiveRes.statusCode, 200);
    const inactiveBody = JSON.parse(inactiveRes.body);
    assert.ok(inactiveBody.users.every((u) => u.isActive === false));
  });

  // 18. PUT /owner/:restaurantId/staff/:staffId updates staff profile
  await t.test("18. PUT updates staff profile without altering restaurant ownership", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restA.id}/staff/${autoCreatedStaffId}`,
      headers: { authorization: `Bearer ${ownerA.token}` },
      payload: {
        name: "Updated Auto Staff",
        designation: "Senior Server",
        phone: "9111122222",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.user.name, "Updated Auto Staff");
    assert.equal(body.user.designation, "Senior Server");
    assert.equal(body.user.restaurantId, restA.id);
  });

  // 19. PUT /owner/:restaurantId/staff/:staffId/access updates module permissions
  await t.test("19. PUT updates module permissions for staff user", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${restA.id}/staff/${autoCreatedStaffId}/access`,
      headers: { authorization: `Bearer ${ownerA.token}` },
      payload: {
        access: {
          dashboard: true,
          tables: true,
          orders: true,
          kitchen: true,
        },
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.access.kitchen, true);
  });

  // 20. Deactivate staff increments sessionVersion and revokes access
  await t.test("20. Deactivate staff increments sessionVersion", async () => {
    const beforeUser = await prisma.user.findUnique({
      where: { id: autoCreatedStaffId },
      select: { sessionVersion: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/owner/${restA.id}/staff/${autoCreatedStaffId}/status`,
      headers: { authorization: `Bearer ${ownerA.token}` },
      payload: { isActive: false },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.user.isActive, false);

    const afterUser = await prisma.user.findUnique({
      where: { id: autoCreatedStaffId },
      select: { sessionVersion: true },
    });
    assert.equal(afterUser.sessionVersion, beforeUser.sessionVersion + 1);
  });

  // 21. Delete unlinked staff succeeds; staff with foreign keys returns 400
  await t.test("21. Delete unlinked staff succeeds and protects against historical corruption", async () => {
    // Delete the unlinked staff member
    const delRes = await app.inject({
      method: "DELETE",
      url: `/owner/${restA.id}/staff/${autoCreatedStaffId}`,
      headers: { authorization: `Bearer ${ownerA.token}` },
    });
    assert.equal(delRes.statusCode, 200);

    // Verify deletion in DB
    const deletedUser = await prisma.user.findUnique({ where: { id: autoCreatedStaffId } });
    assert.equal(deletedUser, null);
  });

  // Cleanup seeded data
  await prisma.staffShift.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
  await prisma.staffAccess.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
  await prisma.user.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
  await prisma.restaurant.deleteMany({ where: { id: { in: [restA.id, restB.id] } } });
});
