import { buildPaymentController } from "../controllers/payment.controller.js";

export default async function paymentRoutes(app, deps = {}) {
  const prisma = deps.prisma;
  const paymentController = buildPaymentController({ prisma });

  // Endpoint: POST /api/payments/create-order
  app.post("/api/payments/create-order", paymentController.createOrder);

  // Alias endpoint: POST /payments/create-order for maximum framework compatibility
  app.post("/payments/create-order", paymentController.createOrder);

  // Verification Endpoints: POST /api/payments/verify, /payments/verify, /payments/status
  app.post("/api/payments/verify", paymentController.verifyOrder);
  app.post("/payments/verify", paymentController.verifyOrder);
  app.post("/payments/status", paymentController.verifyOrder);
}
