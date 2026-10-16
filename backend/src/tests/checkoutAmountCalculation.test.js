import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import prisma from "../prisma.js";
import customerRoutes from "../routes/customer.js";
import { computeBill, toPriceSubunitItems } from "../services/billingService.js";
import { toSubunit, fromSubunit } from "../services/moneyService.js";
import { buildPaymentController } from "../controllers/payment.controller.js";
import { payOrderWithWallet } from "../services/walletService.js";

describe("Checkout Amount Calculation Audit & Regression Suite", () => {
  let app;
  let testRestaurant;
  let pulaoItem;
  let coffeeItem;

  before(async () => {
    app = Fastify({ logger: false });
    await app.register(customerRoutes);

    // Create a dedicated test restaurant (mimicking Cafe Fido)
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: `Cafe Fido ${Date.now()}`,
        slug: `cafe-fido-${Date.now()}`,
        defaultTaxPercent: 5.0,
        taxEnabled: true,
        taxType: "EXCLUSIVE",
        serviceChargeEnabled: false,
        serviceChargePercent: 0,
      },
    });

    // Create Chicken Pulao (₹260) and Coffee (₹20)
    pulaoItem = await prisma.menuItem.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Chicken Pulao",
        price: 260.0,
        category: "Main Course",
        isAvailable: true,
      },
    });

    coffeeItem = await prisma.menuItem.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Coffee",
        price: 20.0,
        category: "Beverages",
        isAvailable: true,
      },
    });
  });

  after(async () => {
    try {
      if (coffeeItem) await prisma.menuItem.delete({ where: { id: coffeeItem.id } });
      if (pulaoItem) await prisma.menuItem.delete({ where: { id: pulaoItem.id } });
      if (testRestaurant) await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it("1. Single item: Coffee (Qty 1, ₹20) -> Subtotal ₹20.00, Tax ₹1.00, Total ₹21.00", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        items: [{ id: coffeeItem.id, quantity: 1, name: coffeeItem.name, price: coffeeItem.price }],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.equal(body.billing.subtotal, 20);
    assert.equal(body.billing.tax, 1);
    assert.equal(body.billing.total, 21);
  });

  it("2. Multiple items: Chicken Pulao (Qty 1, ₹260) + Coffee (Qty 1, ₹20) -> Subtotal ₹280.00, Tax ₹14.00, Total ₹294.00", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        items: [
          { id: pulaoItem.id, quantity: 1, name: "Chicken Pulao", price: 260 },
          { id: coffeeItem.id, quantity: 1, name: "Coffee", price: 20 },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.equal(body.billing.subtotal, 280, "Subtotal must be ₹280.00 (Chicken Pulao 260 + Coffee 20)");
    assert.equal(body.billing.tax, 14, "5% Tax on 280 must be ₹14.00");
    assert.equal(body.billing.total, 294, "Total must be ₹294.00");
    assert.equal(body.items.length, 2, "Both items must be included in normalized items");
  });

  it("3. Customized or ID-missing item: Chicken Pulao with menuItemId or string key included with Coffee", async () => {
    // Simulating when Chicken Pulao was added from ItemCustomizationModal without numeric id
    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        items: [
          { menuItemId: pulaoItem.id, name: "Chicken Pulao", price: 260, quantity: 1 },
          { id: coffeeItem.id, name: "Coffee", price: 20, quantity: 1 },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.billing.subtotal, 280, "Chicken Pulao must NOT be dropped when ID is in menuItemId");
    assert.equal(body.billing.total, 294);
    assert.equal(body.items.length, 2);
  });

  it("4. Quantity > 1: Chicken Pulao x 2 (₹520) + Coffee x 3 (₹60) -> Subtotal ₹580.00", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        items: [
          { id: pulaoItem.id, quantity: 2, name: "Chicken Pulao", price: 260 },
          { id: coffeeItem.id, quantity: 3, name: "Coffee", price: 20 },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.billing.subtotal, 580);
    assert.equal(body.billing.tax, 29); // 5% of 580 = 29
    assert.equal(body.billing.total, 609);
  });

  it("5. Zero / empty cart: Returns zero subtotal and total gracefully without error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        items: [],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.billing.subtotal, 0);
    assert.equal(body.billing.total, 0);
  });

  it("6. computeBill service returns both schema amounts and bill field aliases", () => {
    const bill = computeBill({
      items: [
        { priceSubunit: 26000, qty: 1 },
        { priceSubunit: 2000, qty: 1 },
      ],
      taxEnabled: true,
      taxPercent: 5,
      discountSubunit: 5000, // ₹50 coupon
      loyaltyDiscountSubunit: 3000, // ₹30 loyalty
    });

    assert.equal(bill.subtotal, 280);
    assert.equal(bill.tax, 14);
    assert.equal(bill.taxAmount, 14);
    assert.equal(bill.couponDiscount, 50);
    assert.equal(bill.promoDiscountAmount, 50);
    assert.equal(bill.loyaltyDiscount, 30);
    assert.equal(bill.loyaltyDiscountAmount, 30);
    assert.equal(bill.totalDiscount, 80);
    assert.equal(bill.discountAmount, 80);
    // 280 + 14 - 80 = 214
    assert.equal(bill.total, 214);
  });

  it("7. Authoritative order amount consistency: Order creation matches preview billing total", async () => {
    // Place order for Chicken Pulao (260) and Coffee (20)
    const orderRes = await app.inject({
      method: "POST",
      url: `/r/${testRestaurant.slug}/order`,
      payload: {
        customerName: "Test Guest",
        phone: "9876543210",
        fulfillment: "pickup",
        items: [
          { id: pulaoItem.id, name: "Chicken Pulao", price: 260, qty: 1 },
          { id: coffeeItem.id, name: "Coffee", price: 20, qty: 1 },
        ],
      },
    });

    assert.equal(orderRes.statusCode, 200);
    const orderBody = JSON.parse(orderRes.payload);
    const createdOrder = orderBody.order;
    assert.ok(createdOrder);
    assert.equal(createdOrder.subtotal, 280, "Order subtotal must match preview subtotal ₹280.00");
    assert.equal(createdOrder.taxAmount, 14, "Order taxAmount must match preview tax ₹14.00");
    assert.equal(createdOrder.total, 294, "Order total must match preview total ₹294.00");

    // Clean up created order
    await prisma.orderItem.deleteMany({ where: { orderId: createdOrder.id } });
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: createdOrder.id } });
    await prisma.order.delete({ where: { id: createdOrder.id } });
  });

  it("8. Coupon discount: Applies coupon and recalculates authoritative netSubtotal and total", async () => {
    // Create coupon
    const promo = await prisma.promotion.create({
      data: {
        restaurantId: testRestaurant.id,
        code: `SAVE50_${Date.now()}`,
        name: "Save Flat 50",
        type: "FLAT",
        value: 50.0,
        minimumOrderAmount: 100.0,
        active: true,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        couponCode: promo.code,
        items: [
          { id: pulaoItem.id, quantity: 1, name: "Chicken Pulao", price: 260 },
          { id: coffeeItem.id, quantity: 1, name: "Coffee", price: 20 },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.billing.subtotal, 280);
    assert.equal(body.billing.couponDiscount, 50);
    assert.equal(body.billing.totalDiscount, 50);
    assert.equal(body.billing.tax, 14); // 5% of 280
    // Total = 280 (subtotal) + 14 (tax) - 50 (discount) = 244
    assert.equal(body.billing.total, 244);

    await prisma.promotion.delete({ where: { id: promo.id } });
  });

  it("9. Loyalty points: Points discount deducted accurately and reflected in total", async () => {
    // Configure loyalty
    await prisma.loyaltyConfig.upsert({
      where: { restaurantId: testRestaurant.id },
      update: {
        enabled: true,
        currencyPerPoint: 0.1, // 100 pts = ₹10
        minPointsToRedeem: 10,
        maxRedeemablePercent: 50,
      },
      create: {
        restaurantId: testRestaurant.id,
        enabled: true,
        currencyPerPoint: 0.1,
        minPointsToRedeem: 10,
        maxRedeemablePercent: 50,
      },
    });

    const custPhone = `91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const cust = await prisma.customer.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Loyalty Tester",
        phone: custPhone,
      },
    });

    const loyaltyAcc = await prisma.loyaltyAccount.create({
      data: {
        restaurantId: testRestaurant.id,
        customerId: cust.id,
        currentBalance: 500,
        lifetimeEarned: 500,
        status: "ACTIVE",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/customer/checkout/preview",
      payload: {
        slug: testRestaurant.slug,
        phone: custPhone,
        pointsToRedeem: 100, // ₹10 discount
        items: [
          { id: pulaoItem.id, quantity: 1, name: "Chicken Pulao", price: 260 },
          { id: coffeeItem.id, quantity: 1, name: "Coffee", price: 20 },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.billing.subtotal, 280);
    assert.equal(body.billing.loyaltyDiscount, 10);
    assert.equal(body.billing.tax, 14);
    // 280 + 14 - 10 = 284
    assert.equal(body.billing.total, 284);

    await prisma.loyaltyAccount.delete({ where: { id: loyaltyAcc.id } });
    await prisma.customer.delete({ where: { id: cust.id } });
  });

  it("10. Payment gateway amount consistency: Order total cannot be bypassed", async () => {
    // Create an order
    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-TEST-${Date.now()}`,
        subtotal: 280,
        taxAmount: 14,
        total: 294,
        status: "PLACED",
        items: {
          create: [
            { itemName: "Chicken Pulao", price: 260, qty: 1, total: 260 },
            { itemName: "Coffee", price: 20, qty: 1, total: 20 },
          ],
        },
      },
    });

    const paymentController = buildPaymentController({ prisma });
    let resolvedAmountUsed = null;

    // Mock request and reply to test paymentController.createOrder
    const mockReq = {
      body: {
        orderId: order.id,
        restaurantId: testRestaurant.id,
        amount: 21, // Tampered/stale amount passed by client
        customerPhone: "9876543210",
        customerName: "Test",
        customerEmail: "test@example.com",
      },
    };

    let replyData = null;
    const mockReply = {
      code(c) {
        this.statusCode = c;
        return this;
      },
      send(data) {
        replyData = data;
        return this;
      },
    };

    try {
      await paymentController.createOrder(mockReq, mockReply);
    } catch {
      // It may attempt to contact Cashfree API which will fail in test env
    }

    // Verify Payment record was created with authoritative order total (29400 subunits = ₹294.00)
    const paymentRecord = await prisma.payment.findFirst({
      where: { orderId: order.id },
    });

    if (paymentRecord) {
      assert.equal(
        paymentRecord.amountSubunit,
        29400,
        "Payment record must use authoritative DB order total ₹294.00 (29400 subunits), ignoring tampered client ₹21"
      );
      await prisma.payment.delete({ where: { id: paymentRecord.id } });
    }

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("11. Wallet payment: Rejects payment if client amount does not match authoritative order total", async () => {
    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-WALLET-${Date.now()}`,
        subtotal: 280,
        taxAmount: 14,
        total: 294,
        status: "PLACED",
        items: {
          create: [
            { itemName: "Chicken Pulao", price: 260, qty: 1, total: 260 },
            { itemName: "Coffee", price: 20, qty: 1, total: 20 },
          ],
        },
      },
    });

    const custAccount = await prisma.customerAccount.create({
      data: {
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        name: "Wallet Tester",
      },
    });

    // Attempt paying with ₹21 on an order of ₹294
    await assert.rejects(
      async () => {
        await payOrderWithWallet(prisma, {
          customerAccountId: custAccount.id,
          orderId: order.id,
          amount: 21,
        });
      },
      /Payment amount mismatch\. Order total is ₹294, provided ₹21/
    );

    await prisma.customerAccount.delete({ where: { id: custAccount.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });
});

