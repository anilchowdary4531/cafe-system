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
import { buildSettlementController } from "../controllers/settlementController.js";

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
      const { name, description, category, image, price, originalPrice, discountPercent, isAvailable } = req.body || {};
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      if (!name || !category || (price === undefined && originalPrice === undefined)) {
        return reply.code(400).send({ message: "Missing required fields" });
      }

      const pricing = resolveMenuPricing({ price, originalPrice, discountPercent });

      return await prisma.menuItem.create({
        data: {
          restaurantId,
          name,
          description: description || "",
          category,
          image: image || "",
          price: pricing.price,
          originalPrice: pricing.originalPrice,
          discountPercent: pricing.discountPercent,
          isAvailable: isAvailable ?? true,
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
      const { name, description, category, image, price, originalPrice, discountPercent, isAvailable } = req.body || {};
      if (!restaurantId || !menuId) return reply.code(400).send({ message: "Invalid id values" });

      const item = await prisma.menuItem.findUnique({ where: { id: menuId } });
      if (!item || item.restaurantId !== restaurantId) {
        return reply.code(404).send({ message: "Menu item not found" });
      }

      const pricing = resolveMenuPricing({ price, originalPrice, discountPercent }, item);

      return await prisma.menuItem.update({
        where: { id: menuId },
        data: {
          name: name ?? item.name,
          description: description ?? item.description,
          category: category ?? item.category,
          image: image ?? item.image,
          price: pricing.price,
          originalPrice: pricing.originalPrice,
          discountPercent: pricing.discountPercent,
          isAvailable: isAvailable ?? item.isAvailable,
        },
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
      const [tables, activeOrders, latestTableOrders] = await Promise.all([
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
      ]);

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
            isOccupied: tableActiveOrders.length > 0,
            occupiedSince: tableActiveOrders[0]?.createdAt || null,
            activeOrderCount: tableActiveOrders.length,
            activeItemCount,
            activeOrders: tableActiveOrders,
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

  app.post("/owner/:restaurantId/tables", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const { tableNo, seats, isActive } = req.body || {};
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
      const { tableNo, seats, isActive } = req.body || {};
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

  app.get("/owner/:restaurantId/finance", async (req, reply) => {
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
      const [restaurant, orders, tables, menuItems, expenses] = await Promise.all([
        prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, name: true, slug: true, invoicePrefix: true, upiId: true, bankAccountNumber: true, bankIfscCode: true, bankAccountName: true, bankName: true } }),
        prisma.order.findMany({ where: { restaurantId, createdAt: { gte: fromDate } }, include: { items: true }, orderBy: { createdAt: "desc" } }),
        prisma.diningTable.findMany({ where: { restaurantId }, select: { id: true, isActive: true } }),
        prisma.menuItem.findMany({ where: { restaurantId }, select: { id: true, isAvailable: true } }),
        prisma.expense.findMany({ where: { restaurantId, spentAt: { gte: fromDate } }, orderBy: { spentAt: "desc" } }),
      ]);
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });

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

      const invoices = orders.map((order) => {
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

      const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
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
        expenses,
        invoices,
      };
    } catch (err) {
      console.log(err);
      return reply.code(500).send({ message: "Failed to fetch finance analytics" });
    }
  });

  // SETTLEMENT DASHBOARD ENDPOINTS
  app.get("/owner/:restaurantId/settlements/summary", settlementController.getSummary);
  app.get("/owner/:restaurantId/settlements/orders", settlementController.getOrders);
  app.get("/owner/:restaurantId/settlements/export/csv", settlementController.exportCsv);
  app.get("/owner/:restaurantId/settlements/export/pdf", settlementController.exportPdf);

  app.get("/owner/:restaurantId/settings", async (req, reply) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!restaurantId) return reply.code(400).send({ message: "Invalid restaurant id" });
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true, name: true, legalName: true, slug: true, ownerName: true, email: true, phone: true, upiId: true,
          bankAccountNumber: true, bankIfscCode: true, bankAccountName: true, bankName: true,
          addressLine1: true, city: true, state: true, country: true, pincode: true, gstNumber: true, logoUrl: true,
          bannerUrl: true, brandColor: true, faviconUrl: true,
          timezone: true, currency: true, taxEnabled: true, taxType: true, defaultTaxPercent: true,
          serviceChargeEnabled: true, serviceChargePercent: true, invoicePrefix: true, nextInvoiceNumber: true,
          isActive: true, updatedAt: true,
        },
      });
      if (!restaurant) return reply.code(404).send({ message: "Restaurant not found" });
      return { restaurant: { ...restaurant, logo: restaurant.logoUrl || "", logoUrl: undefined } };
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
      const updates = {
        name: body.name, legalName: body.legalName, ownerName: body.ownerName, email: body.email, phone: body.phone, upiId: body.upiId,
        bankAccountNumber: body.bankAccountNumber, bankIfscCode: body.bankIfscCode, bankAccountName: body.bankAccountName, bankName: body.bankName,
        addressLine1: body.addressLine1, city: body.city, state: body.state, country: body.country, pincode: body.pincode,
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

      const updated = await prisma.restaurant.update({
        where: { id: restaurantId },
        data: filteredData,
        select: {
          id: true, name: true, legalName: true, slug: true, ownerName: true, email: true, phone: true, upiId: true,
          addressLine1: true, city: true, state: true, country: true, pincode: true, gstNumber: true, logoUrl: true,
          bannerUrl: true, brandColor: true, faviconUrl: true,
          timezone: true, currency: true, taxEnabled: true, taxType: true, defaultTaxPercent: true,
          serviceChargeEnabled: true, serviceChargePercent: true, invoicePrefix: true, nextInvoiceNumber: true,
          isActive: true, updatedAt: true,
        },
      });
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
}
