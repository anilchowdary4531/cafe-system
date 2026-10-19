import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import superAdminRoutes from "../routes/superAdmin.js";

const sampleRestaurants = [
  {
    id: 1,
    name: "Cafe King",
    legalName: "Cafe King Foods Pvt Ltd",
    slug: "cafeking",
    ownerName: "Anil Kumar",
    email: "cafeking@tiffzy.com",
    phone: "9876543210",
    addressLine1: "123 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "560001",
    latitude: 12.9750,
    longitude: 77.5900,
    deliveryRadiusKm: 6.5,
    logoUrl: "https://example.com/logo1.png",
    bannerUrl: "https://example.com/banner1.png",
    brandColor: "#fe5102",
    isActive: true,
    timezone: "Asia/Kolkata",
    breakfastStart: "07:00",
    breakfastEnd: "11:30",
    lunchStart: "11:30",
    lunchEnd: "16:00",
    dinnerStart: "16:00",
    dinnerEnd: "23:00",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: "Tiffzy Cloud Kitchen",
    legalName: null,
    slug: "tiffzy-cloud",
    ownerName: "Priya Rao",
    email: "priya@tiffzy.com",
    phone: "9876543211",
    addressLine1: "45 Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "560038",
    latitude: 12.9784,
    longitude: 77.6408,
    deliveryRadiusKm: 4.0,
    logoUrl: null,
    bannerUrl: null,
    brandColor: null,
    isActive: false,
    timezone: "Asia/Kolkata",
    breakfastStart: null,
    breakfastEnd: null,
    lunchStart: null,
    lunchEnd: null,
    dinnerStart: null,
    dinnerEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: "Missing Lat Restaurant",
    legalName: null,
    slug: "missing-lat",
    ownerName: "Rohan",
    email: "rohan@tiffzy.com",
    phone: "9876543212",
    addressLine1: "Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "560066",
    latitude: null,
    longitude: 77.7500,
    deliveryRadiusKm: 5.0,
    logoUrl: null,
    bannerUrl: null,
    brandColor: null,
    isActive: true,
    timezone: "Asia/Kolkata",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 4,
    name: "Missing Both Coords Restaurant",
    legalName: null,
    slug: "missing-both",
    ownerName: "Vikram",
    email: "vikram@tiffzy.com",
    phone: "9876543213",
    addressLine1: "Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "560034",
    latitude: null,
    longitude: null,
    deliveryRadiusKm: 5.0,
    isActive: true,
    timezone: "Asia/Kolkata",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 5,
    name: "Zero Zero Coords Restaurant",
    legalName: null,
    slug: "zero-zero",
    ownerName: "Dev",
    email: "dev@tiffzy.com",
    phone: "9876543214",
    addressLine1: "Null Island",
    city: "Unknown",
    state: "Unknown",
    country: "India",
    pincode: "000000",
    latitude: 0,
    longitude: 0,
    deliveryRadiusKm: 3.0,
    isActive: true,
    timezone: "Asia/Kolkata",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockPrisma = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === 1) return { id: 1, role: "SUPER_ADMIN", isActive: true, sessionVersion: 0 };
      if (where.id === 2) return { id: 2, role: "CHEF", isActive: true, sessionVersion: 0 };
      return null;
    },
  },
  restaurant: {
    findMany: async () => sampleRestaurants,
  },
};

const dummyDeps = {
  prisma: mockPrisma,
  STAFF_ACCESS_MODULES: ["DASHBOARD", "SETTINGS"],
  STAFF_ALLOWED_ROLES: ["OWNER", "SUPER_ADMIN", "CHEF"],
};

test("Super Admin Restaurant Location Map API", async (t) => {
  const app = fastify();
  await app.register(fastifyJwt, { secret: "test-superadmin-secret" });
  await app.register(superAdminRoutes, dummyDeps);

  const superAdminToken = app.jwt.sign({ id: 1, role: "SUPER_ADMIN", type: "staff", sessionVersion: 0 });
  const chefToken = app.jwt.sign({ id: 2, role: "CHEF", type: "staff", sessionVersion: 0 });

  await t.test("Reject unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/restaurants/map",
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test("Reject non-super-admin requests with 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/restaurants/map",
      headers: { authorization: `Bearer ${chefToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  await t.test("Super Admin can fetch restaurant map via /super-admin/restaurants/map", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/super-admin/restaurants/map",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);

    const { totalRestaurants, locatedRestaurants, missingLocationRestaurants, activeRestaurants, inactiveRestaurants, restaurants } = body.data;

    assert.equal(totalRestaurants, 5);
    // Located: Cafe King (1), Tiffzy Cloud Kitchen (2)
    assert.equal(locatedRestaurants, 2);
    // Missing: Missing Lat (3), Missing Both (4), Zero Zero (5)
    assert.equal(missingLocationRestaurants, 3);
    // Active: 1, 3, 4, 5 = 4
    assert.equal(activeRestaurants, 4);
    // Inactive: 2 = 1
    assert.equal(inactiveRestaurants, 1);
    assert.equal(restaurants.length, 5);

    // Verify Cafe King
    const cafeKing = restaurants.find((r) => r.slug === "cafeking");
    assert.ok(cafeKing);
    assert.equal(cafeKing.hasValidLocation, true);
    assert.equal(cafeKing.latitude, 12.975);
    assert.equal(cafeKing.longitude, 77.59);
    assert.equal(cafeKing.deliveryRadiusKm, 6.5);
    assert.equal(cafeKing.isActive, true);

    // Verify Zero Zero is flagged as missing location and coordinates sanitized to null
    const zeroZero = restaurants.find((r) => r.slug === "zero-zero");
    assert.ok(zeroZero);
    assert.equal(zeroZero.hasValidLocation, false);
    assert.equal(zeroZero.latitude, null);
    assert.equal(zeroZero.longitude, null);

    // Verify missing lat is flagged as missing location
    const missingLat = restaurants.find((r) => r.slug === "missing-lat");
    assert.ok(missingLat);
    assert.equal(missingLat.hasValidLocation, false);
    assert.equal(missingLat.latitude, null);
  });

  await t.test("Super Admin can also fetch restaurant map via alias /api/superadmin/restaurants/map", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/superadmin/restaurants/map",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.totalRestaurants, 5);
  });
});
