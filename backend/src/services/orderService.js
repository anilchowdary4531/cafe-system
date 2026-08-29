import { computeBill, toPriceSubunitItems } from "./billingService.js";
import { reserveStockForOrder, restoreStockForOrder } from "./inventoryService.js";
import { normalizePhone } from "./phoneService.js";
import { createAndDispatchNotification } from "./notificationService.js";

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
    select: { id: true, name: true, price: true },
  });

  if (!menuItems.length) {
    menuItems = await prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      select: { id: true, name: true, price: true },
    });
  }

  const normalizedItems = toPriceSubunitItems({ menuItems, items });

  const discountSubunit =
    body.discountSubunit !== undefined
      ? Number(body.discountSubunit || 0)
      : body.discountAmount !== undefined
        ? Math.round(Number(body.discountAmount || 0) * 100)
        : 0;
  const bill = computeBill({
    items: normalizedItems,
    taxEnabled: Boolean(restaurant.taxEnabled),
    taxType: restaurant.taxType,
    taxPercent: restaurant.defaultTaxPercent,
    serviceChargeEnabled: Boolean(restaurant.serviceChargeEnabled),
    serviceChargePercent: restaurant.serviceChargePercent,
    discountSubunit,
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

    const order = await tx.order.create({
      data: {
        restaurantId,
        branchId,
        orderNo,
        invoiceNo,
        orderSource: "POS",
        createdByRole: createdByRoleFromStaffRole(actor?.role),
        createdByUserId: actor?.userId || null,
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
        status: "PLACED",
        paymentStatus: "PENDING",
        items: {
          create: normalizedItems.map((item) => ({
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            preparedByName: item.preparedByName || null,
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

    await tx.restaurant.update({
      where: { id: restaurantId },
      data: { nextInvoiceNumber: { increment: 1 } },
    });

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
