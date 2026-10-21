import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF", "SERVER"];

async function createTestApp(emittedEvents = []) {
    const app = Fastify();
    await app.register(fastifyJwt, { secret: "test-settlement-secret-key-12345" });

    const requireOwnerRouteAuth = async (req, reply) => {
        const actor = await requireStaffJwt(req, reply, {
            prisma,
            allowedRoles: STAFF_ALLOWED_ROLES,
            matchRestaurantParam: "restaurantId",
        });
        if (!actor) return reply;
        req.staffActor = actor;
        req.user = { id: actor.userId, name: actor.userName, role: actor.role };
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
        emitOrderUpdated: (order) => {
            emittedEvents.push({ event: "order:updated", data: order });
        },
        io: {
            to: (room) => ({
                emit: (event, data) => {
                    emittedEvents.push({ room, event, data });
                },
            }),
        },
    };

    await ownerRoutes(app, {
        prisma,
        realtime: mockRealtime,
        STAFF_ALLOWED_ROLES,
    });
    await app.ready();
    return app;
}

test("Tiffzy Server Station — Payment Settlement Backend Test Suite", async (t) => {
    const emittedEvents = [];
    const app = await createTestApp(emittedEvents);
    const ts = Date.now();

    // 1. Create test restaurants
    const restaurantA = await prisma.restaurant.create({
        data: {
            name: `Settlement Cafe A ${ts}`,
            slug: `settle-a-${ts}`,
            currency: "INR",
            upiId: "settlea@upi",
        },
    });

    const restaurantB = await prisma.restaurant.create({
        data: {
            name: `Settlement Cafe B ${ts}`,
            slug: `settle-b-${ts}`,
            currency: "INR",
        },
    });

    // 2. Create users: Server A (role SERVER), Server B (from restaurant B)
    const serverA = await prisma.user.create({
        data: {
            name: `Server Kamalesh ${ts}`,
            email: `kamalesh-${ts}@example.com`,
            password: "hashedpassword123",
            role: "SERVER",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    const serverB = await prisma.user.create({
        data: {
            name: `Server B ${ts}`,
            email: `serverb-${ts}@example.com`,
            password: "hashedpassword123",
            role: "SERVER",
            restaurantId: restaurantB.id,
            isActive: true,
        },
    });

    const tokenA = app.jwt.sign({
        id: serverA.id,
        userId: serverA.id,
        role: "SERVER",
        restaurantId: restaurantA.id,
        sessionVersion: serverA.sessionVersion,
    });

    const tokenB = app.jwt.sign({
        id: serverB.id,
        userId: serverB.id,
        role: "SERVER",
        restaurantId: restaurantB.id,
        sessionVersion: serverB.sessionVersion,
    });

    // 3. Create dining tables
    const tableA3 = await prisma.diningTable.create({
        data: {
            restaurantId: restaurantA.id,
            tableNo: "3",
            seats: 4,
            assignedWaiterId: serverA.id,
            assignedWaiterName: serverA.name,
        },
    });

    t.after(async () => {
        await prisma.payment.deleteMany({ where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } });
        await prisma.orderItem.deleteMany({ where: { order: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } } });
        await prisma.order.deleteMany({ where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } });
        await prisma.tableSession.deleteMany({ where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } });
        await prisma.diningTable.deleteMany({ where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } });
        await prisma.user.deleteMany({ where: { id: { in: [serverA.id, serverB.id] } } });
        await prisma.restaurant.deleteMany({ where: { id: { in: [restaurantA.id, restaurantB.id] } } });
    });

    await t.test("Phase 4: Cash settlement atomically updates Order, creates Payment, completes session, releases table", async () => {
        // Create session
        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurantA.id,
                tableId: tableA3.id,
                tableNo: "3",
                waiterId: serverA.id,
                waiterName: serverA.name,
                status: "OPEN",
                total: 1250,
            },
        });

        // Create delivered order with pending payment
        const order = await prisma.order.create({
            data: {
                restaurantId: restaurantA.id,
                tableSessionId: session.id,
                tableNo: "3",
                orderNo: `ORD-SETTLE-CASH-${ts}`,
                status: "DELIVERED",
                paymentStatus: "PENDING",
                total: 1250,
                subtotal: 1250,
            },
        });

        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/3/settle-bill`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                paymentMode: "CASH",
                changedByName: "kamalesh",
                amount: 1250,
            },
        });

        if (res.statusCode !== 200) {
            console.error("PHASE 4 FAILED PAYLOAD:", res.payload);
        }
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.cleared, true);
        assert.equal(data.paymentMode, "CASH");
        assert.equal(data.authoritativeTotal, 1250);
        assert.ok(data.restaurant);

        // Verify Order in DB is now DELIVERED and SUCCESS
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        assert.equal(updatedOrder.paymentStatus, "SUCCESS");
        assert.equal(updatedOrder.paymentMode, "CASH");
        assert.equal(updatedOrder.status, "DELIVERED");

        // Verify Payment record created in DB
        const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
        assert.ok(payment, "Payment record must exist");
        assert.equal(payment.status, "SUCCESS");
        assert.equal(payment.paymentMethod, "CASH");
        assert.equal(payment.provider, "CASH");
        assert.equal(payment.amountReceived, 1250);
        assert.equal(payment.performedByName, "kamalesh");

        // Verify TableSession is closed
        const updatedSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
        assert.equal(updatedSession.status, "CLOSED");

        // Verify DiningTable is released (assigned server cleared)
        const updatedTable = await prisma.diningTable.findUnique({ where: { id: tableA3.id } });
        assert.equal(updatedTable.assignedWaiterId, null);
    });

    await t.test("Phase 5: UPI settlement with transaction reference saves audit record", async () => {
        // Reset table assignment
        await prisma.diningTable.update({
            where: { id: tableA3.id },
            data: { assignedWaiterId: serverA.id, assignedWaiterName: serverA.name },
        });

        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurantA.id,
                tableId: tableA3.id,
                tableNo: "3",
                status: "OPEN",
                total: 500,
            },
        });

        const order = await prisma.order.create({
            data: {
                restaurantId: restaurantA.id,
                tableSessionId: session.id,
                tableNo: "3",
                orderNo: `ORD-SETTLE-UPI-${ts}`,
                status: "DELIVERED",
                paymentStatus: "PENDING",
                total: 500,
                subtotal: 500,
            },
        });

        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/3/settle-bill`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                paymentMode: "UPI",
                reference: "UPI-REF-12345678",
                changedByName: "kamalesh",
                amount: 500,
            },
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.equal(data.cleared, true);
        assert.equal(data.paymentMode, "UPI");

        const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
        assert.ok(payment);
        assert.equal(payment.paymentMethod, "UPI");
        assert.equal(payment.provider, "UPI_MANUAL");
        assert.equal(payment.transactionId, "UPI-REF-12345678");
    });

    await t.test("Phase 16: Price Manipulation Protection rejects tampered frontend amount", async () => {
        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurantA.id,
                tableId: tableA3.id,
                tableNo: "3",
                status: "OPEN",
                total: 1250,
            },
        });

        const order = await prisma.order.create({
            data: {
                restaurantId: restaurantA.id,
                tableSessionId: session.id,
                tableNo: "3",
                orderNo: `ORD-SETTLE-SEC-${ts}`,
                status: "DELIVERED",
                paymentStatus: "PENDING",
                total: 1250,
                subtotal: 1250,
            },
        });

        // Attempt to submit amount = 1 when DB order total is 1250
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/3/settle-bill`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                paymentMode: "CASH",
                amount: 1, // Tampered amount!
            },
        });

        assert.equal(res.statusCode, 400);
        const data = JSON.parse(res.payload);
        assert.match(data.message, /Payment amount mismatch/i);

        // Order must remain UNPAID
        const checkOrder = await prisma.order.findUnique({ where: { id: order.id } });
        assert.equal(checkOrder.paymentStatus, "PENDING");

        // Clean up
        await prisma.order.delete({ where: { id: order.id } });
        await prisma.tableSession.delete({ where: { id: session.id } });
    });

    await t.test("Phase 15: Tenant Isolation rejects cross-restaurant payment settlement", async () => {
        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurantA.id,
                tableId: tableA3.id,
                tableNo: "3",
                status: "OPEN",
            },
        });

        const order = await prisma.order.create({
            data: {
                restaurantId: restaurantA.id,
                tableSessionId: session.id,
                tableNo: "3",
                orderNo: `ORD-CROSS-REST-${ts}`,
                status: "DELIVERED",
                paymentStatus: "PENDING",
                subtotal: 300,
                total: 300,
            },
        });

        // Server B (from restaurant B) attempts to settle Restaurant A's table
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/3/settle-bill`,
            headers: { authorization: `Bearer ${tokenB}` },
            payload: { paymentMode: "CASH" },
        });

        assert.equal(res.statusCode, 403, "Cross-restaurant settlement must be rejected with 403");

        // Clean up
        await prisma.order.delete({ where: { id: order.id } });
        await prisma.tableSession.delete({ where: { id: session.id } });
    });

    await t.test("Phase 7: Duplicate settlement is idempotent and safe", async () => {
        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurantA.id,
                tableId: tableA3.id,
                tableNo: "3",
                status: "OPEN",
            },
        });

        const order = await prisma.order.create({
            data: {
                restaurantId: restaurantA.id,
                tableSessionId: session.id,
                tableNo: "3",
                orderNo: `ORD-IDEM-DUP-${ts}`,
                status: "DELIVERED",
                paymentStatus: "PENDING",
                subtotal: 200,
                total: 200,
            },
        });

        // First call
        const res1 = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/3/settle-bill`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { paymentMode: "CASH" },
        });
        assert.equal(res1.statusCode, 200);
        assert.equal(JSON.parse(res1.payload).cleared, true);

        // Immediate duplicate call
        const res2 = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/3/settle-bill`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { paymentMode: "CASH" },
        });
        assert.equal(res2.statusCode, 200);
        assert.equal(JSON.parse(res2.payload).cleared, false);

        // Verify only 1 payment was created
        const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
        assert.equal(payments.length, 1, "Duplicate call must not create duplicate payment records");

        // Clean up
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
        await prisma.order.delete({ where: { id: order.id } });
        await prisma.tableSession.delete({ where: { id: session.id } });
    });
});
