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
 * Initiate Wallet Top-Up Session
 */
export const initiateTopup = async (
  passedPrisma,
  { customerAccountId, amount, returnUrl }
) => {
  const prisma = getDb(passedPrisma);
  const numAmount = round2(amount);

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

  const topupTxnId = `TOPUP_${wallet.id}_${Date.now()}`;

  // Create pending top-up record in DB
  const topupRecord = await prisma.walletTopup.create({
    data: {
      walletId: wallet.id,
      customerAccountId: wallet.customerAccountId,
      topupTxnId,
      amount: numAmount,
      currency: WALLET_CONFIG.CURRENCY,
      status: "PENDING",
      gateway: "CASHFREE",
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

      await prisma.walletTopup.update({
        where: { id: topupRecord.id },
        data: { gatewayOrderId: ppiLoadRes.cfOrderId || topupTxnId },
      });

      return {
        topupTxnId,
        amount: numAmount,
        paymentSessionId: ppiLoadRes.paymentSessionId,
        cfOrderId: ppiLoadRes.cfOrderId,
        gateway: "CASHFREE_PPI_CREDIT",
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

  await prisma.walletTopup.update({
    where: { id: topupRecord.id },
    data: { gatewayOrderId: cfSession.cfOrderId || topupTxnId },
  });

  return {
    topupTxnId,
    amount: numAmount,
    paymentSessionId: cfSession.payment_session_id || cfSession.paymentSessionId,
    cfOrderId: cfSession.cf_order_id || cfSession.cfOrderId,
    gateway: "CASHFREE",
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

  // Atomic transaction for balance credit + ledger append in local DB
  const updatedWallet = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: topupRecord.walletId } });

    if (!wallet || wallet.status !== "ACTIVE") {
      throw new Error("Wallet is inactive or blocked");
    }

    const balanceBefore = round2(wallet.balance);
    const balanceAfter = round2(balanceBefore + topupRecord.amount);

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter },
    });

    await tx.walletTopup.update({
      where: { id: topupRecord.id },
      data: {
        status: "SUCCESS",
        gatewayOrderId: gatewayOrderId || topupRecord.gatewayOrderId,
        gatewayPaymentId: gatewayPaymentId || null,
      },
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
        description: `Wallet top-up ₹${topupRecord.amount} via Cashfree`,
        idempotencyKey: cleanIdempotencyKey,
        status: "SUCCESS",
      },
    });

    return updated;
  });

  return {
    success: true,
    message: `₹${topupRecord.amount} added to your Tiffzy Wallet`,
    balance: round2(updatedWallet.balance),
    amount: topupRecord.amount,
    topupTxnId: topupRecord.topupTxnId,
  };
};

/**
 * Pay Food Order using Tiffzy Wallet
 */
export const payOrderWithWallet = async (
  passedPrisma,
  { customerAccountId, orderId, amount, customerPhone, idempotencyKey }
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
  return await prisma.$transaction(async (tx) => {
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
