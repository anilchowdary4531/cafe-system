import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { env } from "./config/env.js";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import publicRoutes from "./routes/public.routes.js";
import ownerRoutes from "./routes/owner.routes.js";
import tableSessionsRoutes from "./routes/tableSessions.js";

export async function buildApp() {
    // ✅ CREATE INSTANCE
    const app = Fastify({
        logger: true,
    });

    // ✅ PLUGINS
    await app.register(cors, { origin: true });
    await app.register(jwt, { secret: env.JWT_SECRET || "secret" });

    // ✅ ROUTES
    app.register(authRoutes, { prefix: "/api" });
    app.register(publicRoutes, { prefix: "/api" });
    app.register(ownerRoutes, { prefix: "/api" });

    // 🔥 THIS WAS FAILING BEFORE
    app.register(tableSessionsRoutes, { prefix: "/api" });

    return app;
}