import { createCashfreePaymentSession } from "./cashfree.service.js";
import { isPpiConfigured, getProgramId } from "../config/cashfreePpi.config.js";
import {
  createPpiUser,
  createWallet as createCashfreeWallet,
  getWalletDetails as fetchCashfreeWalletDetails,
  creditWallet as ppiCreditWallet,
  debitWallet as ppiDebitWallet,
  refundWallet as ppiRefundWallet,
  formatPhone,
} from "./cashfreePpiService.js";
import { createWalletLoadPgOrder } from "./cashfreePgCreditService.js";
import defaultPrisma from "../prisma.js";
import { completeSessionAndReleaseTable } from "./tableSessionService.js";
import { assertTwmPayConfigured, getTwmPayConfig } from "../config/twmPay.config.js";
import {
  createTwmPaymentOrder,
  fetchTwmOrderStatus,
  normalizeTwmStatus,
  recordTwmNotificationMetric,
  recordTwmStatusMetric,
  toPaise,
  verifyTwmSignature,
} from "./twmPay.service.js";
import { resolveTwmNotifyUrl } from "./twmPayPaymentService.js";

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;
const getDb = (passedPrisma) => passedPrisma || defaultPrisma;

export const WALLET_CONFIG = {
  MIN_TOPUP: 10,
  MAX_TOPUP: 50000,
  MAX_BALANCE: 100000,
  CURRENCY: "INR",
};

/**
 * Get or automatically create & sync wallet with Cashfree PPI
 */
export const getOrCreateWallet = async (passedPrisma, customerAccountId) => {
  if (!customerAccountId) throw new Error("Customer Account ID is required");
  const prisma = getDb(passedPrisma);
  const numericAccountId = Number(customerAccountId);

  let wallet = await prisma.wallet.findUnique({
    where: { customerAccountId: numericAccountId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        customerAccountId: numericAccountId,
        balance: 0,
        currency: WALLET_CONFIG.CURRENCY,
        status: "ACTIVE",
      },
    });
  }

  // Provision / Sync with Cashfree PPI if enabled and not already mapped
  if (isPpiConfigured() && (!wallet.cashfreeUserId || !wallet.walletId || !wallet.cfSubWalletId)) {
    try {
      const customer = await prisma.customerAccount.findUnique({
        where: { id: numericAccountId },
      });

      if (customer && customer.phone) {
        // 1. Create PPI User
        const ppiUser = await createPpiUser({
          phone: customer.phone,
          name: customer.name || "Tiffzy Customer",
          email: customer.email || `cust_${customer.id}@tiffzy.com`,
        });

        // 2. Create PPI Wallet
        const cfWallet = await createCashfreeWallet({
          cashfreePpiUserId: ppiUser.cfUserId,
          programId: getProgramId(),
        });

        // 3. Update DB record
        wallet = await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            cashfreeUserId: ppiUser.cfUserId,
            walletId: cfWallet.walletId,
            cfSubWalletId: cfWallet.cfSubWalletId,
            cfProgramId: cfWallet.cfProgramId || getProgramId(),
          },
        });
      }
    } catch (err) {
      console.warn("[getOrCreateWallet] Cashfree PPI provisioning warning:", err.message);
    }
  }

  return wallet;
};

/**
 * Get Wallet Summary with optional live Cashfree sync
 */
export const getWalletSummary = async (passedPrisma, customerAccountId) => {
  const prisma = getDb(passedPrisma);
  const wallet = await getOrCreateWallet(prisma, customerAccountId);

  let currentBalance = round2(wallet.balance);

  // Sync balance live with Cashfree PPI if walletId exists
  if (isPpiConfigured() && wallet.walletId) {
    try {
      const liveDetails = await fetchCashfreeWalletDetails({ cashfreeWalletId: wallet.walletId });
      if (typeof liveDetails.balance === "number") {
        currentBalance = round2(liveDetails.balance);
        if (currentBalance !== wallet.balance) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: currentBalance },
          });
        }
      }
    } catch (err) {
      console.warn("[getWalletSummary] Cashfree PPI balance sync warning:", err.message);
    }
  }

  return {
    walletId: wallet.id,
    customerAccountId: wallet.customerAccountId,
    balance: currentBalance,
    currency: wallet.currency,
    status: wallet.status,
    cashfreeUserId: wallet.cashfreeUserId || null,
    cashfreeWalletId: wallet.walletId || null,
    cfSubWalletId: wallet.cfSubWalletId || null,
    cfProgramId: wallet.cfProgramId || null,
    createdAt: wallet.createdAt,
  };
};

/**
 * Get Wallet Transaction History with filtering & pagination
 */
export const getWalletTransactions = async (
  passedPrisma,
  customerAccountId,
  { page = 1, limit = 20, type = null, direction = null } = {}
) => {
  const prisma = getDb(passedPrisma);
  const fallbackRes = { page: 1, limit: 20, total: 0, totalPages: 0, transactions: [] };
  if (!prisma || !prisma.walletLedger) {
    return fallbackRes;
  }

  try {
    const wallet = await getOrCreateWallet(prisma, customerAccountId);
    const p = Math.max(1, Number(page || 1));
    const l = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (p - 1) * l;

    const where = {
      walletId: wallet.id,
      ...(type ? { type: String(type).toUpperCase() } : {}),
      ...(direction ? { direction: String(direction).toUpperCase() } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.walletLedger.count({ where }),
      prisma.walletLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: l,
      }),
    ]);

    return {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l),
      transactions: items.map((item) => ({
        id: item.id,
        type: item.type,
        direction: item.direction,
        amount: round2(item.amount),
        balanceBefore: round2(item.balanceBefore),
        balanceAfter: round2(item.balanceAfter),
        description: item.description,
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        orderId: item.orderId,
        status: item.status,
        createdAt: item.createdAt,
      })),
    };
  } catch (err) {
    console.error("[getWalletTransactions] Error:", err.message);
    return fallbackRes;
  }
};

/**
 * Get Wallet Analytics & Balance Trend
 * Computes summary aggregations and chronological time-series points.
 */
export const getWalletAnalytics = async (
  passedPrisma,
  customerAccountId,
  { period = "30d" } = {}
) => {
  const prisma = getDb(passedPrisma);
  if (!customerAccountId) {
    const err = new Error("customerAccountId is required");
    err.statusCode = 400;
    throw err;
  }

  const ALLOWED_PERIODS = ["7d", "30d", "3m", "6m", "1y", "all"];
  const cleanPeriod = String(period || "30d").trim().toLowerCase();
  if (!ALLOWED_PERIODS.includes(cleanPeriod)) {
    const err = new Error("Invalid period. Allowed periods: 7d, 30d, 3m, 6m, 1y, all");
    err.statusCode = 400;
    throw err;
  }

  const wallet = await getOrCreateWallet(prisma, customerAccountId);
  const currentBalance = round2(wallet.balance);

  const now = new Date();
  let startDate = null;
  if (cleanPeriod === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (cleanPeriod === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (cleanPeriod === "3m") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  } else if (cleanPeriod === "6m") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  } else if (cleanPeriod === "1y") {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const periodWhere = {
    walletId: wallet.id,
    status: "SUCCESS",
    ...(startDate ? { createdAt: { gte: startDate } } : {}),
  };

  const [periodGroups, monthTopups, monthSpent, ledgerItems] = await Promise.all([
    prisma.walletLedger.groupBy({
      by: ["type", "direction"],
      where: periodWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.walletLedger.aggregate({
      where: {
        walletId: wallet.id,
        type: "WALLET_TOPUP",
        direction: "CREDIT",
        status: "SUCCESS",
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.walletLedger.aggregate({
      where: {
        walletId: wallet.id,
        type: "ORDER_PAYMENT",
        direction: "DEBIT",
        status: "SUCCESS",
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.walletLedger.findMany({
      where: periodWhere,
      select: {
        amount: true,
        direction: true,
        balanceAfter: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);

  let totalDeposited = 0;
  let totalSpent = 0;
  let totalRefunded = 0;
  let totalTransactions = 0;

  for (const group of periodGroups) {
    const sumAmount = round2(group._sum?.amount || 0);
    totalTransactions += group._count || 0;

    if (group.type === "WALLET_TOPUP" && group.direction === "CREDIT") {
      totalDeposited = round2(totalDeposited + sumAmount);
    } else if (group.type === "ORDER_PAYMENT" && group.direction === "DEBIT") {
      totalSpent = round2(totalSpent + sumAmount);
    } else if (group.type === "REFUND" && group.direction === "CREDIT") {
      totalRefunded = round2(totalRefunded + sumAmount);
    }
  }

  const monthDepositsVal = round2(monthTopups?._sum?.amount || 0);
  const monthSpentVal = round2(monthSpent?._sum?.amount || 0);

  // Group trend into chronological time-series buckets
  const isMonthlyBucket = cleanPeriod === "6m" || cleanPeriod === "1y" || (cleanPeriod === "all" && ledgerItems.length > 0 && (ledgerItems[ledgerItems.length - 1].createdAt - ledgerItems[0].createdAt > 90 * 24 * 60 * 60 * 1000));
  const trendMap = new Map();

  for (const item of ledgerItems) {
    const dateKey = isMonthlyBucket
      ? item.createdAt.toISOString().slice(0, 7)
      : item.createdAt.toISOString().slice(0, 10);

    if (!trendMap.has(dateKey)) {
      trendMap.set(dateKey, {
        date: dateKey,
        balance: round2(item.balanceAfter),
        credits: 0,
        debits: 0,
      });
    }

    const point = trendMap.get(dateKey);
    if (item.direction === "CREDIT") {
      point.credits = round2(point.credits + item.amount);
    } else if (item.direction === "DEBIT") {
      point.debits = round2(point.debits + item.amount);
    }
    point.balance = round2(item.balanceAfter);
  }

  const trend = Array.from(trendMap.values());

  return {
    summary: {
      currentBalance,
      totalDeposited,
      totalSpent,
      totalRefunded,
      totalTransactions,
      monthDeposits: monthDepositsVal,
      monthSpent: monthSpentVal,
    },
    trend,
  };
};

const resolveWalletTwmReturnUrl = ({ req, requestedReturnUrl }) => {
  const cfg = getTwmPayConfig();
  if (cfg.returnUrlOverride) {
    return cfg.returnUrlOverride;
  }

  let defaultBase = "";
  const originHeader = String(req?.headers?.origin || "").trim();
  if (/^https?:\/\//i.test(originHeader)) {
    try {
      defaultBase = new URL(originHeader).origin;
    } catch {
      defaultBase = "";
    }
  }
  if (!defaultBase) {
    const envFrontend = String(process.env.FRONTEND_URL || "").trim();
    if (/^https?:\/\//i.test(envFrontend)) {
      try {
        defaultBase = new URL(envFrontend).origin;
      } catch {
        defaultBase = "";
      }
    }
  }
  if (!defaultBase) {
    defaultBase = "http://localhost:5173";
  }

  const defaultUrl = `${defaultBase}/profile/wallet`;
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
      const cleaned = candidate.split("?")[0].replace(/\{order_id\}/gi, "").replace(/\/+$/, "");
      return cleaned || defaultUrl;
    }
  } catch {
    return defaultUrl;
  }
  return defaultUrl;
};

/**
 * Atomic non-duplicating balance credit & ledger append for verified wallet top-ups.
 */
const creditWalletTopupAtomically = async (
  prisma,
  { topupRecord, gatewayOrderId, gatewayPaymentId, idempotencyKey, description }
) => {
  const cleanIdempotencyKey = idempotencyKey || `CREDIT_${topupRecord.topupTxnId}`;

  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: topupRecord.walletId } });
    if (!wallet || wallet.status !== "ACTIVE") {
      throw new Error("Wallet is inactive or blocked");
    }

    if (typeof tx.walletTopup?.updateMany === "function") {
      const claim = await tx.walletTopup.updateMany({
        where: {
          id: topupRecord.id,
          status: { not: "SUCCESS" },
        },
        data: {
          status: "SUCCESS",
          gatewayOrderId: gatewayOrderId || topupRecord.gatewayOrderId,
          gatewayPaymentId: gatewayPaymentId || topupRecord.gatewayPaymentId || null,
        },
      });
      if (claim.count === 0) {
        return { wallet, alreadyCredited: true };
      }
    } else {
      await tx.walletTopup.update({
        where: { id: topupRecord.id },
        data: {
          status: "SUCCESS",
          gatewayOrderId: gatewayOrderId || topupRecord.gatewayOrderId,
          gatewayPaymentId: gatewayPaymentId || topupRecord.gatewayPaymentId || null,
        },
      });
    }

    const balanceBefore = round2(wallet.balance);
    const balanceAfter = round2(balanceBefore + topupRecord.amount);

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        customerAccountId: wallet.customerAccountId,
        type: "WALLET_TOPUP",
        direction: "CREDIT",
        amount: topupRecord.amount,
        balanceBefore,
        balanceAfter,
        referenceType: "TOPUP",
        referenceId: topupRecord.topupTxnId,
        description: description || `Wallet top-up ₹${topupRecord.amount}`,
        idempotencyKey: cleanIdempotencyKey,
        status: "SUCCESS",
      },
    });

    return { wallet: updated, alreadyCredited: false };
  });
};

/**
 * Initiate Wallet Top-Up Session (TWM Pay or Cashfree)
 */
export const initiateTopup = async (
  passedPrisma,
  { customerAccountId, amount, returnUrl, provider, idempotencyKey, req = null, fetchImpl }
) => {
  const prisma = getDb(passedPrisma);
  const numAmount = round2(amount);
  const normalizedProvider = String(provider || "").trim().toUpperCase();
  const useTwmPay = normalizedProvider === "TWM_PAY" || normalizedProvider === "TWM";

  if (Number.isNaN(numAmount) || numAmount < WALLET_CONFIG.MIN_TOPUP) {
    throw new Error(`Minimum top-up amount is ₹${WALLET_CONFIG.MIN_TOPUP}`);
  }

  if (numAmount > WALLET_CONFIG.MAX_TOPUP) {
    throw new Error(`Maximum single top-up limit is ₹${WALLET_CONFIG.MAX_TOPUP}`);
  }

  const wallet = await getOrCreateWallet(prisma, customerAccountId);
  if (wallet.status !== "ACTIVE") {
    throw new Error("Your wallet is currently blocked or inactive");
  }

  if (round2(wallet.balance) + numAmount > WALLET_CONFIG.MAX_BALANCE) {
    throw new Error(`Wallet balance cannot exceed ₹${WALLET_CONFIG.MAX_BALANCE}`);
  }

  const customer = await prisma.customerAccount.findUnique({
    where: { id: Number(customerAccountId) },
  });

  if (!customer) {
    throw new Error("Customer account not found");
  }

  const cleanIdemKey = idempotencyKey ? String(idempotencyKey).trim() : null;
  if (cleanIdemKey) {
    const existingByIdem = await prisma.walletTopup.findUnique({
      where: { idempotencyKey: cleanIdemKey },
    });
    if (existingByIdem && existingByIdem.status === "SUCCESS") {
      throw new Error("This top-up request was already completed");
    }
  }

  const topupTxnId = `TOPUP_${wallet.id}_${Date.now()}`;

  if (useTwmPay) {
    assertTwmPayConfigured();
    const amountPaise = toPaise(numAmount);
    const resolvedReturnUrl = resolveWalletTwmReturnUrl({ req, requestedReturnUrl: returnUrl });
    const resolvedNotifyUrl = resolveTwmNotifyUrl({ req });

    const topupRecord = await prisma.walletTopup.create({
      data: {
        walletId: wallet.id,
        customerAccountId: wallet.customerAccountId,
        topupTxnId,
        amount: numAmount,
        currency: WALLET_CONFIG.CURRENCY,
        status: "PENDING",
        gateway: "TWM_PAY",
        gatewayOrderId: topupTxnId,
        idempotencyKey: cleanIdemKey,
      },
    });

    try {
      const twmOrder = await createTwmPaymentOrder(
        {
          orderRef: topupTxnId,
          amountPaise,
          customerName: customer.name || "Tiffzy Customer",
          customerPhone: customer.phone || "",
          returnUrl: resolvedReturnUrl,
          notifyUrl: resolvedNotifyUrl,
        },
        { fetchImpl }
      );

      const gatewayOrderId = twmOrder.orderRef || topupTxnId;
      if (gatewayOrderId !== topupRecord.gatewayOrderId) {
        await prisma.walletTopup.update({
          where: { id: topupRecord.id },
          data: { gatewayOrderId },
        });
      }

      return {
        topupTxnId,
        orderRef: gatewayOrderId,
        amount: numAmount,
        amountPaise,
        provider: "TWM_PAY",
        gateway: "TWM_PAY",
        gatewayOrderId,
        checkoutUrl: twmOrder.checkoutUrl,
        checkout_url: twmOrder.checkoutUrl,
        paymentUrl: twmOrder.checkoutUrl,
      };
    } catch (err) {
      await prisma.walletTopup.update({
        where: { id: topupRecord.id },
        data: { status: "FAILED" },
      }).catch(() => {});
      throw err;
    }
  }

  // Create pending Cashfree top-up record in DB
  const topupRecord = await prisma.walletTopup.create({
    data: {
      walletId: wallet.id,
      customerAccountId: wallet.customerAccountId,
      topupTxnId,
      amount: numAmount,
      currency: WALLET_CONFIG.CURRENCY,
      status: "PENDING",
      gateway: "CASHFREE",
      idempotencyKey: cleanIdemKey,
    },
  });

  // Check if PG Credit MID for PPI is available
  if (isPpiConfigured() && wallet.cashfreeUserId && wallet.cfSubWalletId) {
    try {
      const ppiLoadRes = await createWalletLoadPgOrder({
        topupId: topupTxnId,
        amount: numAmount,
        customerId: customer.id,
        customerName: customer.name || "Customer",
        customerEmail: customer.email || `cust_${customer.id}@tiffzy.com`,
        customerPhone: customer.phone,
        cfUserId: wallet.cashfreeUserId,
        cfSubWalletId: wallet.cfSubWalletId,
        returnUrl,
      });

      const ppiGatewayOrderId = ppiLoadRes.cfOrderId || ppiLoadRes.cf_order_id || topupTxnId;
      await prisma.walletTopup.update({
        where: { id: topupRecord.id },
        data: { gatewayOrderId: ppiGatewayOrderId },
      });

      return {
        topupTxnId,
        amount: numAmount,
        paymentSessionId: ppiLoadRes.paymentSessionId,
        payment_session_id: ppiLoadRes.payment_session_id || ppiLoadRes.paymentSessionId,
        gatewayOrderId: ppiGatewayOrderId,
        cfOrderId: ppiLoadRes.cfOrderId,
        cf_order_id: ppiLoadRes.cf_order_id || ppiLoadRes.cfOrderId,
        gateway: "CASHFREE_PPI_CREDIT",
        isProduction: Boolean(ppiLoadRes.isProduction),
        is_production: Boolean(ppiLoadRes.is_production),
        cfEnv: ppiLoadRes.cfEnv,
        cf_env: ppiLoadRes.cf_env,
      };
    } catch (err) {
      console.warn("[initiateTopup] PG Credit MID fallback to standard PG:", err.message);
    }
  }

  // Fallback to standard Cashfree PG Order
  const cfSession = await createCashfreePaymentSession({
    orderId: topupTxnId,
    amount: numAmount,
    customerId: customer.id,
    customerName: customer.name || "Customer",
    customerEmail: customer.email || `cust_${customer.id}@tiffzy.com`,
    customerPhone: customer.phone,
    returnUrl,
  });

  const gatewayOrderId = cfSession.cf_order_id || cfSession.cfOrderId || cfSession.order_id || topupTxnId;
  await prisma.walletTopup.update({
    where: { id: topupRecord.id },
    data: { gatewayOrderId },
  });

  const paymentSessionId = cfSession.payment_session_id || cfSession.paymentSessionId;
  const isProd = cfSession.is_production !== undefined ? Boolean(cfSession.is_production) : Boolean(cfSession.isProduction);
  const cfEnv = cfSession.cf_env || cfSession.cfEnv || (isProd ? "PRODUCTION" : "SANDBOX");

  return {
    topupTxnId,
    amount: numAmount,
    paymentSessionId,
    payment_session_id: paymentSessionId,
    gatewayOrderId,
    cfOrderId: cfSession.cf_order_id || cfSession.cfOrderId,
    cf_order_id: cfSession.cf_order_id || cfSession.cfOrderId,
    gateway: "CASHFREE",
    isProduction: isProd,
    is_production: isProd,
    cfEnv,
    cf_env: cfEnv,
  };
};

/**
 * Verify Cashfree Payment & Credit Wallet
 */
export const verifyAndCreditTopup = async (
  passedPrisma,
  { customerAccountId, topupTxnId, gatewayOrderId, gatewayPaymentId, idempotencyKey }
) => {
  const prisma = getDb(passedPrisma);
  const topupRecord = await prisma.walletTopup.findUnique({
    where: { topupTxnId: String(topupTxnId).trim() },
    include: { wallet: true },
  });

  if (!topupRecord) {
    throw new Error("Top-up transaction record not found");
  }

  if (topupRecord.customerAccountId !== Number(customerAccountId)) {
    throw new Error("Unauthorized top-up verification attempt");
  }

  // Idempotent Check: If already processed, return existing balance
  if (topupRecord.status === "SUCCESS") {
    const currentWallet = await prisma.wallet.findUnique({ where: { id: topupRecord.walletId } });
    return {
      success: true,
      message: "Top-up was already credited successfully",
      balance: round2(currentWallet.balance),
      amount: topupRecord.amount,
      topupTxnId: topupRecord.topupTxnId,
    };
  }

  const cleanIdempotencyKey = idempotencyKey || `CREDIT_${topupTxnId}`;

  // Credit Cashfree PPI co-branded wallet if active
  if (isPpiConfigured() && topupRecord.wallet.walletId) {
    try {
      await ppiCreditWallet({
        cashfreeWalletId: topupRecord.wallet.walletId,
        amount: topupRecord.amount,
        gatewayPaymentId: gatewayPaymentId || topupTxnId,
        idempotencyKey: cleanIdempotencyKey,
      });
    } catch (err) {
      console.error("[verifyAndCreditTopup] Cashfree PPI credit warning:", err.message);
    }
  }

  // Atomic non-duplicating transaction for balance credit + ledger append in local DB
  const { wallet: updatedWallet, alreadyCredited } = await creditWalletTopupAtomically(prisma, {
    topupRecord,
    gatewayOrderId,
    gatewayPaymentId,
    idempotencyKey: cleanIdempotencyKey,
    description: `Wallet top-up ₹${topupRecord.amount} via Cashfree`,
  });

  return {
    success: true,
    alreadyProcessed: alreadyCredited,
    message: alreadyCredited
      ? "Top-up was already credited successfully"
      : `₹${topupRecord.amount} added to your Tiffzy Wallet`,
    balance: round2(updatedWallet.balance),
    amount: topupRecord.amount,
    topupTxnId: topupRecord.topupTxnId,
  };
};

const findTwmWalletTopupRecord = async (prisma, { topupTxnId, orderRef }) => {
  if (!prisma?.walletTopup) return null;
  const candidates = [topupTxnId, orderRef]
    .map((val) => String(val || "").trim())
    .filter(Boolean);
  if (candidates.length === 0) return null;

  for (const ref of candidates) {
    const foundByTxn = await prisma.walletTopup.findUnique({
      where: { topupTxnId: ref },
      include: { wallet: true },
    });
    if (foundByTxn) return foundByTxn;

    const foundByGatewayOrder = await prisma.walletTopup.findFirst({
      where: { gatewayOrderId: ref },
      include: { wallet: true },
      orderBy: { id: "desc" },
    });
    if (foundByGatewayOrder) return foundByGatewayOrder;
  }

  return null;
};

const applyVerifiedTwmTopupOutcome = async ({
  prisma,
  topupRecord,
  normalized,
  amountPaise,
  txn,
}) => {
  recordTwmStatusMetric(normalized.gatewayStatus);

  const expectedPaise = toPaise(topupRecord.amount);
  const incomingPaise =
    amountPaise !== undefined && amountPaise !== null && String(amountPaise).trim() !== ""
      ? Number(amountPaise)
      : null;

  if (incomingPaise !== null && (!Number.isSafeInteger(incomingPaise) || incomingPaise !== expectedPaise)) {
    const err = new Error(
      `Payment amount mismatch for top-up ${topupRecord.topupTxnId}: expected ${expectedPaise} paise, got ${amountPaise}`
    );
    err.statusCode = 400;
    err.code = "TWM_AMOUNT_MISMATCH";
    throw err;
  }

  if (topupRecord.status === "SUCCESS") {
    const freshWallet = await prisma.wallet.findUnique({ where: { id: topupRecord.walletId } });
    return {
      verified: true,
      success: true,
      alreadyProcessed: true,
      status: "PAID",
      paymentStatus: "PAID",
      gatewayStatus: "PAID",
      topupTxnId: topupRecord.topupTxnId,
      orderRef: topupRecord.gatewayOrderId || topupRecord.topupTxnId,
      amount: topupRecord.amount,
      balance: round2(freshWallet?.balance ?? topupRecord.wallet?.balance ?? 0),
      txn: txn || topupRecord.gatewayPaymentId || null,
      message: "Top-up was already credited successfully",
    };
  }

  if (normalized.paymentStatus === "PAID" || normalized.isPaid) {
    const { wallet: updatedWallet, alreadyCredited } = await creditWalletTopupAtomically(prisma, {
      topupRecord,
      gatewayOrderId: topupRecord.gatewayOrderId || topupRecord.topupTxnId,
      gatewayPaymentId: txn || null,
      idempotencyKey: `CREDIT_${topupRecord.topupTxnId}`,
      description: `Wallet top-up ₹${topupRecord.amount} via TWM Pay`,
    });

    return {
      verified: true,
      success: true,
      alreadyProcessed: alreadyCredited,
      status: "PAID",
      paymentStatus: "PAID",
      gatewayStatus: "PAID",
      topupTxnId: topupRecord.topupTxnId,
      orderRef: topupRecord.gatewayOrderId || topupRecord.topupTxnId,
      amount: topupRecord.amount,
      balance: round2(updatedWallet.balance),
      txn: txn || topupRecord.gatewayPaymentId || null,
      message: alreadyCredited
        ? "Top-up was already credited successfully"
        : `₹${topupRecord.amount} added to your Tiffzy Wallet`,
    };
  }

  if (normalized.paymentStatus === "FAILED") {
    if (typeof prisma.walletTopup?.updateMany === "function") {
      await prisma.walletTopup.updateMany({
        where: { id: topupRecord.id, status: { not: "SUCCESS" } },
        data: {
          status: "FAILED",
          gatewayPaymentId: txn || topupRecord.gatewayPaymentId || null,
        },
      });
    } else {
      await prisma.walletTopup.update({
        where: { id: topupRecord.id },
        data: {
          status: "FAILED",
          gatewayPaymentId: txn || topupRecord.gatewayPaymentId || null,
        },
      });
    }

    return {
      verified: true,
      success: false,
      alreadyProcessed: false,
      status: "FAILED",
      paymentStatus: "FAILED",
      gatewayStatus: normalized.gatewayStatus,
      topupTxnId: topupRecord.topupTxnId,
      orderRef: topupRecord.gatewayOrderId || topupRecord.topupTxnId,
      amount: topupRecord.amount,
      balance: round2(topupRecord.wallet?.balance ?? 0),
      txn: txn || topupRecord.gatewayPaymentId || null,
      message:
        normalized.gatewayStatus === "EXPIRED"
          ? "Top-up payment session expired"
          : "Top-up payment was rejected",
    };
  }

  if (txn && txn !== topupRecord.gatewayPaymentId) {
    await prisma.walletTopup.updateMany({
      where: { id: topupRecord.id, status: { not: "SUCCESS" } },
      data: { gatewayPaymentId: txn },
    });
  }

  return {
    verified: true,
    success: false,
    alreadyProcessed: false,
    status: "PENDING",
    paymentStatus: "PENDING",
    gatewayStatus: normalized.gatewayStatus,
    topupTxnId: topupRecord.topupTxnId,
    orderRef: topupRecord.gatewayOrderId || topupRecord.topupTxnId,
    amount: topupRecord.amount,
    balance: round2(topupRecord.wallet?.balance ?? 0),
    txn: txn || topupRecord.gatewayPaymentId || null,
    message: normalized.message,
  };
};

/**
 * Reconcile TWM Pay Wallet Top-Up Status authoritatively via TWM Order Status API
 */
export const reconcileTwmTopupStatus = async ({
  prisma: passedPrisma,
  customerAccountId = null,
  topupTxnId,
  orderRef,
  fetchImpl,
}) => {
  const prisma = getDb(passedPrisma);
  const topupRecord = await findTwmWalletTopupRecord(prisma, { topupTxnId, orderRef });

  if (!topupRecord) {
    const err = new Error("Top-up transaction record not found");
    err.statusCode = 404;
    err.code = "TOPUP_NOT_FOUND";
    throw err;
  }

  if (
    customerAccountId !== null &&
    customerAccountId !== undefined &&
    topupRecord.customerAccountId !== Number(customerAccountId)
  ) {
    const err = new Error("Unauthorized top-up verification attempt");
    err.statusCode = 403;
    err.code = "UNAUTHORIZED";
    throw err;
  }

  if (topupRecord.status === "SUCCESS") {
    return applyVerifiedTwmTopupOutcome({
      prisma,
      topupRecord,
      normalized: normalizeTwmStatus("paid"),
      amountPaise: toPaise(topupRecord.amount),
      txn: topupRecord.gatewayPaymentId,
    });
  }

  const lookupRef = topupRecord.gatewayOrderId || topupRecord.topupTxnId;
  const gatewayRes = await fetchTwmOrderStatus(lookupRef, { fetchImpl });
  const normalized = gatewayRes.normalized || normalizeTwmStatus(gatewayRes.raw?.status);

  return applyVerifiedTwmTopupOutcome({
    prisma,
    topupRecord,
    normalized,
    amountPaise: gatewayRes.amountPaise,
    txn: gatewayRes.txn,
  });
};

/**
 * Process TWM Pay Redirect/Return Verification for Wallet Top-Up
 */
export const processTwmTopupReturn = async ({
  prisma: passedPrisma,
  customerAccountId,
  payload,
  fetchImpl,
}) => {
  const prisma = getDb(passedPrisma);
  const input = payload || {};
  const topupTxnId = String(input.topupTxnId || input.topup_id || "").trim();
  const orderRef = String(input.order_ref || input.orderRef || "").trim();

  if (
    input.signature !== undefined ||
    input.status !== undefined ||
    input.amount_paise !== undefined
  ) {
    if (!verifyTwmSignature(input)) {
      const err = new Error("Invalid payment signature");
      err.statusCode = 400;
      err.code = "INVALID_SIGNATURE";
      throw err;
    }

    const topupRecord = await findTwmWalletTopupRecord(prisma, { topupTxnId, orderRef });
    if (!topupRecord) {
      const err = new Error("Top-up transaction record not found");
      err.statusCode = 404;
      err.code = "TOPUP_NOT_FOUND";
      throw err;
    }

    if (topupRecord.customerAccountId !== Number(customerAccountId)) {
      const err = new Error("Unauthorized top-up verification attempt");
      err.statusCode = 403;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const normalized = normalizeTwmStatus(input.status);
    return applyVerifiedTwmTopupOutcome({
      prisma,
      topupRecord,
      normalized,
      amountPaise: input.amount_paise,
      txn: input.txn,
    });
  }

  return reconcileTwmTopupStatus({
    prisma,
    customerAccountId,
    topupTxnId,
    orderRef,
    fetchImpl,
  });
};

/**
 * Process Signed TWM Pay Webhook Notification for Wallet Top-Up
 */
export const processTwmTopupNotify = async ({
  prisma: passedPrisma,
  payload,
}) => {
  const prisma = getDb(passedPrisma);
  const input = payload || {};
  recordTwmNotificationMetric("received");

  if (!verifyTwmSignature(input)) {
    recordTwmNotificationMetric("rejected");
    const err = new Error("Invalid TWM Pay notification signature");
    err.statusCode = 400;
    err.code = "INVALID_SIGNATURE";
    throw err;
  }

  const orderRef = String(input.order_ref || "").trim();
  const topupRecord = await findTwmWalletTopupRecord(prisma, { orderRef });
  if (!topupRecord) {
    const err = new Error(`Unknown TWM Pay top-up reference: ${orderRef}`);
    err.statusCode = 404;
    err.code = "TOPUP_NOT_FOUND";
    throw err;
  }

  const normalized = normalizeTwmStatus(input.status);
  const result = await applyVerifiedTwmTopupOutcome({
    prisma,
    topupRecord,
    normalized,
    amountPaise: input.amount_paise,
    txn: input.txn,
  });

  recordTwmNotificationMetric("verified");
  return result;
};

/**
 * Pay Food Order using Tiffzy Wallet
 */
export const payOrderWithWallet = async (
  passedPrisma,
  { customerAccountId, orderId, amount, customerPhone, idempotencyKey, realtime }
) => {
  const prisma = getDb(passedPrisma);
  const numAmount = round2(amount);
  const cleanOrderId = Number(orderId);

  if (Number.isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Valid order payment amount is required");
  }

  // Server-side order verification
  const order = await prisma.order.findUnique({ where: { id: cleanOrderId } });
  if (!order) {
    throw new Error("Order not found");
  }

  if (round2(order.total) !== numAmount) {
    throw new Error(`Payment amount mismatch. Order total is ₹${round2(order.total)}, provided ₹${numAmount}`);
  }

  if (order.paymentStatus === "PAID") {
    throw new Error("Order has already been paid");
  }

  const wallet = await getOrCreateWallet(prisma, customerAccountId);
  if (wallet.status !== "ACTIVE") {
    throw new Error("Your wallet is currently blocked");
  }

  // Phone matching validation
  if (customerPhone) {
    const customer = await prisma.customerAccount.findUnique({ where: { id: Number(customerAccountId) } });
    if (customer && customer.phone) {
      const p1 = formatPhone(customerPhone);
      const p2 = formatPhone(customer.phone);
      if (p1 && p2 && p1 !== p2) {
        throw new Error("Phone number mismatch: Authenticated user does not match wallet owner");
      }
    }
  }

  const cleanIdempotencyKey = idempotencyKey || `PAY_ORD_${cleanOrderId}_${Date.now()}`;

  // Idempotency check
  const existingLedger = await prisma.walletLedger.findFirst({
    where: {
      orderId: cleanOrderId,
      type: "ORDER_PAYMENT",
      status: "SUCCESS",
    },
  });

  if (existingLedger) {
    return {
      success: true,
      message: "Order already paid with wallet",
      balanceAfter: existingLedger.balanceAfter,
    };
  }

  // Debit Cashfree PPI Co-branded Wallet if active
  if (isPpiConfigured() && wallet.walletId) {
    try {
      await ppiDebitWallet({
        cashfreeWalletId: wallet.walletId,
        amount: numAmount,
        orderId: String(cleanOrderId),
        idempotencyKey: cleanIdempotencyKey,
      });
    } catch (err) {
      console.error("[payOrderWithWallet] Cashfree PPI debit error:", err.message);
      throw new Error(`Cashfree Wallet Debit failed: ${err.message}`);
    }
  }

  // Atomic local DB debit
  const txResult = await prisma.$transaction(async (tx) => {
    const freshWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });

    if (!freshWallet || freshWallet.status !== "ACTIVE") {
      throw new Error("Wallet is not active");
    }

    if (round2(freshWallet.balance) < numAmount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${round2(freshWallet.balance)}, Required: ₹${numAmount}`);
    }

    const balanceBefore = round2(freshWallet.balance);
    const balanceAfter = round2(balanceBefore - numAmount);

    const updated = await tx.wallet.update({
      where: { id: freshWallet.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedger.create({
      data: {
        walletId: freshWallet.id,
        customerAccountId: freshWallet.customerAccountId,
        type: "ORDER_PAYMENT",
        direction: "DEBIT",
        amount: numAmount,
        balanceBefore,
        balanceAfter,
        referenceType: "ORDER",
        referenceId: String(cleanOrderId),
        orderId: cleanOrderId,
        description: `Food order payment (Order #${cleanOrderId})`,
        idempotencyKey: cleanIdempotencyKey,
        status: "SUCCESS",
      },
    });

    await tx.order.update({
      where: { id: cleanOrderId },
      data: {
        paymentStatus: "PAID",
        paymentMode: "WALLET",
      },
    });

    return {
      success: true,
      message: `₹${numAmount} paid from Tiffzy Wallet`,
      balanceBefore,
      balanceAfter: round2(updated.balance),
    };
  });

  await completeSessionAndReleaseTable({
    prisma,
    orderId: cleanOrderId,
    paymentMode: "WALLET",
    realtime,
  });

  return txResult;
};

/**
 * Refund Cancelled Order back to Tiffzy Wallet
 */
export const refundOrderToWallet = async (
  passedPrisma,
  { orderId, amount, reason = "Order cancelled", idempotencyKey }
) => {
  const prisma = getDb(passedPrisma);
  const cleanOrderId = Number(orderId);
  const order = await prisma.order.findUnique({ where: { id: cleanOrderId } });

  if (!order) {
    throw new Error("Order not found for refund");
  }

  const refundAmount = round2(amount || order.total);
  if (refundAmount <= 0) {
    throw new Error("Refund amount must be positive");
  }

  let customerAccountId = null;
  if (order.phone) {
    const acc = await prisma.customerAccount.findUnique({ where: { phone: order.phone } });
    if (acc) customerAccountId = acc.id;
  }

  if (!customerAccountId) {
    throw new Error("Customer wallet account not found for refund");
  }

  const wallet = await getOrCreateWallet(prisma, customerAccountId);
  const cleanIdempotencyKey = idempotencyKey || `REFUND_${cleanOrderId}_${Date.now()}`;

  // Find original debit transaction ID from ledger
  const originalDebitLedger = await prisma.walletLedger.findFirst({
    where: {
      orderId: cleanOrderId,
      type: "ORDER_PAYMENT",
      direction: "DEBIT",
      status: "SUCCESS",
    },
  });

  // Refund Cashfree PPI co-branded wallet if active
  if (isPpiConfigured() && wallet.walletId && originalDebitLedger) {
    try {
      await ppiRefundWallet({
        cashfreeWalletId: wallet.walletId,
        amount: refundAmount,
        originalDebitTxnId: originalDebitLedger.referenceId || String(cleanOrderId),
        idempotencyKey: cleanIdempotencyKey,
      });
    } catch (err) {
      console.error("[refundOrderToWallet] Cashfree PPI refund warning:", err.message);
    }
  }

  // Local DB atomic refund transaction
  return await prisma.$transaction(async (tx) => {
    const freshWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });

    const balanceBefore = round2(freshWallet.balance);
    const balanceAfter = round2(balanceBefore + refundAmount);

    const updated = await tx.wallet.update({
      where: { id: freshWallet.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedger.create({
      data: {
        walletId: freshWallet.id,
        customerAccountId: freshWallet.customerAccountId,
        type: "REFUND",
        direction: "CREDIT",
        amount: refundAmount,
        balanceBefore,
        balanceAfter,
        referenceType: "REFUND",
        referenceId: String(cleanOrderId),
        orderId: cleanOrderId,
        description: `Refund for Order #${cleanOrderId}: ${reason}`,
        idempotencyKey: cleanIdempotencyKey,
        status: "SUCCESS",
      },
    });

    await tx.order.update({
      where: { id: cleanOrderId },
      data: { paymentStatus: "REFUNDED" },
    });

    return {
      success: true,
      message: `₹${refundAmount} refunded to customer wallet`,
      balanceAfter: round2(updated.balance),
    };
  });
};

export const createTopupSession = initiateTopup;
