import crypto from "node:crypto";
import { toSubunit } from "./moneyService.js";
import { normalizePhone } from "./phoneService.js";

const normalizeVerificationStatus = (value) => {
  const s = String(value || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "SUCCESS" || s === "PAID") return "SUCCESS";
  if (s === "FAILED" || s === "FAILURE") return "FAILED";
  if (s === "PENDING") return "PENDING";
  return "";
};

const normalizePaymentMode = (value) => {
  const s = String(value || "").trim().toUpperCase();
  if (["CASH", "UPI", "CARD", "ONLINE", "PAY_LATER"].includes(s)) return s;
  return null;
};

const razorpayAuthHeader = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return { keyId, header: `Basic ${token}` };
};

const createRazorpayOrder = async ({ amountSubunit, currency, receipt, notes }) => {
  const auth = razorpayAuthHeader();
  if (!auth) {
    const err = new Error("razorpay_not_configured");
    err.code = "razorpay_not_configured";
    throw err;
  }

  if (typeof fetch !== "function") {
    const err = new Error("fetch_unavailable");
    err.code = "fetch_unavailable";
    throw err;
  }

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: auth.header,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(amountSubunit),
      currency: String(currency || "INR"),
      receipt: receipt ? String(receipt).slice(0, 40) : undefined,
      notes: notes && typeof notes === "object" ? notes : undefined,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error?.description || "razorpay_order_failed");
    err.code = "razorpay_order_failed";
    err.details = payload;
    throw err;
  }

  return { keyId: auth.keyId, order: payload };
};

export const createPayment = async ({ prisma, actor, input } = {}) => {
  const body = input || {};
  const rawOrderId = body.orderId || body.orderNo || "";
  if (!rawOrderId) {
    const err = new Error("order_id_required");
    err.code = "order_id_required";
    throw err;
  }

  let order = null;
  const isNumeric = Number.isInteger(Number(rawOrderId)) && Number(rawOrderId) > 0;
  if (isNumeric) {
    order = await prisma.order.findUnique({
      where: { id: Number(rawOrderId) },
      include: { restaurant: { select: { id: true, currency: true } } },
    });
  } else if (typeof rawOrderId === "string" && rawOrderId.trim().length > 0) {
    order = await prisma.order.findFirst({
      where: { orderNo: rawOrderId.trim() },
      include: { restaurant: { select: { id: true, currency: true } } },
    });
  }

  if (!order) {
    const err = new Error("order_not_found");
    err.code = "order_not_found";
    throw err;
  }

  // Check if order is eligible for payment (i.e. not already paid)
  if (order.paymentStatus === "SUCCESS" || order.paymentStatus === "PAID") {
    const err = new Error("order_already_paid");
    err.code = "order_already_paid";
    throw err;
  }

  if (actor?.type === "customer") {
    const orderPhone = normalizePhone(order.phone || "");
    const actorPhone = normalizePhone(actor.phone || "");
    if (!orderPhone || orderPhone !== actorPhone) {
      const err = new Error("order_access_denied");
      err.code = "order_access_denied";
      throw err;
    }
  } else if (actor?.restaurantId && Number(order.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
    const err = new Error("restaurant_access_denied");
    err.code = "restaurant_access_denied";
    throw err;
  }

  const currency = String(order.restaurant?.currency || "INR").toUpperCase();
  const amountSubunit = toSubunit(order.total);
  const method = String(body.paymentMethod || body.method || "CASH").toUpperCase();
  const provider = String(body.provider || (method === "ONLINE" ? "RAZORPAY" : "OFFLINE")).toUpperCase();

  if (provider === "RAZORPAY") {
    const created = await createRazorpayOrder({
      amountSubunit,
      currency,
      receipt: order.invoiceNo || order.orderNo || `order-${orderId}`,
      notes: { orderId: String(orderId) },
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        restaurantId: order.restaurantId,
        amountSubunit,
        currency,
        method: method === "ONLINE" ? "ONLINE" : method,
        status: "PENDING",
        provider: "RAZORPAY",
        providerOrderId: String(created.order?.id || ""),
        providerMetadata: created.order || null,
      },
    });

    return {
      payment,
      provider: "RAZORPAY",
      razorpay: {
        keyId: created.keyId,
        orderId: created.order?.id,
        amount: created.order?.amount,
        currency: created.order?.currency,
      },
    };
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      restaurantId: order.restaurantId,
      amountSubunit,
      currency,
      method,
      status: "PENDING",
      provider: provider || "OFFLINE",
    },
  });

  return { payment, provider: payment.provider };
};

export const verifyPayment = async ({ prisma, actor, input } = {}) => {
  const body = input || {};
  const paymentId = Number(body.paymentId || 0);
  const orderId = body.orderId || body.orderNo || "";
  if (!paymentId && !orderId) {
    const err = new Error("payment_id_required");
    err.code = "payment_id_required";
    throw err;
  }

  // Lightweight verification: update the order directly by orderId (Staff and Customer fallback).
  if (!paymentId && orderId) {
    let status = normalizeVerificationStatus(body.status);
    if (!status) {
      const err = new Error("status_required");
      err.code = "status_required";
      throw err;
    }

    let order = null;
    const isNumeric = Number.isInteger(Number(orderId)) && Number(orderId) > 0;
    if (isNumeric) {
      order = await prisma.order.findUnique({
        where: { id: Number(orderId) },
        select: { id: true, restaurantId: true, phone: true, paymentMode: true, paymentStatus: true, total: true },
      });
    } else if (typeof orderId === "string" && orderId.trim().length > 0) {
      order = await prisma.order.findFirst({
        where: { orderNo: orderId.trim() },
        select: { id: true, restaurantId: true, phone: true, paymentMode: true, paymentStatus: true, total: true },
      });
    }

    if (!order) {
      const err = new Error("order_not_found");
      err.code = "order_not_found";
      throw err;
    }

    if (order.paymentStatus === "SUCCESS" || order.paymentStatus === "PAID") {
      const err = new Error("order_already_paid");
      err.code = "order_already_paid";
      throw err;
    }

    // Access check:
    if (actor?.type === "customer") {
      const orderPhone = normalizePhone(order.phone || "");
      const actorPhone = normalizePhone(actor.phone || "");
      if (!orderPhone || orderPhone !== actorPhone) {
        const err = new Error("order_access_denied");
        err.code = "order_access_denied";
        throw err;
      }
    } else if (actor?.restaurantId && Number(order.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
      const err = new Error("restaurant_access_denied");
      err.code = "restaurant_access_denied";
      throw err;
    }

    const nextMode =
      normalizePaymentMode(body.paymentMode || body.paymentMethod || body.method) ||
      (order.paymentMode ? normalizePaymentMode(order.paymentMode) : null);

    if (nextMode === "PAY_LATER") {
      const normPhone = normalizePhone(order.phone || "");
      if (!normPhone) {
        const err = new Error("pay_later_phone_required");
        err.code = "pay_later_phone_required";
        throw err;
      }

      const account = await prisma.payLaterAccount.findFirst({
        where: {
          restaurantId: order.restaurantId,
          customer: { phone: normPhone },
          status: "ACTIVE",
        },
      });

      if (!account) {
        const err = new Error("pay_later_not_approved");
        err.code = "pay_later_not_approved";
        throw err;
      }

      const nextOrder = await prisma.$transaction(async (tx) => {
        // Create order credit transaction
        await tx.payLaterTransaction.create({
          data: {
            accountId: account.id,
            restaurantId: order.restaurantId,
            customerId: account.customerId,
            orderId: order.id,
            type: "ORDER_CREDIT",
            amount: order.total,
            status: "SUCCESS",
            createdBy: actor?.type === "customer" ? "Customer" : `${actor.role} (ID: ${actor.userId})`,
            description: "Food Order Credit",
          },
        });

        // Increment account balances
        await tx.payLaterAccount.update({
          where: { id: account.id },
          data: {
            totalBorrowed: { increment: order.total },
            pendingBalance: { increment: order.total },
          },
        });

        // Update the order itself to PAID/SUCCESS
        return await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "SUCCESS",
            paymentMode: "PAY_LATER",
          },
        });
      });

      return { order: nextOrder, verified: true };
    }

    // Force status to PENDING for customer cash/offline payments
    if (actor?.type === "customer") {
      status = "PENDING";
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: status,
        ...(nextMode ? { paymentMode: nextMode } : {}),
      },
    });

    return { order: updatedOrder, verified: status === "SUCCESS" };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment) {
    const err = new Error("payment_not_found");
    err.code = "payment_not_found";
    throw err;
  }

  // Check permissions:
  if (actor?.type === "customer") {
    const orderPhone = normalizePhone(payment.order?.phone || "");
    const actorPhone = normalizePhone(actor.phone || "");
    if (!orderPhone || orderPhone !== actorPhone) {
      const err = new Error("order_access_denied");
      err.code = "order_access_denied";
      throw err;
    }
  } else if (actor?.restaurantId && Number(payment.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
    const err = new Error("restaurant_access_denied");
    err.code = "restaurant_access_denied";
    throw err;
  }

  const provider = String(payment.provider || body.provider || "OFFLINE").toUpperCase();
  if (provider === "RAZORPAY") {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      const err = new Error("razorpay_not_configured");
      err.code = "razorpay_not_configured";
      throw err;
    }

    const razorpayOrderId = String(body.razorpayOrderId || body.razorpay_order_id || "");
    const razorpayPaymentId = String(body.razorpayPaymentId || body.razorpay_payment_id || "");
    const razorpaySignature = String(body.razorpaySignature || body.razorpay_signature || "");

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      const err = new Error("razorpay_fields_required");
      err.code = "razorpay_fields_required";
      throw err;
    }

    // Verify client-submitted order ID matches stored providerOrderId
    if (razorpayOrderId !== payment.providerOrderId) {
      const err = new Error("razorpay_order_id_mismatch");
      err.code = "razorpay_order_id_mismatch";
      throw err;
    }

    const generated = crypto.createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
    const a = Buffer.from(generated);
    const b = Buffer.from(razorpaySignature);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      const err = new Error("invalid_signature");
      err.code = "invalid_signature";
      throw err;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAID",
          transactionId: razorpayPaymentId,
          providerMetadata: {
            ...(payment.providerMetadata || {}),
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
          },
        },
      });

      // Mark order paid (full amount assumed in Phase-1)
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: "SUCCESS",
          paymentMode: "ONLINE",
        },
      });

      return updatedPayment;
    });

    return { payment: updated, verified: true };
  }

  // Non-Razorpay payment verification (Staff only)
  if (actor?.type === "customer") {
    const err = new Error("razorpay_verification_required");
    err.code = "razorpay_verification_required";
    throw err;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        transactionId: body.transactionId ? String(body.transactionId) : payment.transactionId,
        providerMetadata: body.metadata && typeof body.metadata === "object" ? body.metadata : payment.providerMetadata,
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: "SUCCESS",
        paymentMode: updatedPayment.method,
      },
    });

    return updatedPayment;
  });

  return { payment: updated, verified: true };
};
