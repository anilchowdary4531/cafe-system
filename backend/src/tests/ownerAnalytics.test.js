import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"];

async function createTestApp() {
    const app = Fastify();
    await app.register(fastifyJwt, { secret: "test-analytics-secret-key-12345" });

    // Replicate server.js auth hook for owner routes
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
        if (!url.startsWith("/owner/") && !url.startsWith("/api/owner/")) return;
        const existing = routeOptions.preHandler
            ? Array.isArray(routeOptions.preHandler)
                ? routeOptions.preHandler
                : [routeOptions.preHandler]
            : [];
        routeOptions.preHandler = [...existing, requireOwnerRouteAuth];
    });

    await ownerRoutes(app, { prisma });
    await app.ready();
    return app;
}

test("Owner Analytics — Full System Audit, Multi-Tenant Isolation & Calculations", async (t) => {
    const app = await createTestApp();
    const timestamp = Date.now();

    // 1. Seed two test restaurants for Multi-Tenant Isolation
    const restA = await prisma.restaurant.create({
        data: {
            name: `Analytics Rest A ${timestamp}`,
            slug: `analytics-rest-a-${timestamp}`,
            email: `analytics_a_${timestamp}@tiffzy.com`,
            timezone: "Asia/Kolkata",
        },
    });

    const restB = await prisma.restaurant.create({
        data: {
            name: `Analytics Rest B ${timestamp}`,
            slug: `analytics-rest-b-${timestamp}`,
            email: `analytics_b_${timestamp}@tiffzy.com`,
            timezone: "Asia/Kolkata",
        },
    });

    // Create staff users for Rest A and Rest B
    const userA = await prisma.user.create({
        data: {
            email: `owner_a_${timestamp}@tiffzy.com`,
            name: "Owner A",
            role: "OWNER",
            password: "test_password_hash",
            restaurantId: restA.id,
        },
    });

    const userB = await prisma.user.create({
        data: {
            email: `owner_b_${timestamp}@tiffzy.com`,
            name: "Owner B",
            role: "OWNER",
            password: "test_password_hash",
            restaurantId: restB.id,
        },
    });

    const tokenA = app.jwt.sign({ id: userA.id, role: "OWNER", restaurantId: restA.id, type: "staff", sessionVersion: 0 });
    const tokenB = app.jwt.sign({ id: userB.id, role: "OWNER", restaurantId: restB.id, type: "staff", sessionVersion: 0 });

    const authHeaderA = { authorization: `Bearer ${tokenA}` };
    const authHeaderB = { authorization: `Bearer ${tokenB}` };

    // Create Dining Tables for Rest A
    const tableA1 = await prisma.diningTable.create({
        data: {
            restaurantId: restA.id,
            tableNo: "T1",
            seats: 4,
        },
    });
    const tableA2 = await prisma.diningTable.create({
        data: {
            restaurantId: restA.id,
            tableNo: "T2",
            seats: 2,
        },
    });

    // Create Customers for Rest A
    const custA1 = await prisma.customer.create({
        data: {
            restaurantId: restA.id,
            phone: `9198${String(timestamp).slice(-6)}1`,
            name: "Customer A1",
        },
    });
    const custA2 = await prisma.customer.create({
        data: {
            restaurantId: restA.id,
            phone: `9198${String(timestamp).slice(-6)}2`,
            name: "Customer A2",
        },
    });

    // Create TableSession for tableA1 to mark it occupied
    await prisma.tableSession.create({
        data: {
            restaurantId: restA.id,
            tableId: tableA1.id,
            tableNo: tableA1.tableNo,
            status: "OPEN",
        },
    });

    // Create Orders for Rest A
    // Order 1: Active order - subtotal 500, discount 50, tax 25, total 475, Dine-In, QR, tableA1
    const orderA1 = await prisma.order.create({
        data: {
            restaurantId: restA.id,
            orderNo: `ORD-A1-${timestamp}`,
            subtotal: 500,
            discountAmount: 50,
            taxAmount: 25,
            total: 475,
            status: "PREPARING",
            paymentStatus: "PAID",
            paymentMode: "UPI",
            fulfillment: "Dine-In",
            orderSource: "QR",
            tableNo: tableA1.tableNo,
            customerId: custA1.id,
            createdByUserId: userA.id,
            createdAt: new Date(),
        },
    });

    // Order 2: Completed order - subtotal 300, discount 0, tax 15, total 315, Takeaway, CASH, POS
    const orderA2 = await prisma.order.create({
        data: {
            restaurantId: restA.id,
            orderNo: `ORD-A2-${timestamp}`,
            subtotal: 300,
            discountAmount: 0,
            taxAmount: 15,
            total: 315,
            status: "COMPLETED",
            paymentStatus: "PAID",
            paymentMode: "CASH",
            fulfillment: "Takeaway",
            orderSource: "POS",
            customerId: custA2.id,
            createdByUserId: userA.id,
            createdAt: new Date(),
        },
    });

    // Order 3: CANCELLED order - should NOT count towards active revenue/orders
    const orderA3Cancelled = await prisma.order.create({
        data: {
            restaurantId: restA.id,
            orderNo: `ORD-A3-CAN-${timestamp}`,
            subtotal: 1000,
            discountAmount: 0,
            taxAmount: 50,
            total: 1050,
            status: "CANCELLED",
            paymentStatus: "FAILED",
            paymentMode: "CARD",
            fulfillment: "Dine-In",
            createdAt: new Date(),
        },
    });

    // Create Order for Rest B: subtotal 2000, total 2100 (Rest A must NOT see this)
    const orderB1 = await prisma.order.create({
        data: {
            restaurantId: restB.id,
            orderNo: `ORD-B1-${timestamp}`,
            subtotal: 2000,
            discountAmount: 0,
            taxAmount: 100,
            total: 2100,
            status: "COMPLETED",
            paymentStatus: "PAID",
            paymentMode: "UPI",
            fulfillment: "Dine-In",
            createdAt: new Date(),
        },
    });

    // Clean up created test records after tests complete
    t.after(async () => {
        try {
            await prisma.tableSession.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
            await prisma.order.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
            await prisma.diningTable.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
            await prisma.customer.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
            await prisma.user.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
            await prisma.restaurant.deleteMany({ where: { id: { in: [restA.id, restB.id] } } });
        } catch (e) {
            // ignore cleanup errors
        }
    });

    await t.test("1. Analytics API returns valid data with all 11 sections (HTTP 200)", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=today`,
            headers: authHeaderA,
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);

        // Verify top-level structure
        assert.ok(data.overview, "overview section must be present");
        assert.ok(data.charts, "charts section must be present");
        assert.ok(data.peakDemand, "peakDemand section must be present");
        assert.ok(data.realtime, "realtime section must be present");
        assert.ok(data.tablesAndQr, "tablesAndQr section must be present");
        assert.ok(data.kitchenFlow, "kitchenFlow section must be present");
        assert.ok(data.paymentMethods, "paymentMethods section must be present");
        assert.ok(data.customerStats, "customerStats section must be present");
        assert.ok(data.inventoryStatus, "inventoryStatus section must be present");
        assert.ok(Array.isArray(data.staffPerformance), "staffPerformance must be array");
        assert.ok(Array.isArray(data.alerts), "alerts must be array");

        // Verify Overview values
        // Total revenue = 475 (Order 1) + 315 (Order 2) = 790
        assert.equal(data.overview.totalRevenue, 790);
        assert.equal(data.overview.totalOrders, 2);
        assert.equal(data.overview.avgOrderValue, 395); // 790 / 2 = 395
        assert.equal(data.overview.grossSales, 800); // 500 + 300
        assert.equal(data.overview.netSales, 750); // 800 - 50
        assert.equal(data.overview.totalDiscounts, 50);
        assert.equal(data.overview.totalTaxes, 40); // 25 + 15

        // Verify previous period fields exist and are numbers (preventing the reference error)
        assert.equal(typeof data.overview.previousTotalRevenue, "number");
        assert.equal(typeof data.overview.previousTotalOrders, "number");
        assert.equal(typeof data.overview.previousTotalCustomers, "number");
        assert.equal(typeof data.overview.previousAvgOrderValue, "number");
    });

    await t.test("2. Non-double-counting: Cancelled orders are excluded", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=today`,
            headers: authHeaderA,
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);

        // Cancelled order was total 1050; if double counted, revenue would be 1840
        assert.equal(data.overview.totalRevenue, 790, "Cancelled orders must not be included in revenue");
        assert.equal(data.overview.totalOrders, 2, "Cancelled orders must not be included in total orders");
    });

    await t.test("3. Multi-Tenant Data Isolation: Rest A cannot see Rest B's data", async () => {
        const resA = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=today`,
            headers: authHeaderA,
        });
        const dataA = JSON.parse(resA.payload);

        const resB = await app.inject({
            method: "GET",
            url: `/owner/${restB.id}/analytics?range=today`,
            headers: authHeaderB,
        });
        const dataB = JSON.parse(resB.payload);

        // Rest A: 790 revenue, 2 orders
        assert.equal(dataA.overview.totalRevenue, 790);
        assert.equal(dataA.overview.totalOrders, 2);

        // Rest B: 2100 revenue, 1 order
        assert.equal(dataB.overview.totalRevenue, 2100);
        assert.equal(dataB.overview.totalOrders, 1);
    });

    await t.test("4. Auth: 401 Unauthorized when token is missing", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=today`,
        });

        assert.equal(res.statusCode, 401);
    });

    await t.test("5. Auth: 403 Forbidden when Owner A accesses Restaurant B", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restB.id}/analytics?range=today`,
            headers: authHeaderA, // Token A has restaurantId = restA.id
        });

        assert.equal(res.statusCode, 403);
    });

    await t.test("6. Empty dataset handling: returns valid zeros without crashing", async () => {
        // Restaurant B has 0 tables and 0 orders for range=yesterday
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restB.id}/analytics?range=yesterday`,
            headers: authHeaderB,
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.overview.totalRevenue, 0);
        assert.equal(data.overview.totalOrders, 0);
        assert.equal(data.overview.avgOrderValue, 0);
        assert.equal(data.tablesAndQr.totalTables, 0);
        assert.equal(data.tablesAndQr.occupancyRatePct, 0);
    });

    await t.test("7. Date presets: 7d and 30d work correctly", async () => {
        const res7d = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=7d`,
            headers: authHeaderA,
        });
        assert.equal(res7d.statusCode, 200);
        const data7d = JSON.parse(res7d.payload);
        assert.equal(data7d.overview.totalRevenue, 790);
        assert.ok(Array.isArray(data7d.charts.timeseries));
        assert.equal(data7d.charts.timeseries.length, 7);

        const res30d = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=30d`,
            headers: authHeaderA,
        });
        assert.equal(res30d.statusCode, 200);
        const data30d = JSON.parse(res30d.payload);
        assert.equal(data30d.charts.timeseries.length, 30);
    });

    await t.test("8. Custom Date Range works correctly", async () => {
        const todayStr = new Date().toISOString().split("T")[0];
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=custom&startDate=${todayStr}&endDate=${todayStr}`,
            headers: authHeaderA,
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.overview.totalRevenue, 790);
    });

    await t.test("9. Route alias: /api/owner/:restaurantId/analytics works identically", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/api/owner/${restA.id}/analytics?range=today`,
            headers: authHeaderA,
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.overview.totalRevenue, 790);
    });

    await t.test("10. Tables and QR intelligence accurately calculated", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=today`,
            headers: authHeaderA,
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.tablesAndQr.totalTables, 2);
        assert.equal(data.tablesAndQr.occupiedTables, 1);
        assert.equal(data.tablesAndQr.availableTables, 1);
        assert.equal(data.tablesAndQr.occupancyRatePct, 50);
        // Order 1 was at tableA1 with total 475
        assert.equal(data.tablesAndQr.qrRevenue, 475);
    });

    await t.test("11. Error handling: 500 when database throws", async () => {
        // Create an app instance with a throwing prisma mock for order
        const brokenApp = Fastify();
        await brokenApp.register(fastifyJwt, { secret: "test-analytics-secret-key-12345" });
        await ownerRoutes(brokenApp, {
            prisma: {
                ...prisma,
                order: {
                    ...prisma.order,
                    findMany: () => {
                        throw new Error("Simulated database connection failure");
                    },
                },
            },
        });
        await brokenApp.ready();

        const res = await brokenApp.inject({
            method: "GET",
            url: `/owner/${restA.id}/analytics?range=today`,
        });

        assert.equal(res.statusCode, 500);
        const data = JSON.parse(res.payload);
        assert.equal(data.message, "Failed to fetch analytics");
        assert.ok(data.error.includes("Simulated database connection failure"));
    });
});
