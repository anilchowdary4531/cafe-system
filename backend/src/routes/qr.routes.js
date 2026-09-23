import {
  resolveQrToken,
  placeQrOrder,
  regenerateTableQrToken,
  ensureRestaurantQrTokens,
  getOrCreateTableQrToken,
  getOrCreatePublicMenuToken,
  regeneratePublicMenuToken,
  updatePublicMenuSettings,
  resolvePublicMenuToken,
  placePublicMenuOrder,
} from "../services/qrService.js";

export default async function qrRoutes(app, deps = {}) {
  const { prisma } = deps;
  const io = app.io || app.websocketServer || deps.io;

  /**
   * Public QR Token Resolution Endpoint
   * Customer scans QR code -> loads landing page -> fetches table context & menu securely.
   */
  const handleResolveQrToken = async (req, reply) => {
    try {
      const { token } = req.params;
      const data = await resolveQrToken(token, prisma);
      return data;
    } catch (err) {
      const statusCode = err.statusCode || 404;
      return reply.code(statusCode).send({
        message: err.message || "Failed to resolve QR code",
        code: err.code || "qr_resolve_error",
      });
    }
  };

  app.get("/api/public/qr/resolve/:token", handleResolveQrToken);
  app.get("/public/qr/resolve/:token", handleResolveQrToken);

  /**
   * Public QR Order Placement Endpoint
   * Customer submits order from QR menu context.
   */
  const handlePlaceQrOrder = async (req, reply) => {
    try {
      const body = req.body || {};
      const {
        token,
        items,
        customerName,
        phone,
        email,
        notes,
        couponCode,
        promotionId,
        loyaltyPointsToRedeem,
        paymentMethod,
      } = body;

      if (!token) {
        return reply.code(400).send({ message: "QR token is required" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({ message: "Order items are required" });
      }

      const result = await placeQrOrder({
        token,
        items,
        customerName,
        phone,
        email,
        notes,
        couponCode,
        promotionId,
        loyaltyPointsToRedeem,
        paymentMethod,
        prisma,
        io: app.io || io,
      });

      return reply.code(201).send({
        message: "Order placed successfully",
        order: result.order,
        session: result.session,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return reply.code(statusCode).send({
        message: err.message || "Failed to place QR order",
        code: err.code || "qr_order_error",
      });
    }
  };

  app.post("/api/public/qr/order", handlePlaceQrOrder);
  app.post("/public/qr/order", handlePlaceQrOrder);

  /**
   * Public Digital Menu Resolution Endpoint (/menu/:token)
   * Customer scans Digital Menu QR or visits link -> loads menu without creating TableSession.
   */
  const handleResolveDigitalMenu = async (req, reply) => {
    try {
      const { token } = req.params;
      const data = await resolvePublicMenuToken(token, prisma);
      return data;
    } catch (err) {
      const statusCode = err.statusCode || 404;
      return reply.code(statusCode).send({
        message: err.message || "Failed to load digital menu",
        code: err.code || "menu_resolve_error",
      });
    }
  };

  app.get("/api/public/digital-menu/resolve/:token", handleResolveDigitalMenu);
  app.get("/public/menu/resolve/:token", handleResolveDigitalMenu);

  /**
   * Public Digital Menu Order Placement Endpoint (Takeaway/Delivery when enabled)
   */
  const handlePlaceDigitalMenuOrder = async (req, reply) => {
    try {
      const body = req.body || {};
      const {
        token,
        items,
        customerName,
        phone,
        email,
        notes,
        fulfillment,
        couponCode,
        promotionId,
        loyaltyPointsToRedeem,
        paymentMethod,
      } = body;

      if (!token) {
        return reply.code(400).send({ message: "Digital menu token is required" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({ message: "Order items are required" });
      }

      const result = await placePublicMenuOrder({
        token,
        items,
        customerName,
        phone,
        email,
        notes,
        fulfillment,
        couponCode,
        promotionId,
        loyaltyPointsToRedeem,
        paymentMethod,
        prisma,
        io: app.io || io,
      });

      return reply.code(201).send({
        message: "Order placed successfully from Digital Menu",
        order: result.order,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return reply.code(statusCode).send({
        message: err.message || "Failed to place digital menu order",
        code: err.code || "digital_menu_order_error",
      });
    }
  };

  app.post("/api/public/digital-menu/order", handlePlaceDigitalMenuOrder);
  app.post("/public/digital-menu/order", handlePlaceDigitalMenuOrder);

  /**
   * Owner Endpoint: Get or Ensure Digital Menu Info & QR Token for a Restaurant
   */
  const handleGetOwnerDigitalMenu = async (req, reply) => {
    try {
      const { restaurantId } = req.params;
      const restaurant = await getOrCreatePublicMenuToken(restaurantId, prisma);
      return {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logoUrl: restaurant.logoUrl,
          bannerUrl: restaurant.bannerUrl,
          publicMenuToken: restaurant.publicMenuToken,
          isPublicMenuEnabled: restaurant.isPublicMenuEnabled,
          isPublicOrderingEnabled: restaurant.isPublicOrderingEnabled,
          showPricesOnPublicMenu: restaurant.showPricesOnPublicMenu,
          showUnavailableItemsOnPublicMenu: restaurant.showUnavailableItemsOnPublicMenu,
        },
      };
    } catch (err) {
      return reply.code(500).send({
        message: err.message || "Failed to fetch digital menu info",
      });
    }
  };

  app.get("/api/owner/:restaurantId/digital-menu", handleGetOwnerDigitalMenu);
  app.get("/owner/:restaurantId/digital-menu", handleGetOwnerDigitalMenu);

  /**
   * Owner Endpoint: Regenerate Public Menu QR Token for a Restaurant
   */
  const handleRegeneratePublicMenuToken = async (req, reply) => {
    try {
      const { restaurantId } = req.params;
      const updated = await regeneratePublicMenuToken(restaurantId, prisma);
      return {
        message: "Digital Menu QR token regenerated successfully",
        restaurant: updated,
      };
    } catch (err) {
      return reply.code(500).send({
        message: err.message || "Failed to regenerate digital menu token",
      });
    }
  };

  app.post("/api/owner/:restaurantId/digital-menu/regenerate", handleRegeneratePublicMenuToken);
  app.post("/owner/:restaurantId/digital-menu/regenerate", handleRegeneratePublicMenuToken);

  /**
   * Owner Endpoint: Update Digital Menu Settings
   */
  const handleUpdateDigitalMenuSettings = async (req, reply) => {
    try {
      const { restaurantId } = req.params;
      const updated = await updatePublicMenuSettings(restaurantId, req.body || {}, prisma);
      return {
        message: "Digital menu settings updated successfully",
        restaurant: updated,
      };
    } catch (err) {
      return reply.code(500).send({
        message: err.message || "Failed to update digital menu settings",
      });
    }
  };

  app.put("/api/owner/:restaurantId/digital-menu/settings", handleUpdateDigitalMenuSettings);
  app.put("/owner/:restaurantId/digital-menu/settings", handleUpdateDigitalMenuSettings);

  /**
   * Owner Endpoint: Regenerate Table QR Token
   * Invalidates old QR code for future scans, keeping active sessions intact.
   */
  const handleRegenerateQr = async (req, reply) => {
    try {
      const { tableId } = req.params;
      const updatedTable = await regenerateTableQrToken(tableId, prisma);
      return {
        message: "QR token regenerated successfully",
        table: updatedTable,
      };
    } catch (err) {
      return reply.code(500).send({
        message: err.message || "Failed to regenerate QR token",
      });
    }
  };

  app.post("/api/owner/:restaurantId/tables/:tableId/qr/regenerate", handleRegenerateQr);
  app.post("/owner/:restaurantId/tables/:tableId/qr/regenerate", handleRegenerateQr);

  /**
   * Owner Endpoint: Batch generate missing QR tokens for all tables of a restaurant
   */
  const handleBatchGenerateQr = async (req, reply) => {
    try {
      const { restaurantId } = req.params;
      const tables = await ensureRestaurantQrTokens(restaurantId, prisma);
      return {
        message: "QR tokens generated for all restaurant tables",
        tables,
      };
    } catch (err) {
      return reply.code(500).send({
        message: err.message || "Failed to batch generate QR tokens",
      });
    }
  };

  app.post("/api/owner/:restaurantId/tables/qr/batch-generate", handleBatchGenerateQr);
  app.post("/owner/:restaurantId/tables/qr/batch-generate", handleBatchGenerateQr);
}
