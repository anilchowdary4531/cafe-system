import { buildPaymentController } from "../controllers/payment.controller.js";
import { buildSettlementController } from "../controllers/settlementController.js";
import { buildAdminSettlementController } from "../controllers/adminSettlementController.js";
import { validateCoupon, createCoupon, getCoupons } from "../controllers/coupon.controller.js";

export default async function paymentRoutes(app, deps = {}) {
  const prisma = deps.prisma;
  const paymentController = buildPaymentController({ prisma });
  const settlementController = buildSettlementController({ prisma });
  const adminSettlementController = buildAdminSettlementController({ prisma });

  // Endpoint: POST /api/payments/create-order
  app.post("/api/payments/create-order", paymentController.createOrder);

  // Verification Endpoints: GET /api/payments/status/:orderId, POST /api/payments/verify, /api/payments/status
  app.get("/api/payments/status/:orderId", paymentController.verifyOrder);
  app.get("/payments/status/:orderId", paymentController.verifyOrder);
  app.post("/api/payments/verify", paymentController.verifyOrder);
  app.post("/api/payments/status", paymentController.verifyOrder);
  app.post("/payments/status", paymentController.verifyOrder);

  // Webhook Endpoints: POST /api/payments/webhook, /payments/webhook
  app.post("/api/payments/webhook", paymentController.handleWebhook);
  app.post("/payments/webhook", paymentController.handleWebhook);

  // Health Check & Monitoring Endpoints: GET /api/payments/health, /payments/health
  app.get("/api/payments/health", paymentController.getHealthCheck);
  app.get("/payments/health", paymentController.getHealthCheck);

  // Refund Endpoints: POST /api/payments/refund, /payments/refund
  app.post("/api/payments/refund", paymentController.initiateRefund);
  app.post("/payments/refund", paymentController.initiateRefund);

  // Restaurant & Admin Settlement Endpoints: GET /api/restaurant/settlements, /api/restaurant/payments, /api/admin/settlements
  app.get("/api/restaurant/settlements", settlementController.getSummary);
  app.get("/api/restaurant/payments", settlementController.getOrders);
  app.get("/api/admin/settlements", adminSettlementController.getSummary);

  // Coupon Endpoints: POST /api/coupons/validate, /api/coupons/create, GET /api/coupons
  app.post("/api/coupons/validate", validateCoupon);
  app.post("/api/coupons/create", createCoupon);
  app.get("/api/coupons", getCoupons);

  // Delivery Partner Endpoints: POST /api/delivery/assign, POST /api/delivery/status, GET /api/delivery/partners
  const { assignDeliveryPartner, updateDeliveryStatus, getDeliveryPartners } = await import("../controllers/delivery.controller.js");
  app.post("/api/delivery/assign", assignDeliveryPartner);
  app.post("/api/delivery/status", updateDeliveryStatus);
  app.get("/api/delivery/partners", getDeliveryPartners);
}
