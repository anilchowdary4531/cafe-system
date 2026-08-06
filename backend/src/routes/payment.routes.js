import { buildPaymentController } from "../controllers/payment.controller.js";

export default async function paymentRoutes(app, deps = {}) {
  const prisma = deps.prisma;
  const paymentController = buildPaymentController({ prisma });

  // Endpoint: POST /api/payments/create-order
  app.post("/api/payments/create-order", paymentController.createOrder);

  // Verification Endpoints: POST /api/payments/verify, /api/payments/status, /payments/status
  app.post("/api/payments/verify", paymentController.verifyOrder);
  app.post("/api/payments/status", paymentController.verifyOrder);
  app.post("/payments/status", paymentController.verifyOrder);

  // Webhook Endpoints: POST /api/payments/webhook, /payments/webhook
  app.post("/api/payments/webhook", paymentController.handleWebhook);
  app.post("/payments/webhook", paymentController.handleWebhook);
}
