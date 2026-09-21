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

export default async function tableSessionRoutes(fastify) {
  // Table Session endpoints
  fastify.post("/tables/:tableId/session", openSession);
  fastify.post("/owner/:restaurantId/tables/:tableId/session", openSession);

  fastify.get("/tables/:tableId/session", getSession);
  fastify.get("/tables/session/:sessionId", getSession);
  fastify.get("/owner/:restaurantId/tables/sessions/active", getActiveRestaurantSessions);

  fastify.post("/tables/:tableId/session/items", addItems);
  fastify.post("/owner/session/:sessionId/add-items", addItems);

  // Table Operations: Move, Merge, Split, Item Transfer
  fastify.post("/tables/:tableId/move", moveTable);
  fastify.post("/owner/:restaurantId/tables/:tableId/move", moveTable);

  fastify.post("/tables/:tableId/merge", mergeTables);
  fastify.post("/owner/:restaurantId/tables/:tableId/merge", mergeTables);

  fastify.post("/tables/:tableId/split", splitTableOrTransferItems);
  fastify.post("/tables/:tableId/transfer-items", splitTableOrTransferItems);
  fastify.post("/owner/:restaurantId/tables/:tableId/transfer-items", splitTableOrTransferItems);

  // Split Billing & Multi-Payment Endpoints
  fastify.post("/tables/sessions/:sessionId/split-bill", createBillSplitsController);
  fastify.post("/owner/:restaurantId/tables/sessions/:sessionId/split-bill", createBillSplitsController);

  fastify.get("/tables/sessions/:sessionId/splits", getBillSplitsController);
  fastify.get("/owner/:restaurantId/tables/sessions/:sessionId/splits", getBillSplitsController);

  fastify.post("/tables/sessions/:sessionId/record-payment", recordPaymentController);
  fastify.post("/owner/:restaurantId/tables/sessions/:sessionId/record-payment", recordPaymentController);

  fastify.get("/tables/sessions/:sessionId/payment-history", getPaymentHistoryController);
  fastify.get("/owner/:restaurantId/tables/sessions/:sessionId/payment-history", getPaymentHistoryController);

  fastify.post("/tables/sessions/:sessionId/bill", generateBill);
  fastify.post("/tables/sessions/:sessionId/payment", updatePaymentStatus);

  fastify.post("/tables/sessions/:sessionId/close", closeSession);
  fastify.post("/tables/:tableId/session/close", closeSession);
  fastify.post("/owner/session/:sessionId/close", closeSession);
}
