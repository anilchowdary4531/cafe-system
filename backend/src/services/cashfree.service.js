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
