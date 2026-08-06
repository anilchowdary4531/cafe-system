import { buildPaymentController } from "../controllers/payment.controller.js";

export default async function paymentRoutes(app, deps = {}) {
  const prisma = deps.prisma;
  const paymentController = buildPaymentController({ prisma });

  // Endpoint: POST /api/payments/create-order
  app.post("/api/payments/create-order", paymentController.createOrder);

  // Alias endpoint: POST /payments/create-order for maximum framework compatibility
  app.post("/payments/create-order", paymentController.createOrder);
}
