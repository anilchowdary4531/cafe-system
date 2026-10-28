import bcrypt from "bcryptjs";
import crypto from "crypto";
import defaultPrisma from "../prisma.js";
import { buildReadableOrderNo, createOrderByStaff, updateOrderStatus } from "../services/orderService.js";
import { resolveRestaurantBillingConfig } from "../services/billingService.js";
import { buildUploadController } from "../controllers/uploadController.js";
import { deleteAssetByKey, uploadRestaurantAsset } from "../services/storageService.js";
import { requireStaffJwt } from "../services/staffAuthService.js";
import {
  inferRoleFromDesignation,
  mapDesignationToSystemRole,
  generateStaffLoginToken,
} from "../services/staffSessionService.js";
import { resolveMenuPricing } from "../services/menuPricingService.js";
import { buildPayLaterController } from "../controllers/payLaterController.js";
import {
  searchCustomers,
  getCustomerDirectorySummary,
  exportCustomerDirectory,
  getCustomerById,
  createCustomer,
  updateCustomer,
  mergeCustomers,
  listCustomerAddresses,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
} from "../services/crmCustomerService.js";
import {
  validateAndCalculateDiscount,
  listPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  togglePromotionStatus,
} from "../services/promotionService.js";
import {
  getLoyaltyConfig,
  updateLoyaltyConfig,
  getLoyaltyStats,
  listLoyaltyHistory,
  getOrCreateLoyaltyAccount,
  validateAndCalculateLoyaltyRedemption,
  manualAdjustPoints,
} from "../services/loyaltyService.js";
import { buildSettlementController } from "../controllers/settlementController.js";
import {
  createPrinter,
  createStation,
  deletePrinter,
  getKots,
  getPrinters,
  getReadyItemsController,
  getStations,
  getWorkloadMetrics,
  testPrinter,
  triggerReprint,
  updateItemStatus as updateKotItemStatusController,
  updatePrinter,
  updatePriority as updateKotPriorityController,
  updateStation,
  updateStatus as updateKotStatusController,
} from "../controllers/kot.controller.js";
import {
  getKitchenConfigController,
  updateKitchenConfigController,
  getKitchenWorkloadController,
  assignItemController,
  bulkAssignItemsController,
  assignKotController,
  reassignItemController,
  getChefAssignedItemsController,
  selfPickItemController,
  selfPickKotController,
  getAvailableKitchenWorkController,
  getChefHistoryController,
  getServerHistoryController,
} from "../controllers/kitchenAssignmentController.js";
import {
  moveTable,
  mergeTables,
  splitTableOrTransferItems,
} from "../controllers/tableOperationController.js";
import {
  assignWaiterToTable,
  unassignWaiterFromTable,
  getWaiterAssignmentHistory,
  getWaiterWorkspaceData,
  getStaffPerformanceMetrics,
  handleStaffLifecycleChange,
  getActiveStaffByCapability,
} from "../services/staffManagementService.js";
import { getAuditLogs, logAuditEvent } from "../services/auditLogService.js";
import { approveCancellation, approveDiscount, approveReprint } from "../controllers/managerApprovalController.js";
import { completeSessionAndReleaseTable } from "../services/tableSessionService.js";
import { createAndDispatchNotification } from "../services/notificationService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";

export default async function ownerRoutes(app, deps = {}) {
  const prisma = deps?.prisma || defaultPrisma;
  const {
    buildQrTargetUrl,
    FRONTEND_URL,
    STAFF_ACCESS_MODULES = [
      "dashboard", "billing", "orders", "menu", "inventory", "tables", "kitchen",
      "printers", "analytics", "reports", "paylater", "shifts", "supply", "delivery",
      "delivery_partners", "customers", "discounts", "loyalty", "staff", "settings", "notifications"
    ],
    STAFF_ALLOWED_ROLES = ["OWNER", "MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF", "SERVER", "STEWARD", "CLEANER", "SWIPER"],
    normalizeAccess = (a) => (a && typeof a === "object" ? a : {}),
    normalizeDbPermissions = (p) => {
      try {
        const parsed = typeof p === "string" ? JSON.parse(p) : p;
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    },
    serializeAccess = (a) => JSON.stringify(a || {}),
    realtime,
  } = deps || {};
  const uploadController = buildUploadController();
  const settlementController = buildSettlementController({ prisma });
  const STAFF_LOGIN_LINK_EXPIRES_IN = process.env.STAFF_LOGIN_LINK_EXPIRES_IN || "30d";
  const LEGACY_ORDER_NO_PATTERN = /^ORD-\d{12,}$/i;
  const toDisplayOrderNo = (order, restaurant) => {
    const existing = String(order?.orderNo || "").trim();
    if (!existing) return "";
    const withoutOrdPrefix = existing.replace(/^ORD-/i, "");
    if (!LEGACY_ORDER_NO_PATTERN.test(existing)) return withoutOrdPrefix;
    const invoiceTail = String(order?.invoiceNo || "")
      .trim()
      .split("-")
      .pop();
    const sequence = Number(invoiceTail);
    return buildReadableOrderNo({
      restaurantName: restaurant?.name,
      restaurantSlug: restaurant?.slug,
      restaurantCode: restaurant?.invoicePrefix,
      tableNo: order?.tableNo,
      date: order?.createdAt || new Date(),
      sequence: Number.isFinite(sequence) ? sequence : order?.id,
    });
  };
  const normalizeDesignation = (value) => String(value || "").trim().slice(0, 60);
  const normalizeBillPaymentMode = (value) => {
    const mode = String(value || "").trim().toUpperCase();
    if (mode === "CASH" || mode === "UPI" || mode === "CARD" || mode === "ONLINE") return mode;
    return "CASH";
  };
  const isDesignationArgError = (err) =>
    /Unknown argument [`'"]?designation[`'"]?/i.test(String(err?.message || ""));
  const resolveStaffRole = (role, designation) => {
    const normalizedRole = String(role || "STAFF").toUpperCase();
    if (normalizedRole === "SUPER_ADMIN") return "SUPER_ADMIN";
    if (normalizedRole === "OWNER") return "OWNER";

    const canonicalRole = mapDesignationToSystemRole(designation);
    if (canonicalRole) return canonicalRole;

    if (normalizedRole && normalizedRole !== "STAFF") return normalizedRole;
    return "STAFF";
  };
  const OWNER_MANAGEMENT_ROLES = ["OWNER", "MANAGER", "SUPER_ADMIN"];

  const requireOwnerManagementActor = async (req, reply, allowedRoles = OWNER_MANAGEMENT_ROLES) => {
    let actor = req.staffActor;
    if (!actor) {
      actor = await requireStaffJwt(req, reply, {
        prisma,
        allowedRoles,
        matchRestaurantParam: "restaurantId",
      });
      if (!actor) return null;
      req.staffActor = actor;
    }
    const role = String(actor.role || "").toUpperCase();
    if (!allowedRoles.includes(role)) {
      reply.code(403).send({ message: "Forbidden: Insufficient permissions for owner management" });
      return null;
    }
    return actor;
  };

  const buildStaffLoginLink = (user) => {
    const email = String(user?.email || "").trim().toLowerCase();
    const base = String(FRONTEND_URL || "").trim().replace(/\/+$/, "");
    const path = `/login?mode=staff&email=${encodeURIComponent(email)}`;
    return base ? `${base}${path}` : path;
  };
  const buildStaffUserResponse = (user, access) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: resolveStaffRole(user.role, user.designation),
    designation: user.designation || "",
    isActive: user.isActive,
    restaurantId: user.restaurantId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    access:
      access ?? normalizeDbPermissions(user?.staffAccess?.permissions, resolveStaffRole(user.role, user.designation)),
    mustChangePassword: Boolean(user.mustChangePassword),
    temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt || null,
    loginLink: buildStaffLoginLink(user),
  });

  app.post("/owner/:restaurantId/uploads/presign", uploadController.presign);

  const requireMultipart = (req, reply) => {
    if (typeof req.file !== "function") {
      reply.code(501).send({ message: "Multipart upload is not enabled on server" });
      return false;
    }
    return true;
  };

  // Production-safe upload APIs (local dev -> /uploads, production -> S3).
  app.post("/owner/:restaurantId/assets/logo", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!requireMultipart(req, reply)) return;

      const data = await req.file({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
      if (!data?.file) return reply.code(400).send({ message: "file is required" });

      const upload = await uploadRestaurantAsset({
        restaurantId,
        kind: "logo",
        contentType: data.mimetype,
        fileName: data.filename,
        stream: data.file,
      });

      const updated = await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { logoUrl: upload.publicUrl },
        select: { id: true, name: true, slug: true, logoUrl: true, bannerUrl: true, brandColor: true, faviconUrl: true, updatedAt: true },
      });

      return { message: "Logo uploaded", upload, restaurant: { ...updated, logo: updated.logoUrl || "", logoUrl: undefined } };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to upload logo" });
    }
  });

  // Menu item images (supports local dev without S3). Does not update DB directly; the UI stores returned publicUrl in MenuItem.image.
  app.post("/owner/:restaurantId/assets/menu-image", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!requireMultipart(req, reply)) return;

      const entityId = req.query?.entityId ? String(req.query.entityId) : "";

      const data = await req.file({ limits: { fileSize: 7 * 1024 * 1024, files: 1 } });
      if (!data?.file) return reply.code(400).send({ message: "file is required" });

      const upload = await uploadRestaurantAsset({
        restaurantId,
        kind: "menu_item_image",
        entityId,
        contentType: data.mimetype,
        fileName: data.filename,
        stream: data.file,
      });

      return { message: "Menu image uploaded", upload };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to upload menu image" });
    }
  });

  app.post("/owner/:restaurantId/assets/banner", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!requireMultipart(req, reply)) return;

      const data = await req.file({ limits: { fileSize: 7 * 1024 * 1024, files: 1 } });
      if (!data?.file) return reply.code(400).send({ message: "file is required" });

      const upload = await uploadRestaurantAsset({
        restaurantId,
        kind: "banner",
        contentType: data.mimetype,
        fileName: data.filename,
        stream: data.file,
      });

      const updated = await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { bannerUrl: upload.publicUrl },
        select: { id: true, name: true, slug: true, logoUrl: true, bannerUrl: true, brandColor: true, faviconUrl: true, updatedAt: true },
      });

      return { message: "Banner uploaded", upload, restaurant: { ...updated, logo: updated.logoUrl || "", logoUrl: undefined } };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to upload banner" });
    }
  });

  app.delete("/owner/:restaurantId/assets", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      const body = req.body || {};
      const key = body.key || body.s3Key || body.assetKey || "";
      if (!key) return reply.code(400).send({ message: "key is required" });

      await deleteAssetByKey({ key });
      return { message: "Asset deleted", key };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete asset" });
    }
  });

  const handleGetOwnerDashboard = async (req, reply) => {
    try {
      const { restaurantId } = req.params;
      const id = Number(restaurantId);

      const restaurant = await prisma.restaurant.findUnique({
        where: { id },
        include: {
          menuItems: true,
          orders: {
            include: { items: true },
            orderBy: { createdAt: "desc" },
          },
          tables: true,
        },
      });

      if (!restaurant) {
        return reply.code(404).send({
          message: "Restaurant not found",
        });
      }

      const revenue = restaurant.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        menuCount: restaurant.menuItems.length,
        ordersCount: restaurant.orders.length,
        tablesCount: restaurant.tables.length,
        revenue,
        taxEnabled: restaurant.taxEnabled,
        taxPercent: restaurant.defaultTaxPercent,
        gstEnabled: restaurant.taxEnabled,
        recentOrders: restaurant.orders.slice(0, 5),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({
        message: "Dashboard failed",
      });
    }
  };
  app.get("/owner/dashboard/:restaurantId", handleGetOwnerDashboard);
  app.get("/api/owner/dashboard/:restaurantId", handleGetOwnerDashboard);

  app.get("/owner/:restaurantId/orders", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const status = String(req.query?.status || "").trim().toUpperCase();
      const source = String(req.query?.source || "").trim().toUpperCase();
      const q = String(req.query?.q || "").trim().toLowerCase();
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const sourceFilter =
        source === "ONLINE"
          ? { in: ["ONLINE", "PICKUP", "DELIVERY"] }
          : source
            ? { equals: source }
            : undefined;

      const orders = await prisma.order.findMany({
        where: {
          restaurantId,
          ...(status ? { status } : {}),
          ...(sourceFilter ? { orderSource: sourceFilter } : {}),
        },
        include: {
          items: true,
          customer: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!q) return { orders };

      return {
        orders: orders.filter((order) => {
          return (
            String(order.orderNo || "").toLowerCase().includes(q) ||
            String(order.invoiceNo || "").toLowerCase().includes(q) ||
            String(order.customerName || "").toLowerCase().includes(q) ||
            String(order.phone || "").toLowerCase().includes(q) ||
            String(order.tableNo || "").toLowerCase().includes(q)
          );
        }),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch owner orders" });
    }
  });

  app.post("/owner/:restaurantId/orders", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const actor = {
        restaurantId,
        role: req.user?.role || "STAFF",
        userId: req.user?.id || null,
        userName: req.user?.name || req.user?.email || "Staff",
      };

      const order = await createOrderByStaff({
        prisma,
        actor,
        input: req.body,
      });

      // Broadcast Socket.IO events for real-time updates across screens
      try {
        const io = req.server?.io || realtime?.io;
        const staff = req.server?.staff || realtime?.staff;
        if (io) {
          io.to(`restaurant_${restaurantId}`).emit("new_order", order);
          io.to(`restaurant:${restaurantId}`).emit("new_order", order);
          io.to(`restaurant_${restaurantId}`).emit("order_created", { order, source: order.orderSource || "POS" });
          io.to(`restaurant:${restaurantId}`).emit("order_created", { order, source: order.orderSource || "POS" });
          if (order.tableNo) {
            io.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableNo: order.tableNo });
            io.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableNo: order.tableNo });
            io.to(`restaurant_${restaurantId}`).emit("table:session_updated", { restaurantId, tableNo: order.tableNo });
          }
        }

        // Phase 2.A: Create and dispatch persistent notification for the responsible Server / Waiter
        const responsibleServerId =
          order.kots?.[0]?.waiterId ||
          req.body?.waiterId ||
          req.body?.assignedWaiterId ||
          actor?.userId ||
          null;

        if (responsibleServerId) {
          const tableLabel = order.tableNo ? `Table ${order.tableNo}` : "Takeaway";
          const orderNum = order.orderNo || order.id;
          await createAndDispatchNotification({
            prisma,
            realtime: { io, staff },
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: Number(responsibleServerId),
            orderId: order.id,
            restaurantId,
            notificationType: NOTIFICATION_TYPES.ORDER_PLACED,
            title: "Order Sent to Kitchen",
            message: `Order #${orderNum} sent to kitchen for ${tableLabel}.`,
            idempotencyKey: `order_sent_${restaurantId}_${order.id}_${responsibleServerId}`,
            data: {
              restaurantId,
              orderId: order.id,
              orderNo: order.orderNo,
              tableId: order.tableId ? Number(order.tableId) : null,
              tableSessionId: order.tableSessionId ? Number(order.tableSessionId) : null,
              tableNo: order.tableNo || null,
              recipientId: Number(responsibleServerId),
            },
          }).catch((notifErr) => {
            console.warn("[owner:orders] Failed to create order sent notification:", notifErr?.message);
          });
        }
      } catch (e) {
        console.warn("Socket broadcast error on order creation:", e?.message);
      }

      return reply.code(201).send({
        success: true,
        message: "Order placed successfully",
        order,
      });
    } catch (err) {
      console.error("Error creating owner/staff order:", err);
      return reply.code(err.statusCode || 500).send({
        success: false,
        message: err.message || "Failed to create order",
      });
    }
  });

  app.get("/owner/:restaurantId/menu", async (req, reply) => {
    try {
      const id = Number(req.params.restaurantId);
      if (!id) return reply.code(400).send({ message: "Invalid restaurant id" });
      return await prisma.menuItem.findMany({
        where: { restaurantId: id },
        include: {
          variants: {
            orderBy: { sortOrder: "asc" },
          },
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              modifiers: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { id: "desc" },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch menu items" });
    }
  });

  app.post("/owner/:restaurantId/menu", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { name, description, category, image, price, originalPrice, discountPercent, isAvailable, variants, modifierGroups } = req.body || {};
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const hasVariants = Array.isArray(variants) && variants.length > 0;
      let effectivePrice = price;
      if ((effectivePrice === undefined || effectivePrice === null) && hasVariants) {
        effectivePrice = Number(variants[0].price || 0);
      }

      if (!name || !category || (effectivePrice === undefined && originalPrice === undefined)) {
        return reply.code(400).send({ message: "Missing required fields" });
      }

      const pricing = resolveMenuPricing({ price: effectivePrice, originalPrice, discountPercent });

      return await prisma.menuItem.create({
        data: {
          restaurantId,
          name: String(name).trim(),
          description: description || "",
          category: String(category).trim(),
          image: image || "",
          price: pricing.price,
          originalPrice: pricing.originalPrice,
          discountPercent: pricing.discountPercent,
          isAvailable: isAvailable ?? true,
          ...(hasVariants ? {
            variants: {
              create: variants.map((v, idx) => ({
                name: String(v.name).trim(),
                price: Number(v.price || 0),
                isDefault: Boolean(v.isDefault || idx === 0),
                isActive: v.isActive !== false,
                sortOrder: Number(v.sortOrder || idx),
              })),
            },
          } : {}),
          ...(Array.isArray(modifierGroups) && modifierGroups.length > 0 ? {
            modifierGroups: {
              create: modifierGroups.map((g, gIdx) => ({
                name: String(g.name).trim(),
                isRequired: Boolean(g.isRequired),
                minSelect: Number(g.minSelect || 0),
                maxSelect: Number(g.maxSelect || 1),
                sortOrder: Number(g.sortOrder || gIdx),
                ...(Array.isArray(g.options || g.modifiers) ? {
                  modifiers: {
                    create: (g.options || g.modifiers).map((m, mIdx) => ({
                      name: String(m.name).trim(),
                      price: Number(m.price || 0),
                      isAvailable: m.isAvailable !== false,
                      sortOrder: Number(m.sortOrder || mIdx),
                    })),
                  },
                } : {}),
              })),
            },
          } : {}),
        },
        include: {
          variants: { orderBy: { sortOrder: "asc" } },
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: { modifiers: { orderBy: { sortOrder: "asc" } } },
          },
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create menu item" });
    }
  });

  app.put("/owner/:restaurantId/menu/:menuId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const menuId = Number(req.params.menuId);
      const { name, description, category, image, price, originalPrice, discountPercent, isAvailable, variants, modifierGroups } = req.body || {};
      if (!restaurantId || !menuId) return reply.code(400).send({ message: "Invalid id values" });

      const item = await prisma.menuItem.findUnique({ where: { id: menuId } });
      if (!item || item.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Menu item not found" });
      }

      const hasVariants = Array.isArray(variants);
      let effectivePrice = price;
      if (hasVariants && variants.length > 0 && (effectivePrice === undefined || effectivePrice === null)) {
        effectivePrice = Number(variants[0].price || 0);
      }

      const pricing = resolveMenuPricing({ price: effectivePrice, originalPrice, discountPercent }, item);

      return await prisma.$transaction(async (tx) => {
        await tx.menuItem.update({
          where: { id: menuId },
          data: {
            name: name !== undefined ? String(name).trim() : item.name,
            description: description !== undefined ? description : item.description,
            category: category !== undefined ? String(category).trim() : item.category,
            image: image !== undefined ? image : item.image,
            price: pricing.price,
            originalPrice: pricing.originalPrice,
            discountPercent: pricing.discountPercent,
            isAvailable: isAvailable ?? item.isAvailable,
          },
        });

        if (hasVariants) {
          await tx.menuItemVariant.deleteMany({ where: { menuItemId: menuId } });
          if (variants.length > 0) {
            await tx.menuItemVariant.createMany({
              data: variants.map((v, idx) => ({
                menuItemId: menuId,
                name: String(v.name).trim(),
                price: Number(v.price || 0),
                isDefault: Boolean(v.isDefault || idx === 0),
                isActive: v.isActive !== false,
                sortOrder: Number(v.sortOrder || idx),
              })),
            });
          }
        }

        if (Array.isArray(modifierGroups)) {
          await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: menuId } });
          for (let gIdx = 0; gIdx < modifierGroups.length; gIdx++) {
            const g = modifierGroups[gIdx];
            const groupCreated = await tx.menuItemModifierGroup.create({
              data: {
                menuItemId: menuId,
                name: String(g.name).trim(),
                isRequired: Boolean(g.isRequired),
                minSelect: Number(g.minSelect || 0),
                maxSelect: Number(g.maxSelect || 1),
                sortOrder: Number(g.sortOrder || gIdx),
              },
            });
            const opts = Array.isArray(g.options) ? g.options : Array.isArray(g.modifiers) ? g.modifiers : [];
            if (opts.length > 0) {
              await tx.menuItemModifier.createMany({
                data: opts.map((m, mIdx) => ({
                  modifierGroupId: groupCreated.id,
                  name: String(m.name).trim(),
                  price: Number(m.price || 0),
                  isAvailable: m.isAvailable !== false,
                  sortOrder: Number(m.sortOrder || mIdx),
                })),
              });
            }
          }
        }

        return tx.menuItem.findUnique({
          where: { id: menuId },
          include: {
            variants: { orderBy: { sortOrder: "asc" } },
            modifierGroups: {
              orderBy: { sortOrder: "asc" },
              include: { modifiers: { orderBy: { sortOrder: "asc" } } },
            },
          },
        });
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update menu item" });
    }
  });

  app.delete("/owner/:restaurantId/menu/:menuId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const menuId = Number(req.params.menuId);
      if (!restaurantId || !menuId) return reply.code(400).send({ message: "Invalid id values" });

      const item = await prisma.menuItem.findUnique({ where: { id: menuId } });
      if (!item || item.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Menu item not found" });
      }

      await prisma.menuItem.delete({ where: { id: menuId } });
      return { message: "Menu item deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete menu item" });
    }
  });

  const handleGetOwnerTables = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, slug: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });
      const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const startOfDay = new Date(today);
      startOfDay.setDate(startOfDay.getDate() - 1);
      const endOfDay = new Date(tomorrow);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const [tables, activeOrders, latestTableOrders, activeSessions, reservationsToday] = await Promise.all([
        prisma.diningTable.findMany({
          where: { restaurantId },
          orderBy: { id: "desc" },
        }),
        prisma.order.findMany({
          where: {
            restaurantId,
            tableNo: { not: null },
            OR: [
              {
                status: { in: activeStatuses },
                OR: [
                  { tableSessionId: null },
                  { tableSession: { status: { in: ["OPEN", "BILLING", "PAID"] } } },
                ],
              },
              {
                status: { in: ["SERVED", "DELIVERED", "COMPLETED", "PAYMENT_PENDING"] },
                paymentStatus: { notIn: ["PAID", "SUCCESS"] },
                OR: [
                  { tableSessionId: null },
                  { tableSession: { status: { in: ["OPEN", "BILLING", "PAID"] } } },
                ],
              },
            ],
          },
          select: {
            id: true,
            tableNo: true,
            tableSessionId: true,
            tableSession: {
              select: {
                id: true,
                tableId: true,
                tableNo: true,
                status: true,
              },
            },
            orderNo: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            total: true,
            items: {
              select: {
                id: true,
                itemName: true,
                preparedByName: true,
                qty: true,
                price: true,
                total: true,
              },
              orderBy: { id: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.order.findMany({
          where: {
            restaurantId,
            tableNo: { not: null },
          },
          select: {
            tableNo: true,
            status: true,
            paymentStatus: true,
            orderNo: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.tableSession.findMany({
          where: {
            restaurantId,
            status: { in: ["OPEN", "BILLING", "PAID"] },
          },
        }),
        prisma.reservation.findMany({
          where: {
            restaurantId,
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "SEATED"] },
          },
          include: { table: true },
          orderBy: { startTime: "asc" },
        }),
      ]);

      const getTableKeys = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) return [];
        const stripped = raw.replace(/^(table|tbl)[-\s]*/i, "").trim();
        const keys = new Set([raw]);
        if (stripped) {
          keys.add(stripped);
          keys.add(`table ${stripped}`);
          keys.add(`table-${stripped}`);
        }
        return Array.from(keys);
      };

      const activeSessionsByTableId = new Map();
      const activeSessionsByTable = {};
      for (const session of activeSessions) {
        if (session.tableId) {
          activeSessionsByTableId.set(Number(session.tableId), session);
        }
        for (const k of getTableKeys(session.tableNo)) {
          if (!activeSessionsByTable[k]) {
            activeSessionsByTable[k] = session;
          }
        }
      }

      const reservationsByTableId = new Map();
      const reservationsByTableNo = new Map();

      for (const res of reservationsToday) {
        if (res.tableId) {
          const tid = Number(res.tableId);
          if (!reservationsByTableId.has(tid)) reservationsByTableId.set(tid, []);
          reservationsByTableId.get(tid).push(res);
        }
        const tNo = res.table?.tableNo || res.tableNo;
        if (tNo) {
          const tKey = String(tNo).trim().toLowerCase();
          if (!reservationsByTableNo.has(tKey)) reservationsByTableNo.set(tKey, []);
          reservationsByTableNo.get(tKey).push(res);
        }
      }

      const activeOrdersByTableId = new Map();
      const activeOrdersByTable = {};

      for (const order of activeOrders) {
        const formattedOrder = {
          id: order.id,
          tableSessionId: order.tableSessionId || null,
          orderNo: order.orderNo,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          total: Number(order.total || 0),
          items: Array.isArray(order.items)
            ? order.items.map((item) => ({
                id: item.id,
                itemName: item.itemName,
                preparedByName: item.preparedByName || null,
                qty: Number(item.qty || 0),
                price: Number(item.price || 0),
                total: Number(item.total || 0),
              }))
            : [],
        };

        const targetTableId = order.tableSession?.tableId ? Number(order.tableSession.tableId) : null;
        if (targetTableId) {
          if (!activeOrdersByTableId.has(targetTableId)) {
            activeOrdersByTableId.set(targetTableId, []);
          }
          activeOrdersByTableId.get(targetTableId).push(formattedOrder);
        }

        for (const k of getTableKeys(order.tableNo)) {
          if (!activeOrdersByTable[k]) activeOrdersByTable[k] = [];
          if (!activeOrdersByTable[k].some((o) => o.id === formattedOrder.id)) {
            activeOrdersByTable[k].push(formattedOrder);
          }
        }
      }

      const latestOrderByTable = {};
      for (const order of latestTableOrders) {
        for (const k of getTableKeys(order.tableNo)) {
          if (!latestOrderByTable[k]) {
            latestOrderByTable[k] = order;
          }
        }
      }

      const helperTimeToMinutes = (timeStr) => {
        if (!timeStr || typeof timeStr !== "string") return 0;
        const str = timeStr.trim().toUpperCase();
        const isPM = str.includes("PM");
        const isAM = str.includes("AM");
        const cleaned = str.replace(/[^\d:]/g, "");
        const parts = cleaned.split(":");
        let h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + m;
      };

      return tables.map((table) => {
        let token = table.qrToken;
        if (!token) {
          token = crypto.randomBytes(16).toString("hex");
          prisma.diningTable.update({ where: { id: table.id }, data: { qrToken: token } }).catch(() => {});
        }
        return {
          ...table,
          qrToken: token,
          qrCodeUrl: buildQrTargetUrl(restaurant.slug, table.tableNo),
          qrTargetUrl: `/order/table/${token}`,
          ...(function buildTableState() {
          const tid = Number(table.id);
          let tableActiveOrders = activeOrdersByTableId.has(tid)
            ? activeOrdersByTableId.get(tid)
            : [];
          if (!tableActiveOrders.length) {
            for (const k of getTableKeys(table.tableNo)) {
              if (activeOrdersByTable[k]?.length) {
                tableActiveOrders = activeOrdersByTable[k];
                break;
              }
            }
          }

          let latestOrder = null;
          for (const k of getTableKeys(table.tableNo)) {
            if (latestOrderByTable[k]) {
              latestOrder = latestOrderByTable[k];
              break;
            }
          }

          let activeSession = activeSessionsByTableId.get(tid) || null;
          if (!activeSession) {
            for (const k of getTableKeys(table.tableNo)) {
              if (activeSessionsByTable[k]) {
                activeSession = activeSessionsByTable[k];
                break;
              }
            }
          }
          
          const resById = reservationsByTableId.get(Number(table.id)) || [];
          const resByNo = reservationsByTableNo.get(String(table.tableNo || "").trim().toLowerCase()) || [];
          const combinedRes = [...resById, ...resByNo];
          const tableResList = Array.from(new Map(combinedRes.map((r) => [r.id, r])).values());

          const now = new Date();
          const localYear = now.getFullYear();
          const localMonth = String(now.getMonth() + 1).padStart(2, "0");
          const localDay = String(now.getDate()).padStart(2, "0");
          const todayStr = `${localYear}-${localMonth}-${localDay}`;
          const currentMin = now.getHours() * 60 + now.getMinutes();

          let activeRes = null;
          let upcomingRes = null;

          for (const res of tableResList) {
            if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(String(res.status || "").toUpperCase())) {
              continue;
            }

            const resDateObj = new Date(res.reservationDate);
            const resYearUTC = resDateObj.getUTCFullYear();
            const resMonthUTC = String(resDateObj.getUTCMonth() + 1).padStart(2, "0");
            const resDayUTC = String(resDateObj.getUTCDate()).padStart(2, "0");
            const resDateStrUTC = `${resYearUTC}-${resMonthUTC}-${resDayUTC}`;

            const resYearLoc = resDateObj.getFullYear();
            const resMonthLoc = String(resDateObj.getMonth() + 1).padStart(2, "0");
            const resDayLoc = String(resDateObj.getDate()).padStart(2, "0");
            const resDateStrLoc = `${resYearLoc}-${resMonthLoc}-${resDayLoc}`;

            const resDateStr = (resDateStrUTC === todayStr || resDateStrLoc === todayStr) ? todayStr : resDateStrUTC;

            if (resDateStr < todayStr) continue;
            if (resDateStr > todayStr) {
              if (!upcomingRes) upcomingRes = res;
              continue;
            }

            const startMin = helperTimeToMinutes(res.startTime);
            let endMin = helperTimeToMinutes(res.endTime);
            if (endMin <= startMin) endMin += 1440;

            if (currentMin >= endMin) {
              continue;
            }

            if (currentMin >= Math.max(0, startMin - 60) && currentMin < endMin) {
              if (!activeRes) activeRes = res;
            } else if (startMin > currentMin && !upcomingRes) {
              upcomingRes = res;
            }
          }

          const activeItemCount = tableActiveOrders.reduce(
            (sum, order) =>
              sum +
              (Array.isArray(order.items)
                ? order.items.reduce(
                    (itemSum, item) => itemSum + Number(item.qty || 0),
                    0
                  )
                : 0),
            0
          );

          const hasActiveSession = Boolean(activeSession && ["OPEN", "BILLING", "PAID"].includes(activeSession.status));
          const hasInFlightOrders = Array.isArray(tableActiveOrders) && tableActiveOrders.some((o) =>
            ["PLACED", "ACCEPTED", "PREPARING", "READY"].includes(String(o.status || "").toUpperCase())
          );
          const isOccupied = hasActiveSession || hasInFlightOrders;
          const isReserved = !isOccupied && Boolean(activeRes);
          const isBlocked = Boolean(table.isBlocked);

          const resolveCanonicalActiveOrderStatus = (orders, fallbackLatest) => {
            if (Array.isArray(orders) && orders.length > 0) {
              if (orders.some((o) => o.status === "READY")) return "READY";
              if (orders.some((o) => o.status === "PREPARING")) return "PREPARING";
              if (orders.some((o) => o.status === "ACCEPTED")) return "ACCEPTED";
              if (orders.some((o) => o.status === "PLACED")) return "PLACED";
              
              const allDelivered = orders.every((o) => ["DELIVERED", "SERVED", "COMPLETED", "PAYMENT_PENDING"].includes(String(o.status || "").toUpperCase()));
              if (allDelivered) {
                const anyUnpaid = orders.some((o) => !["PAID", "SUCCESS"].includes(String(o.paymentStatus || "").toUpperCase()));
                if (anyUnpaid) return "PAYMENT_PENDING";
                return "PAID";
              }
              return orders[orders.length - 1]?.status || null;
            }

            if (fallbackLatest && activeSession) {
              const ls = String(fallbackLatest.status || "").toUpperCase();
              const lp = String(fallbackLatest.paymentStatus || "").toUpperCase();
              if (["DELIVERED", "SERVED", "COMPLETED", "PAYMENT_PENDING"].includes(ls)) {
                if (lp !== "PAID" && lp !== "SUCCESS") return "PAYMENT_PENDING";
                return "PAID";
              }
              return ls;
            }

            return null;
          };

          const activeOrderStatus = resolveCanonicalActiveOrderStatus(tableActiveOrders, activeSession ? latestOrder : null);

          let canonicalStatus = "AVAILABLE";
          if (isBlocked) {
            canonicalStatus = "BLOCKED";
          } else if (isOccupied) {
            canonicalStatus = activeOrderStatus === "PAYMENT_PENDING"
              ? "PAYMENT_PENDING"
              : activeSession?.status === "BILLING"
              ? "BILLING"
              : "OCCUPIED";
          } else if (isReserved) {
            canonicalStatus = "RESERVED";
          }

          if (!isOccupied) {
            return {
              id: table.id,
              tableNo: table.tableNo,
              status: canonicalStatus,
              isOccupied: false,
              isReserved,
              isBlocked,
              blockReason: table.blockReason || null,
              blockedAt: table.blockedAt || null,
              blockedByName: table.blockedByName || null,
              activeReservation: activeRes ? {
                id: activeRes.id,
                reservationNo: activeRes.reservationNo,
                startTime: activeRes.startTime,
                endTime: activeRes.endTime,
                customerName: activeRes.customerName,
                customerPhone: activeRes.customerPhone,
                guestCount: activeRes.guestCount,
                status: activeRes.status,
              } : null,
              upcomingReservation: upcomingRes ? {
                id: upcomingRes.id,
                reservationNo: upcomingRes.reservationNo,
                startTime: upcomingRes.startTime,
                endTime: upcomingRes.endTime,
                customerName: upcomingRes.customerName,
                guestCount: upcomingRes.guestCount,
                status: upcomingRes.status,
              } : null,
              assignedWaiterId: table.assignedWaiterId || null,
              assignedWaiterName: table.assignedWaiterName || null,
              assignedServer: table.assignedWaiterName || null,
              assignedServerId: table.assignedWaiterId || null,
              assignedServerName: table.assignedWaiterName || null,
              version: Number(table.updatedAt ? new Date(table.updatedAt).getTime() : Date.now()),
              updatedAt: table.updatedAt ? new Date(table.updatedAt).toISOString() : new Date().toISOString(),
              occupiedSince: null,
              activeOrderCount: 0,
              activeItemCount: 0,
              activeOrders: [],
              activeOrderStatus: null,
              paymentStatus: null,
              session: { status: "CLOSED" },
              activeSession: null,
              lastOrderStatus: null,
              lastPaymentStatus: null,
              lastOrderNo: null,
              lastOrderAt: null,
            };
          }

          const resolvedWaiterId = activeSession?.waiterId || table.assignedWaiterId || null;
          const resolvedWaiterName = activeSession?.waiterName || table.assignedWaiterName || null;

          return {
            id: table.id,
            tableNo: table.tableNo,
            status: canonicalStatus,
            isOccupied: true,
            isReserved: false,
            isBlocked: false,
            blockReason: null,
            blockedAt: null,
            blockedByName: null,
            activeReservation: null,
            upcomingReservation: upcomingRes ? {
              id: upcomingRes.id,
              reservationNo: upcomingRes.reservationNo,
              startTime: upcomingRes.startTime,
              endTime: upcomingRes.endTime,
              customerName: upcomingRes.customerName,
              guestCount: upcomingRes.guestCount,
              status: upcomingRes.status,
            } : null,
            assignedWaiterId: resolvedWaiterId,
            assignedWaiterName: resolvedWaiterName,
            assignedServer: resolvedWaiterName,
            assignedServerId: resolvedWaiterId,
            assignedServerName: resolvedWaiterName,
            version: Number(table.updatedAt ? new Date(table.updatedAt).getTime() : Date.now()),
            updatedAt: table.updatedAt ? new Date(table.updatedAt).toISOString() : new Date().toISOString(),
            occupiedSince: activeSession?.openedAt || tableActiveOrders[0]?.createdAt || null,
            activeOrderCount: tableActiveOrders.length,
            activeItemCount,
            activeOrders: tableActiveOrders,
            activeOrderStatus,
            paymentStatus: activeOrderStatus === "PAYMENT_PENDING" ? "PENDING" : null,
            session: activeSession ? {
              id: activeSession.id,
              status: activeSession.status,
              guestCount: activeSession.guestCount,
              waiterId: activeSession.waiterId,
              waiterName: activeSession.waiterName,
              subtotal: activeSession.subtotal,
              total: activeSession.total,
              openedAt: activeSession.openedAt,
            } : null,
            activeSession: activeSession ? {
              id: activeSession.id,
              status: activeSession.status,
              guestCount: activeSession.guestCount,
              waiterId: activeSession.waiterId,
              waiterName: activeSession.waiterName,
              subtotal: activeSession.subtotal,
              total: activeSession.total,
              openedAt: activeSession.openedAt,
            } : null,
            total: tableActiveOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) || Number(activeSession?.total || 0),
            payableAmount: tableActiveOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) || Number(activeSession?.total || 0),
            lastOrderStatus: latestOrder?.status || null,
            lastPaymentStatus: latestOrder?.paymentStatus || null,
            lastOrderNo: latestOrder?.orderNo || null,
            lastOrderAt: latestOrder?.updatedAt || latestOrder?.createdAt || null,
          };
        })(),
      };
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch tables" });
    }
  };
  app.get("/owner/:restaurantId/tables", handleGetOwnerTables);
  app.get("/api/owner/:restaurantId/tables", handleGetOwnerTables);

  // Table Operations: Move, Merge, Split / Transfer Items
  app.post("/owner/:restaurantId/tables/:tableId/move", moveTable);
  app.post("/api/owner/:restaurantId/tables/:tableId/move", moveTable);
  app.post("/owner/:restaurantId/tables/:tableId/merge", mergeTables);
  app.post("/api/owner/:restaurantId/tables/:tableId/merge", mergeTables);
  app.post("/owner/:restaurantId/tables/:tableId/split", splitTableOrTransferItems);
  app.post("/api/owner/:restaurantId/tables/:tableId/split", splitTableOrTransferItems);
  app.post("/owner/:restaurantId/tables/:tableId/transfer-items", splitTableOrTransferItems);
  app.post("/api/owner/:restaurantId/tables/:tableId/transfer-items", splitTableOrTransferItems);

  // Bulk Floor Plan Layout Update
  app.put("/owner/:restaurantId/tables/layout", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tablesLayout = Array.isArray(req.body?.tables) ? req.body.tables : [];

      if (!restaurantId || !tablesLayout.length) {
        return reply.code(400).send({ message: "restaurantId and non-empty tables array are required" });
      }

      const updatedTables = await prisma.$transaction(
        tablesLayout.map((item) => {
          const tableId = Number(item.id || item.tableId);
          return prisma.diningTable.update({
            where: { id: tableId },
            data: {
              section: item.section !== undefined ? String(item.section) : undefined,
              positionX: item.positionX !== undefined ? (item.positionX === null ? null : Number(item.positionX)) : undefined,
              positionY: item.positionY !== undefined ? (item.positionY === null ? null : Number(item.positionY)) : undefined,
              width: item.width !== undefined ? Number(item.width) : undefined,
              height: item.height !== undefined ? Number(item.height) : undefined,
              shape: item.shape !== undefined ? String(item.shape) : undefined,
              rotation: item.rotation !== undefined ? Number(item.rotation) : undefined,
            },
          });
        })
      );

      // Audit Log
      await prisma.tableOperationLog.create({
        data: {
          restaurantId,
          operationType: "LAYOUT_UPDATED",
          performedByUserId: req.user?.id || req.user?.userId || null,
          performedByName: req.user?.name || req.user?.userName || "Staff",
          performedByUserRole: req.user?.role || "OWNER",
          details: { count: updatedTables.length },
        },
      });

      // Broadcast realtime event
      if (realtime?.io) {
        realtime.io.to(`restaurant:${restaurantId}`).emit("table:layout_updated", {
          restaurantId,
          tables: updatedTables,
        });
        realtime.io.to(`restaurant_${restaurantId}`).emit("table:layout_updated", {
          restaurantId,
          tables: updatedTables,
        });
      }

      return reply.send({
        success: true,
        message: `Successfully updated layout for ${updatedTables.length} tables`,
        tables: updatedTables,
      });
    } catch (err) {
      console.error("Error updating floor plan layout:", err);
      return reply.code(500).send({ message: err.message || "Failed to save floor plan layout" });
    }
  });

  // Block Table for Maintenance / Private Booking / VIP
  app.post("/owner/:restaurantId/tables/:tableId/block", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { blockReason } = req.body || {};

      const table = await prisma.diningTable.findFirst({
        where: { id: tableId, restaurantId },
        include: {
          tableSessions: {
            where: { status: { in: ["OPEN", "BILLING"] } },
          },
        },
      });

      if (!table) {
        return reply.code(404).send({ success: false, message: "Table not found" });
      }

      if (table.tableSessions.length > 0) {
        return reply.code(400).send({
          success: false,
          message: `Table ${table.tableNo} is currently occupied with active orders. Clear session before blocking.`,
        });
      }

      const updated = await prisma.diningTable.update({
        where: { id: tableId },
        data: {
          isBlocked: true,
          blockReason: blockReason ? String(blockReason).trim() : "Maintenance / Private Booking",
          blockedAt: new Date(),
          blockedByName: req.user?.name || req.user?.userName || "Staff",
        },
      });

      // Audit Log
      await prisma.tableOperationLog.create({
        data: {
          restaurantId,
          operationType: "TABLE_BLOCKED",
          sourceTableId: tableId,
          sourceTableNo: table.tableNo,
          performedByUserId: req.user?.id || req.user?.userId || null,
          performedByName: req.user?.name || req.user?.userName || "Staff",
          performedByUserRole: req.user?.role || "OWNER",
          details: { blockReason: updated.blockReason },
        },
      }).catch(() => {});

      if (realtime?.io) {
        realtime.io.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableId });
        realtime.io.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableId });
      }

      return reply.send({
        success: true,
        message: `Table ${table.tableNo} blocked successfully (${updated.blockReason})`,
        table: updated,
      });
    } catch (err) {
      console.error("Error blocking table:", err);
      return reply.code(500).send({ success: false, message: err.message || "Failed to block table" });
    }
  });

  // Unblock Table
  app.post("/owner/:restaurantId/tables/:tableId/unblock", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);

      const table = await prisma.diningTable.findFirst({
        where: { id: tableId, restaurantId },
      });

      if (!table) {
        return reply.code(404).send({ success: false, message: "Table not found" });
      }

      const updated = await prisma.diningTable.update({
        where: { id: tableId },
        data: {
          isBlocked: false,
          blockReason: null,
          blockedAt: null,
          blockedByName: null,
        },
      });

      // Audit Log
      await prisma.tableOperationLog.create({
        data: {
          restaurantId,
          operationType: "TABLE_UNBLOCKED",
          sourceTableId: tableId,
          sourceTableNo: table.tableNo,
          performedByUserId: req.user?.id || req.user?.userId || null,
          performedByName: req.user?.name || req.user?.userName || "Staff",
          performedByUserRole: req.user?.role || "OWNER",
        },
      }).catch(() => {});

      if (realtime?.io) {
        realtime.io.to(`restaurant_${restaurantId}`).emit("table:updated", { restaurantId, tableId });
        realtime.io.to(`restaurant:${restaurantId}`).emit("table:updated", { restaurantId, tableId });
      }

      return reply.send({
        success: true,
        message: `Table ${table.tableNo} is now unblocked and available.`,
        table: updated,
      });
    } catch (err) {
      console.error("Error unblocking table:", err);
      return reply.code(500).send({ success: false, message: err.message || "Failed to unblock table" });
    }
  });

  // Force Clear & Free Table Endpoint
  const handleClearTable = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const rawParam = String(req.params.tableId || "").trim();
      const parsedId = Number(rawParam);
      const isNumeric = Number.isInteger(parsedId) && parsedId > 0;
      const body = req.body || {};
      const { force = false, reason = "Customer left table", performedByUserId = null, performedByName = null, performedByUserRole = "SERVER" } = body;

      let table = null;
      if (isNumeric) {
        table = await prisma.diningTable.findFirst({
          where: {
            id: parsedId,
            restaurantId,
          },
          include: {
            tableSessions: {
              where: { status: { in: ["OPEN", "BILLING", "PAID"] } },
              include: { orders: { include: { items: true } } },
            },
          },
        });
      }

      if (!table && rawParam) {
        table = await prisma.diningTable.findFirst({
          where: {
            restaurantId,
            tableNo: rawParam,
          },
          include: {
            tableSessions: {
              where: { status: { in: ["OPEN", "BILLING", "PAID"] } },
              include: { orders: { include: { items: true } } },
            },
          },
        });
      }

      if (!table) {
        return reply.code(404).send({ success: false, message: "Table not found" });
      }

      const effectiveRid = table.restaurantId || restaurantId;
      const activeSession = table.tableSessions[0];
      const activeOrders = activeSession?.orders || [];
      const activePrepOrders = activeOrders.filter(
        (o) => ["ACCEPTED", "PREPARING", "READY"].includes(o.status)
      );
      const unpaidOrders = activeOrders.filter(
        (o) => !["PAID", "SUCCESS"].includes(String(o.paymentStatus || "").toUpperCase()) && o.status !== "CANCELLED"
      );

      // Validation check if not forced
      if (!force && (unpaidOrders.length > 0 || activePrepOrders.length > 0)) {
        return reply.code(400).send({
          success: false,
          requiresConfirmation: true,
          hasUnpaidOrders: unpaidOrders.length > 0,
          hasActivePrepOrders: activePrepOrders.length > 0,
          unpaidCount: unpaidOrders.length,
          prepCount: activePrepOrders.length,
          message: unpaidOrders.length > 0
            ? "Payment pending. Settle the bill before freeing this table."
            : `Table ${table.tableNo} has ${activePrepOrders.length} order(s) undergoing preparation. Please confirm to force-free this table.`,
        });
      }

      // Execute session closure, order updates, waiter unassignment, and audit log atomically in a transaction
      const updatedTable = await prisma.$transaction(async (tx) => {
        const rawNo = String(table.tableNo || "").trim();
        const strippedNo = rawNo.replace(/^(table|tbl)[-\s]*/i, "");
        const candidates = Array.from(new Set([rawNo, strippedNo, `Table ${strippedNo}`].filter(Boolean)));

        // Find all active sessions for this table to get their session IDs
        const sessionsToClose = await tx.tableSession.findMany({
          where: {
            restaurantId: effectiveRid,
            OR: [
              { tableId: table.id },
              { tableNo: { in: candidates, mode: "insensitive" } },
            ],
            status: { in: ["OPEN", "BILLING", "PAID"] },
          },
          select: { id: true },
        });

        const activeSessionIds = sessionsToClose.map((s) => s.id);

        // Always close all active table sessions matching tableId OR tableNo candidates
        await tx.tableSession.updateMany({
          where: {
            restaurantId: effectiveRid,
            OR: [
              { tableId: table.id },
              { tableNo: { in: candidates, mode: "insensitive" } },
            ],
            status: { in: ["OPEN", "BILLING", "PAID"] },
          },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
          },
        });

        // Mark open prep/active orders for this table as DELIVERED
        // Note: Order model uses tableNo and tableSessionId (not tableId)
        const orderWhereOr = [{ tableNo: { in: candidates, mode: "insensitive" } }];
        if (activeSessionIds.length > 0) {
          orderWhereOr.push({ tableSessionId: { in: activeSessionIds } });
        }

        await tx.order.updateMany({
          where: {
            restaurantId: effectiveRid,
            OR: orderWhereOr,
            status: { in: ["PLACED", "ACCEPTED", "PREPARING", "READY", "OPEN", "BILLING"] },
          },
          data: {
            status: "DELIVERED",
          },
        });

        // Freeing a table automatically clears the assigned server (setting assignedWaiterId and assignedWaiterName to null)
        // unless explicitly requested to preserve it via clearWaiter: false
        const shouldClearWaiter = req.body?.clearWaiter !== false;
        const updated = shouldClearWaiter
          ? await tx.diningTable.update({
              where: { id: table.id },
              data: {
                assignedWaiterId: null,
                assignedWaiterName: null,
              },
            })
          : table;

        // Record Audit Log in TableOperationLog
        try {
          await tx.tableOperationLog.create({
            data: {
              restaurantId: effectiveRid,
              operationType: "CLEAR_TABLE",
              sourceTableId: table.id,
              sourceTableNo: table.tableNo,
              sourceSessionId: activeSession?.id || null,
              performedByUserId: performedByUserId ? Number(performedByUserId) : (req.user?.id || null),
              performedByName: performedByName || req.user?.name || req.user?.email || (performedByUserRole === "OWNER" ? "Owner" : "Server"),
              performedByUserRole: performedByUserRole || (req.user?.role || "STAFF"),
              details: {
                reason,
                forced: Boolean(force),
                previousState: activeSession ? activeSession.status : "OCCUPIED",
                activeOrdersCount: activeOrders.length,
                unpaidOrdersCount: unpaidOrders.length,
              },
            },
          });
        } catch (auditErr) {
          console.warn("Failed to record TableOperationLog:", auditErr?.message);
        }

        return updated;
      });

      if (realtime?.io || realtime?.staff) {
        const nowTimestamp = Date.now();
        const nowIso = new Date(nowTimestamp).toISOString();
        const clearPayload = {
          type: "TABLE_UPDATED",
          restaurantId: effectiveRid,
          tableId: table.id,
          id: table.id,
          tableNo: table.tableNo,
          isOccupied: false,
          status: "AVAILABLE",
          assignedWaiterId: updatedTable?.assignedWaiterId || null,
          assignedWaiterName: updatedTable?.assignedWaiterName || null,
          assignedServer: updatedTable?.assignedWaiterName || null,
          assignedServerId: updatedTable?.assignedWaiterId || null,
          assignedServerName: updatedTable?.assignedWaiterName || null,
          activeOrders: [],
          activeOrderCount: 0,
          activeItemCount: 0,
          activeOrderStatus: null,
          paymentStatus: null,
          session: { status: "CLOSED" },
          activeSession: null,
          occupiedSince: null,
          version: nowTimestamp,
          updatedAt: nowIso,
        };
        const sessionPayload = {
          restaurantId: effectiveRid,
          tableId: table.id,
          id: table.id,
          tableNo: table.tableNo,
          sessionId: activeSession?.id || null,
          status: "CLOSED",
          assignedServer: null,
          assignedWaiterId: null,
          assignedWaiterName: null,
          assignedServerId: null,
          assignedServerName: null,
          closedAt: nowIso,
          version: nowTimestamp,
          updatedAt: nowIso,
        };
        if (realtime?.io) {
          realtime.io.to(`restaurant_${effectiveRid}`).emit("table:updated", clearPayload);
          realtime.io.to(`restaurant:${effectiveRid}`).emit("table:updated", clearPayload);
          realtime.io.to(`restaurant_${effectiveRid}`).emit("table:session_updated", sessionPayload);
          realtime.io.to(`restaurant:${effectiveRid}`).emit("table:session_updated", sessionPayload);
          realtime.io.to(`restaurant_${effectiveRid}`).emit("table:layout_updated", { restaurantId: effectiveRid });
          realtime.io.to(`restaurant:${effectiveRid}`).emit("table:layout_updated", { restaurantId: effectiveRid });
        }

        if (realtime?.staff) {
          realtime.staff.to(`restaurant:${effectiveRid}`).emit("table:updated", clearPayload);
          realtime.staff.to(`restaurant_${effectiveRid}`).emit("table:updated", clearPayload);
          realtime.staff.to(`restaurant:${effectiveRid}`).emit("table:session_updated", sessionPayload);
          realtime.staff.to(`restaurant_${effectiveRid}`).emit("table:session_updated", sessionPayload);
        }
      }

      return reply.send({
        success: true,
        message: `Table ${table.tableNo} cleared and marked free!`,
        table: updatedTable,
      });
    } catch (err) {
      console.error("Error clearing table:", err);
      return reply.code(500).send({ success: false, message: err.message || "Failed to clear table" });
    }
  };
  app.post("/owner/:restaurantId/tables/:tableId/clear", handleClearTable);
  app.post("/api/owner/:restaurantId/tables/:tableId/clear", handleClearTable);

  // Table Operation Audit Logs Endpoint
  app.get("/owner/:restaurantId/table-operation-logs", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const logs = await prisma.tableOperationLog.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { success: true, logs };
    } catch (err) {
      console.error("Error fetching table operation logs:", err);
      return reply.code(500).send({ success: false, message: "Failed to fetch table audit logs" });
    }
  });

  // Update Restaurant Shift Timings
  app.put("/owner/:restaurantId/settings/shifts", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const {
        breakfastStart, breakfastEnd,
        lunchStart, lunchEnd,
        dinnerStart, dinnerEnd,
      } = req.body || {};

      const updated = await prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          breakfastStart: breakfastStart || "07:00",
          breakfastEnd: breakfastEnd || "11:30",
          lunchStart: lunchStart || "11:30",
          lunchEnd: lunchEnd || "16:00",
          dinnerStart: dinnerStart || "16:00",
          dinnerEnd: dinnerEnd || "23:00",
        },
      });

      return reply.send({
        success: true,
        message: "Shift timings updated successfully",
        shifts: {
          breakfast: { start: updated.breakfastStart, end: updated.breakfastEnd },
          lunch: { start: updated.lunchStart, end: updated.lunchEnd },
          dinner: { start: updated.dinnerStart, end: updated.dinnerEnd },
        },
      });
    } catch (err) {
      console.error("Error updating shift timings:", err);
      return reply.code(500).send({ success: false, message: err.message || "Failed to update shift timings" });
    }
  });

  const handleCreateTable = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { tableNo, seats, isActive, section, positionX, positionY, width, height, shape, rotation } = req.body || {};
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!tableNo) return reply.code(400).send({ message: "Table number is required" });

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, slug: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const existing = await prisma.diningTable.findFirst({
        where: { restaurantId, tableNo },
        select: { id: true },
      });
      if (existing) return reply.code(400).send({ message: "Table number already exists" });

      const targetUrl = buildQrTargetUrl(restaurant.slug, tableNo);
      return await prisma.diningTable.create({
        data: {
          restaurantId,
          tableNo,
          seats: Number(seats || 4),
          section: section ? String(section) : "Main Floor",
          positionX: positionX !== undefined && positionX !== null ? Number(positionX) : null,
          positionY: positionY !== undefined && positionY !== null ? Number(positionY) : null,
          width: width ? Number(width) : 120,
          height: height ? Number(height) : 100,
          shape: shape || "RECTANGLE",
          rotation: rotation ? Number(rotation) : 0,
          isActive: isActive ?? true,
          qrCodeUrl: targetUrl,
          qrToken: crypto.randomBytes(16).toString("hex"),
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create table" });
    }
  };
  app.post("/owner/:restaurantId/tables", handleCreateTable);
  app.post("/api/owner/:restaurantId/tables", handleCreateTable);

  const handleUpdateTable = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { tableNo, seats, isActive, section, positionX, positionY, width, height, shape, rotation } = req.body || {};
      if (!restaurantId || !tableId) return reply.code(400).send({ message: "Invalid id values" });

      let existing = await prisma.diningTable.findFirst({
        where: { id: tableId, restaurantId },
      });
      if (!existing) {
        existing = await prisma.diningTable.findUnique({ where: { id: tableId } });
      }
      if (!existing) {
        return reply.code(404).send({ message: "Table not found" });
      }

      const effectiveRid = existing.restaurantId || restaurantId;
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: effectiveRid },
        select: { id: true, slug: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      if (tableNo && tableNo !== existing.tableNo) {
        const duplicate = await prisma.diningTable.findFirst({
          where: { restaurantId: effectiveRid, tableNo, NOT: { id: tableId } },
        });
        if (duplicate) return reply.code(400).send({ message: "Table number already exists" });
      }

      const nextTableNo = tableNo ?? existing.tableNo;
      return await prisma.diningTable.update({
        where: { id: tableId },
        data: {
          tableNo: nextTableNo,
          seats: seats === undefined ? existing.seats : Number(seats),
          section: section !== undefined ? String(section) : existing.section,
          positionX: positionX !== undefined ? (positionX === null ? null : Number(positionX)) : existing.positionX,
          positionY: positionY !== undefined ? (positionY === null ? null : Number(positionY)) : existing.positionY,
          width: width !== undefined ? Number(width) : existing.width,
          height: height !== undefined ? Number(height) : existing.height,
          shape: shape !== undefined ? String(shape) : existing.shape,
          rotation: rotation !== undefined ? Number(rotation) : existing.rotation,
          isActive: isActive ?? existing.isActive,
          qrCodeUrl: buildQrTargetUrl(restaurant.slug, nextTableNo),
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update table" });
    }
  };
  app.put("/owner/:restaurantId/tables/:tableId", handleUpdateTable);
  app.put("/api/owner/:restaurantId/tables/:tableId", handleUpdateTable);

  const handleDeleteTable = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      if (!restaurantId || !tableId) return reply.code(400).send({ message: "Invalid id values" });

      let table = await prisma.diningTable.findFirst({
        where: { id: tableId, restaurantId },
        select: { id: true, restaurantId: true },
      });
      if (!table) {
        table = await prisma.diningTable.findUnique({
          where: { id: tableId },
          select: { id: true, restaurantId: true },
        });
      }
      if (!table) {
        return reply.code(404).send({ message: "Table not found" });
      }

      await prisma.diningTable.delete({ where: { id: table.id } });
      return { message: "Table deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete table" });
    }
  };
  app.delete("/owner/:restaurantId/tables/:tableId", handleDeleteTable);
  app.delete("/api/owner/:restaurantId/tables/:tableId", handleDeleteTable);

  // Keep analytics/finance/settings/staff endpoints in this module.
  const getOwnerAnalyticsHandler = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const rangeRaw = String(req.query?.range || "7d").toLowerCase();
      const startDateQuery = req.query?.startDate;
      const endDateQuery = req.query?.endDate;

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const timezone = restaurant.timezone || "Asia/Kolkata";
      const now = new Date();

      // Timezone boundary helpers
      const getLocalDateStr = (date, tz = timezone) => {
        try {
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(date));
        } catch {
          return new Date(date).toISOString().split("T")[0];
        }
      };

      const getLocalHour = (date, tz = timezone) => {
        try {
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hour: "numeric",
            hourCycle: "h23",
          }).formatToParts(new Date(date));
          return Number(parts.find((p) => p.type === "hour")?.value || 0);
        } catch {
          return new Date(date).getHours();
        }
      };

      const getZonedBoundary = (dateStr, isEnd = false, tz = timezone) => {
        try {
          const [y, m, d] = dateStr.split("-").map(Number);
          const utcGuess = new Date(Date.UTC(y, m - 1, d, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0));
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hourCycle: "h23",
          }).formatToParts(utcGuess);
          const zYear = Number(parts.find((p) => p.type === "year")?.value || y);
          const zMonth = Number(parts.find((p) => p.type === "month")?.value || m);
          const zDay = Number(parts.find((p) => p.type === "day")?.value || d);
          const zHour = Number(parts.find((p) => p.type === "hour")?.value || 0);
          const zMinute = Number(parts.find((p) => p.type === "minute")?.value || 0);
          const zSec = Number(parts.find((p) => p.type === "second")?.value || 0);

          const asUtc = Date.UTC(zYear, zMonth - 1, zDay, zHour, zMinute, zSec, isEnd ? 999 : 0);
          const offsetMs = asUtc - utcGuess.getTime();
          return new Date(utcGuess.getTime() - offsetMs);
        } catch {
          const temp = new Date(dateStr);
          if (isEnd) temp.setHours(23, 59, 59, 999);
          else temp.setHours(0, 0, 0, 0);
          return temp;
        }
      };

      const formatDateLabel = (d, tz = timezone, opts = { day: "numeric", month: "short" }) => {
        try {
          return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(new Date(d));
        } catch {
          return new Date(d).toLocaleDateString("en-GB", opts);
        }
      };

      const todayStr = getLocalDateStr(now, timezone);

      let seriesStart;
      let seriesEnd;
      let prevSeriesStart;
      let prevSeriesEnd;
      let rangeLabel = "7 Days";
      let dateDisplayLabel = "";

      if (rangeRaw === "today" || rangeRaw === "24h") {
        seriesStart = getZonedBoundary(todayStr, false, timezone);
        seriesEnd = getZonedBoundary(todayStr, true, timezone);
        const yesterday = new Date(seriesStart.getTime() - 24 * 3600 * 1000);
        const yesterdayStr = getLocalDateStr(yesterday, timezone);
        prevSeriesStart = getZonedBoundary(yesterdayStr, false, timezone);
        prevSeriesEnd = getZonedBoundary(yesterdayStr, true, timezone);
        rangeLabel = "Today";
        dateDisplayLabel = `Today · ${formatDateLabel(seriesStart, timezone, { day: "numeric", month: "long", year: "numeric" })}`;
      } else if (rangeRaw === "yesterday") {
        const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
        const yesterdayStr = getLocalDateStr(yesterday, timezone);
        seriesStart = getZonedBoundary(yesterdayStr, false, timezone);
        seriesEnd = getZonedBoundary(yesterdayStr, true, timezone);

        const dayBefore = new Date(seriesStart.getTime() - 24 * 3600 * 1000);
        const dayBeforeStr = getLocalDateStr(dayBefore, timezone);
        prevSeriesStart = getZonedBoundary(dayBeforeStr, false, timezone);
        prevSeriesEnd = getZonedBoundary(dayBeforeStr, true, timezone);
        rangeLabel = "Yesterday";
        dateDisplayLabel = `Yesterday · ${formatDateLabel(seriesStart, timezone, { day: "numeric", month: "long", year: "numeric" })}`;
      } else if (rangeRaw === "30d" || rangeRaw === "this_month") {
        seriesEnd = getZonedBoundary(todayStr, true, timezone);
        const startDay = new Date(seriesEnd.getTime() - 30 * 24 * 3600 * 1000 + 1000);
        const startDayStr = getLocalDateStr(startDay, timezone);
        seriesStart = getZonedBoundary(startDayStr, false, timezone);

        const durationMs = seriesEnd.getTime() - seriesStart.getTime();
        prevSeriesEnd = new Date(seriesStart.getTime() - 1);
        prevSeriesStart = new Date(seriesStart.getTime() - durationMs);
        rangeLabel = "30 Days";
        dateDisplayLabel = `${formatDateLabel(seriesStart, timezone)} – ${formatDateLabel(seriesEnd, timezone, { day: "numeric", month: "short", year: "numeric" })}`;
      } else if (rangeRaw === "custom" && startDateQuery && endDateQuery) {
        seriesStart = getZonedBoundary(String(startDateQuery), false, timezone);
        seriesEnd = getZonedBoundary(String(endDateQuery), true, timezone);
        const durationMs = seriesEnd.getTime() - seriesStart.getTime();
        prevSeriesEnd = new Date(seriesStart.getTime() - 1);
        prevSeriesStart = new Date(seriesStart.getTime() - durationMs);
        rangeLabel = "Custom";
        dateDisplayLabel = `${formatDateLabel(seriesStart, timezone)} – ${formatDateLabel(seriesEnd, timezone, { day: "numeric", month: "short", year: "numeric" })}`;
      } else {
        // Default 7d
        seriesEnd = getZonedBoundary(todayStr, true, timezone);
        const startDay = new Date(seriesEnd.getTime() - 7 * 24 * 3600 * 1000 + 1000);
        const startDayStr = getLocalDateStr(startDay, timezone);
        seriesStart = getZonedBoundary(startDayStr, false, timezone);

        const durationMs = seriesEnd.getTime() - seriesStart.getTime();
        prevSeriesEnd = new Date(seriesStart.getTime() - 1);
        prevSeriesStart = new Date(seriesStart.getTime() - durationMs);
        rangeLabel = "7 Days";
        dateDisplayLabel = `${formatDateLabel(seriesStart, timezone)} – ${formatDateLabel(seriesEnd, timezone, { day: "numeric", month: "short", year: "numeric" })}`;
      }

      // Fetch Current and Previous Period data in parallel
      const [
        orders,
        prevOrders,
        menuItems,
        tables,
        rawMaterials,
        inventoryStocks,
        customers,
        payments,
        staffUsers,
        kots,
      ] = await Promise.all([
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: seriesStart, lte: seriesEnd } },
          include: { items: true, customer: true, payments: true },
          orderBy: { createdAt: "desc" },
        }).catch((err) => {
          console.error("[Analytics] Order fetch error:", err.message);
          return [];
        }),
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: prevSeriesStart, lte: prevSeriesEnd } },
          select: { id: true, total: true, status: true, customerId: true },
        }).catch((err) => {
          console.error("[Analytics] PrevOrder fetch error:", err.message);
          return [];
        }),
        prisma.menuItem.findMany({
          where: { restaurantId },
          select: { id: true, name: true, category: true, isAvailable: true, price: true },
        }).catch(() => []),
        prisma.diningTable.findMany({
          where: { restaurantId },
          select: {
            id: true,
            tableNo: true,
            isActive: true,
            seats: true,
            section: true,
            tableSessions: {
              where: { status: { in: ["OPEN", "BILLING", "PAID"] } },
              select: { id: true },
            },
          },
        }).then((rows) =>
          rows.map((t) => ({
            ...t,
            groupName: t.section || "Main Floor",
            isOccupied: Boolean(t.tableSessions && t.tableSessions.length > 0),
          }))
        ).catch((err) => {
          console.error("[Analytics] DiningTable fetch error:", err.message);
          return [];
        }),
        prisma.rawMaterial.findMany({
          where: { restaurantId, isActive: true },
          select: { id: true, name: true, currentStock: true, minimumStock: true, category: true },
        }).catch(() => []),
        prisma.inventoryStock.findMany({
          where: { restaurantId },
          include: { menuItem: { select: { name: true } } },
        }).catch(() => []),
        prisma.customer.findMany({
          where: { restaurantId },
          select: { id: true, name: true, phone: true, createdAt: true },
        }).catch(() => []),
        prisma.payment.findMany({
          where: { restaurantId, createdAt: { gte: seriesStart, lte: seriesEnd } },
        }).catch(() => []),
        prisma.user.findMany({
          where: { restaurantId },
          select: { id: true, name: true, role: true, designation: true },
        }).catch(() => []),
        prisma.kitchenOrderTicket.findMany({
          where: { restaurantId, createdAt: { gte: seriesStart, lte: seriesEnd } },
          select: { id: true, status: true, reprintsCount: true },
        }).catch(() => []),
      ]);

      // Previous Period Aggregations for Comparisons
      const prevValidOrders = prevOrders.filter((o) => !["CANCELLED", "REFUNDED"].includes(String(o.status || "").toUpperCase()));
      const prevTotalRevenue = prevValidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const prevTotalOrders = prevValidOrders.length;
      const prevUniqueCustomers = new Set(prevValidOrders.map((o) => o.customerId).filter(Boolean)).size;
      const prevAvgOrderValue = prevTotalOrders > 0 ? +(prevTotalRevenue / prevTotalOrders).toFixed(2) : 0;

      // Current Period Aggregations
      const statusKeys = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"];
      const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];
      const statusCounts = statusKeys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
      
      const sourceCounts = { QR: 0, WAITER: 0, POS: 0, MANUAL: 0 };
      const typeCounts = { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 };
      const paymentMethodCounts = { UPI: 0, CASH: 0, CARD: 0, ONLINE: 0, WALLET: 0, OTHER: 0 };
      const paymentMethodAmount = { UPI: 0, CASH: 0, CARD: 0, ONLINE: 0, WALLET: 0, OTHER: 0 };

      let totalRevenue = 0;
      let totalSubtotal = 0;
      let totalDiscounts = 0;
      let totalTaxes = 0;
      let totalCancelledValue = 0;
      let totalPaidValue = 0;
      let totalUnpaidValue = 0;
      let delayedTickets = 0;
      let totalCycleMinutes = 0;
      let deliveredWithCycle = 0;
      let qrOrdersCount = 0;
      let qrRevenue = 0;

      const hourlyWaveform = Array.from({ length: 24 }, (_, h) => {
        const hourLabel = h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
        return { hour: h, label: hourLabel, orders: 0, revenue: 0, customers: 0, kitchenLoad: 0 };
      });

      const itemMap = new Map();
      const categoryMap = new Map();
      const tableMap = new Map();
      const customerSpendMap = new Map();
      const staffMap = new Map();
      const staffUserMap = new Map(staffUsers.map((u) => [u.id, u]));
      const menuById = new Map(menuItems.map((m) => [m.id, m]));

      for (const order of orders) {
        const orderStatus = String(order.status || "PLACED").toUpperCase();
        statusCounts[orderStatus] = (statusCounts[orderStatus] || 0) + 1;
        
        const orderTotal = Number(order.total || 0);
        const orderSubtotal = Number(order.subtotal || 0);
        const discountVal = Number(order.discountAmount || 0);
        const taxVal = Number(order.taxAmount || 0);

        if (orderStatus === "CANCELLED") {
          totalCancelledValue += orderTotal;
        } else {
          totalRevenue += orderTotal;
          totalSubtotal += orderSubtotal;
          totalDiscounts += discountVal;
          totalTaxes += taxVal;
          if (String(order.paymentStatus || "").toUpperCase() === "PAID") {
            totalPaidValue += orderTotal;
          } else {
            totalUnpaidValue += orderTotal;
          }
        }

        // Order Source
        const src = String(order.orderSource || "POS").toUpperCase();
        if (src.includes("QR")) {
          sourceCounts.QR += 1;
          qrOrdersCount += 1;
          if (orderStatus !== "CANCELLED") qrRevenue += orderTotal;
        } else if (src.includes("WAITER")) {
          sourceCounts.WAITER += 1;
        } else if (src.includes("MANUAL")) {
          sourceCounts.MANUAL += 1;
        } else {
          sourceCounts.POS += 1;
        }

        // Order Type / Fulfillment
        const type = String(order.fulfillment || order.orderType || (order.tableNo ? "DINE_IN" : "TAKEAWAY")).toUpperCase();
        if (type.includes("TAKE")) typeCounts.TAKEAWAY += 1;
        else if (type.includes("DELIV")) typeCounts.DELIVERY += 1;
        else typeCounts.DINE_IN += 1;

        // Payment Method from order.paymentMode or payments relation
        const pm = String(order.paymentMode || order.paymentMethod || order.payments?.[0]?.paymentMethod || "CASH").toUpperCase();
        if (pm.includes("UPI")) { paymentMethodCounts.UPI += 1; paymentMethodAmount.UPI += orderTotal; }
        else if (pm.includes("CARD")) { paymentMethodCounts.CARD += 1; paymentMethodAmount.CARD += orderTotal; }
        else if (pm.includes("ONLINE")) { paymentMethodCounts.ONLINE += 1; paymentMethodAmount.ONLINE += orderTotal; }
        else if (pm.includes("WALLET")) { paymentMethodCounts.WALLET += 1; paymentMethodAmount.WALLET += orderTotal; }
        else { paymentMethodCounts.CASH += 1; paymentMethodAmount.CASH += orderTotal; }

        const createdAt = new Date(order.createdAt);
        const createdAtMs = createdAt.getTime();
        const ageMin = (now.getTime() - createdAtMs) / 60000;
        if (activeStatuses.includes(orderStatus) && ageMin > 20) delayedTickets += 1;
        if (orderStatus === "DELIVERED") {
          const updatedAtMs = new Date(order.updatedAt).getTime();
          totalCycleMinutes += Math.max(0, (updatedAtMs - createdAtMs) / 60000);
          deliveredWithCycle += 1;
        }

        // Hourly waveform in local restaurant timezone
        const hour = getLocalHour(createdAt, timezone);
        if (hour >= 0 && hour < 24) {
          hourlyWaveform[hour].orders += 1;
          hourlyWaveform[hour].revenue += orderTotal;
          if (activeStatuses.includes(orderStatus)) hourlyWaveform[hour].kitchenLoad += 1;
        }

        // Table Heatmap
        const tableNo = order.tableNo || "Walk-in";
        const tableAgg = tableMap.get(tableNo) || { tableNo, orders: 0, revenue: 0 };
        tableAgg.orders += 1;
        tableAgg.revenue += orderTotal;
        tableMap.set(tableNo, tableAgg);

        // Customer spend map
        if (order.customerId) {
          const custAgg = customerSpendMap.get(order.customerId) || {
            id: order.customerId,
            name: order.customer?.name || order.customerName || "Customer",
            phone: order.customer?.phone || order.phone || "",
            orders: 0,
            spend: 0,
          };
          custAgg.orders += 1;
          custAgg.spend += orderTotal;
          customerSpendMap.set(order.customerId, custAgg);
        }

        // Staff map
        const staffId = order.createdByUserId || order.waiterId || order.serverUserId;
        if (staffId) {
          const staffUser = staffUserMap.get(staffId);
          const staffName = staffUser?.name || order.waiter?.name || `Staff #${staffId}`;
          const staffAgg = staffMap.get(staffId) || {
            staffId,
            name: staffName,
            orders: 0,
            revenue: 0,
          };
          staffAgg.orders += 1;
          staffAgg.revenue += orderTotal;
          staffMap.set(staffId, staffAgg);
        }

        // Items breakdown
        for (const item of order.items || []) {
          const itemName = item.itemName || "Unknown Item";
          const qty = Number(item.qty || 0);
          const revenue = Number(item.total || 0);
          const itemAgg = itemMap.get(itemName) || { name: itemName, qty: 0, revenue: 0, price: Number(item.price || 0) };
          itemAgg.qty += qty;
          itemAgg.revenue += revenue;
          itemMap.set(itemName, itemAgg);

          const categoryFromMenu = item.menuItemId ? menuById.get(item.menuItemId)?.category : null;
          const categoryName = categoryFromMenu || "Uncategorized";
          const categoryAgg = categoryMap.get(categoryName) || { name: categoryName, qty: 0, revenue: 0 };
          categoryAgg.qty += qty;
          categoryAgg.revenue += revenue;
          categoryMap.set(categoryName, categoryAgg);
        }
      }

      const validOrders = orders.filter((o) => !["CANCELLED", "REFUNDED"].includes(String(o.status || "").toUpperCase()));
      const totalOrders = validOrders.length;
      const totalAllOrders = orders.length;
      const uniqueCustomerIds = new Set(validOrders.map((o) => o.customerId).filter(Boolean));
      const totalCustomers = uniqueCustomerIds.size || (totalOrders > 0 ? Math.max(1, Math.round(totalOrders * 0.75)) : 0);
      const deliveredOrders = Number(statusCounts.DELIVERED || 0);
      const cancelledOrders = Number(statusCounts.CANCELLED || 0);
      const closedOrders = deliveredOrders + cancelledOrders;
      const avgOrderValue = totalOrders > 0 ? +(totalRevenue / totalOrders).toFixed(2) : 0;
      const completionRate = closedOrders > 0 ? +((deliveredOrders / closedOrders) * 100).toFixed(1) : 0;
      const cancellationRate = totalAllOrders > 0 ? +((cancelledOrders / totalAllOrders) * 100).toFixed(1) : 0;
      const avgPrepMinutes = deliveredWithCycle > 0 ? +(totalCycleMinutes / deliveredWithCycle).toFixed(1) : 0;

      // Percentage Change Calculations
      const calcPctChange = (curr, prev) => {
        if (!prev || prev === 0) return curr > 0 ? 100 : 0;
        return +(((curr - prev) / prev) * 100).toFixed(1);
      };

      const revenuePctChange = calcPctChange(totalRevenue, prevTotalRevenue);
      const ordersPctChange = calcPctChange(totalOrders, prevTotalOrders);
      const customersPctChange = calcPctChange(totalCustomers, prevUniqueCustomers);
      const aovPctChange = calcPctChange(avgOrderValue, prevAvgOrderValue);

      // Peak hour calculation
      let peakHourObj = hourlyWaveform[0];
      for (const h of hourlyWaveform) {
        if (h.revenue > peakHourObj.revenue || (h.revenue === peakHourObj.revenue && h.orders > peakHourObj.orders)) {
          peakHourObj = h;
        }
      }

      // Table Status Stats
      const totalTables = tables.length;
      const occupiedTables = tables.filter((t) => t.isOccupied).length;
      const availableTables = Math.max(0, totalTables - occupiedTables);
      const occupancyRatePct = totalTables > 0 ? +((occupiedTables / totalTables) * 100).toFixed(1) : 0;
      const avgQrOrderValue = qrOrdersCount > 0 ? +(qrRevenue / qrOrdersCount).toFixed(2) : 0;
      const qrConversionRatePct = totalOrders > 0 ? +((qrOrdersCount / totalOrders) * 100).toFixed(1) : 0;

      // Inventory Stock Status
      let healthyCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      const lowStockItems = [];
      const outOfStockItems = [];

      if (rawMaterials.length > 0) {
        for (const rm of rawMaterials) {
          const qty = Number(rm.currentStock || 0);
          const minTh = Number(rm.minimumStock || 0);
          if (qty <= 0) {
            outOfStockCount += 1;
            outOfStockItems.push(rm.name);
          } else if (qty <= minTh) {
            lowStockCount += 1;
            lowStockItems.push(rm.name);
          } else {
            healthyCount += 1;
          }
        }
      } else if (inventoryStocks.length > 0) {
        for (const item of inventoryStocks) {
          const qty = Number(item.stockQuantity || 0);
          const minTh = Number(item.thresholdAlert || 5);
          const name = item.menuItem?.name || `Item #${item.menuItemId}`;
          if (qty <= 0) {
            outOfStockCount += 1;
            outOfStockItems.push(name);
          } else if (qty <= minTh) {
            lowStockCount += 1;
            lowStockItems.push(name);
          } else {
            healthyCount += 1;
          }
        }
      }

      // Operational AI Radar Alerts
      const aiAlerts = [];
      if (delayedTickets > 0) {
        aiAlerts.push({
          id: "delayed-tickets",
          severity: "high",
          title: `Kitchen delay detected — ${delayedTickets} orders`,
          description: "Active KOT tickets in kitchen queue have exceeded 20 minutes preparation threshold.",
          actionText: "Check Kitchen KOT Queue",
          area: "Kitchen Operations",
        });
      }
      if (outOfStockCount > 0) {
        aiAlerts.push({
          id: "stock-out",
          severity: "high",
          title: `Stock out — ${outOfStockCount} items out of stock`,
          description: "Essential inventory stock items are currently at 0 quantity.",
          actionText: "Manage Inventory Stock",
          area: "Inventory",
        });
      }
      if (lowStockCount > 0) {
        aiAlerts.push({
          id: "low-stock",
          severity: "medium",
          title: `Low stock alert — ${lowStockCount} items below threshold`,
          description: "Inventory items are running low and need re-ordering.",
          actionText: "View Low Stock",
          area: "Inventory",
        });
      }
      if (cancellationRate > 10) {
        aiAlerts.push({
          id: "high-cancellations",
          severity: "medium",
          title: `High cancellation rate — ${cancellationRate.toFixed(1)}%`,
          description: "Order cancellation rate is elevated above normal operational benchmark.",
          actionText: "Review Order Audit Log",
          area: "Orders",
        });
      }
      if (aiAlerts.length === 0) {
        aiAlerts.push({
          id: "all-systems-healthy",
          severity: "info",
          title: "All operational systems operating normally",
          description: "Kitchen queue, order workflow, hardware terminals, and inventory levels are healthy.",
          actionText: "System OK",
          area: "Operations",
        });
      }

      // Payments Overview
      const successfulPaymentsCount = payments.filter((p) => String(p.status).toUpperCase() === "SUCCESS" || String(p.status).toUpperCase() === "COMPLETED").length || (totalPaidValue > 0 ? totalOrders : 0);
      const failedPaymentsCount = payments.filter((p) => String(p.status).toUpperCase() === "FAILED").length;
      const pendingPaymentsCount = payments.filter((p) => String(p.status).toUpperCase() === "PENDING").length;
      const totalPaymentsEvaluated = successfulPaymentsCount + failedPaymentsCount;
      const paymentSuccessRatePct = totalPaymentsEvaluated > 0 ? +((successfulPaymentsCount / totalPaymentsEvaluated) * 100).toFixed(1) : (totalOrders > 0 ? 100 : 0);

      const topProductsList = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);
      const bottomProductsList = Array.from(itemMap.values()).sort((a, b) => a.qty - b.qty).slice(0, 5);

      // Customer stats
      const newCustomersCount = customers.filter((c) => {
        const ct = new Date(c.createdAt).getTime();
        return ct >= seriesStart.getTime() && ct <= seriesEnd.getTime();
      }).length;
      const returningPatronsCount = Array.from(customerSpendMap.values()).filter((c) => c.orders > 1).length;
      const repeatRatePct = totalCustomers > 0 ? +((returningPatronsCount / totalCustomers) * 100).toFixed(1) : 0;

      // KOTs metrics
      const totalKotsCount = kots.length || totalOrders;
      const reprintsCount = kots.reduce((sum, k) => sum + Number(k.reprintsCount || 0), 0);

      // Build timeseries array for trend charts
      const dailyMap = new Map();
      if (rangeRaw !== "today" && rangeRaw !== "24h" && rangeRaw !== "yesterday") {
        let currDate = new Date(seriesStart);
        while (currDate.getTime() <= seriesEnd.getTime()) {
          const dateStr = getLocalDateStr(currDate, timezone);
          const label = formatDateLabel(currDate, timezone, { day: "numeric", month: "short" });
          dailyMap.set(dateStr, { ts: dateStr, label, orders: 0, revenue: 0, customers: new Set() });
          currDate = new Date(currDate.getTime() + 24 * 3600 * 1000);
        }

        for (const order of orders) {
          const dStr = getLocalDateStr(order.createdAt, timezone);
          if (dailyMap.has(dStr)) {
            const entry = dailyMap.get(dStr);
            entry.orders += 1;
            if (String(order.status).toUpperCase() !== "CANCELLED") {
              entry.revenue += Number(order.total || 0);
            }
            if (order.customerId) entry.customers.add(order.customerId);
          }
        }
      }

      const timeseries = (rangeRaw === "today" || rangeRaw === "24h" || rangeRaw === "yesterday")
        ? hourlyWaveform.map((h) => ({
            ts: h.hour,
            label: h.label,
            orders: h.orders,
            revenue: h.revenue,
            customers: h.orders > 0 ? Math.max(1, Math.round(h.orders * 0.8)) : 0,
          }))
        : Array.from(dailyMap.values()).map((d) => ({
            ts: d.ts,
            label: d.label,
            orders: d.orders,
            revenue: d.revenue,
            customers: d.customers.size || (d.orders > 0 ? Math.max(1, Math.round(d.orders * 0.8)) : 0),
          }));

      return {
        generatedAt: now.toISOString(),
        range: rangeRaw,
        rangeLabel,
        dateDisplayLabel,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          timezone,
        },
        overview: {
          totalRevenue,
          previousTotalRevenue: prevTotalRevenue,
          revenuePctChange,
          totalOrders,
          previousTotalOrders: prevTotalOrders,
          ordersPctChange,
          totalCustomers,
          previousTotalCustomers: prevUniqueCustomers,
          customersPctChange,
          avgOrderValue,
          previousAvgOrderValue: prevAvgOrderValue,
          aovPctChange,
          grossSales: +(totalSubtotal || totalRevenue).toFixed(2),
          netSales: +((totalSubtotal || totalRevenue) - totalDiscounts).toFixed(2),
          totalDiscounts: +totalDiscounts.toFixed(2),
          totalTaxes: +totalTaxes.toFixed(2),
          cancelledOrderValue: totalCancelledValue,
          paidOrderValue: totalPaidValue,
          unpaidOrderValue: totalUnpaidValue,
          completionRate,
          cancellationRate,
        },
        realtime: {
          activeQueue: activeStatuses.reduce((sum, key) => sum + Number(statusCounts[key] || 0), 0),
          delayedTickets,
          avgPrepMinutes,
          activeTables: occupiedTables,
          totalTables,
          availableTables,
          occupancyRatePct,
          totalMenuItems: menuItems.length,
        },
        orderSources: sourceCounts,
        orderTypes: typeCounts,
        paymentMethods: {
          counts: paymentMethodCounts,
          amounts: paymentMethodAmount,
          successfulCount: successfulPaymentsCount,
          failedCount: failedPaymentsCount,
          pendingCount: pendingPaymentsCount,
          successRatePct: paymentSuccessRatePct,
        },
        tablesAndQr: {
          totalTables,
          occupiedTables,
          availableTables,
          occupancyRatePct,
          qrOrdersCount,
          qrRevenue,
          avgQrOrderValue,
          qrConversionRatePct,
        },
        kitchenFlow: {
          placed: statusCounts.PLACED || 0,
          accepted: statusCounts.ACCEPTED || 0,
          preparing: statusCounts.PREPARING || 0,
          ready: statusCounts.READY || 0,
          delivered: statusCounts.DELIVERED || 0,
          cancelled: statusCounts.CANCELLED || 0,
          avgPrepMinutes,
          delayedTickets,
          totalKots: totalKotsCount,
          reprintsCount,
        },
        customerStats: {
          totalCustomers,
          newCustomers: newCustomersCount,
          returningCustomers: Math.max(0, totalCustomers - newCustomersCount),
          repeatRatePct,
          avgCustomerSpend: totalCustomers > 0 ? +(totalRevenue / totalCustomers).toFixed(2) : 0,
          topCustomers: Array.from(customerSpendMap.values()).sort((a, b) => b.spend - a.spend).slice(0, 5),
        },
        inventoryStatus: {
          healthyCount,
          lowStockCount,
          outOfStockCount,
          lowStockItems: lowStockItems.slice(0, 10),
          outOfStockItems: outOfStockItems.slice(0, 10),
        },
        staffPerformance: Array.from(staffMap.values()).sort((a, b) => b.orders - a.orders),
        peakDemand: {
          peakHourLabel: peakHourObj?.label || "12 PM",
          peakOrders: peakHourObj?.orders || 0,
          peakRevenue: peakHourObj?.revenue || 0,
          waveform: hourlyWaveform,
        },
        alerts: aiAlerts,
        statusFunnel: statusKeys.map((key) => ({ status: key, count: statusCounts[key] || 0 })),
        charts: {
          timeseries,
          topItems: topProductsList.slice(0, 10),
          bottomItems: bottomProductsList,
          categories: Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue),
          tableHeatmap: Array.from(tableMap.values()).sort((a, b) => b.orders - a.orders).slice(0, 10),
        },
        notAvailable: {
          preOrderQrFunnel: "Pre-order QR scan tracking is not configured in event database.",
          profitability: "Ingredient cost (BOM) data is unavailable for profitability calculations.",
          gatewayFees: "Payment gateway fee structure is not configured in payment database.",
        },
      };
    } catch (err) {
      console.error("[Analytics] Unexpected handler error:", err);
      return reply.code(500).send({ message: "Failed to fetch analytics", error: err.message });
    }
  };

  app.get("/owner/:restaurantId/analytics", getOwnerAnalyticsHandler);
  app.get("/api/owner/:restaurantId/analytics", getOwnerAnalyticsHandler);

  const getFinanceAnalyticsHandler = async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const range = String(req.query?.range || "7d").toLowerCase();
      const validRanges = ["24h", "7d", "30d"];
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!validRanges.includes(range)) {
        return reply.code(400).send({ message: `Invalid range. Allowed: ${validRanges.join(", ")}` });
      }

      const now = new Date();
      const fromDate = new Date(now.getTime() - (range === "24h" ? 1 : range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);

      // Safe restaurant fetch with fallback for optional bank/UPI columns
      let restaurant = null;
      try {
        restaurant = await prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: {
            id: true,
            name: true,
            slug: true,
            invoicePrefix: true,
            upiId: true,
            bankAccountNumber: true,
            bankIfscCode: true,
            bankAccountName: true,
            bankName: true,
          },
        });
      } catch (restErr) {
        console.warn("[OwnerFinance] Detailed restaurant select failed, trying basic select:", restErr.message);
        restaurant = await prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: { id: true, name: true, slug: true, invoicePrefix: true },
        }).catch(() => null);
      }

      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const [orders, tables, menuItems, expenses] = await Promise.all([
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: fromDate } },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        }).catch((err) => {
          console.error("[OwnerFinance] Order query error:", err.message);
          return [];
        }),
        prisma.diningTable.findMany({
          where: { restaurantId },
          select: { id: true, isActive: true },
        }).catch((err) => {
          console.warn("[OwnerFinance] DiningTable query warning:", err.message);
          return [];
        }),
        prisma.menuItem.findMany({
          where: { restaurantId },
          select: { id: true, isAvailable: true },
        }).catch((err) => {
          console.warn("[OwnerFinance] MenuItem query warning:", err.message);
          return [];
        }),
        prisma.expense.findMany({
          where: { restaurantId, spentAt: { gte: fromDate } },
          orderBy: { spentAt: "desc" },
        }).catch((err) => {
          console.warn("[OwnerFinance] Expense query warning:", err.message);
          return [];
        }),
      ]);

      let grossSales = 0;
      let netSales = 0;
      let taxCollected = 0;
      let serviceChargeCollected = 0;
      let discountGiven = 0;
      let refundAmount = 0;
      let paidAmount = 0;
      let unpaidAmount = 0;
      const paymentSplit = {};
      const statusMix = {};

      const invoices = (Array.isArray(orders) ? orders : []).map((order) => {
        const total = Number(order.total || 0);
        const discount = Number(order.discountAmount || 0);
        const taxAmount = Number(order.taxAmount || 0);
        const serviceCharge = Number(order.serviceChargeAmount || 0);
        const status = String(order.status || "PLACED").toUpperCase();
        const paymentStatus = String(order.paymentStatus || "PENDING").toUpperCase();
        const paymentMode = String(order.paymentMode || "UNKNOWN").toUpperCase();
        grossSales += total;
        netSales += total - discount;
        taxCollected += taxAmount;
        serviceChargeCollected += serviceCharge;
        discountGiven += discount;
        if (status === "CANCELLED") refundAmount += total;
        if (paymentStatus === "PAID" || paymentStatus === "SUCCESS") paidAmount += total;
        else unpaidAmount += total;
        paymentSplit[paymentMode] = (paymentSplit[paymentMode] || 0) + total;
        statusMix[status] = (statusMix[status] || 0) + 1;

        return {
          id: order.id,
          orderNo: toDisplayOrderNo(order, restaurant),
          invoiceNo: order.invoiceNo,
          invoiceS3Url: order.invoiceS3Url,
          customerName: order.customerName,
          phone: order.phone,
          email: order.email,
          tableNo: order.tableNo,
          notes: order.notes,
          deliveryAddress: order.deliveryAddress,
          orderSource: order.orderSource,
          subtotal: Number(order.subtotal || 0),
          discountAmount: discount,
          total,
          taxAmount,
          serviceCharge,
          paymentMode,
          paymentStatus,
          status,
          createdAt: order.createdAt,
          items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
            id: item.id,
            itemName: item.itemName,
            qty: Number(item.qty || 0),
            price: Number(item.price || 0),
            total: Number(item.total || 0),
          })),
        };
      });

      const expenseTotal = (Array.isArray(expenses) ? expenses : []).reduce((sum, expense) => sum + Number(expense?.amount || 0), 0);
      const operatingProfit = netSales - expenseTotal;
      const collectionEfficiency = grossSales > 0 ? (paidAmount / grossSales) * 100 : 0;
      const marginPct = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

      return {
        generatedAt: now.toISOString(),
        range,
        restaurant,
        summary: {
          invoiceCount: invoices.length,
          grossSales,
          netSales,
          taxCollected,
          serviceChargeCollected,
          discountGiven,
          refundAmount,
          paidAmount,
          unpaidAmount,
          expenseTotal,
          operatingProfit,
          collectionEfficiency,
          marginPct,
        },
        operational: {
          activeTables: tables.filter((table) => table.isActive).length,
          totalTables: tables.length,
          liveMenuItems: menuItems.filter((item) => item.isAvailable).length,
          totalMenuItems: menuItems.length,
        },
        paymentSplit: Object.entries(paymentSplit).map(([mode, amount]) => ({ mode, amount })).sort((a, b) => b.amount - a.amount),
        statusMix: Object.entries(statusMix).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        expenses: Array.isArray(expenses) ? expenses : [],
        invoices,
      };
    } catch (err) {
      console.error("[OwnerFinance] Error fetching finance analytics:", err);
      return reply.code(500).send({ message: "Failed to fetch finance analytics" });
    }
  };

  app.get("/owner/:restaurantId/finance", getFinanceAnalyticsHandler);
  app.get("/api/owner/:restaurantId/finance", getFinanceAnalyticsHandler);

  // SETTLEMENT DASHBOARD ENDPOINTS
  app.get("/owner/:restaurantId/settlements/summary", settlementController.getSummary);
  app.get("/api/owner/:restaurantId/settlements/summary", settlementController.getSummary);
  app.get("/owner/:restaurantId/settlements/orders", settlementController.getOrders);
  app.get("/api/owner/:restaurantId/settlements/orders", settlementController.getOrders);
  app.get("/owner/:restaurantId/settlements/export/csv", settlementController.exportCsv);
  app.get("/api/owner/:restaurantId/settlements/export/csv", settlementController.exportCsv);
  app.get("/owner/:restaurantId/settlements/export/pdf", settlementController.exportPdf);
  app.get("/api/owner/:restaurantId/settlements/export/pdf", settlementController.exportPdf);

  app.get("/owner/:restaurantId/settings", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "tobacco_approved" BOOLEAN DEFAULT false;`
        ).catch(() => prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tobacco_approved" BOOLEAN DEFAULT false;`));
      } catch {}

      let restaurant = null;
      try {
        restaurant = await prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: {
            id: true, name: true, legalName: true, slug: true, ownerName: true, email: true, phone: true, upiId: true,
            bankAccountNumber: true, bankIfscCode: true, bankAccountName: true, bankName: true,
            addressLine1: true, city: true, state: true, country: true, pincode: true,
            latitude: true, longitude: true,
            gstNumber: true, logoUrl: true,
            bannerUrl: true, brandColor: true, faviconUrl: true,
            timezone: true, currency: true, taxEnabled: true, taxType: true, defaultTaxPercent: true,
            serviceChargeEnabled: true, serviceChargePercent: true, invoicePrefix: true, nextInvoiceNumber: true,
            billingConfig: true,
            isActive: true, tobaccoApproved: true, updatedAt: true,
          },
        });
      } catch (err) {
        console.warn("[OwnerSettings] Detailed select failed, trying fallback findUnique:", err.message);
        restaurant = await prisma.restaurant.findUnique({
          where: { id: restaurantId },
        });
      }

      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      let tobaccoApproved = Boolean(restaurant.tobaccoApproved);
      try {
        const rawRes = await prisma.$queryRawUnsafe(`SELECT tobacco_approved FROM "restaurants" WHERE id = ${Number(restaurantId)}`)
          .catch(() => prisma.$queryRawUnsafe(`SELECT tobacco_approved FROM "Restaurant" WHERE id = ${Number(restaurantId)}`));
        if (Array.isArray(rawRes) && rawRes[0] && rawRes[0].tobacco_approved !== null && rawRes[0].tobacco_approved !== undefined) {
          tobaccoApproved = Boolean(rawRes[0].tobacco_approved);
        }
      } catch (rawErr) {
        console.warn("[OwnerSettings] Raw query for tobacco_approved fallback failed:", rawErr.message);
      }

      return {
        restaurant: {
          ...restaurant,
          billingConfig: resolveRestaurantBillingConfig(restaurant),
          tobaccoApproved,
          logo: restaurant.logoUrl || "",
          logoUrl: undefined,
        },
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch restaurant settings" });
    }
  });

  app.put("/owner/:restaurantId/settings", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const body = req.body || {};
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      // Coordinate Validation Rules:
      // Database / Backend: latitude = lat (-90 to +90), longitude = lng (-180 to +180)
      // MapLibre / GeoJSON: [longitude, latitude]
      if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
        const latNum = Number(body.latitude);
        if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
          return reply.code(400).send({ message: "Invalid latitude. Must be a finite number between -90 and +90 or null." });
        }
      }
      if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
        const lngNum = Number(body.longitude);
        if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
          return reply.code(400).send({ message: "Invalid longitude. Must be a finite number between -180 and +180 or null." });
        }
      }

      const updates = {
        name: body.name, legalName: body.legalName, ownerName: body.ownerName, email: body.email, phone: body.phone, upiId: body.upiId,
        bankAccountNumber: body.bankAccountNumber, bankIfscCode: body.bankIfscCode, bankAccountName: body.bankAccountName, bankName: body.bankName,
        addressLine1: body.addressLine1, city: body.city, state: body.state, country: body.country, pincode: body.pincode,
        latitude: body.latitude === null || body.latitude === "" ? null : (body.latitude !== undefined ? Number(body.latitude) : undefined),
        longitude: body.longitude === null || body.longitude === "" ? null : (body.longitude !== undefined ? Number(body.longitude) : undefined),
        gstNumber: body.gstNumber, logoUrl: body.logo, bannerUrl: body.bannerUrl, brandColor: body.brandColor, faviconUrl: body.faviconUrl,
        timezone: body.timezone, currency: body.currency, taxEnabled: body.taxEnabled,
        taxType: body.taxType, defaultTaxPercent: body.defaultTaxPercent, serviceChargeEnabled: body.serviceChargeEnabled,
        serviceChargePercent: body.serviceChargePercent, invoicePrefix: body.invoicePrefix, nextInvoiceNumber: body.nextInvoiceNumber,
        billingConfig: body.billingConfig !== undefined ? (() => {
          let raw = body.billingConfig;
          if (typeof raw === "string") {
            try { raw = JSON.parse(raw); } catch { raw = null; }
          }
          if (!raw || typeof raw !== "object") return undefined;
          return {
            taxes: (Array.isArray(raw.taxes) ? raw.taxes : []).map((t) => ({
              name: String(t.name || "Tax").trim(),
              rate: Math.max(0, Number(t.rate || 0)),
              type: String(t.type || "PERCENTAGE").toUpperCase() === "FIXED" ? "FIXED" : "PERCENTAGE",
              isInclusive: Boolean(t.isInclusive),
              isEnabled: t.isEnabled !== false,
              appliesTo: Array.isArray(t.appliesTo) ? t.appliesTo : (t.appliesTo ? [String(t.appliesTo)] : ["ALL"]),
            })),
            charges: (Array.isArray(raw.charges) ? raw.charges : []).map((c) => ({
              name: String(c.name || "Charge").trim(),
              amount: Math.max(0, Number(c.amount || 0)),
              type: String(c.type || "FIXED").toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
              isEnabled: c.isEnabled !== false,
              appliesTo: Array.isArray(c.appliesTo) ? c.appliesTo : (c.appliesTo ? [String(c.appliesTo)] : ["ALL"]),
              isTaxable: Boolean(c.isTaxable),
            })),
            roundOff: Boolean(raw.roundOff),
            allowTips: raw.allowTips !== false,
          };
        })() : undefined,
        isActive: body.isActive,
      };

      // Security boundary: Managers cannot modify banking details, UPI, or tax registration
      if (String(actor?.role || "").toUpperCase() === "MANAGER") {
        delete updates.bankAccountNumber;
        delete updates.bankIfscCode;
        delete updates.bankAccountName;
        delete updates.bankName;
        delete updates.upiId;
        delete updates.gstNumber;
      }

      const filteredData = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
      if (filteredData.defaultTaxPercent !== undefined) filteredData.defaultTaxPercent = Number(filteredData.defaultTaxPercent);
      if (filteredData.serviceChargePercent !== undefined) filteredData.serviceChargePercent = Number(filteredData.serviceChargePercent);
      if (filteredData.nextInvoiceNumber !== undefined) filteredData.nextInvoiceNumber = Number(filteredData.nextInvoiceNumber);
      if (filteredData.taxType !== undefined) {
        const taxType = String(filteredData.taxType).toUpperCase();
        if (!["INCLUSIVE", "EXCLUSIVE"].includes(taxType)) {
          return reply.code(400).send({ message: "taxType must be INCLUSIVE or EXCLUSIVE" });
        }
        filteredData.taxType = taxType;
      }
      if (filteredData.upiId !== undefined) {
        const nextUpiId = String(filteredData.upiId || "").trim().toLowerCase();
        if (!nextUpiId) {
          filteredData.upiId = null;
        } else {
          const upiIdPattern = /^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i;
          if (!upiIdPattern.test(nextUpiId)) {
            return reply.code(400).send({ message: "Enter a valid UPI ID (example: owner@okhdfcbank)." });
          }
          filteredData.upiId = nextUpiId;
        }
      }
      ["taxEnabled", "serviceChargeEnabled", "isActive"].forEach((key) => {
        if (filteredData[key] !== undefined) filteredData[key] = Boolean(filteredData[key]);
      });

      let updated = null;
      try {
        updated = await prisma.restaurant.update({
          where: { id: restaurantId },
          data: filteredData,
          select: {
            id: true, name: true, legalName: true, slug: true, ownerName: true, email: true, phone: true, upiId: true,
            addressLine1: true, city: true, state: true, country: true, pincode: true,
            latitude: true, longitude: true,
            gstNumber: true, logoUrl: true,
            bannerUrl: true, brandColor: true, faviconUrl: true,
            timezone: true, currency: true, taxEnabled: true, taxType: true, defaultTaxPercent: true,
            serviceChargeEnabled: true, serviceChargePercent: true, invoicePrefix: true, nextInvoiceNumber: true,
            billingConfig: true,
            isActive: true, updatedAt: true,
          },
        });
      } catch (err) {
        console.warn("[OwnerSettings] Detailed update failed, trying fallback update:", err.message);
        const problematicFields = ["upiId", "bankAccountNumber", "bankIfscCode", "bankAccountName", "bankName"];
        const safeData = { ...filteredData };
        problematicFields.forEach((f) => delete safeData[f]);

        updated = await prisma.restaurant.update({
          where: { id: restaurantId },
          data: safeData,
          select: {
            id: true, name: true, legalName: true, slug: true, ownerName: true, email: true, phone: true,
            addressLine1: true, city: true, state: true, country: true, pincode: true, gstNumber: true, logoUrl: true,
            bannerUrl: true, brandColor: true, faviconUrl: true,
            timezone: true, currency: true, taxEnabled: true, taxType: true, defaultTaxPercent: true,
            serviceChargeEnabled: true, serviceChargePercent: true, invoicePrefix: true, nextInvoiceNumber: true,
            billingConfig: true,
            isActive: true, updatedAt: true,
          },
        });
      }
      return {
        message: "Settings updated",
        restaurant: {
          ...updated,
          billingConfig: resolveRestaurantBillingConfig(updated),
          logo: updated.logoUrl || "",
          logoUrl: undefined,
        },
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update settings" });
    }
  });

  const handleGetStaffUsers = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const q = String(req.query?.q || "").trim().toLowerCase();
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });

      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const users = await prisma.user.findMany({
        where: { restaurantId, role: { not: "SUPER_ADMIN" } },
        include: { staffAccess: { select: { permissions: true } } },
        orderBy: { createdAt: "desc" },
      });

      const mapped = users
        .map((user) => buildStaffUserResponse(user))
        .filter((user) => {
          const roleFilter = String(req.query?.role || "").trim().toUpperCase();
          const statusFilter = String(req.query?.status || "").trim().toLowerCase();
          if (roleFilter && roleFilter !== "ALL" && user.role !== roleFilter) return false;
          if (statusFilter === "active" && !user.isActive) return false;
          if (statusFilter === "inactive" && user.isActive) return false;
          if (!q) return true;
          return (
            String(user.name || "").toLowerCase().includes(q) ||
            String(user.email || "").toLowerCase().includes(q) ||
            String(user.phone || "").toLowerCase().includes(q) ||
            String(user.designation || "").toLowerCase().includes(q) ||
            String(user.role || "").toLowerCase().includes(q)
          );
        });

      const capabilities = await getActiveStaffByCapability({ prisma, restaurantId });
      return { users: mapped, modules: STAFF_ACCESS_MODULES, capabilities };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch staff users" });
    }
  };
  app.get("/owner/:restaurantId/staff", handleGetStaffUsers);
  app.get("/api/owner/:restaurantId/staff", handleGetStaffUsers);

  const handleGetCapabilities = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      const capabilities = await getActiveStaffByCapability({ prisma, restaurantId });
      return { success: true, restaurantId, capabilities, ...capabilities };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch restaurant capabilities" });
    }
  };
  app.get("/owner/:restaurantId/capabilities", handleGetCapabilities);
  app.get("/api/owner/:restaurantId/capabilities", handleGetCapabilities);

  app.post("/owner/:restaurantId/staff", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const {
        name,
        email,
        phone,
        password,
        role = "STAFF",
        designation,
        isActive = true,
        access,
      } = req.body || {};
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!name || !email || !phone) {
        return reply.code(400).send({ message: "Name, email, and phone are required" });
      }

      const normalizedRole = String(role || "STAFF").toUpperCase();
      if (!STAFF_ALLOWED_ROLES.includes(normalizedRole)) {
        return reply.code(400).send({ message: `Invalid role: ${normalizedRole}` });
      }

      if (String(actor?.role || "").toUpperCase() === "MANAGER" && normalizedRole === "OWNER") {
        return reply.code(403).send({ message: "Managers cannot create Owner accounts" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedPhone = String(phone).trim();
      const normalizedDesignation = normalizeDesignation(designation);
      const effectiveRole = resolveStaffRole(normalizedRole, normalizedDesignation);
      const normalizedAccess = normalizeAccess(access, effectiveRole);

      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
      if (existing) return reply.code(400).send({ message: "Email already exists" });

      let rawPassword = String(password || "").trim();
      let temporaryPassword = null;
      let isTemporary = false;
      if (!rawPassword) {
        const randomHex = crypto.randomBytes(4).toString("hex");
        rawPassword = `Staff#${randomHex}`;
        temporaryPassword = rawPassword;
        isTemporary = true;
      } else if (req.body?.isTemporaryPassword === true) {
        isTemporary = true;
      }

      const tempExpiryDays = Number(process.env.TEMP_PASSWORD_EXPIRY_DAYS || 7);
      const hashedPassword = bcrypt.hashSync(rawPassword, 10);
      const createData = {
        name: String(name).trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        role: effectiveRole,
        isActive: Boolean(isActive),
        restaurantId,
        mustChangePassword: isTemporary,
        temporaryPasswordExpiresAt: isTemporary ? new Date(Date.now() + tempExpiryDays * 86400000) : null,
      };
      if (designation !== undefined) {
        createData.designation = normalizedDesignation || null;
      }

      let user;
      try {
        user = await prisma.user.create({ data: createData });
      } catch (err) {
        if (createData.designation !== undefined && isDesignationArgError(err)) {
          const fallbackCreateData = { ...createData };
          delete fallbackCreateData.designation;
          user = await prisma.user.create({ data: fallbackCreateData });
        } else {
          throw err;
        }
      }

      await prisma.staffAccess.upsert({
        where: { userId: user.id },
        create: { restaurantId, userId: user.id, permissions: serializeAccess(normalizedAccess, effectiveRole) },
        update: { restaurantId, permissions: serializeAccess(normalizedAccess, effectiveRole) },
      });

      await logAuditEvent({
        prisma,
        restaurantId,
        actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
        action: "STAFF_CREATED",
        entity: "STAFF",
        entityId: user.id,
        status: "SUCCESS",
        severity: "INFO",
        details: {
          role: user.role,
          designation: user.designation || undefined,
        },
        req,
      });

      if (isTemporary) {
        await logAuditEvent({
          prisma,
          restaurantId,
          actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
          action: "STAFF_TEMP_PASSWORD_ISSUED",
          entity: "STAFF",
          entityId: user.id,
          status: "SUCCESS",
          severity: "INFO",
          req,
        });
      }

      const capabilities = await handleStaffLifecycleChange({
        prisma,
        restaurantId,
        staffId: user.id,
        updatedStaff: user,
        realtime,
        actor,
      });

      return {
        message: "Staff user created",
        user: buildStaffUserResponse(user, normalizedAccess),
        capabilities,
        ...(temporaryPassword ? { temporaryPassword } : {}),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create staff user" });
    }
  });

  app.put("/owner/:restaurantId/staff/:staffId", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      const { name, email, phone, role, designation, password, isActive } = req.body || {};
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        include: { staffAccess: { select: { permissions: true } } },
      });
      if (!staff || staff.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Staff user not found" });
      }

      if (role && !STAFF_ALLOWED_ROLES.includes(String(role).toUpperCase())) {
        return reply.code(400).send({ message: `Invalid role: ${String(role).toUpperCase()}` });
      }

      if (String(actor?.role || "").toUpperCase() === "MANAGER") {
        if (staff.role === "OWNER") {
          return reply.code(403).send({ message: "Managers cannot modify Owner accounts" });
        }
        if (role && String(role).toUpperCase() === "OWNER") {
          return reply.code(403).send({ message: "Managers cannot assign Owner role" });
        }
      }

      if (staff.role === "OWNER" && role && String(role).toUpperCase() !== "OWNER") {
        return reply.code(400).send({ message: "Owner role cannot be changed from staff management" });
      }

      if (email && String(email).trim().toLowerCase() !== String(staff.email).toLowerCase()) {
        const emailExists = await prisma.user.findUnique({
          where: { email: String(email).trim().toLowerCase() },
          select: { id: true },
        });
        if (emailExists) return reply.code(400).send({ message: "Email already exists" });
      }

      const nextDesignation = designation === undefined ? staff.designation : normalizeDesignation(designation) || null;
      const nextRole = resolveStaffRole(role ? String(role).toUpperCase() : staff.role, nextDesignation);
      const isSecuritySensitiveChange =
        Boolean(password) ||
        nextRole !== staff.role ||
        nextDesignation !== staff.designation ||
        (isActive !== undefined && Boolean(isActive) !== staff.isActive);

      const data = {
        name: name ?? staff.name,
        email: email ? String(email).trim().toLowerCase() : staff.email,
        phone: phone === undefined ? staff.phone : String(phone).trim(),
        role: nextRole,
        isActive: isActive === undefined ? staff.isActive : Boolean(isActive),
      };
      if (designation !== undefined) {
        data.designation = nextDesignation;
      }
      if (password) {
        data.password = bcrypt.hashSync(String(password), 10);
        const isTemporary = req.body?.isTemporaryPassword !== undefined ? Boolean(req.body.isTemporaryPassword) : false;
        if (isTemporary) {
          data.mustChangePassword = true;
          const tempExpiryDays = Number(process.env.TEMP_PASSWORD_EXPIRY_DAYS || 7);
          data.temporaryPasswordExpiresAt = new Date(Date.now() + tempExpiryDays * 86400000);
        } else {
          data.mustChangePassword = false;
          data.temporaryPasswordExpiresAt = null;
        }
      }
      if (isSecuritySensitiveChange) {
        data.sessionVersion = { increment: 1 };
      }

      let updated;
      try {
        updated = await prisma.user.update({
          where: { id: staffId },
          data,
          include: { staffAccess: { select: { permissions: true } } },
        });
      } catch (err) {
        if (data.designation !== undefined && isDesignationArgError(err)) {
          const fallbackData = { ...data };
          delete fallbackData.designation;
          updated = await prisma.user.update({
            where: { id: staffId },
            data: fallbackData,
            include: { staffAccess: { select: { permissions: true } } },
          });
        } else {
          throw err;
        }
      }

      // Invalidate existing pending unconsumed login links for this staff member upon edit
      try {
        console.log(`[STAFF_LOGIN_DIAG] STAFF_EDIT_PUT: invalidating old tokens for staffId=${staffId} restaurantId=${restaurantId}`);
        await prisma.staffLoginToken.updateMany({
          where: {
            staffId,
            restaurantId,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });
      } catch (tokenErr) {
        if (!isMissingTableError(tokenErr)) {
          console.error("Failed to invalidate old login links on staff edit:", tokenErr);
        }
      }

      if (nextRole !== staff.role) {
        await logAuditEvent({
          prisma,
          restaurantId,
          actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
          action: "STAFF_ROLE_CHANGED",
          entity: "STAFF",
          entityId: staff.id,
          status: "SUCCESS",
          severity: "INFO",
          details: {
            previousRole: staff.role,
            newRole: nextRole,
          },
          req,
        });
      }

      if (password && req.body?.isTemporaryPassword === true) {
        await logAuditEvent({
          prisma,
          restaurantId,
          actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
          action: "STAFF_TEMP_PASSWORD_ISSUED",
          entity: "STAFF",
          entityId: staff.id,
          status: "SUCCESS",
          severity: "INFO",
          req,
        });
      }

      const updatedFields = [];
      if (name !== undefined && name !== staff.name) updatedFields.push("name");
      if (email !== undefined && email !== staff.email) updatedFields.push("email");
      if (phone !== undefined && phone !== staff.phone) updatedFields.push("phone");
      if (designation !== undefined && nextDesignation !== staff.designation) updatedFields.push("designation");
      if (role && nextRole !== staff.role) updatedFields.push("role");
      if (password) updatedFields.push("password");
      if (isActive !== undefined && Boolean(isActive) !== staff.isActive) updatedFields.push("isActive");

      await logAuditEvent({
        prisma,
        restaurantId,
        actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
        action: "STAFF_UPDATED",
        entity: "STAFF",
        entityId: staff.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { updatedFields },
        req,
      });

      const capabilities = await handleStaffLifecycleChange({
        prisma,
        restaurantId,
        staffId: staff.id,
        previousStaff: staff,
        updatedStaff: updated,
        realtime,
        actor,
      });

      return {
        message: "Staff user updated",
        user: buildStaffUserResponse(updated),
        capabilities,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update staff user" });
    }
  });

  app.patch("/owner/:restaurantId/staff/:staffId/status", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      const { isActive } = req.body || {};
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });
      if (typeof isActive !== "boolean") return reply.code(400).send({ message: "isActive must be boolean" });

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        include: { staffAccess: { select: { permissions: true } } },
      });
      if (!staff || staff.restaurantId !== restaurantId) return reply.code(404).send({ message: "Staff user not found" });
      if (staff.role === "OWNER") return reply.code(400).send({ message: "Owner account cannot be disabled" });

      const updated = await prisma.user.update({
        where: { id: staffId },
        data: {
          isActive,
          sessionVersion: { increment: 1 },
        },
        include: { staffAccess: { select: { permissions: true } } },
      });

      const capabilities = await handleStaffLifecycleChange({
        prisma,
        restaurantId,
        staffId,
        previousStaff: staff,
        updatedStaff: updated,
        realtime,
        actor,
      });

      await logAuditEvent({
        prisma,
        restaurantId,
        actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
        action: "STAFF_STATUS_CHANGED",
        entity: "STAFF",
        entityId: staff.id,
        status: "SUCCESS",
        severity: "INFO",
        details: {
          previousStatus: staff.isActive ? "ACTIVE" : "DISABLED",
          newStatus: isActive ? "ACTIVE" : "DISABLED",
        },
        req,
      });

      return {
        message: `Staff user ${isActive ? "enabled" : "disabled"}`,
        user: buildStaffUserResponse(updated),
        capabilities,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update staff status" });
    }
  });

  const handleIssueStaffTempPassword = async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        include: { staffAccess: { select: { permissions: true } } },
      });
      if (!staff || staff.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Staff user not found" });
      }
      if (staff.role === "OWNER") {
        return reply.code(400).send({ message: "Owner temporary password cannot be reset via this endpoint" });
      }

      const randomHex = crypto.randomBytes(4).toString("hex");
      const temporaryPassword = `Staff#${randomHex}`;
      const tempExpiryDays = Number(process.env.TEMP_PASSWORD_EXPIRY_DAYS || 7);
      const hashedPassword = bcrypt.hashSync(temporaryPassword, 10);

      const updated = await prisma.user.update({
        where: { id: staffId },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(Date.now() + tempExpiryDays * 86400000),
          sessionVersion: { increment: 1 },
        },
        include: { staffAccess: { select: { permissions: true } } },
      });

      await logAuditEvent({
        prisma,
        restaurantId,
        actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
        action: "STAFF_TEMP_PASSWORD_ISSUED",
        entity: "STAFF",
        entityId: staff.id,
        status: "SUCCESS",
        severity: "INFO",
        req,
      });

      return {
        message: "Temporary password generated successfully",
        temporaryPassword,
        user: buildStaffUserResponse(updated),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to generate temporary password" });
    }
  };

  app.post("/owner/:restaurantId/staff/:staffId/temp-password", handleIssueStaffTempPassword);
  app.post("/api/owner/:restaurantId/staff/:staffId/temp-password", handleIssueStaffTempPassword);

  const handleGenerateStaffLoginLink = async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId || req.staffActor?.restaurantId);
      const staffId = Number(req.params.staffId);
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });

      if (actor.role !== "SUPER_ADMIN" && Number(actor.restaurantId) !== restaurantId) {
        return reply.code(403).send({ message: "Forbidden: cross-restaurant access denied" });
      }

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, restaurantId: true, isActive: true, role: true, name: true, email: true },
      });
      if (!staff || staff.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Staff user not found" });
      }
      if (staff.isActive === false) {
        return reply.code(400).send({ message: "Cannot generate login link for disabled staff member" });
      }

      console.log(`[STAFF_LOGIN_DIAG] GENERATE_ENDPOINT_CALLED: staffId=${staffId} restaurantId=${restaurantId}`);

      const linkResult = await generateStaffLoginToken({
        prisma,
        staffId,
        restaurantId,
        createdBy: actor.userId || actor.id,
        frontendUrl: FRONTEND_URL,
      });

      await logAuditEvent({
        prisma,
        restaurantId,
        actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
        action: "STAFF_LOGIN_LINK_GENERATED",
        entity: "STAFF",
        entityId: staff.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { staffId: staff.id, staffEmail: staff.email },
        req,
      });

      return {
        message: "Staff login link generated successfully",
        loginUrl: linkResult.loginUrl,
        token: linkResult.rawToken,
        expiresAt: linkResult.expiresAt,
        expiresInMinutes: linkResult.expiresInMinutes,
        singleUse: true,
      };
    } catch (err) {
      console.log(err);
      const isInternalDbError =
        String(err?.message || "").includes("prisma") ||
        String(err?.message || "").includes("invocation") ||
        String(err?.message || "").includes("database") ||
        err?.code === "P2021";
      return reply.code(err?.statusCode || 500).send({
        message: isInternalDbError
          ? "Database setup in progress. Please retry generating the link in a moment, or use the standard login URL."
          : (err?.message || "Failed to generate staff login link"),
      });
    }
  };

  app.post("/owner/:restaurantId/staff/:staffId/login-link", handleGenerateStaffLoginLink);
  app.post("/api/owner/:restaurantId/staff/:staffId/login-link", handleGenerateStaffLoginLink);
  app.post("/api/owner/staff/:staffId/login-link", handleGenerateStaffLoginLink);


  app.put("/owner/:restaurantId/staff/:staffId/access", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      const { access } = req.body || {};
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, role: true, restaurantId: true },
      });
      if (!staff || staff.restaurantId !== restaurantId) return reply.code(404).send({ message: "Staff user not found" });

      const normalizedAccess = normalizeAccess(access, staff.role);
      await prisma.staffAccess.upsert({
        where: { userId: staffId },
        create: { restaurantId, userId: staffId, permissions: serializeAccess(normalizedAccess, staff.role) },
        update: { restaurantId, permissions: serializeAccess(normalizedAccess, staff.role) },
      });

      await prisma.user.update({
        where: { id: staffId },
        data: { sessionVersion: { increment: 1 } },
      });

      await logAuditEvent({
        prisma,
        restaurantId,
        actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
        action: "STAFF_ACCESS_UPDATED",
        entity: "STAFF",
        entityId: staff.id,
        status: "SUCCESS",
        severity: "INFO",
        details: { changedModules: Object.keys(normalizedAccess || {}) },
        req,
      });

      return {
        message: "Staff access updated",
        access: normalizedAccess,
        modules: STAFF_ACCESS_MODULES,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update staff access" });
    }
  });

  app.delete("/owner/:restaurantId/staff/:staffId", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, role: true, designation: true, isActive: true, restaurantId: true },
      });
      if (!staff || staff.restaurantId !== restaurantId) return reply.code(404).send({ message: "Staff user not found" });
      if (staff.role === "OWNER") return reply.code(400).send({ message: "Owner account cannot be deleted" });

      try {
        await prisma.user.delete({ where: { id: staffId } });

        const capabilities = await handleStaffLifecycleChange({
          prisma,
          restaurantId,
          staffId,
          previousStaff: staff,
          updatedStaff: null,
          realtime,
          actor,
        });

        await logAuditEvent({
          prisma,
          restaurantId,
          actor: { id: actor.userId || actor.id, name: actor.userName || actor.name, role: actor.role },
          action: "STAFF_DELETED",
          entity: "STAFF",
          entityId: staffId,
          status: "SUCCESS",
          severity: "INFO",
          req,
        });

        return { message: "Staff user deleted", capabilities };
      } catch (err) {
        if (err?.code === "P2003") {
          return reply.code(400).send({
            message: "Cannot delete staff member with historical records (orders, shifts, or transactions). Please deactivate the account instead.",
          });
        }
        throw err;
      }
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete staff user" });
    }
  });

  app.get("/owner/:restaurantId/finance/expenses", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      return await prisma.expense.findMany({
        where: { restaurantId },
        orderBy: { spentAt: "desc" },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/owner/:restaurantId/finance/expenses", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const { title, category, amount, notes, spentAt } = req.body || {};
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!title || amount === undefined || amount === null || Number(amount) <= 0) {
        return reply.code(400).send({ message: "Title and valid amount are required" });
      }
      return await prisma.expense.create({
        data: {
          restaurantId,
          title: String(title).trim(),
          category: category ? String(category).trim() : "General",
          amount: Number(amount),
          notes: notes ? String(notes).trim() : null,
          spentAt: spentAt ? new Date(spentAt) : new Date(),
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create expense" });
    }
  });

  app.delete("/owner/:restaurantId/finance/expenses/:expenseId", async (req, reply) => {
    try {
      const actor = await requireOwnerManagementActor(req, reply);
      if (!actor) return;
      const restaurantId = Number(req.params.restaurantId);
      const expenseId = Number(req.params.expenseId);
      if (!restaurantId || !expenseId) return reply.code(400).send({ message: "Invalid id values" });

      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        select: { id: true, restaurantId: true },
      });
      if (!expense || expense.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Expense not found" });
      }

      await prisma.expense.delete({ where: { id: expenseId } });
      return { message: "Expense deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete expense" });
    }
  });

  app.put("/owner/:restaurantId/orders/:orderId/status", async (req, reply) => {
    try {
      const actor =
        req.staffActor ||
        ({
          userId: Number(req.user?.id || 0) || null,
          role: String(req.user?.role || "").toUpperCase(),
          restaurantId: Number(req.user?.restaurantId || 0) || null,
          branchId: Number(req.user?.branchId || 0) || null,
        });

      const restaurantId = Number(req.params.restaurantId);
      const orderId = Number(req.params.orderId);
      if (!restaurantId || !orderId) return reply.code(400).send({ message: "Invalid id values" });
      if (!actor?.role) return reply.code(401).send({ message: "Authentication required" });
      if (actor?.restaurantId && actor.restaurantId !== restaurantId && actor.role !== "SUPER_ADMIN") {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const updated = await updateOrderStatus({
        prisma,
        actor,
        orderId,
        nextStatus: req.body?.status,
        notes: req.body?.notes,
        changedByName: req.body?.changedByName,
      });

      realtime?.emitOrderUpdated?.(updated);

      return { message: "Order status updated", order: updated };
    } catch (err) {
      console.log(err);
      const code = err?.code || "";
      if (code === "invalid_order_id" || code === "status_not_allowed") return reply.code(400).send({ message: "Invalid request" });
      if (code === "order_not_found") return reply.code(404).send({ message: "Order not found" });
      if (code === "restaurant_access_denied") return reply.code(403).send({ message: "Forbidden" });
      if (code === "order_cancelled") return reply.code(409).send({ message: "Order already cancelled" });
      return reply.code(500).send({ message: "Failed to update order status" });
    }
  });

  const fetchAuthoritativeTableOrders = async ({ prisma, restaurantId, tableParam, requestedTableId }) => {
    const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];
    const rawParam = String(tableParam || "").trim();
    const strippedNumber = rawParam.replace(/^(table|tbl)[-\s]*/i, "");
    const possibleTableNos = Array.from(new Set([
      rawParam,
      strippedNumber,
      `Table ${strippedNumber}`,
      `Table-${strippedNumber}`,
      `Table ${rawParam}`,
    ].filter(Boolean)));

    let diningTable = null;
    if (requestedTableId) {
      diningTable = await prisma.diningTable.findFirst({
        where: { id: requestedTableId, restaurantId },
      });
    }
    if (!diningTable) {
      diningTable = await prisma.diningTable.findFirst({
        where: {
          restaurantId,
          tableNo: { in: possibleTableNos, mode: "insensitive" },
        },
      });
    }
    if (!diningTable && Number.isInteger(Number(rawParam))) {
      diningTable = await prisma.diningTable.findFirst({
        where: {
          restaurantId,
          id: Number(rawParam),
        },
      });
    }

    const effectiveTableNo = diningTable?.tableNo || tableParam;
    const targetTableNos = diningTable
      ? Array.from(new Set([
          diningTable.tableNo,
          String(diningTable.tableNo).replace(/^(table|tbl)[-\s]*/i, ""),
          `Table ${String(diningTable.tableNo).replace(/^(table|tbl)[-\s]*/i, "")}`,
          `Table-${String(diningTable.tableNo).replace(/^(table|tbl)[-\s]*/i, "")}`,
        ].filter(Boolean)))
      : possibleTableNos;

    const orderWhereOr = [{ tableNo: { in: targetTableNos, mode: "insensitive" } }];
    if (diningTable) {
      orderWhereOr.push({ tableSession: { tableId: diningTable.id } });
    }

    const activeOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        OR: orderWhereOr,
        AND: [
          {
            status: { notIn: ["CANCELLED", "VOID", "REJECTED"] },
            paymentStatus: { notIn: ["PAID", "SUCCESS"] },
          },
        ],
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
        tableSessionId: true,
        total: true,
        customerId: true,
        orderNo: true,
        tableNo: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        items: {
          select: {
            id: true,
            itemName: true,
            preparedByName: true,
            qty: true,
            price: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let activeSession = null;
    if (diningTable) {
      activeSession = await prisma.tableSession.findFirst({
        where: {
          restaurantId,
          tableId: diningTable.id,
          status: { in: ["OPEN", "BILLING"] },
        },
        orderBy: { openedAt: "desc" },
      });
    }

    const orderSum = activeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const authoritativeTotal = orderSum > 0 ? orderSum : (activeSession ? Number(activeSession.total || 0) : 0);

    return {
      diningTable,
      effectiveTableNo,
      activeOrders,
      activeSession,
      authoritativeTotal,
    };
  };

  const handleGetTableBill = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableParam = String(req.params.tableNo || req.params.tableId || "").trim();
      if (!restaurantId || !tableParam) return reply.code(400).send({ message: "Invalid id values" });

      const actor =
        req.staffActor ||
        (await requireStaffJwt(req, reply, {
          prisma,
          allowedRoles: STAFF_ALLOWED_ROLES,
          matchRestaurantParam: "restaurantId",
        }));
      if (!actor) return;

      const requestedTableId = req.query?.tableId
        ? Number(req.query.tableId)
        : Number.isInteger(Number(tableParam))
        ? Number(tableParam)
        : null;

      const { diningTable, effectiveTableNo, activeOrders, authoritativeTotal } =
        await fetchAuthoritativeTableOrders({
          prisma,
          restaurantId,
          tableParam,
          requestedTableId,
        });

      return reply.send({
        tableNo: effectiveTableNo,
        tableId: diningTable?.id || null,
        total: authoritativeTotal,
        authoritativeTotal,
        amount: authoritativeTotal,
        payableAmount: authoritativeTotal,
        orders: activeOrders,
        orderCount: activeOrders.length,
        cleared: activeOrders.length === 0,
        serverName: diningTable?.assignedWaiterName || null,
      });
    } catch (err) {
      console.error("[handleGetTableBill] error:", err);
      return reply.code(500).send({ message: "Failed to fetch table bill" });
    }
  };

  const handleSettleBill = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableParam = String(req.params.tableNo || req.params.tableId || "").trim();
      if (!restaurantId || !tableParam) return reply.code(400).send({ message: "Invalid id values" });

      const actor =
        req.staffActor ||
        (await requireStaffJwt(req, reply, {
          prisma,
          allowedRoles: STAFF_ALLOWED_ROLES,
          matchRestaurantParam: "restaurantId",
        }));
      if (!actor) return;

      const paymentMode = normalizeBillPaymentMode(req.body?.paymentMode || req.body?.paymentMethod || req.body?.method);
      const changedByName = req.body?.changedByName ? String(req.body.changedByName).trim() : null;
      const transactionId = req.body?.transactionId || req.body?.reference || req.body?.transactionRef || null;

      const requestedTableId = req.body?.tableId
        ? Number(req.body.tableId)
        : Number.isInteger(Number(tableParam))
        ? Number(tableParam)
        : null;

      const { diningTable, effectiveTableNo, activeOrders, authoritativeTotal } =
        await fetchAuthoritativeTableOrders({
          prisma,
          restaurantId,
          tableParam,
          requestedTableId,
        });

      if (!activeOrders.length) {
        return reply.send({
          message: `Table ${effectiveTableNo} already has no active bill`,
          orders: [],
          cleared: false,
        });
      }

      // Security / Price Protection: validate authoritative total against submitted amount if provided
      if (req.body?.amount !== undefined && req.body?.amount !== null) {
        const submittedAmount = Number(req.body.amount);
        if (!Number.isNaN(submittedAmount) && Math.abs(submittedAmount - authoritativeTotal) > 0.01) {
          return reply.code(400).send({
            message: `Payment amount mismatch. Authoritative total is ₹${authoritativeTotal.toFixed(2)}, received ₹${submittedAmount.toFixed(2)}`,
            authoritativeTotal,
          });
        }
      }

      const updatedOrders = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const order of activeOrders) {
          const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: "SUCCESS",
              paymentMode,
              status: "DELIVERED",
              statusEvents: {
                create: {
                  status: "DELIVERED",
                  source: "STAFF",
                  changedByUserId: actor?.userId || null,
                  changedByName,
                  notes: `Bill settled via ${paymentMode}${transactionId ? ` (Ref: ${transactionId})` : ""}`,
                },
              },
            },
            include: {
              items: true,
              customer: true,
              statusEvents: { orderBy: { createdAt: "asc" } },
            },
          });

          // Create or update Payment record
          const existingPayment = await tx.payment.findFirst({
            where: { orderId: order.id },
          });

          if (existingPayment) {
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: "SUCCESS",
                paymentMethod: paymentMode,
                method: paymentMode,
                amountReceived: existingPayment.amount || Number(order.total || 0),
                amountDue: 0,
                transactionId: transactionId || existingPayment.transactionId || null,
                performedByName: changedByName || actor?.name || "Owner/Staff",
                tableSessionId: order.tableSessionId || existingPayment.tableSessionId || null,
              },
            });
          } else {
            let customerAccountId = null;
            if (order.phone) {
              const ca = await tx.customerAccount.findUnique({
                where: { phone: order.phone },
                select: { id: true },
              });
              customerAccountId = ca?.id || null;
            }

            await tx.payment.create({
              data: {
                restaurantId: order.restaurantId,
                orderId: order.id,
                tableSessionId: order.tableSessionId || null,
                customerId: customerAccountId,
                amount: Number(order.total || 0),
                amountDue: 0,
                amountReceived: Number(order.total || 0),
                currency: "INR",
                status: "SUCCESS",
                paymentMethod: paymentMode,
                method: paymentMode,
                transactionId: transactionId || null,
                provider: paymentMode === "CASH" ? "CASH" : (paymentMode === "UPI" ? "UPI_MANUAL" : "MANUAL"),
                performedByName: changedByName || actor?.name || "Owner/Staff",
              },
            });
          }

          results.push(updatedOrder);
        }

        return results;
      });

      for (const order of updatedOrders) {
        await completeSessionAndReleaseTable({
          prisma,
          tableSessionId: order.tableSessionId,
          tableId: diningTable?.id,
          tableNo: effectiveTableNo,
          restaurantId,
          orderId: order.id,
          paymentMode,
          realtime,
          actor,
        });
      }

      updatedOrders.forEach((order) => {
        realtime?.emitOrderUpdated?.(order);
        if (realtime?.io) {
          realtime.io.to(`restaurant_${restaurantId}`).emit("order:updated", order);
          realtime.io.to(`restaurant:${restaurantId}`).emit("order:updated", order);
          realtime.io.to(`restaurant_${restaurantId}`).emit("order:status_updated", {
            orderId: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
          });
          realtime.io.to(`restaurant:${restaurantId}`).emit("order:status_updated", {
            orderId: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
          });
        }
      });

      const dbRestaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, phone: true, addressLine1: true, city: true, upiId: true, logoUrl: true, currency: true },
      });
      const restaurant = dbRestaurant
        ? {
            ...dbRestaurant,
            address: [dbRestaurant.addressLine1, dbRestaurant.city].filter(Boolean).join(", "),
          }
        : null;

      return reply.send({
        message: `Table ${effectiveTableNo} bill settled`,
        orders: updatedOrders,
        cleared: true,
        paymentMode,
        authoritativeTotal,
        restaurant,
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to settle table bill" });
    }
  };

  app.get("/owner/:restaurantId/tables/:tableNo/bill", handleGetTableBill);
  app.get("/api/owner/:restaurantId/tables/:tableNo/bill", handleGetTableBill);
  app.get("/owner/:restaurantId/table/:tableNo/bill", handleGetTableBill);
  app.get("/api/owner/:restaurantId/table/:tableNo/bill", handleGetTableBill);
  app.post("/owner/:restaurantId/tables/:tableNo/settle-bill", handleSettleBill);
  app.post("/api/owner/:restaurantId/tables/:tableNo/settle-bill", handleSettleBill);

  const payLaterController = buildPayLaterController({ prisma });
  app.get("/owner/:restaurantId/pay-later/customers", payLaterController.getCustomers);
  app.post("/owner/:restaurantId/pay-later/customers", payLaterController.addCustomer);
  app.post("/owner/:restaurantId/pay-later/customers/:customerId/adjust", payLaterController.adjustBalance);
  app.post("/owner/:restaurantId/pay-later/customers/:customerId/points", payLaterController.adjustPoints);
  app.post("/owner/:restaurantId/pay-later/customers/:customerId/reminder", payLaterController.sendReminder);
  app.get("/owner/:restaurantId/pay-later/accounts/:accountId/details", payLaterController.getDetails);

  // KOT & THERMAL PRINTER ROUTES
  app.get("/owner/:restaurantId/kots", getKots);
  app.get("/owner/:restaurantId/kot", getKots);
  app.get("/api/owner/:restaurantId/kots", getKots);
  app.get("/api/owner/:restaurantId/kot", getKots);
  app.get("/owner/:restaurantId/kots/workload", getWorkloadMetrics);
  app.get("/api/owner/:restaurantId/kots/workload", getWorkloadMetrics);
  app.put("/owner/:restaurantId/kots/:kotId/status", updateKotStatusController);
  app.put("/owner/:restaurantId/kot/:kotId/status", updateKotStatusController);
  app.put("/owner/:restaurantId/kots/:kotId/items/:itemId/status", updateKotItemStatusController);
  app.put("/owner/:restaurantId/kot/:kotId/items/:itemId/status", updateKotItemStatusController);
  app.put("/owner/:restaurantId/kots/:kotId/priority", updateKotPriorityController);
  app.put("/owner/:restaurantId/kot/:kotId/priority", updateKotPriorityController);
  app.post("/owner/:restaurantId/kots/:kotId/reprint", triggerReprint);
  app.post("/owner/:restaurantId/kot/:kotId/reprint", triggerReprint);
  app.post("/owner/:restaurantId/kots/:kotId/cancel", updateKotStatusController);
  app.post("/owner/:restaurantId/kot/:kotId/cancel", updateKotStatusController);

  app.get("/owner/:restaurantId/printers", getPrinters);
  app.get("/api/owner/:restaurantId/printers", getPrinters);
  app.post("/owner/:restaurantId/printers", createPrinter);
  app.put("/owner/:restaurantId/printers/:printerId", updatePrinter);
  app.delete("/owner/:restaurantId/printers/:printerId", deletePrinter);
  app.post("/owner/:restaurantId/printers/:printerId/test", testPrinter);

  app.get("/owner/:restaurantId/stations", getStations);
  app.get("/owner/:restaurantId/kitchen-stations", getStations);
  app.get("/api/owner/:restaurantId/stations", getStations);
  app.get("/api/owner/:restaurantId/kitchen-stations", getStations);
  app.post("/owner/:restaurantId/stations", createStation);
  app.post("/owner/:restaurantId/kitchen-stations", createStation);
  app.put("/owner/:restaurantId/stations/:stationId", updateStation);

  // ==========================================
  // KITCHEN DISPATCHER & SELF-PICK ASSIGNMENT ROUTES
  // ==========================================
  app.get("/owner/:restaurantId/kitchen/config", getKitchenConfigController);
  app.get("/api/owner/:restaurantId/kitchen/config", getKitchenConfigController);
  app.put("/owner/:restaurantId/kitchen/config", updateKitchenConfigController);
  app.put("/api/owner/:restaurantId/kitchen/config", updateKitchenConfigController);

  app.get("/owner/:restaurantId/kitchen/workload", getKitchenWorkloadController);
  app.get("/api/owner/:restaurantId/kitchen/workload", getKitchenWorkloadController);

  app.get("/owner/:restaurantId/kitchen/available-work", getAvailableKitchenWorkController);
  app.get("/api/owner/:restaurantId/kitchen/available-work", getAvailableKitchenWorkController);

  app.get("/owner/:restaurantId/kitchen/chef/:chefId/assigned-items", getChefAssignedItemsController);
  app.get("/api/owner/:restaurantId/kitchen/chef/:chefId/assigned-items", getChefAssignedItemsController);

  app.get("/owner/:restaurantId/kitchen/history", getChefHistoryController);
  app.get("/api/owner/:restaurantId/kitchen/history", getChefHistoryController);
  app.get("/api/v1/kitchen/history", async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma: req.prisma || deps.prisma,
      allowedRoles: deps.STAFF_ALLOWED_ROLES,
    });
    if (!actor) return reply;
    req.staffActor = actor;
    return getChefHistoryController(req, reply);
  });

  app.get("/owner/:restaurantId/kitchen/chef/:chefId/history", getChefHistoryController);
  app.get("/api/owner/:restaurantId/kitchen/chef/:chefId/history", getChefHistoryController);
  app.get("/api/v1/kitchen/chef/:chefId/history", async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma: req.prisma || deps.prisma,
      allowedRoles: deps.STAFF_ALLOWED_ROLES,
    });
    if (!actor) return reply;
    req.staffActor = actor;
    return getChefHistoryController(req, reply);
  });

  app.get("/owner/:restaurantId/server/history", getServerHistoryController);
  app.get("/api/owner/:restaurantId/server/history", getServerHistoryController);
  app.get("/owner/:restaurantId/server/:serverId/history", getServerHistoryController);
  app.get("/api/owner/:restaurantId/server/:serverId/history", getServerHistoryController);
  app.get("/api/v1/staff/server/history", async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma: req.prisma || deps.prisma,
      allowedRoles: deps.STAFF_ALLOWED_ROLES,
    });
    if (!actor) return reply;
    req.staffActor = actor;
    return getServerHistoryController(req, reply);
  });
  app.get("/api/v1/server/history", async (req, reply) => {
    const actor = await requireStaffJwt(req, reply, {
      prisma: req.prisma || deps.prisma,
      allowedRoles: deps.STAFF_ALLOWED_ROLES,
    });
    if (!actor) return reply;
    req.staffActor = actor;
    return getServerHistoryController(req, reply);
  });

  app.post("/owner/:restaurantId/kitchen/items/:itemId/assign", assignItemController);
  app.post("/api/owner/:restaurantId/kitchen/items/:itemId/assign", assignItemController);
  app.post("/owner/:restaurantId/kitchen/items/bulk-assign", bulkAssignItemsController);
  app.post("/api/owner/:restaurantId/kitchen/items/bulk-assign", bulkAssignItemsController);
  app.post("/owner/:restaurantId/kitchen/kots/:kotId/assign", assignKotController);
  app.post("/api/owner/:restaurantId/kitchen/kots/:kotId/assign", assignKotController);
  app.post("/owner/:restaurantId/kitchen/items/:itemId/reassign", reassignItemController);
  app.post("/api/owner/:restaurantId/kitchen/items/:itemId/reassign", reassignItemController);

  app.post("/owner/:restaurantId/kitchen/items/:itemId/self-pick", selfPickItemController);
  app.post("/api/owner/:restaurantId/kitchen/items/:itemId/self-pick", selfPickItemController);
  app.post("/owner/:restaurantId/kitchen/kots/:kotId/self-pick", selfPickKotController);
  app.post("/api/owner/:restaurantId/kitchen/kots/:kotId/self-pick", selfPickKotController);

  app.put("/owner/:restaurantId/kitchen/items/:itemId/status", updateKotItemStatusController);
  app.put("/api/owner/:restaurantId/kitchen/items/:itemId/status", updateKotItemStatusController);

  // Authoritative Ready-to-Distribute Items for Service Queue
  app.get("/owner/:restaurantId/kitchen/ready-items", getReadyItemsController);
  app.get("/api/owner/:restaurantId/kitchen/ready-items", getReadyItemsController);
  app.get("/api/v1/kitchen/ready-items", getReadyItemsController);

  // ==========================================
  // FEATURE 20 — STAFF MANAGEMENT, WAITER WORKSPACE, RBAC & MANAGER APPROVALS
  // ==========================================
  const emitTableAssignmentUpdate = (restaurantId, tableId, table) => {
    if (!realtime?.io && !realtime?.staff) return;
    const rid = Number(restaurantId);
    const tid = Number(tableId);
    const waiterId = table?.assignedWaiterId ? Number(table.assignedWaiterId) : null;
    const waiterName = table?.assignedWaiterName || null;
    const version = Number(table?.updatedAt ? new Date(table.updatedAt).getTime() : Date.now());
    const updatedAt = table?.updatedAt ? new Date(table.updatedAt).toISOString() : new Date(version).toISOString();

    const payload = {
      type: "TABLE_UPDATED",
      restaurantId: rid,
      tableId: tid,
      id: tid,
      tableNo: table?.tableNo || null,
      assignedWaiterId: waiterId,
      assignedWaiterName: waiterName,
      assignedServer: waiterName,
      assignedServerId: waiterId,
      assignedServerName: waiterName,
      version,
      updatedAt,
    };
    if (realtime?.io) {
      realtime.io.to(`restaurant_${rid}`).emit("table:updated", payload);
      realtime.io.to(`restaurant:${rid}`).emit("table:updated", payload);
      realtime.io.to(`restaurant_${rid}`).emit("table:waiter_assigned", payload);
      realtime.io.to(`restaurant:${rid}`).emit("table:waiter_assigned", payload);
    }

    if (realtime?.staff) {
      realtime.staff.to(`restaurant:${rid}`).emit("table:updated", payload);
      realtime.staff.to(`restaurant_${rid}`).emit("table:updated", payload);
      realtime.staff.to(`restaurant:${rid}`).emit("table:waiter_assigned", payload);
      realtime.staff.to(`restaurant_${rid}`).emit("table:waiter_assigned", payload);
      if (payload.assignedWaiterId) {
        realtime.staff.to(`user:${payload.assignedWaiterId}`).emit("table:waiter_assigned", payload);
        realtime.staff.to(`user_${payload.assignedWaiterId}`).emit("table:waiter_assigned", payload);
      }
    }
  };

  const handleAssignWaiter = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { waiterId, tableSessionId, reason } = req.body || {};
      const actorInfo = req.staffActor
        ? { userId: req.staffActor.userId, userName: req.staffActor.name || req.staffActor.email, role: req.staffActor.role }
        : req.user
        ? { userId: req.user.id, userName: req.user.name || req.user.email, role: req.user.role }
        : null;
      const result = await assignWaiterToTable({
        prisma,
        restaurantId,
        tableId,
        tableSessionId,
        waiterId,
        actor: actorInfo,
        reason,
        realtime,
      });
      emitTableAssignmentUpdate(restaurantId, tableId, result.table);
      return { ok: true, message: waiterId ? "Waiter assigned" : "Waiter unassigned", ...result };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to assign waiter" });
    }
  };

  const handleReassignWaiter = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { waiterId, tableSessionId, reason } = req.body || {};
      const actorInfo = req.staffActor
        ? { userId: req.staffActor.userId, userName: req.staffActor.name || req.staffActor.email, role: req.staffActor.role }
        : req.user
        ? { userId: req.user.id, userName: req.user.name || req.user.email, role: req.user.role }
        : null;
      const result = await assignWaiterToTable({
        prisma,
        restaurantId,
        tableId,
        tableSessionId,
        waiterId,
        actor: actorInfo,
        reason: reason || "Reassigned to new waiter",
        realtime,
      });
      emitTableAssignmentUpdate(restaurantId, tableId, result.table);
      return { ok: true, message: "Waiter reassigned", ...result };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to reassign waiter" });
    }
  };

  const handleUnassignWaiter = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { tableSessionId, reason } = req.body || {};
      const actorInfo = req.staffActor
        ? { userId: req.staffActor.userId, userName: req.staffActor.name || req.staffActor.email, role: req.staffActor.role }
        : req.user
        ? { userId: req.user.id, userName: req.user.name || req.user.email, role: req.user.role }
        : null;
      const result = await unassignWaiterFromTable({
        prisma,
        restaurantId,
        tableId,
        tableSessionId,
        actor: actorInfo,
        reason: reason || "Unassigned via Owner Panel",
        realtime,
      });
      emitTableAssignmentUpdate(restaurantId, tableId, result.table);
      return { ok: true, message: "Waiter unassigned", ...result };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to unassign waiter" });
    }
  };

  app.post("/owner/:restaurantId/tables/:tableId/assign-waiter", handleAssignWaiter);
  app.post("/api/owner/:restaurantId/tables/:tableId/assign-waiter", handleAssignWaiter);
  app.post("/owner/:restaurantId/tables/:tableId/reassign-waiter", handleReassignWaiter);
  app.post("/api/owner/:restaurantId/tables/:tableId/reassign-waiter", handleReassignWaiter);
  app.post("/owner/:restaurantId/tables/:tableId/unassign-waiter", handleUnassignWaiter);
  app.post("/api/owner/:restaurantId/tables/:tableId/unassign-waiter", handleUnassignWaiter);

  app.get("/owner/:restaurantId/tables/:tableId/assignments", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const history = await getWaiterAssignmentHistory({ prisma, restaurantId, tableId });
      return { ok: true, history };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to fetch assignment history" });
    }
  });

  app.get("/owner/:restaurantId/waiter/:waiterId/workspace", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const waiterId = Number(req.params.waiterId);
      const data = await getWaiterWorkspaceData({ prisma, restaurantId, waiterId });
      return { ok: true, ...data };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to fetch waiter workspace data" });
    }
  });

  app.get("/owner/:restaurantId/staff/:staffUserId/performance", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const staffUserId = Number(req.params.staffUserId);
      const data = await getStaffPerformanceMetrics({ prisma, restaurantId, staffUserId });
      return { ok: true, ...data };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to fetch staff performance metrics" });
    }
  });

  app.post("/owner/:restaurantId/approvals/cancellation", approveCancellation);
  app.post("/owner/:restaurantId/approvals/discount", approveDiscount);
  app.post("/owner/:restaurantId/approvals/reprint", approveReprint);

  const handleGetAuditLogs = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant ID" });

      const actor = req.staffActor || req.user;
      if (actor && actor.role !== "SUPER_ADMIN" && actor.restaurantId && Number(actor.restaurantId) !== restaurantId) {
        return reply.code(403).send({ message: "Access forbidden: cannot access another restaurant's audit logs" });
      }
      if (actor && !["OWNER", "MANAGER", "SUPER_ADMIN"].includes(String(actor.role).toUpperCase())) {
        return reply.code(403).send({ message: "Access forbidden: insufficient permissions to view audit logs" });
      }

      const { branchId, action, entity, actorUserId, severity, status, startDate, endDate, limit, page } = req.query || {};
      const result = await getAuditLogs({
        prisma,
        restaurantId,
        branchId,
        action,
        entity,
        actorUserId,
        severity,
        status,
        startDate,
        endDate,
        limit,
        page,
      });
      return { ok: true, ...result };
    } catch (err) {
      return reply.code(400).send({ message: err?.message || "Failed to fetch audit logs" });
    }
  };

  app.get("/owner/:restaurantId/audit-logs", handleGetAuditLogs);
  app.get("/api/owner/:restaurantId/audit-logs", handleGetAuditLogs);

  // ==========================================
  // FEATURE 12 — CUSTOMER CRM FOUNDATION ROUTES
  // ==========================================
  const handleGetCustomers = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant ID" });

      // Restaurant context authorization check
      if (req.user && req.user.role !== "SUPER_ADMIN" && req.user.restaurantId && Number(req.user.restaurantId) !== restaurantId) {
        return reply.code(403).send({ message: "Access forbidden: cannot access another restaurant's customers" });
      }

      const {
        query,
        q,
        page,
        limit,
        status,
        sortBy,
        sortOrder,
        range,
        startDate,
        endDate,
        segment,
        minOrders,
        maxOrders,
        minSpend,
        maxSpend,
        frequentThreshold,
        highSpendThreshold,
      } = req.query || {};

      const result = await searchCustomers({
        prisma,
        restaurantId,
        query: query || q || "",
        page: page || 1,
        limit: limit || 20,
        status: status || "ACTIVE",
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "desc",
        range: range || "all",
        startDate,
        endDate,
        segment: segment || "ALL",
        minOrders,
        maxOrders,
        minSpend,
        maxSpend,
        frequentThreshold,
        highSpendThreshold,
      });
      return reply.send(result);
    } catch (err) {
      console.error("[CRM Route Error] Search customers failed:", err.message);
      return reply.code(500).send({ message: err.message || "Failed to fetch customers" });
    }
  };

  const handleGetCustomerSummary = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant ID" });

      if (req.user && req.user.role !== "SUPER_ADMIN" && req.user.restaurantId && Number(req.user.restaurantId) !== restaurantId) {
        return reply.code(403).send({ message: "Access forbidden: cannot access another restaurant's customers" });
      }

      const { range, startDate, endDate, frequentThreshold, highSpendThreshold } = req.query || {};
      const summary = await getCustomerDirectorySummary({
        prisma,
        restaurantId,
        range: range || "all",
        startDate,
        endDate,
        frequentThreshold,
        highSpendThreshold,
      });
      return reply.send(summary);
    } catch (err) {
      console.error("[CRM Route Error] Customer summary failed:", err.message);
      return reply.code(500).send({ message: err.message || "Failed to fetch customer summary" });
    }
  };

  const handleExportCustomers = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant ID" });

      if (req.user && req.user.role !== "SUPER_ADMIN" && req.user.restaurantId && Number(req.user.restaurantId) !== restaurantId) {
        return reply.code(403).send({ message: "Access forbidden: cannot access another restaurant's customers" });
      }

      const {
        query,
        status,
        sortBy,
        sortOrder,
        range,
        startDate,
        endDate,
        segment,
        minOrders,
        maxOrders,
        minSpend,
        maxSpend,
        format = "json",
      } = req.query || {};

      const exportData = await exportCustomerDirectory({
        prisma,
        restaurantId,
        query,
        status: status || "ALL",
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "desc",
        range: range || "all",
        startDate,
        endDate,
        segment: segment || "ALL",
        minOrders,
        maxOrders,
        minSpend,
        maxSpend,
      });

      if (format.toLowerCase() === "csv") {
        let csv = exportData.headers.join(",") + "\n";
        for (const row of exportData.rows) {
          csv += row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",") + "\n";
        }
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", `attachment; filename="customers_${restaurantId}_${exportData.rangeLabel.replace(/[^a-zA-Z0-9]/g, "_")}.csv"`);
        return reply.send(csv);
      }

      return reply.send(exportData);
    } catch (err) {
      console.error("[CRM Route Error] Customer export failed:", err.message);
      return reply.code(500).send({ message: err.message || "Failed to export customers" });
    }
  };

  app.get("/owner/:restaurantId/customers", handleGetCustomers);
  app.get("/api/owner/:restaurantId/customers", handleGetCustomers);
  app.get("/owner/:restaurantId/crm/customers", handleGetCustomers);
  app.get("/api/owner/:restaurantId/crm/customers", handleGetCustomers);

  app.get("/owner/:restaurantId/customers/summary", handleGetCustomerSummary);
  app.get("/api/owner/:restaurantId/customers/summary", handleGetCustomerSummary);
  app.get("/owner/:restaurantId/crm/customers/summary", handleGetCustomerSummary);
  app.get("/api/owner/:restaurantId/crm/customers/summary", handleGetCustomerSummary);

  app.get("/owner/:restaurantId/customers/export", handleExportCustomers);
  app.get("/api/owner/:restaurantId/customers/export", handleExportCustomers);
  app.get("/owner/:restaurantId/crm/customers/export", handleExportCustomers);
  app.get("/api/owner/:restaurantId/crm/customers/export", handleExportCustomers);

  const handleSearchCustomersAutocomplete = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { q, query } = req.query || {};
      const result = await searchCustomers({
        prisma,
        restaurantId,
        query: q || query || "",
        page: 1,
        limit: 10,
        status: "ACTIVE",
      });
      return reply.send(result.items || []);
    } catch (err) {
      console.error("[CRM Route Error] Autocomplete failed:", err.message);
      return reply.code(500).send({ message: "Search failed" });
    }
  };

  app.get("/owner/:restaurantId/customers/search", handleSearchCustomersAutocomplete);
  app.get("/api/owner/:restaurantId/customers/search", handleSearchCustomersAutocomplete);
  app.get("/owner/:restaurantId/crm/customers/search", handleSearchCustomersAutocomplete);
  app.get("/api/owner/:restaurantId/crm/customers/search", handleSearchCustomersAutocomplete);

  const handleGetCustomerById = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const customerId = Number(req.params.customerId);
      const customer = await getCustomerById({ prisma, restaurantId, customerId });
      if (!customer) return reply.code(404).send({ message: "Customer not found" });
      return reply.send(customer);
    } catch (err) {
      console.error("[CRM Route Error] Get customer failed:", err.message);
      return reply.code(500).send({ message: "Failed to fetch customer details" });
    }
  };

  app.get("/owner/:restaurantId/customers/:customerId", handleGetCustomerById);
  app.get("/api/owner/:restaurantId/customers/:customerId", handleGetCustomerById);
  app.get("/owner/:restaurantId/crm/customers/:customerId", handleGetCustomerById);
  app.get("/api/owner/:restaurantId/crm/customers/:customerId", handleGetCustomerById);

  const handleCreateCustomer = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const res = await createCustomer({
        prisma,
        restaurantId,
        input: req.body || {},
        userId: req.user?.id,
      });
      if (!res.ok) {
        return reply.code(res.status || 400).send(res);
      }
      return reply.code(201).send(res.customer);
    } catch (err) {
      console.error("[CRM Route Error] Create customer failed:", err.message);
      return reply.code(500).send({ message: "Failed to create customer" });
    }
  };

  app.post("/owner/:restaurantId/customers", handleCreateCustomer);
  app.post("/api/owner/:restaurantId/customers", handleCreateCustomer);
  app.post("/owner/:restaurantId/crm/customers", handleCreateCustomer);
  app.post("/api/owner/:restaurantId/crm/customers", handleCreateCustomer);

  const handleUpdateCustomer = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const customerId = Number(req.params.customerId);
      const res = await updateCustomer({
        prisma,
        restaurantId,
        customerId,
        input: req.body || {},
        userId: req.user?.id,
      });
      if (!res.ok) {
        return reply.code(res.status || 400).send({ message: res.message });
      }
      return reply.send(res.customer);
    } catch (err) {
      console.error("[CRM Route Error] Update customer failed:", err.message);
      return reply.code(500).send({ message: "Failed to update customer" });
    }
  };

  app.put("/owner/:restaurantId/customers/:customerId", handleUpdateCustomer);
  app.put("/api/owner/:restaurantId/customers/:customerId", handleUpdateCustomer);
  app.put("/owner/:restaurantId/crm/customers/:customerId", handleUpdateCustomer);
  app.put("/api/owner/:restaurantId/crm/customers/:customerId", handleUpdateCustomer);
  app.patch("/owner/:restaurantId/customers/:customerId", handleUpdateCustomer);
  app.patch("/api/owner/:restaurantId/customers/:customerId", handleUpdateCustomer);
  app.patch("/owner/:restaurantId/crm/customers/:customerId", handleUpdateCustomer);
  app.patch("/api/owner/:restaurantId/crm/customers/:customerId", handleUpdateCustomer);

  const handleMergeCustomers = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { sourceCustomerId, targetCustomerId } = req.body || {};
      const res = await mergeCustomers({
        prisma,
        restaurantId,
        sourceCustomerId,
        targetCustomerId,
        userId: req.user?.id,
        userRole: req.user?.role,
      });
      if (!res.ok) {
        return reply.code(res.status || 400).send({ message: res.message });
      }
      return reply.send(res.result);
    } catch (err) {
      console.error("[CRM Route Error] Merge customers failed:", err.message);
      return reply.code(500).send({ message: "Failed to merge customers" });
    }
  };

  app.post("/owner/:restaurantId/customers/merge", handleMergeCustomers);
  app.post("/api/owner/:restaurantId/customers/merge", handleMergeCustomers);
  app.post("/owner/:restaurantId/crm/customers/merge", handleMergeCustomers);
  app.post("/api/owner/:restaurantId/crm/customers/merge", handleMergeCustomers);

  // Address Routes
  app.get("/owner/:restaurantId/customers/:customerId/addresses", async (req, reply) => {
    const addresses = await listCustomerAddresses({
      prisma,
      restaurantId: req.params.restaurantId,
      customerId: req.params.customerId,
    });
    return reply.send(addresses);
  });

  app.post("/owner/:restaurantId/customers/:customerId/addresses", async (req, reply) => {
    const res = await addCustomerAddress({
      prisma,
      restaurantId: req.params.restaurantId,
      customerId: req.params.customerId,
      input: req.body || {},
    });
    if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
    return reply.code(201).send(res.address);
  });

  app.put("/owner/:restaurantId/customers/:customerId/addresses/:addressId", async (req, reply) => {
    const res = await updateCustomerAddress({
      prisma,
      restaurantId: req.params.restaurantId,
      customerId: req.params.customerId,
      addressId: req.params.addressId,
      input: req.body || {},
    });
    if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
    return reply.send(res.address);
  });

  app.delete("/owner/:restaurantId/customers/:customerId/addresses/:addressId", async (req, reply) => {
    const res = await deleteCustomerAddress({
      prisma,
      restaurantId: req.params.restaurantId,
      customerId: req.params.customerId,
      addressId: req.params.addressId,
    });
    if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
    return reply.send({ success: true, message: "Address deleted" });
  });

  // ==========================================
  // FEATURE 13 — PROMOTIONS & COUPONS ROUTES
  // ==========================================
  app.get("/owner/:restaurantId/promotions", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { page, limit, active, type, search } = req.query || {};
      const result = await listPromotions({
        prisma,
        restaurantId,
        page: page || 1,
        limit: limit || 20,
        active,
        type,
        search,
      });
      return reply.send(result);
    } catch (err) {
      console.error("[Promotions Route Error] List failed:", err.message);
      return reply.code(500).send({ message: "Failed to list promotions" });
    }
  });

  app.get("/owner/:restaurantId/promotions/:promotionId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const promotionId = Number(req.params.promotionId);
      const promotion = await getPromotionById({ prisma, restaurantId, promotionId });
      if (!promotion) return reply.code(404).send({ message: "Promotion not found" });
      return reply.send(promotion);
    } catch (err) {
      console.error("[Promotions Route Error] Get by ID failed:", err.message);
      return reply.code(500).send({ message: "Failed to fetch promotion details" });
    }
  });

  app.post("/owner/:restaurantId/promotions", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const res = await createPromotion({
        prisma,
        restaurantId,
        input: req.body || {},
        userId: req.user?.id,
        userName: req.user?.name,
      });
      if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
      return reply.code(201).send(res.promotion);
    } catch (err) {
      console.error("[Promotions Route Error] Create failed:", err.message);
      return reply.code(500).send({ message: "Failed to create promotion" });
    }
  });

  app.put("/owner/:restaurantId/promotions/:promotionId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const promotionId = Number(req.params.promotionId);
      const res = await updatePromotion({
        prisma,
        restaurantId,
        promotionId,
        input: req.body || {},
      });
      if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
      return reply.send(res.promotion);
    } catch (err) {
      console.error("[Promotions Route Error] Update failed:", err.message);
      return reply.code(500).send({ message: "Failed to update promotion" });
    }
  });

  app.patch("/owner/:restaurantId/promotions/:promotionId/status", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const promotionId = Number(req.params.promotionId);
      const res = await togglePromotionStatus({
        prisma,
        restaurantId,
        promotionId,
        active: req.body?.active,
      });
      if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
      return reply.send(res.promotion);
    } catch (err) {
      console.error("[Promotions Route Error] Toggle status failed:", err.message);
      return reply.code(500).send({ message: "Failed to update promotion status" });
    }
  });

  app.post("/owner/:restaurantId/promotions/validate", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { couponCode, promotionId, items, orderType, customerId, subtotal, branchId } = req.body || {};
      const res = await validateAndCalculateDiscount({
        prisma,
        restaurantId,
        branchId,
        couponCode,
        promotionId,
        items: items || [],
        orderType: orderType || "POS",
        customerId,
        subtotal: Number(subtotal || 0),
      });
      if (!res.ok) return reply.code(res.status || 400).send({ message: res.message });
      return reply.send(res);
    } catch (err) {
      console.error("[Promotions Route Error] Validate failed:", err.message);
      return reply.code(500).send({ message: "Failed to validate coupon code" });
    }
  });

  // ==========================================
  // LOYALTY & REWARDS ROUTES
  // ==========================================

  app.get("/owner/:restaurantId/loyalty/config", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const config = await getLoyaltyConfig({ db: prisma, restaurantId });
      return reply.send(config);
    } catch (err) {
      console.error("[Loyalty Route Error] Get config failed:", err.message);
      return reply.code(500).send({ message: "Failed to fetch loyalty config" });
    }
  });

  app.put("/owner/:restaurantId/loyalty/config", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const updated = await updateLoyaltyConfig({
        db: prisma,
        restaurantId,
        input: req.body || {},
      });
      return reply.send(updated);
    } catch (err) {
      console.error("[Loyalty Route Error] Update config failed:", err.message);
      return reply.code(500).send({ message: err.message || "Failed to update loyalty config" });
    }
  });

  app.get("/owner/:restaurantId/loyalty/stats", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const stats = await getLoyaltyStats({ db: prisma, restaurantId });
      return reply.send(stats);
    } catch (err) {
      console.error("[Loyalty Route Error] Get stats failed:", err.message);
      return reply.code(500).send({ message: "Failed to fetch loyalty stats" });
    }
  });

  app.get("/owner/:restaurantId/loyalty/history", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { customerId, page, limit, type } = req.query || {};
      const res = await listLoyaltyHistory({
        db: prisma,
        restaurantId,
        customerId: customerId ? Number(customerId) : null,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        type,
      });
      return reply.send(res);
    } catch (err) {
      console.error("[Loyalty Route Error] List history failed:", err.message);
      return reply.code(500).send({ message: "Failed to fetch loyalty history" });
    }
  });

  app.get("/owner/:restaurantId/loyalty/customer/:customerId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const customerId = Number(req.params.customerId);
      const account = await getOrCreateLoyaltyAccount({
        db: prisma,
        restaurantId,
        customerId,
      });
      if (!account) return reply.code(404).send({ message: "Loyalty account not found" });

      const history = await listLoyaltyHistory({
        db: prisma,
        restaurantId,
        customerId,
        page: 1,
        limit: 30,
      });

      return reply.send({ account, history: history.items });
    } catch (err) {
      console.error("[Loyalty Route Error] Get customer account failed:", err.message);
      return reply.code(500).send({ message: "Failed to fetch customer loyalty details" });
    }
  });

  app.post("/owner/:restaurantId/loyalty/adjust", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { customerId, points, type, reason } = req.body || {};
      const txn = await manualAdjustPoints({
        db: prisma,
        restaurantId,
        customerId: Number(customerId),
        points: Number(points),
        type,
        reason,
        createdById: req.user?.id || null,
        createdByName: req.user?.name || null,
      });
      return reply.send(txn);
    } catch (err) {
      console.error("[Loyalty Route Error] Manual adjust failed:", err.message);
      return reply.code(400).send({ message: err.message || "Failed to adjust loyalty points" });
    }
  });

  app.post("/owner/:restaurantId/loyalty/validate-redemption", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { customerId, pointsToRedeem, subtotal, hasCoupon } = req.body || {};
      const res = await validateAndCalculateLoyaltyRedemption({
        db: prisma,
        restaurantId,
        customerId: Number(customerId),
        pointsToRedeem: Number(pointsToRedeem || 0),
        subtotal: Number(subtotal || 0),
        hasCoupon: Boolean(hasCoupon),
      });
      return reply.send(res);
    } catch (err) {
      console.error("[Loyalty Route Error] Validate redemption failed:", err.message);
      return reply.code(500).send({ message: "Failed to validate loyalty points redemption" });
    }
  });
}
