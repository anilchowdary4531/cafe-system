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
      const restaurantId = Number(req.query?.restaurantId || actor?.restaurantId || req.user?.restaurantId || 0);
      if (!restaurantId) return reply.code(400).send({ message: "Restaurant required" });

      const status = req.query?.status ? normalizeOrderStatus(req.query.status) : "";

      // Calculate start of current business day in Asia/Kolkata
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
      const [year, month, day] = formatter.format(now).split("-");
      const startOfToday = new Date(`${year}-${month}-${day}T00:00:00.000+05:30`);
      const activeCutoff = new Date(Date.now() - 24 * 3600 * 1000);

      const where = {
        restaurantId,
        ...(status ? { status } : {}),
        ...(actor?.branchId && String(actor.role || "").toUpperCase() !== "OWNER" && String(actor.role || "").toUpperCase() !== "MANAGER"
          ? { branchId: actor.branchId }
          : {}),
        OR: [
          { createdAt: { gte: startOfToday } },
          {
            createdAt: { gte: activeCutoff },
            status: { in: ["PLACED", "PREPARING", "READY", "ACCEPTED", "PENDING"] },
          },
        ],
      };

      const orders = await prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
          kots: { include: { items: true } },
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

  // ==========================================
  // STAFF SELF-SERVICE PROFILE & SECURITY
  // ==========================================
  const getSelfProfileHandler = async (req, reply) => {
    try {
      const staffId = req.staffActor?.id || req.actor?.id || req.user?.id;
      if (!staffId) return reply.code(401).send({ message: "Authentication required" });

      const user = await prisma.user.findUnique({
        where: { id: Number(staffId) },
        include: {
          restaurant: { select: { id: true, name: true, logoUrl: true, slug: true } },
          branch: { select: { id: true, name: true } },
          staffAccess: { select: { permissions: true } },
        },
      });

      if (!user) return reply.code(404).send({ message: "User profile not found" });

      const { password, ...safeUser } = user;
      return { success: true, user: safeUser };
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to fetch profile" });
    }
  };

  const updateSelfProfileHandler = async (req, reply) => {
    try {
      const staffId = req.staffActor?.id || req.actor?.id || req.user?.id;
      if (!staffId) return reply.code(401).send({ message: "Authentication required" });

      const { name, phone } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedPhone = phone !== undefined ? String(phone).trim() : undefined;

      if (name !== undefined && !trimmedName) {
        return reply.code(400).send({ message: "Full name cannot be empty" });
      }

      const updateData = {};
      if (trimmedName) updateData.name = trimmedName;
      if (trimmedPhone !== undefined) updateData.phone = trimmedPhone;

      const updatedUser = await prisma.user.update({
        where: { id: Number(staffId) },
        data: updateData,
        include: {
          restaurant: { select: { id: true, name: true, logoUrl: true, slug: true } },
          branch: { select: { id: true, name: true } },
          staffAccess: { select: { permissions: true } },
        },
      });

      const { password, ...safeUser } = updatedUser;
      return { success: true, message: "Profile updated successfully", user: safeUser };
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to update profile" });
    }
  };

  const changePasswordHandler = async (req, reply) => {
    try {
      const staffId = req.staffActor?.id || req.actor?.id || req.user?.id;
      if (!staffId) return reply.code(401).send({ message: "Authentication required" });

      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ message: "Current password and new password are required" });
      }

      if (String(newPassword).length < 6) {
        return reply.code(400).send({ message: "New password must be at least 6 characters long" });
      }

      const user = await prisma.user.findUnique({
        where: { id: Number(staffId) },
      });

      if (!user) return reply.code(404).send({ message: "User not found" });

      const { default: bcrypt } = await import("bcryptjs");
      const isValid = bcrypt.compareSync(String(currentPassword), user.password);
      if (!isValid) {
        return reply.code(400).send({ message: "Incorrect current password" });
      }

      const hashedPassword = bcrypt.hashSync(String(newPassword), 10);
      await prisma.user.update({
        where: { id: Number(staffId) },
        data: { password: hashedPassword },
      });

      return { success: true, message: "Password updated successfully" };
    } catch (err) {
      return reply.code(500).send({ message: err.message || "Failed to change password" });
    }
  };

  app.get("/api/staff/profile/me", { preHandler: requireStaff }, getSelfProfileHandler);
  app.get("/staff/profile/me", { preHandler: requireStaff }, getSelfProfileHandler);
  app.put("/api/staff/profile/me", { preHandler: requireStaff }, updateSelfProfileHandler);
  app.put("/staff/profile/me", { preHandler: requireStaff }, updateSelfProfileHandler);
  app.post("/api/auth/change-password", { preHandler: requireStaff }, changePasswordHandler);
  app.post("/auth/change-password", { preHandler: requireStaff }, changePasswordHandler);
}
