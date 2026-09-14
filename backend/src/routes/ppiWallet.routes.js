/**
 * Cashfree PPI Wallet Routes Skeleton
 *
 * NOTE: Preparation routes for future Cashfree PPI closed-loop wallet.
 * Pending official onboarding approval from Cashfree (Ticket ID: 8374090).
 */

import defaultPrisma from "../prisma.js";
import { isPpiConfigured, getPpiConfigStatus } from "../config/cashfreePpi.config.js";
import {
  createPpiUser,
  createWallet,
  getWalletDetails,
  getWalletStatement,
  creditWallet,
  debitWallet,
} from "../services/cashfreePpiService.js";

export default async function ppiWalletRoutes(app, deps) {
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

  // Helper response for unconfigured PPI operations
  const respondPpiUnconfigured = (reply) => {
    return reply.code(503).send({
      success: false,
      code: "PPI_NOT_CONFIGURED",
      message: "Cashfree PPI Wallet integration is currently pending partner onboarding approval (Ticket ID: 8374090).",
      status: getPpiConfigStatus(),
    });
  };

  // GET /api/v1/wallet/ppi/status -> Check PPI Integration Onboarding Status
  app.get("/api/v1/wallet/ppi/status", async (req, reply) => {
    return {
      success: true,
      ppiStatus: getPpiConfigStatus(),
    };
  });

  // POST /api/v1/wallet/ppi/user -> Create Cashfree PPI User
  app.post("/api/v1/wallet/ppi/user", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const result = await createPpiUser({
        phone: req.customerAccount.phone,
        name: req.customerAccount.name,
        email: req.customerAccount.email,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // POST /api/v1/wallet/ppi/create -> Create Cashfree PPI Wallet
  app.post("/api/v1/wallet/ppi/create", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const result = await createWallet({
        cashfreePpiUserId: req.body?.cashfreePpiUserId,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // GET /api/v1/wallet/ppi/balance -> Get PPI Wallet Balance
  app.get("/api/v1/wallet/ppi/balance", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const result = await getWalletDetails({
        cashfreeWalletId: req.query?.cashfreeWalletId,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // POST /api/v1/wallet/ppi/topup/session -> Initiate PG Top-Up for PPI Wallet
  app.post("/api/v1/wallet/ppi/topup/session", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    return reply.code(503).send({ message: "PPI top-up sessions will be activated upon Cashfree onboarding completion." });
  });

  // POST /api/v1/wallet/ppi/pay -> Pay Order using Cashfree PPI Wallet
  app.post("/api/v1/wallet/ppi/pay", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const { orderId, amount, idempotencyKey } = req.body || {};
      const result = await debitWallet({
        cashfreeWalletId: req.body?.cashfreeWalletId,
        amount,
        orderId,
        idempotencyKey,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // GET /api/v1/wallet/ppi/transactions -> Get PPI Transaction History
  app.get("/api/v1/wallet/ppi/transactions", { preHandler: requireCustomer }, async (req, reply) => {
    if (!isPpiConfigured()) return respondPpiUnconfigured(reply);
    try {
      const result = await getWalletStatement({
        cashfreeWalletId: req.query?.cashfreeWalletId,
        page: req.query?.page,
        limit: req.query?.limit,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ message: err.message });
    }
  });

  // POST /api/v1/wallet/ppi/webhook -> Handle Cashfree PPI Webhook Events
  app.post("/api/v1/wallet/ppi/webhook", async (req, reply) => {
    if (!isPpiConfigured()) {
      return reply.code(200).send({ status: "RECEIVED_BUT_UNCONFIGURED", message: "PPI Webhook received but PPI integration is unconfigured." });
    }
    return reply.code(200).send({ status: "ACKNOWLEDGED" });
  });
}
