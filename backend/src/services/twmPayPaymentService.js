import { getTwmPayConfig } from "../config/twmPay.config.js";
import { initCashfree } from "../config/cashfree.config.js";
import { completeSessionAndReleaseTable } from "./tableSessionService.js";
import {
  createTwmPaymentOrder,
  fetchTwmOrderStatus,
  fromPaise,
  normalizeTwmStatus,
  recordTwmNotificationMetric,
  recordTwmStatusMetric,
  toPaise,
  verifyTwmSignature,
} from "./twmPay.service.js";

/**
 * Orchestrates TWM Pay checkout creation, return verification, webhook notify
 * processing, status reconciliation, idempotency, and multi-tenant isolation.
 */

const createOrderInFlight = new Map();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const sanitizeRefSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const getFrontendBaseUrl = (req) => {
  const cfg = getTwmPayConfig();
  if (cfg.returnUrlOverride) return cfg.returnUrlOverride.replace(/\/+$/, "");

  const originHeader = String(req?.headers?.origin || "").trim();
  if (/^https?:\/\//i.test(originHeader)) {
    return originHeader.replace(/\/+$/, "");
  }

  const refererHeader = String(req?.headers?.referer || "").trim();
  if (/^https?:\/\//i.test(refererHeader)) {
    try {
      return new URL(refererHeader).origin.replace(/\/+$/, "");
    } catch {
      // ignore invalid referer
    }
  }

  const envFrontend = String(process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(envFrontend)) return envFrontend;
  return "http://localhost:5173";
};

const getBackendBaseUrl = (req) => {
  const envBackend = String(process.env.BACKEND_URL || process.env.API_PUBLIC_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (/^https?:\/\//i.test(envBackend)) return envBackend;

  const protoRaw = String(req?.headers?.["x-forwarded-proto"] || req?.protocol || "http").split(",")[0].trim();
  const hostRaw = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").split(",")[0].trim();
  if (hostRaw) {
    return `${protoRaw || "http"}://${hostRaw}`.replace(/\/+$/, "");
  }
  return "http://localhost:5000";
};

export const resolveTwmReturnUrl = ({ req, requestedReturnUrl }) => {
  const cfg = getTwmPayConfig();
  if (cfg.returnUrlOverride) {
    return cfg.returnUrlOverride;
  }

  const defaultBase = getFrontendBaseUrl(req);
  // Keep default return_url free of query string so gateway `?order_ref=...` works cleanly
  const defaultUrl = `${defaultBase}/payment-status`;

  const candidate = String(requestedReturnUrl || "").trim();
  if (!candidate) return defaultUrl;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return defaultUrl;
    }
    const allowedOrigins = new Set([defaultBase]);
    const envFrontend = String(process.env.FRONTEND_URL || "").trim();
    if (/^https?:\/\//i.test(envFrontend)) {
      allowedOrigins.add(new URL(envFrontend).origin);
    }
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      allowedOrigins.has(parsed.origin)
    ) {
      // Strip placeholders like {order_id} or trailing query chars so TWM Pay appends clean params
      const cleaned = candidate.split("?")[0].replace(/\{order_id\}/gi, "").replace(/\/+$/, "");
      return cleaned || defaultUrl;
    }
  } catch {
    return defaultUrl;
  }
  return defaultUrl;
};

export const resolveTwmNotifyUrl = ({ req }) => {
  const cfg = getTwmPayConfig();
  if (cfg.notifyUrlOverride) return cfg.notifyUrlOverride;
  const backendBase = getBackendBaseUrl(req);
  return `${backendBase}/api/payments/twm/notify`;
};

export const resolveOrderAndTwmPayment = async (prisma, { orderId, orderRef }) => {
  if (!prisma) {
    const err = new Error("Database connection unavailable");
    err.statusCode = 503;
    throw err;
  }
  if (!prisma.payment || !prisma.order) {
    return { order: null, payment: null };
  }

  let matchedPayment = null;
  let order = null;

  const cleanRef = String(orderRef || "").trim();
  const cleanId = String(orderId || "").trim();

  if (cleanRef) {
    matchedPayment = await prisma.payment.findFirst({
      where: {
        provider: "TWM_PAY",
        providerOrderId: cleanRef,
      },
      orderBy: { id: "desc" },
    });
    if (matchedPayment?.orderId) {
      order = await prisma.order.findUnique({
        where: { id: matchedPayment.orderId },
        include: { restaurant: { select: { id: true, slug: true, name: true } } },
      });
    }
  }

  if (!order && cleanId) {
    const numericId = Number(cleanId);
    if (!Number.isNaN(numericId) && Number.isInteger(numericId) && numericId > 0 && numericId < 2147483647) {
      order = await prisma.order.findUnique({
        where: { id: numericId },
        include: { restaurant: { select: { id: true, slug: true, name: true } } },
      });
    }

    if (!order) {
      order = await prisma.order.findFirst({
        where: { OR: [{ orderNo: cleanId }, { invoiceNo: cleanId }] },
        include: { restaurant: { select: { id: true, slug: true, name: true } } },
      });
    }

    if (!order && !cleanRef) {
      matchedPayment = await prisma.payment.findFirst({
        where: {
          provider: "TWM_PAY",
          providerOrderId: cleanId,
        },
        orderBy: { id: "desc" },
      });
      if (matchedPayment?.orderId) {
        order = await prisma.order.findUnique({
          where: { id: matchedPayment.orderId },
          include: { restaurant: { select: { id: true, slug: true, name: true } } },
        });
      }
    }
  }

  if (order && cleanRef && matchedPayment && matchedPayment.orderId !== order.id) {
    const err = new Error("Payment reference does not belong to specified order");
    err.statusCode = 403;
    err.code = "TENANT_OR_ORDER_MISMATCH";
    throw err;
  }

  if (order && !matchedPayment) {
    matchedPayment = await prisma.payment.findFirst({
      where: {
        orderId: order.id,
        provider: "TWM_PAY",
      },
      orderBy: { id: "desc" },
    });
  }

  return { order, payment: matchedPayment };
};

const enforceTenantBoundary = ({ order, restaurantId, slug }) => {
  if (!order) return;
  if (restaurantId !== undefined && restaurantId !== null && String(restaurantId).trim() !== "") {
    const numRid = Number(restaurantId);
    if (Number.isNaN(numRid) || Number(order.restaurantId) !== numRid) {
      const err = new Error("Forbidden: order belongs to another restaurant");
      err.statusCode = 403;
      err.code = "CROSS_TENANT_FORBIDDEN";
      throw err;
    }
  }

  if (slug !== undefined && slug !== null && String(slug).trim() !== "") {
    const cleanSlug = String(slug).trim().toLowerCase();
    const orderSlug = String(order.restaurant?.slug || "").trim().toLowerCase();
    if (!orderSlug || orderSlug !== cleanSlug) {
      const err = new Error("Forbidden: order does not belong to this restaurant slug");
      err.statusCode = 403;
      err.code = "CROSS_TENANT_FORBIDDEN";
      throw err;
    }
  }
};

const getAuthoritativeOrderPaise = (order, payment = null) => {
  if (payment?.amountSubunit && Number.isSafeInteger(payment.amountSubunit) && payment.amountSubunit > 0) {
    // Also sanity-check against current order.total so edits to order bill cannot drift silently
    const orderTotal = Number(order?.total || 0);
    if (orderTotal > 0) {
      return toPaise(orderTotal);
    }
    return payment.amountSubunit;
  }
  const orderTotal = Number(order?.total || order?.amount || 0);
  return toPaise(orderTotal);
};

const emitPaymentUpdatedRealtime = ({ realtime, restaurantId, orderId, paymentStatus, gatewayStatus, paymentMode, transactionId }) => {
  if (!realtime || !restaurantId) return;
  const payload = {
    restaurantId,
    orderId,
    status: paymentStatus,
    paymentStatus,
    gatewayStatus,
    provider: "TWM_PAY",
    paymentMode: paymentMode || "ONLINE",
    transactionId: transactionId || null,
    updatedAt: new Date().toISOString(),
  };

  const rooms = [`restaurant_${restaurantId}`, `restaurant:${restaurantId}`];
  for (const room of rooms) {
    try {
      realtime.io?.to?.(room)?.emit?.("payment:updated", payload);
      realtime.staff?.to?.(room)?.emit?.("payment:updated", payload);
    } catch {
      // ignore socket emit errors
    }
  }
};

export const createTwmPayCheckoutSession = async ({
  prisma,
  req,
  orderId,
  restaurantId = null,
  slug = null,
  customerId = null,
  customerName = null,
  customerEmail = null,
  customerPhone = null,
  returnUrl = null,
  description = null,
  idempotencyKey = null,
  forceNewSession = false,
  fetchImpl,
}) => {
  const { order } = await resolveOrderAndTwmPayment(prisma, { orderId });
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.statusCode = 404;
    err.code = "ORDER_NOT_FOUND";
    throw err;
  }

  enforceTenantBoundary({ order, restaurantId, slug });

  if (order.paymentStatus === "PAID" || order.status === "PAID" || order.status === "COMPLETED") {
    const err = new Error("Order is already paid");
    err.statusCode = 409;
    err.code = "ORDER_ALREADY_PAID";
    throw err;
  }

  const expectedPaise = getAuthoritativeOrderPaise(order);
  const expectedRupees = fromPaise(expectedPaise);
  const resolvedReturnUrl = resolveTwmReturnUrl({ req, requestedReturnUrl: returnUrl });
  const resolvedNotifyUrl = resolveTwmNotifyUrl({ req });
  const cleanIdempotencyKey = idempotencyKey ? String(idempotencyKey).trim().slice(0, 120) : null;

  const lockKey = `twm_create:${order.id}`;
  if (createOrderInFlight.has(lockKey)) {
    return createOrderInFlight.get(lockKey);
  }

  const workPromise = (async () => {
    let existingKeyOccupied = false;

    // 1. Explicit idempotency key lookup
    if (cleanIdempotencyKey) {
      const existingByKey = await prisma.payment.findUnique({
        where: { idempotencyKey: cleanIdempotencyKey },
      });
      if (existingByKey) {
        if (existingByKey.orderId !== order.id) {
          const err = new Error("Idempotency key belongs to a different order");
          err.statusCode = 409;
          err.code = "IDEMPOTENCY_CONFLICT";
          throw err;
        }
        existingKeyOccupied = true;
        const meta = existingByKey.providerMetadata || {};
        if (
          !forceNewSession &&
          existingByKey.status === "PENDING" &&
          existingByKey.provider === "TWM_PAY" &&
          meta.checkoutUrl &&
          meta.gatewayStatus !== "REJECTED" &&
          meta.gatewayStatus !== "EXPIRED" &&
          Number(existingByKey.amountSubunit) === expectedPaise
        ) {
          return {
            success: true,
            provider: "TWM_PAY",
            idempotentReplay: true,
            orderId: String(order.id),
            orderNo: order.orderNo,
            orderRef: existingByKey.providerOrderId,
            order_ref: existingByKey.providerOrderId,
            checkoutUrl: meta.checkoutUrl,
            checkout_url: meta.checkoutUrl,
            amount: round2(expectedRupees),
            amountPaise: expectedPaise,
            amount_paise: expectedPaise,
            gatewayStatus: meta.gatewayStatus || "CREATED",
            paymentStatus: "PENDING",
            returnUrl: meta.returnUrl || resolvedReturnUrl,
          };
        }
      }
    }

    // 2. Existing TWM payment attempts on this order
    const priorTwmPayments = await prisma.payment.findMany({
      where: {
        orderId: order.id,
        provider: "TWM_PAY",
      },
      orderBy: { id: "desc" },
    });

    const latestPayment = priorTwmPayments[0] || null;
    if (latestPayment) {
      const latestMeta = latestPayment.providerMetadata || {};
      if (latestPayment.status === "SUCCESS") {
        const err = new Error("Order is already paid");
        err.statusCode = 409;
        err.code = "ORDER_ALREADY_PAID";
        throw err;
      }

      if (latestMeta.gatewayStatus === "UTR_SUBMITTED" && latestPayment.status === "PENDING") {
        const err = new Error("UPI payment verification is already in progress for this order");
        err.statusCode = 409;
        err.code = "PAYMENT_VERIFICATION_PENDING";
        err.orderRef = latestPayment.providerOrderId;
        err.checkoutUrl = latestMeta.checkoutUrl || null;
        throw err;
      }

      const ageMs = Date.now() - new Date(latestPayment.createdAt).getTime();
      if (
        !forceNewSession &&
        latestPayment.status === "PENDING" &&
        latestMeta.gatewayStatus === "CREATED" &&
        latestMeta.checkoutUrl &&
        Number(latestPayment.amountSubunit) === expectedPaise &&
        ageMs < 15 * 60 * 1000
      ) {
        return {
          success: true,
          provider: "TWM_PAY",
          idempotentReplay: true,
          orderId: String(order.id),
          orderNo: order.orderNo,
          orderRef: latestPayment.providerOrderId,
          order_ref: latestPayment.providerOrderId,
          checkoutUrl: latestMeta.checkoutUrl,
          checkout_url: latestMeta.checkoutUrl,
          amount: round2(expectedRupees),
          amountPaise: expectedPaise,
          amount_paise: expectedPaise,
          gatewayStatus: "CREATED",
          paymentStatus: "PENDING",
          returnUrl: latestMeta.returnUrl || resolvedReturnUrl,
        };
      }
    }

    // Generate unique per-attempt order_ref for TWM Pay (must be unique per order across retries)
    const attempt = priorTwmPayments.length + 1;
    const baseSegment = sanitizeRefSegment(order.orderNo || `ORD_${order.id}`);
    const orderRef = `TWM_${order.restaurantId}_${order.id}_${attempt}_${baseSegment}`.slice(0, 64);

    const resolvedName = String(customerName || order.customerName || "Tiffzy Guest").trim();
    const resolvedPhone = String(customerPhone || order.phone || "").trim();
    const resolvedEmail = String(customerEmail || order.email || "").trim();
    const resolvedDescription = String(
      description || `Tiffzy Order ${order.orderNo || order.id}`
    ).trim();

    const twmResult = await createTwmPaymentOrder(
      {
        orderRef,
        amountPaise: expectedPaise,
        returnUrl: resolvedReturnUrl,
        notifyUrl: resolvedNotifyUrl,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        customerPhone: resolvedPhone,
        description: resolvedDescription,
      },
      { fetchImpl }
    );

    const paymentIdempotencyKey =
      cleanIdempotencyKey && !existingKeyOccupied
        ? cleanIdempotencyKey
        : `TWM_CREATE_${order.restaurantId}_${order.id}_A${attempt}`;

    await prisma.payment.create({
      data: {
        orderId: order.id,
        restaurantId: order.restaurantId,
        tableSessionId: order.tableSessionId || null,
        customerId: customerId && !Number.isNaN(Number(customerId)) ? Number(customerId) : null,
        provider: "TWM_PAY",
        providerOrderId: twmResult.orderRef,
        amount: round2(expectedRupees),
        amountSubunit: expectedPaise,
        currency: "INR",
        status: "PENDING",
        method: "TWM_PAY",
        paymentMethod: "ONLINE",
        idempotencyKey: paymentIdempotencyKey,
        providerMetadata: {
          gateway: "TWM_PAY",
          orderRef: twmResult.orderRef,
          attempt,
          checkoutUrl: twmResult.checkoutUrl,
          returnUrl: resolvedReturnUrl,
          notifyUrl: resolvedNotifyUrl,
          gatewayStatus: "CREATED",
          rawStatus: "created",
          createdAt: new Date().toISOString(),
        },
      },
    });

    if (order.paymentStatus === "FAILED") {
      await prisma.order
        .update({
          where: { id: order.id },
          data: { paymentStatus: "PENDING" },
        })
        .catch(() => {});
    }

    return {
      success: true,
      provider: "TWM_PAY",
      orderId: String(order.id),
      orderNo: order.orderNo,
      orderRef: twmResult.orderRef,
      order_ref: twmResult.orderRef,
      checkoutUrl: twmResult.checkoutUrl,
      checkout_url: twmResult.checkoutUrl,
      amount: round2(expectedRupees),
      amountPaise: expectedPaise,
      amount_paise: expectedPaise,
      gatewayStatus: "CREATED",
      paymentStatus: "PENDING",
      returnUrl: resolvedReturnUrl,
    };
  })().finally(() => {
    createOrderInFlight.delete(lockKey);
  });

  createOrderInFlight.set(lockKey, workPromise);
  return workPromise;
};

export const applyVerifiedTwmOutcome = async ({
  prisma,
  order,
  payment,
  normalized,
  amountPaise,
  txn = null,
  source = "RETURN",
  rawPayload = {},
  realtime = null,
}) => {
  const expectedPaise = getAuthoritativeOrderPaise(order, payment);

  if (amountPaise !== undefined && amountPaise !== null && String(amountPaise) !== "") {
    const receivedPaise = Number(amountPaise);
    if (!Number.isSafeInteger(receivedPaise) || receivedPaise !== expectedPaise) {
      const err = new Error(
        `Amount mismatch: expected ${expectedPaise} paise, got ${String(amountPaise)} paise`
      );
      err.statusCode = 400;
      err.code = "AMOUNT_MISMATCH";
      throw err;
    }
  }

  const cleanTxn = txn !== undefined && txn !== null && String(txn).trim() !== "" ? String(txn).trim() : null;
  const nowIso = new Date().toISOString();

  const txResult = await prisma.$transaction(async (tx) => {
    const freshOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: { restaurant: { select: { id: true, slug: true, name: true } } },
    });
    const freshPayment = await tx.payment.findUnique({ where: { id: payment.id } });

    if (!freshOrder || !freshPayment) {
      const err = new Error("Order or payment record missing during transaction");
      err.statusCode = 404;
      throw err;
    }

    // Strict non-downgrade rule: once PAID / SUCCESS, never revert or mutate paid state
    if (
      freshOrder.paymentStatus === "PAID" ||
      freshOrder.status === "PAID" ||
      freshOrder.status === "COMPLETED" ||
      freshPayment.status === "SUCCESS"
    ) {
      return {
        alreadyPaid: true,
        newlyPaid: false,
        order: freshOrder,
        payment: freshPayment,
        paymentStatus: "PAID",
        gatewayStatus: "PAID",
      };
    }

    const prevMeta =
      freshPayment.providerMetadata && typeof freshPayment.providerMetadata === "object"
        ? freshPayment.providerMetadata
        : {};

    const updatedMeta = {
      ...prevMeta,
      gateway: "TWM_PAY",
      orderRef: freshPayment.providerOrderId,
      gatewayStatus: normalized.gatewayStatus,
      rawStatus: normalized.rawStatus,
      txn: cleanTxn || prevMeta.txn || null,
      lastEventSource: source,
      lastSyncedAt: nowIso,
      lastRawStatus: normalized.rawStatus,
      verifiedAmountPaise: expectedPaise,
      ...(normalized.gatewayStatus === "UTR_SUBMITTED"
        ? { utrSubmittedAt: prevMeta.utrSubmittedAt || nowIso }
        : {}),
      ...(normalized.isPaid ? { paidAt: nowIso } : {}),
    };

    if (normalized.isPaid) {
      const updatedPayment = await tx.payment.update({
        where: { id: freshPayment.id },
        data: {
          status: "SUCCESS",
          transactionId: cleanTxn || freshPayment.transactionId || freshPayment.providerOrderId,
          method: "TWM_PAY",
          paymentMethod: "ONLINE",
          provider: "TWM_PAY",
          providerMetadata: updatedMeta,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: freshOrder.id },
        data: {
          paymentStatus: "PAID",
          paymentMode: "ONLINE",
        },
        include: { restaurant: { select: { id: true, slug: true, name: true } } },
      });

      return {
        alreadyPaid: false,
        newlyPaid: true,
        order: updatedOrder,
        payment: updatedPayment,
        paymentStatus: "PAID",
        gatewayStatus: "PAID",
      };
    }

    if (normalized.gatewayStatus === "UTR_SUBMITTED") {
      const updatedPayment = await tx.payment.update({
        where: { id: freshPayment.id },
        data: {
          status: "PENDING",
          transactionId: cleanTxn || freshPayment.transactionId || null,
          providerMetadata: updatedMeta,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: freshOrder.id },
        data: {
          paymentStatus: "PENDING",
        },
        include: { restaurant: { select: { id: true, slug: true, name: true } } },
      });

      return {
        alreadyPaid: false,
        newlyPaid: false,
        order: updatedOrder,
        payment: updatedPayment,
        paymentStatus: "PENDING",
        gatewayStatus: "UTR_SUBMITTED",
      };
    }

    if (normalized.paymentStatus === "FAILED") {
      const updatedPayment = await tx.payment.update({
        where: { id: freshPayment.id },
        data: {
          status: "FAILED",
          transactionId: cleanTxn || freshPayment.transactionId || null,
          providerMetadata: updatedMeta,
        },
      });

      // Only update order.paymentStatus to FAILED if there is no newer PENDING or SUCCESS payment
      const newerActive = await tx.payment.findFirst({
        where: {
          orderId: freshOrder.id,
          id: { gt: freshPayment.id },
          status: { in: ["PENDING", "SUCCESS"] },
        },
      });

      let updatedOrder = freshOrder;
      if (!newerActive) {
        updatedOrder = await tx.order.update({
          where: { id: freshOrder.id },
          data: { paymentStatus: "FAILED" },
          include: { restaurant: { select: { id: true, slug: true, name: true } } },
        });
      }

      return {
        alreadyPaid: false,
        newlyPaid: false,
        order: updatedOrder,
        payment: updatedPayment,
        paymentStatus: "FAILED",
        gatewayStatus: normalized.gatewayStatus,
      };
    }

    // CREATED or other non-final state: never downgrade FAILED or UTR_SUBMITTED back to CREATED
    if (freshPayment.status === "FAILED") {
      return {
        alreadyPaid: false,
        newlyPaid: false,
        order: freshOrder,
        payment: freshPayment,
        paymentStatus: "FAILED",
        gatewayStatus: prevMeta.gatewayStatus || "FAILED",
      };
    }

    if (prevMeta.gatewayStatus === "UTR_SUBMITTED" && normalized.gatewayStatus === "CREATED") {
      return {
        alreadyPaid: false,
        newlyPaid: false,
        order: freshOrder,
        payment: freshPayment,
        paymentStatus: "PENDING",
        gatewayStatus: "UTR_SUBMITTED",
      };
    }

    const updatedPayment = await tx.payment.update({
      where: { id: freshPayment.id },
      data: {
        providerMetadata: updatedMeta,
      },
    });

    return {
      alreadyPaid: false,
      newlyPaid: false,
      order: freshOrder,
      payment: updatedPayment,
      paymentStatus: normalized.paymentStatus,
      gatewayStatus: normalized.gatewayStatus,
    };
  });

  if (!txResult.alreadyPaid) {
    recordTwmStatusMetric(txResult.gatewayStatus);
  }

  if (txResult.newlyPaid) {
    if (txResult.order.tableSessionId) {
      try {
        await completeSessionAndReleaseTable({
          prisma,
          tableSessionId: txResult.order.tableSessionId,
          orderId: txResult.order.id,
          paymentMode: "ONLINE",
          realtime,
        });
      } catch (sessionErr) {
        console.warn("[TwmPay] Table session completion notice:", sessionErr.message);
      }
    }

    emitPaymentUpdatedRealtime({
      realtime,
      restaurantId: txResult.order.restaurantId,
      orderId: txResult.order.id,
      paymentStatus: "PAID",
      gatewayStatus: "PAID",
      paymentMode: "ONLINE",
      transactionId: txResult.payment.transactionId,
    });
  } else if (txResult.gatewayStatus === "UTR_SUBMITTED") {
    emitPaymentUpdatedRealtime({
      realtime,
      restaurantId: txResult.order.restaurantId,
      orderId: txResult.order.id,
      paymentStatus: "PENDING",
      gatewayStatus: "UTR_SUBMITTED",
      paymentMode: "ONLINE",
      transactionId: txResult.payment.transactionId,
    });
  }

  return txResult;
};

const formatVerificationResponse = ({ txResult, message, orderIdInput = null }) => {
  const { order, payment, paymentStatus, gatewayStatus, alreadyPaid } = txResult;
  const meta = payment?.providerMetadata && typeof payment.providerMetadata === "object" ? payment.providerMetadata : {};

  const statusMap = {
    PAID: "SUCCESS",
    PENDING: "PENDING",
    FAILED: "FAILED",
  };

  const resolvedMessage = message || normalizeTwmStatus(gatewayStatus || "").message;

  return {
    verified: paymentStatus === "PAID",
    success: paymentStatus === "PAID",
    alreadyPaid: Boolean(alreadyPaid),
    status: statusMap[paymentStatus] || "UNKNOWN",
    paymentStatus,
    gatewayStatus: gatewayStatus || meta.gatewayStatus || paymentStatus,
    provider: "TWM_PAY",
    paymentMethod: order.paymentMode || payment?.paymentMethod || "ONLINE",
    orderId: String(order.id),
    orderNumber: order.orderNo || String(order.id),
    orderNo: order.orderNo || String(order.id),
    orderRef: payment?.providerOrderId || orderIdInput || null,
    twmOrderRef: payment?.providerOrderId || null,
    transactionId: payment?.transactionId || meta.txn || null,
    amount: round2(Number(order.total || payment?.amount || 0)),
    amountPaise: payment?.amountSubunit || getAuthoritativeOrderPaise(order, payment),
    paidAt: paymentStatus === "PAID" ? (meta.paidAt || order?.paidAt || payment?.updatedAt || null) : null,
    restaurantId: order.restaurantId,
    slug: order.restaurant?.slug || null,
    restaurantSlug: order.restaurant?.slug || null,
    message: resolvedMessage,
    ...(paymentStatus === "FAILED" ? { reason: resolvedMessage } : {}),
  };
};

export const processTwmPayReturn = async ({
  prisma,
  payload,
  restaurantId = null,
  slug = null,
  realtime = null,
  fetchImpl,
}) => {
  const input = payload || {};
  const orderRef = String(input.order_ref || input.orderRef || "").trim();
  const orderIdHint = String(input.orderId || input.order_id || "").trim();

  // Case 1: Return carries TWM signed payload (standard TWM redirect query params)
  if (input.signature !== undefined || input.status !== undefined || input.amount_paise !== undefined) {
    if (!verifyTwmSignature(input)) {
      const err = new Error("Invalid payment signature");
      err.statusCode = 400;
      err.code = "INVALID_SIGNATURE";
      throw err;
    }

    const { order, payment } = await resolveOrderAndTwmPayment(prisma, {
      orderId: orderIdHint,
      orderRef,
    });

    if (!order || !payment) {
      const err = new Error("TWM Pay payment record not found");
      err.statusCode = 404;
      err.code = "PAYMENT_NOT_FOUND";
      throw err;
    }

    enforceTenantBoundary({ order, restaurantId, slug });

    const normalized = normalizeTwmStatus(input.status);
    const txResult = await applyVerifiedTwmOutcome({
      prisma,
      order,
      payment,
      normalized,
      amountPaise: input.amount_paise,
      txn: input.txn,
      source: "RETURN",
      rawPayload: input,
      realtime,
    });

    return formatVerificationResponse({
      txResult,
      message:
        txResult.gatewayStatus === normalized.gatewayStatus && !txResult.alreadyPaid
          ? normalized.message
          : undefined,
    });
  }

  // Case 2: No signed params supplied (e.g. manual status check after app switch) -> reconcile server-side
  return reconcileTwmPayOrderStatus({
    prisma,
    orderId: orderIdHint,
    orderRef,
    restaurantId,
    slug,
    realtime,
    fetchImpl,
  });
};

export const processTwmPayNotify = async ({
  prisma,
  payload,
  realtime = null,
}) => {
  recordTwmNotificationMetric("received");
  const input = payload || {};

  if (!verifyTwmSignature(input)) {
    recordTwmNotificationMetric("rejected");
    const err = new Error("Invalid TWM Pay notification signature");
    err.statusCode = 400;
    err.code = "INVALID_SIGNATURE";
    throw err;
  }

  const orderRef = String(input.order_ref || "").trim();
  const { order, payment } = await resolveOrderAndTwmPayment(prisma, { orderRef });

  if (!order || !payment) {
    const err = new Error(`Unknown TWM Pay order reference: ${orderRef}`);
    err.statusCode = 404;
    err.code = "PAYMENT_NOT_FOUND";
    throw err;
  }

  const normalized = normalizeTwmStatus(input.status);
  const txResult = await applyVerifiedTwmOutcome({
    prisma,
    order,
    payment,
    normalized,
    amountPaise: input.amount_paise,
    txn: input.txn,
    source: "NOTIFY_WEBHOOK",
    rawPayload: input,
    realtime,
  });

  recordTwmNotificationMetric("verified");
  return formatVerificationResponse({
    txResult,
    message:
      txResult.gatewayStatus === normalized.gatewayStatus && !txResult.alreadyPaid
        ? normalized.message
        : undefined,
  });
};

export const reconcileTwmPayOrderStatus = async ({
  prisma,
  orderId = null,
  orderRef = null,
  restaurantId = null,
  slug = null,
  realtime = null,
  fetchImpl,
}) => {
  const { order, payment } = await resolveOrderAndTwmPayment(prisma, { orderId, orderRef });
  if (!order) {
    const err = new Error(`Order ${orderId || orderRef} not found`);
    err.statusCode = 404;
    err.code = "ORDER_NOT_FOUND";
    throw err;
  }

  enforceTenantBoundary({ order, restaurantId, slug });

  if (order.paymentStatus === "PAID" || order.status === "PAID" || order.status === "COMPLETED") {
    return formatVerificationResponse({
      txResult: {
        alreadyPaid: true,
        newlyPaid: false,
        order,
        payment: payment || {},
        paymentStatus: "PAID",
        gatewayStatus: "PAID",
      },
      message: "Order is already verified and paid",
      orderIdInput: orderId,
    });
  }

  if (!payment || payment.provider !== "TWM_PAY" || !payment.providerOrderId) {
    const err = new Error("No TWM Pay session found for this order");
    err.statusCode = 404;
    err.code = "PAYMENT_SESSION_NOT_FOUND";
    throw err;
  }

  const remote = await fetchTwmOrderStatus(payment.providerOrderId, { fetchImpl });

  const txResult = await applyVerifiedTwmOutcome({
    prisma,
    order,
    payment,
    normalized: remote.normalized,
    amountPaise: remote.amountPaise,
    txn: remote.txn,
    source: "ORDER_STATUS_API",
    rawPayload: remote.raw,
    realtime,
  });

  return formatVerificationResponse({
    txResult,
    message:
      txResult.gatewayStatus === remote.normalized.gatewayStatus && !txResult.alreadyPaid
        ? remote.normalized.message
        : undefined,
    orderIdInput: orderId,
  });
};

export const getAvailablePaymentProviders = () => {
  const twmCfg = getTwmPayConfig();
  const cashfreeConfigured = Boolean(initCashfree().isConfigured);

  const providers = [];
  if (twmCfg.isConfigured) {
    providers.push({
      id: "TWM_PAY",
      label: "TWM Pay (UPI / QR / Online)",
      checkoutType: "HOSTED_REDIRECT",
      configured: true,
    });
  }
  if (cashfreeConfigured) {
    providers.push({
      id: "CASHFREE",
      label: "Cashfree Online",
      checkoutType: "SDK",
      configured: true,
    });
  }

  const defaultProvider = twmCfg.isConfigured
    ? "TWM_PAY"
    : cashfreeConfigured
    ? "CASHFREE"
    : "TWM_PAY";

  return {
    defaultProvider,
    twmPay: {
      id: "TWM_PAY",
      enabled: twmCfg.enabled,
      configured: twmCfg.isConfigured,
      label: "TWM Pay (UPI / QR / Online)",
      checkoutType: "HOSTED_REDIRECT",
    },
    cashfree: {
      id: "CASHFREE",
      enabled: true,
      configured: cashfreeConfigured,
      label: "Cashfree Online",
      checkoutType: "SDK",
    },
    providers,
  };
};
