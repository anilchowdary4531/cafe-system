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
    const actor = await requireStaffJwt(req, reply, { prisma, allowedRoles: STAFF_ALLOWED_ROLES });
    if (!actor) return reply;
    req.staffActor = actor;
    return null;
  };

  const requireAuth = async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ message: "Authentication required" });
    }

    const isCustomer = String(req.user?.type || "") === "customer";
    const role = String(req.user?.role || "").toUpperCase();
    const staffAllowed = role === "SUPER_ADMIN" || (role && STAFF_ALLOWED_ROLES.includes(role));

    if (isCustomer) {
      req.actor = { type: "customer", phone: normalizePhone(req.user.phone) };
    } else if (staffAllowed) {
      const actor = await requireStaffJwt(req, reply, { prisma, allowedRoles: STAFF_ALLOWED_ROLES });
      if (!actor) return reply;
      req.actor = actor;
    } else {
      return reply.code(403).send({ message: "Access denied" });
    }
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

  app.post("/payments/create", { preHandler: requireAuth }, paymentController.postCreate);
  app.post("/payments/verify", { preHandler: requireAuth }, paymentController.postVerify);

  app.get("/invoice/:orderId", { preHandler: requireStaff }, invoiceController.getInvoice);

  app.get("/ai/recommendations", { preHandler: requireStaff }, aiController.getRecommendationsRoute);
  app.get("/ai/customer-insights", { preHandler: requireStaff }, aiController.getCustomerInsightsRoute);
}
