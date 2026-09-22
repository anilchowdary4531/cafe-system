import prisma from "../prisma.js";
import {
  createPromotion,
  updatePromotion,
  listPromotions,
  getPromotionById,
  togglePromotionStatus,
  validateAndCalculateDiscount,
  applyAutomaticOffers,
} from "../services/promotionService.js";
import { createOrderByStaff } from "../services/orderService.js";

async function runPromotionSystemTests() {
  console.log("=== Starting FEATURE 13: COUPONS, DISCOUNTS & OFFERS MANAGEMENT Tests ===");

  const timestamp = Date.now();

  // Setup Test Restaurants A & B
  const restA = await prisma.restaurant.create({
    data: {
      name: `Promo Test Rest A ${timestamp}`,
      slug: `promo-test-rest-a-${timestamp}`,
      phone: `93333${String(timestamp).slice(-5)}`,
      invoicePrefix: "PA",
    },
  });

  const restB = await prisma.restaurant.create({
    data: {
      name: `Promo Test Rest B ${timestamp}`,
      slug: `promo-test-rest-b-${timestamp}`,
      phone: `94444${String(timestamp).slice(-5)}`,
      invoicePrefix: "PB",
    },
  });

  const itemA = await prisma.menuItem.create({
    data: {
      name: `Special Paneer ${timestamp}`,
      category: "Main Course",
      price: 250.0,
      restaurantId: restA.id,
      isAvailable: true,
    },
  });

  const customerA = await prisma.customer.create({
    data: {
      restaurantId: restA.id,
      name: "Suresh Patel",
      phone: `98111${String(timestamp).slice(-5)}`,
    },
  });

  console.log(`✅ Test Environment created. Rest A: #${restA.id}, Rest B: #${restB.id}`);

  try {
    // TEST 1: Fixed Amount Discount Promotion
    console.log("\n[TEST 1] Creating Fixed Amount Coupon (FLAT100)...");
    const flat100Res = await createPromotion({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "Flat ₹100 Off",
        code: `FLAT100_${timestamp}`,
        type: "FIXED_AMOUNT",
        value: 100,
        minimumOrderAmount: 300,
        active: true,
      },
    });

    if (!flat100Res.ok) {
      throw new Error(`Failed to create FLAT100 promotion: ${flat100Res.message}`);
    }
    const flat100Code = flat100Res.promotion.code;
    console.log(`✅ FLAT100 Coupon created: ${flat100Code}`);

    // TEST 2: Percentage Discount with Max Cap (PERC20)
    console.log("\n[TEST 2] Creating Percentage Coupon with Max Cap (PERC20)...");
    const perc20Res = await createPromotion({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "20% Off up to ₹50",
        code: `PERC20_${timestamp}`,
        type: "PERCENTAGE",
        value: 20,
        maximumDiscount: 50,
        minimumOrderAmount: 100,
        active: true,
      },
    });

    if (!perc20Res.ok) {
      throw new Error(`Failed to create PERC20 promotion: ${perc20Res.message}`);
    }
    const perc20Code = perc20Res.promotion.code;
    console.log(`✅ PERC20 Coupon created: ${perc20Code}`);

    // TEST 3: Validation & Discount Calculations
    console.log("\n[TEST 3] Validating Discount Calculations...");
    
    // Subtotal 200 fails FLAT100 (min 300)
    const valFailMin = await validateAndCalculateDiscount({
      prisma,
      restaurantId: restA.id,
      couponCode: flat100Code,
      subtotal: 200,
      orderType: "DINE_IN",
    });
    if (valFailMin.ok) {
      throw new Error("Expected validation to fail due to minimumOrderAmount");
    }
    console.log(`✅ Correctly rejected subtotal < minimumOrderAmount: ${valFailMin.message}`);

    // Subtotal 500 passes FLAT100 -> ₹100 discount
    const valPassFlat = await validateAndCalculateDiscount({
      prisma,
      restaurantId: restA.id,
      couponCode: flat100Code,
      subtotal: 500,
      orderType: "DINE_IN",
    });
    if (!valPassFlat.ok || valPassFlat.discountSubunit !== 10000) {
      throw new Error(`Expected ₹100 discount (10000 subunits), got ${valPassFlat.discountSubunit}`);
    }
    console.log(`✅ FLAT100 correctly calculated ₹100 discount on ₹500 subtotal`);

    // Subtotal 400 with PERC20 (20% of 400 = 80, but capped at 50 -> ₹50)
    const valPassPercCap = await validateAndCalculateDiscount({
      prisma,
      restaurantId: restA.id,
      couponCode: perc20Code,
      subtotal: 400,
      orderType: "DINE_IN",
    });
    if (!valPassPercCap.ok || valPassPercCap.discountSubunit !== 5000) {
      throw new Error(`Expected ₹50 max capped discount (5000 subunits), got ${valPassPercCap.discountSubunit}`);
    }
    console.log(`✅ PERC20 correctly capped discount to ₹50 on ₹400 subtotal`);

    // TEST 4: Order Type Restrictions
    console.log("\n[TEST 4] Testing Order Type Restrictions...");
    const dineInOnlyRes = await createPromotion({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "Dine-In Special ₹50 Off",
        code: `DINEONLY_${timestamp}`,
        type: "FIXED_AMOUNT",
        value: 50,
        eligibleOrderTypes: "DINE_IN",
        active: true,
      },
    });

    const dineOnlyCode = dineInOnlyRes.promotion.code;
    const valTakeaway = await validateAndCalculateDiscount({
      prisma,
      restaurantId: restA.id,
      couponCode: dineOnlyCode,
      subtotal: 300,
      orderType: "TAKEAWAY",
    });
    if (valTakeaway.ok) {
      throw new Error("Expected validation to fail for TAKEAWAY order on DINE_IN restriction");
    }
    console.log(`✅ Correctly rejected coupon restricted to DINE_IN when ordering TAKEAWAY`);

    // TEST 5: Per-Customer Usage Limit
    console.log("\n[TEST 5] Testing Per-Customer Usage Limit...");
    const limitOneRes = await createPromotion({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "Once Per User ₹30 Off",
        code: `ONCEPERUSER_${timestamp}`,
        type: "FIXED_AMOUNT",
        value: 30,
        usageLimitPerCustomer: 1,
        active: true,
      },
    });
    const onceCode = limitOneRes.promotion.code;

    // Create a mock order using this promotion for customerA
    await prisma.order.create({
      data: {
        restaurantId: restA.id,
        customerId: customerA.id,
        orderNo: `TEST-ORD-1-${timestamp}`,
        subtotal: 200,
        total: 170,
        promotionId: limitOneRes.promotion.id,
        couponCode: onceCode,
        discountType: "FIXED_AMOUNT",
        discountAmount: 30,
      },
    });

    const valCustomerLimit = await validateAndCalculateDiscount({
      prisma,
      restaurantId: restA.id,
      couponCode: onceCode,
      subtotal: 300,
      orderType: "DINE_IN",
      customerId: customerA.id,
    });
    if (valCustomerLimit.ok) {
      throw new Error("Expected validation to fail because customer reached per-customer limit");
    }
    console.log(`✅ Correctly enforced per-customer usage limit (1 use max)`);

    // TEST 6: Multi-Tenant Isolation
    console.log("\n[TEST 6] Testing Multi-Tenant Isolation...");
    const valCrossTenant = await validateAndCalculateDiscount({
      prisma,
      restaurantId: restB.id,
      couponCode: flat100Code,
      subtotal: 500,
      orderType: "DINE_IN",
    });
    if (valCrossTenant.ok) {
      throw new Error("Expected validation to fail when using Rest A coupon in Rest B");
    }
    console.log(`✅ Correctly rejected Rest A's coupon code in Rest B`);

    // TEST 7: Automatic Offers
    console.log("\n[TEST 7] Testing Automatic Offers Application...");
    await createPromotion({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "Auto 10% Off",
        code: `AUTO10_${timestamp}`,
        type: "AUTOMATIC_OFFER",
        value: 10,
        active: true,
        priority: 10,
      },
    });

    const autoOfferResult = await applyAutomaticOffers({
      prisma,
      restaurantId: restA.id,
      subtotal: 500,
      orderType: "DINE_IN",
    });
    if (!autoOfferResult || autoOfferResult.discountSubunit !== 5000) {
      throw new Error("Expected automatic offer to grant 10% (₹50 = 5000 subunits)");
    }
    console.log(`✅ Automatic offer correctly applied highest valid auto discount (10% on ₹500 = ₹50)`);

    // TEST 8: Order Creation Integration & Promotion Snapshot
    console.log("\n[TEST 8] Creating Order with Coupon & Verifying Snapshot + Usage Increment...");
    const orderItems = [
      {
        menuItemId: itemA.id,
        quantity: 2,
        price: 250.0,
      },
    ];

    const initialPromo = await prisma.promotion.findUnique({ where: { id: flat100Res.promotion.id } });
    const initialUsage = initialPromo.usageCount;

    const createdOrder = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restA.id },
      input: {
        orderType: "DINE_IN",
        items: orderItems,
        couponCode: flat100Code,
        customerId: customerA.id,
      },
    });

    if (!createdOrder || !createdOrder.id) {
      throw new Error("Failed to create order with coupon code");
    }
    console.log(`✅ Order created: #${createdOrder.orderNo || createdOrder.id}`);
    console.log(`   Subtotal: ₹${createdOrder.subtotal}, Discount: ₹${createdOrder.discountAmount}, Total: ₹${createdOrder.total}`);

    if (createdOrder.couponCode !== flat100Code) {
      throw new Error(`Order couponCode mismatch. Expected ${flat100Code}, got ${createdOrder.couponCode}`);
    }
    if (Number(createdOrder.discountAmount) !== 100) {
      throw new Error(`Order discountAmount mismatch. Expected 100, got ${createdOrder.discountAmount}`);
    }
    if (createdOrder.promotionId !== flat100Res.promotion.id) {
      throw new Error(`Order promotionId mismatch.`);
    }

    // Verify transactional usageCount increment
    const updatedPromo = await prisma.promotion.findUnique({ where: { id: flat100Res.promotion.id } });
    if (updatedPromo.usageCount !== initialUsage + 1) {
      throw new Error(`Expected usageCount to increment from ${initialUsage} to ${initialUsage + 1}, got ${updatedPromo.usageCount}`);
    }
    console.log(`✅ Transactional usageCount successfully incremented (${initialUsage} -> ${updatedPromo.usageCount})`);
    console.log(`✅ Order snapshot correctly preserved promotion details`);

    console.log("\n=======================================================");
    console.log("🎉 ALL FEATURE 13 PROMOTION & DISCOUNT TESTS PASSED SUCCESFULLY!");
    console.log("=======================================================\n");

  } finally {
    // Cleanup Test Data
    console.log("🧹 Cleaning up test data...");
    await prisma.orderItem.deleteMany({
      where: { order: { restaurantId: { in: [restA.id, restB.id] } } },
    });
    await prisma.order.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.promotion.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.menuItem.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.customer.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.restaurant.deleteMany({
      where: { id: { in: [restA.id, restB.id] } },
    });
    console.log("✅ Cleanup complete.");
  }
}

runPromotionSystemTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Promotion System Test Failed:", err);
    process.exit(1);
  });
