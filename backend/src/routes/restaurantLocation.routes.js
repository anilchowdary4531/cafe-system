/**
 * Restaurant Location Discovery Routes
 * Endpoints for finding nearby restaurants within a configurable radius.
 * Supports:
 * - GET /api/restaurants/nearby
 * - GET /restaurants/nearby
 */

import { findNearbyRestaurants } from "../services/restaurantLocationService.js";

export default async function restaurantLocationRoutes(app, { prisma }) {
  const handleNearby = async (req, reply) => {
    try {
      const {
        lat,
        latitude,
        lng,
        lon,
        longitude,
        radius,
        limit,
        offset,
        openOnly,
      } = req.query || {};

      const inputLat = latitude !== undefined && latitude !== null ? latitude : lat;
      const inputLng = longitude !== undefined && longitude !== null
        ? longitude
        : (lng !== undefined && lng !== null ? lng : lon);

      const result = await findNearbyRestaurants({
        prisma,
        latitude: inputLat,
        longitude: inputLng,
        radius,
        limit,
        offset,
        openOnly,
      });

      return reply.code(200).send(result);
    } catch (err) {
      if (err.statusCode === 400) {
        return reply.code(400).send({
          error: "Bad Request",
          message: err.message,
        });
      }

      req.log?.error?.({ err: err?.message || err }, "nearby_restaurants_failed");
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Failed to retrieve nearby restaurants.",
      });
    }
  };

  // Mount both paths to ensure full compatibility with frontend and mobile clients
  app.get("/api/restaurants/nearby", handleNearby);
  app.get("/restaurants/nearby", handleNearby);
}
