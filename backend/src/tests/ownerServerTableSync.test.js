import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"];

async function createTestApp(emittedEvents = []) {
    const app = Fastify();
    await app.register(fastifyJwt, { secret: "test-assignment-sync-secret-key-9999" });

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
                    emittedEvents.push({ namespace: "root", room, event, data });
                },
            }),
        },
        staff: {
            to: (room) => ({
                emit: (event, data) => {
                    emittedEvents.push({ namespace: "staff", room, event, data });
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
    return { app, mockRealtime };
}

test("P0 Owner ↔ Server Station Table Assignment Sync Test Suite", async (t) => {
    const emittedEvents = [];
    const { app } = await createTestApp(emittedEvents);
    const ts = Date.now();

    // Setup Restaurant A and Restaurant B
    const restaurantA = await prisma.restaurant.create({
        data: {
            name: `Sync Cafe A ${ts}`,
            slug: `sync-cafe-a-${ts}`,
            currency: "INR",
        },
    });

    const restaurantB = await prisma.restaurant.create({
        data: {
            name: `Sync Cafe B ${ts}`,
            slug: `sync-cafe-b-${ts}`,
            currency: "INR",
        },
    });

    // Setup Owner A
    const ownerA = await prisma.user.create({
        data: {
            name: `Owner A ${ts}`,
            email: `owner-sync-a-${ts}@example.com`,
            password: "hashedpassword123",
            role: "OWNER",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    // Staff Kamalesh and Ravi in Restaurant A
    const kamalesh = await prisma.user.create({
        data: {
            name: `Kamalesh ${ts}`,
            email: `kamalesh-${ts}@example.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    const ravi = await prisma.user.create({
        data: {
            name: `Ravi ${ts}`,
            email: `ravi-${ts}@example.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: restaurantA.id,
            isActive: true,
        },
    });

    // Staff in Restaurant B for isolation verification
    const waiterB = await prisma.user.create({
        data: {
            name: `Waiter B ${ts}`,
            email: `waiter-b-${ts}@example.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: restaurantB.id,
            isActive: true,
        },
    });

    // Tables: Table 2 and T2 (to test identity collision immunity)
    const table2 = await prisma.diningTable.create({
        data: {
            restaurantId: restaurantA.id,
            tableNo: "2",
            seats: 4,
            isActive: true,
        },
    });

    const tableT2 = await prisma.diningTable.create({
        data: {
            restaurantId: restaurantA.id,
            tableNo: "T2",
            seats: 2,
            isActive: true,
        },
    });

    const tokenA = app.jwt.sign({
        userId: ownerA.id,
        role: ownerA.role,
        restaurantId: restaurantA.id,
    });

    t.after(async () => {
        try {
            await prisma.notification.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.tableWaiterAssignment.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.diningTable.deleteMany({
                where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
            });
            await prisma.user.deleteMany({
                where: { id: { in: [ownerA.id, kamalesh.id, ravi.id, waiterB.id] } },
            });
            await prisma.restaurant.deleteMany({
                where: { id: { in: [restaurantA.id, restaurantB.id] } },
            });
        } catch (_) {}
    });

    await t.test("1 & 2. Owner assigns Table 2 → Kamalesh: DB assignment is correct", async () => {
        emittedEvents.length = 0;
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${table2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: kamalesh.id, reason: "Lunch shift" },
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.ok, true);

        // Verify Database has authoritative IDs
        const dbTable = await prisma.diningTable.findUnique({ where: { id: table2.id } });
        assert.equal(dbTable.assignedWaiterId, kamalesh.id, "DiningTable.assignedWaiterId must equal Kamalesh User.id");
        assert.equal(dbTable.assignedWaiterName, kamalesh.name);
    });

    await t.test("3. Owner panel remains correct via GET /owner/:restaurantId/tables", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/owner/${restaurantA.id}/tables`,
            headers: { authorization: `Bearer ${tokenA}` },
        });

        assert.equal(res.statusCode, 200);
        const tables = JSON.parse(res.body);
        const found = tables.find((t) => t.id === table2.id);
        assert.ok(found, "Table 2 must exist");
        assert.equal(found.assignedWaiterId, kamalesh.id);
        assert.equal(found.assignedWaiterName, kamalesh.name);
    });

    await t.test("4 & 5. Server Station receives assignment event on /staff namespace immediately", async () => {
        // Must emit table:waiter_assigned and table:updated on staff namespace
        const staffAssignedEvents = emittedEvents.filter(
            (e) => e.namespace === "staff" && e.event === "table:waiter_assigned"
        );
        assert.ok(staffAssignedEvents.length > 0, "Realtime event table:waiter_assigned must be emitted on /staff namespace");

        const targetEvent = staffAssignedEvents.find((e) => e.data.tableId === table2.id);
        assert.ok(targetEvent, "Event payload must contain tableId");
        assert.equal(targetEvent.data.assignedWaiterId, kamalesh.id);
        assert.equal(targetEvent.data.tableNo, "2");
        assert.equal(targetEvent.data.restaurantId, restaurantA.id);

        // Verify targeted user room on staff namespace: user:userId or user_userId
        const userRoomEvent = staffAssignedEvents.find((e) => e.room === `user:${kamalesh.id}` || e.room === `user_${kamalesh.id}`);
        assert.ok(userRoomEvent, "Staff event must target user room on /staff namespace");
    });

    await t.test("6 & 7. Notification is persisted & online staff receives notification realtime", async () => {
        const notif = await prisma.notification.findFirst({
            where: { recipientId: kamalesh.id, restaurantId: restaurantA.id },
            orderBy: { createdAt: "desc" },
        });

        assert.ok(notif, "Notification must be persisted in database");
        assert.equal(notif.notificationType, NOTIFICATION_TYPES.TABLE_ASSIGNMENT);
        assert.ok(notif.title.includes("Table Assigned"), "Notification title must indicate Table Assigned");
        assert.equal(notif.message, `Table ${table2.tableNo} has been assigned to you. Please check/attend Table ${table2.tableNo}.`);
        assert.equal(notif.recipientId, kamalesh.id);

        // Realtime notification dispatch on staff namespace
        const staffNotifEvents = emittedEvents.filter(
            (e) => e.namespace === "staff" && e.event === "notification:new"
        );
        assert.ok(staffNotifEvents.length > 0, "Notification must be dispatched on /staff namespace");
        const kamaleshNotifEvent = staffNotifEvents.find(
            (e) => e.room === `user:${kamalesh.id}` || e.room === `user_${kamalesh.id}`
        );
        assert.ok(kamaleshNotifEvent, "Notification must be sent to Kamalesh user room on /staff namespace");
        assert.equal(kamaleshNotifEvent.data.recipientId, kamalesh.id);
    });

    await t.test("8 & 9. Offline staff can see persisted notification after login with correct recipient User.id", async () => {
        // Query as if Kamalesh logged in after being offline
        const notifications = await prisma.notification.findMany({
            where: {
                recipientId: kamalesh.id,
                recipientType: "USER",
                restaurantId: restaurantA.id,
            },
            orderBy: { createdAt: "desc" },
        });

        assert.ok(notifications.length > 0, "Persisted notification must exist for offline retrieval");
        assert.equal(notifications[0].recipientId, kamalesh.id, "Recipient ID must strictly match User.id");
        assert.equal(typeof notifications[0].recipientId, "number");
    });

    await t.test("10. Restaurant isolation: Restaurant A assignment does NOT leak to Restaurant B", async () => {
        const restBEvents = emittedEvents.filter((e) => e.room.includes(`restaurant_${restaurantB.id}`) || e.room.includes(`restaurant:${restaurantB.id}`));
        assert.equal(restBEvents.length, 0, "Zero events must be emitted to Restaurant B rooms");

        const waiterBNotifs = await prisma.notification.findMany({
            where: { recipientId: waiterB.id },
        });
        assert.equal(waiterBNotifs.length, 0, "Zero notifications must reach Restaurant B staff");
    });

    await t.test("11, 12, 13, 14. Reassignment: Kamalesh → Ravi", async () => {
        emittedEvents.length = 0;
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${table2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: ravi.id, reason: "Shift switch" },
        });

        assert.equal(res.statusCode, 200);

        // 1. DB updated
        const dbTable = await prisma.diningTable.findUnique({ where: { id: table2.id } });
        assert.equal(dbTable.assignedWaiterId, ravi.id, "Table 2 must now be assigned to Ravi");
        assert.equal(dbTable.assignedWaiterName, ravi.name);

        // 2. Ravi receives assignment event
        const staffEvents = emittedEvents.filter((e) => e.namespace === "staff" && e.event === "table:waiter_assigned");
        assert.ok(staffEvents.some((e) => e.data.assignedWaiterId === ravi.id));

        // 3. Ravi receives assignment notification
        const raviNotif = await prisma.notification.findFirst({
            where: { recipientId: ravi.id, restaurantId: restaurantA.id },
            orderBy: { createdAt: "desc" },
        });
        assert.ok(raviNotif, "Ravi must receive notification");
        assert.equal(raviNotif.recipientId, ravi.id);

        // 4. Kamalesh receives reassignment notification
        const kamaleshNotif = await prisma.notification.findFirst({
            where: { recipientId: kamalesh.id, restaurantId: restaurantA.id },
            orderBy: { createdAt: "desc" },
        });
        assert.ok(kamaleshNotif, "Previous waiter Kamalesh must receive reassignment notification");
        assert.ok(kamaleshNotif.title.includes("Reassigned") || kamaleshNotif.title.includes("Table Assigned"));
    });

    await t.test("15. Unassignment clears assignment and notifies previous staff", async () => {
        emittedEvents.length = 0;
        const res = await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${table2.id}/unassign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { reason: "End of shift" },
        });

        assert.equal(res.statusCode, 200);

        const dbTable = await prisma.diningTable.findUnique({ where: { id: table2.id } });
        assert.equal(dbTable.assignedWaiterId, null, "DiningTable assignedWaiterId must be null");
        assert.equal(dbTable.assignedWaiterName, null);

        // Unassigned event emitted
        const unassignEvents = emittedEvents.filter((e) => e.namespace === "staff" && e.event === "table:waiter_assigned");
        assert.ok(unassignEvents.some((e) => e.data.tableId === table2.id && e.data.assignedWaiterId === null));
    });

    await t.test("16. Table 2 and Table T2 do not collide", async () => {
        // Assign Table 2 to Kamalesh
        await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${table2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: kamalesh.id },
        });

        // Assign Table T2 to Ravi
        await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${tableT2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: ravi.id },
        });

        // Verify database distinct records
        const dbTable2 = await prisma.diningTable.findUnique({ where: { id: table2.id } });
        const dbTableT2 = await prisma.diningTable.findUnique({ where: { id: tableT2.id } });

        assert.equal(dbTable2.id, table2.id);
        assert.equal(dbTableT2.id, tableT2.id);
        assert.notEqual(dbTable2.id, dbTableT2.id);

        assert.equal(dbTable2.tableNo, "2");
        assert.equal(dbTableT2.tableNo, "T2");

        assert.equal(dbTable2.assignedWaiterId, kamalesh.id, "Table 2 must be assigned to Kamalesh");
        assert.equal(dbTableT2.assignedWaiterId, ravi.id, "Table T2 must be assigned to Ravi without collision");
    });

    await t.test("17. Duplicate assignment clicks do not create duplicate notifications", async () => {
        const notifsBefore = await prisma.notification.count({
            where: { recipientId: kamalesh.id, restaurantId: restaurantA.id },
        });

        // Duplicate click 1
        await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${table2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: kamalesh.id },
        });

        // Duplicate click 2 within same time window
        await app.inject({
            method: "POST",
            url: `/owner/${restaurantA.id}/tables/${table2.id}/assign-waiter`,
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { waiterId: kamalesh.id },
        });

        const notifsAfter = await prisma.notification.count({
            where: { recipientId: kamalesh.id, restaurantId: restaurantA.id },
        });

        // Because of idempotencyKey deduplication, only 0 or 1 new notification was added (not 2 duplicate notifications)
        assert.ok(notifsAfter - notifsBefore <= 1, "Duplicate assignment clicks must be deduplicated by idempotency key");
    });
});
