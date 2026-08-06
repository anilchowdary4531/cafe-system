import crypto from "node:crypto";
import { getCashfreeInstance, CASHFREE_API_VERSION } from "../config/cashfree.config.js";

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
}) => {
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

  const defaultReturnUrl = returnUrl || `${process.env.FRONTEND_URL || "https://www.tiffzy.com"}/payment-status?order_id={order_id}`;

  const orderPayload = {
    order_amount: Math.round(numericAmount * 100) / 100, // Format to 2 decimal places
    order_currency: "INR",
    order_id: formattedOrderId,
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

  try {
    const response = await cashfree.PGCreateOrder(CASHFREE_API_VERSION, orderPayload);
    const data = response?.data || response;

    if (!data?.payment_session_id) {
      throw new Error(data?.message || "Cashfree did not return a valid payment_session_id");
    }

    return {
      payment_session_id: data.payment_session_id,
      order_id: data.order_id || formattedOrderId,
      cf_order_id: data.cf_order_id || null,
      order_status: data.order_status || "ACTIVE",
    };
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err?.message || "Cashfree PG order creation failed";
    console.error("[CashfreeService] Error creating order session:", errorMsg, err?.response?.data || err);
    throw new Error(errorMsg);
  }
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

  try {
    // 1. Fetch Order Details from Cashfree
    const orderResponse = await cashfree.PGFetchOrder(CASHFREE_API_VERSION, formattedOrderId);
    const orderData = orderResponse?.data || orderResponse;

    const orderStatus = String(orderData?.order_status || "UNKNOWN").toUpperCase();
    const orderAmount = Number(orderData?.order_amount || 0);
    const cfOrderId = orderData?.cf_order_id || null;

    let paymentId = null;
    let paymentMethod = null;
    let txMsg = null;

    // 2. Optionally fetch payment transactions for this order
    try {
      const paymentsResponse = await cashfree.PGOrderFetchPayments(CASHFREE_API_VERSION, formattedOrderId);
      const payments = paymentsResponse?.data || paymentsResponse;
      if (Array.isArray(payments) && payments.length > 0) {
        const latestPayment = payments[0];
        paymentId = latestPayment?.cf_payment_id ? String(latestPayment.cf_payment_id) : null;
        paymentMethod = latestPayment?.payment_group || latestPayment?.payment_method || null;
        txMsg = latestPayment?.payment_message || null;
      }
    } catch (payErr) {
      console.warn("[CashfreeService] Warning fetching payments for order:", payErr.message);
    }

    const isPaid = orderStatus === "PAID" || orderStatus === "SUCCESS";

    return {
      verified: true,
      isPaid,
      orderStatus, // PAID, ACTIVE, EXPIRED, FAILED, CANCELLED
      orderAmount,
      orderId: formattedOrderId,
      cfOrderId,
      paymentId,
      paymentMethod,
      txMsg: txMsg || (isPaid ? "Payment Verified Successfully" : `Order status: ${orderStatus}`),
    };
  } catch (err) {
    const errorMsg = err?.response?.data?.message || err?.message || "Failed to verify order with Cashfree";
    console.error("[CashfreeService] Error verifying order:", errorMsg);
    throw new Error(errorMsg);
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


