import crypto from "node:crypto";
import { toSubunit } from "./moneyService.js";

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
  if (!s) return null;
  return s;
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
  const orderId = Number(body.orderId || 0);
  if (!orderId) {
    const err = new Error("order_id_required");
    err.code = "order_id_required";
    throw err;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { id: true, currency: true } } },
  });
  if (!order) {
    const err = new Error("order_not_found");
    err.code = "order_not_found";
    throw err;
  }

  if (actor?.restaurantId && Number(order.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
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
        orderId,
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
      orderId,
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
  const orderId = Number(body.orderId || 0);
  if (!paymentId && !orderId) {
    const err = new Error("payment_id_required");
    err.code = "payment_id_required";
    throw err;
  }

  // Lightweight verification: update the order directly by orderId.
  // Used by POS cash/UPI flows where a provider webhook is not available in Phase-1.
  if (!paymentId && orderId) {
    const status = normalizeVerificationStatus(body.status);
    if (!status) {
      const err = new Error("status_required");
      err.code = "status_required";
      throw err;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, restaurantId: true, paymentMode: true },
    });
    if (!order) {
      const err = new Error("order_not_found");
      err.code = "order_not_found";
      throw err;
    }

    if (actor?.restaurantId && Number(order.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
      const err = new Error("restaurant_access_denied");
      err.code = "restaurant_access_denied";
      throw err;
    }

    const nextMode =
      normalizePaymentMode(body.paymentMode || body.paymentMethod || body.method) ||
      (order.paymentMode ? normalizePaymentMode(order.paymentMode) : null);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
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

  if (actor?.restaurantId && Number(payment.restaurantId) !== Number(actor.restaurantId) && String(actor.role).toUpperCase() !== "SUPER_ADMIN") {
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

    const razorpayOrderId = String(body.razorpayOrderId || body.razorpay_order_id || payment.providerOrderId || "");
    const razorpayPaymentId = String(body.razorpayPaymentId || body.razorpay_payment_id || "");
    const razorpaySignature = String(body.razorpaySignature || body.razorpay_signature || "");

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      const err = new Error("razorpay_fields_required");
      err.code = "razorpay_fields_required";
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
