import {
  openSession,
  getSession,
  getActiveRestaurantSessions,
  addItems,
  generateBill,
  updatePaymentStatus,
  closeSession,
} from "../controllers/tableSessionsController.js";
import {
  moveTable,
  mergeTables,
  splitTableOrTransferItems,
} from "../controllers/tableOperationController.js";

import {
  createBillSplitsController,
  getBillSplitsController,
  recordPaymentController,
  getPaymentHistoryController,
} from "../controllers/splitBillingController.js";
import { requireStaffJwt } from "../services/staffAuthService.js";

export default async function tableSessionRoutes(fastify, deps = {}) {
  const prisma = deps.prisma;
  const allowedRoles = deps.STAFF_ALLOWED_ROLES || [
    "SUPER_ADMIN",
    "OWNER",
    "MANAGER",
    "WAITER",
    "CHEF",
    "CASHIER",
    "STAFF",
  ];

  const requireTableSessionAccess = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma,
      allowedRoles,
    });
    if (!actor) return reply;
    req.staffActor = actor;
    req.user = req.user || actor;

    if (actor.role === "SUPER_ADMIN") return null;

    const actorRid = Number(actor.restaurantId || 0);

    // 1. Validate restaurantId in params if present
    const paramRid = Number(req.params.restaurantId || 0);
    if (paramRid && actorRid && paramRid !== actorRid) {
      return reply.code(403).send({ message: "Restaurant access denied" });
    }

    // 2. Validate sessionId belongs to actor's restaurant
    const sessionId = Number(
      req.params.sessionId || req.body?.sessionId || req.body?.tableSessionId || 0
    );
    if (sessionId && prisma) {
      const sess = await prisma.tableSession.findUnique({
        where: { id: sessionId },
        select: { restaurantId: true },
      });
      if (!sess) {
        return reply.code(404).send({ message: "Session not found" });
      }
      if (sess.restaurantId !== actorRid) {
        return reply.code(403).send({ message: "Restaurant access denied" });
      }
    }

    // 3. Validate tableId belongs to actor's restaurant
    const tableId = Number(
      req.params.tableId || req.body?.tableId || req.body?.sourceTableId || 0
    );
    if (tableId && prisma) {
      const tbl = await prisma.diningTable.findUnique({
        where: { id: tableId },
        select: { restaurantId: true },
      });
      if (!tbl) {
        return reply.code(404).send({ message: "Table not found" });
      }
      if (tbl.restaurantId !== actorRid) {
        return reply.code(403).send({ message: "Restaurant access denied" });
      }
    }

    // 4. Validate targetTableId in move/merge/transfer if present
    const targetTableId = Number(req.body?.targetTableId || req.body?.secondaryTableId || 0);
    if (targetTableId && prisma) {
      const targetTbl = await prisma.diningTable.findUnique({
        where: { id: targetTableId },
        select: { restaurantId: true },
      });
      if (!targetTbl) {
        return reply.code(404).send({ message: "Target table not found" });
      }
      if (targetTbl.restaurantId !== actorRid) {
        return reply.code(403).send({ message: "Restaurant access denied" });
      }
    }

    return null;
  };

  const opts = { preHandler: requireTableSessionAccess };

  // Table Session endpoints
  fastify.post("/tables/:tableId/session", opts, openSession);
  fastify.post("/owner/:restaurantId/tables/:tableId/session", opts, openSession);

  fastify.get("/tables/:tableId/session", opts, getSession);
  fastify.get("/tables/session/:sessionId", opts, getSession);
  fastify.get("/owner/:restaurantId/tables/sessions/active", opts, getActiveRestaurantSessions);

  fastify.post("/tables/:tableId/session/items", opts, addItems);
  fastify.post("/owner/session/:sessionId/add-items", opts, addItems);

  // Table Operations: Move, Merge, Split, Item Transfer
  fastify.post("/tables/:tableId/move", opts, moveTable);
  fastify.post("/tables/:tableId/merge", opts, mergeTables);
  fastify.post("/tables/:tableId/split", opts, splitTableOrTransferItems);
  fastify.post("/tables/:tableId/transfer-items", opts, splitTableOrTransferItems);

  // Split Billing & Multi-Payment Endpoints
  fastify.post("/tables/sessions/:sessionId/split-bill", opts, createBillSplitsController);
  fastify.post("/owner/:restaurantId/tables/sessions/:sessionId/split-bill", opts, createBillSplitsController);

  fastify.get("/tables/sessions/:sessionId/splits", opts, getBillSplitsController);
  fastify.get("/owner/:restaurantId/tables/sessions/:sessionId/splits", opts, getBillSplitsController);

  fastify.post("/tables/sessions/:sessionId/record-payment", opts, recordPaymentController);
  fastify.post("/owner/:restaurantId/tables/sessions/:sessionId/record-payment", opts, recordPaymentController);

  fastify.get("/tables/sessions/:sessionId/payment-history", opts, getPaymentHistoryController);
  fastify.get("/owner/:restaurantId/tables/sessions/:sessionId/payment-history", opts, getPaymentHistoryController);

  fastify.post("/tables/sessions/:sessionId/bill", opts, generateBill);
  fastify.post("/tables/sessions/:sessionId/payment", opts, updatePaymentStatus);

  fastify.post("/tables/sessions/:sessionId/close", opts, closeSession);
  fastify.post("/tables/:tableId/session/close", opts, closeSession);
  fastify.post("/owner/session/:sessionId/close", opts, closeSession);
}
