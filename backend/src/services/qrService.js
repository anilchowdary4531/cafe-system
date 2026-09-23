import crypto from "crypto";
import { getOrCreateActiveSession, recalculateSessionTotals } from "./tableSessionService.js";
import { createOrderByStaff } from "./orderService.js";

/**
 * Generate a cryptographically random, unguessable token for QR codes.
 */
export const generateSecureToken = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Ensures table has a qrToken. If missing, creates and saves one.
 */
export const getOrCreateTableQrToken = async (tableId, prisma) => {
  const tid = Number(tableId);
  if (!tid) {
    const err = new Error("Invalid table ID");
    err.code = "invalid_input";
    throw err;
  }

  const table = await prisma.diningTable.findUnique({
    where: { id: tid },
  });

  if (!table) {
    const err = new Error("Table not found");
    err.code = "table_not_found";
    throw err;
  }

  if (table.qrToken) {
    return table;
  }

  const qrToken = generateSecureToken();
  const updated = await prisma.diningTable.update({
    where: { id: tid },
    data: { qrToken },
  });

  return updated;
};

/**
 * Regenerate QR token for a table.
 * Invalidates old QR code for future scans, without affecting active table sessions.
 */
export const regenerateTableQrToken = async (tableId, prisma) => {
  const tid = Number(tableId);
  if (!tid) {
    const err = new Error("Invalid table ID");
    err.code = "invalid_input";
    throw err;
  }

  const table = await prisma.diningTable.findUnique({
    where: { id: tid },
  });

  if (!table) {
    const err = new Error("Table not found");
    err.code = "table_not_found";
    throw err;
  }

  const newQrToken = generateSecureToken();
  const updated = await prisma.diningTable.update({
    where: { id: tid },
    data: { qrToken: newQrToken },
  });

  return updated;
};

/**
 * Batch generate QR tokens for all active tables of a restaurant if missing.
 */
export const ensureRestaurantQrTokens = async (restaurantId, prisma) => {
  const rid = Number(restaurantId);
  const tables = await prisma.diningTable.findMany({
    where: { restaurantId: rid, isActive: true },
  });

  const updatedTables = [];
  for (const table of tables) {
    if (!table.qrToken) {
      const newToken = generateSecureToken();
      const updated = await prisma.diningTable.update({
        where: { id: table.id },
        data: { qrToken: newToken },
      });
      updatedTables.push(updated);
    } else {
      updatedTables.push(table);
    }
  }

  return updatedTables;
};

/**
 * Public resolution endpoint service.
 * Looks up dining table by public QR token without exposing internal IDs.
 * Returns restaurant details, table metadata, active TableSession, and menu.
 */
export const resolveQrToken = async (token, prisma) => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    const err = new Error("QR token is required");
    err.statusCode = 400;
    err.code = "invalid_token";
    throw err;
  }

  const table = await prisma.diningTable.findUnique({
    where: { qrToken: cleanToken },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          phone: true,
          email: true,
          taxEnabled: true,
          taxType: true,
          defaultTaxPercent: true,
          serviceChargeEnabled: true,
          serviceChargePercent: true,
          upiId: true,
          addressLine1: true,
          city: true,
          state: true,
        },
      },
    },
  });

  if (!table || !table.isActive) {
    const err = new Error("Invalid or expired QR code table link");
    err.statusCode = 404;
    err.code = "table_not_found";
    throw err;
  }

  // Find active TableSession for this table
  const activeSession = await prisma.tableSession.findFirst({
    where: {
      tableId: table.id,
      restaurantId: table.restaurantId,
      status: { in: ["OPEN", "BILLING", "PAID"] },
    },
    include: {
      orders: {
        where: { status: { not: "CANCELLED" } },
        include: {
          items: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Fetch full available menu for the restaurant
  const menuItems = await prisma.menuItem.findMany({
    where: {
      restaurantId: table.restaurantId,
      isAvailable: true,
    },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          modifiers: {
            where: { isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return {
    restaurant: table.restaurant,
    table: {
      tableNo: table.tableNo,
      section: table.section || "Main Floor",
      seats: table.seats,
      qrToken: table.qrToken,
    },
    activeSession: activeSession
      ? {
          sessionId: activeSession.id,
          status: activeSession.status,
          openedAt: activeSession.openedAt,
          subtotal: activeSession.subtotal,
          taxAmount: activeSession.taxAmount,
          serviceChargeAmount: activeSession.serviceChargeAmount,
          total: activeSession.total,
          orderCount: activeSession.orders.length,
          orders: activeSession.orders.map((o) => ({
            id: o.id,
            orderNo: o.orderNo,
            status: o.status,
            customerName: o.customerName,
            total: o.total,
            createdAt: o.createdAt,
            items: o.items.map((i) => ({
              itemName: i.itemName,
              qty: i.qty,
              price: i.price,
              variantName: i.variantName,
            })),
          })),
        }
      : null,
    menu: menuItems,
  };
};

/**
 * Process order placed via QR code scan.
 * Creates order under table's active TableSession with orderSource="QR".
 */
export const placeQrOrder = async ({
  token,
  items,
  customerName,
  phone,
  email,
  notes,
  couponCode,
  promotionId,
  loyaltyPointsToRedeem,
  paymentMethod = "PAY_AT_COUNTER",
  prisma,
  io,
} = {}) => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    const err = new Error("QR token is required");
    err.statusCode = 400;
    err.code = "invalid_token";
    throw err;
  }

  const table = await prisma.diningTable.findUnique({
    where: { qrToken: cleanToken },
  });

  if (!table || !table.isActive) {
    const err = new Error("Invalid or expired QR code");
    err.statusCode = 404;
    err.code = "table_not_found";
    throw err;
  }

  const restaurantId = table.restaurantId;

  // 1. Get or create active session for table
  const session = await getOrCreateActiveSession({
    prisma,
    restaurantId,
    tableId: table.id,
    guestCount: 1,
  });

  // 2. Create order using orderService
  const order = await createOrderByStaff({
    prisma,
    actor: {
      restaurantId,
      role: "CUSTOMER",
      userId: null,
    },
    input: {
      orderSource: "QR",
      fulfillment: "DINE_IN",
      tableNo: table.tableNo,
      tableSessionId: session.id,
      items,
      customerName: customerName ? String(customerName).trim() : `Table ${table.tableNo} Guest`,
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      notes,
      couponCode,
      promotionId,
      loyaltyPointsToRedeem,
      paymentMethod,
    },
  });

  // 3. Recalculate table session totals
  const updatedSession = await recalculateSessionTotals({ prisma, sessionId: session.id });

  // Emit WebSocket updates if io is available
  if (io) {
    try {
      io.to(`restaurant_${restaurantId}`).emit("order_created", {
        order,
        session: updatedSession,
        source: "QR",
      });
      io.to(`restaurant_${restaurantId}`).emit("table_session_updated", {
        tableId: table.id,
        session: updatedSession,
      });
    } catch (_) {}
  }

  return {
    order,
    session: updatedSession,
  };
};

/**
 * Ensures restaurant has a publicMenuToken. If missing, creates and saves one.
 */
export const getOrCreatePublicMenuToken = async (restaurantId, prisma) => {
  const rid = Number(restaurantId);
  if (!rid) {
    const err = new Error("Invalid restaurant ID");
    err.code = "invalid_input";
    throw err;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rid },
  });

  if (!restaurant) {
    const err = new Error("Restaurant not found");
    err.code = "restaurant_not_found";
    throw err;
  }

  if (restaurant.publicMenuToken) {
    return restaurant;
  }

  const token = generateSecureToken();
  const updated = await prisma.restaurant.update({
    where: { id: rid },
    data: { publicMenuToken: token },
  });

  return updated;
};

/**
 * Regenerate Public Menu Token for a restaurant.
 * Invalidates old public menu link without affecting table QR tokens, TableSessions, or orders.
 */
export const regeneratePublicMenuToken = async (restaurantId, prisma) => {
  const rid = Number(restaurantId);
  if (!rid) {
    const err = new Error("Invalid restaurant ID");
    err.code = "invalid_input";
    throw err;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: rid },
  });

  if (!restaurant) {
    const err = new Error("Restaurant not found");
    err.code = "restaurant_not_found";
    throw err;
  }

  const newToken = generateSecureToken();
  const updated = await prisma.restaurant.update({
    where: { id: rid },
    data: { publicMenuToken: newToken },
  });

  return updated;
};

/**
 * Update Public Digital Menu Settings for a restaurant.
 */
export const updatePublicMenuSettings = async (restaurantId, settings = {}, prisma) => {
  const rid = Number(restaurantId);
  if (!rid) {
    const err = new Error("Invalid restaurant ID");
    err.code = "invalid_input";
    throw err;
  }

  const {
    isPublicMenuEnabled,
    isPublicOrderingEnabled,
    showPricesOnPublicMenu,
    showUnavailableItemsOnPublicMenu,
  } = settings;

  const data = {};
  if (typeof isPublicMenuEnabled === "boolean") data.isPublicMenuEnabled = isPublicMenuEnabled;
  if (typeof isPublicOrderingEnabled === "boolean") data.isPublicOrderingEnabled = isPublicOrderingEnabled;
  if (typeof showPricesOnPublicMenu === "boolean") data.showPricesOnPublicMenu = showPricesOnPublicMenu;
  if (typeof showUnavailableItemsOnPublicMenu === "boolean") data.showUnavailableItemsOnPublicMenu = showUnavailableItemsOnPublicMenu;

  return prisma.restaurant.update({
    where: { id: rid },
    data,
  });
};

/**
 * Public resolution endpoint service for Restaurant Digital Menu (/menu/:token).
 * Resolves restaurant branding, public settings, categories, and menu catalog.
 * DOES NOT CREATE A TABLE SESSION OR ASSIGN A TABLE.
 */
export const resolvePublicMenuToken = async (token, prisma) => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    const err = new Error("Digital menu token is required");
    err.statusCode = 400;
    err.code = "invalid_token";
    throw err;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { publicMenuToken: cleanToken },
    select: {
      id: true,
      name: true,
      legalName: true,
      slug: true,
      phone: true,
      email: true,
      addressLine1: true,
      city: true,
      state: true,
      country: true,
      pincode: true,
      logoUrl: true,
      bannerUrl: true,
      brandColor: true,
      taxEnabled: true,
      taxType: true,
      defaultTaxPercent: true,
      serviceChargeEnabled: true,
      serviceChargePercent: true,
      upiId: true,
      isActive: true,
      publicMenuToken: true,
      isPublicMenuEnabled: true,
      isPublicOrderingEnabled: true,
      showPricesOnPublicMenu: true,
      showUnavailableItemsOnPublicMenu: true,
    },
  });

  if (!restaurant || !restaurant.isActive) {
    const err = new Error("This digital menu link is invalid or no longer active.");
    err.statusCode = 404;
    err.code = "menu_not_found";
    throw err;
  }

  if (!restaurant.isPublicMenuEnabled) {
    const err = new Error("This restaurant's digital menu is currently disabled.");
    err.statusCode = 403;
    err.code = "menu_disabled";
    throw err;
  }

  const itemWhere = {
    restaurantId: restaurant.id,
    ...(restaurant.showUnavailableItemsOnPublicMenu ? {} : { isAvailable: true }),
  };

  const menuItems = await prisma.menuItem.findMany({
    where: itemWhere,
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          modifiers: {
            where: { isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return {
    restaurant,
    menu: menuItems,
  };
};

/**
 * Process order placed via Public Digital Menu (/menu/:token) when public ordering is enabled.
 * Creates order with orderSource="DIGITAL_MENU" and fulfillment="TAKEAWAY" or "DELIVERY".
 * DOES NOT CREATE OR REQUIRE A TABLE SESSION.
 */
export const placePublicMenuOrder = async ({
  token,
  items,
  customerName,
  phone,
  email,
  notes,
  fulfillment = "TAKEAWAY",
  couponCode,
  promotionId,
  loyaltyPointsToRedeem,
  paymentMethod = "PAY_AT_COUNTER",
  prisma,
  io,
} = {}) => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    const err = new Error("Digital menu token is required");
    err.statusCode = 400;
    err.code = "invalid_token";
    throw err;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { publicMenuToken: cleanToken },
  });

  if (!restaurant || !restaurant.isActive || !restaurant.isPublicMenuEnabled) {
    const err = new Error("Digital menu is invalid or disabled");
    err.statusCode = 404;
    err.code = "menu_unavailable";
    throw err;
  }

  if (!restaurant.isPublicOrderingEnabled) {
    const err = new Error("Online ordering from the digital menu is currently disabled by the restaurant");
    err.statusCode = 403;
    err.code = "ordering_disabled";
    throw err;
  }

  const restaurantId = restaurant.id;
  const safeFulfillment = ["TAKEAWAY", "DELIVERY"].includes(String(fulfillment).toUpperCase())
    ? String(fulfillment).toUpperCase()
    : "TAKEAWAY";

  const order = await createOrderByStaff({
    prisma,
    actor: {
      restaurantId,
      role: "CUSTOMER",
      userId: null,
    },
    input: {
      orderSource: "DIGITAL_MENU",
      fulfillment: safeFulfillment,
      tableNo: null,
      tableSessionId: null,
      items,
      customerName: customerName ? String(customerName).trim() : "Online Guest",
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      notes,
      couponCode,
      promotionId,
      loyaltyPointsToRedeem,
      paymentMethod,
    },
  });

  if (io) {
    try {
      io.to(`restaurant_${restaurantId}`).emit("order_created", {
        order,
        source: "DIGITAL_MENU",
      });
    } catch (_) {}
  }

  return { order };
};
