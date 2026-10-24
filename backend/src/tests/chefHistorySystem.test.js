import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
  KitchenAssignmentError,
  getChefHistory,
} from "../services/kitchenAssignmentService.js";
import { updateKotItemStatus } from "../services/kotService.js";

test("Chef History & Date-wise Preparation Audit Test Suite", async (t) => {
  let restaurantA = null;
  let restaurantB = null;
  let chefRavi = null;
  let chefSuresh = null;
  let chefOtherRest = null;
  let seniorChef = null;
  let order1 = null;
  let kot1 = null;
  let kot2 = null;
  let item1 = null;
  let item2 = null;
  let item3 = null;
  let item4 = null;
  let itemCancel = null;

  t.before(async () => {
    // 1. Setup primary restaurant A
    restaurantA = await prisma.restaurant.create({
      data: {
        name: "Chef History Bistro",
        slug: `chef-history-bistro-${Date.now()}`,
        nextKotNumber: 400,
        timezone: "Asia/Kolkata",
      },
    });

    // 2. Setup secondary restaurant B for tenant isolation testing
    restaurantB = await prisma.restaurant.create({
      data: {
        name: "Chef History Other Rest",
        slug: `chef-history-other-${Date.now()}`,
        nextKotNumber: 1,
        timezone: "Asia/Kolkata",
      },
    });

    // 3. Create Chefs in Restaurant A
    chefRavi = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `ravi-${Date.now()}@tiffzytest.com`,
        name: "Chef Ravi",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    chefSuresh = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `suresh-${Date.now()}@tiffzytest.com`,
        name: "Chef Suresh",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    seniorChef = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `senior-${Date.now()}@tiffzytest.com`,
        name: "Senior Chef Vikram",
        role: "CHEF",
        designation: "Senior Chef",
        password: "hashed_password",
      },
    });

    // 4. Create Chef in Restaurant B
    chefOtherRest = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantB.id } },
        email: `other-${Date.now()}@tiffzytest.com`,
        name: "Chef Other Rest",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    // 5. Create Parent Order
    order1 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        orderNo: "ORD-HIST-01",
        status: "PREPARING",
        subtotal: 1200,
        total: 1200,
        tableNo: "Table 4",
      },
    });

    // 6. Create KOT 1
    kot1 = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurantA.id,
        orderId: order1.id,
        kotNo: "KOT-428",
        sequenceNumber: 1,
        tableNo: "Table 4",
        status: "PREPARING",
        priority: "HIGH",
      },
    });

    // 7. Create KOT 2
    kot2 = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurantA.id,
        orderId: order1.id,
        kotNo: "KOT-429",
        sequenceNumber: 2,
        tableNo: "Table 2",
        status: "PREPARING",
        priority: "NORMAL",
      },
    });

    // 8. Create KOT Items assigned to Chef Ravi
    // item 1: Completed Today
    const today = new Date();
    const tenMinutesAgo = new Date(today.getTime() - 10 * 60 * 1000);
    const thirtyMinutesAgo = new Date(today.getTime() - 30 * 60 * 1000);

    item1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Naatu Kodi with chitti Gaarelu",
        qty: 1,
        status: "READY",
        assignedChefId: chefRavi.id,
        assignedChefName: chefRavi.name,
        assignmentSource: "DISPATCHED",
        assignedAt: thirtyMinutesAgo,
        startedAt: thirtyMinutesAgo,
        readyAt: tenMinutesAgo,
      },
    });

    // item 2: Duplicate item name (Naatu Kodi with chitti Gaarelu) with different qty (2x) completed earlier today
    // Must remain separate records with distinct canonical IDs
    const fortyMinutesAgo = new Date(today.getTime() - 40 * 60 * 1000);
    const oneHourAgo = new Date(today.getTime() - 60 * 60 * 1000);

    item2 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Naatu Kodi with chitti Gaarelu",
        qty: 2,
        variantName: "Extra Gravy",
        status: "SERVED",
        assignedChefId: chefRavi.id,
        assignedChefName: chefRavi.name,
        assignmentSource: "DISPATCHED",
        assignedAt: oneHourAgo,
        startedAt: oneHourAgo,
        readyAt: fortyMinutesAgo,
      },
    });

    // item 3: Completed Yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayAssigned = new Date(yesterday.getTime() - 25 * 60 * 1000);

    item3 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot2.id,
        itemName: "Classic Connect",
        qty: 2,
        status: "READY",
        assignedChefId: chefRavi.id,
        assignedChefName: chefRavi.name,
        assignmentSource: "SELF_PICKED",
        assignedAt: yesterdayAssigned,
        startedAt: yesterdayAssigned,
        readyAt: yesterday,
      },
    });

    // item 4: Completed by Chef Suresh (NOT Ravi)
    item4 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot2.id,
        itemName: "Paneer Tikka",
        qty: 1,
        status: "READY",
        assignedChefId: chefSuresh.id,
        assignedChefName: chefSuresh.name,
        assignmentSource: "DISPATCHED",
        assignedAt: thirtyMinutesAgo,
        startedAt: thirtyMinutesAgo,
        readyAt: tenMinutesAgo,
      },
    });

    // item Cancelled: Cancelled item should NOT appear in completed history
    itemCancel = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Mutton Biryani",
        qty: 1,
        status: "CANCELLED",
        assignedChefId: chefRavi.id,
        assignedChefName: chefRavi.name,
        readyAt: null,
      },
    });
  });

  t.after(async () => {
    // Cleanup
    try {
      if (restaurantA) {
        await prisma.kitchenOrderTicketItem.deleteMany({
          where: { kot: { restaurantId: restaurantA.id } },
        });
        await prisma.kitchenOrderTicket.deleteMany({
          where: { restaurantId: restaurantA.id },
        });
        await prisma.order.deleteMany({
          where: { restaurantId: restaurantA.id },
        });
        await prisma.user.deleteMany({
          where: { restaurantId: restaurantA.id },
        });
        await prisma.restaurant.delete({
          where: { id: restaurantA.id },
        });
      }
      if (restaurantB) {
        await prisma.user.deleteMany({
          where: { restaurantId: restaurantB.id },
        });
        await prisma.restaurant.delete({
          where: { id: restaurantB.id },
        });
      }
    } catch (err) {
      console.warn("Cleanup warning:", err?.message);
    }
  });

  await t.test("1. Chef Ravi can fetch his own completed preparation history", async () => {
    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.ok(history.ok);
    assert.equal(history.items.length, 3, "Chef Ravi has 3 completed items");
    assert.equal(history.pagination.totalCount, 3);
    assert.ok(history.items.some((it) => it.id === item1.id));
    assert.ok(history.items.some((it) => it.id === item2.id));
    assert.ok(history.items.some((it) => it.id === item3.id));
    // Item 4 belongs to Suresh, itemCancel is cancelled
    assert.ok(!history.items.some((it) => it.id === item4.id), "Suresh's item is excluded");
    assert.ok(!history.items.some((it) => it.id === itemCancel.id), "Cancelled item is excluded");
  });

  await t.test("2. Empty history works cleanly for a chef with no completed items", async () => {
    const emptyChef = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `empty-${Date.now()}@tiffzytest.com`,
        name: "Chef Empty",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: emptyChef.id,
      requestingActor: {
        userId: emptyChef.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.ok(history.ok);
    assert.equal(history.items.length, 0);
    assert.equal(history.groupedByDate.length, 0);
    assert.equal(history.pagination.totalCount, 0);
    assert.equal(history.pagination.hasMore, false);
  });

  await t.test("3. Multiple dates group correctly into date-wise sections", async () => {
    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.ok(history.groupedByDate.length >= 2, "Has at least today and yesterday groups");
    const todayGroup = history.groupedByDate.find((g) => g.dateHeading.includes("TODAY"));
    const yesterdayGroup = history.groupedByDate.find((g) => g.dateHeading.includes("YESTERDAY"));

    assert.ok(todayGroup, "Today group exists");
    assert.equal(todayGroup.items.length, 2, "2 items completed today");

    assert.ok(yesterdayGroup, "Yesterday group exists");
    assert.equal(yesterdayGroup.items.length, 1, "1 item completed yesterday");
    assert.equal(yesterdayGroup.items[0].itemName, "Classic Connect");
  });

  await t.test("4. Newest completion appears first (readyAt DESC)", async () => {
    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    // Item 1 was completed 10 minutes ago, Item 2 was completed 40 minutes ago, Item 3 was yesterday
    assert.equal(history.items[0].id, item1.id, "Most recent readyAt item appears first");
    assert.equal(history.items[1].id, item2.id, "Second most recent readyAt item appears second");
    assert.equal(history.items[2].id, item3.id, "Yesterday item appears last");
  });

  await t.test("5. Duplicate menu items remain separate canonical records", async () => {
    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    const duplicates = history.items.filter((it) => it.itemName === "Naatu Kodi with chitti Gaarelu");
    assert.equal(duplicates.length, 2, "Two distinct records exist for the same item name");
    assert.notEqual(duplicates[0].id, duplicates[1].id, "Canonical IDs are strictly distinct");
    assert.equal(duplicates[0].quantity, 1);
    assert.equal(duplicates[1].quantity, 2);
  });

  await t.test("6. Pagination works (limit and page)", async () => {
    const page1 = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
      page: 1,
      limit: 2,
    });

    assert.equal(page1.items.length, 2);
    assert.equal(page1.pagination.totalCount, 3);
    assert.equal(page1.pagination.totalPages, 2);
    assert.equal(page1.pagination.hasMore, true);

    const page2 = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
      page: 2,
      limit: 2,
    });

    assert.equal(page2.items.length, 1);
    assert.equal(page2.pagination.hasMore, false);
    assert.equal(page2.items[0].id, item3.id);
  });

  await t.test("7. Date filtering by range='today' returns today's items only", async () => {
    const todayHistory = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      range: "today",
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.equal(todayHistory.items.length, 2);
    assert.ok(todayHistory.items.every((it) => it.id === item1.id || it.id === item2.id));
  });

  await t.test("8. Date filtering by range='yesterday' returns yesterday's items only", async () => {
    const yestHistory = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      range: "yesterday",
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.equal(yestHistory.items.length, 1);
    assert.equal(yestHistory.items[0].id, item3.id);
  });

  await t.test("9. Search filtering finds items by item name, KOT number, or table number", async () => {
    // Search by item name
    const resName = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      search: "Classic",
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(resName.items.length, 1);
    assert.equal(resName.items[0].itemName, "Classic Connect");

    // Search by KOT number
    const resKot = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      search: "KOT-428",
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(resKot.items.length, 2);

    // Search by table number
    const resTable = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      search: "Table 2",
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(resTable.items.length, 1);
    assert.equal(resTable.items[0].id, item3.id);
  });

  await t.test("10. Security: Normal Chef cannot access another chef's history", async () => {
    await assert.rejects(
      async () => {
        await getChefHistory({
          restaurantId: restaurantA.id,
          chefId: chefSuresh.id, // Trying to access Suresh's history
          requestingActor: {
            userId: chefRavi.id, // Logged in as Ravi
            role: "CHEF",
            designation: "Line Chef",
            restaurantId: restaurantA.id,
          },
        });
      },
      (err) => {
        assert.equal(err instanceof KitchenAssignmentError, true);
        assert.equal(err.status, 403);
        assert.equal(err.code, "FORBIDDEN_HISTORY_ACCESS");
        return true;
      }
    );
  });

  await t.test("11. Security: Cross-restaurant history access is strictly forbidden", async () => {
    await assert.rejects(
      async () => {
        await getChefHistory({
          restaurantId: restaurantA.id,
          chefId: chefOtherRest.id,
          requestingActor: {
            userId: chefOtherRest.id,
            role: "CHEF",
            designation: "Line Chef",
            restaurantId: restaurantB.id, // Different restaurant
          },
        });
      },
      (err) => {
        assert.equal(err instanceof KitchenAssignmentError, true);
        assert.equal(err.status, 403);
        assert.equal(err.code, "FORBIDDEN_RESTAURANT_ACCESS");
        return true;
      }
    );
  });

  await t.test("12. Senior Chef can inspect line chef's history", async () => {
    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.ok(history.ok);
    assert.equal(history.items.length, 3, "Senior Chef is authorized to inspect Ravi's history");
  });

  await t.test("13. Operational info: prepTimeMinutes, completedTime, and assignmentSource are present", async () => {
    const history = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefRavi.id,
      requestingActor: {
        userId: chefRavi.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    const it = history.items[0];
    assert.ok(it.completedTime, "completedTime is formatted in 12-hour AM/PM string");
    assert.ok(typeof it.prepTimeMinutes === "number", "prepTimeMinutes is calculated");
    assert.equal(it.prepTimeMinutes, 20); // 30 mins ago to 10 mins ago = 20 mins
    assert.equal(it.assignmentSource, "DISPATCHED");
  });
});
