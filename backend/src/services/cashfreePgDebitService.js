/**
 * Cashfree PG Debit MID Service
 * Used specifically for Wallet Payment / REDEEM operation on orders
 */

import { getPgBaseUrl, getPgDebitHeaders, getProgramId } from "../config/cashfreePpi.config.js";

const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

/**
 * Create a Cashfree PG Order for Wallet REDEEM (Order Payment)
 */
export const createWalletRedeemPgOrder = async ({
  orderId,
  amount,
  customerId,
  customerName,
  customerEmail,
  customerPhone,
  cfUserId,
  cfSubWalletId,
  returnUrl,
}) => {
  const baseUrl = getPgBaseUrl();
  const headers = getPgDebitHeaders();
  const numAmount = round2(amount);

  const payload = {
    order_id: String(orderId),
    order_amount: numAmount,
    order_currency: "INR",
    customer_details: {
      customer_id: String(customerId || "cust_unknown"),
      customer_name: String(customerName || "Tiffzy Customer").trim(),
      customer_email: String(customerEmail || "customer@tiffzy.com").trim(),
      customer_phone: String(customerPhone || "9999999999").slice(-10),
    },
    order_meta: {
      return_url: returnUrl || `https://tiffzy.com/order/callback?order_id=${encodeURIComponent(orderId)}`,
    },
    wallet_details: {
      operation: "REDEEM",
      cf_user_id: String(cfUserId),
      cf_program_id: getProgramId(),
      sub_wallet_id: String(cfSubWalletId),
    },
  };

  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error_description || `Cashfree PG Debit API error ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return {
      cfOrderId: data.cf_order_id,
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id || orderId,
      orderAmount: round2(data.order_amount || numAmount),
      orderStatus: data.order_status || "ACTIVE",
      raw: data,
    };
  } catch (err) {
    console.error("[CashfreePgDebitService] Error creating wallet redeem PG order:", err.message);
    throw err;
  }
};
