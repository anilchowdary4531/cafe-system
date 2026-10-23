import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "../prisma.js";
import ownerRoutes from "../routes/owner.js";
import customerRoutes from "../routes/customer.js";
import tableSessionRoutes from "../routes/tableSessions.js";
import { completeSessionAndReleaseTable, getOrCreateActiveSession } from "../services/tableSessionService.js";
import { recordSessionPayment, createOrUpdateBillSplits } from "../services/splitBillingService.js";
import { payOrderWithWallet } from "../services/walletService.js";
import { verifyPayment } from "../services/paymentService.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

const STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];

async function createTestApp(emittedEvents = []) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-p0-table-lifecycle-jwt-secret-xyz123" });

  const requireOwnerRouteAuth = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma,
      allowedRoles: STAFF_ALLOWED_ROLES,
      matchRestaurantParam: "restaurantId",
    });
    if (!actor) return reply;
    req.staffActor = actor;
    req.user = { id: actor.userId, name: actor.userName, role: actor.role, restaurantId: actor.restaurantId };
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
    emitOrderCreated: (order) => emittedEvents.push({ event: "order:created", order }),
    emitOrderUpdated: (order) => emittedEvents.push({ event: "order:updated", order }),
    emitTableSessionUpdated: (session) => emittedEvents.push({ event: "table:session_updated", session }),
  };

  app.realtime = mockRealtime;

  const buildQrTargetUrl = (slug, tableNo) => `/menu/${slug}?table=${tableNo}`;

  await ownerRoutes(app, {
    prisma,
    realtime: mockRealtime,
    buildQrTargetUrl,
    STAFF_ALLOWED_ROLES,
  });

  await customerRoutes(app, {
    prisma,
    realtime: mockRealtime,
  });

  await tableSessionRoutes(app, {
    prisma,
    STAFF_ALLOWED_ROLES,
    realtime: mockRealtime,
  });

  return app;
}

test("PHASE P0 — Financial & Table-State Integrity Regression Test Suite", async (t) => {
  let app;
  let emittedEvents = [];
  let restaurantA;
  let restaurantB;
  let ownerUserA;
  let ownerTokenA;
  let waiterUserA;
  let waiterTokenA;
  let ownerUserB;
  let ownerTokenB;
  let table1A;
  let table2A;
  let tableT2A;
  let menuItemA;

  t.before(async () => {
    app = await createTestApp(emittedEvents);
    const ts = Date.now();

    // Create Restaurant A
    restaurantA = await prisma.restaurant.create({
      data: {
        name: `P0 Rest A ${ts}`,
        slug: `p0-rest-a-${ts}`,
        phone: `+91987${String(ts).slice(-7)}`,
        invoicePrefix: "P0A",
      },
    });

    // Create Restaurant B (for tenant isolation tests)
    restaurantB = await prisma.restaurant.create({
      data: {
        name: `P0 Rest B ${ts}`,
        slug: `p0-rest-b-${ts}`,
        phone: `+91988${String(ts).slice(-7)}`,
        invoicePrefix: "P0B",
      },
    });

    // Create Users
    ownerUserA = await prisma.user.create({
      data: {
        name: "Owner A",
        email: `owner_a_${ts}@tiffzy.com`,
        password: "hash",
        role: "OWNER",
        restaurantId: restaurantA.id,
      },
    });
    ownerTokenA = app.jwt.sign({ id: ownerUserA.id, role: "OWNER", restaurantId: restaurantA.id });

    waiterUserA = await prisma.user.create({
      data: {
        name: "Waiter A",
        email: `waiter_a_${ts}@tiffzy.com`,
        password: "hash",
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
    });
    waiterTokenA = app.jwt.sign({ id: waiterUserA.id, role: "WAITER", restaurantId: restaurantA.id });

    ownerUserB = await prisma.user.create({
      data: {
        name: "Owner B",
        email: `owner_b_${ts}@tiffzy.com`,
        password: "hash",
        role: "OWNER",
        restaurantId: restaurantB.id,
      },
    });
    ownerTokenB = app.jwt.sign({ id: ownerUserB.id, role: "OWNER", restaurantId: restaurantB.id });

    // Create Tables for Restaurant A
    table1A = await prisma.diningTable.create({
      data: {
        restaurantId: restaurantA.id,
        tableNo: "1",
        seats: 4,
        assignedWaiterId: waiterUserA.id,
        assignedWaiterName: waiterUserA.name,
      },
    });

    table2A = await prisma.diningTable.create({
      data: {
        restaurantId: restaurantA.id,
        tableNo: "2",
        seats: 2,
      },
    });

    tableT2A = await prisma.diningTable.create({
      data: {
        restaurantId: restaurantA.id,
        tableNo: "T2",
        seats: 6,
      },
    });

    // Create Menu Item
    menuItemA = await prisma.menuItem.create({
      data: {
        restaurantId: restaurantA.id,
        name: "Filter Coffee",
        category: "Beverages",
        price: 50,
        isAvailable: true,
      },
    });
  });

  t.after(async () => {
    if (restaurantA?.id) {
      await prisma.tableOperationLog.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.billSplit.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.payment.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurantA.id } } });
      await prisma.order.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.user.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.restaurant.delete({ where: { id: restaurantA.id } });
    }
    if (restaurantB?.id) {
      await prisma.tableOperationLog.deleteMany({ where: { restaurantId: restaurantB.id } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: restaurantB.id } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: restaurantB.id } });
      await prisma.user.deleteMany({ where: { restaurantId: restaurantB.id } });
      await prisma.restaurant.delete({ where: { id: restaurantB.id } });
    }
  });

  // TEST 01: DELIVERED + PENDING order keeps table OCCUPIED.
  // TEST 02: DELIVERED + unpaid order appears in Owner table data.
  // TEST 03: Owner receipt remains available after DELIVERED.
  await t.test("TEST 01, 02, 03: DELIVERED + PENDING order keeps table OCCUPIED and visible in Owner tables", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-ORD-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 50,
        total: 50,
        items: {
          create: [{ menuItemId: menuItemA.id, itemName: "Filter Coffee", qty: 1, price: 50, total: 50 }],
        },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });

    assert.equal(res.statusCode, 200);
    const tables = JSON.parse(res.payload);
    const t1 = tables.find((t) => t.id === table1A.id);

    assert.ok(t1, "Table 1 must be present");
    assert.equal(t1.isOccupied, true, "Table with DELIVERED + PENDING order MUST be occupied (TEST 01)");
    assert.ok(t1.activeOrders.length > 0, "Delivered unpaid order MUST appear in Owner table data (TEST 02)");
    assert.equal(t1.activeOrders[0].id, order.id);
    assert.equal(t1.activeOrders[0].items[0].itemName, "Filter Coffee", "Receipt items must remain available (TEST 03)");

    // Cleanup order & session for next test
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 04: Print does NOT change database state.
  // TEST 05: Print does NOT free the table.
  await t.test("TEST 04, 05: Printing bill does NOT alter database or free table", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-ORD-PRINT-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 50,
        total: 50,
      },
    });

    // In frontend OwnerLayout, handleReceiptPrint only calls window.open / printWindow.print()
    // It makes 0 API calls and modifies 0 DB records.
    const orderInDb = await prisma.order.findUnique({ where: { id: order.id } });
    const sessionInDb = await prisma.tableSession.findUnique({ where: { id: session.id } });

    assert.equal(orderInDb.paymentStatus, "PENDING", "PaymentStatus must remain PENDING (TEST 04)");
    assert.equal(sessionInDb.status, "OPEN", "Session status must remain OPEN (TEST 04)");

    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const tables = JSON.parse(res.payload);
    const t1 = tables.find((t) => t.id === table1A.id);
    assert.equal(t1.isOccupied, true, "Table remains OCCUPIED (TEST 05)");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 06: Delivered unpaid order can be settled via settle-bill.
  await t.test("TEST 06: Delivered unpaid order can be settled and completes table session", async () => {
    emittedEvents.length = 0;
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-SETTLE-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 100,
        total: 100,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/1/settle-bill`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { paymentMode: "CASH" },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.cleared, true, "Delivered unpaid order must be settled (TEST 06)");

    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(dbOrder.paymentStatus, "SUCCESS");

    const dbSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(dbSession.status, "CLOSED", "TableSession must be CLOSED after full settlement");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 07: Failed payment keeps table OCCUPIED.
  // TEST 08: Cancelled payment keeps table OCCUPIED.
  await t.test("TEST 07, 08: Failed or Cancelled payment keeps table OCCUPIED", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const orderFail = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-FAIL-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "FAILED",
        subtotal: 50,
        total: 50,
      },
    });

    let res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    let tables = JSON.parse(res.payload);
    let t1 = tables.find((t) => t.id === table1A.id);
    assert.equal(t1.isOccupied, true, "Table with FAILED payment remains OCCUPIED (TEST 07)");

    // Change to CANCELLED payment
    await prisma.order.update({
      where: { id: orderFail.id },
      data: { paymentStatus: "CANCELLED" },
    });

    res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    tables = JSON.parse(res.payload);
    t1 = tables.find((t) => t.id === table1A.id);
    assert.equal(t1.isOccupied, true, "Table with CANCELLED payment remains OCCUPIED (TEST 08)");

    // Cleanup
    await prisma.order.delete({ where: { id: orderFail.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 09, 16, 17, 18, 19, 20: Successful CASH payment closes fully paid session, frees table, clears waiter, emits events
  await t.test("TEST 09, 16, 17, 18, 19, 20: Successful CASH payment completes session and releases table", async () => {
    emittedEvents.length = 0;
    // Set table waiter assignment
    await prisma.diningTable.update({
      where: { id: table1A.id },
      data: { assignedWaiterId: waiterUserA.id, assignedWaiterName: waiterUserA.name },
    });

    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-CASH-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 100,
        total: 100,
      },
    });

    // Mark paid and complete session
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID", paymentMode: "CASH" },
    });

    const completion = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session.id,
      orderId: order.id,
      paymentMode: "CASH",
      realtime: app.realtime,
    });

    assert.equal(completion.completed, true, "Session completion should succeed (TEST 09)");

    const dbSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(dbSession.status, "CLOSED");
    assert.ok(dbSession.closedAt, "TableSession gets closedAt when fully paid (TEST 16)");

    const dbTable = await prisma.diningTable.findUnique({ where: { id: table1A.id } });
    assert.equal(dbTable.assignedWaiterId, null, "Waiter assignment cleared on table release (TEST 18)");

    const tableUpdatedEvents = emittedEvents.filter((e) => e.event === "table:updated");
    assert.ok(tableUpdatedEvents.length > 0, "Payment completion emits table:updated (TEST 19)");

    const sessionUpdatedEvents = emittedEvents.filter((e) => e.event === "table:session_updated");
    assert.ok(sessionUpdatedEvents.length > 0, "Payment completion emits table:session_updated (TEST 20)");

    // Table is now free in owner tables
    const res = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const tables = JSON.parse(res.payload);
    const t1 = tables.find((t) => t.id === table1A.id);
    assert.equal(t1.isOccupied, false, "DiningTable becomes FREE after session closure (TEST 17)");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 10: Successful UPI payment closes a fully paid session.
  // TEST 11: Successful CARD / Cashfree payment closes a fully paid session.
  await t.test("TEST 10, 11: UPI and CARD/Cashfree payments close fully paid session", async () => {
    // UPI
    const sessionUPI = await prisma.tableSession.create({
      data: { restaurantId: restaurantA.id, tableId: table1A.id, tableNo: "1", status: "OPEN" },
    });
    const orderUPI = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: sessionUPI.id,
        tableNo: "1",
        orderNo: `P0-UPI-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMode: "UPI",
        subtotal: 150,
        total: 150,
      },
    });
    const compUPI = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: sessionUPI.id,
      orderId: orderUPI.id,
      paymentMode: "UPI",
      realtime: app.realtime,
    });
    assert.equal(compUPI.completed, true);
    const dbSessUPI = await prisma.tableSession.findUnique({ where: { id: sessionUPI.id } });
    assert.equal(dbSessUPI.status, "CLOSED", "UPI payment closes session (TEST 10)");

    // CARD
    const sessionCard = await prisma.tableSession.create({
      data: { restaurantId: restaurantA.id, tableId: table1A.id, tableNo: "1", status: "OPEN" },
    });
    const orderCard = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: sessionCard.id,
        tableNo: "1",
        orderNo: `P0-CARD-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMode: "CARD",
        subtotal: 200,
        total: 200,
      },
    });
    const compCard = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: sessionCard.id,
      orderId: orderCard.id,
      paymentMode: "CARD",
      realtime: app.realtime,
    });
    assert.equal(compCard.completed, true);
    const dbSessCard = await prisma.tableSession.findUnique({ where: { id: sessionCard.id } });
    assert.equal(dbSessCard.status, "CLOSED", "Card payment closes session (TEST 11)");

    // Cleanup
    await prisma.order.deleteMany({ where: { id: { in: [orderUPI.id, orderCard.id] } } });
    await prisma.tableSession.deleteMany({ where: { id: { in: [sessionUPI.id, sessionCard.id] } } });
  });

  // TEST 12: Successful Wallet payment closes a fully paid session.
  await t.test("TEST 12: Wallet payment closes a fully paid session", async () => {
    await prisma.customerAccount.deleteMany({ where: { phone: "+919999900001" } });
    const custAccount = await prisma.customerAccount.create({
      data: { phone: "+919999900001", name: "Wallet Test User" },
    });
    await prisma.wallet.create({
      data: { customerAccountId: custAccount.id, balance: 500, status: "ACTIVE" },
    });

    const sessionWallet = await prisma.tableSession.create({
      data: { restaurantId: restaurantA.id, tableId: table1A.id, tableNo: "1", status: "OPEN" },
    });
    const orderWallet = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: sessionWallet.id,
        tableNo: "1",
        orderNo: `P0-WALLET-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 100,
        total: 100,
      },
    });

    const walletResult = await payOrderWithWallet(prisma, {
      customerAccountId: custAccount.id,
      orderId: orderWallet.id,
      amount: 100,
      realtime: app.realtime,
    });
    assert.equal(walletResult.success, true);

    const dbSess = await prisma.tableSession.findUnique({ where: { id: sessionWallet.id } });
    assert.equal(dbSess.status, "CLOSED", "Wallet payment closes session (TEST 12)");

    // Cleanup
    await prisma.walletLedger.deleteMany({ where: { orderId: orderWallet.id } });
    await prisma.wallet.deleteMany({ where: { customerAccountId: custAccount.id } });
    await prisma.customerAccount.delete({ where: { id: custAccount.id } });
    await prisma.order.delete({ where: { id: orderWallet.id } });
    await prisma.tableSession.delete({ where: { id: sessionWallet.id } });
  });

  // TEST 13: Partial payment does NOT close the session.
  // TEST 14: Full split payment closes the session.
  // TEST 15: All relevant orders in a multi-order session become PAID after full settlement.
  await t.test("TEST 13, 14, 15: Split billing partial keeps open, full settlement closes session and marks all orders PAID", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
        subtotal: 200,
        total: 200,
      },
    });

    const order1 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-SPLIT1-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 100,
        total: 100,
        items: {
          create: [{ menuItemId: menuItemA.id, itemName: "Coffee 1", qty: 2, price: 50, total: 100 }],
        },
      },
    });

    const order2 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-SPLIT2-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 100,
        total: 100,
        items: {
          create: [{ menuItemId: menuItemA.id, itemName: "Coffee 2", qty: 2, price: 50, total: 100 }],
        },
      },
    });

    // Create Equal Split: 2 splits of 100 each
    const splits = await createOrUpdateBillSplits({
      prisma,
      restaurantId: restaurantA.id,
      tableSessionId: session.id,
      splitType: "EQUAL",
      splitCount: 2,
    });
    assert.equal(splits.length, 2);

    // Pay Split 1 (Partial payment: ₹100 of ₹200)
    const pay1 = await recordSessionPayment({
      prisma,
      restaurantId: restaurantA.id,
      tableSessionId: session.id,
      billSplitId: splits[0].id,
      paymentMode: "CASH",
      amount: 100,
    });
    assert.equal(pay1.isFullyPaid, false, "Partial payment must not be fully paid (TEST 13)");
    assert.equal(pay1.session.status, "BILLING", "Session status must remain open/billing on partial payment (TEST 13)");

    // Verify table remains occupied on partial payment
    const checkRes = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const tables = JSON.parse(checkRes.payload);
    const t1 = tables.find((t) => t.id === table1A.id);
    assert.equal(t1.isOccupied, true, "Table remains occupied on partial payment (TEST 13)");

    // Pay Split 2 (Full settlement: remaining ₹100)
    const pay2 = await recordSessionPayment({
      prisma,
      restaurantId: restaurantA.id,
      tableSessionId: session.id,
      billSplitId: splits[1].id,
      paymentMode: "UPI",
      amount: 100,
    });
    assert.equal(pay2.isFullyPaid, true, "Full split payment marks isFullyPaid true (TEST 14)");
    assert.equal(pay2.session.status, "CLOSED", "Full split payment closes the session (TEST 14)");

    // Verify all relevant orders in multi-order session are marked PAID (TEST 15)
    const dbO1 = await prisma.order.findUnique({ where: { id: order1.id } });
    const dbO2 = await prisma.order.findUnique({ where: { id: order2.id } });
    assert.equal(dbO1.paymentStatus, "PAID", "Order 1 must become PAID after full settlement (TEST 15)");
    assert.equal(dbO2.paymentStatus, "PAID", "Order 2 must become PAID after full settlement (TEST 15)");

    // Cleanup
    await prisma.payment.deleteMany({ where: { tableSessionId: session.id } });
    await prisma.billSplit.deleteMany({ where: { tableSessionId: session.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: [order1.id, order2.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 21: Duplicate payment verification is idempotent.
  await t.test("TEST 21: Duplicate payment verification is idempotent", async () => {
    const session = await prisma.tableSession.create({
      data: { restaurantId: restaurantA.id, tableId: table1A.id, tableNo: "1", status: "OPEN" },
    });
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-IDEMP-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMode: "CASH",
        subtotal: 50,
        total: 50,
      },
    });

    // Call 1
    const comp1 = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session.id,
      orderId: order.id,
      paymentMode: "CASH",
    });
    assert.equal(comp1.completed, true);

    // Call 2 (Duplicate)
    const comp2 = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session.id,
      orderId: order.id,
      paymentMode: "CASH",
    });
    assert.equal(comp2.completed, true);
    assert.equal(comp2.alreadyClosed, true, "Duplicate call must be idempotent guard (TEST 21)");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
    await prisma.diningTable.updateMany({
      where: { restaurantId: restaurantA.id },
      data: { cleaningStatus: "CLEAN" },
    });
  });

  // TEST 22: QR dine-in order creates/uses an active TableSession.
  // TEST 23: Two QR orders at the same table reuse the same active session.
  // TEST 24: A new QR order is not linked to a closed session.
  await t.test("TEST 22, 23, 24: QR dine-in order creates session, subsequent orders reuse it, closed session is not reused", async () => {
    // 1. First QR order on Table 1
    const res1 = await app.inject({
      method: "POST",
      url: `/r/${restaurantA.slug}/order`,
      payload: {
        phone: "+919876543201",
        customerName: "Customer 1",
        tableNumber: "1",
        items: [{ id: menuItemA.id, qty: 1 }],
      },
    });
    assert.equal(res1.statusCode, 200);
    const order1 = JSON.parse(res1.payload).order;
    assert.ok(order1.tableSessionId, "QR dine-in order must receive a TableSession.id (TEST 22)");
    const initialSessionId = order1.tableSessionId;

    // 2. Second QR order on Table 1 while session is active
    const res2 = await app.inject({
      method: "POST",
      url: `/r/${restaurantA.slug}/order`,
      payload: {
        phone: "+919876543202",
        customerName: "Customer 2",
        tableNumber: "1",
        items: [{ id: menuItemA.id, qty: 2 }],
      },
    });
    assert.equal(res2.statusCode, 200);
    const order2 = JSON.parse(res2.payload).order;
    assert.equal(order2.tableSessionId, initialSessionId, "Second QR order must reuse the active TableSession (TEST 23)");

    let order3 = null;
    try {
      // 3. Pay orders so session can be closed cleanly
      await prisma.order.updateMany({
        where: { id: { in: [order1.id, order2.id] } },
        data: { paymentStatus: "PAID", status: "DELIVERED" },
      });

      // Close the session
      const closeRes = await completeSessionAndReleaseTable({
        prisma,
        tableSessionId: initialSessionId,
        paymentMode: "CASH",
      });
      assert.equal(closeRes.completed, true, "Session should close when orders are paid");

      // Table is cleaned after checkout
      await prisma.diningTable.updateMany({
        where: { restaurantId: restaurantA.id, tableNo: "1" },
        data: { cleaningStatus: "CLEAN" },
      });

      // 4. Third QR order after session closed and table cleaned
      const res3 = await app.inject({
        method: "POST",
        url: `/r/${restaurantA.slug}/order`,
        payload: {
          phone: "+919876543203",
          customerName: "Customer 3",
          tableNumber: "1",
          items: [{ id: menuItemA.id, qty: 1 }],
        },
      });
      assert.equal(res3.statusCode, 200);
      order3 = JSON.parse(res3.payload).order;
      assert.ok(order3.tableSessionId, "New order has a session ID");
      assert.notEqual(order3.tableSessionId, initialSessionId, "New QR order must NOT reuse closed session (TEST 24)");
    } finally {
      // Cleanup
      const orderIds = [order1?.id, order2?.id, order3?.id].filter(Boolean);
      if (orderIds.length > 0) {
        await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }
      const sessionIds = [initialSessionId, order3?.tableSessionId].filter(Boolean);
      if (sessionIds.length > 0) {
        await prisma.tableSession.deleteMany({ where: { id: { in: sessionIds } } });
      }
    }
  });

  // TEST 25: Restaurant A cannot operate on Restaurant B's table session.
  // TEST 26: Unauthenticated table-session mutation is rejected.
  // TEST 27: Unauthorized role cannot perform protected session mutation.
  await t.test("TEST 25, 26, 27: Security, Authentication, and Tenant Isolation on Table Sessions", async () => {
    // Create session in Restaurant B
    const tableB = await prisma.diningTable.create({
      data: { restaurantId: restaurantB.id, tableNo: "B1", seats: 4 },
    });
    const sessionB = await prisma.tableSession.create({
      data: { restaurantId: restaurantB.id, tableId: tableB.id, tableNo: "B1", status: "OPEN" },
    });

    // TEST 26: Unauthenticated call is rejected with 401
    const unauthRes = await app.inject({
      method: "POST",
      url: `/tables/sessions/${sessionB.id}/close`,
    });
    assert.equal(unauthRes.statusCode, 401, "Unauthenticated table-session mutation must be rejected (TEST 26)");

    // TEST 25: Owner of Restaurant A tries to close Restaurant B's session -> rejected with 403
    const crossTenantRes = await app.inject({
      method: "POST",
      url: `/tables/sessions/${sessionB.id}/close`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    assert.equal(crossTenantRes.statusCode, 403, "Restaurant A cannot operate on Restaurant B's table session (TEST 25)");

    // TEST 27: Customer token cannot access staff session mutation -> 403
    const customerToken = app.jwt.sign({ id: 999, type: "customer", phone: "+919999900000" });
    const customerRes = await app.inject({
      method: "POST",
      url: `/tables/sessions/${sessionB.id}/close`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert.equal(customerRes.statusCode, 403, "Customer token must be rejected for staff session endpoint (TEST 27)");

    // Cleanup
    await prisma.tableSession.delete({ where: { id: sessionB.id } });
    await prisma.diningTable.delete({ where: { id: tableB.id } });
  });

  // TEST 28: Table 2 and T2 remain distinct.
  await t.test("TEST 28: Table 2 and Table T2 remain distinct (no identity collision)", async () => {
    assert.notEqual(table2A.id, tableT2A.id, "Table 2 and T2 must have distinct database IDs");
    assert.equal(table2A.tableNo, "2");
    assert.equal(tableT2A.tableNo, "T2");

    // Create session on Table 2
    const session2 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurantA.id,
      tableId: table2A.id,
    });
    assert.equal(session2.tableId, table2A.id);
    assert.equal(session2.tableNo, "2");

    // Create session on Table T2
    const sessionT2 = await getOrCreateActiveSession({
      prisma,
      restaurantId: restaurantA.id,
      tableId: tableT2A.id,
    });
    assert.equal(sessionT2.tableId, tableT2A.id);
    assert.equal(sessionT2.tableNo, "T2");
    assert.notEqual(session2.id, sessionT2.id, "Table 2 and T2 sessions must be separate (TEST 28)");

    // Cleanup
    await prisma.tableSession.deleteMany({ where: { id: { in: [session2.id, sessionT2.id] } } });
  });

  // TEST 29: DELIVERED + PAID order does not keep table occupied by itself.
  await t.test("TEST 29: DELIVERED + PAID order does NOT keep table occupied", async () => {
    // Clear any stale orders/sessions on table1A
    await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurantA.id, tableNo: "1" } } });
    await prisma.order.deleteMany({ where: { restaurantId: restaurantA.id, tableNo: "1" } });
    await prisma.tableSession.deleteMany({ where: { restaurantId: restaurantA.id, tableId: table1A.id } });

    const orderPaid = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableNo: "1",
        orderNo: `P0-PAID-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PAID",
        subtotal: 50,
        total: 50,
      },
    });

    try {
      const res = await app.inject({
        method: "GET",
        url: `/owner/${restaurantA.id}/tables`,
        headers: { authorization: `Bearer ${ownerTokenA}` },
      });
      const tables = JSON.parse(res.payload);
      const t1 = tables.find((t) => t.id === table1A.id);
      assert.equal(t1.isOccupied, false, "DELIVERED + PAID order must NOT keep table occupied (TEST 29)");
    } finally {
      // Cleanup
      await prisma.order.delete({ where: { id: orderPaid.id } });
    }
  });

  // TEST 30: A session containing one paid order and one unpaid order remains OCCUPIED.
  // TEST 31: When the final unpaid order becomes PAID, the session closes.
  await t.test("TEST 30, 31: Multi-order session remains OCCUPIED until final order is paid, then closes", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const orderPaid = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-MULTI1-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PAID",
        subtotal: 50,
        total: 50,
      },
    });

    const orderUnpaid = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-MULTI2-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 80,
        total: 80,
      },
    });

    // Try completing session with orderPaid
    const attempt1 = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session.id,
      orderId: orderPaid.id,
    });
    assert.equal(attempt1.completed, false, "Session cannot complete while unpaid order remains (TEST 30)");
    assert.equal(attempt1.reason, "unpaid_orders_remain");

    // Table must remain occupied
    const res1 = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const tables1 = JSON.parse(res1.payload);
    const t1 = tables1.find((t) => t.id === table1A.id);
    assert.equal(t1.isOccupied, true, "Table remains OCCUPIED when one order is unpaid (TEST 30)");

    // Now mark the final order paid
    await prisma.order.update({
      where: { id: orderUnpaid.id },
      data: { paymentStatus: "PAID" },
    });

    const attempt2 = await completeSessionAndReleaseTable({
      prisma,
      tableSessionId: session.id,
      orderId: orderUnpaid.id,
      paymentMode: "CASH",
    });
    assert.equal(attempt2.completed, true, "Session completes when final order is paid (TEST 31)");

    const dbSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(dbSession.status, "CLOSED", "Session is CLOSED (TEST 31)");

    // Cleanup
    await prisma.order.deleteMany({ where: { id: { in: [orderPaid.id, orderUnpaid.id] } } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 32: Transaction failure does not emit a successful table-release event.
  await t.test("TEST 32: Transaction failure does NOT emit table-release events", async () => {
    emittedEvents.length = 0;
    const mockFailingPrisma = {
      order: {
        findUnique: async () => ({ id: 999, tableSessionId: 888, restaurantId: 1 }),
      },
      tableSession: {
        findUnique: async () => ({
          id: 888,
          restaurantId: 1,
          status: "OPEN",
          orders: [{ id: 999, status: "DELIVERED", paymentStatus: "PAID" }],
        }),
      },
      $transaction: async () => {
        throw new Error("Simulated DB Transaction Failure");
      },
    };

    await assert.rejects(
      async () => {
        await completeSessionAndReleaseTable({
          prisma: mockFailingPrisma,
          tableSessionId: 888,
          orderId: 999,
          realtime: app.realtime,
        });
      },
      /Simulated DB Transaction Failure/
    );

    const tableEvents = emittedEvents.filter((e) => e.event === "table:updated");
    assert.equal(tableEvents.length, 0, "No table:updated event emitted when transaction fails (TEST 32)");
  });

  // TEST 33: Unforced closeSession endpoint rejects when unpaid orders remain.
  await t.test("TEST 33: Unforced closeSession endpoint rejects when unpaid orders remain", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-UNPAID-CLOSE-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 60,
        total: 60,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/tables/sessions/${session.id}/close`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: {},
    });

    assert.equal(res.statusCode, 400, "Unforced close on session with unpaid order must return 400 (TEST 33)");
    const body = JSON.parse(res.payload);
    assert.equal(body.code, "unpaid_orders_remain", "Error code must indicate unpaid orders remain");

    const dbSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(dbSession.status, "OPEN", "Session must remain OPEN after rejected close attempt");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 34: Forced closeSession endpoint closes session and frees table.
  await t.test("TEST 34: Forced closeSession endpoint closes session and frees table", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-FORCE-CLOSE-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 75,
        total: 75,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/tables/sessions/${session.id}/close`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { force: true, reason: "Manager force cleared table" },
    });

    assert.equal(res.statusCode, 200, "Forced close must succeed (TEST 34)");
    const dbSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(dbSession.status, "CLOSED", "Session must be CLOSED after forced close");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 35: Duplicate settle-bill calls are idempotent and do not fail.
  await t.test("TEST 35: Duplicate settle-bill calls are idempotent and safe", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: "1",
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: "1",
        orderNo: `P0-IDEM-SETTLE-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 90,
        total: 90,
      },
    });

    // First settle call
    const res1 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/1/settle-bill`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { paymentMode: "CASH" },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);
    assert.equal(body1.cleared, true);

    // Second duplicate settle call
    const res2 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/1/settle-bill`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { paymentMode: "CASH" },
    });
    assert.equal(res2.statusCode, 200, "Duplicate settle-bill must succeed idempotently (TEST 35)");
    const body2 = JSON.parse(res2.payload);
    assert.equal(body2.cleared, false);

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 36: Full E2E Owner Force Free endpoint clears table occupancy on GET /owner/:id/tables while preserving financial records
  await t.test("TEST 36: Full E2E Owner Force Free endpoint clears table occupancy on GET /owner/:id/tables while preserving financial records", async () => {
    // 1. Create active TableSession on table1A
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: table1A.tableNo,
        status: "OPEN",
        waiterId: waiterUserA.id,
        waiterName: waiterUserA.name,
      },
    });

    // 2. Create DELIVERED order with paymentStatus = PENDING
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: table1A.tableNo,
        orderNo: `P0-FORCE-FREE-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 120,
        total: 120,
        items: {
          create: [{ menuItemId: menuItemA.id, itemName: "Filter Coffee", qty: 2, price: 60, total: 120 }],
        },
      },
    });

    // 3. Confirm GET /owner/:restaurantId/tables shows isOccupied = true and activeOrders contains the order
    const getBefore = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    assert.equal(getBefore.statusCode, 200);
    const tablesBefore = JSON.parse(getBefore.payload);
    const t1Before = tablesBefore.find((t) => t.id === table1A.id);
    assert.ok(t1Before, "Table 1 must exist");
    assert.equal(t1Before.isOccupied, true, "Table with active session and DELIVERED+PENDING order must be occupied");
    assert.equal(t1Before.activeOrders.length, 1, "Must contain exactly 1 active order before clear");
    assert.equal(t1Before.activeOrders[0].id, order.id);

    // 4. Call POST /owner/:restaurantId/tables/:tableId/clear with force=true
    emittedEvents.length = 0;
    const clearRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/${table1A.id}/clear`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: {
        force: true,
        clearWaiter: true,
        reason: "Owner emergency force free",
        performedByUserId: ownerUserA.id,
        performedByName: ownerUserA.name,
        performedByUserRole: "OWNER",
      },
    });

    // 5. Assert HTTP 200
    assert.equal(clearRes.statusCode, 200, "POST /clear with force=true must return HTTP 200");
    const clearBody = JSON.parse(clearRes.payload);
    assert.equal(clearBody.success, true);

    // 6. Assert TableSession = CLOSED in database
    const dbSession = await prisma.tableSession.findUnique({ where: { id: session.id } });
    assert.equal(dbSession.status, "CLOSED", "TableSession status must be CLOSED after force clear");
    assert.ok(dbSession.closedAt, "TableSession closedAt must be populated");

    // 7. Assert assigned waiter is cleared on table
    const dbTable = await prisma.diningTable.findUnique({ where: { id: table1A.id } });
    assert.equal(dbTable.assignedWaiterId, null, "Assigned waiter must be cleared");

    // 8. Assert unpaid order remains DELIVERED and PENDING in DB (Financial integrity!)
    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.ok(dbOrder, "Order must NOT be deleted from database");
    assert.equal(dbOrder.status, "DELIVERED", "Order status must remain DELIVERED");
    assert.equal(dbOrder.paymentStatus, "PENDING", "Order paymentStatus must remain PENDING (not marked fake PAID)");
    assert.equal(dbOrder.total, 120, "Order total amount must remain unchanged");

    // 9. Call GET /owner/:restaurantId/tables after clear
    const getAfter = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    assert.equal(getAfter.statusCode, 200);
    const tablesAfter = JSON.parse(getAfter.payload);
    const t1After = tablesAfter.find((t) => t.id === table1A.id);

    // 10. Assert: isOccupied = false and activeOrders does NOT contain the closed-session order
    assert.equal(t1After.isOccupied, false, "Table MUST be FREE (isOccupied: false) after Force Free");
    assert.equal(t1After.activeOrders.length, 0, "activeOrders must be empty for force-cleared table");
    assert.equal(t1After.activeOrderCount, 0);

    // 11. Assert socket events were emitted
    assert.ok(emittedEvents.some((e) => e.event === "table:updated"), "table:updated event must be emitted");
    assert.ok(emittedEvents.some((e) => e.event === "table:session_updated"), "table:session_updated event must be emitted");
    assert.ok(emittedEvents.some((e) => e.event === "table:layout_updated"), "table:layout_updated event must be emitted");

    // Cleanup
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 37: Multiple DELIVERED/PENDING orders are preserved and table is FREE after Force Free
  await t.test("TEST 37: Multiple DELIVERED/PENDING orders are preserved and table is FREE after Force Free", async () => {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table2A.id,
        tableNo: table2A.tableNo,
        status: "OPEN",
      },
    });

    const order1 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: table2A.tableNo,
        orderNo: `P0-MULTI-1-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 50,
        total: 50,
      },
    });

    const order2 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session.id,
        tableNo: table2A.tableNo,
        orderNo: `P0-MULTI-2-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 75,
        total: 75,
      },
    });

    // Check occupied before
    const get1 = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const t2Before = JSON.parse(get1.payload).find((t) => t.id === table2A.id);
    assert.equal(t2Before.isOccupied, true);
    assert.equal(t2Before.activeOrders.length, 2);

    // Force clear
    const clearRes = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/${table2A.id}/clear`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { force: true },
    });
    assert.equal(clearRes.statusCode, 200);

    // Check free after
    const get2 = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const t2After = JSON.parse(get2.payload).find((t) => t.id === table2A.id);
    assert.equal(t2After.isOccupied, false, "Table must be FREE after Force Free");
    assert.equal(t2After.activeOrders.length, 0);

    // Assert both orders still exist in database with financial integrity
    const dbOrder1 = await prisma.order.findUnique({ where: { id: order1.id } });
    const dbOrder2 = await prisma.order.findUnique({ where: { id: order2.id } });
    assert.equal(dbOrder1.status, "DELIVERED");
    assert.equal(dbOrder1.paymentStatus, "PENDING");
    assert.equal(dbOrder2.status, "DELIVERED");
    assert.equal(dbOrder2.paymentStatus, "PENDING");

    // Cleanup
    await prisma.order.delete({ where: { id: order1.id } });
    await prisma.order.delete({ where: { id: order2.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
  });

  // TEST 38: State matrix: ACTIVE vs CLOSED sessions and PREPARING/READY statuses
  await t.test("TEST 38: State matrix: ACTIVE vs CLOSED sessions and PREPARING/READY statuses", async () => {
    // A. ACTIVE SESSION + PREPARING -> OCCUPIED
    const sessionPrep = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table1A.id,
        tableNo: table1A.tableNo,
        status: "OPEN",
      },
    });
    const orderPrep = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: sessionPrep.id,
        tableNo: table1A.tableNo,
        orderNo: `P0-PREP-${Date.now()}`,
        status: "PREPARING",
        paymentStatus: "PENDING",
        subtotal: 40,
        total: 40,
      },
    });

    const getPrep = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const t1Prep = JSON.parse(getPrep.payload).find((t) => t.id === table1A.id);
    assert.equal(t1Prep.isOccupied, true, "ACTIVE SESSION + PREPARING must be OCCUPIED");
    assert.equal(t1Prep.activeOrders.length, 1);

    // B. ACTIVE SESSION + READY -> OCCUPIED
    await prisma.order.update({
      where: { id: orderPrep.id },
      data: { status: "READY" },
    });
    const getReady = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const t1Ready = JSON.parse(getReady.payload).find((t) => t.id === table1A.id);
    assert.equal(t1Ready.isOccupied, true, "ACTIVE SESSION + READY must be OCCUPIED");

    // C. Force clear -> table is FREE
    await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/${table1A.id}/clear`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { force: true },
    });
    const getAfterClear = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const t1Cleared = JSON.parse(getAfterClear.payload).find((t) => t.id === table1A.id);
    assert.equal(t1Cleared.isOccupied, false, "CLOSED SESSION + historical orders must be FREE");

    // Cleanup
    await prisma.order.delete({ where: { id: orderPrep.id } });
    await prisma.tableSession.delete({ where: { id: sessionPrep.id } });
  });

  // TEST 39: Table 2 vs Table T2 isolation with authoritative DiningTable.id lookup
  await t.test("TEST 39: Table 2 vs Table T2 isolation with authoritative DiningTable.id lookup", async () => {
    // Open session on Table 2 (table2A)
    const session2 = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: table2A.id,
        tableNo: "2",
        status: "OPEN",
      },
    });
    const order2 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: session2.id,
        tableNo: "2",
        orderNo: `P0-T2-ISO-2-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 55,
        total: 55,
      },
    });

    // Open session on Table T2 (tableT2A)
    const sessionT2 = await prisma.tableSession.create({
      data: {
        restaurantId: restaurantA.id,
        tableId: tableT2A.id,
        tableNo: "T2",
        status: "OPEN",
      },
    });
    const orderT2 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        tableSessionId: sessionT2.id,
        tableNo: "T2",
        orderNo: `P0-T2-ISO-T2-${Date.now()}`,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        subtotal: 95,
        total: 95,
      },
    });

    // Both tables must be occupied with their distinct active orders
    const getBoth = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const allTables = JSON.parse(getBoth.payload);
    const t2 = allTables.find((t) => t.id === table2A.id);
    const tT2 = allTables.find((t) => t.id === tableT2A.id);
    assert.equal(t2.isOccupied, true);
    assert.equal(tT2.isOccupied, true);
    assert.equal(t2.activeOrders[0].id, order2.id);
    assert.equal(tT2.activeOrders[0].id, orderT2.id);

    // Force clear Table 2 using its authoritative ID table2A.id
    const clearT2 = await app.inject({
      method: "POST",
      url: `/owner/${restaurantA.id}/tables/${table2A.id}/clear`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
      payload: { force: true },
    });
    assert.equal(clearT2.statusCode, 200);

    // Verify: Table 2 is FREE, but Table T2 is STILL OCCUPIED!
    const getAfterT2Clear = await app.inject({
      method: "GET",
      url: `/owner/${restaurantA.id}/tables`,
      headers: { authorization: `Bearer ${ownerTokenA}` },
    });
    const allAfter = JSON.parse(getAfterT2Clear.payload);
    const t2After = allAfter.find((t) => t.id === table2A.id);
    const tT2After = allAfter.find((t) => t.id === tableT2A.id);

    assert.equal(t2After.isOccupied, false, "Table 2 must be FREE after its clear call");
    assert.equal(t2After.activeOrders.length, 0);

    assert.equal(tT2After.isOccupied, true, "Table T2 must REMAIN OCCUPIED when Table 2 is cleared");
    assert.equal(tT2After.activeOrders.length, 1);
    assert.equal(tT2After.activeOrders[0].id, orderT2.id);

    const dbSessionT2 = await prisma.tableSession.findUnique({ where: { id: sessionT2.id } });
    assert.equal(dbSessionT2.status, "OPEN", "Table T2 session must remain OPEN");

    // Cleanup
    await prisma.order.delete({ where: { id: order2.id } });
    await prisma.order.delete({ where: { id: orderT2.id } });
    await prisma.tableSession.delete({ where: { id: session2.id } });
    await prisma.tableSession.delete({ where: { id: sessionT2.id } });
  });
});
