import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"];

async function createTestApp(emittedEvents = []) {
    const app = Fastify();
    await app.register(fastifyJwt, { secret: "test-assignment-secret-key-12345" });

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
        io: {
            to: (room) => ({
                emit: (event, data) => {
                    emittedEvents.push({ room, event, data });
                },
            }),
        },
    };

    const buildQrTargetUrl = (slug, tableNo) => `/menu/${slug}?table=${tableNo}`;

    await ownerRoutes(app, {
        prisma,
        realtime: mockRealtime,
        buildQrTargetUrl,
        STAFF_ALLOWED_ROLES,
    });
    await app.ready();
    return app;
}

test("Server Assignment, Table Mapping & Connection Audit — Backend Test Suite", async (t) => {
    const emittedEvents = [];
    const app = await createTestApp(emittedEvents);
    const ts = Date.now();

    // 1. Setup test restaurants & users
    const restaurantA = await prisma.restaurant.create({
        data: {
            name: `Test Cafe A ${ts}`,
            slug: `test-cafe-a-${ts}`,
            currency: "INR",
        },
    });

    const restaurantB = await prisma.restaurant.create({
        data: {
            name: `Test Cafe B ${ts}`,
            slug: `test-cafe-b-${ts}`,
            currency: "INR",
        },
    });

    const ownerA = await prisma.user.create({
        data: {
            name: `Owner A ${ts}`,
            email: `owner-a-${ts}@example.com`,
            password: "hashedpassword123",
            role: "OWNER",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    const serverA1 = await prisma.user.create({
        data: {
            name: `Server Rahul ${ts}`,
            email: `server-a1-${ts}@example.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    const serverA2 = await prisma.user.create({
        data: {
            name: `Server Priya ${ts}`,
            email: `server-a2-${ts}@example.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    const serverB = await prisma.user.create({
        data: {
            name: `Server Vikram ${ts}`,
            email: `server-b-${ts}@example.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: restaurantB.id,
            isActive: true,
        },
    });

    const tableA2 = await prisma.diningTable.create({
        data: {
            restaurantId: restaurantA.id,
            tableNo: "2",
            seats: 4,
            isActive: true,
        },
    });

    const menuItemA = await prisma.menuItem.create({
        data: {
            restaurantId: restaurantA.id,
            name: `Test Cold Brew ${ts}`,
            category: "Beverages",
            price: 150,
            isAvailable: true,
        },
    });

    const tokenA = app.jwt.sign({
        userId: ownerA.id,
        role: ownerA.role,
        restaurantId: restaurantA.id,
    });

    t.after(async () => {
        try {
            await prisma.tableWaiterAssignment.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.kitchenOrderTicketItem.deleteMany({
                where: { kot: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } },
            });
            await prisma.kitchenOrderTicket.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.orderItem.deleteMany({
                where: { order: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } },
            });
            await prisma.order.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.tableSession.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.menuItem.deleteMany({
                where: { id: menuItemA.id },
            });
            await prisma.diningTable.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.user.deleteMany({
                where: { id: { in: [ownerA.id, serverA1.id, serverA2.id, serverB.id] } },
            });
            await prisma.restaurant.deleteMany({
                where: { id: { in: [restaurantA.id, restaurantB.id] } },
            });
        } catch (e) {
            // cleanup
        }
    });

    await t.test("1. Stage 1 & 2: Assign server to available table", async () => {
        emittedEvents.length = 0;
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                waiterId: serverA1.id,
                reason: "Shift table assignment",
            },
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.ok, true);
        assert.equal(body.table.assignedWaiterId, serverA1.id);
        assert.equal(body.table.assignedWaiterName, serverA1.name);

        // Verify database persistence
        const dbTable = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
        assert.equal(dbTable.assignedWaiterId, serverA1.id);
        assert.equal(dbTable.assignedWaiterName, serverA1.name);

        // Verify assignment log was created
        const log = await prisma.tableWaiterAssignment.findFirst({
            where: { tableId: tableA2.id, waiterId: serverA1.id },
            orderBy: { createdAt: "desc" },
        });
        assert.ok(log);
        assert.equal(log.action, "ASSIGNED");

        // Verify realtime events were emitted
        const updatedEvent = emittedEvents.find(e => e.event === "table:updated" && e.data.tableId === tableA2.id);
        assert.ok(updatedEvent, "table:updated event should be emitted via Socket.IO");
        assert.equal(updatedEvent.data.assignedWaiterId, serverA1.id);
    });

    await t.test("2. Stage 3: Retrieve table overview and verify assigned server in GET /tables", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restaurantA.id}/tables`,
            headers: { authorization: `Bearer ${tokenA}` },
        });

        assert.equal(res.statusCode, 200);
        const tables = JSON.parse(res.body);
        const t2 = tables.find(t => t.id === tableA2.id);
        assert.ok(t2, "Table 2 must exist in GET /tables response");
        assert.equal(t2.assignedWaiterId, serverA1.id, "Table 2 must have assignedWaiterId");
        assert.equal(t2.assignedWaiterName, serverA1.name, "Table 2 must have assignedWaiterName");
    });

    await t.test("3. Stage 2: Reassign table to another server", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                waiterId: serverA2.id,
                reason: "Reassigned to Server Priya",
            },
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.table.assignedWaiterId, serverA2.id);
        assert.equal(body.table.assignedWaiterName, serverA2.name);

        const dbTable = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
        assert.equal(dbTable.assignedWaiterId, serverA2.id);
    });

    await t.test("4. Security: Reject cross-restaurant server assignment", async () => {
        // Attempt to assign serverB (from Restaurant B) to tableA2 (in Restaurant A)
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                waiterId: serverB.id,
            },
        });

        assert.equal(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.match(body.message, /waiter not found/i);
    });

    await t.test("5. Security: Reject invalid table and server IDs", async () => {
        const resInvalidTable = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/999999/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: serverA1.id },
        });
        assert.equal(resInvalidTable.statusCode, 400);

        const resInvalidServer = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: 999999 },
        });
        assert.equal(resInvalidServer.statusCode, 400);
    });

    await t.test("6. Stage 5: Unassign server via /unassign-waiter", async () => {
        emittedEvents.length = 0;
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/unassign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { reason: "End of shift unassignment" },
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.ok, true);
        assert.equal(body.table.assignedWaiterId, null);
        assert.equal(body.table.assignedWaiterName, null);

        const dbTable = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
        assert.equal(dbTable.assignedWaiterId, null);
        assert.equal(dbTable.assignedWaiterName, null);

        const unassignLog = await prisma.tableWaiterAssignment.findFirst({
            where: { tableId: tableA2.id, action: "UNASSIGNED" },
            orderBy: { createdAt: "desc" },
        });
        assert.ok(unassignLog);
    });

    await t.test("7. Lifecycle: Table clearing preserves server assignment by default", async () => {
        // First re-assign serverA1
        await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: serverA1.id },
        });

        // Create an active session and order on Table 2
        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurantA.id,
                tableId: tableA2.id,
                tableNo: tableA2.tableNo,
                status: "OPEN",
                waiterId: serverA1.id,
                waiterName: serverA1.name,
                openedAt: new Date(),
            },
        });

        await prisma.order.create({
            data: {
                restaurantId: restaurantA.id,
                orderNo: `ORD-${ts}-1`,
                tableNo: tableA2.tableNo,
                tableSessionId: session.id,
                status: "DELIVERED",
                subtotal: 250,
                total: 250,
            },
        });

        // Now clear table (without clearWaiter flag)
        const clearRes = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableA2.id}/clear`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { force: true, reason: "Guests completed meal" },
        });

        assert.equal(clearRes.statusCode, 200);

        // Verify session is closed, but assignedWaiterId remains intact on diningTable
        const dbTable = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
        assert.equal(dbTable.assignedWaiterId, serverA1.id, "Assigned waiter must be preserved across table clearing");
        assert.equal(dbTable.assignedWaiterName, serverA1.name);

        const closedSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
        assert.equal(closedSession.status, "CLOSED");
    });

    await t.test("8. Order placement preserves table server assignment and associates server with session & KOT", async () => {
        // Ensure Table 2 has serverA1 assigned
        const dbTableBefore = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
        assert.equal(dbTableBefore.assignedWaiterId, serverA1.id);

        // Place an order for Table 2
        const orderRes = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/orders`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: {
                tableNo: tableA2.tableNo,
                fulfillment: "DINEIN",
                orderSource: "POS",
                items: [
                    {
                        menuItemId: menuItemA.id,
                        qty: 2,
                    },
                ],
            },
        });

        assert.equal(orderRes.statusCode, 201);
        const body = JSON.parse(orderRes.body);
        const orderData = body.order;
        assert.ok(orderData.id);
        assert.ok(orderData.tableSessionId, "Order should create or link to table session");

        // Verify table session has the assigned server from the dining table
        const session = await prisma.tableSession.findUnique({
            where: { id: orderData.tableSessionId },
        });
        assert.ok(session);
        assert.equal(session.waiterId, serverA1.id, "Table session must inherit assigned server ID");
        assert.equal(session.waiterName, serverA1.name, "Table session must inherit assigned server name");

        // Verify dining table assignment is intact
        const dbTableAfter = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
        assert.equal(dbTableAfter.assignedWaiterId, serverA1.id, "Dining table server assignment must NOT be removed on order creation");

        // Verify status lifecycle transitions preserve table server assignment
        const statusTransitions = ["ACCEPTED", "PREPARING", "READY", "DELIVERED"];
        for (const st of statusTransitions) {
            const stRes = await app.inject({
                method: "PUT",
                url: `/owner/${restaurantA.id}/orders/${orderData.id}/status`,
                headers: { authorization: `Bearer ${tokenA}` },
                payload: {
                    status: st,
                    changedByName: "Owner",
                },
            });
            assert.equal(stRes.statusCode, 200);

            const tableCheck = await prisma.diningTable.findUnique({ where: { id: tableA2.id } });
            assert.equal(tableCheck.assignedWaiterId, serverA1.id, `Server assignment must be preserved when order transitions to ${st}`);
        }
    });
});
