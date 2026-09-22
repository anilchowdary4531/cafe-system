import defaultPrisma from "../prisma.js";

/**
 * Get or create a tenant-isolated LoyaltyAccount for a customer.
 */
export const getOrCreateLoyaltyAccount = async ({
  db = defaultPrisma,
  restaurantId,
  customerId,
  branchId = null,
}) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  if (!rId || !cId) return null;

  let account = await db.loyaltyAccount.findUnique({
    where: {
      restaurantId_customerId: {
        restaurantId: rId,
        customerId: cId,
      },
    },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, status: true },
      },
    },
  });

  if (!account) {
    account = await db.loyaltyAccount.create({
      data: {
        restaurantId: rId,
        branchId: branchId ? Number(branchId) : null,
        customerId: cId,
        currentBalance: 0,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
        status: "ACTIVE",
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, status: true },
        },
      },
    });
  }

  return account;
};

/**
 * Fetch or initialize default LoyaltyConfig for a restaurant.
 */
export const getLoyaltyConfig = async ({ db = defaultPrisma, restaurantId }) => {
  const rId = Number(restaurantId);
  if (!rId) return null;

  let config = await db.loyaltyConfig.findUnique({
    where: { restaurantId: rId },
  });

  if (!config) {
    config = await db.loyaltyConfig.create({
      data: {
        restaurantId: rId,
        enabled: true,
        pointsPerCurrency: 0.1, // 10 points per ₹100
        currencyPerPoint: 0.1,  // 10 points = ₹1 value
        minOrderSubtotalForEarn: 0,
        minPointsToRedeem: 100,
        maxRedeemablePercent: 20,
        allowCouponStacking: false,
        expiryEnabled: false,
        expiryDays: 365,
      },
    });
  }

  return config;
};

/**
 * Update LoyaltyConfig for a restaurant.
 */
export const updateLoyaltyConfig = async ({ db = defaultPrisma, restaurantId, input = {} }) => {
  const rId = Number(restaurantId);
  if (!rId) throw new Error("Restaurant ID is required");

  const existing = await getLoyaltyConfig({ db, restaurantId: rId });

  const data = {};
  if (input.enabled !== undefined) data.enabled = Boolean(input.enabled);
  if (input.pointsPerCurrency !== undefined) data.pointsPerCurrency = Math.max(0, Number(input.pointsPerCurrency));
  if (input.currencyPerPoint !== undefined) data.currencyPerPoint = Math.max(0, Number(input.currencyPerPoint));
  if (input.minOrderSubtotalForEarn !== undefined) data.minOrderSubtotalForEarn = Math.max(0, Number(input.minOrderSubtotalForEarn));
  if (input.minPointsToRedeem !== undefined) data.minPointsToRedeem = Math.max(0, Number(input.minPointsToRedeem));
  if (input.maxRedeemablePercent !== undefined) data.maxRedeemablePercent = Math.min(100, Math.max(0, Number(input.maxRedeemablePercent)));
  if (input.allowCouponStacking !== undefined) data.allowCouponStacking = Boolean(input.allowCouponStacking);
  if (input.expiryEnabled !== undefined) data.expiryEnabled = Boolean(input.expiryEnabled);
  if (input.expiryDays !== undefined) data.expiryDays = Math.max(1, Number(input.expiryDays));

  return db.loyaltyConfig.update({
    where: { id: existing.id },
    data,
  });
};

/**
 * Validate & calculate loyalty point redemption for an order.
 */
export const validateAndCalculateLoyaltyRedemption = async ({
  db = defaultPrisma,
  restaurantId,
  customerId,
  pointsToRedeem = 0,
  subtotal = 0,
  hasCoupon = false,
}) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  const pts = Math.max(0, Math.floor(Number(pointsToRedeem || 0)));

  if (!rId || !cId || pts <= 0) {
    return { valid: false, discountAmount: 0, pointsToRedeem: 0, message: "No points specified for redemption." };
  }

  const config = await getLoyaltyConfig({ db, restaurantId: rId });
  if (!config || !config.enabled) {
    return { valid: false, discountAmount: 0, pointsToRedeem: 0, message: "Loyalty program is disabled for this restaurant." };
  }

  if (hasCoupon && !config.allowCouponStacking) {
    return { valid: false, discountAmount: 0, pointsToRedeem: 0, message: "Coupon codes cannot be combined with loyalty point redemption." };
  }

  const account = await getOrCreateLoyaltyAccount({ db, restaurantId: rId, customerId: cId });
  if (!account || account.status !== "ACTIVE" || account.customer?.status !== "ACTIVE") {
    return { valid: false, discountAmount: 0, pointsToRedeem: 0, message: "Loyalty account is inactive or suspended." };
  }

  if (account.currentBalance < pts) {
    return {
      valid: false,
      discountAmount: 0,
      pointsToRedeem: 0,
      message: `Insufficient loyalty points. Available: ${account.currentBalance}, Requested: ${pts}`,
    };
  }

  if (pts < config.minPointsToRedeem) {
    return {
      valid: false,
      discountAmount: 0,
      pointsToRedeem: 0,
      message: `Minimum ${config.minPointsToRedeem} points required to redeem rewards.`,
    };
  }

  const rawDiscount = pts * Number(config.currencyPerPoint || 0.1);
  const maxDiscountAllowed = (subtotal * Number(config.maxRedeemablePercent || 20)) / 100;

  let finalDiscount = Math.min(subtotal, Math.min(rawDiscount, maxDiscountAllowed));
  let finalPoints = pts;

  // Cap points to max redeemable monetary limit if requested points exceed max allowed discount
  if (rawDiscount > maxDiscountAllowed && config.currencyPerPoint > 0) {
    finalDiscount = Math.round(maxDiscountAllowed * 100) / 100;
    finalPoints = Math.floor(finalDiscount / config.currencyPerPoint);
  }

  return {
    valid: true,
    discountAmount: Math.max(0, finalDiscount),
    discountSubunit: Math.round(Math.max(0, finalDiscount) * 100),
    pointsToRedeem: finalPoints,
    currentBalance: account.currentBalance,
    message: `Applied ${finalPoints} loyalty points for ₹${finalDiscount.toFixed(2)} discount.`,
  };
};

/**
 * Earn points for a completed order (Idempotent).
 */
export const earnPointsForOrder = async ({
  db = defaultPrisma,
  restaurantId,
  orderId,
  actor = null,
}) => {
  const rId = Number(restaurantId);
  const oId = Number(orderId);
  if (!rId || !oId) return null;

  const config = await getLoyaltyConfig({ db, restaurantId: rId });
  if (!config || !config.enabled) return null;

  const order = await db.order.findFirst({
    where: { id: oId, restaurantId: rId },
  });

  if (!order || !order.customerId) return null;

  // Check idempotency constraint
  const existingEarn = await db.loyaltyTransaction.findFirst({
    where: {
      restaurantId: rId,
      orderId: oId,
      type: "EARN",
    },
  });
  if (existingEarn) return existingEarn;

  const eligibleSubtotal = Math.max(0, Number(order.subtotal || 0) - Number(order.discountAmount || 0));
  if (eligibleSubtotal < Number(config.minOrderSubtotalForEarn || 0)) return null;

  const pointsEarned = Math.floor(eligibleSubtotal * Number(config.pointsPerCurrency || 0.1));
  if (pointsEarned <= 0) return null;

  const account = await getOrCreateLoyaltyAccount({
    db,
    restaurantId: rId,
    customerId: order.customerId,
    branchId: order.branchId,
  });
  if (!account || account.status !== "ACTIVE") return null;

  const balanceBefore = account.currentBalance;
  const balanceAfter = balanceBefore + pointsEarned;

  let expiresAt = null;
  if (config.expiryEnabled && config.expiryDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.expiryDays);
  }

  // Update account balance & create transaction atomically
  const [updatedAccount, txn] = await Promise.all([
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: balanceAfter,
        lifetimeEarned: { increment: pointsEarned },
      },
    }),
    db.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        restaurantId: rId,
        branchId: order.branchId,
        customerId: order.customerId,
        type: "EARN",
        points: pointsEarned,
        balanceBefore,
        balanceAfter,
        orderId: oId,
        referenceId: `EARN_ORD_${oId}`,
        description: `Points earned from Order #${order.orderNo || order.id}`,
        expiresAt,
        createdById: actor?.userId || null,
        createdByName: actor?.userName || null,
      },
    }),
    db.order.update({
      where: { id: oId },
      data: { loyaltyPointsEarned: pointsEarned },
    }),
    db.customer.update({
      where: { id: order.customerId },
      data: { rewardPoints: balanceAfter },
    }),
  ]);

  return txn;
};

/**
 * Deduct loyalty points redeemed for an order (Idempotent).
 */
export const redeemPointsForOrder = async ({
  db = defaultPrisma,
  restaurantId,
  orderId,
  customerId,
  pointsToRedeem = 0,
  actor = null,
}) => {
  const rId = Number(restaurantId);
  const oId = Number(orderId);
  const cId = Number(customerId);
  const pts = Math.max(0, Math.floor(Number(pointsToRedeem || 0)));

  if (!rId || !oId || !cId || pts <= 0) return null;

  // Check idempotency constraint
  const existingRedeem = await db.loyaltyTransaction.findFirst({
    where: {
      restaurantId: rId,
      orderId: oId,
      type: "REDEEM",
    },
  });
  if (existingRedeem) return existingRedeem;

  const account = await getOrCreateLoyaltyAccount({ db, restaurantId: rId, customerId: cId });
  if (!account || account.status !== "ACTIVE" || account.currentBalance < pts) {
    throw new Error(`Insufficient loyalty balance to redeem ${pts} points.`);
  }

  const balanceBefore = account.currentBalance;
  const balanceAfter = balanceBefore - pts;

  const [updatedAccount, txn] = await Promise.all([
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: balanceAfter,
        lifetimeRedeemed: { increment: pts },
      },
    }),
    db.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        restaurantId: rId,
        customerId: cId,
        type: "REDEEM",
        points: -pts,
        balanceBefore,
        balanceAfter,
        orderId: oId,
        referenceId: `REDEEM_ORD_${oId}`,
        description: `Points redeemed for Order #${oId}`,
        createdById: actor?.userId || null,
        createdByName: actor?.userName || null,
      },
    }),
    db.customer.update({
      where: { id: cId },
      data: { rewardPoints: balanceAfter },
    }),
  ]);

  return txn;
};

/**
 * Reverse points earned or redeemed upon order refund / cancellation.
 */
export const reversePointsForRefund = async ({
  db = defaultPrisma,
  restaurantId,
  orderId,
  refundRatio = 1.0,
  actor = null,
}) => {
  const rId = Number(restaurantId);
  const oId = Number(orderId);
  if (!rId || !oId) return null;

  const order = await db.order.findFirst({
    where: { id: oId, restaurantId: rId },
  });
  if (!order || !order.customerId) return null;

  const ratio = Math.max(0, Math.min(1.0, Number(refundRatio || 1.0)));
  const results = [];

  // 1. Reverse Earned Points if any were awarded
  const earnTxn = await db.loyaltyTransaction.findFirst({
    where: { restaurantId: rId, orderId: oId, type: "EARN" },
  });
  if (earnTxn && earnTxn.points > 0) {
    const pointsToReverse = Math.round(earnTxn.points * ratio);
    if (pointsToReverse > 0) {
      const account = await getOrCreateLoyaltyAccount({ db, restaurantId: rId, customerId: order.customerId });
      const balanceBefore = account.currentBalance;
      const balanceAfter = Math.max(0, balanceBefore - pointsToReverse);

      const [updatedAcc, revEarnTxn] = await Promise.all([
        db.loyaltyAccount.update({
          where: { id: account.id },
          data: { currentBalance: balanceAfter },
        }),
        db.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: account.id,
            restaurantId: rId,
            customerId: order.customerId,
            type: "REFUND_REVERSAL",
            points: -pointsToReverse,
            balanceBefore,
            balanceAfter,
            orderId: oId,
            description: `Earned points reversed due to refund on Order #${order.orderNo || order.id}`,
            createdById: actor?.userId || null,
            createdByName: actor?.userName || null,
          },
        }),
        db.customer.update({
          where: { id: order.customerId },
          data: { rewardPoints: balanceAfter },
        }),
      ]);
      results.push(revEarnTxn);
    }
  }

  // 2. Restore Redeemed Points if order was fully refunded or cancelled
  if (ratio >= 0.99) {
    const redeemTxn = await db.loyaltyTransaction.findFirst({
      where: { restaurantId: rId, orderId: oId, type: "REDEEM" },
    });
    if (redeemTxn && redeemTxn.points < 0) {
      const pointsToRestore = Math.abs(redeemTxn.points);
      const account = await getOrCreateLoyaltyAccount({ db, restaurantId: rId, customerId: order.customerId });
      const balanceBefore = account.currentBalance;
      const balanceAfter = balanceBefore + pointsToRestore;

      const [updatedAcc, revRedeemTxn] = await Promise.all([
        db.loyaltyAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: balanceAfter,
            lifetimeRedeemed: { decrement: pointsToRestore },
          },
        }),
        db.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: account.id,
            restaurantId: rId,
            customerId: order.customerId,
            type: "REDEMPTION_REVERSAL",
            points: pointsToRestore,
            balanceBefore,
            balanceAfter,
            orderId: oId,
            description: `Redeemed points restored due to cancellation of Order #${order.orderNo || order.id}`,
            createdById: actor?.userId || null,
            createdByName: actor?.userName || null,
          },
        }),
        db.customer.update({
          where: { id: order.customerId },
          data: { rewardPoints: balanceAfter },
        }),
      ]);
      results.push(revRedeemTxn);
    }
  }

  return results;
};

/**
 * Manual points credit or debit with authorization and mandatory reason.
 */
export const manualAdjustPoints = async ({
  db = defaultPrisma,
  restaurantId,
  customerId,
  points = 0,
  type = "MANUAL_CREDIT", // MANUAL_CREDIT | MANUAL_DEBIT
  reason = "",
  createdById = null,
  createdByName = null,
}) => {
  const rId = Number(restaurantId);
  const cId = Number(customerId);
  const pts = Math.abs(Math.floor(Number(points || 0)));
  const adjReason = String(reason || "").trim();

  if (!rId || !cId || pts <= 0) {
    throw new Error("Invalid restaurant ID, customer ID, or points value.");
  }
  if (!adjReason) {
    throw new Error("A reason is required for manual points adjustment.");
  }

  const adjType = String(type).toUpperCase() === "MANUAL_DEBIT" ? "MANUAL_DEBIT" : "MANUAL_CREDIT";
  const account = await getOrCreateLoyaltyAccount({ db, restaurantId: rId, customerId: cId });
  if (!account || account.status !== "ACTIVE") {
    throw new Error("Loyalty account is inactive or suspended.");
  }

  const balanceBefore = account.currentBalance;
  let balanceAfter = balanceBefore;
  let signedPoints = pts;

  if (adjType === "MANUAL_CREDIT") {
    balanceAfter = balanceBefore + pts;
    signedPoints = pts;
  } else {
    if (balanceBefore < pts) {
      throw new Error(`Cannot debit ${pts} points. Current balance is only ${balanceBefore}.`);
    }
    balanceAfter = balanceBefore - pts;
    signedPoints = -pts;
  }

  const updateData = {
    currentBalance: balanceAfter,
  };
  if (adjType === "MANUAL_CREDIT") {
    updateData.lifetimeEarned = { increment: pts };
  } else {
    updateData.lifetimeRedeemed = { increment: pts };
  }

  const [updatedAccount, txn] = await Promise.all([
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: updateData,
    }),
    db.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        restaurantId: rId,
        customerId: cId,
        type: adjType,
        points: signedPoints,
        balanceBefore,
        balanceAfter,
        description: `Manual Adjustment: ${adjReason}`,
        createdById: createdById ? Number(createdById) : null,
        createdByName: createdByName ? String(createdByName) : null,
      },
    }),
    db.customer.update({
      where: { id: cId },
      data: { rewardPoints: balanceAfter },
    }),
  ]);

  return txn;
};

/**
 * Paginated list of loyalty transactions.
 */
export const listLoyaltyHistory = async ({
  db = defaultPrisma,
  restaurantId,
  customerId = null,
  page = 1,
  limit = 20,
  type = null,
}) => {
  const rId = Number(restaurantId);
  if (!rId) throw new Error("Restaurant ID is required");

  const p = Math.max(1, Number(page || 1));
  const l = Math.min(100, Math.max(1, Number(limit || 20)));
  const skip = (p - 1) * l;

  const where = { restaurantId: rId };
  if (customerId) where.customerId = Number(customerId);
  if (type && type !== "ALL") where.type = String(type).toUpperCase();

  const [total, items] = await Promise.all([
    db.loyaltyTransaction.count({ where }),
    db.loyaltyTransaction.findMany({
      where,
      skip,
      take: l,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        order: {
          select: { id: true, orderNo: true, total: true },
        },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

/**
 * Analytics & KPI stats for admin loyalty dashboard.
 */
export const getLoyaltyStats = async ({ db = defaultPrisma, restaurantId }) => {
  const rId = Number(restaurantId);
  if (!rId) throw new Error("Restaurant ID is required");

  const [
    totalAccounts,
    activeAccounts,
    earnedAggregate,
    redeemedAggregate,
    expiredAggregate,
    manualAggregate,
  ] = await Promise.all([
    db.loyaltyAccount.count({ where: { restaurantId: rId } }),
    db.loyaltyAccount.count({ where: { restaurantId: rId, status: "ACTIVE" } }),
    db.loyaltyTransaction.aggregate({
      where: { restaurantId: rId, type: "EARN" },
      _sum: { points: true },
    }),
    db.loyaltyTransaction.aggregate({
      where: { restaurantId: rId, type: "REDEEM" },
      _sum: { points: true },
    }),
    db.loyaltyTransaction.aggregate({
      where: { restaurantId: rId, type: "EXPIRY" },
      _sum: { points: true },
    }),
    db.loyaltyTransaction.aggregate({
      where: { restaurantId: rId, type: { in: ["MANUAL_CREDIT", "MANUAL_DEBIT"] } },
      _sum: { points: true },
    }),
  ]);

  const totalPointsIssued = Math.abs(earnedAggregate._sum.points || 0);
  const totalPointsRedeemed = Math.abs(redeemedAggregate._sum.points || 0);
  const totalPointsExpired = Math.abs(expiredAggregate._sum.points || 0);

  const activeAccountsData = await db.loyaltyAccount.aggregate({
    where: { restaurantId: rId, status: "ACTIVE" },
    _sum: { currentBalance: true },
  });

  const totalOutstandingBalance = Math.max(0, activeAccountsData._sum.currentBalance || 0);

  return {
    totalAccounts,
    activeAccounts,
    totalPointsIssued,
    totalPointsRedeemed,
    totalPointsExpired,
    totalOutstandingBalance,
  };
};
