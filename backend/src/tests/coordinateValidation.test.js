import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import superAdminRoutes from "../routes/superAdmin.js";
import ownerRoutes from "../routes/owner.js";

// Mock Prisma for testing coordinate validation
const mockPrisma = {
    user: {
        findUnique: async ({ where }) => {
            if (where.id === 1) return { id: 1, role: "SUPER_ADMIN", isActive: true, sessionVersion: 0 };
            return null;
        },
        create: async ({ data }) => ({ id: 101, ...data }),
    },
    restaurant: {
        findUnique: async ({ where }) => {
            if (where.slug === "existing-slug") return { id: 1 };
            if (where.id === 10) return { id: 10, name: "Test Cafe", latitude: 12.9716, longitude: 77.5946 };
            return null;
        },
        create: async ({ data }) => {
            return { id: 99, ...data };
        },
        update: async ({ where, data }) => {
            return { id: where.id, ...data };
        },
    },
    staffAccess: {
        create: async () => ({ id: 1 }),
    },
    $transaction: async (cb) => cb(mockPrisma),
};

const dummyDeps = {
    prisma: mockPrisma,
    STAFF_ACCESS_MODULES: ["DASHBOARD", "SETTINGS"],
    STAFF_ALLOWED_ROLES: ["OWNER", "SUPER_ADMIN"],
    normalizeAccess: (access) => access,
    normalizeDbPermissions: (perm) => perm,
    serializeAccess: (access) => access,
    buildQrTargetUrl: () => "http://test/qr",
    FRONTEND_URL: "http://localhost:5173",
};

test("Coordinate Validation Audit — POST /super-admin/restaurants & PUT /owner/:id/settings", async (t) => {
    const app = fastify();
    await app.register(fastifyJwt, { secret: "test-secret" });
    await app.register(superAdminRoutes, dummyDeps);
    await app.register(ownerRoutes, dummyDeps);

    const superAdminToken = app.jwt.sign({ id: 1, role: "SUPER_ADMIN", type: "staff", sessionVersion: 0 });

    await t.test("POST /super-admin/restaurants rejects out-of-bounds latitude (95)", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/super-admin/restaurants",
            headers: { authorization: `Bearer ${superAdminToken}` },
            payload: {
                name: "New Cafe 1",
                ownerName: "Alice",
                ownerEmail: "alice1@test.com",
                ownerPassword: "password123",
                latitude: 95.0,
                longitude: 77.5946,
            },
        });

        assert.equal(res.statusCode, 400);
        const json = JSON.parse(res.body);
        assert.match(json.message, /Invalid latitude/i);
    });

    await t.test("POST /super-admin/restaurants rejects out-of-bounds longitude (190)", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/super-admin/restaurants",
            headers: { authorization: `Bearer ${superAdminToken}` },
            payload: {
                name: "New Cafe 2",
                ownerName: "Alice",
                ownerEmail: "alice2@test.com",
                ownerPassword: "password123",
                latitude: 12.9716,
                longitude: 190.0,
            },
        });

        assert.equal(res.statusCode, 400);
        const json = JSON.parse(res.body);
        assert.match(json.message, /Invalid longitude/i);
    });

    await t.test("POST /super-admin/restaurants accepts NULL latitude and longitude", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/super-admin/restaurants",
            headers: { authorization: `Bearer ${superAdminToken}` },
            payload: {
                name: "Null Coords Cafe",
                ownerName: "Alice",
                ownerEmail: "alice3@test.com",
                ownerPassword: "password123",
                latitude: null,
                longitude: null,
            },
        });

        assert.equal(res.statusCode, 201);
        const json = JSON.parse(res.body);
        assert.equal(json.restaurant.latitude, null);
        assert.equal(json.restaurant.longitude, null);
    });

    await t.test("PUT /owner/10/settings rejects invalid latitude (-100)", async () => {
        const res = await app.inject({
            method: "PUT",
            url: "/owner/10/settings",
            headers: { authorization: `Bearer ${superAdminToken}` },
            payload: {
                latitude: -100,
            },
        });

        assert.equal(res.statusCode, 400);
        const json = JSON.parse(res.body);
        assert.match(json.message, /Invalid latitude/i);
    });

    await t.test("PUT /owner/10/settings accepts valid coordinates (lat: 12.9716, lng: 77.5946)", async () => {
        const res = await app.inject({
            method: "PUT",
            url: "/owner/10/settings",
            headers: { authorization: `Bearer ${superAdminToken}` },
            payload: {
                latitude: 12.9716,
                longitude: 77.5946,
            },
        });

        assert.equal(res.statusCode, 200);
        const json = JSON.parse(res.body);
        assert.equal(json.restaurant.latitude, 12.9716);
        assert.equal(json.restaurant.longitude, 77.5946);
    });
});
