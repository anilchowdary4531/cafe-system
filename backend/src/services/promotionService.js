import { fromSubunit, toSubunit } from "./moneyService.js";

export const validateAndCalculateDiscount = async ({
  prisma,
  restaurantId,
  branchId,
  couponCode,
  promotionId,
  items = [],
  orderType = "POS",
  customerId,
  subtotal = 0,
  isStaffOverride = false,
  staffRole,
}) => {
  const rId = Number(restaurantId);
  if (!rId) {
    return { ok: false, status: 400, message: "Restaurant ID is required" };
  }

  let promo = null;
  const normalizedCode = couponCode ? String(couponCode).trim().toUpperCase() : null;

  if (normalizedCode) {
    promo = await prisma.promotion.findUnique({
      where: {
        restaurantId_code: {
          restaurantId: rId,
          code: normalizedCode,
        },
      },
    });

    if (!promo) {
      // Fallback search in case case sensitivity or whitespace differs
      promo = await prisma.promotion.findFirst({
        where: {
          restaurantId: rId,
          code: { equals: normalizedCode, mode: "insensitive" },
        },
      });
    }
  } else if (promotionId) {
    promo = await prisma.promotion.findFirst({
      where: {
        id: Number(promotionId),
        restaurantId: rId,
      },
    });
  }

  if (!promo) {
    return { ok: false, status: 404, message: "Invalid or non-existent coupon code." };
  }

  // 1. Active Check
  if (!promo.active) {
    return { ok: false, status: 400, message: "This coupon is currently inactive." };
  }

  // 2. Branch Restriction
  if (promo.branchId && branchId && Number(promo.branchId) !== Number(branchId)) {
    return { ok: false, status: 400, message: "Coupon is not valid for this branch." };
  }

  // 3. Validity Dates
  const now = new Date();
  if (promo.startAt && now < new Date(promo.startAt)) {
    return { ok: false, status: 400, message: "Coupon is not active yet." };
  }
  if (promo.endAt && now > new Date(promo.endAt)) {
    return { ok: false, status: 400, message: "Coupon has expired." };
  }

  // 4. Order Type Restriction
  if (promo.eligibleOrderTypes) {
    const allowedTypes = promo.eligibleOrderTypes
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const normalizedOrderType = String(orderType || "").trim().toUpperCase();
    if (allowedTypes.length > 0 && !allowedTypes.includes(normalizedOrderType)) {
      return {
        ok: false,
        status: 400,
        message: `Coupon is not valid for ${normalizedOrderType || "this order type"}. Allowed: ${allowedTypes.join(", ")}`,
      };
    }
  }

  // 5. Customer Specificity
  if (promo.eligibleCustomerId && customerId) {
    if (Number(promo.eligibleCustomerId) !== Number(customerId)) {
      return { ok: false, status: 400, message: "This offer is reserved for another customer." };
    }
  }

  // 6. Global Usage Limit
  if (promo.usageLimit && promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
    return { ok: false, status: 400, message: "Coupon total usage limit has been reached." };
  }

  // 7. Per-Customer Usage Limit
  if (promo.usageLimitPerCustomer && promo.usageLimitPerCustomer > 0 && customerId) {
    const customerOrderCount = await prisma.order.count({
      where: {
        restaurantId: rId,
        customerId: Number(customerId),
        promotionId: promo.id,
        status: { not: "CANCELLED" },
      },
    });

    if (customerOrderCount >= promo.usageLimitPerCustomer) {
      return {
        ok: false,
        status: 400,
        message: `You have reached the maximum allowed usage limit (${promo.usageLimitPerCustomer}) for this coupon.`,
      };
    }
  }

  // 8. Minimum Order Amount
  const orderSubtotal = Math.max(0, Number(subtotal || 0));
  if (promo.minimumOrderAmount && promo.minimumOrderAmount > 0 && orderSubtotal < promo.minimumOrderAmount) {
    return {
      ok: false,
      status: 400,
      message: `Minimum order value of ₹${promo.minimumOrderAmount} is required for this offer.`,
    };
  }

  // 9. Minimum Item Quantity
  const totalItemQty = (items || []).reduce((sum, item) => sum + Math.max(1, Number(item.qty || 1)), 0);
  if (promo.minimumQuantity && promo.minimumQuantity > 0 && totalItemQty < promo.minimumQuantity) {
    return {
      ok: false,
      status: 400,
      message: `Minimum ${promo.minimumQuantity} item(s) required to qualify for this coupon.`,
    };
  }

  // 10. Calculate Eligible Subtotal (Item & Category Specific)
  let eligibleSubtotal = orderSubtotal;

  if (promo.type === "ITEM_DISCOUNT" && promo.eligibleItems) {
    const eligibleItemIds = new Set(
      promo.eligibleItems
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => id > 0)
    );

    eligibleSubtotal = (items || []).reduce((sum, item) => {
      const id = Number(item.menuItemId || item.id || 0);
      if (eligibleItemIds.has(id)) {
        const itemTotal = Number(item.total || Number(item.price || 0) * Math.max(1, Number(item.qty || 1)));
        return sum + itemTotal;
      }
      return sum;
    }, 0);

    if (eligibleSubtotal <= 0) {
      return { ok: false, status: 400, message: "None of the items in your cart qualify for this offer." };
    }
  } else if (promo.type === "CATEGORY_DISCOUNT" && promo.eligibleCategories) {
    const eligibleCatIds = new Set(
      promo.eligibleCategories
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => id > 0)
    );

    eligibleSubtotal = (items || []).reduce((sum, item) => {
      const catId = Number(item.categoryId || item.category?.id || 0);
      if (eligibleCatIds.has(catId)) {
        const itemTotal = Number(item.total || Number(item.price || 0) * Math.max(1, Number(item.qty || 1)));
        return sum + itemTotal;
      }
      return sum;
    }, 0);

    if (eligibleSubtotal <= 0) {
      return { ok: false, status: 400, message: "None of the item categories qualify for this offer." };
    }
  }

  // 11. Calculate Discount Amount
  let rawDiscount = 0;
  if (["PERCENTAGE", "ITEM_DISCOUNT", "CATEGORY_DISCOUNT"].includes(promo.type)) {
    rawDiscount = (eligibleSubtotal * Number(promo.value || 0)) / 100;
    if (promo.maximumDiscount && promo.maximumDiscount > 0) {
      rawDiscount = Math.min(rawDiscount, promo.maximumDiscount);
    }
  } else if (promo.type === "AUTOMATIC_OFFER") {
    if (promo.maximumDiscount || promo.value <= 100) {
      rawDiscount = (eligibleSubtotal * Number(promo.value || 0)) / 100;
      if (promo.maximumDiscount && promo.maximumDiscount > 0) {
        rawDiscount = Math.min(rawDiscount, promo.maximumDiscount);
      }
    } else {
      rawDiscount = Number(promo.value || 0);
    }
  } else {
    // FIXED_AMOUNT | COUPON
    rawDiscount = Number(promo.value || 0);
  }

  // Clamp discount to not exceed eligible subtotal
  const discountAmount = Math.max(0, Math.min(eligibleSubtotal, Math.round(rawDiscount * 100) / 100));

  return {
    ok: true,
    promotion: promo,
    discountAmount,
    discountSubunit: Math.round(discountAmount * 100),
    eligibleSubtotal,
    message: `Offer '${promo.name}' applied successfully!`,
  };
};

export const applyAutomaticOffers = async ({
  prisma,
  restaurantId,
  branchId,
  items = [],
  orderType = "POS",
  customerId,
  subtotal = 0,
}) => {
  const rId = Number(restaurantId);
  if (!rId) return null;

  const autoPromos = await prisma.promotion.findMany({
    where: {
      restaurantId: rId,
      type: "AUTOMATIC_OFFER",
      active: true,
    },
    orderBy: { priority: "desc" },
  });

  for (const promo of autoPromos) {
    const res = await validateAndCalculateDiscount({
      prisma,
      restaurantId: rId,
      branchId,
      promotionId: promo.id,
      items,
      orderType,
      customerId,
      subtotal,
    });

    if (res.ok && res.discountAmount > 0) {
      return res;
    }
  }

  return null;
};

export const listPromotions = async ({
  prisma,
  restaurantId,
  page = 1,
  limit = 20,
  active,
  type,
  search = "",
}) => {
  const rId = Number(restaurantId);
  if (!rId) throw new Error("Invalid restaurant ID");

  const p = Math.max(1, Number(page || 1));
  const l = Math.min(100, Math.max(1, Number(limit || 20)));
  const skip = (p - 1) * l;

  const whereClause = {
    restaurantId: rId,
  };

  if (active !== undefined && active !== null && active !== "" && active !== "ALL") {
    whereClause.active = String(active).toLowerCase() === "true" || active === true;
  }

  if (type && type !== "ALL") {
    whereClause.type = String(type).toUpperCase();
  }

  const s = String(search || "").trim();
  if (s) {
    whereClause.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.promotion.count({ where: whereClause }),
    prisma.promotion.findMany({
      where: whereClause,
      skip,
      take: l,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
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

export const getPromotionById = async ({ prisma, restaurantId, promotionId }) => {
  const rId = Number(restaurantId);
  const pId = Number(promotionId);
  if (!rId || !pId) return null;

  return prisma.promotion.findFirst({
    where: { id: pId, restaurantId: rId },
    include: {
      orders: {
        select: {
          id: true,
          orderNo: true,
          total: true,
          discountAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
};

export const createPromotion = async ({ prisma, restaurantId, input, userId, userName }) => {
  const rId = Number(restaurantId);
  if (!rId) return { ok: false, status: 400, message: "Invalid restaurant ID" };

  const name = String(input.name || "").trim();
  if (!name) return { ok: false, status: 400, message: "Promotion name is required" };

  const type = String(input.type || "PERCENTAGE").toUpperCase();
  const rawCode = input.code ? String(input.code).trim().toUpperCase() : null;

  if (rawCode) {
    const existingCode = await prisma.promotion.findUnique({
      where: {
        restaurantId_code: {
          restaurantId: rId,
          code: rawCode,
        },
      },
    });
    if (existingCode) {
      return { ok: false, status: 409, message: `Coupon code '${rawCode}' already exists for this restaurant.` };
    }
  }

  const value = Math.max(0, Number(input.value || 0));
  const maximumDiscount = input.maximumDiscount ? Math.max(0, Number(input.maximumDiscount)) : null;
  const minimumOrderAmount = input.minimumOrderAmount ? Math.max(0, Number(input.minimumOrderAmount)) : 0;
  const minimumQuantity = input.minimumQuantity ? Math.max(0, Number(input.minimumQuantity)) : 0;
  const eligibleItems = input.eligibleItems ? String(input.eligibleItems).trim() : null;
  const eligibleCategories = input.eligibleCategories ? String(input.eligibleCategories).trim() : null;
  const eligibleOrderTypes = input.eligibleOrderTypes ? String(input.eligibleOrderTypes).trim() : null;
  const eligibleCustomerId = input.eligibleCustomerId ? Number(input.eligibleCustomerId) : null;
  const startAt = input.startAt ? new Date(input.startAt) : null;
  const endAt = input.endAt ? new Date(input.endAt) : null;
  const usageLimit = input.usageLimit ? Math.max(1, Number(input.usageLimit)) : null;
  const usageLimitPerCustomer = input.usageLimitPerCustomer ? Math.max(1, Number(input.usageLimitPerCustomer)) : null;
  const active = input.active !== undefined ? Boolean(input.active) : true;
  const stackable = Boolean(input.stackable);
  const priority = Number(input.priority || 0);

  const promotion = await prisma.promotion.create({
    data: {
      restaurantId: rId,
      branchId: input.branchId ? Number(input.branchId) : null,
      name,
      description: input.description ? String(input.description).trim() : null,
      code: rawCode,
      type,
      value,
      maximumDiscount,
      minimumOrderAmount,
      minimumQuantity,
      eligibleItems,
      eligibleCategories,
      eligibleOrderTypes,
      eligibleCustomerId,
      startAt,
      endAt,
      usageLimit,
      usageLimitPerCustomer,
      active,
      stackable,
      priority,
      createdById: userId ? Number(userId) : null,
      createdByName: userName ? String(userName).trim() : null,
    },
  });

  return { ok: true, promotion };
};

export const updatePromotion = async ({ prisma, restaurantId, promotionId, input }) => {
  const rId = Number(restaurantId);
  const pId = Number(promotionId);
  if (!rId || !pId) return { ok: false, status: 400, message: "Invalid parameters" };

  const existing = await prisma.promotion.findFirst({
    where: { id: pId, restaurantId: rId },
  });
  if (!existing) return { ok: false, status: 404, message: "Promotion not found" };

  const patch = input && typeof input === "object" ? input : {};
  const updateData = {};

  if (patch.name !== undefined) updateData.name = String(patch.name).trim();
  if (patch.description !== undefined) updateData.description = patch.description ? String(patch.description).trim() : null;

  if (patch.code !== undefined) {
    const newCode = patch.code ? String(patch.code).trim().toUpperCase() : null;
    if (newCode && newCode !== existing.code) {
      const conflict = await prisma.promotion.findUnique({
        where: { restaurantId_code: { restaurantId: rId, code: newCode } },
      });
      if (conflict) return { ok: false, status: 409, message: `Coupon code '${newCode}' already in use.` };
    }
    updateData.code = newCode;
  }

  if (patch.type !== undefined) updateData.type = String(patch.type).toUpperCase();
  if (patch.value !== undefined) updateData.value = Math.max(0, Number(patch.value || 0));
  if (patch.maximumDiscount !== undefined) updateData.maximumDiscount = patch.maximumDiscount ? Math.max(0, Number(patch.maximumDiscount)) : null;
  if (patch.minimumOrderAmount !== undefined) updateData.minimumOrderAmount = Math.max(0, Number(patch.minimumOrderAmount || 0));
  if (patch.minimumQuantity !== undefined) updateData.minimumQuantity = Math.max(0, Number(patch.minimumQuantity || 0));
  if (patch.eligibleItems !== undefined) updateData.eligibleItems = patch.eligibleItems ? String(patch.eligibleItems).trim() : null;
  if (patch.eligibleCategories !== undefined) updateData.eligibleCategories = patch.eligibleCategories ? String(patch.eligibleCategories).trim() : null;
  if (patch.eligibleOrderTypes !== undefined) updateData.eligibleOrderTypes = patch.eligibleOrderTypes ? String(patch.eligibleOrderTypes).trim() : null;
  if (patch.startAt !== undefined) updateData.startAt = patch.startAt ? new Date(patch.startAt) : null;
  if (patch.endAt !== undefined) updateData.endAt = patch.endAt ? new Date(patch.endAt) : null;
  if (patch.usageLimit !== undefined) updateData.usageLimit = patch.usageLimit ? Math.max(1, Number(patch.usageLimit)) : null;
  if (patch.usageLimitPerCustomer !== undefined) updateData.usageLimitPerCustomer = patch.usageLimitPerCustomer ? Math.max(1, Number(patch.usageLimitPerCustomer)) : null;
  if (patch.active !== undefined) updateData.active = Boolean(patch.active);
  if (patch.priority !== undefined) updateData.priority = Number(patch.priority || 0);

  const updated = await prisma.promotion.update({
    where: { id: pId },
    data: updateData,
  });

  return { ok: true, promotion: updated };
};

export const togglePromotionStatus = async ({ prisma, restaurantId, promotionId, active }) => {
  const rId = Number(restaurantId);
  const pId = Number(promotionId);

  const existing = await prisma.promotion.findFirst({
    where: { id: pId, restaurantId: rId },
  });
  if (!existing) return { ok: false, status: 404, message: "Promotion not found" };

  const updated = await prisma.promotion.update({
    where: { id: pId },
    data: { active: active !== undefined ? Boolean(active) : !existing.active },
  });

  return { ok: true, promotion: updated };
};

export const incrementPromotionUsageTx = async ({ tx, promotionId }) => {
  if (!promotionId) return;
  try {
    await tx.promotion.update({
      where: { id: Number(promotionId) },
      data: { usageCount: { increment: 1 } },
    });
  } catch (err) {
    console.error("[Promotion Usage Increment Error]:", err.message);
  }
};
