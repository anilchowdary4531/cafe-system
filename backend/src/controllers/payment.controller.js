import { validateCreateOrderPayload } from "../middleware/paymentValidation.js";
import { createCashfreePaymentSession, verifyCashfreeOrderSession, verifyCashfreeWebhookSignature, getPaymentMetrics } from "../services/cashfree.service.js";

export const buildPaymentController = ({ prisma }) => {
  const createOrder = async (req, reply) => {
    try {
      const body = req.body || {};
      const validation = validateCreateOrderPayload(body);

      if (!validation.isValid) {
        return reply.code(400).send({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const {
        orderId,
        amount,
        customerId,
        restaurantId,
        customerPhone: inputPhone,
        customerName: inputName,
        customerEmail: inputEmail,
        returnUrl,
      } = validation.data;

      let resolvedName = inputName;
      let resolvedPhone = inputPhone;
      let resolvedEmail = inputEmail;

      // Look up customer in Prisma DB if customerId is provided
      if (customerId && prisma) {
        try {
          const numericId = Number(customerId);
          let dbAccount = null;

          if (!Number.isNaN(numericId)) {
            dbAccount = await prisma.customerAccount.findUnique({
              where: { id: numericId },
            });
          }

          if (!dbAccount && customerId) {
            dbAccount = await prisma.customerAccount.findFirst({
              where: {
                OR: [
                  { phone: String(customerId) },
                  { email: String(customerId).toLowerCase() },
                  { username: String(customerId).toLowerCase() },
                ],
              },
            });
          }

          if (dbAccount) {
            resolvedName = resolvedName || dbAccount.name || dbAccount.username || "Customer";
            resolvedPhone = resolvedPhone || dbAccount.phone || null;
            resolvedEmail = resolvedEmail || dbAccount.email || null;
          }
        } catch (dbErr) {
          console.warn("[PaymentController] Customer lookup warning:", dbErr.message);
        }
      }

      // Resolve restaurant vendor and commission settings if restaurantId is provided
      let resolvedVendorId = body.vendorId || body.vendor_id || null;
      let commissionType = body.commissionType || body.commission_type || process.env.COMMISSION_TYPE || "PERCENTAGE";
      let commissionValue = body.commissionValue !== undefined ? body.commissionValue : (process.env.COMMISSION_VALUE !== undefined ? Number(process.env.COMMISSION_VALUE) : 10);

      if (restaurantId && prisma && !resolvedVendorId) {
        try {
          const numericRestId = Number(restaurantId);
          let dbRest = null;
          if (!Number.isNaN(numericRestId)) {
            dbRest = await prisma.restaurant.findUnique({
              where: { id: numericRestId },
            });
          }
          if (dbRest) {
            resolvedVendorId = `vendor_rest_${dbRest.id}`;
          }
        } catch (rErr) {
          console.warn("[PaymentController] Restaurant lookup warning:", rErr.message);
        }
      }

      // Generate Cashfree payment session with Easy Split
      const result = await createCashfreePaymentSession({
        orderId,
        amount,
        customerId: customerId || "guest",
        customerPhone: resolvedPhone,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        restaurantId,
        returnUrl,
        vendorId: resolvedVendorId,
        commissionType,
        commissionValue,
      });

      return reply.code(200).send({
        payment_session_id: result.payment_session_id,
        order_id: result.order_id,
        cf_order_id: result.cf_order_id,
        order_status: result.order_status,
        settlement: result.settlement,
      });
    } catch (err) {
      console.error("[PaymentController] createOrder Error:", err);
      return reply.code(500).send({
        success: false,
        message: err.message || "Failed to create Cashfree payment order session",
      });
    }
  };

  const verifyOrder = async (req, reply) => {
    try {
      const body = req.body || {};
      const orderId = String(body.orderId || body.order_id || "").trim();

      if (!orderId) {
        return reply.code(400).send({
          success: false,
          message: "orderId is required for verification",
        });
      }

      // 1. Idempotency Check: Look up existing Order in Prisma DB
      let existingOrder = null;
      if (prisma) {
        try {
          const numericId = Number(orderId);
          if (!Number.isNaN(numericId)) {
            existingOrder = await prisma.order.findUnique({
              where: { id: numericId },
            });
          }

          if (!existingOrder) {
            existingOrder = await prisma.order.findFirst({
              where: {
                OR: [
                  { orderNo: orderId },
                  { invoiceNo: orderId },
                ],
              },
            });
          }
        } catch (dbErr) {
          console.warn("[PaymentController] DB order lookup warning:", dbErr.message);
        }
      }

      // If already verified & paid in DB, return immediately (Anti-Duplicate / Idempotent)
      if (existingOrder && (existingOrder.paymentStatus === "PAID" || existingOrder.status === "PAID" || existingOrder.status === "COMPLETED")) {
        return reply.code(200).send({
          verified: true,
          status: "SUCCESS",
          message: "Order is already verified and paid",
          orderId: orderId,
          amount: existingOrder.total || existingOrder.amount,
          invoiceUrl: existingOrder.invoiceS3Url || `/invoice/${existingOrder.id}`,
        });
      }

      // 2. Direct Verification with Cashfree API (Never trust client callback alone)
      const cfResult = await verifyCashfreeOrderSession({ orderId });

      if (cfResult.isPaid) {
        // Update Order in database to PAID & CONFIRMED
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: {
                paymentStatus: "PAID",
                status: "CONFIRMED",
                paymentMethod: cfResult.paymentMethod || "CASHFREE",
              },
            });
          } catch (updateErr) {
            console.error("[PaymentController] Order DB update error:", updateErr.message);
          }
        }

        return reply.code(200).send({
          verified: true,
          status: "SUCCESS",
          message: cfResult.txMsg || "Payment verified successfully",
          orderId: orderId,
          amount: cfResult.orderAmount,
          invoiceUrl: existingOrder ? `/invoice/${existingOrder.id}` : null,
        });
      } else if (cfResult.orderStatus === "FAILED" || cfResult.orderStatus === "CANCELLED" || cfResult.orderStatus === "EXPIRED") {
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: { paymentStatus: "FAILED" },
            });
          } catch (e) {
            // Ignore failure update error
          }
        }

        return reply.code(200).send({
          verified: false,
          status: cfResult.orderStatus === "CANCELLED" ? "CANCELLED" : "FAILED",
          message: cfResult.txMsg || `Payment ${cfResult.orderStatus.toLowerCase()}`,
          orderId: orderId,
        });
      } else {
        return reply.code(200).send({
          verified: false,
          status: "PENDING",
          message: cfResult.txMsg || "Payment is pending verification",
          orderId: orderId,
        });
      }
    } catch (err) {
      console.error("[PaymentController] verifyOrder Error:", err);
      return reply.code(500).send({
        verified: false,
        status: "FAILED",
        message: err.message || "Payment verification failed",
      });
    }
  };

  const handleWebhook = async (req, reply) => {
    try {
      const signature = String(req.headers["x-webhook-signature"] || req.headers["x-cashfree-signature"] || "").trim();
      const timestamp = String(req.headers["x-webhook-timestamp"] || req.headers["x-cashfree-timestamp"] || "").trim();
      const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body || {});

      // 1. Verify Webhook Signature (if headers present)
      if (signature && timestamp) {
        const isValidSignature = verifyCashfreeWebhookSignature({ signature, rawBody, timestamp });
        if (!isValidSignature && process.env.NODE_ENV === "production") {
          console.warn("[PaymentController] Webhook signature verification failed for signature:", signature);
          return reply.code(400).send({ status: "ERROR", message: "Invalid webhook signature" });
        }
      }

      const body = req.body || {};
      const eventType = String(body.type || body.event || "").toUpperCase();
      const eventData = body.data || body;
      const orderDetails = eventData.order || {};
      const paymentDetails = eventData.payment || {};
      const refundDetails = eventData.refund || {};
      const orderId = String(orderDetails.order_id || eventData.order_id || "").trim();

      // 2. Log every webhook event cleanly
      console.log("[Cashfree Webhook Received]", {
        timestamp: new Date().toISOString(),
        eventType,
        orderId,
        paymentStatus: paymentDetails.payment_status,
        refundStatus: refundDetails.refund_status,
      });

      if (!orderId) {
        // Return 200 OK even if orderId is missing in raw ping
        return reply.code(200).send({ status: "OK", message: "Webhook ping received" });
      }

      // 3. Look up order in Prisma DB
      let existingOrder = null;
      if (prisma) {
        try {
          const numericId = Number(orderId);
          if (!Number.isNaN(numericId)) {
            existingOrder = await prisma.order.findUnique({ where: { id: numericId } });
          }
          if (!existingOrder) {
            existingOrder = await prisma.order.findFirst({
              where: {
                OR: [{ orderNo: orderId }, { invoiceNo: orderId }],
              },
            });
          }
        } catch (dbErr) {
          console.warn("[PaymentController] Webhook DB order lookup error:", dbErr.message);
        }
      }

      // 4. Event Processing with Idempotency (Prevent Duplicate Processing)
      if (eventType === "PAYMENT_SUCCESS" || eventType === "PAYMENT.SUCCESS") {
        if (existingOrder && (existingOrder.paymentStatus === "PAID" || existingOrder.status === "PAID" || existingOrder.status === "COMPLETED")) {
          console.log(`[PaymentController] Webhook: Order ${orderId} already marked PAID. Ignoring duplicate.`);
          return reply.code(200).send({ status: "OK", message: "Duplicate webhook ignored" });
        }

        if (existingOrder && prisma) {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              paymentStatus: "PAID",
              status: "CONFIRMED",
              paymentMethod: paymentDetails.payment_group || "CASHFREE",
            },
          });
        }
      } else if (eventType === "PAYMENT_FAILED" || eventType === "PAYMENT.FAILED") {
        if (existingOrder && (existingOrder.paymentStatus === "PAID" || existingOrder.status === "PAID")) {
          console.log(`[PaymentController] Webhook: Order ${orderId} is already PAID. Ignoring payment failure webhook.`);
          return reply.code(200).send({ status: "OK", message: "Webhook ignored for paid order" });
        }

        if (existingOrder && prisma) {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: { paymentStatus: "FAILED" },
          });
        }
      } else if (eventType === "REFUND_SUCCESS" || eventType === "REFUND.SUCCESS") {
        if (existingOrder && prisma) {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              paymentStatus: "REFUNDED",
              status: "CANCELLED",
            },
          });
        }
      } else if (eventType === "REFUND_FAILED" || eventType === "REFUND.FAILED") {
        console.warn(`[PaymentController] Webhook: Refund failed for order ${orderId}:`, refundDetails.refund_note || "Refund error");
      }

      // 5. Always Return HTTP 200 OK to Cashfree
      return reply.code(200).send({
        status: "OK",
        message: "Webhook event processed successfully",
        orderId,
        event: eventType,
      });
    } catch (err) {
      console.error("[PaymentController] Webhook Error:", err);
      // Always return HTTP 200 OK so Cashfree does not retry indefinitely on unexpected internal errors
      return reply.code(200).send({
        status: "OK",
        message: "Webhook received with internal warning",
      });
    }
  };

  const getHealthCheck = async (req, reply) => {
    try {
      const metrics = getPaymentMetrics();
      let dbConnected = false;

      if (prisma) {
        try {
          await prisma.$queryRaw`SELECT 1`;
          dbConnected = true;
        } catch (dbErr) {
          dbConnected = false;
        }
      }

      return reply.code(200).send({
        status: metrics.isConfigured ? "HEALTHY" : "MISCONFIGURED",
        timestamp: new Date().toISOString(),
        cashfreeEnv: metrics.cashfreeEnv,
        isProduction: metrics.isProduction,
        isConfigured: metrics.isConfigured,
        clientIdMasked: metrics.clientIdMasked,
        dbConnected,
        metrics: {
          ordersCreated: metrics.ordersCreated,
          paymentsVerified: metrics.paymentsVerified,
          paymentsFailed: metrics.paymentsFailed,
          webhooksReceived: metrics.webhooksReceived,
          webhooksVerified: metrics.webhooksVerified,
          uptimeSeconds: metrics.uptimeSeconds,
        },
      });
    } catch (err) {
      console.error("[PaymentController] HealthCheck Error:", err);
      return reply.code(500).send({
        status: "UNHEALTHY",
        message: err.message,
      });
    }
  };

  return {
    createOrder,
    verifyOrder,
    handleWebhook,
    getHealthCheck,
  };
};


