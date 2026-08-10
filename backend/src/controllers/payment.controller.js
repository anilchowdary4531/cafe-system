import { validateCreateOrderPayload } from "../middleware/paymentValidation.js";
import { createCashfreePaymentSession, verifyCashfreeOrderSession, verifyCashfreeWebhookSignature, getPaymentMetrics, createCashfreeRefund } from "../services/cashfree.service.js";

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
      const orderNote = body.orderNote || body.note || body.notes || "Have good food!";

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
        orderNote,
      });

      // Store Payment record in Prisma DB with schema-aligned fields
      if (prisma) {
        try {
          const numRestId = Number(restaurantId || body.restaurantId || 1);
          const numOrderId = Number(orderId);
          const amountSubunit = Math.round(Number(amount || 0) * 100);

          if (numOrderId && !Number.isNaN(numOrderId)) {
            await prisma.payment.create({
              data: {
                orderId: numOrderId,
                restaurantId: numRestId && !Number.isNaN(numRestId) ? numRestId : 1,
                amountSubunit,
                currency: "INR",
                method: "ONLINE",
                status: "PENDING",
                provider: "CASHFREE",
                providerOrderId: String(result.cf_order_id || result.order_id || ""),
                providerMetadata: {
                  paymentSessionId: String(result.payment_session_id || ""),
                },
              },
            });
          }
        } catch (payDbErr) {
          console.warn("[PaymentController] Payment record creation notice:", payDbErr.message);
        }
      }

      return reply.code(200).send({
        payment_session_id: result.payment_session_id,
        cashfree_order_id: result.cf_order_id || result.order_id,
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
      const query = req.query || {};
      const body = req.body || {};
      const orderId = String(req.params?.orderId || query.order_id || query.orderId || body.orderId || body.order_id || "").trim();

      if (!orderId) {
        return reply.code(400).send({
          verified: false,
          status: "UNKNOWN",
          message: "orderId parameter is required for payment verification",
          reason: "Missing order ID in request",
        });
      }

      console.log(`[PaymentController] Payment verification requested for Order ID: ${orderId}`);

      // 1. Idempotency Check: Look up existing Order in Prisma DB
      let existingOrder = null;
      if (prisma) {
        try {
          const numericId = Number(orderId);
          if (!Number.isNaN(numericId)) {
            existingOrder = await prisma.order.findUnique({
              where: { id: numericId },
              include: { restaurant: { select: { slug: true } } },
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
              include: { restaurant: { select: { slug: true } } },
            });
          }
        } catch (dbErr) {
          console.warn("[PaymentController] DB order lookup warning:", dbErr.message);
        }
      }

      // If already verified & paid in DB, return verified SUCCESS immediately (Idempotent guard)
      if (existingOrder && (existingOrder.paymentStatus === "PAID" || existingOrder.status === "PAID" || existingOrder.status === "COMPLETED")) {
        return reply.code(200).send({
          verified: true,
          status: "SUCCESS",
          paymentStatus: "PAID",
          message: "Order is already verified and paid",
          orderId: orderId,
          orderNo: existingOrder.orderNo || orderId,
          amount: Number(existingOrder.total || existingOrder.amount || 0),
          paymentMethod: existingOrder.paymentMode || "ONLINE",
          fulfillment: existingOrder.fulfillment || "pickup",
          slug: existingOrder.restaurant?.slug || "",
          invoiceUrl: existingOrder.invoiceS3Url || `/invoice/${existingOrder.id}`,
        });
      }

      // 2. Direct Server-Side Verification with Cashfree API (NEVER trust client payload or query params!)
      const cfResult = await verifyCashfreeOrderSession({ orderId });

      // If Cashfree verification failed due to network/server error
      if (!cfResult.verified) {
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: { paymentStatus: "UNKNOWN" },
            });
          } catch {}
        }
        return reply.code(200).send({
          verified: false,
          status: "UNKNOWN",
          paymentStatus: "UNKNOWN",
          message: "Payment status could not be verified right now",
          reason: cfResult.failureReason || "Payment status could not be verified due to a network or server error",
          orderId,
          orderNo: existingOrder?.orderNo || orderId,
          amount: existingOrder?.total || 0,
        });
      }

      // 3. Amount Verification (Phase 11): Compare Cashfree returned orderAmount against DB Tiffzy order total
      if (existingOrder && cfResult.orderAmount > 0) {
        const expectedTotal = Number(existingOrder.total || 0);
        const actualAmount = Number(cfResult.orderAmount || 0);
        const amountDiff = Math.abs(expectedTotal - actualAmount);

        if (amountDiff > 0.05) {
          console.error(`[PaymentController] SECURITY ALERT: Amount mismatch for Order ${orderId}! Expected: ₹${expectedTotal}, Cashfree returned: ₹${actualAmount}`);
          
          if (prisma) {
            try {
              await prisma.order.update({
                where: { id: existingOrder.id },
                data: { paymentStatus: "UNKNOWN" },
              });
            } catch {}
          }

          return reply.code(200).send({
            verified: false,
            status: "UNKNOWN",
            paymentStatus: "UNKNOWN",
            message: "Payment amount mismatch detected",
            reason: "Payment amount mismatch detected. Please contact support.",
            orderId,
            orderNo: existingOrder?.orderNo || orderId,
            amount: expectedTotal,
          });
        }
      }

      // 4. Update Database Order & Payment status strictly based on verified Cashfree result
      const normalizedStatus = cfResult.normalizedStatus || "UNKNOWN";

      if (normalizedStatus === "SUCCESS" && cfResult.isPaid) {
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: {
                paymentStatus: "PAID",
                status: "CONFIRMED",
                paymentMode: cfResult.paymentMethod || existingOrder.paymentMode || "ONLINE",
              },
            });
            await prisma.payment.updateMany({
              where: {
                OR: [
                  { providerOrderId: String(cfResult.cfOrderId || orderId) },
                  { orderId: existingOrder.id },
                ],
              },
              data: {
                status: "PAID",
                method: cfResult.paymentMethod || "CASHFREE",
                transactionId: cfResult.paymentId || null,
              },
            });
          } catch (updateErr) {
            console.error("[PaymentController] Order/Payment DB update error:", updateErr.message);
          }
        }

        return reply.code(200).send({
          verified: true,
          status: "SUCCESS",
          paymentStatus: "PAID",
          message: cfResult.txMsg || "Payment verified successfully",
          orderId: orderId,
          orderNo: existingOrder?.orderNo || orderId,
          amount: cfResult.orderAmount || existingOrder?.total || 0,
          paymentMethod: cfResult.paymentMethod || existingOrder?.paymentMode || "ONLINE",
          fulfillment: existingOrder?.fulfillment || "pickup",
          slug: existingOrder?.restaurant?.slug || "",
          invoiceUrl: existingOrder ? `/invoice/${existingOrder.id}` : null,
        });
      }

      if (normalizedStatus === "CANCELLED") {
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: { paymentStatus: "CANCELLED" },
            });
          } catch {}
        }

        return reply.code(200).send({
          verified: false,
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          message: "Payment was cancelled",
          reason: cfResult.failureReason || "User cancelled payment",
          orderId,
          orderNo: existingOrder?.orderNo || orderId,
          amount: existingOrder?.total || cfResult.orderAmount || 0,
          paymentMethod: cfResult.paymentMethod || "ONLINE",
          fulfillment: existingOrder?.fulfillment || "pickup",
          slug: existingOrder?.restaurant?.slug || "",
        });
      }

      if (normalizedStatus === "FAILED") {
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: { paymentStatus: "FAILED" },
            });
          } catch {}
        }

        return reply.code(200).send({
          verified: false,
          status: "FAILED",
          paymentStatus: "FAILED",
          message: "Payment failed",
          reason: cfResult.failureReason || "Payment could not be completed",
          orderId,
          orderNo: existingOrder?.orderNo || orderId,
          amount: existingOrder?.total || cfResult.orderAmount || 0,
          paymentMethod: cfResult.paymentMethod || "ONLINE",
          fulfillment: existingOrder?.fulfillment || "pickup",
          slug: existingOrder?.restaurant?.slug || "",
        });
      }

      if (normalizedStatus === "PENDING") {
        if (existingOrder && prisma) {
          try {
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: { paymentStatus: "PENDING" },
            });
          } catch {}
        }

        return reply.code(200).send({
          verified: false,
          status: "PENDING",
          paymentStatus: "PENDING",
          message: "Payment confirmation is pending from gateway",
          reason: "We are waiting for confirmation from Cashfree",
          orderId,
          orderNo: existingOrder?.orderNo || orderId,
          amount: existingOrder?.total || cfResult.orderAmount || 0,
          paymentMethod: cfResult.paymentMethod || "ONLINE",
          fulfillment: existingOrder?.fulfillment || "pickup",
          slug: existingOrder?.restaurant?.slug || "",
        });
      }

      // Default UNKNOWN fallback
      return reply.code(200).send({
        verified: false,
        status: "UNKNOWN",
        paymentStatus: "UNKNOWN",
        message: "Payment status could not be verified",
        reason: cfResult.failureReason || "Payment status could not be verified",
        orderId,
        orderNo: existingOrder?.orderNo || orderId,
        amount: existingOrder?.total || cfResult.orderAmount || 0,
        paymentMethod: cfResult.paymentMethod || "ONLINE",
        fulfillment: existingOrder?.fulfillment || "pickup",
        slug: existingOrder?.restaurant?.slug || "",
      });
    } catch (err) {
      console.error("[PaymentController] verifyOrder Error:", err);
      return reply.code(200).send({
        verified: false,
        status: "UNKNOWN",
        paymentStatus: "UNKNOWN",
        message: "Payment status could not be verified",
        reason: "Payment status could not be verified due to a server error",
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
              paymentMode: paymentDetails.payment_group || "ONLINE",
            },
          });
          await prisma.payment.updateMany({
            where: {
              OR: [
                { providerOrderId: String(orderDetails.order_id || orderId) },
                { orderId: existingOrder.id },
              ],
            },
            data: {
              status: "PAID",
              method: paymentDetails.payment_group || "CASHFREE",
              transactionId: paymentDetails.cf_payment_id ? String(paymentDetails.cf_payment_id) : null,
            },
          }).catch((pErr) => console.warn("[PaymentController] Webhook Payment DB update notice:", pErr.message));
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

  const initiateRefund = async (req, reply) => {
    try {
      const body = req.body || {};
      const orderId = String(body.orderId || body.order_id || "").trim();
      const refundAmount = Number(body.refundAmount || body.amount);
      const refundNote = String(body.refundNote || body.reason || "Customer refund").trim();

      if (!orderId) {
        return reply.code(400).send({
          success: false,
          message: "orderId is required to initiate refund",
        });
      }

      if (Number.isNaN(refundAmount) || refundAmount <= 0) {
        return reply.code(400).send({
          success: false,
          message: "refundAmount must be a valid positive number",
        });
      }

      // 1. Prisma DB Order Lookup & Anti-Duplicate Refund Check
      let existingOrder = null;
      if (prisma) {
        try {
          const numericId = Number(orderId);
          if (!Number.isNaN(numericId)) {
            existingOrder = await prisma.order.findUnique({ where: { id: numericId } });
          }
          if (!existingOrder) {
            existingOrder = await prisma.order.findFirst({
              where: { OR: [{ orderNo: orderId }, { invoiceNo: orderId }] },
            });
          }
        } catch (dbErr) {
          console.warn("[PaymentController] Refund DB lookup warning:", dbErr.message);
        }
      }

      if (existingOrder && existingOrder.paymentStatus === "REFUNDED") {
        return reply.code(400).send({
          success: false,
          message: "Order has already been fully refunded",
          orderId,
        });
      }

      // Determine Full vs Partial Refund
      const orderTotal = Number(existingOrder?.total || existingOrder?.amount || refundAmount);
      const isFullRefund = refundAmount >= orderTotal;
      const refundType = isFullRefund ? "FULL" : "PARTIAL";

      // 2. Call Cashfree PG Refund API
      const refundResult = await createCashfreeRefund({
        orderId,
        refundAmount,
        refundNote,
      });

      // 3. Update Database Order & Payment Records
      if (existingOrder && prisma) {
        try {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              paymentStatus: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
              status: isFullRefund ? "CANCELLED" : existingOrder.status,
            },
          });

          await prisma.payment.create({
            data: {
              orderId: existingOrder.id,
              restaurantId: Number(existingOrder.restaurantId || 1),
              amountSubunit: Math.round(Number(refundAmount || 0) * 100),
              currency: "INR",
              method: "REFUND",
              status: "REFUNDED",
              provider: "CASHFREE",
              providerOrderId: String(refundResult.orderId),
              transactionId: String(refundResult.refundId),
            },
          });
        } catch (updateErr) {
          console.error("[PaymentController] Refund DB update warning:", updateErr.message);
        }
      }

      return reply.code(200).send({
        success: true,
        message: `${refundType} refund initiated successfully`,
        refundId: refundResult.refundId,
        refundAmount: refundResult.refundAmount,
        refundType,
        orderId,
        status: refundResult.refundStatus || "SUCCESS",
      });
    } catch (err) {
      console.error("[PaymentController] initiateRefund Error:", err);
      return reply.code(500).send({
        success: false,
        message: err.message || "Failed to initiate Cashfree refund",
      });
    }
  };

  return {
    createOrder,
    verifyOrder,
    handleWebhook,
    getHealthCheck,
    initiateRefund,
  };
};


