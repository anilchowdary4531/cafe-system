import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  registerDeviceToken,
  removeDeviceToken,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notificationService.js";
import { requireCustomerPhoneFromJwt } from "./customer.js";
import { RECIPIENT_TYPES } from "../constants/notificationTypes.js";

export default async function notificationRoutes(app, deps) {
  const { prisma } = deps;

  // Helper to extract authenticated entity (Customer or Staff/User) from JWT request
  const resolveActor = async (req) => {
    let customer = null;
    try {
      const phone = await requireCustomerPhoneFromJwt(req, prisma);
      if (phone) {
        customer = await prisma.customerAccount.findUnique({ where: { phone } });
      }
    } catch {
      // Not a customer JWT
    }

    if (customer) {
      return { recipientType: RECIPIENT_TYPES.CUSTOMER, recipientId: customer.id, customer };
    }

    // Try Staff / User JWT
    try {
      const authHeader = req.headers?.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = app.jwt.verify(token);
        if (decoded?.id && String(decoded?.type || "") !== "customer") {
          return { recipientType: RECIPIENT_TYPES.USER, recipientId: Number(decoded.id), user: decoded };
        }
      }
    } catch {
      // Invalid JWT
    }

    return null;
  };

  // GET /api/notifications — Fetch user/customer paginated notifications
  app.get("/api/notifications", async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    const { page, limit, isRead } = req.query || {};
    const parsedRead = isRead === "true" ? true : isRead === "false" ? false : null;

    const result = await getUserNotifications({
      prisma,
      recipientType: actor.recipientType,
      recipientId: actor.recipientId,
      isRead: parsedRead,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return result;
  });

  // GET /api/notifications/unread-count — Unread badge count
  app.get("/api/notifications/unread-count", async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    const count = await prisma.notification.count({
      where: {
        recipientType: actor.recipientType,
        recipientId: actor.recipientId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  });

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
    });

    return { message: "Notification marked as read" };
  };
  app.patch("/api/notifications/:id/read", markReadHandler);
  app.post("/api/notifications/:id/read", markReadHandler);

  // PATCH & POST /api/notifications/read-all — Mark all notifications read
  const markAllReadHandler = async (req, reply) => {
    const actor = await resolveActor(req);
    if (!actor) return reply.code(401).send({ message: "Authentication required" });

    await markAllNotificationsRead({
      prisma,
      recipientType: actor.recipientType,
      recipientId: actor.recipientId,
    });

    return { message: "All notifications marked as read" };
  };
  app.patch("/api/notifications/read-all", markAllReadHandler);
  app.post("/api/notifications/read-all", markAllReadHandler);

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
