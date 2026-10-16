import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import { assignWaiterToTable, unassignWaiterFromTable } from "../services/staffManagementService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"];

/**
 * Creates an in-memory Realtime broadcaster that adheres strictly to Socket.IO semantics:
 * Sockets join rooms. A chained .to(roomA).to(roomB).emit(event, payload) resolves all matching
 * unique sockets across those target rooms and delivers the event to each unique socket EXACTLY ONCE.
 */
function createSimulatedSocketServer() {
    const namespaces = new Map(); // nsName -> Map(socketId -> Set(rooms))
    const receivedBySocket = new Map(); // socketId -> Array({ ns, event, payload })

    const getNamespaceSockets = (nsName) => {
        if (!namespaces.has(nsName)) {
            namespaces.set(nsName, new Map());
        }
        return namespaces.get(nsName);
    };

    const registerSocket = (nsName, socketId, roomsArray = []) => {
        const nsSockets = getNamespaceSockets(nsName);
        nsSockets.set(socketId, new Set(roomsArray));
        if (!receivedBySocket.has(socketId)) {
            receivedBySocket.set(socketId, []);
        }
        return {
            id: socketId,
            join: (r) => {
                const list = Array.isArray(r) ? r : [r];
                list.forEach((room) => nsSockets.get(socketId)?.add(room));
            },
            getReceived: () => receivedBySocket.get(socketId) || [],
        };
    };

    const createNamespace = (nsName) => {
        const createBroadcaster = (targetRooms = []) => {
            return {
                to: (room) => createBroadcaster([...targetRooms, room]),
                emit: (event, payload) => {
                    const nsSockets = getNamespaceSockets(nsName);
                    const matchingSockets = new Set();
                    for (const [sockId, roomSet] of nsSockets.entries()) {
                        for (const targetRoom of targetRooms) {
                            if (roomSet.has(targetRoom)) {
                                matchingSockets.add(sockId);
                                break;
                            }
                        }
                    }
                    for (const sockId of matchingSockets) {
                        receivedBySocket.get(sockId)?.push({ ns: nsName, event, payload });
                    }
                },
            };
        };

        return {
            to: (room) => createBroadcaster([room]),
            emit: (event, payload) => createBroadcaster([]).emit(event, payload),
        };
    };

    const io = createNamespace("root");
    const staff = createNamespace("staff");

    return {
        io,
        staff,
        registerSocket,
        getSocketEvents: (sockId) => receivedBySocket.get(sockId) || [],
    };
}

test("Regression Test: Table Assignment / Unassignment Notification Deduplication & Room Targeting", async (t) => {
    const ts = Date.now();
    const simulated = createSimulatedSocketServer();

    // 1. Create Restaurant
    const restaurant = await prisma.restaurant.create({
        data: {
            name: `Dedupe Cafe ${ts}`,
            slug: `dedupe-cafe-${ts}`,
            currency: "INR",
        },
    });
    const rid = restaurant.id;

    // 2. Create Users: Owner, Server A (assigned), Server B (other server)
    const owner = await prisma.user.create({
        data: {
            name: `Owner Dedupe ${ts}`,
            email: `owner-dedupe-${ts}@test.com`,
            password: "hashedpassword123",
            role: "OWNER",
            restaurantId: rid,
            isActive: true,
        },
    });

    const serverA = await prisma.user.create({
        data: {
            name: `Server A ${ts}`,
            email: `server-a-${ts}@test.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: rid,
            isActive: true,
        },
    });

    const serverB = await prisma.user.create({
        data: {
            name: `Server B ${ts}`,
            email: `server-b-${ts}@test.com`,
            password: "hashedpassword123",
            role: "STAFF",
            designation: "Waiter",
            restaurantId: rid,
            isActive: true,
        },
    });

    // 3. Create Dining Table 3
    const table3 = await prisma.diningTable.create({
        data: {
            restaurantId: rid,
            tableNo: `T3-${ts}`,
            seats: 4,
            isActive: true,
        },
    });

    // 4. Simulate active staff sockets for Server A and Server B
    // Server A socket is joined to all 4 rooms: restaurant:rid, restaurant_rid, user:serverA.id, user_serverA.id
    simulated.registerSocket("staff", "socket_server_a", [
        `restaurant:${rid}`,
        `restaurant_${rid}`,
        `user:${serverA.id}`,
        `user_${serverA.id}`,
    ]);

    // Server B socket is joined to restaurant rooms and Server B user rooms
    simulated.registerSocket("staff", "socket_server_b", [
        `restaurant:${rid}`,
        `restaurant_${rid}`,
        `user:${serverB.id}`,
        `user_${serverB.id}`,
    ]);

    t.after(async () => {
        try {
            await prisma.notification.deleteMany({ where: { restaurantId: rid } });
            await prisma.tableWaiterAssignment.deleteMany({ where: { restaurantId: rid } });
            await prisma.tableSession.deleteMany({ where: { restaurantId: rid } });
            await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
            await prisma.user.deleteMany({ where: { restaurantId: rid } });
            await prisma.restaurant.deleteMany({ where: { id: rid } });
        } catch (_) {}
    });

    await t.test("1. Assigning Server A to Table 3 produces exactly 1 DB notification and 1 socket event to Server A, 0 to Server B", async () => {
        const actor = { userId: owner.id, userName: owner.name, role: owner.role };

        const result = await assignWaiterToTable({
            prisma,
            restaurantId: rid,
            tableId: table3.id,
            waiterId: serverA.id,
            actor,
            reason: "Initial assignment",
            realtime: { io: simulated.io, staff: simulated.staff },
        });

        assert.ok(result.table);
        assert.equal(result.table.assignedWaiterId, serverA.id);

        // 1. Assert exactly 1 database notification was created for this assignment
        const dbNotifications = await prisma.notification.findMany({
            where: {
                restaurantId: rid,
                recipientId: serverA.id,
                notificationType: NOTIFICATION_TYPES.TABLE_ASSIGNMENT,
            },
        });
        assert.equal(dbNotifications.length, 1, "Exactly ONE database notification record must be created for this assignment");
        assert.ok(dbNotifications[0].title.includes("Table Assigned"), "Notification title must contain Table Assigned");
        assert.equal(dbNotifications[0].recipientType, RECIPIENT_TYPES.USER);

        // 2. Assert Server A received exactly 1 notification:new event
        const serverAEvents = simulated.getSocketEvents("socket_server_a").filter((e) => e.event === "notification:new");
        assert.equal(
            serverAEvents.length,
            1,
            `Server A must receive exactly ONE notification:new event, but received ${serverAEvents.length}`
        );
        assert.equal(serverAEvents[0].payload.recipientId, serverA.id);
        assert.ok(serverAEvents[0].payload.title.includes("Table Assigned"));

        // 3. Assert Server B received 0 notification:new events (user-targeted notification did NOT broadcast restaurant-wide)
        const serverBEvents = simulated.getSocketEvents("socket_server_b").filter((e) => e.event === "notification:new");
        assert.equal(
            serverBEvents.length,
            0,
            `Server B must receive 0 notification:new events for Server A's assignment, but received ${serverBEvents.length}`
        );
    });

    await t.test("2. Unassigning Server A produces exactly 1 DB notification and 1 socket event to Server A, 0 to Server B", async () => {
        const actor = { userId: owner.id, userName: owner.name, role: owner.role };

        // Clear event buffer before unassignment
        simulated.getSocketEvents("socket_server_a").length = 0;
        simulated.getSocketEvents("socket_server_b").length = 0;

        await unassignWaiterFromTable({
            prisma,
            restaurantId: rid,
            tableId: table3.id,
            actor,
            reason: "Shift completed",
            realtime: { io: simulated.io, staff: simulated.staff },
        });

        // 1. Assert exactly 1 database unassignment notification was created for Server A
        const dbUnassignNotifications = await prisma.notification.findMany({
            where: {
                restaurantId: rid,
                recipientId: serverA.id,
                notificationType: NOTIFICATION_TYPES.TABLE_UNASSIGNED,
            },
        });
        assert.equal(dbUnassignNotifications.length, 1, "Exactly ONE database unassignment notification must exist");

        // 2. Assert Server A received exactly 1 notification:new event
        const serverAUnassignEvents = simulated.getSocketEvents("socket_server_a").filter((e) => e.event === "notification:new");
        assert.equal(
            serverAUnassignEvents.length,
            1,
            `Server A must receive exactly ONE unassignment event, but received ${serverAUnassignEvents.length}`
        );
        assert.ok(
            serverAUnassignEvents[0].payload.title.includes("Unassigned Table"),
            `Expected title to include 'Unassigned Table', got: ${serverAUnassignEvents[0].payload.title}`
        );

        // 3. Assert Server B received 0 unassignment events
        const serverBUnassignEvents = simulated.getSocketEvents("socket_server_b").filter((e) => e.event === "notification:new");
        assert.equal(
            serverBUnassignEvents.length,
            0,
            `Server B must receive 0 events for Server A's unassignment, but received ${serverBUnassignEvents.length}`
        );
    });

    await t.test("3. Rapid accidental repeated assignment triggers do not produce duplicate notifications (Idempotency protection)", async () => {
        const actor = { userId: owner.id, userName: owner.name, role: owner.role };

        simulated.getSocketEvents("socket_server_a").length = 0;

        // Perform assignment twice in rapid succession
        await assignWaiterToTable({
            prisma,
            restaurantId: rid,
            tableId: table3.id,
            waiterId: serverA.id,
            actor,
            reason: "Rapid click 1",
            realtime: { io: simulated.io, staff: simulated.staff },
        });

        await assignWaiterToTable({
            prisma,
            restaurantId: rid,
            tableId: table3.id,
            waiterId: serverA.id,
            actor,
            reason: "Rapid click 2",
            realtime: { io: simulated.io, staff: simulated.staff },
        });

        const totalNotifications = await prisma.notification.findMany({
            where: {
                restaurantId: rid,
                recipientId: serverA.id,
                notificationType: NOTIFICATION_TYPES.TABLE_ASSIGNMENT,
            },
        });

        // Due to idempotencyKey `waiter_assigned_${tid}_${waiter.id}_${Math.floor(Date.now() / 30000)}`
        assert.equal(totalNotifications.length, 1, "Rapid duplicate assignment must NOT create duplicate DB notifications");
    });
});
