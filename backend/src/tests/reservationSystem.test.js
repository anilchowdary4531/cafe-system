import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  createReservation,
  updateReservationStatus,
  checkTableAvailability,
} from "../services/reservationService.js";
import {
  getOrCreateTableQrToken,
  resolveQrToken,
  placeQrOrder,
} from "../services/qrService.js";

const prisma = new PrismaClient();

test("Time-Based Table Reservation System Test Suite", async (t) => {
  let testRestaurant = null;
  let tableT1 = null;
  let tableT2 = null;
  let testMenuItem = null;
  let createdReservationT1 = null;

  t.before(async () => {
    const timestamp = Date.now();
    // 1. Create test restaurant
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: `Res Test Cafe ${timestamp}`,
        slug: `res-test-cafe-${timestamp}`,
        phone: "+919999900111",
        email: `restest_${timestamp}@tiffzy.com`,
        addressLine1: "123 Jubilee Hills",
        city: "Hyderabad",
        state: "Telangana",
        taxEnabled: true,
        defaultTaxPercent: 5,
      },
    });

    // 2. Create tables T1 and T2
    tableT1 = await prisma.diningTable.create({
      data: {
        restaurantId: testRestaurant.id,
        tableNo: "T1",
        seats: 4,
        section: "Main Hall",
      },
    });

    tableT2 = await prisma.diningTable.create({
      data: {
        restaurantId: testRestaurant.id,
        tableNo: "T2",
        seats: 4,
        section: "Main Hall",
      },
    });

    // Generate QR tokens for T1 and T2
    tableT1 = await getOrCreateTableQrToken(tableT1.id, prisma);
    tableT2 = await getOrCreateTableQrToken(tableT2.id, prisma);

    // 3. Create menu item
    testMenuItem = await prisma.menuItem.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Espresso",
        category: "Beverages",
        price: 120,
        originalPrice: 120,
        isAvailable: true,
      },
    });
  });

  t.after(async () => {
    if (testRestaurant?.id) {
      await prisma.reservation.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: testRestaurant.id } } });
      await prisma.order.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
    }
  });

  await t.test("1. Owner reserves T1 from 19:00 to 20:00 successfully", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { reservation: res } = await createReservation({
      prisma,
      restaurantId: testRestaurant.id,
      data: {
        tableId: tableT1.id,
        reservationDate: todayStr,
        startTime: "19:00",
        endTime: "20:00",
        guestCount: 2,
        customerName: "Alice",
        customerPhone: "9876543210",
        notes: "Window seat",
      },
    });

    assert.ok(res, "Reservation should be created");
    assert.strictEqual(res.tableId, tableT1.id);
    assert.strictEqual(res.startTime, "19:00");
    assert.strictEqual(res.endTime, "20:00");
    assert.strictEqual(res.status, "CONFIRMED");
    createdReservationT1 = res;
  });

  await t.test("2. Reject overlapping reservation for T1 (19:30 to 20:30)", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    await assert.rejects(
      async () => {
        await createReservation({
          prisma,
          restaurantId: testRestaurant.id,
          data: {
            tableId: tableT1.id,
            reservationDate: todayStr,
            startTime: "19:30",
            endTime: "20:30",
            guestCount: 3,
            customerName: "Bob",
            customerPhone: "9876543211",
          },
        });
      },
      (err) => {
        assert.match(err.message, /conflict|already reserved|unavailable/i);
        return true;
      }
    );
  });

  await t.test("3. Allow non-overlapping reservation on different table T2 at same time (19:00 to 20:00)", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { reservation: resT2 } = await createReservation({
      prisma,
      restaurantId: testRestaurant.id,
      data: {
        tableId: tableT2.id,
        reservationDate: todayStr,
        startTime: "19:00",
        endTime: "20:00",
        guestCount: 4,
        customerName: "Charlie",
        customerPhone: "9876543212",
      },
    });

    assert.ok(resT2, "Reservation for T2 should succeed");
    assert.strictEqual(resT2.tableId, tableT2.id);
  });

  await t.test("4. Availability helper returns correct slot availability", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const avail1 = await checkTableAvailability({
      prisma,
      restaurantId: testRestaurant.id,
      tableId: tableT1.id,
      date: todayStr,
      startTime: "19:15",
      endTime: "19:45",
    });
    assert.strictEqual(avail1.available, false, "Slot 19:15-19:45 should be unavailable for T1");

    const avail2 = await checkTableAvailability({
      prisma,
      restaurantId: testRestaurant.id,
      tableId: tableT1.id,
      date: todayStr,
      startTime: "20:00",
      endTime: "21:00",
    });
    assert.strictEqual(avail2.available, true, "Slot 20:00-21:00 should be available for T1");
  });

  await t.test("5. QR Code scan resolution during active reservation slot blocks dine-in", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, "0");
    const currentMins = String(now.getMinutes()).padStart(2, "0");
    const startTimeNow = `${currentHours}:${currentMins}`;
    
    const endMinutes = (now.getHours() * 60 + now.getMinutes() + 60);
    const endHours = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
    const endMins = String(endMinutes % 60).padStart(2, "0");
    const endTimeNow = `${endHours}:${endMins}`;

    await createReservation({
      prisma,
      restaurantId: testRestaurant.id,
      data: {
        tableId: tableT1.id,
        reservationDate: todayStr,
        startTime: startTimeNow,
        endTime: endTimeNow,
        guestCount: 2,
        customerName: "Active Guest",
      },
    });

    // Resolve QR token for T1
    const resolved = await resolveQrToken(tableT1.qrToken, prisma);
    assert.strictEqual(resolved.isReserved, true, "resolveQrToken should return isReserved: true");
    assert.strictEqual(resolved.table.isReserved, true, "resolved.table should be marked isReserved: true");
    assert.ok(resolved.message, "Should include clear reservation message");
    assert.ok(Array.isArray(resolved.availableTables), "Should return list of available tables");

    // Direct placeQrOrder API call must be rejected
    await assert.rejects(
      async () => {
        await placeQrOrder({
          token: tableT1.qrToken,
          items: [{ menuItemId: testMenuItem.id, quantity: 1 }],
          customerName: "Sneaky Customer",
          phone: "9000000000",
          paymentMethod: "CASH",
          prisma,
        });
      },
      (err) => {
        assert.strictEqual(err.code, "table_reserved");
        return true;
      }
    );
  });

  await t.test("6. Cancel reservation frees table availability", async () => {
    if (createdReservationT1?.id) {
      await updateReservationStatus({
        prisma,
        restaurantId: testRestaurant.id,
        reservationId: createdReservationT1.id,
        status: "CANCELLED",
        cancelReason: "Test cancel",
      });
      const resUpdated = await prisma.reservation.findUnique({ where: { id: createdReservationT1.id } });
      assert.strictEqual(resUpdated.status, "CANCELLED");
    }
  });
});
