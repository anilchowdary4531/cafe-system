import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import healthRoutes from "../routes/health.routes.js";
import rateLimiter from "../middleware/rateLimiter.js";
import authorizeRoles from "../middleware/rbacGuard.js";

test("Phase 3 — Backend Foundation Tests", async (t) => {
    await t.test("should register and return 200 OK on GET /health", async () => {
        const app = Fastify();
        await healthRoutes(app);

        const res = await app.inject({
            method: "GET",
            url: "/health",
        });

        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.equal(payload.status, "ok");
        assert.ok(payload.timestamp);
        assert.ok(payload.version);
        assert.equal(payload.services.database, "healthy");
    });

    await t.test("should return 200 OK on GET /api/v1/health", async () => {
        const app = Fastify();
        await healthRoutes(app);

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/health",
        });

        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.equal(payload.status, "ok");
    });

    await t.test("should verify rate limiting middleware behavior", async () => {
        const req = { ip: "127.0.0.1", headers: {} };
        let sentCode = null;
        let sentPayload = null;

        const reply = {
            code: (code) => {
                sentCode = code;
                return {
                    send: (payload) => {
                        sentPayload = payload;
                    },
                };
            },
        };

        await rateLimiter(req, reply);
        assert.equal(sentCode, null, "Normal requests within limit should not trigger 429");
    });

    await t.test("should verify RBAC authorization function structure", () => {
        const guard = authorizeRoles("SUPER_ADMIN", "SUPPLIER");
        assert.equal(typeof guard, "function", "RBAC guard should return a middleware function");
    });
});
