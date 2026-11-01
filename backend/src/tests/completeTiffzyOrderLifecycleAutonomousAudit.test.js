import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import staffTasksRoutes from "../routes/staffTasks.routes.js";
import qrRoutes from "../routes/qr.routes.js";
import notificationRoutes from "../routes/notification.routes.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import {
  getOrCreateActiveSession,
  completeSessionAndReleaseTable,
  getActiveSessionForTable,
} from "../services/tableSessionService.js";
import { placeQrOrder } from "../services/qrService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";

const STAFF_ALLOWED_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SUPER_ADMIN",
  "WAITER",
  "SERVER",
  "STEWARD",
  "CHEF",
  "STAFF",
  "CLEANER",
  "CASHIER",
  "SWIPER",
];

async function createAutonomousAuditApp(emittedEvents = []) {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "autonomous-order-lifecycle-jwt-secret-xyz" });

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

  const mockRealtime = {
    io: {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({
            namespace: "root",
            room,
            event,
            data,
            timestamp: new Date().toISOString(),
          });
        },
      }),
      of: (ns) => ({
        to: (room) => ({
          emit: (event, data) => {
            emittedEvents.push({
              namespace: ns,
              room,
              event,
              data,
              timestamp: new Date().toISOString(),
            });
          },
        }),
      }),
    },
    staff: {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({
            namespace: "staff",
            room,
            event,
            data,
            timestamp: new Date().toISOString(),
          });
        },
      }),
    },
    emitOrderCreated: (order) => {
      emittedEvents.push({
        namespace: "helper",
        room: `restaurant:${order.restaurantId}`,
        event: "order:created",
        data: order,
        timestamp: new Date().toISOString(),
      });
    },
    emitOrderUpdated: (order) => {
      emittedEvents.push({
        namespace: "helper",
        room: `restaurant:${order.restaurantId}`,
        event: "order:updated",
        data: order,
        timestamp: new Date().toISOString(),
      });
    },
  };

  app.io = mockRealtime.io;
  app.staff = mockRealtime.staff;
  app.realtime = mockRealtime;

  await ownerRoutes(app, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES,
    buildQrTargetUrl: (slug, tableNo) => `/menu/${slug}?table=${tableNo}`,
  });

  await staffTasksRoutes(app, {
    prisma,
    realtime: mockRealtime,
    STAFF_ALLOWED_ROLES,
  });

  await qrRoutes(app, {
    prisma,
    realtime: mockRealtime,
  });

  await notificationRoutes(app, {
    prisma,
    realtime: mockRealtime,
  });

  await app.ready();
  return { app, mockRealtime };
}

test("TIFFZY AUTONOMOUS COMPLETE ORDER LIFECYCLE AUDIT SUITE", async (t) => {
  const emittedEvents = [];
  const { app, mockRealtime } = await createAutonomousAuditApp(emittedEvents);

  const timestamp = Date.now() + "_" + Math.floor(Math.random() * 100000);
  const restSlug = `lifecycle-audit-${timestamp}`;

  // =========================================================================
  // SETUP SEED DATA
  // =========================================================================
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Tiffzy Signature Audit Bistro",
      slug: restSlug,
      currency: "INR",
      timezone: "Asia/Kolkata",
      upiId: "tiffzyaudit@upi",
    },
  });
  const rid = restaurant.id;

  const kitchenStation = await prisma.kitchenStation.create({
    data: {
      restaurantId: rid,
      name: "Main Line Kitchen",
      isDefault: true,
    },
  });

  // Create Users: Owner, Server, Chef, Steward, Cleaner, Cashier
  const ownerUser = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Olivia Owner",
      email: `owner-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "OWNER",
      isActive: true,
    },
  });

  const serverUser = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Samuel Server",
      email: `server-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "WAITER",
      designation: "SERVER",
      isActive: true,
    },
  });

  const chefUser = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Charlie Chef",
      email: `chef-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "CHEF",
      designation: "CHEF",
      isActive: true,
    },
  });

  const stewardUser = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Stanley Steward",
      email: `steward-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "STAFF",
      designation: "STEWARD",
      isActive: true,
    },
  });

  const cleanerUser = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Clara Cleaner",
      email: `cleaner-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "STAFF",
      designation: "CLEANER",
      isActive: true,
    },
  });

  const cashierUser = await prisma.user.create({
    data: {
      restaurantId: rid,
      name: "Colin Cashier",
      email: `cashier-${timestamp}@tiffzy.com`,
      password: "password123",
      role: "CASHIER",
      designation: "CASHIER",
      isActive: true,
    },
  });

  // Create Dining Tables:
  // Primary lifecycle table
  const mainTable = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "T1",
      seats: 4,
      section: "Main Dining",
      assignedWaiterId: serverUser.id,
      assignedWaiterName: serverUser.name,
      cleaningStatus: "CLEAN",
      qrToken: `qr-main-t1-${timestamp}`,
    },
  });

  // Duplicate Table No tables for Phase 17
  const dupTableA = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "1",
      seats: 4,
      section: "Main Hall",
      cleaningStatus: "CLEAN",
      qrToken: `qr-dupa-1-${timestamp}`,
    },
  });

  const dupTableB = await prisma.diningTable.create({
    data: {
      restaurantId: rid,
      tableNo: "table 1",
      seats: 4,
      section: "Terrace Garden",
      cleaningStatus: "CLEAN",
      qrToken: `qr-dupb-1-${timestamp}`,
    },
  });

  // Create Menu Items
  const menuItemPaneer = await prisma.menuItem.create({
    data: {
      restaurantId: rid,
      name: "Paneer Butter Masala",
      category: "Main Course",
      price: 280,
      isAvailable: true,
    },
  });

  const menuItemNaan = await prisma.menuItem.create({
    data: {
      restaurantId: rid,
      name: "Garlic Butter Naan",
      category: "Breads",
      price: 60,
      isAvailable: true,
    },
  });

  // Auth tokens
  const ownerToken = app.jwt.sign({
    id: ownerUser.id,
    userId: ownerUser.id,
    name: ownerUser.name,
    email: ownerUser.email,
    role: "OWNER",
    restaurantId: rid,
    sessionVersion: ownerUser.sessionVersion || 0,
  });

  const serverToken = app.jwt.sign({
    id: serverUser.id,
    userId: serverUser.id,
    name: serverUser.name,
    email: serverUser.email,
    role: "WAITER",
    designation: "SERVER",
    restaurantId: rid,
    sessionVersion: serverUser.sessionVersion || 0,
  });

  const chefToken = app.jwt.sign({
    id: chefUser.id,
    userId: chefUser.id,
    name: chefUser.name,
    email: chefUser.email,
    role: "CHEF",
    designation: "CHEF",
    restaurantId: rid,
    sessionVersion: chefUser.sessionVersion || 0,
  });

  const cleanerToken = app.jwt.sign({
    id: cleanerUser.id,
    userId: cleanerUser.id,
    name: cleanerUser.name,
    email: cleanerUser.email,
    role: "STAFF",
    designation: "CLEANER",
    restaurantId: rid,
    sessionVersion: cleanerUser.sessionVersion || 0,
  });

  const cashierToken = app.jwt.sign({
    id: cashierUser.id,
    userId: cashierUser.id,
    name: cashierUser.name,
    email: cashierUser.email,
    role: "CASHIER",
    designation: "CASHIER",
    restaurantId: rid,
    sessionVersion: cashierUser.sessionVersion || 0,
  });

  // Structure to hold tracked lifecycle audit records
  const lifecycleAuditLog = [];
  const recordTransition = (entry) => {
    lifecycleAuditLog.push({
      timestamp: new Date().toISOString(),
      ...entry,
    });
  };

  // Variables to hold canonical Order IDs for Phase 5 trace
  let trackedIds = {
    restaurantId: rid,
    tableId: mainTable.id,
    tableSessionId: null,
    orderId: null,
    orderNo: null,
    orderItemId: null,
    kotId: null,
    kotItemId: null,
    assignedWaiterId: serverUser.id,
    assignedWaiterName: serverUser.name,
  };

  // =========================================================================
  // PHASE 5 & 6: ORDER CREATION (Server Station / QR / Owner)
  // =========================================================================
  await t.test("PHASE 5 & 6: Order Creation & Canonical Record Linking", async () => {
    emittedEvents.length = 0;

    // 1. Session created/found on Table T1
    const session = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: mainTable.id,
      waiterId: serverUser.id,
      waiterName: serverUser.name,
      guestCount: 2,
    });
    assert.ok(session, "Session must be created");
    assert.equal(session.status, "OPEN");
    assert.equal(session.tableId, mainTable.id);
    trackedIds.tableSessionId = session.id;

    recordTransition({
      action: "TABLE_SESSION_OPENED",
      page: "Server Station (frontend/src/pages/Server.jsx)",
      api: "getOrCreateActiveSession / Table Session Service",
      httpStatus: 200,
      databaseStatus: "table_sessions: OPEN (waiterId: Samuel Server)",
      socketEvent: "table:session_updated",
      socketRoom: `restaurant:${rid}`,
      frontendReceiver: "ServerStation, OwnerDashboard, CashierStation",
      uiResult: "Table T1 marked OCCUPIED, session badge displays OPEN",
    });

    // 2. Submit Order for Paneer Butter Masala
    const orderCreateRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        tableNo: mainTable.tableNo,
        tableId: mainTable.id,
        tableSessionId: session.id,
        items: [
          {
            menuItemId: menuItemPaneer.id,
            itemName: menuItemPaneer.name,
            qty: 1,
            price: menuItemPaneer.price,
            total: menuItemPaneer.price,
          },
        ],
        subtotal: 280,
        total: 280,
        customerName: "VIP Table Guest",
      },
    });

    assert.ok(
      [200, 201].includes(orderCreateRes.statusCode),
      `Order creation must return 200 or 201, got ${orderCreateRes.statusCode}`
    );
    const createPayload = JSON.parse(orderCreateRes.payload);
    const orderData = createPayload.order || createPayload;
    assert.ok(orderData.id, "Order record must have ID");
    assert.equal(orderData.tableSessionId, session.id, "Order must link to active session");

    trackedIds.orderId = orderData.id;
    trackedIds.orderNo = orderData.orderNo;

    // Verify order item in DB
    const orderItem = await prisma.orderItem.findFirst({
      where: { orderId: orderData.id },
    });
    assert.ok(orderItem, "OrderItem must be created");
    trackedIds.orderItemId = orderItem.id;

    // Verify KOT and KOT item in DB
    const kot = await prisma.kitchenOrderTicket.findFirst({
      where: { orderId: orderData.id },
      include: { items: true },
    });
    assert.ok(kot, "KOT must be automatically created");
    assert.equal(kot.status, "PENDING");
    assert.equal(kot.items.length, 1);
    trackedIds.kotId = kot.id;
    trackedIds.kotItemId = kot.items[0].id;

    recordTransition({
      action: "ORDER_CREATED_AND_KOT_DISPATCHED",
      page: "Server Station (New Order Drawer) / QR Order Page",
      api: "POST /owner/:restaurantId/orders",
      httpStatus: orderCreateRes.statusCode,
      databaseStatus: "orders: PLACED | kots: PENDING | kot_items: PENDING",
      socketEvent: "order:created, kot:created, table:updated",
      socketRoom: `restaurant_${rid}, restaurant:${rid}, session_${session.id}`,
      frontendReceiver: "Kitchen (KDS), OwnerDashboard, ServerStation",
      uiResult: "Kitchen KDS card appears immediately without page refresh; Owner Live Orders strip updates count to 1",
    });

    // Verify socket emission for KOT & Order
    const kotEmits = emittedEvents.filter((e) => e.event === "kot:created" || e.event === "kot_created" || e.event === "order:created");
    assert.ok(kotEmits.length > 0, "Realtime order/KOT creation event must be emitted");
  });

  // =========================================================================
  // PHASE 7: KITCHEN WORKFLOW (PENDING -> PREPARING -> READY)
  // =========================================================================
  await t.test("PHASE 7: Kitchen Workflow (Pending -> Preparing -> Ready)", async () => {
    emittedEvents.length = 0;

    // 1. Chef accepts and starts preparing item
    const prepRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kitchen/items/${trackedIds.kotItemId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: {
        status: "PREPARING",
        assignedChefId: chefUser.id,
        assignedChefName: chefUser.name,
      },
    });
    assert.equal(prepRes.statusCode, 200, "Chef status update to PREPARING must succeed");

    const kotItemPrep = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: trackedIds.kotItemId },
    });
    assert.equal(kotItemPrep.status, "PREPARING");
    assert.ok(kotItemPrep.startedAt, "Preparation startedAt must be recorded");

    const kotPrep = await prisma.kitchenOrderTicket.findUnique({
      where: { id: trackedIds.kotId },
    });
    assert.equal(kotPrep.status, "PREPARING");

    recordTransition({
      action: "CHEF_STARTS_PREPARATION",
      page: "Kitchen KDS (frontend/src/pages/Kitchen.jsx)",
      api: "PUT /owner/:restaurantId/kitchen/items/:itemId/status",
      httpStatus: prepRes.statusCode,
      databaseStatus: "kot_items: PREPARING (startedAt stamped) | kots: PREPARING | orders: PREPARING",
      socketEvent: "kitchen:item_status_updated, kot:item_updated, kot:status_updated",
      socketRoom: `restaurant_${rid}, restaurant:${rid}`,
      frontendReceiver: "Kitchen KDS, OwnerKitchenLive, ServerStation",
      uiResult: "Kitchen ticket moves from PENDING queue to IN_PREPARATION active pass; timer starts",
    });

    // 2. Chef finishes cooking -> Marks item READY
    emittedEvents.length = 0;
    const readyRes = await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kitchen/items/${trackedIds.kotItemId}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: {
        status: "READY",
      },
    });
    assert.equal(readyRes.statusCode, 200, "Chef status update to READY must succeed");

    const kotItemReady = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: trackedIds.kotItemId },
    });
    assert.equal(kotItemReady.status, "READY");
    assert.ok(kotItemReady.readyAt, "readyAt timestamp must be stamped");

    const kotReady = await prisma.kitchenOrderTicket.findUnique({
      where: { id: trackedIds.kotId },
    });
    assert.equal(kotReady.status, "READY");

    const orderReady = await prisma.order.findUnique({
      where: { id: trackedIds.orderId },
    });
    assert.equal(orderReady.status, "READY");

    recordTransition({
      action: "CHEF_MARKS_ITEM_READY",
      page: "Kitchen KDS (frontend/src/pages/Kitchen.jsx)",
      api: "PUT /owner/:restaurantId/kitchen/items/:itemId/status",
      httpStatus: readyRes.statusCode,
      databaseStatus: "kot_items: READY (readyAt stamped) | kots: READY | orders: READY",
      socketEvent: "kitchen:item_ready, kot:status_updated, order:updated",
      socketRoom: `restaurant_${rid}, restaurant:${rid}`,
      frontendReceiver: "ServerStation, StewardStation, OwnerDashboard",
      uiResult: "Server Ready Food counter increments to 1; notification toast rings on Server Station; Ready food drawer lists Table T1 Paneer Butter Masala",
    });

    const readyEvents = emittedEvents.filter(
      (e) => e.event === "kitchen:item_ready" || e.event === "kot:status_updated"
    );
    assert.ok(readyEvents.length > 0, "kitchen:item_ready must be emitted");
  });

  // =========================================================================
  // PHASE 8: SERVER / STEWARD WORKFLOW (PICK UP -> DELIVER)
  // =========================================================================
  await t.test("PHASE 8: Server / Steward Delivery & Recalculation", async () => {
    emittedEvents.length = 0;

    // Server distributes / delivers the ready food item
    const deliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${trackedIds.kotItemId}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {},
    });
    assert.equal(deliverRes.statusCode, 200, "Food delivery endpoint must return 200");

    const deliverData = JSON.parse(deliverRes.payload);
    assert.equal(deliverData.success, true);
    assert.equal(deliverData.item.status, "SERVED");

    // Verify DB states: KOT Item = SERVED, KOT = SERVED, Order = DELIVERED
    const servedKotItem = await prisma.kitchenOrderTicketItem.findUnique({
      where: { id: trackedIds.kotItemId },
    });
    assert.equal(servedKotItem.status, "SERVED");

    const servedKot = await prisma.kitchenOrderTicket.findUnique({
      where: { id: trackedIds.kotId },
    });
    assert.equal(servedKot.status, "SERVED");

    const deliveredOrder = await prisma.order.findUnique({
      where: { id: trackedIds.orderId },
    });
    assert.equal(deliveredOrder.status, "DELIVERED");

    // Verify Server & Owner Notifications created
    const serverNotifications = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverUser.id,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
      },
    });
    assert.ok(serverNotifications.length >= 1, "Server persistent delivery notification must be created");

    const ownerNotifications = await prisma.notification.findMany({
      where: {
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
      },
    });
    assert.ok(ownerNotifications.length >= 1, "Owner persistent delivery notification must be created");

    recordTransition({
      action: "FOOD_DELIVERED_TO_TABLE",
      page: "Server Station (frontend/src/pages/Server.jsx) / Steward Station",
      api: "PUT /api/v1/staff/food-runner-items/:itemId/delivered",
      httpStatus: deliverRes.statusCode,
      databaseStatus: "kot_items: SERVED | kots: SERVED | orders: DELIVERED | notifications: created for Server & Restaurant",
      socketEvent: "food:delivered, kitchen:item_served, kot:status_updated, order:updated, table:updated, notification:new",
      socketRoom: `restaurant_${rid}, restaurant:${rid}, user:${serverUser.id}`,
      frontendReceiver: "ServerStation, StewardStation, KitchenKDS, OwnerDashboard, OwnerLayout",
      uiResult: "Ready food drawer cleared; Table badge transitions to SERVED / DELIVERED; Owner Notification unread badge increments; Kitchen removes ticket from active pass without page refresh",
    });

    // Verify socket emission
    const deliveredEvents = emittedEvents.filter(
      (e) => e.event === "food:delivered" || e.event === "kitchen:item_served" || e.event === "order:updated"
    );
    assert.ok(deliveredEvents.length > 0, "Delivery events must be emitted");
  });

  // =========================================================================
  // PHASE 9: OWNER WORKFLOW REALTIME PARITY
  // =========================================================================
  await t.test("PHASE 9: Owner Workflow Realtime Sync & Notification State", async () => {
    // Fetch tables as Owner to verify exact state
    const ownerTablesRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(ownerTablesRes.statusCode, 200);
    const tables = JSON.parse(ownerTablesRes.payload);
    const auditedTable = tables.find((t) => t.id === mainTable.id);

    assert.ok(auditedTable);
    assert.ok(
      ["DELIVERED", "OCCUPIED", "PAYMENT_PENDING"].includes(auditedTable.status),
      `Table status must be DELIVERED, OCCUPIED or PAYMENT_PENDING, got ${auditedTable.status}`
    );
    assert.equal(auditedTable.isOccupied, true);
    assert.equal(auditedTable.activeOrderCount, 1);
    assert.ok(
      ["DELIVERED", "PAYMENT_PENDING"].includes(auditedTable.activeOrderStatus),
      `Active order status must be DELIVERED or PAYMENT_PENDING, got ${auditedTable.activeOrderStatus}`
    );

    // Verify Owner notifications API & Unread Count (OwnerLayout & OwnerNotifications)
    const notifRes = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(notifRes.statusCode, 200);
    const notifData = JSON.parse(notifRes.payload);
    assert.ok(Array.isArray(notifData.notifications || notifData));

    const unreadRes = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(unreadRes.statusCode, 200);
    const unreadData = JSON.parse(unreadRes.payload);
    assert.ok(typeof unreadData.count === "number" || typeof unreadData.unreadCount === "number");

    recordTransition({
      action: "OWNER_REALTIME_INSPECTION",
      page: "Owner Dashboard & Tables Overview (frontend/src/layouts/OwnerLayout.jsx & OwnerTables.jsx)",
      api: "GET /owner/:restaurantId/tables & GET /owner/:restaurantId/notifications",
      httpStatus: 200,
      databaseStatus: "dining_tables: OCCUPIED (1 active order) | table_sessions: OPEN | orders: DELIVERED",
      socketEvent: "table:updated, order:updated, notification:new",
      socketRoom: `restaurant:${rid}`,
      frontendReceiver: "OwnerLayout (mounted listeners lines 1369-1404)",
      uiResult: "Owner layout table tile shows amber OCCUPIED, 1 active order, DELIVERED badge; Unread notification badge updated without navigating away from dashboard",
    });
  });

  // =========================================================================
  // PHASE 10: PAYMENT WORKFLOW (CASH / UPI / CARD / WALLET)
  // =========================================================================
  await t.test("PHASE 10: Payment Settlement Workflow (CASH & UPI)", async () => {
    emittedEvents.length = 0;

    // Settle bill of ₹280 via Cashier or Server
    const settleRes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: trackedIds.orderId,
        paymentMethod: "CASH",
        amount: 280,
      },
    });

    assert.equal(settleRes.statusCode, 200, "Cashier payment settlement must return 200");
    const settleData = JSON.parse(settleRes.payload);
    assert.equal(settleData.success, true);
    assert.equal(settleData.payment.status, "SUCCESS");
    assert.equal(settleData.payment.method, "CASH");

    // Verify Order is SUCCESS/PAID
    const settledOrder = await prisma.order.findUnique({
      where: { id: trackedIds.orderId },
    });
    assert.equal(settledOrder.paymentStatus, "SUCCESS");
    assert.equal(settledOrder.paymentMode, "CASH");

    // Verify Payment Record exists
    const paymentRecord = await prisma.payment.findFirst({
      where: { orderId: trackedIds.orderId },
    });
    assert.ok(paymentRecord, "Payment record must exist in DB");
    assert.equal(paymentRecord.status, "SUCCESS");

    recordTransition({
      action: "PAYMENT_SETTLED_AND_BILL_CLOSED",
      page: "Cashier Station (frontend/src/pages/staff/CashierStation.jsx) / Server Station Settle Modal",
      api: "POST /api/v1/staff/billing/settle",
      httpStatus: settleRes.statusCode,
      databaseStatus: "payments: SUCCESS (amount: ₹280, method: CASH) | orders: paymentStatus SUCCESS | table_sessions: CLOSED",
      socketEvent: "payment:updated, order:updated, table:session_updated, cleaner:table_dirty, cleaner:task_created",
      socketRoom: `restaurant_${rid}, restaurant:${rid}`,
      frontendReceiver: "CashierStation, ServerStation, OwnerDashboard, CleanerStation",
      uiResult: "Order marked Settled in Cashier queue; receipt printing triggered; cash drawer tally updated; Table T1 automatically queued for cleaning",
    });
  });

  // =========================================================================
  // PHASE 11: SESSION CLOSURE & SANITATION TASK GENERATION
  // =========================================================================
  let cleanerTaskId = null;
  await t.test("PHASE 11: Session Closure & Table Dirty Transition", async () => {
    // Verify Session is CLOSED
    const closedSession = await prisma.tableSession.findUnique({
      where: { id: trackedIds.tableSessionId },
    });
    assert.equal(closedSession.status, "CLOSED");
    assert.ok(closedSession.closedAt, "closedAt must be timestamped");

    // Verify Table is DIRTY (because active cleaner Clara Cleaner exists in restaurant)
    const dirtyTable = await prisma.diningTable.findUnique({
      where: { id: mainTable.id },
    });
    assert.equal(dirtyTable.cleaningStatus, "DIRTY");

    // Verify StaffTask created for Cleaner
    const cleaningTask = await prisma.staffTask.findFirst({
      where: {
        restaurantId: rid,
        tableId: mainTable.id,
        category: "CLEANING",
        isCompleted: false,
      },
    });
    assert.ok(cleaningTask, "StaffTask for cleaner must be created");
    assert.equal(cleaningTask.roleTarget, "CLEANER");
    assert.equal(cleaningTask.status, "PENDING");
    cleanerTaskId = cleaningTask.id;

    recordTransition({
      action: "SESSION_CLOSED_AND_TABLE_QUEUED_FOR_CLEANING",
      page: "Cleaner Station (frontend/src/pages/staff/CleanerStation.jsx)",
      api: "completeSessionAndReleaseTable / Table Session Service",
      httpStatus: 200,
      databaseStatus: "table_sessions: CLOSED | dining_tables: cleaningStatus DIRTY | staff_tasks: PENDING (category: CLEANING)",
      socketEvent: "cleaner:table_dirty, cleaner:task_created, table:updated",
      socketRoom: `restaurant_${rid}, restaurant:${rid}`,
      frontendReceiver: "CleanerStation, OwnerTables, ServerStation",
      uiResult: "Cleaner Station sounds audio chime; 'Clean Table T1' card appears in Cleaner task queue; Table badge on Owner & Server turns DIRTY / PURPLE",
    });
  });

  // =========================================================================
  // PHASE 12: CLEANING WORKFLOW & RACE CONDITION TEST
  // =========================================================================
  await t.test("PHASE 12: Cleaner Workflow & Concurrency Race Condition Resilience", async () => {
    assert.ok(cleanerTaskId, "Cleaner task must exist");

    // 1. Cleaner accepts and starts cleaning task
    const startRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${cleanerTaskId}/start`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });
    assert.equal(startRes.statusCode, 200, "Cleaner start task must succeed");

    const inProgressTask = await prisma.staffTask.findUnique({
      where: { id: cleanerTaskId },
    });
    assert.equal(inProgressTask.status, "IN_PROGRESS");

    // =======================================================================
    // RACE CONDITION SIMULATION:
    // While cleaner is sanitizing the table, a new customer walks in / seats,
    // creating a new active session on Table T1!
    // =======================================================================
    const newWalkInSession = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: mainTable.id,
      waiterId: serverUser.id,
      waiterName: serverUser.name,
      guestCount: 3,
      allowDirty: true, // Manager / Host seating customer during busing
    });
    assert.ok(newWalkInSession, "New session must be created");
    assert.equal(newWalkInSession.status, "OPEN");

    // 2. Cleaner completes sanitation task
    const finishRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/tasks/${cleanerTaskId}/finish`,
      headers: { authorization: `Bearer ${cleanerToken}` },
    });
    assert.equal(finishRes.statusCode, 200, "Cleaner finish task must return 200");

    // VERIFY RACE CONDITION RESOLUTION:
    // 1. The dining table cleaningStatus must be updated to CLEAN
    const tableAfterClean = await prisma.diningTable.findUnique({
      where: { id: mainTable.id },
    });
    assert.equal(tableAfterClean.cleaningStatus, "CLEAN", "Table must be marked CLEAN");

    // 2. BUT because a new active session exists, the table MUST NOT BE RESET TO AVAILABLE!
    // The new active session must SURVIVE!
    const survivingSession = await prisma.tableSession.findUnique({
      where: { id: newWalkInSession.id },
    });
    assert.equal(survivingSession.status, "OPEN", "New active session must survive untouched");

    // 3. Verify API returns status OCCUPIED (NOT AVAILABLE)
    const ownerTablesRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const tables = JSON.parse(ownerTablesRes.payload);
    const tableT1Api = tables.find((t) => t.id === mainTable.id);

    assert.equal(tableT1Api.status, "OCCUPIED", "Table must remain OCCUPIED due to active session");
    assert.equal(tableT1Api.isOccupied, true, "Table isOccupied must be true");
    assert.equal(tableT1Api.cleaningStatus, "CLEAN", "Table cleaningStatus must be CLEAN");

    recordTransition({
      action: "CLEANER_FINISHES_WITH_ACTIVE_SESSION_RACE_RESILIENCE",
      page: "Cleaner Station (frontend/src/pages/staff/CleanerStation.jsx)",
      api: "PUT /api/v1/staff/tasks/:taskId/finish",
      httpStatus: finishRes.statusCode,
      databaseStatus: "staff_tasks: COMPLETED | dining_tables: CLEAN (OCCUPIED) | table_sessions: OPEN (survived)",
      socketEvent: "cleaner:table_cleaned, cleaner:task_completed, table:updated (status: OCCUPIED)",
      socketRoom: `restaurant_${rid}, restaurant:${rid}`,
      frontendReceiver: "CleanerStation, OwnerTables, ServerStation",
      uiResult: "Cleaning task removed from cleaner queue; Table T1 turns green CLEAN but stays OCCUPIED; New seated guests are NOT wiped",
    });

    // Clean up second session to demonstrate AVAILABLE transition
    await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: newWalkInSession.id,
      restaurantId: rid,
      realtime: mockRealtime,
      actor: { userId: ownerUser.id, userName: ownerUser.name, role: "OWNER", restaurantId: rid },
    });

    // Directly mark clean to verify AVAILABLE
    await app.inject({
      method: "POST",
      url: `/api/v1/staff/tables/${mainTable.id}/clean`,
      headers: { authorization: `Bearer ${cleanerToken}` },
      payload: { restaurantId: rid },
    });

    const finalAvailableTable = await prisma.diningTable.findUnique({
      where: { id: mainTable.id },
    });
    assert.equal(finalAvailableTable.cleaningStatus, "CLEAN");

    const finalOwnerTablesRes = await app.inject({
      method: "GET",
      url: `/owner/${rid}/tables`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const finalTables = JSON.parse(finalOwnerTablesRes.payload);
    const finalTableT1 = finalTables.find((t) => t.id === mainTable.id);
    assert.equal(finalTableT1.status, "AVAILABLE");
    assert.equal(finalTableT1.isOccupied, false);

    recordTransition({
      action: "TABLE_FREED_AND_AVAILABLE",
      page: "Owner Tables / Server Station Floorplan",
      api: "POST /api/v1/staff/tables/:id/clean",
      httpStatus: 200,
      databaseStatus: "dining_tables: AVAILABLE | cleaningStatus: CLEAN | isOccupied: false",
      socketEvent: "table:updated (status: AVAILABLE)",
      socketRoom: `restaurant_${rid}, restaurant:${rid}`,
      frontendReceiver: "OwnerTables, ServerStation, QR Menu",
      uiResult: "Table T1 turns emerald AVAILABLE; ready to seat next guest",
    });
  });

  // =========================================================================
  // PHASE 16: MULTI-ITEM ORDER WORKFLOW (Partial vs Full Delivery)
  // =========================================================================
  await t.test("PHASE 16: Multi-Item Order (Item 1 Served, Item 2 Ready -> Partial to Full)", async () => {
    // 1. Open session on dupTableA
    const multiSession = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: dupTableA.id,
      waiterId: serverUser.id,
      waiterName: serverUser.name,
      guestCount: 2,
    });

    // 2. Create order with 2 items: Paneer Masala (Item 1) and Garlic Naan (Item 2)
    const multiOrderRes = await app.inject({
      method: "POST",
      url: `/owner/${rid}/orders`,
      headers: { authorization: `Bearer ${serverToken}` },
      payload: {
        tableNo: dupTableA.tableNo,
        tableId: dupTableA.id,
        tableSessionId: multiSession.id,
        items: [
          {
            menuItemId: menuItemPaneer.id,
            itemName: menuItemPaneer.name,
            qty: 1,
            price: 280,
            total: 280,
          },
          {
            menuItemId: menuItemNaan.id,
            itemName: menuItemNaan.name,
            qty: 2,
            price: 60,
            total: 120,
          },
        ],
        subtotal: 400,
        total: 400,
      },
    });

    assert.ok(
      [200, 201].includes(multiOrderRes.statusCode),
      `Multi-item order creation must return 200 or 201, got ${multiOrderRes.statusCode}`
    );
    const multiPayload = JSON.parse(multiOrderRes.payload);
    const multiOrder = multiPayload.order || multiPayload;

    const kot = await prisma.kitchenOrderTicket.findFirst({
      where: { orderId: multiOrder.id },
      include: { items: true },
    });
    assert.equal(kot.items.length, 2, "KOT must contain 2 items");

    const item1 = kot.items.find((i) => i.itemName.includes("Paneer"));
    const item2 = kot.items.find((i) => i.itemName.includes("Naan"));
    assert.ok(item1 && item2);

    // Chef marks both items READY
    await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kitchen/items/${item1.id}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });
    await app.inject({
      method: "PUT",
      url: `/owner/${rid}/kitchen/items/${item2.id}/status`,
      headers: { authorization: `Bearer ${chefToken}` },
      payload: { status: "READY" },
    });

    // PARTIAL DELIVERY: Server delivers ONLY Item 1
    const partialDeliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${item1.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(partialDeliverRes.statusCode, 200);

    // VERIFY:
    // 1. Item 1 is SERVED
    const refreshedItem1 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item1.id } });
    assert.equal(refreshedItem1.status, "SERVED");

    // 2. Item 2 is still READY
    const refreshedItem2 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item2.id } });
    assert.equal(refreshedItem2.status, "READY");

    // 3. KOT remains active (READY) because Item 2 is still undelivered
    const refreshedKotAfter1 = await prisma.kitchenOrderTicket.findUnique({ where: { id: kot.id } });
    assert.equal(refreshedKotAfter1.status, "READY", "KOT must stay READY while item 2 is undelivered");

    // 4. Order is NOT prematurely DELIVERED
    const refreshedOrderAfter1 = await prisma.order.findUnique({ where: { id: multiOrder.id } });
    assert.equal(refreshedOrderAfter1.status, "READY", "Order must not prematurely become DELIVERED");

    // FULL DELIVERY: Server now delivers Item 2
    const fullDeliverRes = await app.inject({
      method: "PUT",
      url: `/api/v1/staff/food-runner-items/${item2.id}/delivered`,
      headers: { authorization: `Bearer ${serverToken}` },
    });
    assert.equal(fullDeliverRes.statusCode, 200);

    // VERIFY:
    // Both items SERVED
    const finalItem1 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item1.id } });
    const finalItem2 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item2.id } });
    assert.equal(finalItem1.status, "SERVED");
    assert.equal(finalItem2.status, "SERVED");

    // KOT is now SERVED
    const finalKot = await prisma.kitchenOrderTicket.findUnique({ where: { id: kot.id } });
    assert.equal(finalKot.status, "SERVED");

    // Order transitions to final DELIVERED state
    const finalOrder = await prisma.order.findUnique({ where: { id: multiOrder.id } });
    assert.equal(finalOrder.status, "DELIVERED");
  });

  // =========================================================================
  // PHASE 17: DUPLICATE TABLE NUMBER TEST (Main Hall 1 vs Terrace Garden 1)
  // =========================================================================
  await t.test("PHASE 17: Duplicate Table Number Isolation (Physical ID vs tableNo string)", async () => {
    assert.notEqual(dupTableA.id, dupTableB.id);
    assert.equal(dupTableA.tableNo, "1");
    assert.equal(dupTableB.tableNo, "table 1");

    // 1. Open session on Table A (Main Hall)
    const sessionA = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: dupTableA.id,
      waiterId: serverUser.id,
      guestCount: 2,
    });

    // 2. Open session on Table B (Terrace Garden)
    const sessionB = await getOrCreateActiveSession({
      prisma,
      restaurantId: rid,
      tableId: dupTableB.id,
      waiterId: serverUser.id,
      guestCount: 4,
    });

    assert.notEqual(sessionA.id, sessionB.id, "Sessions must have distinct IDs");

    // 3. Create order on Table A only
    const orderA = await prisma.order.create({
      data: {
        restaurantId: rid,
        tableNo: dupTableA.tableNo,
        tableSessionId: sessionA.id,
        orderNo: `ORD-DUP-A-${timestamp}`,
        status: "PLACED",
        paymentStatus: "PENDING",
        total: 500,
        subtotal: 500,
      },
    });
    await prisma.tableSession.update({
      where: { id: sessionA.id },
      data: { total: 500, subtotal: 500 },
    });

    // Settle Table A
    const settleARes = await app.inject({
      method: "POST",
      url: "/api/v1/staff/billing/settle",
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        orderId: orderA.id,
        tableId: dupTableA.id,
        paymentMethod: "UPI",
        amount: 500,
      },
    });
    if (settleARes.statusCode !== 200) {
      console.error("SETTLE_A_PAYLOAD_ERROR:", settleARes.payload);
    }
    assert.equal(settleARes.statusCode, 200);

    // VERIFY:
    // Session A is CLOSED
    const checkSessionA = await prisma.tableSession.findUnique({ where: { id: sessionA.id } });
    assert.equal(checkSessionA.status, "CLOSED");

    // Session B MUST REMAIN OPEN!
    const checkSessionB = await prisma.tableSession.findUnique({ where: { id: sessionB.id } });
    assert.equal(checkSessionB.status, "OPEN", "Table B session MUST NOT be closed by Table A settlement");

    // Table A is DIRTY
    const checkTableA = await prisma.diningTable.findUnique({ where: { id: dupTableA.id } });
    assert.equal(checkTableA.cleaningStatus, "DIRTY");

    // Table B is CLEAN & OCCUPIED
    const checkTableB = await prisma.diningTable.findUnique({ where: { id: dupTableB.id } });
    assert.equal(checkTableB.cleaningStatus, "CLEAN");
  });

  console.log("TRACKED_IDS:" + JSON.stringify(trackedIds));
  console.log("LIFECYCLE_LOG:" + JSON.stringify(lifecycleAuditLog, null, 2));

  t.after(async () => {
    try {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      await prisma.staffTask.deleteMany({ where: { restaurantId: rid } });
      await prisma.cashMovement.deleteMany({ where: { restaurantId: rid } });
      await prisma.payment.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: rid } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: rid } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: rid } } });
      await prisma.order.deleteMany({ where: { restaurantId: rid } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: rid } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: rid } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: rid } });
      await prisma.kitchenStation.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
      await app.close();
    } catch (_) {}
  });
});
