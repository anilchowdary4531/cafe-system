/**
 * Middleware / Validation helper for payment endpoints
 */
export const validateCreateOrderPayload = (body) => {
  const errors = [];
  const payload = body || {};

  const orderId = String(payload.orderId || payload.order_id || "").trim();
  const amount = Number(payload.amount);
  const customerId = payload.customerId ?? payload.customer_id;
  const restaurantId = payload.restaurantId ?? payload.restaurant_id;

  if (!orderId) {
    errors.push("orderId is required");
  }

  if (payload.amount === undefined || payload.amount === null || Number.isNaN(amount)) {
    errors.push("amount is required and must be a valid number");
  } else if (amount <= 0) {
    errors.push("amount must be greater than 0");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      orderId,
      amount,
      customerId: customerId !== undefined && customerId !== null ? String(customerId).trim() : null,
      restaurantId: restaurantId !== undefined && restaurantId !== null ? String(restaurantId).trim() : null,
      customerPhone: payload.customerPhone || payload.phone || null,
      customerName: payload.customerName || payload.name || null,
      customerEmail: payload.customerEmail || payload.email || null,
      returnUrl: payload.returnUrl || payload.return_url || null,
    },
  };
};
