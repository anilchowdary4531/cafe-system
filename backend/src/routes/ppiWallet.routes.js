/**
 * Cashfree PPI Wallet Routes
 */

import defaultPrisma from "../prisma.js";
import { isPpiConfigured, getPpiConfigStatus } from "../config/cashfreePpi.config.js";
import {
  createPpiUser,
  createWallet,
  getWalletDetails,
  getWalletStatement,
  debitWallet,
} from "../services/cashfreePpiService.js";
import { verifyCashfreeWebhookSignature } from "../services/cashfree.service.js";
import { verifyAndCreditTopup } from "../services/walletService.js";

export default async function ppiWalletRoutes(app, deps) {
  const prisma = deps?.prisma || defaultPrisma;

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

  const respondPpiUnconfigured = (reply) => {
    return reply.code(503).send({
      success: false,
      code: "PPI_NOT_CONFIGURED",
      message: "Cashfree PPI Wallet integration is currently pending partner onboarding approval (Ticket ID: 8374090).",
      status: getPpiConfigStatus(),
    });
  };

  // GET /api/v1/wallet/ppi/status
  app.get("/api/v1/wallet/ppi/status", async (req, reply) => {
    return {
      success: true,
      ppiStatus: getPpiConfigStatus(),
    };
  });

  // POST /api/v1/wallet/ppi/user
  app.post("/api/v1/wallet/ppi/user", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const result = await createPpiUser({
        phone: req.customerAccount.phone,
        name: req.customerAccount.name,
        email: req.customerAccount.email,
      });
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // POST /api/v1/wallet/ppi/create
  app.post("/api/v1/wallet/ppi/create", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const { cashfreePpiUserId } = req.body || {};
      const result = await createWallet({ cashfreePpiUserId });
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // GET /api/v1/wallet/ppi/balance
  app.get("/api/v1/wallet/ppi/balance", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { customerAccountId: req.customerAccount.id },
      });
      if (!wallet || !wallet.walletId) {
        return reply.code(404).send({ message: "PPI wallet not provisioned for customer" });
      }

      const result = await getWalletDetails({ cashfreeWalletId: wallet.walletId });
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // POST /api/v1/wallet/ppi/pay
  app.post("/api/v1/wallet/ppi/pay", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const { orderId, amount, idempotencyKey } = req.body || {};
      const wallet = await prisma.wallet.findUnique({
        where: { customerAccountId: req.customerAccount.id },
      });

      if (!wallet || !wallet.walletId) {
        return reply.code(404).send({ message: "PPI wallet not provisioned for customer" });
      }

      const result = await debitWallet({
        cashfreeWalletId: wallet.walletId,
        amount,
        orderId,
        idempotencyKey,
      });
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // GET /api/v1/wallet/ppi/transactions
  app.get("/api/v1/wallet/ppi/transactions", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { customerAccountId: req.customerAccount.id },
      });
      if (!wallet || !wallet.walletId) {
        return reply.code(404).send({ message: "PPI wallet not provisioned for customer" });
      }

      const result = await getWalletStatement({
        cashfreeWalletId: wallet.walletId,
        page: req.query?.page,
        limit: req.query?.limit,
      });
      return { success: true, ...result };
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // POST /api/v1/wallet/ppi/webhook -> Handle Webhooks securely
  app.post("/api/v1/wallet/ppi/webhook", async (req, reply) => {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

    // Verify HMAC SHA-256 signature if credentials are set
    if (signature && timestamp) {
      const isValid = verifyCashfreeWebhookSignature({ signature, rawBody, timestamp });
      if (!isValid) {
        console.warn("[PPI Webhook] Invalid webhook signature from Cashfree");
        return reply.code(401).send({ status: "REJECTED", message: "Invalid webhook signature" });
      }
    }

    try {
      const eventData = req.body?.data || req.body || {};
      const eventType = String(req.body?.type || eventData.event_type || "").toUpperCase();

      console.log(`[PPI Webhook] Processing event ${eventType}:`, eventData);

      if (eventType.includes("PAYMENT_SUCCESS") || eventType.includes("TOPUP_SUCCESS")) {
        const orderId = eventData.order?.order_id || eventData.order_id;
        const paymentId = eventData.payment?.cf_payment_id || eventData.cf_payment_id;

        if (orderId && String(orderId).startsWith("TOPUP_")) {
          const topupRecord = await prisma.walletTopup.findUnique({
            where: { topupTxnId: String(orderId) },
          });

          if (topupRecord && topupRecord.status !== "SUCCESS") {
            await verifyAndCreditTopup(prisma, {
              customerAccountId: topupRecord.customerAccountId,
              topupTxnId: topupRecord.topupTxnId,
              gatewayOrderId: orderId,
              gatewayPaymentId: paymentId,
              idempotencyKey: `WH_${orderId}`,
            });
          }
        }
      }

      return reply.code(200).send({ status: "SUCCESS" });
    } catch (err) {
      console.error("[PPI Webhook] Processing error:", err.message);
      return reply.code(200).send({ status: "ERROR_HANDLED", message: err.message });
    }
  });
}
