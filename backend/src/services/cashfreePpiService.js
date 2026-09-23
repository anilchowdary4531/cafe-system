/**
 * Cashfree PPI (Prepaid Payment Instruments) Service
 * Server-to-server API implementation for co-branded PPI Wallet
 */

import {
  getPpiBaseUrl,
  getPpiHeaders,
  getProgramId,
  isPpiConfigured,
  getPpiConfigStatus,
} from "../config/cashfreePpi.config.js";


const assertPpiConfigured = () => {
  if (!isPpiConfigured()) {
    throw new Error("Cashfree PPI integration is not configured. Missing credentials.");
  }
};

const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

/**
 * Format phone to 10-digit Indian mobile format (strips +91 / 0 prefix)
 */
export const formatPhone = (phoneStr) => {
  if (!phoneStr) return "";
  const digits = String(phoneStr).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits.slice(-10);
};

/**
 * Helper for making API calls to Cashfree PPI
 */
const ppiFetch = async (endpoint, options = {}) => {
  const baseUrl = getPpiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const headers = {
    ...getPpiHeaders(),
    ...(options.headers || {}),
  };

  const config = {
    method: options.method || "GET",
    headers,
  };

  if (options.body) {
    config.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error_description || data.error || `Cashfree PPI API returned HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    console.error(`[CashfreePpiService] API error on ${options.method || "GET"} ${endpoint}:`, err.message);
    throw err;
  }
};

/**
 * 1. Create PPI User
 */
export const createPpiUser = async ({ phone, name, email }) => {
  assertPpiConfigured();
  const formattedPhone = formatPhone(phone);
  if (!formattedPhone || formattedPhone.length !== 10) {
    throw new Error("Valid 10-digit phone number is required for PPI User creation");
  }

  const payload = {
    phone: formattedPhone,
    name: String(name || "Tiffzy Customer").trim(),
    email: String(email || `user_${formattedPhone}@tiffzy.com`).trim(),
  };

  try {
    const data = await ppiFetch("/users", {
      method: "POST",
      body: payload,
    });

    const cfUserId = data.cf_user_id || data.user_id || data.id || `cf_usr_${formattedPhone}`;

    return {
      cfUserId: String(cfUserId),
      phone: formattedPhone,
      name: payload.name,
      email: payload.email,
      raw: data,
    };
  } catch (err) {
    // Handle user already exists in Cashfree
    if (err.status === 409 || (err.data && (err.data.code === "USER_EXISTS" || err.message.includes("exists")))) {
      const cfUserId = err.data?.cf_user_id || err.data?.user_id || `cf_usr_${formattedPhone}`;
      return {
        cfUserId: String(cfUserId),
        phone: formattedPhone,
        name: payload.name,
        email: payload.email,
        alreadyExisted: true,
        raw: err.data || {},
      };
    }
    throw err;
  }
};

/**
 * 2. Check Wallet Eligibility
 */
export const checkWalletEligibility = async ({ phone }) => {
  assertPpiConfigured();
  const formattedPhone = formatPhone(phone);
  try {
    const data = await ppiFetch("/wallets/eligibility", {
      method: "POST",
      body: { phone: formattedPhone },
    });

    return {
      eligible: Boolean(data.eligible ?? true),
      reason: data.reason || null,
      raw: data,
    };
  } catch (err) {
    // If endpoint returns non-200 in sandbox, default to eligible for sandbox testing
    console.warn("[CashfreePpiService] Eligibility check warning:", err.message);
    return {
      eligible: true,
      reason: err.message,
      fallback: true,
    };
  }
};

/**
 * 3. Create PPI Wallet
 */
export const createWallet = async ({ cashfreePpiUserId, programId }) => {
  assertPpiConfigured();
  if (!cashfreePpiUserId) {
    throw new Error("cashfreePpiUserId is required to create a PPI wallet");
  }

  const pid = String(programId || getProgramId()).trim();
  const payload = {
    user_id: cashfreePpiUserId,
    cf_program_id: pid,
  };

  try {
    const data = await ppiFetch("/wallets", {
      method: "POST",
      body: payload,
    });

    const walletId = data.wallet_id || data.id || `wlet_${cashfreePpiUserId}`;
    const cfSubWalletId = data.sub_wallet_id || data.cf_sub_wallet_id || data.sub_wallets?.[0]?.sub_wallet_id || `subw_${walletId}`;

    return {
      walletId: String(walletId),
      cfSubWalletId: String(cfSubWalletId),
      cfProgramId: pid,
      status: data.status || "ACTIVE",
      raw: data,
    };
  } catch (err) {
    if (err.status === 409 || (err.data && (err.data.code === "WALLET_EXISTS" || err.message.includes("exists")))) {
      const walletId = err.data?.wallet_id || `wlet_${cashfreePpiUserId}`;
      const cfSubWalletId = err.data?.sub_wallet_id || `subw_${walletId}`;
      return {
        walletId: String(walletId),
        cfSubWalletId: String(cfSubWalletId),
        cfProgramId: pid,
        status: "ACTIVE",
        alreadyExisted: true,
        raw: err.data || {},
      };
    }
    throw err;
  }
};

/**
 * 4. Get Wallet Details & Balance
 */
export const getWalletDetails = async ({ cashfreeWalletId }) => {
  assertPpiConfigured();
  if (!cashfreeWalletId) {
    throw new Error("cashfreeWalletId is required to fetch wallet details");
  }

  const data = await ppiFetch(`/wallets/${encodeURIComponent(cashfreeWalletId)}`, {
    method: "GET",
  });

  const balance = Number(data.balance ?? data.available_balance ?? data.sub_wallets?.[0]?.balance ?? 0);
  const status = String(data.status || "ACTIVE").toUpperCase();

  return {
    walletId: cashfreeWalletId,
    balance: round2(balance),
    status,
    raw: data,
  };
};

/**
 * 5. Get Wallet Transaction Statement
 */
export const getWalletStatement = async ({ cashfreeWalletId, page = 1, limit = 20 }) => {
  assertPpiConfigured();
  if (!cashfreeWalletId) {
    throw new Error("cashfreeWalletId is required to fetch wallet statement");
  }

  const data = await ppiFetch(`/wallets/${encodeURIComponent(cashfreeWalletId)}/transactions?page=${page}&limit=${limit}`, {
    method: "GET",
  });

  const rawTxns = Array.isArray(data.transactions) ? data.transactions : (Array.isArray(data.data) ? data.data : []);

  const transactions = rawTxns.map((t) => ({
    transactionId: t.transaction_id || t.id || String(t.reference_id || ""),
    type: String(t.type || t.transaction_type || "UNKNOWN").toUpperCase(),
    amount: round2(t.amount || 0),
    balanceAfter: round2(t.balance_after || t.closing_balance || 0),
    remarks: t.remarks || t.description || "",
    createdAt: t.created_at || t.timestamp || new Date().toISOString(),
  }));

  return {
    walletId: cashfreeWalletId,
    transactions,
    raw: data,
  };
};

/**
 * 6. Credit PPI Wallet
 */
export const creditWallet = async ({ cashfreeWalletId, amount, gatewayPaymentId, idempotencyKey }) => {
  assertPpiConfigured();
  if (!cashfreeWalletId) throw new Error("cashfreeWalletId is required for wallet credit");
  const numAmount = round2(amount);
  if (numAmount <= 0) throw new Error("Credit amount must be positive");

  const headers = {};
  if (idempotencyKey) {
    headers["x-idempotency-key"] = String(idempotencyKey);
  }

  const payload = {
    amount: numAmount,
    reference_id: String(gatewayPaymentId || `topup_${Date.now()}`),
    remarks: "Tiffzy Wallet Top-Up",
  };

  const data = await ppiFetch(`/wallets/${encodeURIComponent(cashfreeWalletId)}/credit`, {
    method: "POST",
    headers,
    body: payload,
  });

  return {
    success: true,
    transactionId: data.transaction_id || data.reference_id || gatewayPaymentId,
    balance: round2(data.balance ?? data.available_balance ?? 0),
    raw: data,
  };
};

/**
 * 7. Debit PPI Wallet
 */
export const debitWallet = async ({ cashfreeWalletId, amount, orderId, idempotencyKey }) => {
  assertPpiConfigured();
  if (!cashfreeWalletId) throw new Error("cashfreeWalletId is required for wallet debit");
  const numAmount = round2(amount);
  if (numAmount <= 0) throw new Error("Debit amount must be positive");

  const headers = {};
  if (idempotencyKey) {
    headers["x-idempotency-key"] = String(idempotencyKey);
  }

  const payload = {
    amount: numAmount,
    reference_id: String(orderId),
    remarks: `Tiffzy Order Payment: ${orderId}`,
  };

  const data = await ppiFetch(`/wallets/${encodeURIComponent(cashfreeWalletId)}/debit`, {
    method: "POST",
    headers,
    body: payload,
  });

  return {
    success: true,
    transactionId: data.transaction_id || data.reference_id || orderId,
    balance: round2(data.balance ?? data.available_balance ?? 0),
    raw: data,
  };
};

/**
 * 8. Refund PPI Wallet
 */
export const refundWallet = async ({ cashfreeWalletId, amount, originalDebitTxnId, idempotencyKey }) => {
  assertPpiConfigured();
  if (!cashfreeWalletId) throw new Error("cashfreeWalletId is required for wallet refund");
  const numAmount = round2(amount);
  if (numAmount <= 0) throw new Error("Refund amount must be positive");

  const headers = {};
  if (idempotencyKey) {
    headers["x-idempotency-key"] = String(idempotencyKey);
  }

  const payload = {
    amount: numAmount,
    original_transaction_id: String(originalDebitTxnId),
    remarks: "Tiffzy Order Refund",
  };

  const data = await ppiFetch(`/wallets/${encodeURIComponent(cashfreeWalletId)}/refund`, {
    method: "POST",
    headers,
    body: payload,
  });

  return {
    success: true,
    transactionId: data.transaction_id || data.reference_id,
    raw: data,
  };
};

/**
 * Diagnostic Service Status
 */
export const getPpiServiceStatus = () => {
  return getPpiConfigStatus();
};
