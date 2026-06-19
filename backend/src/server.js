import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "./prisma.js";
import { getRuntimeConfig } from "./config.js";

import routes from "./routes/index.js";
import { initRealtime } from "./realtime/socketServer.js";
import { requireStaffJwt } from "./services/staffAuthService.js";
import { getStorageInfo } from "./services/storageService.js";

const nodeEnv = String(process.env.NODE_ENV || "development").trim() || "development";
const envFileName = nodeEnv === "production" ? ".env.production" : ".env";
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(backendRoot, envFileName);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const app = Fastify({ logger: true });
app.decorateRequest("staffActor", null);

const runtime = getRuntimeConfig();
const { PORT, HOST, JWT_SECRET, FRONTEND_URL, CORS_ORIGINS, DB_HOST } = runtime;

app.log.info({ NODE_ENV: runtime.NODE_ENV, FRONTEND_URL, DB_HOST }, "runtime_config");
app.log.info(getStorageInfo(), "storage_config");

if (runtime.NODE_ENV === "production" && process.env.VALIDATE_BOOT !== "1") {
  try {
    await prisma.$connect();
    // Quick ping to fail-fast if RDS is unreachable.
    await prisma.$queryRaw`SELECT 1`;
    app.log.info({ DB_HOST }, "prisma_connected");
  } catch (err) {
    app.log.error({ err: err?.message || err }, "prisma_connect_failed");
    process.exit(1);
  }
}

const STAFF_ACCESS_MODULES = ["dashboard", "orders", "menu", "tables", "kitchen", "analytics", "finance", "staff", "settings", "notifications"];
const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];

const defaultAccessByRole = (role) => {
  const normalizedRole = String(role || "STAFF").toUpperCase();
  if (normalizedRole === "OWNER") return STAFF_ACCESS_MODULES.reduce((acc, key) => ({ ...acc, [key]: true }), {});
  if (normalizedRole === "MANAGER") return { dashboard: true, orders: true, menu: true, tables: true, kitchen: true, analytics: true, finance: false, staff: false, settings: false, notifications: true };
  if (normalizedRole === "CHEF") return { dashboard: true, orders: true, menu: false, tables: false, kitchen: true, analytics: false, finance: false, staff: false, settings: false, notifications: true };
  if (normalizedRole === "WAITER") return { dashboard: true, orders: true, menu: true, tables: true, kitchen: false, analytics: false, finance: false, staff: false, settings: false, notifications: true };
  if (normalizedRole === "CASHIER") return { dashboard: true, orders: true, menu: false, tables: false, kitchen: false, analytics: true, finance: true, staff: false, settings: false, notifications: true };
  return { dashboard: true, orders: false, menu: false, tables: false, kitchen: false, analytics: false, finance: false, staff: false, settings: false, notifications: true };
};

const normalizeAccess = (rawAccess, role) => {
  const fallbackAccess = defaultAccessByRole(role);
  if (!rawAccess || typeof rawAccess !== "object") return fallbackAccess;
  return STAFF_ACCESS_MODULES.reduce((acc, key) => {
    const value = rawAccess[key];
    acc[key] = value === undefined ? fallbackAccess[key] : Boolean(value);
    return acc;
  }, {});
};

const normalizeDbPermissions = (permissions, role) => {
  let parsedPermissions = permissions;
  if (typeof permissions === "string") {
    try {
      parsedPermissions = JSON.parse(permissions);
    } catch {
      parsedPermissions = null;
    }
  }

  if (!parsedPermissions || typeof parsedPermissions !== "object" || Array.isArray(parsedPermissions)) {
    return defaultAccessByRole(role);
  }
  return normalizeAccess(parsedPermissions, role);
};

const serializeAccess = (access, role) => JSON.stringify(normalizeAccess(access, role));

const setStaffAccess = (restaurantId, staffId, access) => {
  staffAccessStore[restaurantId] = staffAccessStore[restaurantId] || {};
  staffAccessStore[restaurantId][staffId] = access;
};

const getStaffPhone = (restaurantId, staffId, fallback = "") => {
  const byRestaurant = staffPhoneStore[restaurantId] || {};
  return byRestaurant[staffId] || fallback || "";
};

const setStaffPhone = (restaurantId, staffId, phone) => {
  staffPhoneStore[restaurantId] = staffPhoneStore[restaurantId] || {};
  staffPhoneStore[restaurantId][staffId] = phone || "";
};

const deleteStaffAccess = (restaurantId, staffId) => {
  if (!staffAccessStore[restaurantId]) return;
  delete staffAccessStore[restaurantId][staffId];
};

const deleteStaffPhone = (restaurantId, staffId) => {
  if (!staffPhoneStore[restaurantId]) return;
  delete staffPhoneStore[restaurantId][staffId];
};

const isDbUnavailable = (err) => {
  const msg = String(err?.message || "");
  return (
    err?.name === "PrismaClientInitializationError" ||
    msg.includes("Can't reach database server") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("P1001") ||
    msg.includes("P2021") ||
    msg.includes("P2022")
  );
};

const isOrderArchitectureUnavailable = (err) => {
  const msg = String(err?.message || "");
  return (
    msg.includes("Cannot read properties of undefined") ||
    msg.includes("Unknown argument `customerId`") ||
    msg.includes("Unknown argument `statusEvents`") ||
    msg.includes("Unknown field `customer`") ||
    msg.includes("Unknown field `statusEvents`") ||
    msg.includes("Unknown field `customerId`") ||
    msg.includes("Unknown field `restaurantId_phone`") ||
    msg.includes("Could not find mapping for model Customer") ||
    msg.includes("Could not find mapping for model OrderStatusEvent") ||
    msg.includes("Customer") && msg.includes("does not exist") ||
    msg.includes("OrderStatusEvent") && msg.includes("does not exist") ||
    msg.includes("column") && msg.includes("customerId") ||
    msg.includes("P2021") ||
    msg.includes("P2022")
  );
};

const getFrontendBaseUrl = () =>
  process.env.FRONTEND_URL || "http://localhost:5173";

const buildQrTargetUrl = (slug, tableNo) =>
  `${getFrontendBaseUrl()}/r/${slug}?table=${encodeURIComponent(tableNo)}`;

const ensureDefaultUsersInDatabase = async () => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, slug: true },
    });
    const restaurantIdBySlug = new Map(restaurants.map((restaurant) => [restaurant.slug, restaurant.id]));

    for (const fallbackUser of fallbackUsers) {
      const normalizedEmail = String(fallbackUser.email || "").trim().toLowerCase();
      const restaurantSlug = fallbackUser.restaurant?.slug || null;
      const restaurantId = restaurantSlug ? restaurantIdBySlug.get(restaurantSlug) || null : null;

      if (fallbackUser.role !== "SUPER_ADMIN" && restaurantSlug && !restaurantId) {
        continue;
      }

      const user = await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: fallbackUser.name,
          phone: fallbackUser.phone || null,
          role: fallbackUser.role,
          isActive: fallbackUser.isActive !== false,
          restaurantId,
        },
        create: {
          name: fallbackUser.name,
          email: normalizedEmail,
          phone: fallbackUser.phone || null,
          password: bcrypt.hashSync(String(fallbackUser.password), 10),
          role: fallbackUser.role,
          isActive: fallbackUser.isActive !== false,
          restaurantId,
        },
      });

      if (fallbackUser.role !== "SUPER_ADMIN" && restaurantId) {
        await prisma.staffAccess.upsert({
          where: { userId: user.id },
          update: {
            restaurantId,
            permissions: defaultAccessByRole(fallbackUser.role),
          },
          create: {
            restaurantId,
            userId: user.id,
            permissions: defaultAccessByRole(fallbackUser.role),
          },
        });
      }
    }
  } catch (err) {
    if (isDbUnavailable(err)) {
      app.log.warn("Skipping default user sync because the database is unavailable");
      return;
    }
    throw err;
  }
};

// ======================
// CORS
// ======================
const allowedCorsOrigins = new Set(
  [
    ...CORS_ORIGINS,
    "http://localhost:5175",
    "http://localhost:5174",
    "http://localhost:5173",
    "https://tiffzy.com",
    "https://www.tiffzy.com",
    "https://api.tiffzy.com",
    "https://suretra.com",
    "https://www.suretra.com",
    "https://cafe-system-nu.vercel.app",
  ]
    .filter(Boolean)
    .map((origin) => String(origin).trim().replace(/\/+$/, ""))
);

const isAllowedDevOrigin = (origin) => {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
};

await app.register(cors, {
  origin: (origin, cb) => {
    const normalizedOrigin = origin ? String(origin).trim().replace(/\/+$/, "") : "";
    if (!normalizedOrigin || allowedCorsOrigins.has(normalizedOrigin) || isAllowedDevOrigin(normalizedOrigin)) {
      cb(null, true);
      return;
    }
    cb(new Error("Origin not allowed by CORS"), false);
  },
  credentials: true,
});

await app.register(jwt, { secret: JWT_SECRET });
try {
  const { default: multipart } = await import("@fastify/multipart");
  await app.register(multipart, {
    limits: {
      // Per-route overrides are applied in the handler via `req.file({ limits: ... })`.
      fileSize: 10 * 1024 * 1024,
      files: 1,
      parts: 20,
    },
  });
} catch (err) {
  app.log.error(
    { err: err?.message || err },
    "multipart_missing (install @fastify/multipart to enable asset uploads)"
  );
  if (runtime.NODE_ENV === "production") process.exit(1);
}

// Serve locally-stored uploads under /uploads (dev + prod; prod will usually have no local files).
await app.register(fastifyStatic, {
  root: path.join(backendRoot, "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});

const requireOwnerRouteAuth = async (req, reply) => {
  const actor = await requireStaffJwt(req, reply, {
    prisma,
    allowedRoles: STAFF_ALLOWED_ROLES,
    matchRestaurantParam: "restaurantId",
  });
  if (!actor) return reply;
  req.staffActor = actor;
  return null;
};

app.addHook("onRoute", (routeOptions) => {
  const url = String(routeOptions?.url || "");
  if (!url.startsWith("/owner/")) return;
  const existing = routeOptions.preHandler ? (Array.isArray(routeOptions.preHandler) ? routeOptions.preHandler : [routeOptions.preHandler]) : [];
  routeOptions.preHandler = [...existing, requireOwnerRouteAuth];
});

const realtime = initRealtime({
  app,
  prisma,
  allowedOrigins: [...allowedCorsOrigins],
});

const routeDeps = {
  prisma,
  buildQrTargetUrl,
  FRONTEND_URL,
  STAFF_ACCESS_MODULES,
  STAFF_ALLOWED_ROLES,
  normalizeAccess,
  normalizeDbPermissions,
  serializeAccess,
  realtime,
};

await routes(app, routeDeps);

// Used by CI / local smoke-tests to validate boot without binding a TCP port.
if (process.env.VALIDATE_BOOT === "1") {
  await app.ready();
  if (!app.hasRoute({ method: "GET", url: "/restaurants" })) {
    throw new Error("Route GET:/restaurants not found");
  }
  console.log("BOOT_OK");
  process.exit(0);
}

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Running on ${HOST}:${PORT}`);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

start();
