import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  registerDeviceToken,
  removeDeviceToken,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notificationService.js";
import { requireCustomerPhoneFromJwt } from "../services/customerProfileService.js";
import { getPhoneVariants, normalizePhone } from "../services/phoneService.js";
import { RECIPIENT_TYPES } from "../constants/notificationTypes.js";

export default async function notificationRoutes(app, deps) {
  const { prisma } = deps;

  // Helper to extract authenticated entity (Customer or Staff/User) from JWT request
  const resolveActor = async (req) => {
    const scope = String(req.query?.scope || req.headers?.["x-scope"] || "").toLowerCase();

    // 1. Try Customer JWT first
    let customer = null;
    let customerRecords = [];
    try {
      const authHeader = req.headers?.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = app.jwt.verify(token);
        if (decoded?.type === "customer") {
          const phone = decoded.phone ? normalizePhone(decoded.phone) : "";
          if (decoded.customerAccountId) {
            customer = await prisma.customerAccount.findUnique({ where: { id: Number(decoded.customerAccountId) } });
          }
          if (!customer && phone) {
            const variants = getPhoneVariants(phone);
            customer = await prisma.customerAccount.findFirst({
              where: {
                OR: [
                  { phone: { in: variants } },
                  ...(phone.includes("@") ? [{ email: phone.toLowerCase() }] : []),
                ],
              },
            });
          }
          const lookupPhone = customer?.phone || phone;
          if (lookupPhone) {
            const variants = getPhoneVariants(lookupPhone);
            customerRecords = await prisma.customer.findMany({
              where: { phone: { in: variants } },
            });
          }
        }
      }
    } catch {
      // Not a direct customer token
    }

    // Fallback: If no direct decoded.type === "customer", try requireCustomerPhoneFromJwt
    if (!customer && scope === "customer") {
      try {
        const phone = await requireCustomerPhoneFromJwt(req, prisma);
        if (phone) {
          const variants = getPhoneVariants(phone);
          customer = await prisma.customerAccount.findFirst({
            where: {
              OR: [
                { phone: { in: variants } },
                ...(phone.includes("@") ? [{ email: phone.toLowerCase() }] : []),
              ],
            },
          });
          customerRecords = await prisma.customer.findMany({
            where: { phone: { in: variants } },
          });
        }
      } catch {
        // Not a customer JWT
      }
    }

    if (customer || customerRecords.length > 0) {
      const recipientIds = new Set();
      if (customer?.id) recipientIds.add(Number(customer.id));
      customerRecords.forEach((c) => recipientIds.add(Number(c.id)));

      return {
        recipientType: RECIPIENT_TYPES.CUSTOMER,
        recipientId: Array.from(recipientIds),
        customer,
        customerRecords,
      };
    }

    // If scope is explicitly "customer" and no customer was authenticated,
    // NEVER fall through to staff/restaurant!
    if (scope === "customer") {
      return null;
    }

    // Try Staff / User JWT
    try {
      const authHeader = req.headers?.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = app.jwt.verify(token);
        if ((decoded?.id || decoded?.supplierId) && String(decoded?.type || "") !== "customer") {
          const supplierId = decoded.supplierId ? Number(decoded.supplierId) : null;
          const restaurantId = decoded.restaurantId || decoded.restaurant_id ? Number(decoded.restaurantId || decoded.restaurant_id) : null;
          const actorId = supplierId || Number(decoded.id);
          const isSupplier = Boolean(supplierId || decoded.role === "SUPPLIER");

          return {
            recipientType: isSupplier ? "SUPPLIER" : RECIPIENT_TYPES.USER,
            recipientId: actorId,
            supplierId,
            restaurantId,
            user: decoded,
          };
        }
      }
    } catch {
      // Invalid JWT
    }

    return null;
  };

  // GET /api/notifications & /notifications — Fetch user/customer paginated notifications
  const getNotificationsHandler = async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    const { page, limit, isRead } = req.query || {};
    const parsedRead = isRead === "true" ? true : isRead === "false" ? false : null;

    const result = await getUserNotifications({
      prisma,
      recipientType: actor.recipientType,
      recipientId: actor.recipientId,
      restaurantId: actor.restaurantId,
      isRead: parsedRead,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return result;
  };
  app.get("/api/notifications", getNotificationsHandler);
  app.get("/notifications", getNotificationsHandler);

  // GET /api/notifications/unread-count & /notifications/unread-count — Unread badge count
  const unreadCountHandler = async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    let count;
    if (actor.recipientType === RECIPIENT_TYPES.USER && actor.restaurantId) {
      count = await prisma.notification.count({
        where: {
          OR: [
            { recipientType: RECIPIENT_TYPES.USER, recipientId: actor.recipientId },
            { recipientType: RECIPIENT_TYPES.RESTAURANT, recipientId: actor.restaurantId },
            { restaurantId: actor.restaurantId },
          ],
          isRead: false,
        },
      });
    } else {
      const recipientCondition = Array.isArray(actor.recipientId)
        ? { in: actor.recipientId.map(Number) }
        : Number(actor.recipientId);
      count = await prisma.notification.count({
        where: {
          recipientType: actor.recipientType,
          recipientId: recipientCondition,
          ...(actor.restaurantId ? { restaurantId: Number(actor.restaurantId) } : {}),
          isRead: false,
        },
      });
    }

    return { success: true, count, unreadCount: count };
  };
  app.get("/api/notifications/unread-count", unreadCountHandler);
  app.get("/notifications/unread-count", unreadCountHandler);

  // PATCH & POST /api/notifications/:id/read — Mark single notification read
  const markReadHandler = async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    const notificationId = Number(req.params.id);
    await markNotificationRead({
      prisma,
      notificationId,
      recipientType: actor.recipientType,
      recipientId: actor.recipientId,
      restaurantId: actor.restaurantId,
    });

    return { message: "Notification marked as read" };
  };
  app.patch("/api/notifications/:id/read", markReadHandler);
  app.post("/api/notifications/:id/read", markReadHandler);
  app.patch("/notifications/:id/read", markReadHandler);
  app.post("/notifications/:id/read", markReadHandler);

  // PATCH & POST /api/notifications/read-all — Mark all notifications read
  const markAllReadHandler = async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    await markAllNotificationsRead({
      prisma,
      recipientType: actor.recipientType,
      recipientId: actor.recipientId,
      restaurantId: actor.restaurantId,
    });

    return { message: "All notifications marked as read" };
  };
  app.patch("/api/notifications/read-all", markAllReadHandler);
  app.post("/api/notifications/read-all", markAllReadHandler);
  app.patch("/notifications/read-all", markAllReadHandler);
  app.post("/notifications/read-all", markAllReadHandler);

  // POST /api/notifications/devices — Register/update FCM Device Token
  app.post("/api/notifications/devices", async (req, reply) => {
    const actor = await resolveActor(req);
    const { deviceToken, platform, deviceId } = req.body || {};

    if (!deviceToken) {
      return reply.code(400).send({ message: "deviceToken is required" });
    }

    const tokenRecord = await registerDeviceToken({
      prisma,
      userId: actor?.recipientType === RECIPIENT_TYPES.USER ? actor.recipientId : null,
      customerId: actor?.recipientType === RECIPIENT_TYPES.CUSTOMER ? actor.recipientId : null,
      deviceToken,
      platform,
      deviceId,
    });

    return { message: "Device token registered successfully", token: tokenRecord };
  });

  // DELETE /api/notifications/devices — Deactivate device token
  app.delete("/api/notifications/devices", async (req, reply) => {
    const { deviceToken } = req.body || {};
    if (!deviceToken) {
      return reply.code(400).send({ message: "deviceToken is required" });
    }

    await removeDeviceToken({ prisma, deviceToken });
    return { message: "Device token unregistered successfully" };
  });

  // GET /api/notifications/preferences — Get Notification Preferences
  app.get("/api/notifications/preferences", async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    const preferences = await getNotificationPreferences({
      prisma,
      userId: actor.recipientType === RECIPIENT_TYPES.USER ? actor.recipientId : null,
      customerId: actor.recipientType === RECIPIENT_TYPES.CUSTOMER ? actor.recipientId : null,
    });

    return { preferences };
  });

  // PATCH /api/notifications/preferences — Update Notification Preferences
  app.patch("/api/notifications/preferences", async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    const preferences = await updateNotificationPreferences({
      prisma,
      userId: actor.recipientType === RECIPIENT_TYPES.USER ? actor.recipientId : null,
      customerId: actor.recipientType === RECIPIENT_TYPES.CUSTOMER ? actor.recipientId : null,
      preferences: req.body || {},
    });

    return { message: "Notification preferences updated", preferences };
  });
}
