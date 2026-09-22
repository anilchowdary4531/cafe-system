import { computeBill, toPriceSubunitItems } from "./billingService.js";
import { reserveStockForOrder, restoreStockForOrder, deductStockForOrder, reverseStockForOrder } from "./inventoryService.js";
import { normalizePhone } from "./phoneService.js";
import { createAndDispatchNotification } from "./notificationService.js";
import { createKotsForOrder, dispatchKotPrint } from "./kotService.js";
import { validateAndCalculateDiscount, applyAutomaticOffers, incrementPromotionUsageTx } from "./promotionService.js";
import { validateAndCalculateLoyaltyRedemption, redeemPointsForOrder, earnPointsForOrder, reversePointsForRefund } from "./loyaltyService.js";

const SAFE_STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"];

export const normalizeOrderStatus = (value) => {
  const status = String(value || "").trim().toUpperCase();
  const mapped = status === "SERVED" ? "DELIVERED" : status;
  if (SAFE_STATUSES.includes(mapped)) return mapped;
  return "PLACED";
};

const createdByRoleFromStaffRole = (role) => {
  const r = String(role || "").toUpperCase();
  if (r === "WAITER") return "WAITER";
  if (r === "OWNER" || r === "MANAGER") return "ADMIN";
  return "STAFF";
};

const canSetStatus = (role, status) => {
  const r = String(role || "").toUpperCase();
  const s = normalizeOrderStatus(status);
  if (r === "SUPER_ADMIN") return true;
  if (r === "OWNER" || r === "MANAGER") return true;
  if (s === "PREPARING" || s === "READY") return r === "CHEF";
  if (s === "DELIVERED") return r === "WAITER" || r === "CASHIER";
  if (s === "CANCELLED") return r === "CASHIER";
  // Allow "ACCEPTED" by waiter/cashier/chef for simple ops
  if (s === "ACCEPTED") return r === "WAITER" || r === "CASHIER" || r === "CHEF";
  return false;
};

const pad = (value, size = 2) => String(value).padStart(size, "0");

const compactToken = (value, fallback = "NA", maxLen = 12) => {
  const token = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, maxLen);
  return token || fallback;
};

const formatOrderDateTimeToken = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "000000000000";
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`;
};

export const buildReadableOrderNo = ({
  restaurantName,
  restaurantSlug,
  restaurantCode,
  tableNo,
  date = new Date(),
  sequence,
  prefix = "",
} = {}) => {
  const shortRestaurantToken = compactToken(restaurantCode, "", 6);
  const restaurantToken =
    shortRestaurantToken || compactToken(restaurantSlug || restaurantName, "REST", 14);
  const tableToken = compactToken(tableNo, "NA", 10);
  const dateToken = formatOrderDateTimeToken(date);
  const prefixToken = compactToken(prefix, "", 8);
  const seqToken =
    sequence === undefined || sequence === null || Number.isNaN(Number(sequence))
      ? ""
      : `-${String(Math.max(0, Number(sequence))).padStart(4, "0")}`;
  const coreToken = `${restaurantToken}-${dateToken}-${tableToken}${seqToken}`;
  return prefixToken ? `${prefixToken}-${coreToken}` : coreToken;
};

export const createOrderByStaff = async ({ prisma, actor, input } = {}) => {
  const restaurantId = Number(actor?.restaurantId || 0);
  if (!restaurantId) {
    const err = new Error("restaurant_required");
    err.code = "restaurant_required";
    throw err;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      invoicePrefix: true,
      nextInvoiceNumber: true,
      taxEnabled: true,
      taxType: true,
      defaultTaxPercent: true,
      serviceChargeEnabled: true,
      serviceChargePercent: true,
    },
  });
  if (!restaurant) {
    const err = new Error("restaurant_not_found");
    err.code = "restaurant_not_found";
    throw err;
  }

  const body = input || {};
  const tableNo = body.tableNo ? String(body.tableNo).trim() : body.tableNumber ? String(body.tableNumber).trim() : null;
  const notes = body.notes ? String(body.notes).trim() : null;
  const customerName = body.customerName ? String(body.customerName).trim() : null;
  const phone = body.phone ? normalizePhone(body.phone) : null;
  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const customerType = body.customerType ? String(body.customerType).trim().toUpperCase() : phone ? "REGISTERED" : "WALK_IN";

  let customerId = body.customerId ? Number(body.customerId) : null;
  if (!customerId && phone) {
    try {
      const custRecord = await prisma.customer.upsert({
        where: {
          restaurantId_phone: {
            restaurantId,
            phone,
          },
        },
        update: {
          name: customerName || undefined,
          email: email || undefined,
        },
        create: {
          restaurantId,
          name: customerName || null,
          phone,
          email: email || null,
        },
      });
      customerId = custRecord.id;
    } catch (_) {}
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    const err = new Error("items_required");
    err.code = "items_required";
    throw err;
  }

  const ids = [...new Set(items.map((i) => Number(i?.menuItemId || i?.id || 0)).filter((id) => id > 0))];
  const itemNames = items.map((i) => String(i?.itemName || i?.name || "").trim().toLowerCase()).filter(Boolean);

  let menuItems = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      isAvailable: true,
      OR: [
        ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
        ...(itemNames.length > 0 ? [{ name: { in: itemNames } }] : []),
      ],
    },
    include: {
      variants: true,
      modifierGroups: {
        include: { modifiers: true },
      },
    },
  });

  if (!menuItems.length) {
    menuItems = await prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      include: {
        variants: true,
        modifierGroups: {
          include: { modifiers: true },
        },
      },
    });
  }

  const normalizedItems = toPriceSubunitItems({ menuItems, items });
  const subtotalSubunit = normalizedItems.reduce((sum, item) => sum + item.priceSubunit * item.qty, 0);
  const subtotalFloat = subtotalSubunit / 100;

  let appliedPromotionId = body.promotionId ? Number(body.promotionId) : null;
  let appliedCouponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : null;
  let appliedDiscountType = body.discountType ? String(body.discountType).trim().toUpperCase() : null;
  let appliedDiscountReason = body.discountReason ? String(body.discountReason).trim() : null;
  let calculatedDiscountSubunit = 0;

  if (appliedCouponCode || appliedPromotionId) {
    const promoRes = await validateAndCalculateDiscount({
      prisma,
      restaurantId,
      branchId: actor?.branchId ? Number(actor.branchId) : null,
      couponCode: appliedCouponCode,
      promotionId: appliedPromotionId,
      items: normalizedItems,
      orderType: String(body.orderType || body.fulfillment || "POS").toUpperCase(),
      customerId,
      subtotal: subtotalFloat,
    });

    if (promoRes.ok) {
      calculatedDiscountSubunit = promoRes.discountSubunit;
      appliedPromotionId = promoRes.promotion?.id || appliedPromotionId;
      appliedCouponCode = promoRes.promotion?.code || appliedCouponCode;
      appliedDiscountType = promoRes.promotion?.type || appliedDiscountType;
      appliedDiscountReason = promoRes.promotion?.name || appliedDiscountReason;
    }
  } else if (subtotalFloat > 0) {
    // Try applying automatic offer if no coupon explicitly entered
    const autoRes = await applyAutomaticOffers({
      prisma,
      restaurantId,
      branchId: actor?.branchId ? Number(actor.branchId) : null,
      items: normalizedItems,
      orderType: String(body.orderType || body.fulfillment || "POS").toUpperCase(),
      customerId,
      subtotal: subtotalFloat,
    });
    if (autoRes && autoRes.ok) {
      calculatedDiscountSubunit = autoRes.discountSubunit;
      appliedPromotionId = autoRes.promotion?.id;
      appliedCouponCode = autoRes.promotion?.code;
      appliedDiscountType = autoRes.promotion?.type;
      appliedDiscountReason = autoRes.promotion?.name;
    }
  }

  // Fallback to manual discount if supplied and no promotion applied
  if (calculatedDiscountSubunit === 0) {
    calculatedDiscountSubunit =
      body.discountSubunit !== undefined
        ? Number(body.discountSubunit || 0)
        : body.discountAmount !== undefined
          ? Math.round(Number(body.discountAmount || 0) * 100)
          : 0;
    if (calculatedDiscountSubunit > 0 && !appliedDiscountType) {
      appliedDiscountType = "MANUAL";
      appliedDiscountReason = appliedDiscountReason || "Manual Discount";
    }
  }

  // Loyalty Points Redemption Validation
  let loyaltyPointsToRedeem = Math.max(0, Math.floor(Number(body.loyaltyPointsToRedeem || body.loyaltyPointsRedeemed || 0)));
  let loyaltyDiscountSubunit = 0;
  let loyaltyDiscountAmount = 0;

  if (loyaltyPointsToRedeem > 0 && customerId) {
    const loyaltyVal = await validateAndCalculateLoyaltyRedemption({
      db: prisma,
      restaurantId,
      customerId,
      pointsToRedeem: loyaltyPointsToRedeem,
      subtotal: subtotalFloat,
      hasCoupon: Boolean(appliedCouponCode || appliedPromotionId),
    });

    if (loyaltyVal.valid) {
      loyaltyDiscountSubunit = loyaltyVal.discountSubunit;
      loyaltyDiscountAmount = loyaltyVal.discountAmount;
      loyaltyPointsToRedeem = loyaltyVal.pointsToRedeem;
    } else {
      loyaltyPointsToRedeem = 0;
    }
  }

  const bill = computeBill({
    items: normalizedItems,
    taxEnabled: Boolean(restaurant.taxEnabled),
    taxType: restaurant.taxType,
    taxPercent: restaurant.defaultTaxPercent,
    serviceChargeEnabled: Boolean(restaurant.serviceChargeEnabled),
    serviceChargePercent: restaurant.serviceChargePercent,
    discountSubunit: calculatedDiscountSubunit,
    loyaltyDiscountSubunit,
  });

  const invoiceNumber = Number(restaurant.nextInvoiceNumber || 1001);
  const orderNo = buildReadableOrderNo({
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    restaurantCode: restaurant.invoicePrefix,
    tableNo,
    date: new Date(),
    sequence: invoiceNumber,
  });
  const invoiceNo = `${String(restaurant.invoicePrefix || "INV").toUpperCase()}-${Number(restaurant.nextInvoiceNumber || 1001)}`;

  const branchId = actor?.branchId ? Number(actor.branchId) : null;

  return prisma.$transaction(async (tx) => {
    await reserveStockForOrder({ tx, restaurantId, items: normalizedItems });

    let inputTableSessionId = body.tableSessionId ? Number(body.tableSessionId) : null;
    if (!inputTableSessionId && tableNo) {
      const dTable = await tx.diningTable.findFirst({
        where: { restaurantId, tableNo: String(tableNo).trim() },
        select: { id: true, tableNo: true },
      });
      if (dTable) {
        let activeSession = await tx.tableSession.findFirst({
          where: {
            tableId: dTable.id,
            restaurantId,
            status: { in: ["OPEN", "BILLING", "PAID"] },
          },
        });
        if (!activeSession) {
          activeSession = await tx.tableSession.create({
            data: {
              restaurantId,
              tableId: dTable.id,
              tableNo: dTable.tableNo,
              waiterId: actor?.userId || null,
              waiterName: actor?.userName || null,
              guestCount: Math.max(1, Number(body.guestCount || 1)),
              status: "OPEN",
              openedAt: new Date(),
            },
          });
        }
        inputTableSessionId = activeSession.id;
      }
    }

    const order = await tx.order.create({
      data: {
        restaurantId,
        branchId,
        tableSessionId: inputTableSessionId,
        orderNo,
        invoiceNo,
        orderSource: "POS",
        createdByRole: createdByRoleFromStaffRole(actor?.role),
        createdByUserId: actor?.userId || null,
        customerId,
        customerType,
        customerName,
        phone,
        email,
        tableNo,
        notes,
        subtotal: bill.subtotal,
        taxAmount: bill.taxAmount,
        serviceChargeAmount: bill.serviceChargeAmount,
        discountAmount: bill.discountAmount,
        total: bill.total,
        promotionId: appliedPromotionId,
        couponCode: appliedCouponCode,
        discountType: appliedDiscountType,
        discountReason: appliedDiscountReason,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        loyaltyDiscountAmount,
        loyaltyPointsEarned: 0,
        status: "PLACED",
        paymentStatus: "PENDING",
        items: {
          create: normalizedItems.map((item) => ({
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            preparedByName: item.preparedByName || null,
            variantId: item.variantId || null,
            variantName: item.variantName || null,
            variantPrice: item.variantPrice || null,
            selectedModifiers: item.selectedModifiers || null,
            notes: item.notes || null,
            qty: item.qty,
            price: item.priceSubunit / 100,
            total: (item.priceSubunit * item.qty) / 100,
          })),
        },
        statusEvents: {
          create: {
            status: "PLACED",
            source: "POS",
            changedByUserId: actor?.userId || null,
            changedByName: body.changedByName ? String(body.changedByName).trim() : null,
          },
        },
      },
      include: {
        items: true,
        customer: true,
        statusEvents: { orderBy: { createdAt: "asc" } },
      },
    });

    // Execute loyalty redemption ledger transaction
    if (loyaltyPointsToRedeem > 0 && customerId) {
      await redeemPointsForOrder({
        db: tx,
        restaurantId,
        orderId: order.id,
        customerId,
        pointsToRedeem: loyaltyPointsToRedeem,
        actor,
      });
    }

    // Automatic recipe raw material stock deduction
    await deductStockForOrder({
      tx,
      restaurantId,
      orderId: order.id,
      orderItems: order.items,
      actor,
    });

    // Increment promotion usage count atomically
    if (appliedPromotionId) {
      await incrementPromotionUsageTx({ tx, promotionId: appliedPromotionId });
    }

    await tx.restaurant.update({
      where: { id: restaurantId },
      data: { nextInvoiceNumber: { increment: 1 } },
    });

    if (inputTableSessionId) {
      const sessionOrders = await tx.order.findMany({
        where: { tableSessionId: inputTableSessionId, status: { not: "CANCELLED" } },
        select: { subtotal: true, taxAmount: true, serviceChargeAmount: true, discountAmount: true, total: true },
      });

      const sessionSubtotal = sessionOrders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
      const sessionTax = sessionOrders.reduce((sum, o) => sum + Number(o.taxAmount || 0), 0);
      const sessionService = sessionOrders.reduce((sum, o) => sum + Number(o.serviceChargeAmount || 0), 0);
      const sessionDiscount = sessionOrders.reduce((sum, o) => sum + Number(o.discountAmount || 0), 0);
      const sessionTotal = sessionOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

      await tx.tableSession.update({
        where: { id: inputTableSessionId },
        data: {
          subtotal: sessionSubtotal,
          taxAmount: sessionTax,
          serviceChargeAmount: sessionService,
          discountAmount: sessionDiscount,
          total: sessionTotal,
        },
      });
    }

    const kots = await createKotsForOrder({
      prisma,
      tx,
      order,
      actor,
      idempotencyKey: body.idempotencyKey || null,
    });
    order.kots = kots;

    return order;
  });
};

export const updateOrderStatus = async ({ prisma, actor, orderId, nextStatus, notes, changedByName } = {}) => {
  const id = Number(orderId || 0);
  if (!id) {
    const err = new Error("invalid_order_id");
    err.code = "invalid_order_id";
    throw err;
  }

  const targetStatus = normalizeOrderStatus(nextStatus);
  const role = String(actor?.role || "").toUpperCase();

  if (!canSetStatus(role, targetStatus)) {
    const err = new Error("status_not_allowed");
    err.code = "status_not_allowed";
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      const err = new Error("order_not_found");
      err.code = "order_not_found";
      throw err;
    }

    if (actor?.restaurantId && Number(order.restaurantId) !== Number(actor.restaurantId) && role !== "SUPER_ADMIN") {
      const err = new Error("restaurant_access_denied");
      err.code = "restaurant_access_denied";
      throw err;
    }

    const currentStatus = normalizeOrderStatus(order.status);
    if (currentStatus === "CANCELLED") {
      const err = new Error("order_cancelled");
      err.code = "order_cancelled";
      throw err;
    }

    if (targetStatus === "CANCELLED" && currentStatus !== "CANCELLED") {
      await restoreStockForOrder({
        tx,
        restaurantId: order.restaurantId,
        items: (order.items || []).map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
      });
      await reverseStockForOrder({
        tx,
        restaurantId: order.restaurantId,
        orderId: order.id,
        actor,
      });
      await reversePointsForRefund({
        db: tx,
        restaurantId: order.restaurantId,
        orderId: order.id,
        refundRatio: 1.0,
        actor,
      });
    }

    if (targetStatus === "DELIVERED") {
      await earnPointsForOrder({
        db: tx,
        restaurantId: order.restaurantId,
        orderId: order.id,
        actor,
      });
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        status: targetStatus,
        statusEvents: {
          create: {
            status: targetStatus,
            source: "STAFF",
            changedByUserId: actor?.userId || null,
            changedByName: changedByName ? String(changedByName).trim() : null,
            notes: notes ? String(notes).trim() : null,
          },
        },
      },
      include: {
        items: true,
        customer: true,
        statusEvents: { orderBy: { createdAt: "asc" } },
      },
    });

    // Trigger Notification for Customer on Order Status Change
    if (updated?.customer?.id) {
      const statusTypeMap = {
        ACCEPTED: "ORDER_ACCEPTED",
        PREPARING: "FOOD_PREPARING",
        READY: "FOOD_READY",
        DELIVERED: "ORDER_DELIVERED",
        CANCELLED: "ORDER_CANCELLED",
      };

      const notificationType = statusTypeMap[targetStatus];
      if (notificationType) {
        const titles = {
          ACCEPTED: "Order Accepted",
          PREPARING: "Food Is Being Prepared",
          READY: "Order Ready!",
          DELIVERED: "Order Delivered",
          CANCELLED: "Order Cancelled",
        };
        const messages = {
          ACCEPTED: `Your order #${updated.orderNo || id} has been accepted by the restaurant.`,
          PREPARING: `The kitchen has started preparing your food for order #${updated.orderNo || id}.`,
          READY: `Your food for order #${updated.orderNo || id} is ready!`,
          DELIVERED: `Your order #${updated.orderNo || id} has been delivered. Enjoy your meal!`,
          CANCELLED: `Your order #${updated.orderNo || id} was cancelled.`,
        };

        createAndDispatchNotification({
          prisma,
          recipientType: "CUSTOMER",
          recipientId: updated.customer.id,
          orderId: id,
          restaurantId: updated.restaurantId,
          notificationType,
          title: titles[targetStatus] || `Order ${targetStatus}`,
          message: messages[targetStatus] || `Order #${updated.orderNo || id} status updated to ${targetStatus}.`,
          data: { orderId: id, orderNo: updated.orderNo, status: targetStatus, screen: "ORDER_TRACKING" },
          idempotencyKey: `ORDER_${id}_${targetStatus}`,
        }).catch(() => {});
      }
    }

    return updated;
  });
};
