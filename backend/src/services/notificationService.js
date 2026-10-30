import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  RECIPIENT_TYPES,
  NOTIFICATION_PRIORITY_MAP,
} from "../constants/notificationTypes.js";
import { sendFcmPushNotification } from "./fcmService.js";
import { inferRoleFromDesignation } from "./staffSessionService.js";

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
        recipientType: notification.recipientType,
        recipientId: notification.recipientId,
        title: notification.title,
        message: notification.message,
        orderId: notification.orderId,
        restaurantId: notification.restaurantId,
        tableId: notification.data?.tableId ? Number(notification.data.tableId) : null,
        tableNo: notification.data?.tableNo || null,
        data: notification.data,
        isRead: false,
        createdAt: notification.createdAt,
      };

      const emitToTargetRooms = (target, rooms, event, data) => {
        if (!target || typeof target.to !== "function") return;
        const validRooms = rooms.filter(Boolean);
        if (!validRooms.length) return;

        let chain = target.to(validRooms[0]);
        for (let i = 1; i < validRooms.length; i++) {
          if (typeof chain?.to === "function") {
            chain = chain.to(validRooms[i]);
          }
        }
        if (typeof chain?.emit === "function") {
          chain.emit(event, data);
        }
      };

      if (recipientType === RECIPIENT_TYPES.CUSTOMER) {
        emitToTargetRooms(realtime.io, [`customer:${recipientId}`, `customer_${recipientId}`], "notification:new", payload);
      } else if (recipientType === "SUPPLIER") {
        emitToTargetRooms(realtime.io, [`supplier:${recipientId}`, `supplier_${recipientId}`], "notification:new", payload);
      } else if (recipientType === RECIPIENT_TYPES.USER) {
        // User-targeted notification: dispatch ONLY to user room, never broadcast restaurant-wide
        emitToTargetRooms(realtime.io, [`user:${recipientId}`, `user_${recipientId}`], "notification:new", payload);
        if (realtime?.staff) {
          emitToTargetRooms(realtime.staff, [`user:${recipientId}`, `user_${recipientId}`], "notification:new", payload);
        } else if (typeof realtime?.io?.of === "function") {
          emitToTargetRooms(realtime.io.of("/staff"), [`user:${recipientId}`, `user_${recipientId}`], "notification:new", payload);
        }
      } else if (recipientType === RECIPIENT_TYPES.RESTAURANT) {
        // Restaurant-wide notification: broadcast to root restaurant rooms and staff Owner/Manager rooms
        if (restaurantId) {
          emitToTargetRooms(realtime.io, [`restaurant:${restaurantId}`, `restaurant_${restaurantId}`], "notification:new", payload);
          const ownerManagerRooms = [
            `restaurant:${restaurantId}:role:OWNER`,
            `restaurant_${restaurantId}_role_OWNER`,
            `restaurant:${restaurantId}:role:MANAGER`,
            `restaurant_${restaurantId}_role_MANAGER`,
          ];
          if (realtime?.staff) {
            emitToTargetRooms(realtime.staff, ownerManagerRooms, "notification:new", payload);
          } else if (typeof realtime?.io?.of === "function") {
            emitToTargetRooms(realtime.io.of("/staff"), ownerManagerRooms, "notification:new", payload);
          }
        }
      } else if (["OWNER", "MANAGER", "CLEANER", "STEWARD", "WAITER", "CHEF", "CASHIER", "SWIPER"].includes(String(recipientType).toUpperCase())) {
        // Designation / Role-targeted notification
        const rid = Number(restaurantId || recipientId);
        const normRole = String(recipientType).toUpperCase();
        if (rid) {
          const roleRooms = [
            `restaurant:${rid}:role:${normRole}`,
            `restaurant_${rid}_role_${normRole}`,
          ];
          emitToTargetRooms(realtime.io, roleRooms, "notification:new", payload);
          if (realtime?.staff) {
            emitToTargetRooms(realtime.staff, roleRooms, "notification:new", payload);
          } else if (typeof realtime?.io?.of === "function") {
            emitToTargetRooms(realtime.io.of("/staff"), roleRooms, "notification:new", payload);
          }
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
 * Resolve database condition criteria based on user designation and role
 */
export const resolveUserRoleConditions = async ({
  prisma,
  userId,
  restaurantId,
  effectiveRole = null,
  designation = null,
  role = null,
}) => {
  const uid = Number(userId);
  const rid = restaurantId ? Number(restaurantId) : null;
  const userConditions = [{ recipientType: RECIPIENT_TYPES.USER, recipientId: uid }];

  let resolvedRole = effectiveRole || inferRoleFromDesignation(designation);
  if (!resolvedRole && role) {
    resolvedRole = String(role).toUpperCase();
  }

  if (!resolvedRole && prisma && uid) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: uid },
        select: { role: true, designation: true },
      });
      if (u) {
        resolvedRole = inferRoleFromDesignation(u.designation) || String(u.role || "").toUpperCase();
      }
    } catch {
      // fallback
    }
  }

  if (rid) {
    if (resolvedRole === "OWNER" || resolvedRole === "MANAGER" || resolvedRole === "SUPER_ADMIN") {
      userConditions.push({ recipientType: RECIPIENT_TYPES.RESTAURANT, recipientId: rid });
      userConditions.push({ recipientType: "OWNER", recipientId: rid });
      userConditions.push({ recipientType: "MANAGER", recipientId: rid });
    } else if (resolvedRole === "CLEANER") {
      userConditions.push({ recipientType: "CLEANER", recipientId: rid });
    } else if (resolvedRole === "STEWARD") {
      userConditions.push({ recipientType: "STEWARD", recipientId: rid });
    } else if (resolvedRole === "WAITER") {
      userConditions.push({ recipientType: "WAITER", recipientId: rid });
    } else if (resolvedRole === "CHEF") {
      userConditions.push({ recipientType: "CHEF", recipientId: rid });
      userConditions.push({ recipientType: "KITCHEN", recipientId: rid });
    } else if (resolvedRole === "CASHIER") {
      userConditions.push({ recipientType: "CASHIER", recipientId: rid });
    } else if (resolvedRole === "SWIPER") {
      userConditions.push({ recipientType: "SWIPER", recipientId: rid });
    } else {
      // If role is undefined/unrecognized, include RESTAURANT for backward compatibility with general tests
      userConditions.push({ recipientType: RECIPIENT_TYPES.RESTAURANT, recipientId: rid });
    }
  }

  return userConditions;
};

/**
 * Dispatch notification targeted to a specific staff designation across the restaurant.
 * Persists both a role-targeted notification and individual user records for all active staff of that role.
 */
export const dispatchDesignationNotification = async ({
  prisma,
  realtime,
  restaurantId,
  designation,
  targetDesignation,
  title,
  message,
  notificationType,
  priority = null,
  data = {},
  idempotencyKey = null,
  targetUserId = null,
  orderId = null,
}) => {
  const actualDesignation = designation || targetDesignation;
  if (!prisma || !restaurantId || !actualDesignation || !title || !message) return null;

  const rid = Number(restaurantId);
  const normRole = inferRoleFromDesignation(actualDesignation) || String(actualDesignation).toUpperCase();

  // If specific targetUserId is provided, send to that user directly
  if (targetUserId) {
    return await createAndDispatchNotification({
      prisma,
      realtime,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: Number(targetUserId),
      restaurantId: rid,
      orderId,
      notificationType,
      title,
      message,
      data,
      priority,
      idempotencyKey,
    });
  }

  // Find all active staff users with this designation in the restaurant
  let targetUsers = [];
  try {
    const allStaff = await prisma.user.findMany({
      where: { restaurantId: rid, isActive: true },
      select: { id: true, role: true, designation: true },
    });
    targetUsers = allStaff.filter((u) => {
      const uRole = inferRoleFromDesignation(u.designation) || String(u.role || "").toUpperCase();
      return uRole === normRole;
    });
  } catch (err) {
    console.error("[dispatchDesignationNotification] user lookup error:", err?.message);
  }

  // Dispatch role-level notification
  const roleNotif = await createAndDispatchNotification({
    prisma,
    realtime,
    recipientType: normRole,
    recipientId: rid,
    restaurantId: rid,
    orderId,
    notificationType,
    title,
    message,
    data,
    priority,
    idempotencyKey: idempotencyKey ? `${idempotencyKey}_role_${normRole}` : null,
  });

  // Dispatch personal user notification to each active staff member with that role
  for (const u of targetUsers) {
    await createAndDispatchNotification({
      prisma,
      realtime,
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: u.id,
      restaurantId: rid,
      orderId,
      notificationType,
      title,
      message,
      data,
      priority,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}_user_${u.id}` : null,
    }).catch(() => {});
  }

  return roleNotif;
};

/**
 * Get User/Customer Notifications
 */
export const getUserNotifications = async ({
  prisma,
  recipientType = null,
  recipientId = null,
  userId = null,
  restaurantId = null,
  effectiveRole = null,
  designation = null,
  role = null,
  userRole = null,
  isRead = null,
  page = 1,
  limit = 20,
}) => {
  const p = Math.max(1, Number(page || 1));
  const l = Math.min(100, Math.max(1, Number(limit || 20)));

  const recId = recipientId !== undefined && recipientId !== null ? recipientId : userId;
  const effRole = effectiveRole || userRole || role;
  let recType = recipientType;
  if (!recType) {
    if (effRole || designation || recId) {
      recType = RECIPIENT_TYPES.USER;
    } else {
      recType = RECIPIENT_TYPES.CUSTOMER;
    }
  } else if (recType === RECIPIENT_TYPES.CUSTOMER && (effRole || designation || recId)) {
    recType = RECIPIENT_TYPES.USER;
  }

  let where;
  let unreadWhere;

  if (recType === "SUPPLIER") {
    const supplierConditions = [
      { recipientType: "SUPPLIER", recipientId: Number(recId) },
      { recipientType: RECIPIENT_TYPES.USER, recipientId: Number(recId) },
    ];
    where = {
      OR: supplierConditions,
      ...(isRead !== null ? { isRead: Boolean(isRead) } : {}),
    };
    unreadWhere = {
      OR: supplierConditions,
      isRead: false,
    };
  } else if (recType === RECIPIENT_TYPES.USER) {
    const userConditions = await resolveUserRoleConditions({
      prisma,
      userId: recId,
      restaurantId,
      effectiveRole: effRole,
      designation,
      role: effRole,
    });
    where = {
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
      OR: userConditions,
      ...(isRead !== null ? { isRead: Boolean(isRead) } : {}),
    };
    unreadWhere = {
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
      OR: userConditions,
      isRead: false,
    };
  } else if (recType === RECIPIENT_TYPES.RESTAURANT) {
    const rid = Number(restaurantId || recId);
    where = {
      recipientType: RECIPIENT_TYPES.RESTAURANT,
      recipientId: rid,
      ...(isRead !== null ? { isRead: Boolean(isRead) } : {}),
    };
    unreadWhere = {
      recipientType: RECIPIENT_TYPES.RESTAURANT,
      recipientId: rid,
      isRead: false,
    };
  } else {
    const recipientCondition = Array.isArray(recId)
      ? { in: recId.map(Number) }
      : recId !== undefined && recId !== null ? Number(recId) : undefined;
    where = {
      ...(recType ? { recipientType: recType } : {}),
      ...(recipientCondition !== undefined ? { recipientId: recipientCondition } : {}),
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
      ...(isRead !== null ? { isRead: Boolean(isRead) } : {}),
    };
    unreadWhere = {
      ...(recType ? { recipientType: recType } : {}),
      ...(recipientCondition !== undefined ? { recipientId: recipientCondition } : {}),
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
      isRead: false,
    };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * l,
      take: l,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: unreadWhere }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: p,
    limit: l,
    hasMore: (p * l) < total,
  };
};

/**
 * Mark a single notification read
 */
export const markNotificationRead = async ({
  prisma,
  notificationId,
  recipientType = null,
  recipientId = null,
  userId = null,
  restaurantId = null,
  effectiveRole = null,
  designation = null,
  role = null,
  userRole = null,
}) => {
  const recId = recipientId !== undefined && recipientId !== null ? recipientId : userId;
  const effRole = effectiveRole || userRole || role;
  let recType = recipientType;
  if (!recType) {
    if (effRole || designation || recId) {
      recType = RECIPIENT_TYPES.USER;
    } else {
      recType = RECIPIENT_TYPES.CUSTOMER;
    }
  }

  let where = { id: Number(notificationId) };
  if (recType === RECIPIENT_TYPES.USER && restaurantId) {
    const userConditions = await resolveUserRoleConditions({
      prisma,
      userId: recId,
      restaurantId,
      effectiveRole: effRole,
      designation,
      role: effRole,
    });
    where = {
      id: Number(notificationId),
      restaurantId: Number(restaurantId),
      OR: userConditions,
    };
  } else if (recType === RECIPIENT_TYPES.USER && recId) {
    where = {
      id: Number(notificationId),
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: Number(recId),
    };
  } else if (recType === RECIPIENT_TYPES.RESTAURANT) {
    const rid = Number(restaurantId || recId);
    where = {
      id: Number(notificationId),
      recipientType: RECIPIENT_TYPES.RESTAURANT,
      recipientId: rid,
    };
  } else if (recId !== undefined && recId !== null) {
    const recipientCondition = Array.isArray(recId)
      ? { in: recId.map(Number) }
      : Number(recId);
    where = {
      id: Number(notificationId),
      ...(recType ? { recipientType: recType } : {}),
      recipientId: recipientCondition,
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
    };
  } else if (restaurantId) {
    where = {
      id: Number(notificationId),
      restaurantId: Number(restaurantId),
    };
  }

  const updated = await prisma.notification.updateMany({
    where,
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  const updatedNotif = await prisma.notification.findUnique({
    where: { id: Number(notificationId) },
  });

  return { success: true, count: updated.count, notification: updatedNotif };
};

/**
 * Mark all notifications read for recipient
 */
export const markAllNotificationsRead = async ({
  prisma,
  recipientType = null,
  recipientId = null,
  userId = null,
  restaurantId = null,
  effectiveRole = null,
  designation = null,
  role = null,
  userRole = null,
}) => {
  const recId = recipientId !== undefined && recipientId !== null ? recipientId : userId;
  const effRole = effectiveRole || userRole || role;
  let recType = recipientType;
  if (!recType) {
    if (effRole || designation || recId) {
      recType = RECIPIENT_TYPES.USER;
    } else {
      recType = RECIPIENT_TYPES.CUSTOMER;
    }
  }

  let where = { isRead: false };
  if (recType === RECIPIENT_TYPES.USER && restaurantId) {
    const userConditions = await resolveUserRoleConditions({
      prisma,
      userId: recId,
      restaurantId,
      effectiveRole: effRole,
      designation,
      role: effRole,
    });
    where = {
      restaurantId: Number(restaurantId),
      OR: userConditions,
      isRead: false,
    };
  } else if (recType === RECIPIENT_TYPES.USER && recId) {
    where = {
      recipientType: RECIPIENT_TYPES.USER,
      recipientId: Number(recId),
      isRead: false,
    };
  } else if (recType === RECIPIENT_TYPES.RESTAURANT) {
    const rid = Number(restaurantId || recId);
    where = {
      recipientType: RECIPIENT_TYPES.RESTAURANT,
      recipientId: rid,
      isRead: false,
    };
  } else if (recId !== undefined && recId !== null) {
    const recipientCondition = Array.isArray(recId)
      ? { in: recId.map(Number) }
      : Number(recId);
    where = {
      ...(recType ? { recipientType: recType } : {}),
      recipientId: recipientCondition,
      ...(restaurantId ? { restaurantId: Number(restaurantId) } : {}),
      isRead: false,
    };
  } else if (restaurantId) {
    where = {
      restaurantId: Number(restaurantId),
      isRead: false,
    };
  }

  return await prisma.notification.updateMany({
    where,
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};
