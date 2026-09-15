import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import routes from "../routes/index.js";

test("Public Routes — Tobacco Endpoint Verification Audit", async (t) => {
    const app = Fastify();
    await routes(app, {
        prisma: {
            menuItem: {
                findMany: async () => [],
            },
            restaurant: {
                findMany: async () => [],
            },
        },
    });

    await t.test("GET /tobacco/items — should return 200 OK with items array", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/tobacco/items?q=",
        });
        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.ok(Array.isArray(payload.items));
    });

    await t.test("GET /api/tobacco/items — should return 200 OK with items array", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/tobacco/items?q=",
        });
        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.ok(Array.isArray(payload.items));
    });

    await t.test("GET /api/v1/tobacco/items — should return 200 OK with items array", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/tobacco/items?q=",
        });
        assert.equal(res.statusCode, 200);
        const payload = JSON.parse(res.payload);
        assert.ok(Array.isArray(payload.items));
    });
});
