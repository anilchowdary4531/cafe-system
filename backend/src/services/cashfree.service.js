import crypto from "node:crypto";
import { getCashfreeInstance, CASHFREE_API_VERSION, initCashfree } from "../config/cashfree.config.js";

const round2 = (num) => Math.round(Number(num || 0) * 100) / 100;

// Production Telemetry & Monitoring Metrics
const paymentMetrics = {
  ordersCreated: 0,
  paymentsVerified: 0,
  paymentsFailed: 0,
  webhooksReceived: 0,
  webhooksVerified: 0,
  startTime: new Date().toISOString(),
};

export const incrementMetric = (metricName) => {
  if (paymentMetrics[metricName] !== undefined) {
    paymentMetrics[metricName]++;
  }
};

export const getPaymentMetrics = () => {
  const config = initCashfree();
  return {
    ...paymentMetrics,
    uptimeSeconds: Math.floor((Date.now() - new Date(paymentMetrics.startTime).getTime()) / 1000),
    cashfreeEnv: config.env,
    isProduction: config.isProduction,
    isConfigured: config.isConfigured,
    clientIdMasked: config.clientIdMasked,
  };
};

/**
 * Service to interact with Cashfree Payment Gateway SDK
 */
export const createCashfreePaymentSession = async ({
  orderId,
  amount,
  customerId,
  customerPhone,
  customerName,
  customerEmail,
  returnUrl,
  vendorId,
  commissionType = "PERCENTAGE",
  commissionValue = 10,
  orderNote = "Have good food!",
}) => {
  const cfConfig = initCashfree();
  const cashfree = getCashfreeInstance();

  const formattedOrderId = String(orderId).trim();
  const numericAmount = Number(amount);

  if (!formattedOrderId) {
    throw new Error("orderId is required to generate payment session");
  }

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("amount must be a valid positive number");
  }

  // Format customer details safely
  const cleanCustomerId = customerId ? String(customerId).trim() : `cust_${Date.now()}`;
  let cleanPhone = String(customerPhone || "").replace(/[^\d]/g, "");
  if (!cleanPhone || cleanPhone.length < 10) {
    cleanPhone = "9999999999"; // Fallback placeholder phone if missing
  } else if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) {
    cleanPhone = cleanPhone.slice(2);
  }
  if (cleanPhone.length > 10) {
    cleanPhone = cleanPhone.slice(-10);
  }

  const cleanEmail = customerEmail && customerEmail.includes("@")
    ? customerEmail.trim().toLowerCase()
    : "customer@tiffzy.com";

  const cleanName = customerName && customerName.trim()
    ? customerName.trim()
    : "Tiffzy Customer";

  let rawReturnUrl = returnUrl || `${process.env.FRONTEND_URL || "https://www.tiffzy.com"}/payment-status?order_id={order_id}`;
  if (cfConfig.isProduction && rawReturnUrl.startsWith("http://")) {
    rawReturnUrl = rawReturnUrl.replace(/^http:\/\//, "https://");
  }
  const defaultReturnUrl = rawReturnUrl;

  const cleanOrderNote = String(orderNote || "Have good food!").trim();

  // Cashfree Easy Split Settlement Calculation
  // Business logic: e.g. Customer pays ₹500, Tiffzy receives ₹50, Restaurant receives ₹450
  const normalizedCommType = String(commissionType || "PERCENTAGE").toUpperCase();
  const commVal = Number(commissionValue !== undefined && commissionValue !== null ? commissionValue : 10);

  let tiffzyCommission = 0;
  if (normalizedCommType === "FIXED") {
    tiffzyCommission = round2(Math.min(numericAmount, commVal));
  } else {
    // Default: PERCENTAGE commission (e.g. 10%)
    tiffzyCommission = round2(numericAmount * (commVal / 100));
  }

  const restaurantShare = round2(Math.max(0, numericAmount - tiffzyCommission));

  const orderPayload = {
    order_amount: round2(numericAmount), // Format to 2 decimal places
    order_currency: "INR",
    order_id: formattedOrderId,
    order_note: cleanOrderNote || "Have good food!",
    customer_details: {
      customer_id: cleanCustomerId,
      customer_phone: cleanPhone,
      customer_name: cleanName,
      customer_email: cleanEmail,
    },
    order_meta: {
      return_url: defaultReturnUrl,
    },
  };

  // Configure Cashfree Easy Split if vendorId is provided
  const cleanVendorId = vendorId ? String(vendorId).trim() : null;
  if (cleanVendorId) {
    orderPayload.order_splits = [
      {
        vendor_id: cleanVendorId,
        amount: restaurantShare,
      },
    ];

    console.log(`[CashfreeService] Configured Easy Split for Order ${formattedOrderId}:`, {
      totalAmount: numericAmount,
      restaurantShare,
      tiffzyCommission,
      vendorId: cleanVendorId,
      commissionType: normalizedCommType,
      commissionValue: commVal,
    });
  }

  const baseUrl = cfConfig.isProduction
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  const headers = {
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": cfConfig.clientId,
    "x-client-secret": cfConfig.clientSecret,
    "Content-Type": "application/json",
  };

  try {
    let data;
    try {
      const response = await cashfree.PGCreateOrder(CASHFREE_API_VERSION, orderPayload);
      data = response?.data || response;
    } catch (sdkErr) {
      console.warn("[CashfreeService] SDK call warning, falling back to REST HTTP call...", sdkErr.message);
      let httpRes = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(orderPayload),
      });
      data = await httpRes.json();

      // If vendor is not registered in Cashfree Easy Split, retry without order_splits
      if (!data?.payment_session_id && data?.message && String(data.message).toLowerCase().includes("vendor")) {
        console.warn("[CashfreeService] Vendor not found on Cashfree. Retrying without order_splits...");
        const fallbackPayload = { ...orderPayload };
        delete fallbackPayload.order_splits;
        const retryRes = await fetch(`${baseUrl}/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(fallbackPayload),
        });
        data = await retryRes.json();
      }
    }

    if (!data?.payment_session_id) {
      throw new Error(data?.message || "Cashfree did not return a valid payment_session_id");
    }

    incrementMetric("ordersCreated");

    return {
      payment_session_id: data.payment_session_id,
      order_id: data.order_id || formattedOrderId,
      cf_order_id: data.cf_order_id || null,
      order_status: data.order_status || "ACTIVE",
      settlement: {
        totalAmount: round2(numericAmount),
        tiffzyCommission: round2(tiffzyCommission),
        restaurantShare: round2(restaurantShare),
        commissionType: normalizedCommType,
        commissionValue: commVal,
        vendorId: cleanVendorId,
      },
    };
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err?.message || "Cashfree PG order creation failed";
    console.error("[CashfreeService] Error creating order session:", errorMsg, err?.response?.data || err);
    throw new Error(errorMsg);
  }
};

/**
 * Helper to sanitize failure reasons into safe, user-friendly messages without leaking secrets
 */
export const sanitizeFailureReason = (rawMsg, rawStatus, rawCode) => {
  const msg = String(rawMsg || "").toLowerCase();
  const status = String(rawStatus || "").toUpperCase();

  if (status === "USER_DROPPED" || msg.includes("user dropped") || msg.includes("cancelled by user") || msg.includes("user_dropped")) {
    return "User cancelled payment";
  }
  if (status === "EXPIRED" || msg.includes("expired")) {
    return "Payment session expired";
  }
  if (msg.includes("declined") || msg.includes("bank") || msg.includes("issuer")) {
    return "Bank declined the transaction";
  }
  if (msg.includes("insufficient") || msg.includes("balance") || msg.includes("funds")) {
    return "Insufficient funds in bank account";
  }
  if (msg.includes("otp") || msg.includes("auth") || msg.includes("pin")) {
    return "Authentication / OTP verification failed";
  }
  if (rawMsg && typeof rawMsg === "string" && rawMsg.length < 80 && !rawMsg.includes("http") && !rawMsg.includes("Key")) {
    return rawMsg.trim();
  }
  return "Payment could not be completed. Please try again.";
};

/**
 * Directly query Cashfree PG API to verify payment status of an order
 */
export const verifyCashfreeOrderSession = async ({ orderId }) => {
  const cashfree = getCashfreeInstance();
  const formattedOrderId = String(orderId || "").trim();

  if (!formattedOrderId) {
    throw new Error("orderId is required for Cashfree verification");
  }

  const cfConfig = initCashfree();
  const baseUrl = cfConfig.isProduction
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  const headers = {
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": cfConfig.clientId,
    "x-client-secret": cfConfig.clientSecret,
    "Content-Type": "application/json",
  };

  try {
    let orderData;
    try {
      const orderResponse = await cashfree.PGFetchOrder(CASHFREE_API_VERSION, formattedOrderId);
      orderData = orderResponse?.data || orderResponse;
    } catch (sdkErr) {
      console.warn("[CashfreeService] SDK PGFetchOrder warning, falling back to direct REST fetch...", sdkErr.message);
      const httpRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(formattedOrderId)}`, {
        method: "GET",
        headers,
      });
      orderData = await httpRes.json();
    }

    const orderStatus = String(orderData?.order_status || "UNKNOWN").toUpperCase();
    const orderAmount = Number(orderData?.order_amount || 0);
    const cfOrderId = orderData?.cf_order_id || null;

    let paymentId = null;
    let paymentMethod = null;
    let txMsg = null;
    let paymentStatus = null;
    let paymentCode = null;

    // Fetch payment transactions for this order
    try {
      let payments;
      try {
        const paymentsResponse = await cashfree.PGOrderFetchPayments(CASHFREE_API_VERSION, formattedOrderId);
        payments = paymentsResponse?.data || paymentsResponse;
      } catch {
        const httpRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(formattedOrderId)}/payments`, {
          method: "GET",
          headers,
        });
        payments = await httpRes.json();
      }

      if (Array.isArray(payments) && payments.length > 0) {
        const latestPayment = payments[0];
        paymentId = latestPayment?.cf_payment_id ? String(latestPayment.cf_payment_id) : null;
        paymentMethod = latestPayment?.payment_group || latestPayment?.payment_method || null;
        txMsg = latestPayment?.payment_message || null;
        paymentStatus = String(latestPayment?.payment_status || "").toUpperCase();
        paymentCode = latestPayment?.payment_completion_code || null;
      }
    } catch (payErr) {
      console.warn("[CashfreeService] Warning fetching payments for order:", payErr.message);
    }

    // Determine normalized status strictly from Cashfree response
    let normalizedStatus = "UNKNOWN";
    const isPaid = orderStatus === "PAID" || orderStatus === "SUCCESS" || paymentStatus === "SUCCESS";

    if (isPaid) {
      normalizedStatus = "SUCCESS";
    } else if (orderStatus === "USER_DROPPED" || paymentStatus === "USER_DROPPED" || paymentStatus === "CANCELLED") {
      normalizedStatus = "CANCELLED";
    } else if (orderStatus === "FAILED" || orderStatus === "EXPIRED" || orderStatus === "TERMINATED" || paymentStatus === "FAILED") {
      normalizedStatus = "FAILED";
    } else if (orderStatus === "ACTIVE" || orderStatus === "INITIALIZED" || paymentStatus === "PENDING") {
      normalizedStatus = "PENDING";
    }

    const failureReason = normalizedStatus !== "SUCCESS"
      ? sanitizeFailureReason(txMsg, paymentStatus || orderStatus, paymentCode)
      : null;

    console.log(`[CashfreeService] Server-side Cashfree verification for Order ${formattedOrderId}:`, {
      orderStatus,
      paymentStatus,
      normalizedStatus,
      orderAmount,
      isPaid,
      failureReason,
    });

    return {
      verified: true,
      isPaid,
      normalizedStatus, // SUCCESS | PENDING | FAILED | CANCELLED | UNKNOWN
      orderStatus,
      paymentStatus,
      orderAmount,
      orderId: formattedOrderId,
      cfOrderId,
      paymentId,
      paymentMethod,
      failureReason,
      txMsg: txMsg || (isPaid ? "Payment Verified Successfully" : failureReason || `Order status: ${orderStatus}`),
    };
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err?.message || "Failed to verify order with Cashfree";
    console.error("[CashfreeService] Error verifying order:", errorMsg);
    return {
      verified: false,
      isPaid: false,
      normalizedStatus: "UNKNOWN",
      orderStatus: "UNKNOWN",
      orderAmount: 0,
      orderId: formattedOrderId,
      failureReason: "Payment status could not be verified due to a network or server error",
      txMsg: errorMsg,
    };
  }
};

/**
 * Verify Cashfree Webhook Signature
 */
export const verifyCashfreeWebhookSignature = ({ signature, rawBody, timestamp }) => {
  if (!signature || !rawBody || !timestamp) {
    return false;
  }

  try {
    const cashfree = getCashfreeInstance();
    // 1. Try Cashfree SDK verification method if supported
    if (typeof cashfree.PGVerifyWebhookSignature === "function") {
      try {
        const isVerified = cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
        if (isVerified) return true;
      } catch (sdkErr) {
        // Fallback to crypto calculation
      }
    }

    // 2. Compute HMAC SHA-256 fallback verification
    const secret = String(process.env.CASHFREE_CLIENT_SECRET || "").trim();
    if (!secret) return false;

    const dataToSign = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(dataToSign)
      .digest("base64");

    return signature === expectedSignature;
  } catch (err) {
    console.error("[CashfreeService] Webhook signature verification error:", err.message);
    return false;
  }
};

/**
 * Initiate Refund via Cashfree PG API
 */
export const createCashfreeRefund = async ({ orderId, refundAmount, refundId, refundNote }) => {
  const cashfree = getCashfreeInstance();
  const formattedOrderId = String(orderId || "").trim();
  const numericRefundAmount = Number(refundAmount);

  if (!formattedOrderId) {
    throw new Error("orderId is required to initiate refund");
  }

  if (Number.isNaN(numericRefundAmount) || numericRefundAmount <= 0) {
    throw new Error("refundAmount must be a valid positive number");
  }

  const formattedRefundId = String(refundId || `ref_${formattedOrderId}_${Date.now()}`).trim();
  const formattedNote = String(refundNote || "Customer requested refund").trim();

  const refundPayload = {
    refund_amount: round2(numericRefundAmount),
    refund_id: formattedRefundId,
    refund_note: formattedNote,
    refund_speed: "STANDARD",
  };

  try {
    const response = await cashfree.PGOrderCreateRefund(CASHFREE_API_VERSION, formattedOrderId, refundPayload);
    const data = response?.data || response;

    console.log(`[CashfreeService] Refund initiated successfully for Order ${formattedOrderId}:`, {
      refundId: data?.refund_id || formattedRefundId,
      refundAmount: numericRefundAmount,
      status: data?.refund_status || "SUCCESS",
    });

    return {
      success: true,
      refundId: data?.refund_id || formattedRefundId,
      orderId: formattedOrderId,
      refundAmount: round2(numericRefundAmount),
      refundStatus: data?.refund_status || "SUCCESS",
      data,
    };
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err?.message || "Cashfree refund creation failed";
    console.error("[CashfreeService] Error creating refund:", errorMsg, err?.response?.data || err);
    throw new Error(errorMsg);
  }
};



