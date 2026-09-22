import prisma from "../prisma.js";
import {
  getLoyaltyConfig,
  updateLoyaltyConfig,
  getOrCreateLoyaltyAccount,
  validateAndCalculateLoyaltyRedemption,
  earnPointsForOrder,
  redeemPointsForOrder,
  reversePointsForRefund,
  manualAdjustPoints,
  listLoyaltyHistory,
  getLoyaltyStats,
} from "../services/loyaltyService.js";
import { createOrderByStaff, updateOrderStatus } from "../services/orderService.js";

async function runLoyaltySystemTests() {
  console.log("=== Starting FEATURE 14: LOYALTY POINTS & REWARDS MANAGEMENT Tests ===");

  const timestamp = Date.now();

  // Setup Test Restaurants A & B
  const restA = await prisma.restaurant.create({
    data: {
      name: `Loyalty Test Rest A ${timestamp}`,
      slug: `loyalty-test-rest-a-${timestamp}`,
      phone: `95555${String(timestamp).slice(-5)}`,
      invoicePrefix: "LA",
    },
  });

  const restB = await prisma.restaurant.create({
    data: {
      name: `Loyalty Test Rest B ${timestamp}`,
      slug: `loyalty-test-rest-b-${timestamp}`,
      phone: `96666${String(timestamp).slice(-5)}`,
      invoicePrefix: "LB",
    },
  });

  const itemA = await prisma.menuItem.create({
    data: {
      name: `Gourmet Burger ${timestamp}`,
      category: "Main Course",
      price: 500.0,
      restaurantId: restA.id,
      isAvailable: true,
    },
  });

  const customerA = await prisma.customer.create({
    data: {
      restaurantId: restA.id,
      name: "Anil Kumar",
      phone: `98777${String(timestamp).slice(-5)}`,
    },
  });

  const customerB = await prisma.customer.create({
    data: {
      restaurantId: restB.id,
      name: "Rahul Verma",
      phone: `98888${String(timestamp).slice(-5)}`,
    },
  });

  console.log(`✅ Test Environment initialized. Rest A: #${restA.id}, Rest B: #${restB.id}`);

  try {
    // TEST 1: Loyalty Account Initialization & Configuration
    console.log("\n[TEST 1] Testing Loyalty Account & Configuration Initialization...");
    const configA = await getLoyaltyConfig({ db: prisma, restaurantId: restA.id });
    if (!configA || !configA.enabled) {
      throw new Error("Failed to initialize default loyalty config");
    }

    // Update config to 10 points per ₹100 spent (0.1 pts/₹), 10 points = ₹1 value (0.1 ₹/pt), min 50 pts
    await updateLoyaltyConfig({
      db: prisma,
      restaurantId: restA.id,
      input: {
        pointsPerCurrency: 0.1,
        currencyPerPoint: 0.1,
        minPointsToRedeem: 50,
        maxRedeemablePercent: 20,
        allowCouponStacking: false,
      },
    });

    const accountA = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (!accountA || accountA.currentBalance !== 0) {
      throw new Error("Loyalty account initialization failed");
    }
    console.log(`✅ Loyalty Config & Account #${accountA.id} initialized successfully`);

    // TEST 2: Points Earning on Order Completion & Idempotency
    console.log("\n[TEST 2] Testing Earning Points & Idempotency on Order Completion...");
    const orderItems = [{ menuItemId: itemA.id, quantity: 2, price: 500.0 }]; // Subtotal = ₹1000

    const createdOrder = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restA.id },
      input: {
        orderType: "DINE_IN",
        items: orderItems,
        customerId: customerA.id,
      },
    });

    // Mark order DELIVERED (triggers points earning)
    await updateOrderStatus({
      prisma,
      actor: { restaurantId: restA.id, role: "OWNER" },
      orderId: createdOrder.id,
      nextStatus: "DELIVERED",
    });

    const accountAfterEarn = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    // Subtotal = ₹1000 * 0.1 pts/₹ = 100 points
    if (accountAfterEarn.currentBalance !== 100) {
      throw new Error(`Expected 100 points earned on ₹1000 subtotal, got ${accountAfterEarn.currentBalance}`);
    }
    console.log(`✅ Correctly earned 100 points for ₹1000 subtotal order (Balance: ${accountAfterEarn.currentBalance})`);

    // Process earning again to test Idempotency
    await earnPointsForOrder({ db: prisma, restaurantId: restA.id, orderId: createdOrder.id });
    const accountAfterReEarn = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (accountAfterReEarn.currentBalance !== 100) {
      throw new Error(`Idempotency check failed. Expected balance 100, got ${accountAfterReEarn.currentBalance}`);
    }
    console.log(`✅ Idempotency enforced: Repeated earning calls created zero duplicate transactions`);

    // TEST 3: Validation of Loyalty Points Redemption
    console.log("\n[TEST 3] Testing Redemption Validation Rules...");
    
    // Insufficient balance test (Customer has 100, attempts 500)
    const valInsuf = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId: restA.id,
      customerId: customerA.id,
      pointsToRedeem: 500,
      subtotal: 1000,
    });
    if (valInsuf.valid) {
      throw new Error("Expected validation to fail for insufficient points balance");
    }
    console.log(`✅ Correctly rejected redemption exceeding balance: ${valInsuf.message}`);

    // Minimum threshold test (Attempt 20 pts when min is 50)
    const valMin = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId: restA.id,
      customerId: customerA.id,
      pointsToRedeem: 20,
      subtotal: 1000,
    });
    if (valMin.valid) {
      throw new Error("Expected validation to fail below minPointsToRedeem");
    }
    console.log(`✅ Correctly rejected redemption below minPointsToRedeem: ${valMin.message}`);

    // Coupon stacking restriction test
    const valStack = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId: restA.id,
      customerId: customerA.id,
      pointsToRedeem: 50,
      subtotal: 1000,
      hasCoupon: true,
    });
    if (valStack.valid) {
      throw new Error("Expected validation to fail when combining points with coupon when stacking is disabled");
    }
    console.log(`✅ Correctly enforced coupon stacking restriction: ${valStack.message}`);

    // Valid redemption test (100 points = ₹10 discount)
    const valValid = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId: restA.id,
      customerId: customerA.id,
      pointsToRedeem: 100,
      subtotal: 1000,
    });
    if (!valValid.valid || valValid.discountAmount !== 10) {
      throw new Error(`Expected ₹10 discount for 100 points, got ${valValid.discountAmount}`);
    }
    console.log(`✅ Valid redemption correctly calculated ₹10 discount for 100 points`);

    // TEST 4: Order Creation with Loyalty Redemption
    console.log("\n[TEST 4] Creating Order with Loyalty Points Redemption...");
    const orderWithLoyalty = await createOrderByStaff({
      prisma,
      actor: { restaurantId: restA.id },
      input: {
        orderType: "DINE_IN",
        items: orderItems, // Subtotal 1000
        customerId: customerA.id,
        loyaltyPointsToRedeem: 100,
      },
    });

    console.log(`✅ Order with loyalty created: #${orderWithLoyalty.orderNo || orderWithLoyalty.id}`);
    console.log(`   Subtotal: ₹${orderWithLoyalty.subtotal}, Loyalty Discount: ₹${orderWithLoyalty.loyaltyDiscountAmount}, Total: ₹${orderWithLoyalty.total}`);

    if (orderWithLoyalty.loyaltyPointsRedeemed !== 100 || Number(orderWithLoyalty.loyaltyDiscountAmount) !== 10) {
      throw new Error("Order loyalty snapshot mismatch");
    }

    const accountAfterRedeem = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (accountAfterRedeem.currentBalance !== 0) {
      throw new Error(`Expected balance 0 after redeeming 100 pts, got ${accountAfterRedeem.currentBalance}`);
    }
    console.log(`✅ Customer balance correctly updated to ${accountAfterRedeem.currentBalance} after redemption`);

    // TEST 5: Refund / Cancellation Point Reversal
    console.log("\n[TEST 5] Testing Point Reversal & Redemption Restoration on Order Cancellation...");
    // Cancel orderWithLoyalty -> should restore 100 redeemed points to customer
    await updateOrderStatus({
      prisma,
      actor: { restaurantId: restA.id, role: "OWNER" },
      orderId: orderWithLoyalty.id,
      nextStatus: "CANCELLED",
    });

    const accountAfterCancel = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (accountAfterCancel.currentBalance !== 100) {
      throw new Error(`Expected balance restored to 100 after order cancellation, got ${accountAfterCancel.currentBalance}`);
    }
    console.log(`✅ Cancelled order correctly restored 100 redeemed points (Balance: ${accountAfterCancel.currentBalance})`);

    // TEST 6: Manual Points Adjustment
    console.log("\n[TEST 6] Testing Authorized Manual Points Adjustment...");
    await manualAdjustPoints({
      db: prisma,
      restaurantId: restA.id,
      customerId: customerA.id,
      points: 50,
      type: "MANUAL_CREDIT",
      reason: "Customer support goodwill adjustment",
      createdById: 1,
      createdByName: "Owner Admin",
    });

    const accountAfterCredit = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (accountAfterCredit.currentBalance !== 150) {
      throw new Error(`Expected balance 150 after +50 manual credit, got ${accountAfterCredit.currentBalance}`);
    }
    console.log(`✅ Manual credit +50 successful (New Balance: ${accountAfterCredit.currentBalance})`);

    await manualAdjustPoints({
      db: prisma,
      restaurantId: restA.id,
      customerId: customerA.id,
      points: 30,
      type: "MANUAL_DEBIT",
      reason: "Manual correction for duplicate issue",
      createdById: 1,
      createdByName: "Owner Admin",
    });

    const accountAfterDebit = await getOrCreateLoyaltyAccount({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (accountAfterDebit.currentBalance !== 120) {
      throw new Error(`Expected balance 120 after -30 manual debit, got ${accountAfterDebit.currentBalance}`);
    }
    console.log(`✅ Manual debit -30 successful (New Balance: ${accountAfterDebit.currentBalance})`);

    // TEST 7: Multi-Tenant Isolation
    console.log("\n[TEST 7] Testing Multi-Tenant Isolation...");
    const valCrossTenant = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId: restB.id,
      customerId: customerA.id, // Rest A customer in Rest B
      pointsToRedeem: 50,
      subtotal: 500,
    });
    if (valCrossTenant.valid) {
      throw new Error("Expected validation to fail when attempting to redeem Rest A customer points in Rest B");
    }
    console.log(`✅ Multi-tenant isolation verified: Rest A customer points cannot be redeemed in Rest B`);

    // TEST 8: Loyalty History Audit Log & Stats
    console.log("\n[TEST 8] Verifying Loyalty Ledger Audit History & Admin Stats...");
    const historyRes = await listLoyaltyHistory({ db: prisma, restaurantId: restA.id, customerId: customerA.id });
    if (!historyRes.items || historyRes.items.length < 4) {
      throw new Error(`Expected at least 4 ledger transactions, got ${historyRes.items?.length}`);
    }
    console.log(`✅ Loyalty Ledger Audit Log verified (${historyRes.items.length} transactions recorded)`);

    const statsRes = await getLoyaltyStats({ db: prisma, restaurantId: restA.id });
    if (statsRes.totalOutstandingBalance !== 120) {
      throw new Error(`Expected total outstanding balance 120, got ${statsRes.totalOutstandingBalance}`);
    }
    console.log(`✅ Loyalty Dashboard Stats verified (Outstanding Balance: ${statsRes.totalOutstandingBalance} pts)`);

    console.log("\n=======================================================");
    console.log("🎉 ALL FEATURE 14 LOYALTY & REWARDS TESTS PASSED SUCCESFULLY!");
    console.log("=======================================================\n");

  } finally {
    // Cleanup Test Data
    console.log("🧹 Cleaning up test data...");
    await prisma.loyaltyTransaction.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.loyaltyAccount.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.loyaltyConfig.deleteMany({
      where: { restaurantId: { in: [restA.id, restB.id] } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { restaurantId: { in: [restA.id, restB.id] } } },
    });
    await prisma.order.deleteMany({
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

runLoyaltySystemTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Loyalty System Test Failed:", err);
    process.exit(1);
  });
