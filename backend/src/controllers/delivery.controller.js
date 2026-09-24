import * as deliveryService from "../services/deliveryService.js";

const resolveRestaurantId = async (req) => {
  let restaurantId = req.user?.restaurantId || req.staffActor?.restaurantId || req.query?.restaurantId || req.body?.restaurantId;
  if (!restaurantId) {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    if (prisma) {
      try {
        const firstRest = await prisma.restaurant.findFirst({ select: { id: true } });
        if (firstRest) restaurantId = firstRest.id;
      } catch (err) {
        console.error("Error resolving fallback restaurantId:", err);
      }
    }
  }
  return restaurantId;
};

export const createDeliveryPartner = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const restaurantId = await resolveRestaurantId(req);
    const { branchId, userId, name, phone, email, vehicleType, vehicleNumber } = req.body;

    if (!restaurantId) {
      return res.status(400).send({ success: false, message: "Restaurant ID is required." });
    }

    const partner = await deliveryService.createDeliveryPartner({
      prisma,
      restaurantId,
      branchId,
      userId,
      name,
      phone,
      email,
      vehicleType,
      vehicleNumber,
    });

    return res.status(201).send({ success: true, partner });
  } catch (error) {
    console.error("Create Delivery Partner Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to create partner." });
  }
};

export const getDeliveryPartners = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const restaurantId = await resolveRestaurantId(req);
    const { branchId, status, isActive, search } = req.query;

    if (!restaurantId) {
      return res.status(400).send({ success: false, message: "Restaurant ID is required." });
    }

    const partners = await deliveryService.getDeliveryPartners({
      prisma,
      restaurantId,
      branchId,
      status,
      isActive,
      search,
    });

    return res.send({ success: true, partners });
  } catch (error) {
    console.error("Get Delivery Partners Error:", error);
    return res.status(500).send({ success: false, message: error.message || "Failed to fetch partners." });
  }
};

export const updateDeliveryPartner = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const restaurantId = await resolveRestaurantId(req);
    const partnerId = req.params.id || req.body.partnerId;

    if (!restaurantId || !partnerId) {
      return res.status(400).send({ success: false, message: "Restaurant ID and Partner ID are required." });
    }

    const partner = await deliveryService.updateDeliveryPartner({
      prisma,
      restaurantId,
      partnerId,
      data: req.body,
      actor: req.user ? { userId: req.user.id, role: req.user.role } : null,
    });

    return res.send({ success: true, partner });
  } catch (error) {
    console.error("Update Delivery Partner Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to update partner." });
  }
};

export const deleteDeliveryPartner = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const restaurantId = await resolveRestaurantId(req);
    const partnerId = req.params.id;

    if (!restaurantId || !partnerId) {
      return res.status(400).send({ success: false, message: "Restaurant ID and Partner ID are required." });
    }

    const partner = await deliveryService.deleteDeliveryPartner({
      prisma,
      restaurantId,
      partnerId,
      actor: req.user ? { userId: req.user.id, role: req.user.role } : null,
    });

    return res.send({ success: true, message: "Delivery partner deactivated.", partner });
  } catch (error) {
    console.error("Delete Delivery Partner Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to deactivate partner." });
  }
};

export const assignDeliveryPartner = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const io = req.app?.get?.("io");
    const restaurantId = await resolveRestaurantId(req);
    const { orderId, partnerId } = req.body;

    if (!restaurantId || !orderId || !partnerId) {
      return res.status(400).send({ success: false, message: "restaurantId, orderId, and partnerId are required." });
    }

    const delivery = await deliveryService.assignDeliveryPartner({
      prisma,
      io,
      restaurantId,
      orderId,
      partnerId,
      actor: req.user ? { userId: req.user.id, role: req.user.role } : null,
    });

    return res.send({
      success: true,
      message: `Delivery assigned to ${delivery.deliveryPartner?.name || "driver"}.`,
      delivery,
      assignment: delivery,
    });
  } catch (error) {
    console.error("Assign Delivery Partner Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to assign partner." });
  }
};

export const reassignDeliveryPartner = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const io = req.app?.get?.("io");
    const restaurantId = await resolveRestaurantId(req);
    const { deliveryId, newPartnerId, reason } = req.body;

    if (!restaurantId || !deliveryId || !newPartnerId) {
      return res.status(400).send({ success: false, message: "restaurantId, deliveryId, and newPartnerId are required." });
    }

    const delivery = await deliveryService.reassignDeliveryPartner({
      prisma,
      io,
      restaurantId,
      deliveryId,
      newPartnerId,
      reason,
      actor: req.user ? { userId: req.user.id, role: req.user.role } : null,
    });

    return res.send({
      success: true,
      message: `Delivery reassigned to ${delivery.deliveryPartner?.name || "driver"}.`,
      delivery,
    });
  } catch (error) {
    console.error("Reassign Delivery Partner Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to reassign partner." });
  }
};

export const updateDeliveryStatus = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const io = req.app?.get?.("io");
    const restaurantId = await resolveRestaurantId(req);
    const { deliveryId, orderId, status, lat, lng, failureReason, driverNotes } = req.body;

    if (!deliveryId && !orderId) {
      return res.status(400).send({ success: false, message: "deliveryId or orderId is required." });
    }

    if (!status) {
      return res.status(400).send({ success: false, message: "status is required." });
    }

    const delivery = await deliveryService.updateDeliveryStatus({
      prisma,
      io,
      restaurantId,
      deliveryId,
      orderId,
      driverActor: req.user ? { userId: req.user.id, role: req.user.role } : null,
      nextStatus: status,
      lat,
      lng,
      failureReason,
      driverNotes,
    });

    return res.send({
      success: true,
      message: `Delivery status updated to ${delivery.status}.`,
      delivery,
      update: delivery,
    });
  } catch (error) {
    console.error("Update Delivery Status Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to update delivery status." });
  }
};

export const updateDriverLocation = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const io = req.app?.get?.("io");
    const { deliveryId, lat, lng } = req.body;

    if (!deliveryId || lat === undefined || lng === undefined) {
      return res.status(400).send({ success: false, message: "deliveryId, lat, and lng are required." });
    }

    const result = await deliveryService.updateDriverLocation({
      prisma,
      io,
      driverActor: req.user ? { userId: req.user.id, role: req.user.role } : null,
      deliveryId,
      lat,
      lng,
    });

    return res.send({ success: true, ...result });
  } catch (error) {
    console.error("Update Driver Location Error:", error);
    return res.status(400).send({ success: false, message: error.message || "Failed to update location." });
  }
};

export const getRestaurantDeliveries = async (req, res) => {
  try {
    const prisma = req.app?.get?.("prisma") || req.prisma;
    const restaurantId = await resolveRestaurantId(req);
    const { branchId, status, search } = req.query;

    if (!restaurantId) {
      return res.status(400).send({ success: false, message: "Restaurant ID is required." });
    }

    const deliveries = await deliveryService.getRestaurantDeliveries({
      prisma,
      restaurantId,
      branchId,
      status,
      search,
    });

    return res.send({ success: true, deliveries });
  } catch (error) {
    console.error("Get Restaurant Deliveries Error:", error);
    return res.status(500).send({ success: false, message: error.message || "Failed to fetch deliveries." });
  }
};

export const getDriverDeliveries = async (req, res) => {
  try {
    const prisma = req.app.get("prisma");
    const driverUserId = req.user?.id;
    const { partnerId, status } = req.query;

    const deliveries = await deliveryService.getDriverDeliveries({
      prisma,
      driverUserId,
      partnerId,
      status,
    });

    return res.send({ success: true, deliveries });
  } catch (error) {
    console.error("Get Driver Deliveries Error:", error);
    return res.status(500).send({ success: false, message: error.message || "Failed to fetch driver deliveries." });
  }
};

export const getDeliveryTrackingForCustomer = async (req, res) => {
  try {
    const prisma = req.app.get("prisma");
    const { orderId } = req.params;
    const { phone, customerId } = req.query;

    const tracking = await deliveryService.getDeliveryTrackingForCustomer({
      prisma,
      orderId,
      phone,
      customerId,
    });

    return res.send({ success: true, tracking });
  } catch (error) {
    console.error("Customer Tracking Error:", error);
    return res.status(404).send({ success: false, message: error.message || "Order tracking not found." });
  }
};

export const getDeliveryMetricsReport = async (req, res) => {
  try {
    const prisma = req.app.get("prisma");
    const restaurantId = req.user?.restaurantId || req.query.restaurantId;
    const { startDate, endDate, partnerId } = req.query;

    if (!restaurantId) {
      return res.status(400).send({ success: false, message: "Restaurant ID is required." });
    }

    const report = await deliveryService.getDeliveryMetricsReport({
      prisma,
      restaurantId,
      startDate,
      endDate,
      partnerId,
    });

    return res.send({ success: true, report });
  } catch (error) {
    console.error("Delivery Metrics Error:", error);
    return res.status(500).send({ success: false, message: error.message || "Failed to generate delivery report." });
  }
};
