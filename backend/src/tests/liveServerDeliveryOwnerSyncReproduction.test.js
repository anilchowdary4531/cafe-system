import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { io as ClientIO } from "socket.io-client";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { initRealtime } from "../realtime/socketServer.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import { getOrCreateActiveSession } from "../services/tableSessionService.js";

/**
 * Deterministic helper to wait for a specific socket event with an explicit timeout.
 * Automatically cleans up listeners and timers upon resolution or rejection.
 */
function waitForSocketEvent(socket, eventName, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let timer = null;

    const listener = (payload) => {
      try {
        if (predicate(payload)) {
          if (timer) clearTimeout(timer);
          socket.off(eventName, listener);
          resolve(payload);
        }
      } catch (err) {
        if (timer) clearTimeout(timer);
        socket.off(eventName, listener);
        reject(err);
      }
    };

    timer = setTimeout(() => {
      socket.off(eventName, listener);
      reject(new Error(`Timeout after ${timeoutMs}ms waiting for socket event '${eventName}'`));
    }, timeoutMs);

    socket.on(eventName, listener);
  });
}

test("DETERMINISTIC LIVE FORENSIC REPRODUCTION: SERVER DELIVERY -> OWNER PANEL RUNTIME CHAIN", async (t) => {
  const testStartTime = Date.now();
  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  let app = null;
  let realtime = null;
  let ownerSocket = null;
  let rid = null;
  let testTableId = null;
  let testOrderId = null;
  let testKotId = null;
  let testKotItemId = null;

  // Cleanup helper that guarantees deterministic termination
  const cleanupAllResources = async () => {
    // 1. Clean up client socket
    if (ownerSocket) {
      try {
        ownerSocket.removeAllListeners();
        ownerSocket.disconnect();
        ownerSocket.close();
      } catch (e) {
        // ignore
      }
      ownerSocket = null;
    }

    // 2. Clean up server Socket.IO
    if (realtime?.io) {
      try {
        realtime.io.disconnectSockets(true);
        await new Promise((resolve) => realtime.io.close(resolve));
      } catch (e) {
        // ignore
      }
    }

    // 3. Clean up database records
    if (rid) {
      try {
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
      } catch (e) {
        // ignore
      }
    }

    // 4. Close Fastify server
    if (app) {
      try {
        await app.close();
      } catch (e) {
        // ignore
      }
      app = null;
    }

    // 5. Disconnect Prisma connection pool
    try {
      await prisma.$disconnect();
    } catch (e) {
      // ignore
    }
  };

  try {
    // 1. Initialize Fastify & JWT
    app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: "sync-audit-jwt-secret-xyz-12345" });

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

    // 2. Initialize Real Socket.IO server bound to Fastify
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

    // 3. Setup isolated restaurant & staff
    const rest = await prisma.restaurant.create({
      data: {
        name: `Deterministic Sync Audit Rest ${testSuffix}`,
        slug: `deterministic-sync-audit-${testSuffix}`,
        addressLine1: "123 Deterministic Audit Way",
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

    // 4. Connect real Owner Socket to /staff (mimicking frontend StaffSocketContext)
    ownerSocket = ClientIO(`${baseUrl}/staff`, {
      auth: { token: ownerToken },
      transports: ["websocket"],
      reconnection: false, // Prevents hanging background reconnect timers
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

    // Collect all incoming socket events on Owner Socket
    const receivedEvents = [];
    const eventNames = [
      "food:delivered",
      "order:updated",
      "order:status_updated",
      "table:updated",
      "table:session_updated",
      "kot:status_updated",
      "kot:item_updated",
      "kitchen:item_served",
      "notification:new",
    ];
    eventNames.forEach((ev) => {
      ownerSocket.on(ev, (payload) => {
        receivedEvents.push({ event: ev, payload, receivedAt: Date.now() });
      });
    });

    // 5. Create Order & KOT
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
        customerName: "Deterministic Audited Guest",
      },
    });
    assert.equal(createRes.statusCode, 201);
    const createdOrder = JSON.parse(createRes.payload).order;
    testOrderId = createdOrder.id;

    const kot = await prisma.kitchenOrderTicket.findFirst({
      where: { orderId: createdOrder.id },
      include: { items: true },
    });
    assert.ok(kot);
    assert.ok(kot.items.length > 0);
    testKotId = kot.id;
    testKotItemId = kot.items[0].id;

    // 6. Chef marks READY
    const readyRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kitchen/items/${testKotItemId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });
    assert.equal(readyRes.statusCode, 200);

    // Bounded pause to allow chef events to settle before delivery action
    await new Promise((r) => setTimeout(r, 150));
    receivedEvents.length = 0;

    // Set up deterministic listeners for delivery events before triggering delivery API
    const orderUpdatedPromise = waitForSocketEvent(
      ownerSocket,
      "order:updated",
      (payload) => payload?.id === createdOrder.id && payload?.status === "DELIVERED",
      3000
    );

    const tableUpdatedPromise = waitForSocketEvent(
      ownerSocket,
      "table:updated",
      (payload) => (payload?.tableId === table.id || payload?.id === table.id) && (payload?.status === "DELIVERED" || payload?.activeOrderStatus === "DELIVERED"),
      3000
    );

    const foodDeliveredPromise = waitForSocketEvent(
      ownerSocket,
      "food:delivered",
      (payload) => (payload?.tableId === table.id || payload?.id === table.id) && payload?.itemId === testKotItemId,
      3000
    );

    // =========================================================================
    // 7. CRITICAL ACTION UNDER AUDIT: SERVER CLICKS DELIVER
    // =========================================================================
    const deliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${testKotItemId}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {},
    });
    assert.equal(deliverRes.statusCode, 200, "Server Delivery API must return 200");
    const deliverBody = JSON.parse(deliverRes.payload);
    assert.equal(deliverBody.success, true);
    assert.equal(deliverBody.item.status, "SERVED");
    assert.equal(deliverBody.kot.status, "SERVED");
    assert.equal(deliverBody.order.status, "DELIVERED");

    // =========================================================================
    // 8. VERIFY DETERMINISTIC SOCKET.IO DELIVERY TO OWNER PANEL
    // =========================================================================
    const [deliveredOrderPayload, deliveredTablePayload, foodDeliveredPayload] = await Promise.all([
      orderUpdatedPromise,
      tableUpdatedPromise,
      foodDeliveredPromise,
    ]);

    assert.equal(deliveredOrderPayload.id, createdOrder.id, "order:updated payload must match created order ID");
    assert.equal(deliveredOrderPayload.status, "DELIVERED", "order:updated payload status must be DELIVERED");

    assert.ok(deliveredTablePayload.tableId === table.id || deliveredTablePayload.id === table.id, "table:updated tableId must match canonical table");
    assert.equal(deliveredTablePayload.status, "DELIVERED", "table:updated status must be DELIVERED");
    assert.equal(deliveredTablePayload.activeOrderStatus, "DELIVERED", "table:updated activeOrderStatus must be DELIVERED");

    assert.equal(foodDeliveredPayload.itemId, testKotItemId, "food:delivered itemId must match KOT item ID");

    // =========================================================================
    // 9. VERIFY DATABASE STATE AFTER DELIVERY
    // =========================================================================
    const dbOrder = await prisma.order.findUnique({ where: { id: createdOrder.id } });
    const dbKot = await prisma.kitchenOrderTicket.findUnique({ where: { id: testKotId } });
    const dbKotItem = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: testKotItemId } });

    assert.equal(dbOrder.status, "DELIVERED", "Database Order status must be DELIVERED");
    assert.equal(dbKot.status, "SERVED", "Database KOT status must be SERVED");
    assert.equal(dbKotItem.status, "SERVED", "Database KOT item status must be SERVED");

    // =========================================================================
    // 10. VERIFY OWNER GET /tables API RESPONSE
    // =========================================================================
    const tablesRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(tablesRes.statusCode, 200);
    const tables = JSON.parse(tablesRes.payload);
    const auditedTable = tables.find((t) => t.id === table.id);

    assert.ok(auditedTable);
    assert.equal(auditedTable.status, "DELIVERED", "Owner tables API must return table.status = DELIVERED");
    assert.equal(auditedTable.activeOrderStatus, "DELIVERED", "Owner tables API must return table.activeOrderStatus = DELIVERED");
    assert.equal(auditedTable.activeOrders[0].status, "DELIVERED", "Owner activeOrders must have status DELIVERED");

    console.log(`[PASS] Server Deliver -> Owner Panel Realtime Chain verified in ${Date.now() - testStartTime}ms`);
  } finally {
    // Guaranteed resource cleanup
    await cleanupAllResources();
  }
});
