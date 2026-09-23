import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  getOrCreatePublicMenuToken,
  regeneratePublicMenuToken,
  resolvePublicMenuToken,
  updatePublicMenuSettings,
  placePublicMenuOrder,
  resolveQrToken,
} from "../services/qrService.js";

const prisma = new PrismaClient();

test("FEATURE 18 — Digital Menu QR & Public Self-Service Menu Test Suite", async (t) => {
  let restA = null;
  let restB = null;
  let itemA1 = null;
  let itemA2 = null;

  t.before(async () => {
    const ts = Date.now();
    // 1. Create Restaurant A
    restA = await prisma.restaurant.create({
      data: {
        name: `Digital Menu Cafe A ${ts}`,
        slug: `digital-menu-a-${ts}`,
        phone: "+919876543201",
        email: `digitalmenu_a_${ts}@tiffzy.com`,
        addressLine1: "Road No 1, Jubilee Hills",
        city: "Hyderabad",
        state: "Telangana",
        taxEnabled: true,
        defaultTaxPercent: 5,
        isPublicMenuEnabled: true,
        isPublicOrderingEnabled: true,
      },
    });

    // 2. Create Restaurant B for multi-tenant isolation testing
    restB = await prisma.restaurant.create({
      data: {
        name: `Digital Menu Cafe B ${ts}`,
        slug: `digital-menu-b-${ts}`,
        phone: "+919876543202",
        email: `digitalmenu_b_${ts}@tiffzy.com`,
        addressLine1: "Sector 5, Hitech City",
        city: "Hyderabad",
        state: "Telangana",
      },
    });

    // 3. Create Menu Items for Restaurant A
    itemA1 = await prisma.menuItem.create({
      data: {
        restaurantId: restA.id,
        name: "Iced Cappuccino",
        category: "Beverages",
        price: 180,
        originalPrice: 180,
        isAvailable: true,
      },
    });

    itemA2 = await prisma.menuItem.create({
      data: {
        restaurantId: restA.id,
        name: "Truffle Pasta",
        category: "Main Course",
        price: 420,
        originalPrice: 420,
        isAvailable: true,
      },
    });
  });

  t.after(async () => {
    // Clean up test data
    if (restA?.id) {
      await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restA.id } } });
      await prisma.order.deleteMany({ where: { restaurantId: restA.id } });
      await prisma.tableSession.deleteMany({ where: { restaurantId: restA.id } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: restA.id } });
      await prisma.restaurant.delete({ where: { id: restA.id } });
    }
    if (restB?.id) {
      await prisma.restaurant.delete({ where: { id: restB.id } });
    }
  });

  await t.test("1. Generate Public Menu Token", async () => {
    const restaurant = await getOrCreatePublicMenuToken(restA.id, prisma);
    assert.ok(restaurant.publicMenuToken, "publicMenuToken should exist");
    assert.strictEqual(typeof restaurant.publicMenuToken, "string");
    assert.ok(restaurant.publicMenuToken.length >= 16);
    restA.publicMenuToken = restaurant.publicMenuToken;
  });

  await t.test("2. Resolve Public Digital Menu (Menu-Only Mode: No TableSession Created)", async () => {
    const initialSessionCount = await prisma.tableSession.count({
      where: { restaurantId: restA.id },
    });

    const resolved = await resolvePublicMenuToken(restA.publicMenuToken, prisma);
    assert.strictEqual(resolved.restaurant.id, restA.id);
    assert.strictEqual(resolved.restaurant.name, restA.name);
    assert.strictEqual(resolved.restaurant.isPublicMenuEnabled, true);
    assert.ok(Array.isArray(resolved.menu));
    assert.ok(resolved.menu.length >= 2);

    const finalSessionCount = await prisma.tableSession.count({
      where: { restaurantId: restA.id },
    });
    assert.strictEqual(
      finalSessionCount,
      initialSessionCount,
      "Resolving digital menu MUST NOT create any TableSession"
    );
  });

  await t.test("3. Update Digital Menu Settings", async () => {
    const updated = await updatePublicMenuSettings(
      restA.id,
      {
        showPricesOnPublicMenu: false,
        isPublicOrderingEnabled: true,
      },
      prisma
    );

    assert.strictEqual(updated.showPricesOnPublicMenu, false);
    assert.strictEqual(updated.isPublicOrderingEnabled, true);

    const resolved = await resolvePublicMenuToken(restA.publicMenuToken, prisma);
    assert.strictEqual(resolved.restaurant.showPricesOnPublicMenu, false);

    // Reset settings for next tests
    await updatePublicMenuSettings(restA.id, { showPricesOnPublicMenu: true }, prisma);
  });

  await t.test("4. Place Order via Public Digital Menu (Takeaway / Non-Table)", async () => {
    const initialSessionCount = await prisma.tableSession.count({
      where: { restaurantId: restA.id },
    });

    const orderRes = await placePublicMenuOrder({
      token: restA.publicMenuToken,
      customerName: "Rohan Varma",
      phone: "+919123456789",
      fulfillment: "TAKEAWAY",
      items: [{ menuItemId: itemA1.id, qty: 2 }],
      prisma,
    });

    assert.ok(orderRes.order, "Order should be created");
    assert.strictEqual(orderRes.order.orderSource, "DIGITAL_MENU");
    assert.strictEqual(orderRes.order.fulfillment, "TAKEAWAY");
    assert.strictEqual(orderRes.order.tableNo, null, "Digital Menu order must not have a tableNo");
    assert.strictEqual(orderRes.order.tableSessionId, null, "Digital Menu order must not have a tableSessionId");

    const finalSessionCount = await prisma.tableSession.count({
      where: { restaurantId: restA.id },
    });
    assert.strictEqual(
      finalSessionCount,
      initialSessionCount,
      "Digital menu ordering MUST NOT create a TableSession"
    );
  });

  await t.test("5. Disabled Menu Security Check", async () => {
    await updatePublicMenuSettings(restA.id, { isPublicMenuEnabled: false }, prisma);

    await assert.rejects(
      async () => {
        await resolvePublicMenuToken(restA.publicMenuToken, prisma);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      },
      "Resolving disabled public menu should return 403"
    );

    // Re-enable public menu
    await updatePublicMenuSettings(restA.id, { isPublicMenuEnabled: true }, prisma);
  });

  await t.test("6. Regenerate Public Menu Token Security", async () => {
    const oldToken = restA.publicMenuToken;
    const regenerated = await regeneratePublicMenuToken(restA.id, prisma);
    const newToken = regenerated.publicMenuToken;

    assert.notStrictEqual(oldToken, newToken, "New token must differ from old token");

    // Old token resolution must fail
    await assert.rejects(
      async () => {
        await resolvePublicMenuToken(oldToken, prisma);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );

    // New token resolves successfully
    const resolvedNew = await resolvePublicMenuToken(newToken, prisma);
    assert.strictEqual(resolvedNew.restaurant.id, restA.id);
  });
});
