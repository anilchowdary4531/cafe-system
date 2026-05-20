import { createOrderByStaff, updateOrderStatus } from "../services/orderService.js";

export const buildStaffOrderController = ({ prisma, realtime }) => {
  const createByStaff = async (req, reply) => {
    try {
      const actor = req.staffActor;
      const order = await createOrderByStaff({ prisma, actor, input: req.body });
      realtime?.emitOrderCreated(order);
      return reply.code(201).send({ message: "Order created", order });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      const code = err?.code || "";
      if (code === "items_required" || code === "invalid_item") return reply.code(400).send({ message: "Invalid items" });
      if (code === "insufficient_stock") return reply.code(409).send({ message: "Insufficient stock", menuItemId: err.menuItemId || null });
      return reply.code(500).send({ message: "Failed to create order" });
    }
  };

  const updateStatus = async (req, reply) => {
    try {
      const actor = req.staffActor;
      const orderId = Number(req.params?.orderId || 0);
      const status = req.body?.status;
      const updated = await updateOrderStatus({
        prisma,
        actor,
        orderId,
        nextStatus: status,
        notes: req.body?.notes,
        changedByName: req.body?.changedByName,
      });
      realtime?.emitOrderUpdated(updated);
      return { message: "Order updated", order: updated };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      const code = err?.code || "";
      if (code === "invalid_order_id" || code === "status_not_allowed") return reply.code(400).send({ message: "Invalid request" });
      if (code === "order_not_found") return reply.code(404).send({ message: "Order not found" });
      if (code === "restaurant_access_denied") return reply.code(403).send({ message: "Forbidden" });
      if (code === "order_cancelled") return reply.code(409).send({ message: "Order already cancelled" });
      return reply.code(500).send({ message: "Failed to update order" });
    }
  };

  return { createByStaff, updateStatus };
};

