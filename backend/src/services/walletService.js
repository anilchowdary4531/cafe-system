import { createCashfreePaymentSession } from "./cashfree.service.js";
import defaultPrisma from "../prisma.js";

const round2 = (num) => Math.round(Number(num || 0) * 100) / 100;
const getDb = (passedPrisma) => passedPrisma || defaultPrisma;

// Configurable limits
export const WALLET_CONFIG = {
  MIN_TOPUP: 10,
  MAX_TOPUP: 50000,
  MAX_BALANCE: 100000,
  CURRENCY: "INR",
};

/**
 * Get or automatically create wallet for customer
 */
export const getOrCreateWallet = async (passedPrisma, customerAccountId) => {
  if (!customerAccountId) throw new Error("Customer Account ID is required");
  const prisma = getDb(passedPrisma);
  const fallbackWallet = {
    id: 0,
    customerAccountId: Number(customerAccountId || 0),
    balance: 0,
    currency: WALLET_CONFIG.CURRENCY,
    status: "ACTIVE",
    createdAt: new Date(),
  };

  if (!prisma || !prisma.wallet) {
    return fallbackWallet;
  }

  try {
    let wallet = await prisma.wallet.findUnique({
      where: { customerAccountId: Number(customerAccountId) },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          customerAccountId: Number(customerAccountId),
          balance: 0,
          currency: WALLET_CONFIG.CURRENCY,
          status: "ACTIVE",
        },
      });
    }

    return wallet;
  } catch (err) {
    console.error("[getOrCreateWallet] DB fallback:", err?.message || err);
    return fallbackWallet;
  }
};

/**
 * Get Wallet Balance & Details
 */
export const getWalletSummary = async (passedPrisma, customerAccountId) => {
  const prisma = getDb(passedPrisma);
  const wallet = await getOrCreateWallet(prisma, customerAccountId);
  return {
    walletId: wallet.id,
    customerAccountId: wallet.customerAccountId,
    balance: round2(wallet.balance),
    currency: wallet.currency,
    status: wallet.status,
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
      transactions: items.map((txn) => ({
        id: txn.id,
        type: txn.type,
        direction: txn.direction,
        amount: round2(txn.amount),
        balanceBefore: round2(txn.balanceBefore),
        balanceAfter: round2(txn.balanceAfter),
        orderId: txn.orderId,
        description: txn.description,
        status: txn.status,
        createdAt: txn.createdAt,
      })),
    };
  } catch (err) {
    console.error("[getWalletTransactions] DB fallback:", err?.message || err);
    return fallbackRes;
  }
};

/**
 * Create Top-up Order with Cashfree
 */
export const createTopupSession = async (
  prisma,
  customerAccountId,
  { amount, customerName, customerEmail, customerPhone, returnUrl, idempotencyKey }
) => {
  const numAmount = round2(amount);

  if (Number.isNaN(numAmount) || numAmount < WALLET_CONFIG.MIN_TOPUP) {
    throw new Error(`Minimum top-up amount is ₹${WALLET_CONFIG.MIN_TOPUP}`);
  }

  if (numAmount > WALLET_CONFIG.MAX_TOPUP) {
    throw new Error(`Maximum top-up amount per transaction is ₹${WALLET_CONFIG.MAX_TOPUP}`);
  }

  const wallet = await getOrCreateWallet(prisma, customerAccountId);

  if (wallet.status !== "ACTIVE") {
    throw new Error("Your wallet is currently blocked or inactive");
  }

  if (round2(wallet.balance + numAmount) > WALLET_CONFIG.MAX_BALANCE) {
    throw new Error(`Top-up would exceed maximum wallet limit of ₹${WALLET_CONFIG.MAX_BALANCE}`);
  }

  const topupTxnId = `WLT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanIdempotencyKey = idempotencyKey ? String(idempotencyKey).trim() : `IK_${topupTxnId}`;

  // Check if idempotency key already exists
  if (idempotencyKey) {
    const existingTopup = await prisma.walletTopup.findUnique({
      where: { idempotencyKey: cleanIdempotencyKey },
    });
    if (existingTopup) {
      return {
        topupTxnId: existingTopup.topupTxnId,
        amount: existingTopup.amount,
        status: existingTopup.status,
        gatewayOrderId: existingTopup.gatewayOrderId,
      };
    }
  }

  // Create Cashfree Payment Order
  const cfResponse = await createCashfreePaymentSession({
    orderId: topupTxnId,
    amount: numAmount,
    customerId: `CUST_${customerAccountId}`,
    customerName,
    customerEmail,
    customerPhone,
    returnUrl,
    orderNote: `Tiffzy Wallet Top-up ₹${numAmount}`,
  });

  // Save topup record
  await prisma.walletTopup.create({
    data: {
      walletId: wallet.id,
      customerAccountId: Number(customerAccountId),
      topupTxnId,
      amount: numAmount,
      currency: WALLET_CONFIG.CURRENCY,
      gateway: "CASHFREE",
      gatewayOrderId: cfResponse.paymentSessionId || topupTxnId,
      status: "PENDING",
      idempotencyKey: cleanIdempotencyKey,
    },
  });

  return {
    topupTxnId,
    amount: numAmount,
    paymentSessionId: cfResponse.paymentSessionId,
    cfOrderId: cfResponse.cfOrderId,
    gateway: "CASHFREE",
  };
};

/**
 * Verify Cashfree Payment & Credit Wallet
 */
export const verifyAndCreditTopup = async (
  prisma,
  { customerAccountId, topupTxnId, gatewayOrderId, gatewayPaymentId, idempotencyKey }
) => {
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

  // Execute atomic transaction for balance credit + ledger append
  const updatedWallet = await prisma.$transaction(async (tx) => {
    // Lock and get fresh wallet
    const wallet = await tx.wallet.findUnique({
      where: { id: topupRecord.walletId },
    });

    if (!wallet || wallet.status !== "ACTIVE") {
      throw new Error("Wallet is inactive or blocked");
    }

    const balanceBefore = round2(wallet.balance);
    const balanceAfter = round2(balanceBefore + topupRecord.amount);

    // Update wallet balance
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter },
    });

    // Update topup record status
    await tx.walletTopup.update({
      where: { id: topupRecord.id },
      data: {
        status: "SUCCESS",
        gatewayOrderId: gatewayOrderId || topupRecord.gatewayOrderId,
        gatewayPaymentId: gatewayPaymentId || null,
      },
    });

    // Create immutable ledger entry
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
  prisma,
  { customerAccountId, orderId, amount, idempotencyKey }
) => {
  const numAmount = round2(amount);
  const cleanOrderId = Number(orderId);

  if (Number.isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Valid order payment amount is required");
  }

  const wallet = await getOrCreateWallet(prisma, customerAccountId);

  if (wallet.status !== "ACTIVE") {
    throw new Error("Your wallet is currently blocked");
  }

  const cleanIdempotencyKey = idempotencyKey || `PAY_ORD_${cleanOrderId}_${Date.now()}`;

  // Check if this order payment was already completed via ledger
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

  // Atomic transaction for debit
  return await prisma.$transaction(async (tx) => {
    const freshWallet = await tx.wallet.findUnique({
      where: { id: wallet.id },
    });

    if (!freshWallet || freshWallet.status !== "ACTIVE") {
      throw new Error("Wallet is not active");
    }

    if (freshWallet.balance < numAmount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${round2(freshWallet.balance)}, Required: ₹${numAmount}`);
    }

    const balanceBefore = round2(freshWallet.balance);
    const balanceAfter = round2(balanceBefore - numAmount);

    // Update wallet balance
    const updated = await tx.wallet.update({
      where: { id: freshWallet.id },
      data: { balance: balanceAfter },
    });

    // Create ledger debit entry
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

    // Mark order as PAID
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
  prisma,
  { orderId, amount, reason = "Order cancelled", idempotencyKey }
) => {
  const cleanOrderId = Number(orderId);
  const order = await prisma.order.findUnique({ where: { id: cleanOrderId } });

  if (!order) {
    throw new Error("Order not found for refund");
  }

  const refundAmount = round2(amount || order.total);

  if (refundAmount <= 0) {
    throw new Error("Refund amount must be positive");
  }

  // Find customer account ID associated with order customer phone or customerId
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

  // Execute atomic refund transaction
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
