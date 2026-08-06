import { validateCreateOrderPayload } from "../middleware/paymentValidation.js";
import { createCashfreePaymentSession } from "../services/cashfree.service.js";

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

      // Generate Cashfree payment session
      const result = await createCashfreePaymentSession({
        orderId,
        amount,
        customerId: customerId || "guest",
        customerPhone: resolvedPhone,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        restaurantId,
        returnUrl,
      });

      return reply.code(200).send({
        payment_session_id: result.payment_session_id,
        order_id: result.order_id,
        cf_order_id: result.cf_order_id,
        order_status: result.order_status,
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

  return {
    createOrder,
    verifyOrder,
  };
};

