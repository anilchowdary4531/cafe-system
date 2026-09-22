import bcrypt from "bcryptjs";
import { buildReadableOrderNo, updateOrderStatus } from "../services/orderService.js";
import { buildUploadController } from "../controllers/uploadController.js";
import { deleteAssetByKey, uploadRestaurantAsset } from "../services/storageService.js";
import {
  buildStaffMagicLinkToken,
  buildStaffMagicLinkUrl,
  inferRoleFromDesignation,
} from "../services/staffSessionService.js";
import { resolveMenuPricing } from "../services/menuPricingService.js";
import { buildPayLaterController } from "../controllers/payLaterController.js";
import {
  searchCustomers,
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
  getStations,
  testPrinter,
  triggerReprint,
  updatePrinter,
  updateStation,
  updateStatus as updateKotStatusController,
} from "../controllers/kot.controller.js";
import {
  moveTable,
  mergeTables,
  splitTableOrTransferItems,
} from "../controllers/tableOperationController.js";

export default async function ownerRoutes(app, deps) {
  const { prisma, buildQrTargetUrl, FRONTEND_URL, STAFF_ACCESS_MODULES, STAFF_ALLOWED_ROLES, normalizeAccess, normalizeDbPermissions, serializeAccess, realtime } = deps;
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
    if (normalizedRole && normalizedRole !== "STAFF") return normalizedRole;
    return inferRoleFromDesignation(designation) || normalizedRole || "STAFF";
  };
  const buildStaffLoginLink = (user) =>
    buildStaffMagicLinkUrl({
      frontendUrl: FRONTEND_URL,
      token: buildStaffMagicLinkToken({
        app,
        user,
        expiresIn: STAFF_LOGIN_LINK_EXPIRES_IN,
      }),
      });
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

  app.get("/owner/dashboard/:restaurantId", async (req, reply) => {
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
  });

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

  app.get("/owner/:restaurantId/tables", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, slug: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });
      const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];
      const [tables, activeOrders, latestTableOrders, activeSessions] = await Promise.all([
        prisma.diningTable.findMany({
          where: { restaurantId },
          orderBy: { id: "desc" },
        }),
        prisma.order.findMany({
          where: {
            restaurantId,
            tableNo: { not: null },
            status: { in: activeStatuses },
          },
          select: {
            id: true,
            tableNo: true,
            orderNo: true,
            status: true,
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
      ]);

      const activeSessionsByTable = activeSessions.reduce((acc, session) => {
        const tableKey = String(session.tableNo || "").trim().toLowerCase();
        if (tableKey) acc[tableKey] = session;
        return acc;
      }, {});

      const activeOrdersByTable = activeOrders.reduce((acc, order) => {
        const tableKey = String(order.tableNo || "").trim().toLowerCase();
        if (!tableKey) return acc;

        if (!acc[tableKey]) acc[tableKey] = [];
        acc[tableKey].push({
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
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
        });
        return acc;
      }, {});

      const latestOrderByTable = latestTableOrders.reduce((acc, order) => {
        const tableKey = String(order.tableNo || "").trim().toLowerCase();
        if (!tableKey) return acc;
        if (!acc[tableKey]) acc[tableKey] = order;
        return acc;
      }, {});

      return tables.map((table) => ({
        ...table,
        qrCodeUrl: buildQrTargetUrl(restaurant.slug, table.tableNo),
        ...(function buildTableState() {
          const tableKey = String(table.tableNo || "").trim().toLowerCase();
          const tableActiveOrders = activeOrdersByTable[tableKey] || [];
          const latestOrder = latestOrderByTable[tableKey] || null;
          const activeSession = activeSessionsByTable[tableKey] || null;
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

          return {
            isOccupied: Boolean(activeSession) || tableActiveOrders.length > 0,
            occupiedSince: activeSession?.openedAt || tableActiveOrders[0]?.createdAt || null,
            activeOrderCount: tableActiveOrders.length,
            activeItemCount,
            activeOrders: tableActiveOrders,
            activeSession: activeSession ? {
              id: activeSession.id,
              status: activeSession.status,
              guestCount: activeSession.guestCount,
              waiterName: activeSession.waiterName,
              subtotal: activeSession.subtotal,
              total: activeSession.total,
              openedAt: activeSession.openedAt,
            } : null,
            lastOrderStatus: latestOrder?.status || null,
            lastPaymentStatus: latestOrder?.paymentStatus || null,
            lastOrderNo: latestOrder?.orderNo || null,
            lastOrderAt: latestOrder?.updatedAt || latestOrder?.createdAt || null,
          };
        })(),
      }));
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch tables" });
    }
  });

  // Table Operations: Move, Merge, Split / Transfer Items
  app.post("/owner/:restaurantId/tables/:tableId/move", moveTable);
  app.post("/owner/:restaurantId/tables/:tableId/merge", mergeTables);
  app.post("/owner/:restaurantId/tables/:tableId/split", splitTableOrTransferItems);
  app.post("/owner/:restaurantId/tables/:tableId/transfer-items", splitTableOrTransferItems);

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

  app.post("/owner/:restaurantId/tables", async (req, reply) => {
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
        },
      });
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create table" });
    }
  });

  app.put("/owner/:restaurantId/tables/:tableId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      const { tableNo, seats, isActive, section, positionX, positionY, width, height, shape, rotation } = req.body || {};
      if (!restaurantId || !tableId) return reply.code(400).send({ message: "Invalid id values" });

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, slug: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const existing = await prisma.diningTable.findUnique({ where: { id: tableId } });
      if (!existing || existing.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Table not found" });
      }

      if (tableNo && tableNo !== existing.tableNo) {
        const duplicate = await prisma.diningTable.findFirst({
          where: { restaurantId, tableNo, NOT: { id: tableId } },
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
  });

  app.delete("/owner/:restaurantId/tables/:tableId", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const tableId = Number(req.params.tableId);
      if (!restaurantId || !tableId) return reply.code(400).send({ message: "Invalid id values" });

      const table = await prisma.diningTable.findUnique({
        where: { id: tableId },
        select: { id: true, restaurantId: true },
      });
      if (!table || table.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Table not found" });
      }

      await prisma.diningTable.delete({ where: { id: tableId } });
      return { message: "Table deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete table" });
    }
  });

  // Keep analytics/finance/settings/staff endpoints in this module.
  app.get("/owner/:restaurantId/analytics", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const range = String(req.query?.range || "7d").toLowerCase();
      const validRanges = ["24h", "7d", "30d"];
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!validRanges.includes(range)) {
        return reply.code(400).send({ message: `Invalid range. Allowed: ${validRanges.join(", ")}` });
      }

      const now = new Date();
      const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
      const bucketMs = range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const seriesStart = new Date(now.getTime() - (bucketCount - 1) * bucketMs);

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

      const [orders, menuItems, tables] = await Promise.all([
        prisma.order.findMany({
          where: { restaurantId, createdAt: { gte: seriesStart } },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.menuItem.findMany({
          where: { restaurantId },
          select: { id: true, name: true, category: true, isAvailable: true, price: true },
        }),
        prisma.diningTable.findMany({
          where: { restaurantId },
          select: { id: true, tableNo: true, isActive: true, seats: true },
        }),
      ]);

      const statusKeys = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"];
      const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];
      const statusCounts = statusKeys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
      let totalRevenue = 0;
      let totalSubtotal = 0;
      let delayedTickets = 0;
      let totalCycleMinutes = 0;
      let deliveredWithCycle = 0;

      const timeseries = Array.from({ length: bucketCount }, (_, index) => {
        const start = new Date(seriesStart.getTime() + index * bucketMs);
        const label =
          range === "24h"
            ? `${String(start.getHours()).padStart(2, "0")}:00`
            : `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`;
        return { idx: index, ts: start.toISOString(), label, orders: 0, revenue: 0 };
      });

      const itemMap = new Map();
      const categoryMap = new Map();
      const tableMap = new Map();
      const menuById = new Map(menuItems.map((m) => [m.id, m]));

      for (const order of orders) {
        const orderStatus = String(order.status || "PLACED").toUpperCase();
        statusCounts[orderStatus] = (statusCounts[orderStatus] || 0) + 1;
        const orderTotal = Number(order.total || 0);
        const orderSubtotal = Number(order.subtotal || 0);
        totalRevenue += orderTotal;
        totalSubtotal += orderSubtotal;

        const createdAtMs = new Date(order.createdAt).getTime();
        const ageMin = (now.getTime() - createdAtMs) / 60000;
        if (activeStatuses.includes(orderStatus) && ageMin > 20) delayedTickets += 1;
        if (orderStatus === "DELIVERED") {
          const updatedAtMs = new Date(order.updatedAt).getTime();
          totalCycleMinutes += Math.max(0, (updatedAtMs - createdAtMs) / 60000);
          deliveredWithCycle += 1;
        }

        const bucketIndex = Math.floor((createdAtMs - seriesStart.getTime()) / bucketMs);
        if (bucketIndex >= 0 && bucketIndex < timeseries.length) {
          timeseries[bucketIndex].orders += 1;
          timeseries[bucketIndex].revenue += orderTotal;
        }

        const tableNo = order.tableNo || "Walk-in";
        const tableAgg = tableMap.get(tableNo) || { tableNo, orders: 0, revenue: 0 };
        tableAgg.orders += 1;
        tableAgg.revenue += orderTotal;
        tableMap.set(tableNo, tableAgg);

        for (const item of order.items || []) {
          const itemName = item.itemName || "Unknown Item";
          const qty = Number(item.qty || 0);
          const revenue = Number(item.total || 0);
          const itemAgg = itemMap.get(itemName) || { name: itemName, qty: 0, revenue: 0 };
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

      const totalOrders = orders.length;
      const deliveredOrders = Number(statusCounts.DELIVERED || 0);
      const cancelledOrders = Number(statusCounts.CANCELLED || 0);
      const closedOrders = deliveredOrders + cancelledOrders;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const completionRate = closedOrders > 0 ? (deliveredOrders / closedOrders) * 100 : 0;
      const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
      const avgPrepMinutes = deliveredWithCycle > 0 ? totalCycleMinutes / deliveredWithCycle : 0;

      return {
        generatedAt: now.toISOString(),
        range,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          timezone: restaurant.timezone || "Asia/Kolkata",
        },
        overview: {
          totalOrders,
          totalRevenue,
          totalSubtotal,
          avgOrderValue,
          deliveredOrders,
          cancelledOrders,
          completionRate,
          cancellationRate,
        },
        realtime: {
          activeQueue: activeStatuses.reduce((sum, key) => sum + Number(statusCounts[key] || 0), 0),
          delayedTickets,
          avgPrepMinutes,
          activeTables: tables.filter((t) => t.isActive).length,
          totalTables: tables.length,
          availableMenuItems: menuItems.filter((m) => m.isAvailable).length,
          totalMenuItems: menuItems.length,
        },
        statusFunnel: statusKeys.map((key) => ({ status: key, count: statusCounts[key] || 0 })),
        charts: {
          timeseries,
          topItems: Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 8),
          categories: Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue),
          tableHeatmap: Array.from(tableMap.values()).sort((a, b) => b.orders - a.orders).slice(0, 10),
        },
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch analytics" });
    }
  });

  const getFinanceAnalyticsHandler = async (req, reply) => {
    try {
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
        isActive: body.isActive,
      };
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
            isActive: true, updatedAt: true,
          },
        });
      }
      return { message: "Settings updated", restaurant: { ...updated, logo: updated.logoUrl || "", logoUrl: undefined } };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update settings" });
    }
  });

  app.get("/owner/:restaurantId/staff", async (req, reply) => {
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
          if (!q) return true;
          return (
            String(user.name || "").toLowerCase().includes(q) ||
            String(user.email || "").toLowerCase().includes(q) ||
            String(user.phone || "").toLowerCase().includes(q) ||
            String(user.designation || "").toLowerCase().includes(q) ||
            String(user.role || "").toLowerCase().includes(q)
          );
        });

      return { users: mapped, modules: STAFF_ACCESS_MODULES };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch staff users" });
    }
  });

  app.post("/owner/:restaurantId/staff", async (req, reply) => {
    try {
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
      if (!name || !email || !phone || !password) {
        return reply.code(400).send({ message: "Name, email, phone, and password are required" });
      }

      const normalizedRole = String(role || "STAFF").toUpperCase();
      if (!STAFF_ALLOWED_ROLES.includes(normalizedRole)) {
        return reply.code(400).send({ message: `Invalid role: ${normalizedRole}` });
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

      const hashedPassword = bcrypt.hashSync(String(password), 10);
      const createData = {
        name: String(name).trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        role: effectiveRole,
        isActive: Boolean(isActive),
        restaurantId,
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

      return {
        message: "Staff user created",
        user: buildStaffUserResponse(user, normalizedAccess),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to create staff user" });
    }
  });

  app.put("/owner/:restaurantId/staff/:staffId", async (req, reply) => {
    try {
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
      if (password) data.password = bcrypt.hashSync(String(password), 10);

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

      return {
        message: "Staff user updated",
        user: buildStaffUserResponse(updated),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update staff user" });
    }
  });

  app.patch("/owner/:restaurantId/staff/:staffId/status", async (req, reply) => {
    try {
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
        data: { isActive },
        include: { staffAccess: { select: { permissions: true } } },
      });

      return {
        message: `Staff user ${isActive ? "enabled" : "disabled"}`,
        user: buildStaffUserResponse(updated),
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to update staff status" });
    }
  });

  app.put("/owner/:restaurantId/staff/:staffId/access", async (req, reply) => {
    try {
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
      const restaurantId = Number(req.params.restaurantId);
      const staffId = Number(req.params.staffId);
      if (!restaurantId || !staffId) return reply.code(400).send({ message: "Invalid id values" });

      const staff = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, role: true, restaurantId: true },
      });
      if (!staff || staff.restaurantId !== restaurantId) return reply.code(404).send({ message: "Staff user not found" });
      if (staff.role === "OWNER") return reply.code(400).send({ message: "Owner account cannot be deleted" });

      await prisma.user.delete({ where: { id: staffId } });
      return { message: "Staff user deleted" };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to delete staff user" });
    }
  });

  app.get("/owner/:restaurantId/finance/expenses", async (req, reply) => {
    try {
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

  app.post("/owner/:restaurantId/tables/:tableNo/settle-bill", async (req, reply) => {
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
      const tableNo = String(req.params.tableNo || "").trim();
      if (!restaurantId || !tableNo) return reply.code(400).send({ message: "Invalid id values" });
      if (!actor?.role) return reply.code(401).send({ message: "Authentication required" });
      if (actor?.restaurantId && actor.restaurantId !== restaurantId && actor.role !== "SUPER_ADMIN") {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const paymentMode = normalizeBillPaymentMode(req.body?.paymentMode || req.body?.paymentMethod || req.body?.method);
      const changedByName = req.body?.changedByName ? String(req.body.changedByName).trim() : null;
      const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];

      const activeOrders = await prisma.order.findMany({
        where: {
          restaurantId,
          tableNo,
          status: { in: activeStatuses },
        },
        select: {
          id: true,
          restaurantId: true,
          branchId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (!activeOrders.length) {
        return reply.send({
          message: `Table ${tableNo} already has no active bill`,
          orders: [],
          cleared: false,
        });
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
                  notes: `Bill settled via ${paymentMode}`,
                },
              },
            },
            include: {
              items: true,
              customer: true,
              statusEvents: { orderBy: { createdAt: "asc" } },
            },
          });

          results.push(updatedOrder);
        }

        return results;
      });

      updatedOrders.forEach((order) => {
        realtime?.emitOrderUpdated?.(order);
      });

      return {
        message: `Table ${tableNo} bill settled`,
        orders: updatedOrders,
        cleared: true,
        paymentMode,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to settle table bill" });
    }
  });

  const payLaterController = buildPayLaterController({ prisma });
  app.get("/owner/:restaurantId/pay-later/customers", payLaterController.getCustomers);
  app.post("/owner/:restaurantId/pay-later/customers", payLaterController.addCustomer);
  app.post("/owner/:restaurantId/pay-later/customers/:customerId/adjust", payLaterController.adjustBalance);
  app.post("/owner/:restaurantId/pay-later/customers/:customerId/points", payLaterController.adjustPoints);
  app.post("/owner/:restaurantId/pay-later/customers/:customerId/reminder", payLaterController.sendReminder);
  app.get("/owner/:restaurantId/pay-later/accounts/:accountId/details", payLaterController.getDetails);

  // KOT & THERMAL PRINTER ROUTES
  app.get("/owner/:restaurantId/kots", getKots);
  app.put("/owner/:restaurantId/kots/:kotId/status", updateKotStatusController);
  app.post("/owner/:restaurantId/kots/:kotId/reprint", triggerReprint);

  app.get("/owner/:restaurantId/printers", getPrinters);
  app.post("/owner/:restaurantId/printers", createPrinter);
  app.put("/owner/:restaurantId/printers/:printerId", updatePrinter);
  app.delete("/owner/:restaurantId/printers/:printerId", deletePrinter);
  app.post("/owner/:restaurantId/printers/:printerId/test", testPrinter);

  app.get("/owner/:restaurantId/stations", getStations);
  app.post("/owner/:restaurantId/stations", createStation);
  app.put("/owner/:restaurantId/stations/:stationId", updateStation);

  // ==========================================
  // FEATURE 12 — CUSTOMER CRM FOUNDATION ROUTES
  // ==========================================
  const handleGetCustomers = async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { query, q, page, limit, status, sortBy, sortOrder } = req.query || {};
      const result = await searchCustomers({
        prisma,
        restaurantId,
        query: query || q || "",
        page: page || 1,
        limit: limit || 20,
        status: status || "ACTIVE",
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "desc",
      });
      return reply.send(result);
    } catch (err) {
      console.error("[CRM Route Error] Search customers failed:", err.message);
      return reply.code(500).send({ message: err.message || "Failed to fetch customers" });
    }
  };

  app.get("/owner/:restaurantId/customers", handleGetCustomers);
  app.get("/owner/:restaurantId/crm/customers", handleGetCustomers);

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
  app.get("/owner/:restaurantId/crm/customers/search", handleSearchCustomersAutocomplete);

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
  app.get("/owner/:restaurantId/crm/customers/:customerId", handleGetCustomerById);

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
  app.post("/owner/:restaurantId/crm/customers", handleCreateCustomer);

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
  app.put("/owner/:restaurantId/crm/customers/:customerId", handleUpdateCustomer);
  app.patch("/owner/:restaurantId/customers/:customerId", handleUpdateCustomer);
  app.patch("/owner/:restaurantId/crm/customers/:customerId", handleUpdateCustomer);

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
  app.post("/owner/:restaurantId/crm/customers/merge", handleMergeCustomers);

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
