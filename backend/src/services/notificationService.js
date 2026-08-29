import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  RECIPIENT_TYPES,
  NOTIFICATION_PRIORITY_MAP,
} from "../constants/notificationTypes.js";
import { sendFcmPushNotification } from "./fcmService.js";

/**
 * Centralized Notification Service for Tiffzy.
 * Dispatches notifications across In-App, Socket.IO WebSockets, and FCM Push.
 * Guarantees idempotency and respects user notification preferences.
 */
export const createAndDispatchNotification = async ({
  prisma,
  realtime,
  recipientType = RECIPIENT_TYPES.CUSTOMER,
  recipientId,
  orderId = null,
  restaurantId = null,
  notificationType = NOTIFICATION_TYPES.ORDER_PLACED,
  title,
  message,
  data = {},
  priority = null,
  idempotencyKey = null,
}) => {
  if (!prisma || !recipientId || !title || !message) {
    return null;
  }

  // 1. Idempotency Check: Avoid sending duplicate notifications for the same event
  if (idempotencyKey) {
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  // 2. Notification Preferences Check
  const effectivePriority = priority || NOTIFICATION_PRIORITY_MAP[notificationType] || NOTIFICATION_PRIORITIES.NORMAL;
  
  if (effectivePriority === NOTIFICATION_PRIORITIES.LOW) {
    const isCustomer = recipientType === RECIPIENT_TYPES.CUSTOMER;
    const pref = await prisma.notificationPreference.findFirst({
      where: isCustomer ? { customerId: recipientId } : { userId: recipientId },
    });

    if (pref) {
      if (notificationType === NOTIFICATION_TYPES.PROMOTION && !pref.promotions) return null;
      if (notificationType === NOTIFICATION_TYPES.COUPON && !pref.coupons) return null;
      if (notificationType === NOTIFICATION_TYPES.REVIEW_REMINDER && !pref.reviewReminders) return null;
    }
  }

  // 3. Save to Centralized Notification Store
  let notification = null;
  try {
    notification = await prisma.notification.create({
      data: {
        recipientType,
        recipientId: Number(recipientId),
        orderId: orderId ? Number(orderId) : null,
        restaurantId: restaurantId ? Number(restaurantId) : null,
        notificationType,
        title: String(title).trim(),
        message: String(message).trim(),
        data: data || {},
        priority: effectivePriority,
        idempotencyKey: idempotencyKey || null,
      },
    });

    // Also sync to legacy CustomerNotification model if customer for backward compatibility
    if (recipientType === RECIPIENT_TYPES.CUSTOMER && restaurantId) {
      await prisma.customerNotification.create({
        data: {
          restaurantId: Number(restaurantId),
          customerId: Number(recipientId),
          title: String(title).trim(),
          message: String(message).trim(),
        },
      }).catch(() => {});
    }
  } catch (err) {
    // If unique constraint error on idempotencyKey occurs race-condition, fetch and return existing
    if (String(err?.message || "").includes("Unique constraint") && idempotencyKey) {
      return await prisma.notification.findUnique({ where: { idempotencyKey } });
    }
    console.error("[NotificationService] DB save failed:", err?.message || err);
    return null;
  }

  // 4. Channel 1: Realtime WebSocket Dispatch (Socket.IO)
  try {
    if (realtime?.io) {
      const payload = {
        id: notification.id,
        notificationType,
        title: notification.title,
        message: notification.message,
        orderId: notification.orderId,
        restaurantId: notification.restaurantId,
        data: notification.data,
        createdAt: notification.createdAt,
      };

      if (recipientType === RECIPIENT_TYPES.CUSTOMER) {
        realtime.io.to(`customer:${recipientId}`).emit("notification:new", payload);
      } else if (recipientType === RECIPIENT_TYPES.USER || recipientType === RECIPIENT_TYPES.RESTAURANT) {
        if (restaurantId) {
          realtime.io.to(`restaurant:${restaurantId}`).emit("notification:new", payload);
        }
      }
    }
  } catch (wsErr) {
    console.error("[NotificationService] WebSocket dispatch failed:", wsErr?.message || wsErr);
  }

  // 5. Channel 2: FCM Push Notification Dispatch to Active Devices
  try {
    const isCustomer = recipientType === RECIPIENT_TYPES.CUSTOMER;
    const tokens = await prisma.deviceToken.findMany({
      where: isCustomer
        ? { customerId: Number(recipientId), isActive: true }
        : { userId: Number(recipientId), isActive: true },
      select: { deviceToken: true },
    });

    for (const t of tokens) {
      sendFcmPushNotification({
        deviceToken: t.deviceToken,
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: notification.id,
          notificationType,
          orderId: notification.orderId || "",
          restaurantId: notification.restaurantId || "",
          screen: data?.screen || "ORDER_TRACKING",
        },
        prisma,
      }).catch(() => {});
    }
  } catch (fcmErr) {
    console.error("[NotificationService] Push dispatch error:", fcmErr?.message || fcmErr);
  }

  return notification;
};

/**
 * Register or update FCM Device Token for a user or customer
 */
export const registerDeviceToken = async ({
  prisma,
  userId = null,
  customerId = null,
  deviceToken,
  platform = "ANDROID",
  deviceId = null,
}) => {
  if (!prisma || !deviceToken) {
    throw new Error("Device token is required");
  }

  const cleanToken = String(deviceToken).trim();
  const cleanPlatform = String(platform || "ANDROID").toUpperCase();

  return await prisma.deviceToken.upsert({
    where: { deviceToken: cleanToken },
    update: {
      userId: userId ? Number(userId) : null,
      customerId: customerId ? Number(customerId) : null,
      platform: cleanPlatform,
      deviceId: deviceId ? String(deviceId) : null,
      isActive: true,
      lastUsedAt: new Date(),
    },
    create: {
      userId: userId ? Number(userId) : null,
      customerId: customerId ? Number(customerId) : null,
      deviceToken: cleanToken,
      platform: cleanPlatform,
      deviceId: deviceId ? String(deviceId) : null,
      isActive: true,
      lastUsedAt: new Date(),
    },
  });
};

/**
 * Deactivate or remove a device token
 */
export const removeDeviceToken = async ({ prisma, deviceToken }) => {
  if (!prisma || !deviceToken) return;
  return await prisma.deviceToken.updateMany({
    where: { deviceToken: String(deviceToken).trim() },
    data: { isActive: false },
  });
};

/**
 * Get Notification Preferences for user or customer
 */
export const getNotificationPreferences = async ({ prisma, userId = null, customerId = null }) => {
  if (!prisma) return null;

  const isCustomer = Boolean(customerId);
  const where = isCustomer ? { customerId: Number(customerId) } : { userId: Number(userId) };

  let pref = await prisma.notificationPreference.findFirst({ where });
  if (!pref) {
    pref = await prisma.notificationPreference.create({
      data: {
        userId: userId ? Number(userId) : null,
        customerId: customerId ? Number(customerId) : null,
      },
    });
  }
  return pref;
};

/**
 * Update Notification Preferences
 */
export const updateNotificationPreferences = async ({
  prisma,
  userId = null,
  customerId = null,
  preferences = {},
}) => {
  const isCustomer = Boolean(customerId);
  const where = isCustomer ? { customerId: Number(customerId) } : { userId: Number(userId) };

  const current = await getNotificationPreferences({ prisma, userId, customerId });

  return await prisma.notificationPreference.update({
    where: { id: current.id },
    data: {
      orderUpdates: preferences.orderUpdates !== undefined ? Boolean(preferences.orderUpdates) : current.orderUpdates,
      paymentUpdates: preferences.paymentUpdates !== undefined ? Boolean(preferences.paymentUpdates) : current.paymentUpdates,
      deliveryUpdates: preferences.deliveryUpdates !== undefined ? Boolean(preferences.deliveryUpdates) : current.deliveryUpdates,
      promotions: preferences.promotions !== undefined ? Boolean(preferences.promotions) : current.promotions,
      coupons: preferences.coupons !== undefined ? Boolean(preferences.coupons) : current.coupons,
      reviewReminders: preferences.reviewReminders !== undefined ? Boolean(preferences.reviewReminders) : current.reviewReminders,
    },
  });
};

/**
 * Get User/Customer Notifications
 */
export const getUserNotifications = async ({
  prisma,
  recipientType = RECIPIENT_TYPES.CUSTOMER,
  recipientId,
  isRead = null,
  page = 1,
  limit = 20,
}) => {
  const p = Math.max(1, Number(page || 1));
  const l = Math.min(100, Math.max(1, Number(limit || 20)));

  const where = {
    recipientType,
    recipientId: Number(recipientId),
    ...(isRead !== null ? { isRead: Boolean(isRead) } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * l,
      take: l,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { recipientType, recipientId: Number(recipientId), isRead: false },
    }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: p,
    limit: l,
  };
};

/**
 * Mark a single notification read
 */
export const markNotificationRead = async ({ prisma, notificationId, recipientType, recipientId }) => {
  return await prisma.notification.updateMany({
    where: {
      id: Number(notificationId),
      recipientType,
      recipientId: Number(recipientId),
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

/**
 * Mark all notifications read for recipient
 */
export const markAllNotificationsRead = async ({ prisma, recipientType, recipientId }) => {
  return await prisma.notification.updateMany({
    where: {
      recipientType,
      recipientId: Number(recipientId),
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};
