import {
  openSession,
  getSession,
  getActiveRestaurantSessions,
  addItems,
  generateBill,
  updatePaymentStatus,
  closeSession,
} from "../controllers/tableSessionsController.js";

export default async function tableSessionRoutes(fastify) {
  // Table Session endpoints
  fastify.post("/tables/:tableId/session", openSession);
  fastify.post("/owner/:restaurantId/tables/:tableId/session", openSession);

  fastify.get("/tables/:tableId/session", getSession);
  fastify.get("/tables/session/:sessionId", getSession);
  fastify.get("/owner/:restaurantId/tables/sessions/active", getActiveRestaurantSessions);

  fastify.post("/tables/:tableId/session/items", addItems);
  fastify.post("/owner/session/:sessionId/add-items", addItems);

  fastify.post("/tables/sessions/:sessionId/bill", generateBill);
  fastify.post("/tables/sessions/:sessionId/payment", updatePaymentStatus);

  fastify.post("/tables/sessions/:sessionId/close", closeSession);
  fastify.post("/tables/:tableId/session/close", closeSession);
  fastify.post("/owner/session/:sessionId/close", closeSession);
}
