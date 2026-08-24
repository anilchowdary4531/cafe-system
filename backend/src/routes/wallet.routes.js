import defaultPrisma from "../prisma.js";
import {
  getWalletSummary,
  getWalletTransactions,
  createTopupSession,
  verifyAndCreditTopup,
  payOrderWithWallet,
  refundOrderToWallet,
  WALLET_CONFIG,
} from "../services/walletService.js";

export default async function walletRoutes(app, deps) {
  const prisma = deps?.prisma || defaultPrisma;

  // Middleware: Require Customer Authentication
  const requireCustomer = async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ message: "Customer authentication token required" });
      }
      const token = authHeader.split(" ")[1];
      const decoded = app.jwt.verify(token);

      if (!decoded || (!decoded.customerAccountId && !decoded.id)) {
        return reply.code(401).send({ message: "Invalid or expired customer token" });
      }

      const customerAccountId = decoded.customerAccountId || decoded.id;
      const account = await prisma.customerAccount.findUnique({
        where: { id: Number(customerAccountId) },
      });

      if (!account) {
        return reply.code(401).send({ message: "Customer account not found" });
      }

      req.customerAccount = account;
    } catch (err) {
      return reply.code(401).send({ message: "Unauthorized customer access" });
    }
  };

  // Middleware: Require Super Admin Authentication
  const requireSuperAdmin = async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ message: "Super Admin token required" });
      }
      const token = authHeader.split(" ")[1];
      const decoded = app.jwt.verify(token);
      if (!decoded || decoded.role !== "SUPER_ADMIN") {
        return reply.code(403).send({ message: "Super Admin access required" });
      }
    } catch (err) {
      return reply.code(401).send({ message: "Unauthorized admin access" });
    }
  };

  // ==========================================
  // CUSTOMER WALLET ENDPOINTS
  // ==========================================

  // GET /api/wallet -> Get Wallet Balance & Details
  app.get("/api/wallet", { preHandler: requireCustomer }, async (req, reply) => {
    try {
      const wallet = await getWalletSummary(prisma, req.customerAccount.id);
      return { wallet, limits: WALLET_CONFIG };
    } catch (err) {
      console.error("[Wallet] GET /api/wallet error:", err);
      return reply.code(500).send({ message: err.message || "Failed to fetch wallet summary" });
    }
  });

  // GET /api/wallet/transactions -> Get Ledger Transaction History
  app.get("/api/wallet/transactions", { preHandler: requireCustomer }, async (req, reply) => {
    try {
      const { page, limit, type, direction } = req.query || {};
      const history = await getWalletTransactions(prisma, req.customerAccount.id, {
        page,
        limit,
        type,
        direction,
      });
      return history;
    } catch (err) {
      console.error("[Wallet] GET /api/wallet/transactions error:", err);
      return reply.code(500).send({ message: err.message || "Failed to fetch transaction history" });
    }
  });

  // POST /api/wallet/topup/create -> Initiate Cashfree Top-Up Session
  app.post("/api/wallet/topup/create", { preHandler: requireCustomer }, async (req, reply) => {
    try {
      const { amount, returnUrl, idempotencyKey } = req.body || {};
      const session = await createTopupSession(prisma, req.customerAccount.id, {
        amount,
        customerName: req.customerAccount.name,
        customerEmail: req.customerAccount.email,
        customerPhone: req.customerAccount.phone,
        returnUrl,
        idempotencyKey,
      });
      return { success: true, session };
    } catch (err) {
      console.error("[Wallet] Top-up create error:", err);
      return reply.code(400).send({ message: err.message || "Failed to create top-up session" });
    }
  });

  // POST /api/wallet/topup/verify -> Verify Cashfree Top-Up & Credit Wallet
  app.post("/api/wallet/topup/verify", { preHandler: requireCustomer }, async (req, reply) => {
    try {
      const { topupTxnId, gatewayOrderId, gatewayPaymentId, idempotencyKey } = req.body || {};
      if (!topupTxnId) {
        return reply.code(400).send({ message: "topupTxnId is required for verification" });
      }

      const result = await verifyAndCreditTopup(prisma, {
        customerAccountId: req.customerAccount.id,
        topupTxnId,
        gatewayOrderId,
        gatewayPaymentId,
        idempotencyKey,
      });
      return result;
    } catch (err) {
      console.error("[Wallet] Top-up verify error:", err);
      return reply.code(400).send({ message: err.message || "Top-up verification failed" });
    }
  });

  // POST /api/wallet/pay-order -> Pay Food Order using Wallet
  app.post("/api/wallet/pay-order", { preHandler: requireCustomer }, async (req, reply) => {
    try {
      const { orderId, amount, idempotencyKey } = req.body || {};
      if (!orderId || !amount) {
        return reply.code(400).send({ message: "orderId and amount are required" });
      }

      const result = await payOrderWithWallet(prisma, {
        customerAccountId: req.customerAccount.id,
        orderId,
        amount,
        idempotencyKey,
      });
      return result;
    } catch (err) {
      console.error("[Wallet] Pay order error:", err);
      return reply.code(400).send({ message: err.message || "Wallet order payment failed" });
    }
  });

  // ==========================================
  // SUPER ADMIN WALLET MANAGEMENT ENDPOINTS
  // ==========================================

  // GET /super-admin/wallets -> Admin Wallet Dashboard & Directory
  app.get("/super-admin/wallets", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const [totalWallets, aggregate, topups, recentLedgers] = await Promise.all([
        prisma.wallet.count(),
        prisma.wallet.aggregate({ _sum: { balance: true } }),
        prisma.walletTopup.aggregate({
          where: { status: "SUCCESS" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.walletLedger.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            wallet: {
              include: {
                customerAccount: { select: { id: true, name: true, phone: true, email: true } },
              },
            },
          },
        }),
      ]);

      const totalBalance = Math.round(Number(aggregate._sum.balance || 0) * 100) / 100;
      const totalTopupAmount = Math.round(Number(topups._sum.amount || 0) * 100) / 100;

      return {
        metrics: {
          totalWallets,
          totalBalance,
          totalTopupsCount: topups._count || 0,
          totalTopupAmount,
          currency: WALLET_CONFIG.CURRENCY,
        },
        recentLedgers: recentLedgers.map((l) => ({
          id: l.id,
          type: l.type,
          direction: l.direction,
          amount: Math.round(Number(l.amount) * 100) / 100,
          balanceAfter: Math.round(Number(l.balanceAfter) * 100) / 100,
          description: l.description,
          customerName: l.wallet?.customerAccount?.name || "Customer",
          customerPhone: l.wallet?.customerAccount?.phone || "N/A",
          createdAt: l.createdAt,
        })),
      };
    } catch (err) {
      console.error("[SuperAdminWallet] Overview error:", err);
      return reply.code(500).send({ message: "Failed to fetch admin wallet metrics" });
    }
  });

  // POST /super-admin/wallets/adjust -> Manual Admin Wallet Adjustment
  app.post("/super-admin/wallets/adjust", { preHandler: requireSuperAdmin }, async (req, reply) => {
    try {
      const { customerAccountId, amount, type = "CREDIT", reason } = req.body || {};
      if (!customerAccountId || !amount || !reason) {
        return reply.code(400).send({ message: "customerAccountId, amount, and reason are required" });
      }

      const numAmount = Math.round(Number(amount) * 100) / 100;
      if (numAmount <= 0) return reply.code(400).send({ message: "Amount must be positive" });

      const isCredit = String(type).toUpperCase() === "CREDIT";

      const wallet = await prisma.wallet.findUnique({
        where: { customerAccountId: Number(customerAccountId) },
      });

      if (!wallet) return reply.code(404).send({ message: "Customer wallet not found" });

      const result = await prisma.$transaction(async (tx) => {
        const fresh = await tx.wallet.findUnique({ where: { id: wallet.id } });
        const balanceBefore = Math.round(Number(fresh.balance) * 100) / 100;

        if (!isCredit && balanceBefore < numAmount) {
          throw new Error(`Insufficient wallet balance for debit. Current balance: ₹${balanceBefore}`);
        }

        const balanceAfter = isCredit
          ? Math.round((balanceBefore + numAmount) * 100) / 100
          : Math.round((balanceBefore - numAmount) * 100) / 100;

        const updated = await tx.wallet.update({
          where: { id: fresh.id },
          data: { balance: balanceAfter },
        });

        await tx.walletLedger.create({
          data: {
            walletId: fresh.id,
            customerAccountId: fresh.customerAccountId,
            type: isCredit ? "ADJUSTMENT_CREDIT" : "ADJUSTMENT_DEBIT",
            direction: isCredit ? "CREDIT" : "DEBIT",
            amount: numAmount,
            balanceBefore,
            balanceAfter,
            referenceType: "ADMIN",
            description: `Super Admin Manual Adjustment: ${reason}`,
            idempotencyKey: `ADM_ADJ_${fresh.id}_${Date.now()}`,
            status: "SUCCESS",
          },
        });

        return updated;
      });

      return {
        success: true,
        message: `Wallet ${isCredit ? "credited" : "debited"} ₹${numAmount} successfully`,
        newBalance: Math.round(Number(result.balance) * 100) / 100,
      };
    } catch (err) {
      console.error("[SuperAdminWallet] Adjust error:", err);
      return reply.code(400).send({ message: err.message || "Failed to adjust wallet" });
    }
  });
}
