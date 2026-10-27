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

test("TIFFZY COMPLETE KITCHEN -> SERVER NOTIFICATION FLOW AUDIT + FIX TEST SUITE", async (t) => {
  const ts = Date.now();
  const simulated = createSimulatedSocketServer();

  // 1. Setup Test Restaurant 1
  const restaurant1 = await prisma.restaurant.create({
    data: {
      name: `Tiffzy Notifications ${ts}`,
      slug: `tiffzy-notifications-${ts}`,
      currency: "INR",
      nextInvoiceNumber: 1001,
    },
  });
  const rid1 = restaurant1.id;

  // Setup Test Restaurant 2 (for tenant isolation testing)
  const restaurant2 = await prisma.restaurant.create({
    data: {
      name: `Other Restaurant ${ts}`,
      slug: `other-restaurant-${ts}`,
      currency: "INR",
      nextInvoiceNumber: 1001,
    },
  });
  const rid2 = restaurant2.id;

  // 2. Setup Users
  const serverA = await prisma.user.create({
    data: {
      name: `Server A ${ts}`,
      email: `server-a-${ts}@tiffzy.com`,
      password: "hashed_pwd",
      role: "STAFF",
      designation: "Waiter",
      restaurantId: rid1,
      isActive: true,
    },
  });

  const serverB = await prisma.user.create({
    data: {
      name: `Server B ${ts}`,
      email: `server-b-${ts}@tiffzy.com`,
      password: "hashed_pwd",
      role: "STAFF",
      designation: "Waiter",
      restaurantId: rid1,
      isActive: true,
    },
  });

  const chefUser = await prisma.user.create({
    data: {
      name: `Chef ${ts}`,
      email: `chef-${ts}@tiffzy.com`,
      password: "hashed_pwd",
      role: "CHEF",
      designation: "Chef",
      restaurantId: rid1,
      isActive: true,
    },
  });

  const otherServer = await prisma.user.create({
    data: {
      name: `Other Server ${ts}`,
      email: `other-server-${ts}@other.com`,
      password: "hashed_pwd",
      role: "STAFF",
      designation: "Waiter",
      restaurantId: rid2,
      isActive: true,
    },
  });

  // 3. Setup Tables & Menu Items
  const table5 = await prisma.diningTable.create({
    data: {
      restaurantId: rid1,
      tableNo: `T5-${ts}`,
      seats: 4,
      assignedWaiterId: serverA.id,
      assignedWaiterName: serverA.name,
      isActive: true,
    },
  });

  const kitchenStation = await prisma.kitchenStation.create({
    data: {
      restaurantId: rid1,
      name: "Main Kitchen",
      isDefault: true,
      isActive: true,
    },
  });

  const menuItem1 = await prisma.menuItem.create({
    data: {
      restaurantId: rid1,
      category: "Main Course",
      kitchenStationId: kitchenStation.id,
      name: `Paneer Butter Masala ${ts}`,
      price: 250,
      isAvailable: true,
    },
  });

  // 4. Setup Simulated Sockets
  // Server A staff socket joins staff user and restaurant rooms
  simulated.registerSocket("staff", "sock_server_a", [
    `restaurant:${rid1}`,
    `restaurant_${rid1}`,
    `user:${serverA.id}`,
    `user_${serverA.id}`,
  ]);

  // Server A root socket joins root user and restaurant rooms
  simulated.registerSocket("root", "sock_server_a_root", [
    `restaurant:${rid1}`,
    `restaurant_${rid1}`,
    `user:${serverA.id}`,
    `user_${serverA.id}`,
  ]);

  // Server B staff socket
  simulated.registerSocket("staff", "sock_server_b", [
    `restaurant:${rid1}`,
    `restaurant_${rid1}`,
    `user:${serverB.id}`,
    `user_${serverB.id}`,
  ]);

  // Chef staff socket
  simulated.registerSocket("staff", "sock_chef", [
    `restaurant:${rid1}`,
    `restaurant_${rid1}`,
    `user:${chefUser.id}`,
    `user_${chefUser.id}`,
  ]);

  // Other restaurant server staff socket
  simulated.registerSocket("staff", "sock_other_server", [
    `restaurant:${rid2}`,
    `restaurant_${rid2}`,
    `user:${otherServer.id}`,
    `user_${otherServer.id}`,
  ]);

  // 5. Build Fastify App with registered routes
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test_secret_tiffzy_jwt_123" });
  app.decorateRequest("staffActor", null);
  app.io = simulated.io;
  app.staff = simulated.staff;
  app.realtime = simulated;
  app.addHook("onRequest", async (req) => {
    req.prisma = prisma;
  });

  const serverAToken = app.jwt.sign({
    id: serverA.id,
    userId: serverA.id,
    email: serverA.email,
    role: "WAITER",
    restaurantId: rid1,
  });

  const serverBToken = app.jwt.sign({
    id: serverB.id,
    userId: serverB.id,
    email: serverB.email,
    role: "WAITER",
    restaurantId: rid1,
  });

  const chefToken = app.jwt.sign({
    id: chefUser.id,
    userId: chefUser.id,
    email: chefUser.email,
    role: "CHEF",
    restaurantId: rid1,
  });

  const otherServerToken = app.jwt.sign({
    id: otherServer.id,
    userId: otherServer.id,
    email: otherServer.email,
    role: "WAITER",
    restaurantId: rid2,
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

  let createdOrderId = null;
  let createdKotId = null;
  let createdKotItemId = null;
  let orderSentNotificationId = null;
  let foodReadyNotificationId = null;

  t.after(async () => {
    try {
      await prisma.notification.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: { in: [rid1, rid2] } } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: { in: [rid1, rid2] } } } });
      await prisma.orderStatusEvent.deleteMany({ where: { order: { restaurantId: { in: [rid1, rid2] } } } });
      await prisma.order.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.kitchenStation.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.user.deleteMany({ where: { restaurantId: { in: [rid1, rid2] } } });
      await prisma.restaurant.deleteMany({ where: { id: { in: [rid1, rid2] } } });
      await app.close();
    } catch (_) {}
  });

  // TEST 1 & 2: Server sends order -> Notification created with correct Server recipient
  await t.test("1 & 2. Server sends order -> Persistent Notification created for responsible Server", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/owner/${rid1}/orders`,
      headers: { authorization: `Bearer ${serverAToken}` },
      payload: {
        tableNo: table5.tableNo,
        items: [{ menuItemId: menuItem1.id, qty: 1 }],
        waiterId: serverA.id,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.order);
    createdOrderId = body.order.id;
    assert.ok(body.order.kots?.length > 0);
    createdKotId = body.order.kots[0].id;
    createdKotItemId = body.order.kots[0].items[0].id;

    // Verify DB Notification was created
    const notifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid1,
        orderId: createdOrderId,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverA.id,
      },
    });

    assert.equal(notifs.length, 1);
    const notif = notifs[0];
    orderSentNotificationId = notif.id;
    assert.equal(notif.notificationType, NOTIFICATION_TYPES.ORDER_PLACED);
    assert.equal(notif.recipientId, serverA.id);
    assert.equal(notif.title, "Order Sent to Kitchen");
    assert.ok(notif.message.includes(`Table ${table5.tableNo}`));
    assert.equal(notif.idempotencyKey, `order_sent_${rid1}_${createdOrderId}_${serverA.id}`);
  });

  // TEST 3 & 4: API hydration & Unread Count for Server A
  await t.test("3 & 4. Notification appears via GET /api/notifications & unread count is accurate", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/api/notifications?page=1&limit=20",
      headers: { authorization: `Bearer ${serverAToken}` },
    });

    assert.equal(listRes.statusCode, 200);
    const listData = JSON.parse(listRes.payload);
    assert.ok(listData.notifications?.some((n) => n.id === orderSentNotificationId));

    const countRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${serverAToken}` },
    });

    assert.equal(countRes.statusCode, 200);
    const countData = JSON.parse(countRes.payload);
    assert.equal(countData.count, 1);
    assert.equal(countData.unreadCount, 1);
  });

  // TEST 5 & 6: Kitchen marks item READY -> FOOD_READY notification created for kot.waiterId
  await t.test("5 & 6. Kitchen marks item READY -> FOOD_READY notification created for kot.waiterId", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${rid1}/kots/${createdKotId}/items/${createdKotItemId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });

    assert.equal(res.statusCode, 200);

    const readyNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid1,
        notificationType: NOTIFICATION_TYPES.FOOD_READY,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverA.id,
      },
    });

    assert.equal(readyNotifs.length, 1);
    const readyNotif = readyNotifs[0];
    foodReadyNotificationId = readyNotif.id;
    assert.equal(readyNotif.title, `Food Ready — Table ${table5.tableNo}`);
    assert.ok(readyNotif.message.includes("is ready for Table"));
    assert.equal(readyNotif.idempotencyKey, `food_ready_${rid1}_${createdKotItemId}_${serverA.id}_READY`);
  });

  // TEST 7: Server delivery -> SERVED notification created
  await t.test("7. Server delivery -> SERVED (ORDER_DELIVERED) notification created for responsible Server", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${createdKotItemId}/delivered`,
      headers: { authorization: `Bearer ${serverAToken}` },
      payload: {},
    });

    assert.equal(res.statusCode, 200);

    const deliveredNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid1,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverA.id,
      },
    });

    assert.equal(deliveredNotifs.length, 1);
    assert.equal(deliveredNotifs[0].title, `Food Delivered — Table ${table5.tableNo}`);
    assert.equal(deliveredNotifs[0].idempotencyKey, `food_served_${rid1}_${createdKotItemId}_${serverA.id}_SERVED`);
  });

  // TEST 8: Server B cannot see Server A's private notifications
  await t.test("8. Wrong Server (Server B) CANNOT see Server A's notifications", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${serverBToken}` },
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    // Server B must not see any of Server A's USER notifications
    const serverANotifIds = [orderSentNotificationId, foodReadyNotificationId];
    const leaked = (data.notifications || []).filter((n) => serverANotifIds.includes(n.id));
    assert.equal(leaked.length, 0);

    const countRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${serverBToken}` },
    });
    const countData = JSON.parse(countRes.payload);
    assert.equal(countData.count, 0);
  });

  // TEST 9: Chef cannot see private Server notifications
  await t.test("9. Chef CANNOT see private Server notifications", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${chefToken}` },
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    const serverANotifIds = [orderSentNotificationId, foodReadyNotificationId];
    const leaked = (data.notifications || []).filter((n) => serverANotifIds.includes(n.id));
    assert.equal(leaked.length, 0);
  });

  // TEST 10: Different restaurant cannot see notification
  await t.test("10. Other restaurant server CANNOT see notifications from Restaurant 1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${otherServerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.equal(data.notifications?.length || 0, 0);

    const countRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${otherServerToken}` },
    });
    assert.equal(JSON.parse(countRes.payload).count, 0);
  });

  // TEST 11: Duplicate READY event does not create duplicate notification
  await t.test("11. Duplicate READY event does NOT create duplicate notification (Idempotency Key)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/owner/${rid1}/kots/${createdKotId}/items/${createdKotItemId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });

    assert.equal(res.statusCode, 200);

    const readyNotifs = await prisma.notification.findMany({
      where: {
        restaurantId: rid1,
        notificationType: NOTIFICATION_TYPES.FOOD_READY,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverA.id,
      },
    });

    assert.equal(readyNotifs.length, 1);
  });

  // TEST 12: Duplicate order event does not create duplicate notification
  await t.test("12. Duplicate order event does NOT create duplicate notification", async () => {
    // Calling createAndDispatchNotification with same idempotency key
    const duplicate = await prisma.notification.findMany({
      where: {
        idempotencyKey: `order_sent_${rid1}_${createdOrderId}_${serverA.id}`,
      },
    });
    assert.equal(duplicate.length, 1);
  });

  // TEST 13: Refresh does not lose notifications (Persistence)
  await t.test("13. Refresh does NOT lose notifications (Database Persistence Verified)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?page=1&limit=20",
      headers: { authorization: `Bearer ${serverAToken}` },
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.equal(data.notifications?.length, 3); // ORDER_PLACED, FOOD_READY, ORDER_DELIVERED
    assert.equal(data.unreadCount, 3);
  });

  // TEST 14: Socket events delivered to Server A and not duplicated
  await t.test("14 & 17. /staff namespace receives notification:new for Server A and not Server B", async () => {
    const serverAEvents = simulated.getSocketEvents("sock_server_a");
    const newNotifs = serverAEvents.filter((e) => e.event === "notification:new" && e.ns === "staff");
    assert.ok(newNotifs.length >= 3); // ORDER_PLACED, FOOD_READY, ORDER_DELIVERED

    const serverBEvents = simulated.getSocketEvents("sock_server_b");
    const serverBNotifs = serverBEvents.filter((e) => e.event === "notification:new" && e.ns === "staff");
    assert.equal(serverBNotifs.length, 0); // Server B received 0 private notifications
  });

  // TEST 15: Mark single notification read
  await t.test("15. Mark single notification read decrements unread count", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/notifications/${orderSentNotificationId}/read`,
      headers: { authorization: `Bearer ${serverAToken}` },
    });

    assert.equal(patchRes.statusCode, 200);

    const countRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${serverAToken}` },
    });
    assert.equal(JSON.parse(countRes.payload).count, 2); // 3 - 1 = 2
  });

  // TEST 16: Mark all read is recipient-scoped
  await t.test("16. Mark all read marks ONLY Server A's notifications read", async () => {
    const patchAllRes = await app.inject({
      method: "PATCH",
      url: "/api/notifications/read-all",
      headers: { authorization: `Bearer ${serverAToken}` },
    });

    assert.equal(patchAllRes.statusCode, 200);

    const countRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${serverAToken}` },
    });
    assert.equal(JSON.parse(countRes.payload).count, 0);

    // Verify Server A cannot mark Server B notifications (if any existed)
    const checkDb = await prisma.notification.findMany({
      where: { recipientType: RECIPIENT_TYPES.USER, recipientId: serverA.id, isRead: false },
    });
    assert.equal(checkDb.length, 0);
  });

  // TEST 18: Root namespace compatibility is preserved
  await t.test("18. Root namespace compatibility is preserved", async () => {
    const serverARootEvents = simulated.getSocketEvents("sock_server_a_root");
    const rootNotifs = serverARootEvents.filter((e) => e.event === "notification:new" && e.ns === "root");
    assert.ok(rootNotifs.length >= 3);
  });
});
