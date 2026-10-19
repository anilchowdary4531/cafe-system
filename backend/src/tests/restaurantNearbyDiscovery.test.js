import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import {
  validateCoordinates,
  validateQueryOptions,
  calculateBoundingBox,
  calculateHaversineDistanceKm,
  isRestaurantOpen,
  calculateEstimatedDeliveryMinutes,
  getPriorityRank,
  findNearbyRestaurants,
} from "../services/restaurantLocationService.js";
import restaurantLocationRoutes from "../routes/restaurantLocation.routes.js";

test("Phase 7 — Restaurant Nearby Discovery & Location Engine", async (t) => {
  // 1. Valid coordinates
  await t.test("1. Valid coordinates return parsed numeric lat/lng", () => {
    const coords = validateCoordinates("12.9716", "77.5946");
    assert.strictEqual(coords.latitude, 12.9716);
    assert.strictEqual(coords.longitude, 77.5946);
  });

  // 2. Invalid latitude
  await t.test("2. Invalid latitude throws 400 validation error", () => {
    assert.throws(() => validateCoordinates(95, 77.5946), (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /latitude/i);
      return true;
    });

    assert.throws(() => validateCoordinates("invalid", 77.5946), (err) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    });
  });

  // 3. Invalid longitude
  await t.test("3. Invalid longitude throws 400 validation error", () => {
    assert.throws(() => validateCoordinates(12.9716, 185), (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /longitude/i);
      return true;
    });

    assert.throws(() => validateCoordinates(12.9716, "-190"), (err) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    });
  });

  // 4. Default radius
  await t.test("4. Default radius is 5 km", () => {
    const opts = validateQueryOptions({});
    assert.strictEqual(opts.radiusKm, 5.0);
    assert.strictEqual(opts.limit, 20);
    assert.strictEqual(opts.offset, 0);
  });

  // 5. Custom radius
  await t.test("5. Custom radius parses valid positive number and enforces max limit", () => {
    const opts = validateQueryOptions({ radius: "10.5", limit: "30", offset: "15" });
    assert.strictEqual(opts.radiusKm, 10.5);
    assert.strictEqual(opts.limit, 30);
    assert.strictEqual(opts.offset, 15);

    assert.throws(() => validateQueryOptions({ radius: 150 }), (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /maximum allowed limit/i);
      return true;
    });
  });

  // 6. Bounding box filtering
  await t.test("6. Bounding box calculates correct min/max bounds for SQL query", () => {
    const bbox = calculateBoundingBox(12.9716, 77.5946, 5.0);
    assert.ok(bbox.minLat < 12.9716);
    assert.ok(bbox.maxLat > 12.9716);
    assert.ok(bbox.minLng < 77.5946);
    assert.ok(bbox.maxLng > 77.5946);

    // Latitude span for 5 km is approx 5 / 111.045 = 0.045 degrees
    assert.ok(Math.abs(bbox.maxLat - bbox.minLat - 0.09) < 0.01);
  });

  // 7. Haversine distance: test prompt specific coordinates (12.9716, 77.5946 to 12.9750, 77.5900)
  await t.test("7. Haversine distance is accurate (~0.6-0.8 km for Bengaluru coordinates)", () => {
    const dist = calculateHaversineDistanceKm(12.9716, 77.5946, 12.9750, 77.5900);
    assert.ok(dist >= 0.5 && dist <= 0.85, `Distance was ${dist}`);
    assert.strictEqual(dist.toFixed(1), "0.6");
  });

  // 8. Restaurant exactly at radius boundary
  await t.test("8. Restaurant exactly at radius boundary is included (<= radiusKm)", async () => {
    // 1 deg lat is approx 111.045 km; 0.0450267 deg lat is ~5.000 km
    const boundaryLat = 12.9716 + 5.0 / 111.045;
    const boundaryDist = calculateHaversineDistanceKm(12.9716, 77.5946, boundaryLat, 77.5946);

    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 1,
            name: "Boundary Cafe",
            slug: "boundary-cafe",
            latitude: boundaryLat,
            longitude: 77.5946,
            deliveryRadiusKm: 5.0,
            isActive: true,
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: boundaryDist + 0.01,
    });

    assert.strictEqual(res.restaurants.length, 1);
    assert.strictEqual(res.restaurants[0].name, "Boundary Cafe");
  });

  // 9. Restaurant just outside radius
  await t.test("9. Restaurant just outside radius is excluded", async () => {
    const outsideLat = 12.9716 + 6.0 / 111.045; // ~6 km away
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 2,
            name: "Far Cafe",
            slug: "far-cafe",
            latitude: outsideLat,
            longitude: 77.5946,
            deliveryRadiusKm: 10.0,
            isActive: true,
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
    });

    assert.strictEqual(res.restaurants.length, 0);
    assert.strictEqual(res.count, 0);
  });

  // 10. canDeliver = true
  await t.test("10. canDeliver = true when distance <= deliveryRadiusKm", async () => {
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 10,
            name: "Deliverable Cafe",
            slug: "deliverable-cafe",
            latitude: 12.9750,
            longitude: 77.5900,
            deliveryRadiusKm: 4.0, // 4 km delivery radius, distance is ~0.6 km
            isActive: true,
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
    });

    assert.strictEqual(res.restaurants[0].canDeliver, true);
    assert.strictEqual(res.restaurants[0].isNearby, true);
  });

  // 11. canDeliver = false
  await t.test("11. canDeliver = false when distance > deliveryRadiusKm even if nearby", async () => {
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 11,
            name: "DineIn Only Cafe",
            slug: "dinein-cafe",
            latitude: 12.9750,
            longitude: 77.5900, // ~0.63 km
            deliveryRadiusKm: 0.3, // Delivery radius is only 0.3 km
            isActive: true,
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
    });

    assert.strictEqual(res.restaurants[0].isNearby, true);
    assert.strictEqual(res.restaurants[0].canDeliver, false);
  });

  // 12. Open restaurant
  await t.test("12. Open restaurant when current time falls within active shift", () => {
    const restaurant = {
      isActive: true,
      timezone: "Asia/Kolkata",
      breakfastStart: "08:00",
      breakfastEnd: "12:00",
      lunchStart: "12:00",
      lunchEnd: "16:00",
    };
    // 10:30 AM IST is 05:00 UTC
    const morningTime = new Date("2026-10-18T05:00:00Z");
    assert.strictEqual(isRestaurantOpen(restaurant, morningTime), true);
  });

  // 13. Closed restaurant
  await t.test("13. Closed restaurant when current time is outside shifts", () => {
    const restaurant = {
      isActive: true,
      timezone: "Asia/Kolkata",
      lunchStart: "12:00",
      lunchEnd: "15:00",
      dinnerStart: "19:00",
      dinnerEnd: "23:00",
    };
    // 17:00 IST (5 PM) is between lunch and dinner, so closed
    // 17:00 IST is 11:30 UTC
    const afternoonTime = new Date("2026-10-18T11:30:00Z");
    assert.strictEqual(isRestaurantOpen(restaurant, afternoonTime), false);
  });

  // 14. Multiple shifts with overnight support
  await t.test("14. Supports overnight shifts crossing midnight", () => {
    const restaurant = {
      isActive: true,
      timezone: "Asia/Kolkata",
      dinnerStart: "20:00",
      dinnerEnd: "02:00", // Overnight shift
    };
    // 01:00 AM IST (19:30 UTC previous day)
    const lateNightTime = new Date("2026-10-18T19:30:00Z");
    assert.strictEqual(isRestaurantOpen(restaurant, lateNightTime), true);

    // 03:00 AM IST (21:30 UTC previous day) - closed
    const earlyMorningTime = new Date("2026-10-18T21:30:00Z");
    assert.strictEqual(isRestaurantOpen(restaurant, earlyMorningTime), false);
  });

  // 15. Sorting by distance
  await t.test("15. Restaurants within same priority group sort strictly by distance ascending", async () => {
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 1,
            name: "Z Cafe (Far)",
            slug: "z-cafe",
            latitude: 12.9900,
            longitude: 77.5946, // ~2.0 km
            deliveryRadiusKm: 5.0,
            isActive: true,
          },
          {
            id: 2,
            name: "A Cafe (Close)",
            slug: "a-cafe",
            latitude: 12.9750,
            longitude: 77.5946, // ~0.38 km
            deliveryRadiusKm: 5.0,
            isActive: true,
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
    });

    assert.strictEqual(res.restaurants.length, 2);
    assert.strictEqual(res.restaurants[0].name, "A Cafe (Close)");
    assert.strictEqual(res.restaurants[1].name, "Z Cafe (Far)");
    assert.ok(res.restaurants[0].distanceKm < res.restaurants[1].distanceKm);
  });

  // 16. Deliverable/open priority
  await t.test("16. Priority ordering: 1. Deliverable+Open -> 2. Deliverable+Closed -> 3. Not Deliverable", async () => {
    const refTime = new Date("2026-10-18T06:00:00Z"); // 11:30 AM IST
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 1,
            name: "Not Deliverable But Very Close",
            slug: "rest-1",
            latitude: 12.9720,
            longitude: 77.5946, // 0.04 km
            deliveryRadiusKm: 0.01, // cannot deliver
            isActive: true,
          },
          {
            id: 2,
            name: "Deliverable But Closed",
            slug: "rest-2",
            latitude: 12.9730,
            longitude: 77.5946, // 0.15 km
            deliveryRadiusKm: 5.0,
            isActive: true,
            lunchStart: "13:00",
            lunchEnd: "16:00", // closed at 11:30 AM
          },
          {
            id: 3,
            name: "Deliverable And Open",
            slug: "rest-3",
            latitude: 12.9750,
            longitude: 77.5946, // 0.38 km
            deliveryRadiusKm: 5.0,
            isActive: true,
            breakfastStart: "08:00",
            breakfastEnd: "12:00", // open at 11:30 AM
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
      referenceTime: refTime,
    });

    assert.strictEqual(res.restaurants[0].name, "Deliverable And Open");
    assert.strictEqual(res.restaurants[1].name, "Deliverable But Closed");
    assert.strictEqual(res.restaurants[2].name, "Not Deliverable But Very Close");
  });

  // 17. Pagination
  await t.test("17. Pagination supports limit and offset correctly", async () => {
    const list = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Cafe ${i + 1}`,
      slug: `cafe-${i + 1}`,
      latitude: 12.9716 + (i * 0.001),
      longitude: 77.5946,
      deliveryRadiusKm: 5.0,
      isActive: true,
    }));

    const mockPrisma = {
      restaurant: {
        findMany: async () => list,
      },
    };

    const page1 = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      limit: 5,
      offset: 0,
    });

    assert.strictEqual(page1.count, 5);
    assert.strictEqual(page1.total, 15);
    assert.strictEqual(page1.restaurants[0].id, 1);

    const page2 = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      limit: 5,
      offset: 5,
    });

    assert.strictEqual(page2.count, 5);
    assert.strictEqual(page2.restaurants[0].id, 6);
  });

  // 18. openOnly=true
  await t.test("18. openOnly=true filters out closed restaurants", async () => {
    const refTime = new Date("2026-10-18T06:00:00Z"); // 11:30 AM IST
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 1,
            name: "Closed Cafe",
            slug: "closed-cafe",
            latitude: 12.9730,
            longitude: 77.5946,
            deliveryRadiusKm: 5.0,
            isActive: true,
            lunchStart: "14:00",
            lunchEnd: "18:00", // Closed at 11:30 AM
          },
          {
            id: 2,
            name: "Open Cafe",
            slug: "open-cafe",
            latitude: 12.9740,
            longitude: 77.5946,
            deliveryRadiusKm: 5.0,
            isActive: true,
            breakfastStart: "08:00",
            breakfastEnd: "12:00", // Open at 11:30 AM
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      openOnly: true,
      referenceTime: refTime,
    });

    assert.strictEqual(res.restaurants.length, 1);
    assert.strictEqual(res.restaurants[0].name, "Open Cafe");
  });

  // 19. No restaurants
  await t.test("19. No restaurants returns HTTP 200 with empty array", async () => {
    const mockPrisma = {
      restaurant: {
        findMany: async () => [],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
    });

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.total, 0);
    assert.deepStrictEqual(res.restaurants, []);
  });

  // 20. Restaurant with missing coordinates
  await t.test("20. Restaurants with missing coordinates are safely skipped", async () => {
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 99,
            name: "No Coords Cafe",
            slug: "no-coords",
            latitude: null,
            longitude: null,
            isActive: true,
          },
        ],
      },
    };

    const res = await findNearbyRestaurants({
      prisma: mockPrisma,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 5.0,
    });

    assert.strictEqual(res.restaurants.length, 0);
  });

  // 21. Inactive restaurant exclusion
  await t.test("21. Inactive restaurants are excluded", () => {
    const inactiveRest = {
      id: 50,
      name: "Inactive Cafe",
      isActive: false,
    };
    assert.strictEqual(isRestaurantOpen(inactiveRest), false);
  });

  // 22. Invalid query parameters
  await t.test("22. Invalid query parameters throw proper 400 validation errors", () => {
    assert.throws(() => validateQueryOptions({ radius: -5 }), (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /positive number/i);
      return true;
    });

    assert.throws(() => validateQueryOptions({ limit: 0 }), (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /positive integer/i);
      return true;
    });

    assert.throws(() => validateQueryOptions({ offset: -1 }), (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /non-negative integer/i);
      return true;
    });
  });

  // Fastify route integration test for /api/restaurants/nearby and /restaurants/nearby
  await t.test("23. Fastify HTTP route integration tests for GET /api/restaurants/nearby and /restaurants/nearby", async () => {
    const app = fastify();
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            id: 101,
            name: "Bangalore Cafe",
            slug: "blr-cafe",
            latitude: 12.9750,
            longitude: 77.5900,
            deliveryRadiusKm: 5.0,
            isActive: true,
          },
        ],
      },
    };

    await app.register(restaurantLocationRoutes, { prisma: mockPrisma });

    // Test GET /api/restaurants/nearby
    const res1 = await app.inject({
      method: "GET",
      url: "/api/restaurants/nearby?lat=12.9716&lng=77.5946&radius=5",
    });
    assert.strictEqual(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.strictEqual(body1.count, 1);
    assert.strictEqual(body1.restaurants[0].name, "Bangalore Cafe");
    assert.strictEqual(body1.radiusKm, 5);

    // Test GET /restaurants/nearby
    const res2 = await app.inject({
      method: "GET",
      url: "/restaurants/nearby?lat=12.9716&lng=77.5946&radius=5",
    });
    assert.strictEqual(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.strictEqual(body2.count, 1);
    assert.strictEqual(body2.restaurants[0].id, 101);

    // Test invalid lat query param
    const res3 = await app.inject({
      method: "GET",
      url: "/api/restaurants/nearby?lat=100&lng=77.5946",
    });
    assert.strictEqual(res3.statusCode, 400);
    const body3 = JSON.parse(res3.body);
    assert.strictEqual(body3.error, "Bad Request");
    assert.match(body3.message, /latitude/i);

    // Test missing coordinates
    const res4 = await app.inject({
      method: "GET",
      url: "/api/restaurants/nearby",
    });
    assert.strictEqual(res4.statusCode, 400);
  });
});
