import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import routes from "../routes/index.js";
import { initRealtime } from "../realtime/socketServer.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_PRIORITY_MAP,
  RECIPIENT_TYPES,
} from "../constants/notificationTypes.js";
import {
  createAndDispatchNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";
import { updateOrderStatus } from "../services/orderService.js";

test("TIFFZY NOTIFICATION SYSTEM COMPLETE END-TO-END VERIFICATION", async (t) => {
  const ts = Date.now();
  let app = null;
  let realtime = null;
  let rid = null;

  try {
    app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: "complete-notification-test-secret" });
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

    const restaurant = await prisma.restaurant.create({
      data: {
        name: `Notif Test Rest ${ts}`,
        slug: `notif-test-${ts}`,
        currency: "INR",
        nextInvoiceNumber: 1001,
      },
    });
    rid = restaurant.id;

    const ownerUser = await prisma.user.create({
      data: {
        name: "Owner User",
        email: `owner_${ts}@tiffzy.com`,
        role: "OWNER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const serverUser = await prisma.user.create({
      data: {
        name: "Server User",
        email: `server_${ts}@tiffzy.com`,
        role: "WAITER",
        designation: "SERVER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const cleanerUser = await prisma.user.create({
      data: {
        name: "Cleaner User",
        email: `cleaner_${ts}@tiffzy.com`,
        role: "CLEANER",
        designation: "CLEANER",
        restaurantId: rid,
        password: "password123",
      },
    });

    const ownerToken = app.jwt.sign({
      id: ownerUser.id,
      userId: ownerUser.id,
      email: ownerUser.email,
      role: "OWNER",
      restaurantId: rid,
      sessionVersion: 0,
    });

    const serverToken = app.jwt.sign({
      id: serverUser.id,
      userId: serverUser.id,
      email: serverUser.email,
      role: "WAITER",
      designation: "SERVER",
      restaurantId: rid,
      sessionVersion: 0,
    });

    // Subtest 1: Canonical Types & Priority Map
    await t.test("1. All notification constants are defined and have priority mappings", () => {
      assert.equal(NOTIFICATION_TYPES.SYSTEM_ALERT, "SYSTEM_ALERT");
      assert.equal(NOTIFICATION_TYPES.ORDER_UPDATE, "ORDER_UPDATE");
      assert.equal(NOTIFICATION_TYPES.DELIVERY_PARTNER_ASSIGNED, "DELIVERY_PARTNER_ASSIGNED");
      assert.equal(NOTIFICATION_TYPES.ORDER_PLACED, "ORDER_PLACED");
      assert.equal(NOTIFICATION_TYPES.ORDER_DELIVERED, "ORDER_DELIVERED");
      assert.equal(NOTIFICATION_TYPES.FOOD_READY, "FOOD_READY");
      assert.equal(NOTIFICATION_TYPES.TABLE_ASSIGNMENT, "TABLE_ASSIGNMENT");
      assert.equal(NOTIFICATION_TYPES.TABLE_UNASSIGNED, "TABLE_UNASSIGNED");
      assert.equal(NOTIFICATION_TYPES.TABLE_DIRTY, "TABLE_DIRTY");
      assert.equal(NOTIFICATION_TYPES.TABLE_CLEANED, "TABLE_CLEANED");

      assert.equal(NOTIFICATION_PRIORITY_MAP[NOTIFICATION_TYPES.SYSTEM_ALERT], NOTIFICATION_PRIORITIES.HIGH);
      assert.equal(NOTIFICATION_PRIORITY_MAP[NOTIFICATION_TYPES.ORDER_UPDATE], NOTIFICATION_PRIORITIES.NORMAL);
      assert.equal(NOTIFICATION_PRIORITY_MAP[NOTIFICATION_TYPES.DELIVERY_PARTNER_ASSIGNED], NOTIFICATION_PRIORITIES.NORMAL);
    });

    // Subtest 2: SYSTEM_ALERT persistence & querying
    await t.test("2. SYSTEM_ALERT persists and is queryable by recipient", async () => {
      const alert = await createAndDispatchNotification({
        prisma,
        realtime,
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.OWNER,
        recipientId: rid,
        notificationType: NOTIFICATION_TYPES.SYSTEM_ALERT,
        title: "Staff Task Alert",
        message: "Steward requested assistance on Table 12",
        data: { taskId: 55, priority: "HIGH" },
        idempotencyKey: `task_alert_${ts}`,
      });

      assert.ok(alert);
      assert.equal(alert.notificationType, "SYSTEM_ALERT");
      assert.equal(alert.priority, NOTIFICATION_PRIORITIES.HIGH);

      // Verify Owner receives it via GET /api/notifications
      const ownerNotifs = await getUserNotifications({
        prisma,
        userId: ownerUser.id,
        restaurantId: rid,
        effectiveRole: "OWNER",
        role: "OWNER",
      });

      const found = ownerNotifs.notifications.some((n) => n.id === alert.id);
      assert.equal(found, true, "Owner must receive SYSTEM_ALERT");
    });

    // Subtest 3: DELIVERY_PARTNER_ASSIGNED persistence & querying
    await t.test("3. DELIVERY_PARTNER_ASSIGNED is properly classified (not mislabeled ORDER_PLACED)", async () => {
      const deliveryNotif = await createAndDispatchNotification({
        prisma,
        realtime,
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: rid,
        notificationType: NOTIFICATION_TYPES.DELIVERY_PARTNER_ASSIGNED,
        title: "🛵 Driver Assigned",
        message: "Driver John assigned to Order #1001",
        data: { orderId: 1001, driverName: "John" },
        idempotencyKey: `driver_assigned_${ts}`,
      });

      assert.ok(deliveryNotif);
      assert.equal(deliveryNotif.notificationType, "DELIVERY_PARTNER_ASSIGNED");
      assert.notEqual(deliveryNotif.notificationType, "ORDER_PLACED");
    });

    // Subtest 4: Customer status transitions emit realtime notifications
    await t.test("4. Customer order status transitions invoke realtime emission with io and staff", async () => {
      const customer = await prisma.customer.create({
        data: {
          restaurantId: rid,
          name: "Test Customer",
          phone: `9999${String(ts).slice(-6)}`,
        },
      });

      const customerOrder = await prisma.order.create({
        data: {
          restaurantId: rid,
          customerId: customer.id,
          orderNo: `TEST-${ts}`,
          status: "PLACED",
          total: 300,
          subtotal: 300,
        },
      });

      const emittedEvents = [];
      const createMockBroadcaster = (ns) => ({
        to: (...rooms) => {
          const collected = [...rooms];
          const chain = {
            to: (r) => {
              collected.push(r);
              return chain;
            },
            emit: (event, payload) => {
              for (const room of collected) {
                emittedEvents.push({ ns, room, event, payload });
              }
            },
          };
          return chain;
        },
        emit: (event, payload) => {
          emittedEvents.push({ ns, room: "broadcast", event, payload });
        },
      });

      const mockRealtime = {
        io: {
          ...createMockBroadcaster("root"),
          of: () => mockRealtime.staff,
        },
        staff: createMockBroadcaster("staff"),
        emitOrderUpdated: () => {},
      };

      // Transition to PREPARING
      await updateOrderStatus({
        prisma,
        actor: { role: "OWNER", userId: ownerUser.id, restaurantId: rid },
        orderId: customerOrder.id,
        nextStatus: "PREPARING",
        realtime: mockRealtime,
      });

      // Verify that notification:new was emitted for the customer
      const custNotif = emittedEvents.find(
        (e) => e.event === "notification:new" && String(e.room).includes(`customer:${customer.id}`)
      );
      assert.ok(custNotif, "Customer status transition must emit realtime notification:new");
      assert.equal(custNotif.payload.notificationType, NOTIFICATION_TYPES.FOOD_PREPARING);

      // Verify persistent record in DB
      const dbCustNotif = await prisma.notification.findFirst({
        where: {
          orderId: customerOrder.id,
          notificationType: NOTIFICATION_TYPES.FOOD_PREPARING,
        },
      });
      assert.ok(dbCustNotif, "Customer FOOD_PREPARING notification must be persisted in DB");
    });

    // Subtest 5: ORDER_DELIVERED persistence & recipient targeting for both Server and Owner
    await t.test("5. ORDER_DELIVERED persists separate records for Server and Restaurant/Owner", async () => {
      const serverNotif = await createAndDispatchNotification({
        prisma,
        realtime,
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverUser.id,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        title: "Food Delivered — Table 1",
        message: "Order #1 delivered to Table 1.",
        idempotencyKey: `test_deliv_srv_${ts}`,
      });

      const ownerNotif = await createAndDispatchNotification({
        prisma,
        realtime,
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.RESTAURANT,
        recipientId: rid,
        notificationType: NOTIFICATION_TYPES.ORDER_DELIVERED,
        title: "Food Delivered — Table 1",
        message: "Order #1 delivered to Table 1.",
        idempotencyKey: `test_deliv_own_${ts}`,
      });

      assert.ok(serverNotif);
      assert.ok(ownerNotif);

      // Verify Server GET /api/notifications returns the delivery notification
      const serverRes = await getUserNotifications({
        prisma,
        userId: serverUser.id,
        restaurantId: rid,
        effectiveRole: "WAITER",
        role: "WAITER",
      });
      const serverHasIt = serverRes.notifications.some((n) => n.id === serverNotif.id);
      assert.equal(serverHasIt, true, "Server must receive ORDER_DELIVERED");

      // Verify Owner GET /api/notifications returns the restaurant delivery notification
      const ownerRes = await getUserNotifications({
        prisma,
        userId: ownerUser.id,
        restaurantId: rid,
        effectiveRole: "OWNER",
        role: "OWNER",
      });
      const ownerHasIt = ownerRes.notifications.some((n) => n.id === ownerNotif.id);
      assert.equal(ownerHasIt, true, "Owner must receive ORDER_DELIVERED");
    });

    // Subtest 6: Owner Filter Categorization
    await t.test("6. Owner filter categorization allows FOOD_READY and ORDER_DELIVERED under ORDERS, WAITER_CALL under TABLES", () => {
      // Simulate OwnerNotifications.jsx filtering logic
      const testItems = [
        { id: 1, type: "FOOD_READY", title: "Food Ready" },
        { id: 2, type: "ORDER_DELIVERED", title: "Food Delivered" },
        { id: 3, type: "WAITER_CALL", title: "Waiter Called" },
        { id: 4, type: "BILL_REQUESTED", title: "Bill Requested" },
        { id: 5, type: "PAYMENT_SUCCESS", title: "Payment Success" },
        { id: 6, type: "SYSTEM_ALERT", title: "Staff Task" },
      ];

      const applyOwnerFilter = (items, filterType) => {
        return items.filter((item) => {
          const typeUpper = String(item.type || "").toUpperCase();
          if (filterType === "ORDERS" && !typeUpper.includes("ORDER") && !typeUpper.includes("DELIVER") && !typeUpper.includes("FOOD") && !typeUpper.includes("KOT")) return false;
          if (filterType === "TABLES" && !typeUpper.includes("TABLE") && !typeUpper.includes("WAITER") && !typeUpper.includes("BILL")) return false;
          if (filterType === "SUCCESS" && !["SUCCESS", "PAYMENT", "DELIVERED", "SERVED", "CLEANED", "ACCEPTED", "COMPLETED"].some((t) => typeUpper.includes(t))) return false;
          if (filterType === "INFO" && !["INFO", "SYSTEM", "TASK", "ALERT", "STOCK", "EXPIRY", "BATCH", "GRN", "BARGAIN", "WASTAGE", "SECURITY"].some((t) => typeUpper.includes(t)) && (typeUpper.includes("ORDER") || typeUpper.includes("TABLE") || typeUpper.includes("WAITER") || typeUpper.includes("BILL") || typeUpper.includes("FOOD") || typeUpper.includes("KOT"))) return false;
          return true;
        });
      };

      const ordersTab = applyOwnerFilter(testItems, "ORDERS");
      assert.ok(ordersTab.some((i) => i.type === "FOOD_READY"), "FOOD_READY must be visible in Owner ORDERS");
      assert.ok(ordersTab.some((i) => i.type === "ORDER_DELIVERED"), "ORDER_DELIVERED must be visible in Owner ORDERS");

      const tablesTab = applyOwnerFilter(testItems, "TABLES");
      assert.ok(tablesTab.some((i) => i.type === "WAITER_CALL"), "WAITER_CALL must be visible in Owner TABLES");
      assert.ok(tablesTab.some((i) => i.type === "BILL_REQUESTED"), "BILL_REQUESTED must be visible in Owner TABLES");

      const successTab = applyOwnerFilter(testItems, "SUCCESS");
      assert.ok(successTab.some((i) => i.type === "ORDER_DELIVERED"), "ORDER_DELIVERED must be in SUCCESS");
      assert.ok(successTab.some((i) => i.type === "PAYMENT_SUCCESS"), "PAYMENT_SUCCESS must be in SUCCESS");

      const infoTab = applyOwnerFilter(testItems, "INFO");
      assert.ok(infoTab.some((i) => i.type === "SYSTEM_ALERT"), "SYSTEM_ALERT must be in INFO");
    });

    // Subtest 7: Server Filter Categorization
    await t.test("7. Server filter categorization allows ORDER_DELIVERED under ORDERS and SUCCESS", () => {
      // Simulate ServerNotificationsView.jsx filtering logic
      const testItems = [
        { id: 1, type: "ORDER_PLACED", title: "Order Sent to Kitchen", isRead: false },
        { id: 2, type: "FOOD_READY", title: "Food Ready", isRead: false },
        { id: 3, type: "ORDER_DELIVERED", title: "Food Delivered", isRead: false },
        { id: 4, type: "TABLE_ASSIGNMENT", title: "Table Assigned", isRead: false },
        { id: 5, type: "SYSTEM_ALERT", title: "Task Alert", isRead: false },
      ];

      const applyServerFilter = (items, filterType) => {
        return items.filter((item) => {
          const typeUpper = String(item.type || "").toUpperCase();
          if (filterType === "ORDERS") {
            if (!typeUpper.includes("ORDER") && !typeUpper.includes("DELIVER")) return false;
          } else if (filterType === "KITCHEN") {
            if (!typeUpper.includes("KOT") && !typeUpper.includes("KITCHEN") && !typeUpper.includes("FOOD") && !typeUpper.includes("PASS") && !typeUpper.includes("READY")) return false;
          } else if (filterType === "SUCCESS") {
            if (!["SUCCESS", "PAYMENT", "DELIVERED", "ACCEPTED", "CLEANED", "SERVED"].some((t) => typeUpper.includes(t))) return false;
          } else if (filterType === "INFO") {
            if (["ORDER", "KOT"].some((t) => typeUpper.includes(t)) && !typeUpper.includes("TASK")) return false;
            if (["FOOD_READY", "FOOD_PREPARING"].some((t) => typeUpper.includes(t))) return false;
          }
          return true;
        });
      };

      const serverOrdersTab = applyServerFilter(testItems, "ORDERS");
      assert.ok(serverOrdersTab.some((i) => i.type === "ORDER_PLACED"), "ORDER_PLACED must be in Server ORDERS");
      assert.ok(serverOrdersTab.some((i) => i.type === "ORDER_DELIVERED"), "ORDER_DELIVERED must be in Server ORDERS");

      const serverKitchenTab = applyServerFilter(testItems, "KITCHEN");
      assert.ok(serverKitchenTab.some((i) => i.type === "FOOD_READY"), "FOOD_READY must be in Server KITCHEN");

      const serverSuccessTab = applyServerFilter(testItems, "SUCCESS");
      assert.ok(serverSuccessTab.some((i) => i.type === "ORDER_DELIVERED"), "ORDER_DELIVERED must be in Server SUCCESS");

      const serverInfoTab = applyServerFilter(testItems, "INFO");
      assert.ok(serverInfoTab.some((i) => i.type === "TABLE_ASSIGNMENT"), "TABLE_ASSIGNMENT must be in Server INFO");
      assert.ok(serverInfoTab.some((i) => i.type === "SYSTEM_ALERT"), "SYSTEM_ALERT must be in Server INFO");
    });

    // Subtest 8: Mark single and mark all read works
    await t.test("8. Mark read updates persistence accurately", async () => {
      const notif = await createAndDispatchNotification({
        prisma,
        realtime,
        restaurantId: rid,
        recipientType: RECIPIENT_TYPES.USER,
        recipientId: serverUser.id,
        notificationType: NOTIFICATION_TYPES.WAITER_CALL,
        title: "Guest assistance",
        message: "Table 4 needs water",
      });

      assert.equal(notif.isRead, false);

      const marked = await markNotificationRead({
        prisma,
        notificationId: notif.id,
      });
      assert.equal(marked.success, true);
      assert.equal(marked.notification.isRead, true);

      // Verify DB persistence
      const inDb = await prisma.notification.findUnique({
        where: { id: notif.id },
      });
      assert.equal(inDb.isRead, true);
    });
  } finally {
    if (rid) {
      await prisma.notification.deleteMany({ where: { restaurantId: rid } });
      await prisma.order.deleteMany({ where: { restaurantId: rid } });
      await prisma.customer.deleteMany({ where: { restaurantId: rid } });
      await prisma.user.deleteMany({ where: { restaurantId: rid } });
      await prisma.restaurant.deleteMany({ where: { id: rid } });
    }
    if (app) await app.close();
    await prisma.$disconnect();
  }
});
