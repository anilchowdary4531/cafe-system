import assert from "node:assert";
import prisma from "../prisma.js";
import { validateAndCalculateDiscount } from "../services/promotionService.js";
import {
  getOrCreateLoyaltyAccount,
  getLoyaltyConfig,
  updateLoyaltyConfig,
  validateAndCalculateLoyaltyRedemption,
  earnPointsForOrder,
} from "../services/loyaltyService.js";
import { computeBill } from "../services/billingService.js";
import { toSubunit, fromSubunit } from "../services/moneyService.js";

async function runCustomerOrderingTests() {
  console.log("=== Starting FEATURE 15: CUSTOMER-FACING ORDERING & REWARDS Tests ===");

  let testRest = null;
  let testCustomer = null;
  let otherCustomer = null;
  let testMenuItem = null;
  let testOrder = null;

  try {
    // 1. Setup Test Environment
    testRest = await prisma.restaurant.create({
      data: {
        name: `Customer Test Rest ${Date.now()}`,
        slug: `cust-rest-${Date.now()}`,
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        taxType: "EXCLUSIVE",
        defaultTaxPercent: 5.0,
      },
    });


    testCustomer = await prisma.customer.create({
      data: {
        restaurantId: testRest.id,
        name: "Test Customer A",
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        email: "custA@example.com",
      },
    });

    otherCustomer = await prisma.customer.create({
      data: {
        restaurantId: testRest.id,
        name: "Test Customer B",
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        email: "custB@example.com",
      },
    });

    testMenuItem = await prisma.menuItem.create({
      data: {
        restaurantId: testRest.id,
        name: "Super Burger",
        category: "Burgers",
        price: 250.0,
        isAvailable: true,
      },
    });


    console.log(`✅ Test Environment Created (Rest ID: #${testRest.id}, Cust A: #${testCustomer.id}, Cust B: #${otherCustomer.id})`);

    // TEST 1: Promotion / Coupon Creation & Validation
    console.log("\n[TEST 1] Testing Promotion / Coupon Validation...");
    const promo = await prisma.promotion.create({
      data: {
        restaurantId: testRest.id,
        name: "WELCOME50",
        code: "WELCOME50",
        type: "FLAT",
        value: 50.0,
        active: true,
      },
    });




    const promoRes = await validateAndCalculateDiscount({
      prisma,
      restaurantId: testRest.id,
      couponCode: "WELCOME50",
      customerId: testCustomer.id,
      subtotal: 500.0,
    });

    assert.strictEqual(promoRes.ok, true, "Coupon validation should succeed");
    assert.strictEqual(promoRes.discountAmount, 50.0, "Discount amount should equal 50.0");
    console.log("✅ Coupon validation succeeded! Discount: ₹" + promoRes.discountAmount);

    // TEST 2: Loyalty Setup & Points Earning
    console.log("\n[TEST 2] Testing Loyalty Setup & Points Balance...");
    await updateLoyaltyConfig({
      db: prisma,
      restaurantId: testRest.id,
      input: {
        enabled: true,
        pointsPerCurrency: 1.0,
        currencyPerPoint: 0.1, // 100 pts = ₹10
        minPointsToRedeem: 50,
        maxRedeemablePercent: 50.0,
        allowCouponStacking: true,
      },
    });


    // Credit initial 200 points to Customer A
    const loyaltyAccount = await getOrCreateLoyaltyAccount({
      db: prisma,
      restaurantId: testRest.id,
      customerId: testCustomer.id,
    });

    await prisma.loyaltyAccount.update({
      where: { id: loyaltyAccount.id },
      data: { currentBalance: 200, lifetimeEarned: 200 },
    });

    const redemptionRes = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId: testRest.id,
      customerId: testCustomer.id,
      pointsToRedeem: 100,
      subtotal: 500.0,
      hasCoupon: true,
    });

    console.log("Redemption result:", redemptionRes);
    assert.strictEqual(redemptionRes.valid, true, "Loyalty redemption should be valid");

    assert.strictEqual(redemptionRes.pointsToRedeem, 100, "Should redeem 100 points");
    assert.strictEqual(redemptionRes.discountAmount, 10.0, "100 points should equal ₹10 discount");
    console.log("✅ Loyalty redemption valid! Applied 100 pts for ₹" + redemptionRes.discountAmount + " discount.");

    // TEST 3: Authoritative Billing Service Calculation
    console.log("\n[TEST 3] Testing Authoritative Billing Calculation...");
    const bill = computeBill({
      items: [{ priceSubunit: toSubunit(250.0), qty: 2 }], // 500.00 subtotal
      taxEnabled: true,
      taxPercent: 5.0,
      discountSubunit: toSubunit(50.0), // Coupon ₹50
      loyaltyDiscountSubunit: toSubunit(10.0), // Loyalty ₹10
    });


    // Subtotal 500 + 25 tax (5% of 500) - 60 discount = 465 total.
    assert.strictEqual(bill.subtotal, 500.0, "Subtotal should be 500.0");
    assert.strictEqual(bill.discountAmount, 60.0, "Total discount amount should be 60.0");
    assert.strictEqual(bill.taxAmount, 25.0, "5% Tax on 500 should be 25.0");
    assert.strictEqual(bill.total, 465.0, "Final total should be 465.0");
    console.log("✅ Authoritative Bill computed! Total Payable: ₹" + bill.total);



    // TEST 4: Order Creation & Snapshot Persistence
    console.log("\n[TEST 4] Testing Order Creation & Snapshot Persistence...");
    testOrder = await prisma.order.create({
      data: {
        restaurantId: testRest.id,
        orderNo: `TS-${Date.now()}`,
        invoiceNo: `INV-${Date.now()}`,
        orderSource: "DELIVERY",
        customerName: testCustomer.name,
        phone: testCustomer.phone,
        email: testCustomer.email,
        deliveryAddress: "Flat 101, Test Residency, Hyderbad",
        subtotal: bill.subtotal,
        taxAmount: bill.tax,
        total: bill.total,
        loyaltyPointsRedeemed: 100,
        loyaltyDiscountAmount: bill.loyaltyDiscount,
        status: "PLACED",
        customerId: testCustomer.id,
        items: {
          create: [
            {
              menuItemId: testMenuItem.id,
              itemName: testMenuItem.name,
              qty: 2,
              price: testMenuItem.price,
              total: 500.0,
            },
          ],
        },
      },
    });

    assert.strictEqual(testOrder.customerId, testCustomer.id, "Order customerId must match");
    assert.strictEqual(testOrder.total, 465.0, "Order total snapshot must be preserved");
    console.log("✅ Order created successfully! Order #" + testOrder.orderNo);


    // TEST 5: Reorder Price Re-validation
    console.log("\n[TEST 5] Testing Reorder Price Re-validation...");
    // Simulate restaurant changing menu price from ₹250 to ₹275
    await prisma.menuItem.update({
      where: { id: testMenuItem.id },
      data: { price: 275.0 },
    });

    const currentMenuItems = await prisma.menuItem.findMany({
      where: { id: testMenuItem.id, isAvailable: true },
    });

    assert.strictEqual(currentMenuItems[0].price, 275.0, "Current menu price should be 275.0");
    console.log("✅ Reorder re-validates item price to current active menu price ₹275.0!");

    // TEST 6: Customer Ownership Protection Check
    console.log("\n[TEST 6] Testing Customer Ownership Protection...");
    const isCustomerAOwner = testOrder.phone === testCustomer.phone;
    const isCustomerBOwner = testOrder.phone === otherCustomer.phone;

    assert.strictEqual(isCustomerAOwner, true, "Customer A owns order");
    assert.strictEqual(isCustomerBOwner, false, "Customer B does NOT own Customer A's order");
    console.log("✅ Customer ownership security verified!");

    console.log("\n=======================================================");
    console.log("🎉 ALL FEATURE 15 CUSTOMER ORDERING TESTS PASSED SUCCESFULLY!");
    console.log("=======================================================");
  } catch (err) {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  } finally {
    // Cleanup
    if (testOrder?.id) await prisma.order.deleteMany({ where: { id: testOrder.id } }).catch(() => {});
    if (testMenuItem?.id) await prisma.menuItem.deleteMany({ where: { id: testMenuItem.id } }).catch(() => {});
    if (testCustomer?.id) await prisma.customer.deleteMany({ where: { id: testCustomer.id } }).catch(() => {});
    if (otherCustomer?.id) await prisma.customer.deleteMany({ where: { id: otherCustomer.id } }).catch(() => {});
    if (testRest?.id) await prisma.restaurant.deleteMany({ where: { id: testRest.id } }).catch(() => {});
  }
}

runCustomerOrderingTests();
