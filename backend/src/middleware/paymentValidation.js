/**
 * Middleware / Validation helper for payment endpoints
 */
export const normalizePaymentProvider = (rawProvider) => {
  const upper = String(rawProvider || "").trim().toUpperCase();
  if (!upper) return "CASHFREE";
  if (upper === "TWM" || upper === "TWM_PAY" || upper === "TWMPAY") return "TWM_PAY";
  return upper;
};

export const validateCreateOrderPayload = (body) => {
  const errors = [];
  const payload = body || {};

  const orderId = String(payload.orderId || payload.order_id || "").trim();
  const provider = normalizePaymentProvider(payload.provider || payload.gateway);
  const rawAmount = payload.amount;
  const amount = rawAmount === undefined || rawAmount === null || rawAmount === "" ? null : Number(rawAmount);
  const customerId = payload.customerId ?? payload.customer_id;
  const restaurantId = payload.restaurantId ?? payload.restaurant_id;

  if (!orderId) {
    errors.push("orderId is required");
  }

  // For Cashfree legacy callers, amount remains required; for TWM Pay, backend always computes authoritative DB total
  if (provider !== "TWM_PAY") {
    if (rawAmount === undefined || rawAmount === null || Number.isNaN(amount)) {
      errors.push("amount is required and must be a valid number");
    } else if (amount <= 0) {
      errors.push("amount must be greater than 0");
    }
  } else if (amount !== null && (Number.isNaN(amount) || !Number.isFinite(amount) || amount <= 0)) {
    errors.push("amount must be a valid positive number when provided");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      orderId,
      provider,
      amount: amount !== null ? amount : 0,
      hasExplicitAmount: amount !== null,
      customerId: customerId !== undefined && customerId !== null ? String(customerId).trim() : null,
      restaurantId: restaurantId !== undefined && restaurantId !== null ? String(restaurantId).trim() : null,
      customerPhone: payload.customerPhone || payload.phone || null,
      customerName: payload.customerName || payload.name || null,
      customerEmail: payload.customerEmail || payload.email || null,
      returnUrl: payload.returnUrl || payload.return_url || null,
      description: payload.description ? String(payload.description).trim() : null,
      idempotencyKey: payload.idempotencyKey || payload.idempotency_key || null,
      forceNewSession: Boolean(payload.forceNewSession),
    },
  };
};
