import { createPayment, verifyPayment } from "../services/paymentService.js";

export const buildPaymentController = ({ prisma }) => {
  const postCreate = async (req, reply) => {
    try {
      const actor = req.actor;
      const result = await createPayment({ prisma, actor, input: req.body });
      return reply.code(201).send(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      const code = err?.code || "";
      if (code.endsWith("_required") || code === "order_already_paid") return reply.code(400).send({ message: err?.message || "Missing fields" });
      if (code === "order_not_found") return reply.code(404).send({ message: "Order not found" });
      if (code === "razorpay_not_configured") return reply.code(511).send({ message: "Razorpay not configured" });
      if (code === "restaurant_access_denied" || code === "order_access_denied") return reply.code(403).send({ message: "Forbidden" });
      return reply.code(500).send({ message: "Failed to create payment" });
    }
  };

  const postVerify = async (req, reply) => {
    try {
      const actor = req.actor;
      const result = await verifyPayment({ prisma, actor, input: req.body });
      return reply.send(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      const code = err?.code || "";
      if (code.endsWith("_required") || code === "razorpay_order_id_mismatch" || code === "customer_payment_verification_requires_payment_id") {
        return reply.code(400).send({ message: err?.message || "Invalid input or missing fields" });
      }
      if (code === "order_not_found") return reply.code(404).send({ message: "Order not found" });
      if (code === "payment_not_found") return reply.code(404).send({ message: "Payment not found" });
      if (code === "invalid_signature") return reply.code(400).send({ message: "Invalid signature" });
      if (code === "restaurant_access_denied" || code === "order_access_denied" || code === "razorpay_verification_required") {
        return reply.code(403).send({ message: "Forbidden" });
      }
      return reply.code(500).send({ message: "Failed to verify payment" });
    }
  };

  return { postCreate, postVerify };
};
