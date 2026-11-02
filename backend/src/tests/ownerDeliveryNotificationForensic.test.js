import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { io as ClientIO } from "../../../frontend/node_modules/socket.io-client/build/esm/index.js";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { initRealtime } from "../realtime/socketServer.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { getOrCreateActiveSession } from "../services/tableSessionService.js";

test("FORENSIC INVESTIGATION: SERVER DELIVERY -> OWNER NOTIFICATION PATH", async (t) => {
  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  let app = null;
  let realtime = null;
  let ownerSocket = null;
  let serverSocket = null;
  let rid = null;
  let testTableId = null;
  let testOrderId = null;
  let testKotId = null;
  let testKotItemId = null;

  try {
    app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: "forensic-jwt-secret-xyz-12345" });
    app.decorateRequest("staffActor", null);

    const STAFF_ALLOWED_ROLES = ["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];

    const requireOwnerRouteAuth = async (req, reply) => {
      const actor = await requireStaffJwt(req, reply, {
        prisma,
        allowedRoles: STAFF_ALLOWED_ROLES,
        matchRestaurantParam: "restaurantId",
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
        name: `Forensic Notif Rest ${testSuffix}`,
        slug: `forensic-notif-${testSuffix}`,
        addressLine1: "123 Forensic Way",
        phone: `9876${String(testSuffix).slice(-6)}`,
      },
    });
    rid = rest.id;

    const ownerUser = await prisma.user.create({
      data: {
        name: "Alice Owner",
        email: `owner_${testSuffix}@tiffzy.com`,
        phone: `9111${String(testSuffix).slice(-6)}`,
        role: "OWNER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const serverUser = await prisma.user.create({
      data: {
        name: "Bob Server",
        email: `server_${testSuffix}@tiffzy.com`,
        phone: `9222${String(testSuffix).slice(-6)}`,
        role: "WAITER",
        designation: "SERVER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const chefUser = await prisma.user.create({
      data: {
        name: "Charlie Chef",
        email: `chef_${testSuffix}@tiffzy.com`,
        phone: `9333${String(testSuffix).slice(-6)}`,
        role: "CHEF",
        designation: "CHEF",
        restaurantId: rid,
        password: "password123",
      },
    });

    const table = await prisma.diningTable.create({
      data: {
        restaurantId: rid,
        tableNo: "101",
        seats: 4,
        section: "Main Hall",
      },
    });
    testTableId = table.id;

    const menuItem = await prisma.menuItem.create({
      data: {
        restaurantId: rid,
        name: "Audit Paneer Tikka",
        category: "Main Course",
        price: 250,
      },
    });

    const ownerToken = app.jwt.sign({
      id: ownerUser.id,
      userId: ownerUser.id,
      name: ownerUser.name,
      email: ownerUser.email,
      role: "OWNER",
      restaurantId: rid,
      sessionVersion: 0,
    });

    const serverToken = app.jwt.sign({
      id: serverUser.id,
      userId: serverUser.id,
      name: serverUser.name,
      email: serverUser.email,
      role: "WAITER",
      designation: "SERVER",
      restaurantId: rid,
      sessionVersion: 0,
    });

    const chefToken = app.jwt.sign({
      id: chefUser.id,
      userId: chefUser.id,
      name: chefUser.name,
      email: chefUser.email,
      role: "CHEF",
      designation: "CHEF",
      restaurantId: rid,
      sessionVersion: 0,
    });

    // Connect Owner Socket to /staff
    ownerSocket = ClientIO(`${baseUrl}/staff`, {
      auth: { token: ownerToken },
      transports: ["websocket"],
      reconnection: false,
      timeout: 3000,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Owner socket connect timeout")), 3000);
      ownerSocket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      ownerSocket.on("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const ownerReceivedEvents = [];
    ownerSocket.onAny((event, ...args) => {
      ownerReceivedEvents.push({ event, args });
    });

    // Create Order & KOT
    const session = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: table.id,
      waiterId: serverUser.id,
      waiterName: serverUser.name,
      guestCount: 2,
    });

    const createRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        tableNo: table.tableNo,
        tableId: table.id,
        tableSessionId: session.id,
        items: [
          {
            menuItemId: menuItem.id,
            itemName: menuItem.name,
            qty: 1,
            price: menuItem.price,
            total: menuItem.price,
          },
        ],
        subtotal: 250,
        total: 250,
        customerName: "Forensic Guest",
      },
    });
    assert.equal(createRes.statusCode, 201);
    const createdOrder = JSON.parse(createRes.payload).order;
    testOrderId = createdOrder.id;

    const kot = await prisma.kitchenOrderTicket.findFirst({
      where: { orderId: createdOrder.id },
      include: { items: true },
    });
    testKotId = kot.id;
    testKotItemId = kot.items[0].id;

    // Chef marks READY
    const readyRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kitchen/items/${testKotItemId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });
    assert.equal(readyRes.statusCode, 200);

    await new Promise((r) => setTimeout(r, 100));
    ownerReceivedEvents.length = 0;

    // Server marks DELIVERED
    const deliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${testKotItemId}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {},
    });
    assert.equal(deliverRes.statusCode, 200);

    // Wait for async events to propagate
    await new Promise((r) => setTimeout(r, 500));

    console.log("=== FORENSIC REPORT ===");
    console.log("Owner Socket Received Events:", ownerReceivedEvents.map((e) => e.event));
    
    // Check Database Notifications
    const dbNotifs = await prisma.notification.findMany({
      where: { restaurantId: rid },
      orderBy: { id: "asc" },
    });
    console.log("Database Notifications in restaurant:", dbNotifs.map((n) => ({
      id: n.id,
      recipientType: n.recipientType,
      recipientId: n.recipientId,
      notificationType: n.notificationType,
      title: n.title,
      isRead: n.isRead,
    })));

    // Check Owner GET /api/notifications
    const getNotifsRes = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    console.log("Owner GET /api/notifications status:", getNotifsRes.statusCode);
    const notifsBody = JSON.parse(getNotifsRes.payload);
    console.log("Owner GET /api/notifications result count:", notifsBody.notifications?.length || notifsBody.length || 0);
    console.log("Owner GET /api/notifications items:", notifsBody.notifications || notifsBody);

    // Check Owner GET /api/notifications/unread-count
    const unreadRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    console.log("Owner GET /api/notifications/unread-count:", unreadRes.payload);

  } finally {
    if (ownerSocket) {
      ownerSocket.disconnect();
      ownerSocket.close();
    }
    if (realtime?.io) {
      realtime.io.disconnectSockets(true);
      await new Promise((res) => realtime.io.close(res));
    }
    if (rid) {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      if (testKotId) {
        await prisma.kitchenOrderTicketItem.deleteMany({ where: { kotId: testKotId } });
        await prisma.kitchenOrderTicket.deleteMany({ where: { id: testKotId } });
      }
      if (testOrderId) {
        await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
        await prisma.order.deleteMany({ where: { id: testOrderId } });
      }
      await prisma.tableSession.deleteMany({ where: { restaurantId: rid } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
    }
    if (app) await app.close();
    await prisma.$disconnect();
  }
});
