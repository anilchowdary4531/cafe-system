import { prisma } from "../config/prisma.js";
import {
  createOrUpdateBillSplits,
  recordSessionPayment,
} from "../services/splitBillingService.js";

const getActor = (req) => ({
  userId: req.user?.id || req.user?.userId || null,
  userName: req.user?.name || req.user?.userName || "Staff",
  role: req.user?.role || "WAITER",
  restaurantId: req.user?.restaurantId || null,
});

// 1. CREATE OR UPDATE BILL SPLITS
export async function createBillSplitsController(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
    const tableSessionId = Number(req.params.sessionId || req.body?.tableSessionId);
    const { splitType, splits, splitCount, customAmounts } = req.body || {};

    if (!restaurantId || !tableSessionId) {
      return reply.code(400).send({ message: "restaurantId and tableSessionId are required" });
    }

    const actor = getActor(req);
    const createdSplits = await createOrUpdateBillSplits({
      prisma,
      restaurantId,
      tableSessionId,
      splitType: splitType || "ITEM",
      splitsInput: splits || [],
      splitCount: splitCount || 2,
      customAmounts: customAmounts || [],
      actor,
    });

    return reply.send({
      success: true,
      message: `Created ${createdSplits.length} bill splits successfully`,
      splits: createdSplits,
    });
  } catch (err) {
    console.error("Error creating bill splits:", err);
    return reply.code(400).send({
      message: err.message || "Failed to create bill splits",
      code: err.code || "split_failed",
    });
  }
}

// 2. GET BILL SPLITS FOR SESSION
export async function getBillSplitsController(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
    const tableSessionId = Number(req.params.sessionId);

    if (!restaurantId || !tableSessionId) {
      return reply.code(400).send({ message: "restaurantId and tableSessionId are required" });
    }

    const splits = await prisma.billSplit.findMany({
      where: { restaurantId, tableSessionId },
      include: {
        items: { include: { orderItem: true } },
        payments: true,
      },
      orderBy: { splitNo: "asc" },
    });

    return reply.send({ success: true, splits });
  } catch (err) {
    console.error("Error fetching bill splits:", err);
    return reply.code(500).send({ message: err.message || "Failed to fetch bill splits" });
  }
}

// 3. RECORD PAYMENT (SINGLE / MULTI / PARTIAL)
export async function recordPaymentController(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
    const tableSessionId = Number(req.params.sessionId || req.body?.tableSessionId);
    const { billSplitId, paymentMode, amount, amountReceived, transactionId, idempotencyKey } = req.body || {};

    if (!restaurantId || !tableSessionId || !amount) {
      return reply.code(400).send({ message: "restaurantId, tableSessionId, and amount are required" });
    }

    const actor = getActor(req);
    const result = await recordSessionPayment({
      prisma,
      restaurantId,
      tableSessionId,
      billSplitId: billSplitId ? Number(billSplitId) : null,
      paymentMode: paymentMode || "CASH",
      amount: Number(amount),
      amountReceived: amountReceived !== undefined ? Number(amountReceived) : Number(amount),
      transactionId,
      idempotencyKey,
      actor,
    });

    // Realtime notification
    if (req.server?.realtime?.emitTableSessionUpdated) {
      req.server.realtime.emitTableSessionUpdated(result.session);
    }

    return reply.send({
      success: true,
      message: result.isFullyPaid ? "Payment completed. Session closed." : `Partial payment of ₹${amount} recorded successfully.`,
      result,
    });
  } catch (err) {
    console.error("Error recording payment:", err);
    return reply.code(400).send({
      message: err.message || "Failed to record payment",
      code: err.code || "payment_failed",
    });
  }
}

// 4. GET PAYMENT HISTORY
export async function getPaymentHistoryController(req, reply) {
  try {
    const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
    const tableSessionId = Number(req.params.sessionId);

    if (!restaurantId || !tableSessionId) {
      return reply.code(400).send({ message: "restaurantId and tableSessionId are required" });
    }

    const payments = await prisma.payment.findMany({
      where: { restaurantId, tableSessionId },
      include: { billSplit: true },
      orderBy: { createdAt: "desc" },
    });

    const totalPaid = payments
      .filter((p) => p.status === "SUCCESS")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return reply.send({ success: true, payments, totalPaid });
  } catch (err) {
    console.error("Error fetching payment history:", err);
    return reply.code(500).send({ message: err.message || "Failed to fetch payment history" });
  }
}
