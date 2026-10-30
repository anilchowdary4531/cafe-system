import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import notificationRoutes from "../routes/notification.routes.js";
import staffTaskRoutes from "../routes/staffTasks.routes.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "SERVER", "CHEF", "CASHIER", "STEWARD", "CLEANER", "SWIPER", "STAFF"];

function createSimulatedSocketServer() {
  const namespaces = new Map();
  const receivedBySocket = new Map();

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
      of: (name) => (name === "/staff" ? staff : io),
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

test("TIFFZY ORDER LIFECYCLE DELIVERY & NOTIFICATION RESOLUTION SUITE", async (t) => {
  const ts = Date.now();
  const simulated = createSimulatedSocketServer();

  // 1. Setup Test Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Lifecycle QA Rest ${ts}`,
      slug: `lifecycle-qa-${ts}`,
      currency: "INR",
      nextInvoiceNumber: 1001,
      nextKotNumber: 1,
    },
  });
  const rid = restaurant.id;

  // 2. Setup Dining Table (Main Hall Table 1)
  const mainHallTable1 = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "1",
      section: "Main Hall",
      seats: 4,
      isActive: true,
    },
  });

  // 3. Setup Users
  const serverUser = await prisma.user.create({
    data: {
      name: `Server Main Hall ${ts}`,
      email: `server-mh-${ts}@tiffzy.com`,
      password: "hashed_pwd",
      role: "WAITER",
      designation: "SERVER",
      restaurantId: rid,
      isActive: true,
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      name: `Owner Tiffzy ${ts}`,
      email: `owner-${ts}@tiffzy.com`,
      password: "hashed_pwd",
      role: "OWNER",
      designation: "OWNER",
      restaurantId: rid,
      isActive: true,
    },
  });

  const chefUser = await prisma.user.create({
    data: {
      name: `Chef Tiffzy ${ts}`,
      email: `chef-${ts}@tiffzy.com`,
      password: "hashed_pwd",
      role: "CHEF",
      designation: "CHEF",
      restaurantId: rid,
      isActive: true,
    },
  });

  // 4. Setup Station & Menu Item
  const kitchenStation = await prisma.kitchenStation.create({
    data: {
      restaurantId: rid,
      name: "Main Kitchen",
      isDefault: true,
      isActive: true,
    },
  });

  const menuItem1 = await prisma.menuItem.create({
    data: {
      restaurantId: rid,
      category: "Main Course",
      kitchenStationId: kitchenStation.id,
      name: `Biryani Special ${ts}`,
      price: 320,
      isAvailable: true,
    },
  });

  // 5. Register Simulated Sockets
  simulated.registerSocket("staff", "sock_server", [
    `restaurant:${rid}`,
    `restaurant_${rid}`,
    `user:${serverUser.id}`,
    `user_${serverUser.id}`,
  ]);

  simulated.registerSocket("staff", "sock_owner", [
    `restaurant:${rid}`,
    `restaurant_${rid}`,
    `user:${ownerUser.id}`,
    `user_${ownerUser.id}`,
  ]);

  // 6. Build Fastify App
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test_secret_tiffzy_jwt_123" });
  app.decorateRequest("staffActor", null);
  app.io = simulated.io;
  app.staff = simulated.staff;
  app.realtime = simulated;
  app.addHook("onRequest", async (req) => {
    req.prisma = prisma;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = app.jwt.verify(authHeader.replace("Bearer ", ""));
        req.user = decoded;
        req.staffActor = {
          userId: decoded.id || decoded.userId,
          role: decoded.role,
          designation: decoded.designation,
          restaurantId: decoded.restaurantId,
          userName: decoded.name,
        };
      } catch (_) {}
    }
  });

  const serverToken = app.jwt.sign({
    id: serverUser.id,
    userId: serverUser.id,
    email: serverUser.email,
    role: "WAITER",
    designation: "SERVER",
    restaurantId: rid,
    name: serverUser.name,
  });

  const ownerToken = app.jwt.sign({
    id: ownerUser.id,
    userId: ownerUser.id,
    email: ownerUser.email,
    role: "OWNER",
    designation: "OWNER",
    restaurantId: rid,
    name: ownerUser.name,
  });

  const chefToken = app.jwt.sign({
    id: chefUser.id,
    userId: chefUser.id,
    email: chefUser.email,
    role: "CHEF",
    designation: "CHEF",
    restaurantId: rid,
    name: chefUser.name,
  });

  const deps = {
    prisma,
    realtime: simulated,
    STAFF_ALLOWED_ROLES,
    normalizeAccess: (a) => a,
  };

  await app.register(async (instance) => {
    await ownerRoutes(instance, deps);
    await notificationRoutes(instance, deps);
    await staffTaskRoutes(instance, deps);
  });

  await app.ready();

  t.after(async () => {
    if (rid) {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: rid } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: rid } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: rid } } });
      await prisma.orderStatusEvent.deleteMany({ where: { order: { restaurantId: rid } } });
      await prisma.order.deleteMany({ where: { restaurantId: rid } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: rid } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenStation.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
    }
    if (app) await app.close();
  });

  // TEST 1: The exact production scenario:
  // Server places order for Main Hall Table 1 -> Kitchen prepares & marks READY -> Server delivers order
  await t.test("1. Production Scenario: Server order -> Kitchen READY -> Server delivers -> KOT SERVED & Notifications sent to Server and Owner", async () => {
    // Step 1: Server places ONE order for Main Hall Table 1
    const orderRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        tableId: mainHallTable1.id,
        tableNo: mainHallTable1.tableNo,
        waiterId: serverUser.id,
        waiterName: serverUser.name,
        items: [{ menuItemId: menuItem1.id, qty: 1 }],
      },
    });

    assert.equal(orderRes.statusCode, 201);
    const orderPayload = JSON.parse(orderRes.payload);
    const orderId = orderPayload.order.id;
    assert.ok(orderPayload.order.kots?.length > 0);
    const kotId = orderPayload.order.kots[0].id;

    // Step 2: Kitchen marks KOT READY
    const readyRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kots/${kotId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });
    assert.equal(readyRes.statusCode, 200);

    const kotReady = await prisma.kitchenOrderTicket.findUnique({ where: { id: kotId } });
    assert.equal(kotReady.status, "READY");

    // Verify Server has FOOD_READY notification
    const serverReadyNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        notificationType: NOTIFICATION_TYPES.FOOD_READY,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverUser.id,
      },
    });
    assert.equal(serverReadyNotifs.length, 1);

    // Step 3: Server delivers the order to Table 1 (marks order DELIVERED)
    const deliverRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/orders/${orderId}/status`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: { status: "DELIVERED", changedByName: serverUser.name },
    });
    assert.equal(deliverRes.statusCode, 200);

    // Step 4: Verify KOT status is SERVED (Kitchen Live KOT shows DELIVERED, not stuck at READY)
    const kotDelivered = await prisma.kitchenOrderTicket.findUnique({ where: { id: kotId } });
    assert.equal(kotDelivered.status, "SERVED", "KOT must transition to SERVED when order is DELIVERED");

    // Step 5: Verify Order status is DELIVERED
    const orderDelivered = await prisma.order.findUnique({ where: { id: orderId } });
    assert.equal(orderDelivered.status, "DELIVERED");

    // Step 6: Verify Server Notifications has ORDER_DELIVERED
    const serverDeliveredNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverUser.id,
      },
    });
    assert.equal(serverDeliveredNotifs.length, 1, "Server must receive ORDER_DELIVERED notification");

    // Step 7: Verify Owner Notifications has ORDER_DELIVERED
    const ownerDeliveredNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: rid,
      },
    });
    assert.equal(ownerDeliveredNotifs.length, 1, "Owner must receive ORDER_DELIVERED notification");

    // Step 8: Verify GET /api/notifications for Server includes ORDER_DELIVERED
    const serverGetNotifs = await app.inject({
      method: "GET",
      url: "/api/notifications?page=1&limit=10",
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(serverGetNotifs.statusCode, 200);
    const serverData = JSON.parse(serverGetNotifs.payload);
    const hasServerDelivered = (serverData.notifications || []).some((n) => n.notificationType === NOTIFICATION_TYPES.ORDER_DELIVERED);
    assert.ok(hasServerDelivered, "Server notification list must include ORDER_DELIVERED");

    // Step 9: Verify GET /api/notifications for Owner includes ORDER_DELIVERED
    const ownerGetNotifs = await app.inject({
      method: "GET",
      url: "/api/notifications?page=1&limit=10",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(ownerGetNotifs.statusCode, 200);
    const ownerData = JSON.parse(ownerGetNotifs.payload);
    const hasOwnerDelivered = (ownerData.notifications || []).some((n) => n.notificationType === NOTIFICATION_TYPES.ORDER_DELIVERED);
    assert.ok(hasOwnerDelivered, "Owner notification list must include ORDER_DELIVERED");
  });

  // TEST 2: Delivery via KOT status endpoint (PUT /owner/:restaurantId/kots/:kotId/status)
  await t.test("2. Delivery via KOT status SERVED -> Order transitions to DELIVERED & Notifications sent", async () => {
    const orderRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        tableId: mainHallTable1.id,
        tableNo: mainHallTable1.tableNo,
        waiterId: serverUser.id,
        waiterName: serverUser.name,
        items: [{ menuItemId: menuItem1.id, qty: 1 }],
      },
    });
    const orderPayload = JSON.parse(orderRes.payload);
    const orderId = orderPayload.order.id;
    const kotId = orderPayload.order.kots[0].id;

    // Kitchen marks READY
    await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kots/${kotId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });

    // Server marks KOT SERVED
    const serveRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kots/${kotId}/status`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: { status: "SERVED" },
    });
    assert.equal(serveRes.statusCode, 200);

    const reloadedKot = await prisma.kitchenOrderTicket.findUnique({ where: { id: kotId } });
    assert.equal(reloadedKot.status, "SERVED");

    const reloadedOrder = await prisma.order.findUnique({ where: { id: orderId } });
    assert.equal(reloadedOrder.status, "DELIVERED");

    // Notifications check
    const serverDelivered = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        orderId,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverUser.id,
      },
    });
    assert.equal(serverDelivered.length, 1);

    const ownerDelivered = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        orderId,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
      },
    });
    assert.equal(ownerDelivered.length, 1);
  });
});
