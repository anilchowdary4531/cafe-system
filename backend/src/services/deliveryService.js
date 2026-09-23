import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";
import { createAndDispatchNotification } from "./notificationService.js";

const createAuditLog = async ({ prisma, restaurantId, userId, action, entity, entityId, details }) => {
  try {
    console.log(`[AUDIT LOG] [Rest: ${restaurantId}] User: ${userId || "System"} Action: ${action} Entity: ${entity}#${entityId}`, details);
  } catch {}
};

const VALID_TRANSITIONS = {
  UNASSIGNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "UNASSIGNED", "CANCELLED"],
  ACCEPTED: ["REACHED_RESTAURANT", "CANCELLED"],
  REACHED_RESTAURANT: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "CANCELLED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

const TERMINAL_STATUSES = new Set(["DELIVERED", "FAILED", "CANCELLED"]);

export const createDeliveryPartner = async ({ prisma, restaurantId, branchId, userId, name, phone, email, vehicleType, vehicleNumber }) => {
  const rid = Number(restaurantId);
  if (!rid || !name || !phone) {
    throw new Error("restaurantId, name, and phone are required.");
  }

  const partner = await prisma.deliveryPartner.create({
    data: {
      restaurantId: rid,
      branchId: branchId ? Number(branchId) : null,
      userId: userId ? Number(userId) : null,
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : null,
      vehicleType: String(vehicleType || "BIKE").toUpperCase(),
      vehicleNumber: String(vehicleNumber || "").trim(),
      status: "AVAILABLE",
      isActive: true,
    },
  });

  await createAuditLog({
    prisma,
    restaurantId: rid,
    userId: userId || null,
    action: "DELIVERY_PARTNER_CREATE",
    entity: "DeliveryPartner",
    entityId: partner.id,
    details: { name: partner.name, phone: partner.phone, vehicleNumber: partner.vehicleNumber },
  }).catch(() => {});

  return partner;
};

export const getDeliveryPartners = async ({ prisma, restaurantId, branchId, status, isActive, search }) => {
  const rid = Number(restaurantId);
  if (!rid) throw new Error("restaurantId is required.");

  const where = { restaurantId: rid };
  if (branchId) where.branchId = Number(branchId);
  if (status) where.status = String(status).toUpperCase();
  if (isActive !== undefined && isActive !== null) where.isActive = String(isActive) === "true" || isActive === true;

  if (search) {
    const s = String(search).trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { phone: { contains: s, mode: "insensitive" } },
      { vehicleNumber: { contains: s, mode: "insensitive" } },
    ];
  }

  const partners = await prisma.deliveryPartner.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      deliveries: {
        where: { status: { in: ["ASSIGNED", "ACCEPTED", "REACHED_RESTAURANT", "PICKED_UP", "OUT_FOR_DELIVERY"] } },
        select: { id: true, orderId: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return partners.map((p) => ({
    ...p,
    activeDeliveriesCount: p.deliveries?.length || 0,
  }));
};

export const updateDeliveryPartner = async ({ prisma, restaurantId, partnerId, data, actor }) => {
  const rid = Number(restaurantId);
  const pid = Number(partnerId);
  if (!rid || !pid) throw new Error("restaurantId and partnerId are required.");

  const existing = await prisma.deliveryPartner.findFirst({
    where: { id: pid, restaurantId: rid },
  });

  if (!existing) throw new Error("Delivery partner not found.");

  const updateData = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.phone !== undefined) updateData.phone = String(data.phone).trim();
  if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
  if (data.vehicleType !== undefined) updateData.vehicleType = String(data.vehicleType).toUpperCase();
  if (data.vehicleNumber !== undefined) updateData.vehicleNumber = String(data.vehicleNumber).trim();
  if (data.status !== undefined) updateData.status = String(data.status).toUpperCase();
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
  if (data.userId !== undefined) updateData.userId = data.userId ? Number(data.userId) : null;

  const updated = await prisma.deliveryPartner.update({
    where: { id: pid },
    data: updateData,
  });

  await createAuditLog({
    prisma,
    restaurantId: rid,
    userId: actor?.userId || null,
    action: "DELIVERY_PARTNER_UPDATE",
    entity: "DeliveryPartner",
    entityId: pid,
    details: updateData,
  }).catch(() => {});

  return updated;
};

export const deleteDeliveryPartner = async ({ prisma, restaurantId, partnerId, actor }) => {
  const rid = Number(restaurantId);
  const pid = Number(partnerId);
  if (!rid || !pid) throw new Error("restaurantId and partnerId are required.");

  const existing = await prisma.deliveryPartner.findFirst({
    where: { id: pid, restaurantId: rid },
  });

  if (!existing) throw new Error("Delivery partner not found.");

  const updated = await prisma.deliveryPartner.update({
    where: { id: pid },
    data: { isActive: false, status: "OFFLINE" },
  });

  await createAuditLog({
    prisma,
    restaurantId: rid,
    userId: actor?.userId || null,
    action: "DELIVERY_PARTNER_DEACTIVATE",
    entity: "DeliveryPartner",
    entityId: pid,
    details: { isActive: false },
  }).catch(() => {});

  return updated;
};

export const assignDeliveryPartner = async ({ prisma, io, restaurantId, orderId, partnerId, actor }) => {
  const rid = Number(restaurantId);
  const oid = Number(orderId);
  const pid = Number(partnerId);

  if (!rid || !oid || !pid) {
    throw new Error("restaurantId, orderId, and partnerId are required.");
  }

  const order = await prisma.order.findFirst({
    where: { id: oid, restaurantId: rid },
    include: { restaurant: true },
  });

  if (!order) throw new Error("Order not found or does not belong to this restaurant.");

  if (String(order.status).toUpperCase() === "CANCELLED") {
    throw new Error("Cannot assign delivery for a cancelled order.");
  }

  const partner = await prisma.deliveryPartner.findFirst({
    where: { id: pid, restaurantId: rid, isActive: true },
  });

  if (!partner) throw new Error("Delivery partner not found or inactive.");

  const addressSnapshot = order.deliveryAddress || `${order.customerName || "Customer"}, Ph: ${order.phone || "N/A"}`;
  const now = new Date();
  const isCod = ["CASH", "COD"].includes(String(order.paymentMode || "").toUpperCase());

  const delivery = await prisma.delivery.upsert({
    where: { orderId: oid },
    create: {
      orderId: oid,
      restaurantId: rid,
      branchId: order.branchId,
      deliveryPartnerId: pid,
      status: "ASSIGNED",
      assignedAt: now,
      deliveryAddressSnapshot: addressSnapshot,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      customerNotes: order.notes,
      codAmount: isCod ? Number(order.total || 0) : 0,
      codCollected: false,
    },
    update: {
      deliveryPartnerId: pid,
      status: "ASSIGNED",
      assignedAt: now,
      deliveryAddressSnapshot: addressSnapshot,
      deliveryLatitude: order.deliveryLatitude || undefined,
      deliveryLongitude: order.deliveryLongitude || undefined,
    },
    include: {
      deliveryPartner: true,
      order: {
        select: {
          id: true,
          orderNo: true,
          total: true,
          paymentMode: true,
          paymentStatus: true,
          status: true,
          customerName: true,
          phone: true,
        },
      },
    },
  });

  await prisma.deliveryPartner.update({
    where: { id: pid },
    data: { status: "BUSY" },
  });

  // Emit Socket.IO events
  if (io) {
    const payload = {
      deliveryId: delivery.id,
      orderId: oid,
      status: "ASSIGNED",
      deliveryPartner: {
        id: partner.id,
        name: partner.name,
        phone: partner.phone,
        vehicleNumber: partner.vehicleNumber,
        vehicleType: partner.vehicleType,
      },
      updatedAt: now.toISOString(),
    };

    io.to(`delivery:${delivery.id}`).emit("delivery_status_changed", payload);
    io.to(`order_${oid}`).emit("delivery_status_update", payload);
    io.to(`restaurant_${rid}`).emit("delivery_assigned", payload);
    io.to(`restaurant:${rid}`).emit("delivery_assigned", payload);
  }

  // Dispatch notification
  try {
    await createAndDispatchNotification({
      prisma,
      realtime: { io },
      recipientType: RECIPIENT_TYPES.RESTAURANT,
      recipientId: rid,
      restaurantId: rid,
      orderId: oid,
      notificationType: NOTIFICATION_TYPES.ORDER_UPDATE,
      title: "🛵 Driver Assigned",
      message: `Driver ${partner.name} assigned to Order #${order.orderNo || oid}.`,
      data: { orderId: oid, deliveryId: delivery.id, driverName: partner.name },
      idempotencyKey: `delivery_assigned_${delivery.id}_${partner.id}`,
    }).catch(() => {});
  } catch {}

  await createAuditLog({
    prisma,
    restaurantId: rid,
    userId: actor?.userId || null,
    action: "DELIVERY_ASSIGNED",
    entity: "Delivery",
    entityId: delivery.id,
    details: { orderId: oid, partnerId: pid, partnerName: partner.name },
  }).catch(() => {});

  return delivery;
};

export const reassignDeliveryPartner = async ({ prisma, io, restaurantId, deliveryId, newPartnerId, reason, actor }) => {
  const rid = Number(restaurantId);
  const did = Number(deliveryId);
  const newPid = Number(newPartnerId);

  if (!rid || !did || !newPid) throw new Error("restaurantId, deliveryId, and newPartnerId are required.");

  const delivery = await prisma.delivery.findFirst({
    where: { id: did, restaurantId: rid },
  });

  if (!delivery) throw new Error("Delivery record not found.");

  if (TERMINAL_STATUSES.has(delivery.status)) {
    throw new Error(`Cannot reassign delivery in terminal status ${delivery.status}.`);
  }

  const oldPartnerId = delivery.deliveryPartnerId;

  const newPartner = await prisma.deliveryPartner.findFirst({
    where: { id: newPid, restaurantId: rid, isActive: true },
  });

  if (!newPartner) throw new Error("New delivery partner not found or inactive.");

  const updatedDelivery = await prisma.delivery.update({
    where: { id: did },
    data: {
      deliveryPartnerId: newPid,
      assignedAt: new Date(),
    },
    include: {
      deliveryPartner: true,
      order: { select: { id: true, orderNo: true, status: true } },
    },
  });

  // Free old partner if no other active deliveries
  if (oldPartnerId && oldPartnerId !== newPid) {
    const activeCount = await prisma.delivery.count({
      where: {
        deliveryPartnerId: oldPartnerId,
        status: { in: ["ASSIGNED", "ACCEPTED", "REACHED_RESTAURANT", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        id: { not: did },
      },
    });
    if (activeCount === 0) {
      await prisma.deliveryPartner.update({
        where: { id: oldPartnerId },
        data: { status: "AVAILABLE" },
      });
    }
  }

  await prisma.deliveryPartner.update({
    where: { id: newPid },
    data: { status: "BUSY" },
  });

  if (io) {
    const payload = {
      deliveryId: did,
      orderId: delivery.orderId,
      status: delivery.status,
      deliveryPartner: {
        id: newPartner.id,
        name: newPartner.name,
        phone: newPartner.phone,
        vehicleNumber: newPartner.vehicleNumber,
      },
      reassigned: true,
      reason: reason || "Manager reassigned driver",
    };
    io.to(`delivery:${did}`).emit("delivery_status_changed", payload);
    io.to(`restaurant_${rid}`).emit("delivery_reassigned", payload);
  }

  await createAuditLog({
    prisma,
    restaurantId: rid,
    userId: actor?.userId || null,
    action: "DELIVERY_REASSIGNED",
    entity: "Delivery",
    entityId: did,
    details: { oldPartnerId, newPartnerId: newPid, reason },
  }).catch(() => {});

  return updatedDelivery;
};

export const updateDeliveryStatus = async ({
  prisma,
  io,
  restaurantId,
  deliveryId,
  orderId,
  driverActor,
  nextStatus,
  lat,
  lng,
  failureReason,
  driverNotes,
}) => {
  let delivery = null;

  if (deliveryId) {
    delivery = await prisma.delivery.findUnique({
      where: { id: Number(deliveryId) },
      include: { deliveryPartner: true, order: true },
    });
  } else if (orderId) {
    delivery = await prisma.delivery.findUnique({
      where: { orderId: Number(orderId) },
      include: { deliveryPartner: true, order: true },
    });
  }

  if (!delivery) throw new Error("Delivery record not found.");

  const rid = Number(restaurantId || delivery.restaurantId);
  const cleanNext = String(nextStatus).toUpperCase();

  // If driverActor provided, ensure driver authorization
  if (driverActor && driverActor.role === "DRIVER") {
    if (delivery.deliveryPartner?.userId && delivery.deliveryPartner.userId !== driverActor.userId) {
      throw new Error("Unauthorized. Driver does not own this delivery.");
    }
  }

  // Idempotency check: if already in requested state or terminal state
  if (delivery.status === cleanNext) {
    return delivery;
  }

  if (TERMINAL_STATUSES.has(delivery.status) && delivery.status !== cleanNext) {
    throw new Error(`Cannot change delivery status from terminal state ${delivery.status}.`);
  }

  // Validate state transition
  const allowed = VALID_TRANSITIONS[delivery.status] || [];
  if (!allowed.includes(cleanNext)) {
    throw new Error(`Invalid status transition from ${delivery.status} to ${cleanNext}.`);
  }

  const now = new Date();
  const updateData = {
    status: cleanNext,
    updatedAt: now,
  };

  if (driverNotes !== undefined) updateData.driverNotes = String(driverNotes);
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    updateData.currentDriverLatitude = Number(lat);
    updateData.currentDriverLongitude = Number(lng);
    updateData.lastLocationUpdate = now;
  }

  // Update timestamps
  if (cleanNext === "ACCEPTED") updateData.acceptedAt = now;
  if (cleanNext === "REACHED_RESTAURANT") updateData.reachedRestaurantAt = now;
  if (cleanNext === "PICKED_UP") updateData.pickedUpAt = now;
  if (cleanNext === "OUT_FOR_DELIVERY") updateData.outForDeliveryAt = now;
  if (cleanNext === "DELIVERED") updateData.deliveredAt = now;
  if (cleanNext === "FAILED") {
    updateData.failedAt = now;
    updateData.failureReason = failureReason || "Delivery failed";
  }
  if (cleanNext === "CANCELLED") updateData.cancelledAt = now;

  // Perform delivery update
  const updatedDelivery = await prisma.delivery.update({
    where: { id: delivery.id },
    data: updateData,
    include: {
      deliveryPartner: true,
      order: true,
    },
  });

  // Synchronize Order status
  if (cleanNext === "OUT_FOR_DELIVERY") {
    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: "READY" },
    }).catch(() => {});
  } else if (cleanNext === "DELIVERED") {
    const isCod = ["CASH", "COD"].includes(String(delivery.order?.paymentMode || "").toUpperCase());
    const orderData = { status: "DELIVERED" };

    if (isCod) {
      orderData.paymentStatus = "SUCCESS";
    }

    await prisma.order.update({
      where: { id: delivery.orderId },
      data: orderData,
    }).catch(() => {});

    if (isCod) {
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { codCollected: true, codCollectedAt: now },
      }).catch(() => {});
    }
  }

  // Free partner on completion / termination
  if (TERMINAL_STATUSES.has(cleanNext) && delivery.deliveryPartnerId) {
    const activeDeliveries = await prisma.delivery.count({
      where: {
        deliveryPartnerId: delivery.deliveryPartnerId,
        status: { in: ["ASSIGNED", "ACCEPTED", "REACHED_RESTAURANT", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        id: { not: delivery.id },
      },
    });

    if (activeDeliveries === 0) {
      await prisma.deliveryPartner.update({
        where: { id: delivery.deliveryPartnerId },
        data: { status: "AVAILABLE" },
      }).catch(() => {});
    }
  }

  // Realtime emit
  if (io) {
    const payload = {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      status: cleanNext,
      lat: updateData.currentDriverLatitude || delivery.currentDriverLatitude,
      lng: updateData.currentDriverLongitude || delivery.currentDriverLongitude,
      timestamp: now.toISOString(),
      deliveryPartner: updatedDelivery.deliveryPartner
        ? {
            id: updatedDelivery.deliveryPartner.id,
            name: updatedDelivery.deliveryPartner.name,
            phone: updatedDelivery.deliveryPartner.phone,
            vehicleNumber: updatedDelivery.deliveryPartner.vehicleNumber,
          }
        : null,
    };

    io.to(`delivery:${delivery.id}`).emit("delivery_status_changed", payload);
    io.to(`order_${delivery.orderId}`).emit("delivery_status_update", payload);
    io.to(`restaurant_${rid}`).emit("delivery_status_changed", payload);
    io.to(`restaurant:${rid}`).emit("delivery_status_changed", payload);
  }

  await createAuditLog({
    prisma,
    restaurantId: rid,
    userId: driverActor?.userId || null,
    action: "DELIVERY_STATUS_UPDATE",
    entity: "Delivery",
    entityId: delivery.id,
    details: { oldStatus: delivery.status, newStatus: cleanNext, orderId: delivery.orderId },
  }).catch(() => {});

  return updatedDelivery;
};

export const updateDriverLocation = async ({ prisma, io, driverActor, deliveryId, lat, lng }) => {
  const did = Number(deliveryId);
  const nLat = Number(lat);
  const nLng = Number(lng);

  if (!did || !Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    throw new Error("Invalid deliveryId or coordinates.");
  }

  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
    throw new Error("Coordinates out of range.");
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: did },
    include: { deliveryPartner: true },
  });

  if (!delivery) throw new Error("Delivery record not found.");

  // Verify driver ownership
  if (driverActor && driverActor.userId && delivery.deliveryPartner?.userId) {
    if (delivery.deliveryPartner.userId !== driverActor.userId) {
      throw new Error("Unauthorized location update.");
    }
  }

  const now = new Date();

  await prisma.delivery.update({
    where: { id: did },
    data: {
      currentDriverLatitude: nLat,
      currentDriverLongitude: nLng,
      lastLocationUpdate: now,
    },
  });

  if (delivery.deliveryPartnerId) {
    await prisma.deliveryPartner.update({
      where: { id: delivery.deliveryPartnerId },
      data: {
        currentLatitude: nLat,
        currentLongitude: nLng,
        lastLocationUpdate: now,
      },
    }).catch(() => {});
  }

  if (io) {
    const payload = {
      deliveryId: did,
      orderId: delivery.orderId,
      latitude: nLat,
      longitude: nLng,
      timestamp: now.toISOString(),
    };

    io.to(`delivery:${did}`).emit("delivery_location_updated", payload);
    io.to(`restaurant_${delivery.restaurantId}`).emit("driver_location_updated", payload);
  }

  return { ok: true, deliveryId: did, latitude: nLat, longitude: nLng, timestamp: now };
};

export const getDeliveryTrackingForCustomer = async ({ prisma, orderId, phone, customerId }) => {
  const oid = Number(orderId);
  if (!oid) throw new Error("orderId is required.");

  const order = await prisma.order.findUnique({
    where: { id: oid },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          addressLine1: true,
          city: true,
          phone: true,
          latitude: true,
          longitude: true,
        },
      },
      delivery: {
        include: {
          deliveryPartner: {
            select: {
              id: true,
              name: true,
              phone: true,
              vehicleType: true,
              vehicleNumber: true,
              currentLatitude: true,
              currentLongitude: true,
            },
          },
        },
      },
    },
  });

  if (!order) throw new Error("Order not found.");

  // Tenant / Customer privacy check
  if (phone) {
    const cleanReqPhone = String(phone).replace(/\D/g, "");
    const cleanOrderPhone = String(order.phone || "").replace(/\D/g, "");
    if (cleanReqPhone && cleanOrderPhone && !cleanOrderPhone.endsWith(cleanReqPhone.slice(-10))) {
      throw new Error("Access denied to order tracking.");
    }
  }

  const delivery = order.delivery;
  const isOutForDelivery = ["OUT_FOR_DELIVERY", "PICKED_UP", "REACHED_RESTAURANT", "ACCEPTED"].includes(delivery?.status);

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    orderStatus: order.status,
    paymentMode: order.paymentMode,
    paymentStatus: order.paymentStatus,
    total: order.total,
    createdAt: order.createdAt,
    restaurant: {
      id: order.restaurant?.id,
      name: order.restaurant?.name,
      slug: order.restaurant?.slug,
      address: order.restaurant?.addressLine1 || order.restaurant?.city || "Restaurant Outlet",
      phone: order.restaurant?.phone,
      latitude: order.restaurant?.latitude || 17.3850,
      longitude: order.restaurant?.longitude || 78.4867,
    },
    destination: {
      address: delivery?.deliveryAddressSnapshot || order.deliveryAddress || "Customer Destination",
      latitude: delivery?.deliveryLatitude || order.deliveryLatitude || null,
      longitude: delivery?.deliveryLongitude || order.deliveryLongitude || null,
    },
    delivery: delivery
      ? {
          id: delivery.id,
          status: delivery.status,
          assignedAt: delivery.assignedAt,
          acceptedAt: delivery.acceptedAt,
          pickedUpAt: delivery.pickedUpAt,
          outForDeliveryAt: delivery.outForDeliveryAt,
          deliveredAt: delivery.deliveredAt,
          codAmount: delivery.codAmount,
          codCollected: delivery.codCollected,
          partner: delivery.deliveryPartner
            ? {
                name: delivery.deliveryPartner.name,
                phone: delivery.deliveryPartner.phone,
                vehicleType: delivery.deliveryPartner.vehicleType,
                vehicleNumber: delivery.deliveryPartner.vehicleNumber,
              }
            : null,
          driverLocation: isOutForDelivery && delivery.currentDriverLatitude && delivery.currentDriverLongitude
            ? {
                latitude: delivery.currentDriverLatitude,
                longitude: delivery.currentDriverLongitude,
                lastUpdated: delivery.lastLocationUpdate,
              }
            : null,
        }
      : null,
  };
};

export const getRestaurantDeliveries = async ({ prisma, restaurantId, branchId, status, search }) => {
  const rid = Number(restaurantId);
  if (!rid) throw new Error("restaurantId is required.");

  const where = { restaurantId: rid };
  if (branchId) where.branchId = Number(branchId);
  if (status) where.status = String(status).toUpperCase();

  if (search) {
    const s = String(search).trim();
    where.OR = [
      { deliveryAddressSnapshot: { contains: s, mode: "insensitive" } },
      { order: { orderNo: { contains: s, mode: "insensitive" } } },
      { order: { customerName: { contains: s, mode: "insensitive" } } },
      { deliveryPartner: { name: { contains: s, mode: "insensitive" } } },
    ];
  }

  return prisma.delivery.findMany({
    where,
    include: {
      order: {
        select: {
          id: true,
          orderNo: true,
          customerName: true,
          phone: true,
          total: true,
          paymentMode: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
        },
      },
      deliveryPartner: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getDriverDeliveries = async ({ prisma, driverUserId, partnerId, status }) => {
  let pid = partnerId ? Number(partnerId) : null;

  if (!pid && driverUserId) {
    const partner = await prisma.deliveryPartner.findFirst({
      where: { userId: Number(driverUserId) },
    });
    if (partner) pid = partner.id;
  }

  if (!pid) return [];

  const where = { deliveryPartnerId: pid };
  if (status) where.status = String(status).toUpperCase();

  return prisma.delivery.findMany({
    where,
    include: {
      order: {
        select: {
          id: true,
          orderNo: true,
          customerName: true,
          phone: true,
          total: true,
          paymentMode: true,
          paymentStatus: true,
          status: true,
          notes: true,
          createdAt: true,
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          phone: true,
          addressLine1: true,
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getDeliveryMetricsReport = async ({ prisma, restaurantId, startDate, endDate, partnerId }) => {
  const rid = Number(restaurantId);
  if (!rid) throw new Error("restaurantId is required.");

  const where = { restaurantId: rid };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (partnerId) where.deliveryPartnerId = Number(partnerId);

  const deliveries = await prisma.delivery.findMany({
    where,
    include: {
      deliveryPartner: { select: { id: true, name: true, phone: true } },
      order: { select: { total: true, paymentMode: true } },
    },
  });

  const total = deliveries.length;
  let completed = 0;
  let cancelled = 0;
  let failed = 0;
  let totalDurationMins = 0;
  let durationCount = 0;

  const partnerStatsMap = {};

  for (const d of deliveries) {
    const st = d.status;
    if (st === "DELIVERED") completed++;
    else if (st === "CANCELLED") cancelled++;
    else if (st === "FAILED") failed++;

    if (d.assignedAt && d.deliveredAt) {
      const dur = (new Date(d.deliveredAt).getTime() - new Date(d.assignedAt).getTime()) / 60000;
      if (dur > 0 && dur < 1440) {
        totalDurationMins += dur;
        durationCount++;
      }
    }

    if (d.deliveryPartner) {
      const pid = d.deliveryPartner.id;
      if (!partnerStatsMap[pid]) {
        partnerStatsMap[pid] = {
          id: pid,
          name: d.deliveryPartner.name,
          phone: d.deliveryPartner.phone,
          total: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          totalDurationMins: 0,
          durCount: 0,
        };
      }
      const pStat = partnerStatsMap[pid];
      pStat.total++;
      if (st === "DELIVERED") pStat.completed++;
      if (st === "CANCELLED") pStat.cancelled++;
      if (st === "FAILED") pStat.failed++;

      if (d.assignedAt && d.deliveredAt) {
        const dur = (new Date(d.deliveredAt).getTime() - new Date(d.assignedAt).getTime()) / 60000;
        if (dur > 0 && dur < 1440) {
          pStat.totalDurationMins += dur;
          pStat.durCount++;
        }
      }
    }
  }

  const avgDurationMins = durationCount > 0 ? Math.round((totalDurationMins / durationCount) * 10) / 10 : 0;

  const partnerReport = Object.values(partnerStatsMap).map((p) => ({
    partnerId: p.id,
    name: p.name,
    phone: p.phone,
    totalDeliveries: p.total,
    completed: p.completed,
    failed: p.failed,
    cancelled: p.cancelled,
    avgDurationMins: p.durCount > 0 ? Math.round((p.totalDurationMins / p.durCount) * 10) / 10 : 0,
  }));

  return {
    totalDeliveries: total,
    completed,
    cancelled,
    failed,
    active: total - completed - cancelled - failed,
    avgDurationMins,
    partnerReport,
  };
};
