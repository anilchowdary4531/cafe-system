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

  return {
    createOrder,
  };
};
