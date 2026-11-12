import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { io as ClientIO } from "socket.io-client";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { initRealtime } from "../realtime/socketServer.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { updateOrderStatus } from "../services/orderService.js";

test("UNASSIGNED DELIVERY NOTIFICATION END-TO-END VERIFICATION", async (t) => {
  const ts = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  let app = null;
  let realtime = null;
  let ownerSocket = null;
  let serverSocket = null;
  let rid = null;
  let testOrderId = null;

  try {
    app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: "unassigned-delivery-secret-123" });
    app.decorateRequest("staffActor", null);

    const STAFF_ALLOWED_ROLES = ["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];

    const requireStaffRouteAuth = async (req, reply) => {
      const actor = await requireStaffJwt(req, reply, {
        prisma,
        allowedRoles: STAFF_ALLOWED_ROLES,
      });
      if (!actor) return reply;
      req.staffActor = actor;
      req.user = {
        id: actor.userId,
        name: actor.userName,
        role: actor.role,
        restaurantId: actor.restaurantId,
      };
      return null;
    };

    realtime = initRealtime({
      app,
      prisma,
      allowedOrigins: ["*"],
    });

    const routeDeps = {
      prisma,
      STAFF_ACCESS_MODULES: {},
      STAFF_ALLOWED_ROLES,
      normalizeAccess: () => ({}),
      normalizeDbPermissions: () => ({}),
      serializeAccess: () => ({}),
      realtime,
    };

    await routes(app, routeDeps);

    await app.listen({ port: 0, host: "127.0.0.1" });
    const port = app.server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const rest = await prisma.restaurant.create({
      data: {
        name: `Unassigned Test Rest ${ts}`,
        slug: `unassigned-test-${ts}`,
        phone: `9876${String(ts).slice(-6)}`,
      },
    });
    rid = rest.id;

    const ownerUser = await prisma.user.create({
      data: {
        name: "Owner Bob",
        email: `owner_${ts}@tiffzy.com`,
        phone: `9111${String(ts).slice(-6)}`,
        role: "OWNER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const serverUser = await prisma.user.create({
      data: {
        name: "Server Charlie",
        email: `server_${ts}@tiffzy.com`,
        phone: `9222${String(ts).slice(-6)}`,
        role: "WAITER",
        designation: "SERVER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const otherServerUser = await prisma.user.create({
      data: {
        name: "Server Dave",
        email: `server_dave_${ts}@tiffzy.com`,
        phone: `9333${String(ts).slice(-6)}`,
        role: "WAITER",
        designation: "SERVER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const table = await prisma.diningTable.create({
      data: {
        restaurantId: rid,
        tableNo: "42",
        section: "Patio",
        assignedWaiterId: null, // UNASSIGNED TABLE!
      },
    });

    const ownerToken = app.jwt.sign({
      id: ownerUser.id,
      userId: ownerUser.id,
      name: ownerUser.name,
      role: ownerUser.role,
      restaurantId: rid,
    });

    const serverToken = app.jwt.sign({
      id: serverUser.id,
      userId: serverUser.id,
      name: serverUser.name,
      role: serverUser.role,
      designation: serverUser.designation,
      restaurantId: rid,
    });

    const otherServerToken = app.jwt.sign({
      id: otherServerUser.id,
      userId: otherServerUser.id,
      name: otherServerUser.name,
      role: otherServerUser.role,
      designation: otherServerUser.designation,
      restaurantId: rid,
    });

    // Connect Owner & Server WebSockets to /staff namespace
    const ownerReceived = [];
    ownerSocket = ClientIO(`${baseUrl}/staff`, {
      auth: { token: ownerToken },
      transports: ["websocket"],
      reconnection: false,
    });
    ownerSocket.on("notification:new", (data) => {
      ownerReceived.push(data);
    });

    const serverReceived = [];
    serverSocket = ClientIO(`${baseUrl}/staff`, {
      auth: { token: serverToken },
      transports: ["websocket"],
      reconnection: false,
    });
    serverSocket.on("notification:new", (data) => {
      serverReceived.push(data);
    });

    await new Promise((resolve, reject) => {
      let count = 0;
      const check = () => {
        count++;
        if (count === 2) resolve();
      };
      ownerSocket.on("connect", check);
      serverSocket.on("connect", check);
      setTimeout(() => reject(new Error("Socket connection timeout")), 4000);
    });

    // Create UNASSIGNED order (e.g. Customer QR order without waiterId)
    const order = await prisma.order.create({
      data: {
        restaurantId: rid,
        orderNo: `ORD-${ts}-42`,
        tableNo: "42",
        status: "READY",
        subtotal: 150,
        total: 150,
      },
    });
    testOrderId = order.id;

    // Server Charlie clicks "Deliver"
    const updated = await updateOrderStatus({
      prisma,
      actor: {
        userId: serverUser.id,
        role: "WAITER",
        designation: "SERVER",
        restaurantId: rid,
      },
      orderId: order.id,
      nextStatus: "DELIVERED",
      changedByName: serverUser.name,
      realtime,
    });
    assert.equal(updated.status, "DELIVERED");

    // Wait for async events to propagate
    await new Promise((r) => setTimeout(r, 400));

    // 1. Verify Owner Socket received notification:new for ORDER_DELIVERED
    const ownerDeliveryNotif = ownerReceived.find(
      (n) => n.notificationType === "ORDER_DELIVERED"
    );
    assert.ok(ownerDeliveryNotif, "Owner must receive realtime ORDER_DELIVERED notification on /staff socket");
    assert.equal(ownerDeliveryNotif.restaurantId, rid);

    // 2. Verify Server Charlie Socket received notification:new for ORDER_DELIVERED
    const serverDeliveryNotif = serverReceived.find(
      (n) => n.notificationType === "ORDER_DELIVERED"
    );
    assert.ok(serverDeliveryNotif, "Delivering server must receive realtime ORDER_DELIVERED notification on /staff socket");
    assert.equal(serverDeliveryNotif.recipientId, serverUser.id);

    // 3. Verify Owner GET /api/notifications returns ORDER_DELIVERED
    const ownerGetRes = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(ownerGetRes.statusCode, 200);
    const ownerData = JSON.parse(ownerGetRes.payload);
    const ownerList = ownerData.notifications || ownerData;
    assert.ok(
      ownerList.some((n) => n.notificationType === "ORDER_DELIVERED"),
      "Owner GET /api/notifications must contain ORDER_DELIVERED"
    );

    // 4. Verify Server Charlie GET /api/notifications returns ORDER_DELIVERED
    const serverGetRes = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(serverGetRes.statusCode, 200);
    const serverData = JSON.parse(serverGetRes.payload);
    const serverList = serverData.notifications || serverData;
    assert.ok(
      serverList.some((n) => n.notificationType === "ORDER_DELIVERED" && n.recipientId === serverUser.id),
      "Server Charlie GET /api/notifications must contain ORDER_DELIVERED for their userId"
    );

    // 5. Verify unread count is accurate for both
    const ownerCountRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(JSON.parse(ownerCountRes.payload).count >= 1, true);

    const serverCountRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(JSON.parse(serverCountRes.payload).count >= 1, true);

    // 6. Verify Server Dave (unrelated server) does NOT see Charlie's private delivery notification
    const otherServerGetRes = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${otherServerToken}` },
    });
    const otherServerData = JSON.parse(otherServerGetRes.payload);
    const otherServerList = otherServerData.notifications || otherServerData;
    assert.equal(
      otherServerList.some((n) => n.recipientId === serverUser.id),
      false,
      "Server Dave must not see Server Charlie's private delivery notification"
    );

    console.log("[PASS] Unassigned Delivery End-to-End verified successfully!");
  } finally {
    if (ownerSocket) {
      ownerSocket.disconnect();
      ownerSocket.close();
    }
    if (serverSocket) {
      serverSocket.disconnect();
      serverSocket.close();
    }
    if (realtime?.io) {
      realtime.io.disconnectSockets(true);
      await new Promise((res) => realtime.io.close(res));
    }
    if (rid) {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      if (testOrderId) {
        await prisma.order.deleteMany({ where: { id: testOrderId } });
      }
      await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
    }
    if (app) await app.close();
    await prisma.$disconnect();
  }
});
