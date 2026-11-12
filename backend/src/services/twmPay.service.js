import crypto from "crypto";
import { assertTwmPayConfigured, getTwmPayConfig } from "../config/twmPay.config.js";

/**
 * TWM Pay Service Layer
 * Implements documented TWM Pay HTTP API & HMAC-SHA256 verification:
 *   - POST /api/create-order.php
 *   - GET  /api/order-status.php?order_ref=...
 *   - Signature formula: HMAC-SHA256 hex of `${order_ref}|${status}|${amount_paise}|${txn}`
 */

const twmMetrics = {
  ordersCreated: 0,
  ordersPaid: 0,
  ordersUtrSubmitted: 0,
  ordersRejected: 0,
  ordersExpired: 0,
  notificationsReceived: 0,
  notificationsVerified: 0,
  notificationsRejected: 0,
  reconciliations: 0,
  errors: 0,
  lastError: null,
  startedAt: Date.now(),
};

export const toPaise = (amountRupees) => {
  const num = Number(amountRupees);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("Invalid payment amount: must be a positive finite number");
  }
  const paise = Math.round(num * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new Error("Invalid payment amount in paise");
  }
  return paise;
};

export const fromPaise = (amountPaise) => {
  const paise = Number(amountPaise);
  if (!Number.isFinite(paise) || paise < 0) return 0;
  return Number((paise / 100).toFixed(2));
};

export const computeTwmSignature = (
  { order_ref, status, amount_paise, txn },
  signingKeyOverride = null
) => {
  const signingKey = signingKeyOverride ?? getTwmPayConfig().signingKey;
  if (!signingKey) {
    throw new Error("TWM_SIGNING_KEY is required to compute signature");
  }
  const canonical = `${String(order_ref)}|${String(status)}|${String(amount_paise)}|${String(txn ?? "")}`;
  return crypto.createHmac("sha256", signingKey).update(canonical).digest("hex");
};

export const verifyTwmSignature = (payload, signingKeyOverride = null) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const requiredKeys = ["order_ref", "status", "amount_paise", "txn", "signature"];
  for (const key of requiredKeys) {
    if (payload[key] === undefined || payload[key] === null) {
      return false;
    }
  }

  const orderRef = String(payload.order_ref).trim();
  const status = String(payload.status).trim();
  const amountPaiseRaw = payload.amount_paise;
  const amountPaiseNum = Number(amountPaiseRaw);
  const txn = String(payload.txn);
  const signature = String(payload.signature).trim().toLowerCase();

  if (!orderRef || !status || !signature) {
    return false;
  }
  if (!Number.isSafeInteger(amountPaiseNum) || amountPaiseNum <= 0) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }

  const signingKey = signingKeyOverride ?? getTwmPayConfig().signingKey;
  if (!signingKey) {
    return false;
  }

  const expected = computeTwmSignature(
    {
      order_ref: orderRef,
      status,
      amount_paise: String(amountPaiseRaw),
      txn,
    },
    signingKey
  ).toLowerCase();

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export const normalizeTwmStatus = (rawStatus) => {
  const normalized = String(rawStatus || "").trim().toLowerCase();
  switch (normalized) {
    case "paid":
      return {
        rawStatus: "paid",
        paymentStatus: "PAID",
        gatewayStatus: "PAID",
        isPaid: true,
        isPending: false,
        isFinal: true,
        message: "Payment completed and verified via TWM Pay.",
      };
    case "utr_submitted":
      return {
        rawStatus: "utr_submitted",
        paymentStatus: "PENDING",
        gatewayStatus: "UTR_SUBMITTED",
        isPaid: false,
        isPending: true,
        isFinal: false,
        message: "UPI payment reference submitted. Verification is in progress.",
      };
    case "created":
      return {
        rawStatus: "created",
        paymentStatus: "PENDING",
        gatewayStatus: "CREATED",
        isPaid: false,
        isPending: true,
        isFinal: false,
        message: "Checkout session initiated. Awaiting payment completion.",
      };
    case "rejected":
      return {
        rawStatus: "rejected",
        paymentStatus: "FAILED",
        gatewayStatus: "REJECTED",
        isPaid: false,
        isPending: false,
        isFinal: true,
        message: "Payment was rejected or could not be verified.",
      };
    case "expired":
      return {
        rawStatus: "expired",
        paymentStatus: "FAILED",
        gatewayStatus: "EXPIRED",
        isPaid: false,
        isPending: false,
        isFinal: true,
        message: "Payment session expired before completion.",
      };
    default:
      return {
        rawStatus: normalized || "unknown",
        paymentStatus: "UNKNOWN",
        gatewayStatus: normalized ? normalized.toUpperCase() : "UNKNOWN",
        isPaid: false,
        isPending: false,
        isFinal: false,
        message: "Unrecognized payment state from gateway.",
      };
  }
};

const fetchWithTimeout = async (url, options, timeoutMs, fetchImpl = globalThis.fetch) => {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch API unavailable in runtime");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const safeParseJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const createTwmPaymentOrder = async (
  {
    orderRef,
    amountPaise,
    returnUrl,
    notifyUrl,
    customerName = "",
    customerEmail = "",
    customerPhone = "",
    description = "",
  },
  { fetchImpl } = {}
) => {
  const cfg = assertTwmPayConfigured();
  const cleanOrderRef = String(orderRef || "").trim();
  const paise = Number(amountPaise);

  if (!cleanOrderRef) {
    throw new Error("order_ref is required for TWM Pay order creation");
  }
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new Error("amount_paise must be a positive integer");
  }
  if (!returnUrl || !/^https?:\/\//i.test(String(returnUrl))) {
    throw new Error("Valid return_url (http/https) is required for TWM Pay");
  }
  if (!notifyUrl || !/^https?:\/\//i.test(String(notifyUrl))) {
    throw new Error("Valid notify_url (http/https) is required for TWM Pay");
  }

  const endpoint = `${cfg.baseUrl}/api/create-order.php`;
  const payload = {
    order_ref: cleanOrderRef,
    amount_paise: paise,
    return_url: String(returnUrl),
    notify_url: String(notifyUrl),
    customer_name: String(customerName || "Customer").slice(0, 100),
    customer_email: String(customerEmail || "").slice(0, 120),
    customer_phone: String(customerPhone || "").slice(0, 30),
    description: String(description || `Order ${cleanOrderRef}`).slice(0, 200),
  };

  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TWM-Merchant": cfg.merchantId,
          "X-TWM-Secret": cfg.apiSecret,
        },
        body: JSON.stringify(payload),
      },
      cfg.requestTimeoutMs,
      fetchImpl
    );
  } catch (err) {
    twmMetrics.errors += 1;
    twmMetrics.lastError = {
      message: err?.name === "AbortError" ? "TWM Pay create-order request timed out" : err.message,
      at: new Date().toISOString(),
    };
    const wrapped = new Error(
      err?.name === "AbortError"
        ? "TWM Pay gateway timed out while creating checkout session"
        : `TWM Pay connection error: ${err.message}`
    );
    wrapped.statusCode = 502;
    throw wrapped;
  }

  const data = await safeParseJson(response);

  if (!response.ok || !data?.checkout_url) {
    const gatewayMsg = data?.error || data?.message || `HTTP ${response.status}`;
    twmMetrics.errors += 1;
    twmMetrics.lastError = { message: String(gatewayMsg), at: new Date().toISOString() };
    const err = new Error(`TWM Pay create-order failed: ${gatewayMsg}`);
    err.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    err.gatewayResponse = data;
    throw err;
  }

  const checkoutUrl = String(data.checkout_url).trim();
  if (!/^https?:\/\//i.test(checkoutUrl)) {
    throw new Error("TWM Pay returned an invalid checkout_url");
  }

  twmMetrics.ordersCreated += 1;
  return {
    orderRef: String(data.order_ref || cleanOrderRef),
    amountPaise: Number(data.amount_paise || paise),
    checkoutUrl,
    raw: data,
  };
};

export const fetchTwmOrderStatus = async (orderRef, { fetchImpl } = {}) => {
  const cfg = assertTwmPayConfigured();
  const cleanOrderRef = String(orderRef || "").trim();
  if (!cleanOrderRef) {
    throw new Error("order_ref is required to check TWM Pay status");
  }

  const endpoint = `${cfg.baseUrl}/api/order-status.php?order_ref=${encodeURIComponent(cleanOrderRef)}`;

  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: "GET",
        headers: {
          "X-TWM-Merchant": cfg.merchantId,
          "X-TWM-Secret": cfg.apiSecret,
        },
      },
      cfg.requestTimeoutMs,
      fetchImpl
    );
  } catch (err) {
    twmMetrics.errors += 1;
    twmMetrics.lastError = {
      message: err?.name === "AbortError" ? "TWM Pay order-status request timed out" : err.message,
      at: new Date().toISOString(),
    };
    const wrapped = new Error(
      err?.name === "AbortError"
        ? "TWM Pay gateway timed out while fetching payment status"
        : `TWM Pay status connection error: ${err.message}`
    );
    wrapped.statusCode = 502;
    throw wrapped;
  }

  const data = await safeParseJson(response);

  if (!response.ok) {
    const gatewayMsg = data?.error || data?.message || `HTTP ${response.status}`;
    twmMetrics.errors += 1;
    twmMetrics.lastError = { message: String(gatewayMsg), at: new Date().toISOString() };
    const err = new Error(`TWM Pay status lookup failed: ${gatewayMsg}`);
    err.statusCode = response.status === 404 ? 404 : response.status >= 400 && response.status < 500 ? response.status : 502;
    err.gatewayResponse = data;
    throw err;
  }

  twmMetrics.reconciliations += 1;
  const normalized = normalizeTwmStatus(data.status);

  return {
    orderRef: String(data.order_ref || cleanOrderRef),
    amountPaise: data.amount_paise !== undefined && data.amount_paise !== null ? Number(data.amount_paise) : null,
    txn: data.txn !== undefined && data.txn !== null ? String(data.txn) : null,
    normalized,
    raw: data,
  };
};

export const recordTwmNotificationMetric = (outcome) => {
  twmMetrics.notificationsReceived += 1;
  if (outcome === "verified") twmMetrics.notificationsVerified += 1;
  else if (outcome === "rejected") twmMetrics.notificationsRejected += 1;
};

export const recordTwmStatusMetric = (gatewayStatus) => {
  switch (String(gatewayStatus || "").toUpperCase()) {
    case "PAID":
      twmMetrics.ordersPaid += 1;
      break;
    case "UTR_SUBMITTED":
      twmMetrics.ordersUtrSubmitted += 1;
      break;
    case "REJECTED":
      twmMetrics.ordersRejected += 1;
      break;
    case "EXPIRED":
      twmMetrics.ordersExpired += 1;
      break;
    default:
      break;
  }
};

export const getTwmPayMetrics = () => {
  const cfg = getTwmPayConfig();
  return {
    enabled: cfg.enabled,
    isConfigured: cfg.isConfigured,
    baseUrl: cfg.baseUrl,
    merchantIdMasked: cfg.merchantIdMasked,
    ordersCreated: twmMetrics.ordersCreated,
    ordersPaid: twmMetrics.ordersPaid,
    ordersUtrSubmitted: twmMetrics.ordersUtrSubmitted,
    ordersRejected: twmMetrics.ordersRejected,
    ordersExpired: twmMetrics.ordersExpired,
    notificationsReceived: twmMetrics.notificationsReceived,
    notificationsVerified: twmMetrics.notificationsVerified,
    notificationsRejected: twmMetrics.notificationsRejected,
    reconciliations: twmMetrics.reconciliations,
    errors: twmMetrics.errors,
    lastError: twmMetrics.lastError,
    uptimeSeconds: Math.floor((Date.now() - twmMetrics.startedAt) / 1000),
  };
};
