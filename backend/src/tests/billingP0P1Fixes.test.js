import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import prisma from "../prisma.js";
import { calculateBill } from "../services/billingService.js";
import { toSubunit, fromSubunit } from "../services/moneyService.js";
import { verifyPayment } from "../services/paymentService.js";
import legacyPosRoutes from "../routes/posOrders.js";

describe("Tiffzy Targeted Billing & Payment P0/P1 Fixes Regression Suite", () => {
  let app;
  let testRestaurant;
  let menuItemPizza;
  let testCustomer;
  let payLaterAccount;

  before(async () => {
    app = Fastify({ logger: false });
    await app.register(legacyPosRoutes);

    // Create test restaurant with billing config
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: `P0P1 Test Cafe ${Date.now()}`,
        slug: `p0p1-test-cafe-${Date.now()}`,
        defaultTaxPercent: 5.0,
        taxEnabled: true,
        taxType: "EXCLUSIVE",
        serviceChargeEnabled: false,
        serviceChargePercent: 0,
        billingConfig: {
          taxes: [
            { name: "Inclusive GST", rate: 5, type: "PERCENTAGE", isInclusive: true, isEnabled: true, appliesTo: ["ALL"] },
            { name: "Exclusive Cess", amount: 5, type: "FIXED", isInclusive: false, isEnabled: true, appliesTo: ["ALL"] },
          ],
          charges: [
            { name: "Packaging", amount: 10, type: "FIXED", isEnabled: true, appliesTo: ["ALL"] },
          ],
          payLaterCreditLimit: 5000,
        },
      },
    });

    menuItemPizza = await prisma.menuItem.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Margherita Pizza",
        price: 200.0,
        category: "Pizza",
        isAvailable: true,
      },
    });

    const phone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    testCustomer = await prisma.customer.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Test Customer P0P1",
        phone,
      },
    });

    payLaterAccount = await prisma.payLaterAccount.create({
      data: {
        restaurantId: testRestaurant.id,
        customerId: testCustomer.id,
        totalBorrowed: 4000,
        totalPaid: 0,
        pendingBalance: 4000,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    try {
      if (payLaterAccount) {
        await prisma.payLaterTransaction.deleteMany({ where: { accountId: payLaterAccount.id } });
        await prisma.payLaterAccount.delete({ where: { id: payLaterAccount.id } });
      }
      if (testCustomer) {
        await prisma.customer.delete({ where: { id: testCustomer.id } });
      }
      if (menuItemPizza) {
        await prisma.orderItem.deleteMany({ where: { menuItemId: menuItemPizza.id } });
        await prisma.menuItem.delete({ where: { id: menuItemPizza.id } });
      }
      if (testRestaurant) {
        await prisma.order.deleteMany({ where: { restaurantId: testRestaurant.id } });
        await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
      }
    } catch {
      // Cleanup best effort
    }
  });

  // TEST 1: Inclusive + Exclusive Tax
  it("Test 1 — Inclusive + Exclusive Tax reporting and non-double-counting", () => {
    const billingConfig = {
      taxes: [
        { name: "VAT Inclusive", rate: 5, type: "PERCENTAGE", isInclusive: true, isEnabled: true, appliesTo: ["ALL"] },
        { name: "City Cess Exclusive", amount: 5, type: "FIXED", isInclusive: false, isEnabled: true, appliesTo: ["ALL"] },
      ],
      charges: [],
      allowTips: false,
      roundOff: false,
    };

    // ₹105 inclusive item
    const items = [{ priceSubunit: toSubunit(105), quantity: 1 }];
    const bill = calculateBill({ items, billingConfig });

    // Inclusive tax component: 105 - (105 / 1.05) = 5
    // Exclusive tax component: 5 fixed
    // Reported totalTax must be 5 + 5 = 10
    assert.equal(bill.taxes.length, 2);
    assert.equal(bill.taxes[0].name, "VAT Inclusive");
    assert.equal(bill.taxes[0].amount, 5);
    assert.equal(bill.taxes[1].name, "City Cess Exclusive");
    assert.equal(bill.taxes[1].amount, 5);

    // Total tax reported must be inclusive + exclusive
    assert.equal(bill.tax, 10, "Total tax in bill must be ₹10 (inclusive 5 + exclusive 5)");
    assert.equal(bill.taxAmount, 10, "taxAmount must be ₹10");
    assert.equal(bill.snapshot.totalTax, 10, "Snapshot totalTax must be ₹10");

    // Grand total: Subtotal (105) + Exclusive Tax (5) = 110
    // CRITICAL: Inclusive tax (5) must NOT be added to grandTotal again!
    assert.equal(bill.grandTotal, 110, "grandTotal must be 110 (105 subtotal + 5 exclusive tax)");
    assert.equal(bill.total, 110);
    assert.equal(bill.snapshot.total, 110);
  });

  // TEST 2: Pay Later Below Limit
  it("Test 2 — Pay Later Below Limit: Approves payment and increments balance", async () => {
    // Current pendingBalance = 4000, limit = 5000, order = 500 -> new = 4500 (below limit)
    await prisma.payLaterAccount.update({
      where: { id: payLaterAccount.id },
      data: { pendingBalance: 4000, totalBorrowed: 4000 },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-PL-1-${Date.now()}`,
        phone: testCustomer.phone,
        subtotal: 500,
        taxAmount: 0,
        total: 500,
        paymentStatus: "PENDING",
        status: "PLACED",
      },
    });

    const actor = { role: "WAITER", userId: 1, restaurantId: testRestaurant.id };
    const result = await verifyPayment({
      prisma,
      actor,
      input: {
        orderId: order.id,
        status: "SUCCESS",
        paymentMode: "PAY_LATER",
      },
    });

    assert.equal(result.verified, true);
    assert.equal(result.order.paymentStatus, "SUCCESS");
    assert.equal(result.order.paymentMode, "PAY_LATER");

    const updatedAccount = await prisma.payLaterAccount.findUnique({
      where: { id: payLaterAccount.id },
    });
    assert.equal(updatedAccount.pendingBalance, 4500, "Pending balance must be incremented to ₹4500");
    assert.equal(updatedAccount.totalBorrowed, 4500);

    const tx = await prisma.payLaterTransaction.findFirst({
      where: { orderId: order.id },
    });
    assert.ok(tx, "Pay later transaction record must be created");
    assert.equal(tx.amount, 500);
    assert.equal(tx.status, "SUCCESS");

    // Cleanup order
    await prisma.payLaterTransaction.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  // TEST 3: Pay Later Exactly At Limit
  it("Test 3 — Pay Later Exactly At Limit: Approves payment (inclusive boundary)", async () => {
    // Current pendingBalance = 4500, limit = 5000, order = 500 -> new = 5000 (exactly at limit)
    await prisma.payLaterAccount.update({
      where: { id: payLaterAccount.id },
      data: { pendingBalance: 4500, totalBorrowed: 4500 },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-PL-2-${Date.now()}`,
        phone: testCustomer.phone,
        subtotal: 500,
        taxAmount: 0,
        total: 500,
        paymentStatus: "PENDING",
        status: "PLACED",
      },
    });

    const actor = { role: "WAITER", userId: 1, restaurantId: testRestaurant.id };
    const result = await verifyPayment({
      prisma,
      actor,
      input: {
        orderId: order.id,
        status: "SUCCESS",
        paymentMode: "PAY_LATER",
      },
    });

    assert.equal(result.verified, true);
    assert.equal(result.order.paymentStatus, "SUCCESS");

    const updatedAccount = await prisma.payLaterAccount.findUnique({
      where: { id: payLaterAccount.id },
    });
    assert.equal(updatedAccount.pendingBalance, 5000, "Pending balance must be exactly ₹5000");

    // Cleanup order
    await prisma.payLaterTransaction.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  // TEST 4: Pay Later Above Limit
  it("Test 4 — Pay Later Above Limit: Rejects payment, protects table, creates no transaction", async () => {
    // Current pendingBalance = 4500, limit = 5000, order = 501 -> new = 5001 (above limit)
    await prisma.payLaterAccount.update({
      where: { id: payLaterAccount.id },
      data: { pendingBalance: 4500, totalBorrowed: 4500 },
    });

    // Create table session and order to verify table protection
    const diningTable = await prisma.diningTable.create({
      data: {
        restaurantId: testRestaurant.id,
        tableNo: `T-PL-${Date.now()}`,
        seats: 4,
      },
    });

    const session = await prisma.tableSession.create({
      data: {
        restaurantId: testRestaurant.id,
        tableId: diningTable.id,
        tableNo: diningTable.tableNo,
        status: "OPEN",
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-PL-3-${Date.now()}`,
        phone: testCustomer.phone,
        subtotal: 501,
        taxAmount: 0,
        total: 501,
        paymentStatus: "PENDING",
        status: "PLACED",
        tableNo: diningTable.tableNo,
        tableSessionId: session.id,
      },
    });

    const actor = { role: "WAITER", userId: 1, restaurantId: testRestaurant.id };

    await assert.rejects(
      async () => {
        await verifyPayment({
          prisma,
          actor,
          input: {
            orderId: order.id,
            status: "SUCCESS",
            paymentMode: "PAY_LATER",
          },
        });
      },
      (err) => {
        assert.equal(err.code, "pay_later_limit_exceeded");
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Verify account balance NOT changed
    const unchangedAccount = await prisma.payLaterAccount.findUnique({
      where: { id: payLaterAccount.id },
    });
    assert.equal(unchangedAccount.pendingBalance, 4500, "Pending balance must remain ₹4500");

    // Verify no transaction was created
    const tx = await prisma.payLaterTransaction.findFirst({
      where: { orderId: order.id },
    });
    assert.equal(tx, null, "No pay later transaction should be recorded");

    // Verify order remains PENDING
    const unchangedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    assert.equal(unchangedOrder.paymentStatus, "PENDING", "Order must not be marked SUCCESS");

    // Verify session remains OPEN and not closed
    const sessionCheck = await prisma.tableSession.findUnique({
      where: { id: session.id },
    });
    assert.equal(sessionCheck.status, "OPEN", "TableSession must remain OPEN");
    assert.equal(sessionCheck.closedAt, null, "TableSession must not be closed");

    // Cleanup
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.tableSession.delete({ where: { id: session.id } });
    await prisma.diningTable.delete({ where: { id: diningTable.id } });
  });

  // TEST 5: Client Amount Tampering
  it("Test 5 — Client Amount Tampering: Uses authoritative DB order.total, client amount ignored", async () => {
    // Current pendingBalance = 4000, limit = 5000, actual order.total = 500
    // Client attempts to pass amount: 1 in body to bypass balance checks
    await prisma.payLaterAccount.update({
      where: { id: payLaterAccount.id },
      data: { pendingBalance: 4000, totalBorrowed: 4000 },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-PL-4-${Date.now()}`,
        phone: testCustomer.phone,
        subtotal: 500,
        taxAmount: 0,
        total: 500,
        paymentStatus: "PENDING",
        status: "PLACED",
      },
    });

    const actor = { role: "WAITER", userId: 1, restaurantId: testRestaurant.id };
    const result = await verifyPayment({
      prisma,
      actor,
      input: {
        orderId: order.id,
        status: "SUCCESS",
        paymentMode: "PAY_LATER",
        amount: 1, // Malicious tampered amount
      },
    });

    assert.equal(result.verified, true);

    // Balance must increase by order.total (500), NOT by client amount (1)
    const updatedAccount = await prisma.payLaterAccount.findUnique({
      where: { id: payLaterAccount.id },
    });
    assert.equal(updatedAccount.pendingBalance, 4500, "Server must charge authoritative order.total ₹500, not ₹1");

    await prisma.payLaterTransaction.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  // TEST 6: Legacy POS Route Security
  it("Test 6 — Legacy POS Security: Discards client-supplied price, rejects tenant mismatch, uses calculateBill", async () => {
    // 6A. Tenant Isolation: Staff belonging to Restaurant 999 attempts to order at testRestaurant
    const crossTenantResponse = await app.inject({
      method: "POST",
      url: "/owner/pos-order",
      headers: { "content-type": "application/json" },
      body: {
        restaurantId: testRestaurant.id,
        items: [{ id: menuItemPizza.id, price: 1, qty: 1 }],
      },
      // Simulate authenticated actor from restaurant 99999
    });

    // When staffActor is present with different restaurantId
    const secureApp = Fastify({ logger: false });
    secureApp.addHook("preHandler", (req, reply, done) => {
      req.staffActor = { role: "WAITER", restaurantId: 99999, userId: 10 };
      done();
    });
    await secureApp.register(legacyPosRoutes);

    const tenantMismatchRes = await secureApp.inject({
      method: "POST",
      url: "/owner/pos-order",
      headers: { "content-type": "application/json" },
      body: {
        restaurantId: testRestaurant.id,
        items: [{ id: menuItemPizza.id, price: 1, qty: 1 }],
      },
    });

    assert.equal(tenantMismatchRes.statusCode, 403);
    assert.deepEqual(JSON.parse(tenantMismatchRes.payload), { message: "restaurant_access_denied" });

    // 6B. Authorized staff attempts to pass fake price (₹1 instead of DB price ₹200)
    const validStaffApp = Fastify({ logger: false });
    validStaffApp.addHook("preHandler", (req, reply, done) => {
      req.staffActor = { role: "ADMIN", restaurantId: testRestaurant.id, userId: 1 };
      done();
    });
    await validStaffApp.register(legacyPosRoutes);

    const spoofPriceRes = await validStaffApp.inject({
      method: "POST",
      url: "/owner/pos-order",
      headers: { "content-type": "application/json" },
      body: {
        restaurantId: testRestaurant.id,
        items: [
          {
            id: menuItemPizza.id,
            price: 1, // Malicious client price! Authoritative is ₹200
            qty: 2,
          },
        ],
      },
    });

    assert.equal(spoofPriceRes.statusCode, 200);
    const createdOrder = JSON.parse(spoofPriceRes.payload);

    // Subtotal must be 2 * 200 = 400 (NOT 2 * 1 = 2!)
    assert.equal(createdOrder.subtotal, 400, "Subtotal must be ₹400 based on DB menu item price");
    // Authoritative calculateBill was used with snapshot
    assert.ok(createdOrder.billingSnapshot, "Billing snapshot must be generated");
    assert.equal(createdOrder.billingSnapshot.subtotal, 400);

    // Clean up created order
    await prisma.orderItem.deleteMany({ where: { orderId: createdOrder.id } });
    await prisma.order.delete({ where: { id: createdOrder.id } });
  });
});
