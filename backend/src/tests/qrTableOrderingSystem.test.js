import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  getOrCreateTableQrToken,
  regenerateTableQrToken,
  resolveQrToken,
  placeQrOrder,
  ensureRestaurantQrTokens,
} from "../services/qrService.js";

const prisma = new PrismaClient();

test("FEATURE 17 — QR Table Ordering & Scan-to-Order System Test Suite", async (t) => {
  let testRestaurant = null;
  let testTable = null;
  let testMenuItem1 = null;
  let testMenuItem2 = null;

  t.before(async () => {
    // 1. Create test restaurant
    const timestamp = Date.now();
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: `QR Test Cafe ${timestamp}`,
        slug: `qr-test-cafe-${timestamp}`,
        phone: "+919876500111",
        email: `qrtest_${timestamp}@tiffzy.com`,
        addressLine1: "Plot 42, Hitech City",
        city: "Hyderabad",
        state: "Telangana",
        taxEnabled: true,
        defaultTaxPercent: 5,
      },
    });

    // 2. Create test table without initial token
    testTable = await prisma.diningTable.create({
      data: {
        restaurantId: testRestaurant.id,
        tableNo: "QR-101",
        seats: 4,
        section: "Patio",
      },
    });

    // 3. Create test menu items
    testMenuItem1 = await prisma.menuItem.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Cold Coffee",
        category: "Beverages",
        price: 150,
        originalPrice: 150,
        isAvailable: true,
      },
    });

    testMenuItem2 = await prisma.menuItem.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Cheese Pizza",
        category: "Main Course",
        price: 350,
        originalPrice: 350,
        isAvailable: true,
      },
    });
  });

  t.after(async () => {
    // Cleanup test data
    if (testRestaurant?.id) {
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: testRestaurant.id } } });
      await prisma.order.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: testRestaurant.id } });
      await prisma.restaurant.delete({ where: { id: testRestaurant.id } });
    }
  });

  await t.test("1. Get or Create Table QR Token", async () => {
    const tableWithToken = await getOrCreateTableQrToken(testTable.id, prisma);
    assert.ok(tableWithToken.qrToken, "Table should have a non-empty qrToken");
    assert.strictEqual(typeof tableWithToken.qrToken, "string");
    assert.ok(tableWithToken.qrToken.length >= 16, "qrToken should be at least 16 chars long");
    testTable = tableWithToken;
  });

  await t.test("2. Resolve Public QR Token", async () => {
    const resolved = await resolveQrToken(testTable.qrToken, prisma);
    assert.strictEqual(resolved.restaurant.id, testRestaurant.id);
    assert.strictEqual(resolved.restaurant.name, testRestaurant.name);
    assert.strictEqual(resolved.table.tableNo, "QR-101");
    assert.strictEqual(resolved.table.qrToken, testTable.qrToken);
    assert.ok(Array.isArray(resolved.menu), "Menu should be returned as array");
    assert.ok(resolved.menu.length >= 2, "Menu should contain at least 2 items");
    assert.strictEqual(resolved.activeSession, null, "Initially no active session");
  });

  await t.test("3. Concurrent QR Order Placement (Shared TableSession)", async () => {
    // Customer A scans and places order
    const orderA = await placeQrOrder({
      token: testTable.qrToken,
      customerName: "Alice",
      phone: "+919876543210",
      items: [{ menuItemId: testMenuItem1.id, qty: 2 }],
      prisma,
    });

    assert.ok(orderA.order, "Order A should be created");
    assert.strictEqual(orderA.order.orderSource, "QR");
    assert.strictEqual(orderA.order.customerName, "Alice");
    assert.ok(orderA.session, "Session should be created");
    const firstSessionId = orderA.session.id;

    // Customer B scans SAME QR code concurrently and places another order
    const orderB = await placeQrOrder({
      token: testTable.qrToken,
      customerName: "Bob",
      phone: "+919876543211",
      items: [{ menuItemId: testMenuItem2.id, qty: 1 }],
      prisma,
    });

    assert.ok(orderB.order, "Order B should be created");
    assert.strictEqual(orderB.order.orderSource, "QR");
    assert.strictEqual(orderB.order.customerName, "Bob");
    assert.strictEqual(
      orderB.session.id,
      firstSessionId,
      "Both orders on same table must share the exact same active TableSession"
    );

    // Verify resolved token now reflects active session with both orders
    const resolvedAfterOrders = await resolveQrToken(testTable.qrToken, prisma);
    assert.ok(resolvedAfterOrders.activeSession, "Active session should now exist");
    assert.strictEqual(resolvedAfterOrders.activeSession.sessionId, firstSessionId);
    assert.strictEqual(resolvedAfterOrders.activeSession.orderCount, 2);
  });

  await t.test("4. Regenerate QR Token Security Test", async () => {
    const oldToken = testTable.qrToken;
    const regeneratedTable = await regenerateTableQrToken(testTable.id, prisma);
    const newToken = regeneratedTable.qrToken;

    assert.notStrictEqual(oldToken, newToken, "New token must differ from old token");

    // Old token should fail resolution
    await assert.rejects(
      async () => {
        await resolveQrToken(oldToken, prisma);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        return true;
      },
      "Resolving old QR token should return 404"
    );

    // New token should resolve successfully and retain the active table session
    const resolvedNew = await resolveQrToken(newToken, prisma);
    assert.strictEqual(resolvedNew.table.tableNo, "QR-101");
    assert.ok(resolvedNew.activeSession, "Active table session must remain intact");
  });

  await t.test("5. Batch Ensure Restaurant QR Tokens", async () => {
    const tables = await ensureRestaurantQrTokens(testRestaurant.id, prisma);
    assert.ok(Array.isArray(tables), "Should return array of tables");
    assert.ok(tables.every((t) => typeof t.qrToken === "string" && t.qrToken.length > 0));
  });
});
