import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  createDeliveryPartner,
  getDeliveryPartners,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  assignDeliveryPartner,
  reassignDeliveryPartner,
  updateDeliveryStatus,
  updateDriverLocation,
  getDeliveryTrackingForCustomer,
  getRestaurantDeliveries,
  getDriverDeliveries,
  getDeliveryMetricsReport,
} from "../services/deliveryService.js";

const prisma = new PrismaClient();

test("Feature 16 — Delivery Management & Live Order Tracking System Test", async (t) => {
  let testRestaurant = null;
  let testOrder = null;
  let partner1 = null;
  let partner2 = null;
  let testDelivery = null;

  t.before(async () => {
    // Setup test restaurant
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: `Delivery Test Resto ${Date.now()}`,
        slug: `delivery-test-${Date.now()}`,
        phone: "+919999988888",
        addressLine1: "123 Food Street, Jubilee Hills",
        city: "Hyderabad",
        latitude: 17.4325,
        longitude: 78.4071,
      },
    });

    // Setup test delivery order
    testOrder = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `TS-DEL-${Date.now()}`,
        customerName: "Anil Kumar",
        phone: "+919876543210",
        deliveryAddress: "Flat 402, Sunshine Heights, Madhapur, Hyderabad",
        deliveryLatitude: 17.4483,
        deliveryLongitude: 78.3915,
        orderSource: "DELIVERY",
        fulfillment: "DELIVERY",
        subtotal: 500,
        taxAmount: 25,
        serviceChargeAmount: 0,
        total: 525,
        paymentMode: "COD",
        paymentStatus: "PENDING",
        status: "PREPARING",
      },
    });
  });

  t.after(async () => {
    if (testOrder) {
      await prisma.delivery.deleteMany({ where: { orderId: testOrder.id } }).catch(() => {});
      await prisma.order.delete({ where: { id: testOrder.id } }).catch(() => {});
    }
    if (partner1) {
      await prisma.deliveryPartner.delete({ where: { id: partner1.id } }).catch(() => {});
    }
    if (partner2) {
      await prisma.deliveryPartner.delete({ where: { id: partner2.id } }).catch(() => {});
    }
    if (testRestaurant) {
      await prisma.restaurant.delete({ where: { id: testRestaurant.id } }).catch(() => {});
    }
  });

  await t.test("1. Delivery Partner Management (Create & List)", async () => {
    partner1 = await createDeliveryPartner({
      prisma,
      restaurantId: testRestaurant.id,
      name: "Ramesh Rider",
      phone: "+919876500001",
      email: "ramesh@tiffzy.com",
      vehicleType: "BIKE",
      vehicleNumber: "TS09-EZ-1111",
    });

    assert.ok(partner1.id, "Partner 1 created");
    assert.equal(partner1.status, "AVAILABLE");
    assert.equal(partner1.isActive, true);

    partner2 = await createDeliveryPartner({
      prisma,
      restaurantId: testRestaurant.id,
      name: "Suresh Scooter",
      phone: "+919876500002",
      vehicleType: "SCOOTER",
      vehicleNumber: "TS07-FX-2222",
    });

    assert.ok(partner2.id, "Partner 2 created");

    const partners = await getDeliveryPartners({
      prisma,
      restaurantId: testRestaurant.id,
    });

    assert.equal(partners.length, 2, "Both partners returned for restaurant");
  });

  await t.test("2. Delivery Assignment to Order", async () => {
    testDelivery = await assignDeliveryPartner({
      prisma,
      restaurantId: testRestaurant.id,
      orderId: testOrder.id,
      partnerId: partner1.id,
    });

    assert.ok(testDelivery.id, "Delivery record created");
    assert.equal(testDelivery.status, "ASSIGNED");
    assert.equal(testDelivery.deliveryPartnerId, partner1.id);
    assert.equal(testDelivery.deliveryAddressSnapshot, testOrder.deliveryAddress);

    // Verify partner is marked BUSY
    const updatedP1 = await prisma.deliveryPartner.findUnique({ where: { id: partner1.id } });
    assert.equal(updatedP1.status, "BUSY");
  });

  await t.test("3. Delivery Reassignment to Another Partner", async () => {
    const reassigned = await reassignDeliveryPartner({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      newPartnerId: partner2.id,
      reason: "Driver 1 vehicle issue",
    });

    assert.equal(reassigned.deliveryPartnerId, partner2.id);

    // Partner 1 freed back to AVAILABLE, Partner 2 set to BUSY
    const updatedP1 = await prisma.deliveryPartner.findUnique({ where: { id: partner1.id } });
    const updatedP2 = await prisma.deliveryPartner.findUnique({ where: { id: partner2.id } });
    assert.equal(updatedP1.status, "AVAILABLE");
    assert.equal(updatedP2.status, "BUSY");
  });

  await t.test("4. Valid Delivery Lifecycle State Transitions", async () => {
    // ASSIGNED -> ACCEPTED
    let d = await updateDeliveryStatus({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      nextStatus: "ACCEPTED",
    });
    assert.equal(d.status, "ACCEPTED");
    assert.ok(d.acceptedAt);

    // ACCEPTED -> REACHED_RESTAURANT
    d = await updateDeliveryStatus({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      nextStatus: "REACHED_RESTAURANT",
    });
    assert.equal(d.status, "REACHED_RESTAURANT");

    // REACHED_RESTAURANT -> PICKED_UP
    d = await updateDeliveryStatus({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      nextStatus: "PICKED_UP",
    });
    assert.equal(d.status, "PICKED_UP");

    // PICKED_UP -> OUT_FOR_DELIVERY
    d = await updateDeliveryStatus({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      nextStatus: "OUT_FOR_DELIVERY",
    });
    assert.equal(d.status, "OUT_FOR_DELIVERY");
    assert.ok(d.outForDeliveryAt);
  });

  await t.test("5. Reject Invalid Delivery Transitions & Enforce Idempotency", async () => {
    // OUT_FOR_DELIVERY -> ACCEPTED should throw error
    await assert.rejects(
      async () => {
        await updateDeliveryStatus({
          prisma,
          restaurantId: testRestaurant.id,
          deliveryId: testDelivery.id,
          nextStatus: "ACCEPTED",
        });
      },
      /Invalid status transition/
    );

    // Repeated call to same status returns cleanly (idempotency)
    const same = await updateDeliveryStatus({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      nextStatus: "OUT_FOR_DELIVERY",
    });
    assert.equal(same.status, "OUT_FOR_DELIVERY");
  });

  await t.test("6. Driver Live Location Updates & Coordinate Validation", async () => {
    const locRes = await updateDriverLocation({
      prisma,
      deliveryId: testDelivery.id,
      lat: 17.4400,
      lng: 78.3950,
    });

    assert.ok(locRes.ok);
    assert.equal(locRes.latitude, 17.4400);
    assert.equal(locRes.longitude, 78.3950);

    // Out of bound coordinates rejected
    await assert.rejects(
      async () => {
        await updateDriverLocation({
          prisma,
          deliveryId: testDelivery.id,
          lat: 150.0,
          lng: 78.3950,
        });
      },
      /Coordinates out of range/
    );
  });

  await t.test("7. Customer Live Order Tracking Lookup", async () => {
    const tracking = await getDeliveryTrackingForCustomer({
      prisma,
      orderId: testOrder.id,
      phone: testOrder.phone,
    });

    assert.equal(tracking.orderId, testOrder.id);
    assert.equal(tracking.restaurant.name, testRestaurant.name);
    assert.equal(tracking.delivery.status, "OUT_FOR_DELIVERY");
    assert.ok(tracking.delivery.driverLocation);
    assert.equal(tracking.delivery.driverLocation.latitude, 17.4400);

    // Privacy check failure for wrong phone
    await assert.rejects(
      async () => {
        await getDeliveryTrackingForCustomer({
          prisma,
          orderId: testOrder.id,
          phone: "+910000000000",
        });
      },
      /Access denied/
    );
  });

  await t.test("8. Complete Delivery & Verify Order / COD Payment Sync", async () => {
    const completed = await updateDeliveryStatus({
      prisma,
      restaurantId: testRestaurant.id,
      deliveryId: testDelivery.id,
      nextStatus: "DELIVERED",
    });

    assert.equal(completed.status, "DELIVERED");
    assert.ok(completed.deliveredAt);

    // Check Order status synced to DELIVERED and COD payment status synced to SUCCESS
    const updatedOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
    assert.equal(updatedOrder.status, "DELIVERED");
    assert.equal(updatedOrder.paymentStatus, "SUCCESS");

    // Partner 2 set back to AVAILABLE
    const updatedP2 = await prisma.deliveryPartner.findUnique({ where: { id: partner2.id } });
    assert.equal(updatedP2.status, "AVAILABLE");
  });

  await t.test("9. Delivery Metrics Report", async () => {
    const report = await getDeliveryMetricsReport({
      prisma,
      restaurantId: testRestaurant.id,
    });

    assert.equal(report.totalDeliveries, 1);
    assert.equal(report.completed, 1);
    assert.equal(report.partnerReport.length, 1);
    assert.equal(report.partnerReport[0].name, partner2.name);
  });
});
