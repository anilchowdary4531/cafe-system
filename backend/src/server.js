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

const buildQrTargetUrl = (slug, tableNo) => {
  const pathPart = `/r/${slug}?table=${encodeURIComponent(tableNo)}`;
  return `${FRONTEND_URL}${pathPart}`;
};

const allowedCorsOrigins = new Set(CORS_ORIGINS);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (allowedCorsOrigins.has(String(origin).trim().replace(/\/+$/, ""))) {
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
  const actor = await requireStaffJwt(req, reply, { allowedRoles: STAFF_ALLOWED_ROLES, matchRestaurantParam: "restaurantId" });
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
