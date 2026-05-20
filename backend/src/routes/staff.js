import { requireStaffJwt } from "../services/staffAuthService.js";
import { buildStaffOrderController } from "../controllers/staffOrderController.js";
import { buildPaymentController } from "../controllers/paymentController.js";
import { buildAiController } from "../controllers/aiController.js";
import { buildInvoiceController } from "../controllers/invoiceController.js";
import { normalizeOrderStatus } from "../services/orderService.js";
import { normalizePhone } from "../services/phoneService.js";

export default async function staffRoutes(app, deps) {
  const { prisma, realtime, STAFF_ALLOWED_ROLES } = deps;

  const orderController = buildStaffOrderController({ prisma, realtime });
  const paymentController = buildPaymentController({ prisma });
  const aiController = buildAiController({ prisma });
  const invoiceController = buildInvoiceController({ prisma });

  const requireStaff = async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, { allowedRoles: STAFF_ALLOWED_ROLES });
    if (!actor) return reply;
    req.staffActor = actor;
    return null;
  };

  app.post("/orders/create-by-staff", { preHandler: requireStaff }, orderController.createByStaff);
  app.put("/orders/:orderId/status", { preHandler: requireStaff }, orderController.updateStatus);

  app.get("/orders/live", { preHandler: requireStaff }, async (req, reply) => {
    try {
      const actor = req.staffActor;
      const restaurantId = Number(actor?.restaurantId || 0);
      if (!restaurantId) return reply.code(400).send({ message: "Restaurant required" });

      const status = req.query?.status ? normalizeOrderStatus(req.query.status) : "";
      const where = {
        restaurantId,
        ...(status ? { status } : {}),
        ...(actor?.branchId && String(actor.role || "").toUpperCase() !== "OWNER" && String(actor.role || "").toUpperCase() !== "MANAGER"
          ? { branchId: actor.branchId }
          : {}),
      };

      const orders = await prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      });

      return { orders };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch orders" });
    }
  });

  app.post("/payments/create", { preHandler: requireStaff }, paymentController.postCreate);
  // Supports:
  // - Staff verification: { paymentId, ... } (Razorpay signature, etc.)
  // - Lightweight verification (customer/staff): { orderId, status }
  app.post("/payments/verify", async (req, reply) => {
    const body = req.body || {};
    const paymentId = Number(body.paymentId || 0);
    const orderId = Number(body.orderId || 0);

    // Staff-only path (existing controller logic).
    if (paymentId) {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ message: "Authentication required" });
      }
      const actor = await requireStaffJwt(req, reply, { allowedRoles: STAFF_ALLOWED_ROLES });
      if (!actor) return reply;
      req.staffActor = actor;
      return paymentController.postVerify(req, reply);
    }

    const rawStatus = String(body.status || "").trim().toUpperCase();
    const status =
      rawStatus === "SUCCESS" || rawStatus === "PAID"
        ? "SUCCESS"
        : rawStatus === "FAILED" || rawStatus === "FAILURE"
          ? "FAILED"
          : rawStatus === "PENDING"
            ? "PENDING"
            : "";

    if (!orderId) return reply.code(400).send({ message: "orderId is required" });
    if (!status) return reply.code(400).send({ message: "status is required" });

    const rawMode = String(body.paymentMode || body.paymentMethod || body.method || "")
      .trim()
      .toUpperCase();
    const paymentMode = ["CASH", "UPI", "CARD", "ONLINE"].includes(rawMode) ? rawMode : "";

    // Auth is optional for orderId-only verification (customer mobile web may not attach token to /payments/*).
    // If present, we scope updates to the actor (customer phone or staff restaurant).
    try {
      await req.jwtVerify();
    } catch {
      // ignore
    }

    const isCustomer = String(req.user?.type || "") === "customer";
    const role = String(req.user?.role || "").toUpperCase();
    const restaurantId = Number(req.user?.restaurantId || 0) || null;
    const staffAllowed = role === "SUPER_ADMIN" || (role && STAFF_ALLOWED_ROLES.includes(role));

    let where = { id: orderId };
    if (isCustomer) {
      where = { id: orderId, phone: normalizePhone(req.user?.phone || "") };
    } else if (staffAllowed && restaurantId && role !== "SUPER_ADMIN") {
      where = { id: orderId, restaurantId };
    }

    const updated = await prisma.order.updateMany({
      where,
      data: {
        paymentStatus: status,
        ...(paymentMode ? { paymentMode } : {}),
      },
    });

    if (!updated.count) return reply.code(404).send({ message: "Order not found" });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        total: true,
        paymentStatus: true,
        paymentMode: true,
        restaurantId: true,
      },
    });

    return reply.send({ order, verified: status === "SUCCESS" });
  });

  app.get("/invoice/:orderId", { preHandler: requireStaff }, invoiceController.getInvoice);

  app.get("/ai/recommendations", { preHandler: requireStaff }, aiController.getRecommendationsRoute);
  app.get("/ai/customer-insights", { preHandler: requireStaff }, aiController.getCustomerInsightsRoute);
}
