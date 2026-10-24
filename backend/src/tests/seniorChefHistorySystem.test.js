import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
  KitchenAssignmentError,
  getChefHistory,
} from "../services/kitchenAssignmentService.js";

test("Senior Chef Whole-Kitchen History & Operational Audit Test Suite", async (t) => {
  let restaurantA = null;
  let restaurantB = null;
  let chefR14 = null;
  let chefR15 = null;
  let chefR16 = null;
  let seniorChef = null;
  let lineChef = null;
  let waiter = null;
  let chefOtherRest = null;

  let order1 = null;
  let kot1 = null;
  let kot2 = null;

  let itemR14_1 = null;
  let itemR14_2 = null;
  let itemR15_1 = null;
  let itemR16_1 = null;
  let itemPending = null;

  t.before(async () => {
    // 1. Setup primary restaurant A
    restaurantA = await prisma.restaurant.create({
      data: {
        name: "Senior Chef Command Kitchen",
        slug: `senior-chef-kitchen-${Date.now()}`,
        nextKotNumber: 420,
        timezone: "Asia/Kolkata",
      },
    });

    // 2. Setup restaurant B for isolation testing
    restaurantB = await prisma.restaurant.create({
      data: {
        name: "Other Restaurant Kitchen",
        slug: `other-kitchen-${Date.now()}`,
        nextKotNumber: 10,
        timezone: "Asia/Kolkata",
      },
    });

    // 3. Create Senior Chef
    seniorChef = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `srchef-${Date.now()}@tiffzytest.com`,
        name: "Executive Chef Vikram",
        role: "CHEF",
        designation: "Senior Chef",
        password: "hashed_password",
      },
    });

    // 4. Create Line Chefs
    chefR14 = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `chefr14-${Date.now()}@tiffzytest.com`,
        name: "Cafe King Chef R14",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    chefR15 = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `chefr15-${Date.now()}@tiffzytest.com`,
        name: "Cafe King Chef R15",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    chefR16 = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `chefr16-${Date.now()}@tiffzytest.com`,
        name: "Cafe King Chef R16",
        role: "CHEF",
        designation: "Line Chef",
        password: "hashed_password",
      },
    });

    lineChef = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `linechef-${Date.now()}@tiffzytest.com`,
        name: "Line Chef Normal",
        role: "CHEF",
        designation: "Junior Cook",
        password: "hashed_password",
      },
    });

    waiter = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `waiter-${Date.now()}@tiffzytest.com`,
        name: "Server Alex",
        role: "WAITER",
        designation: "Floor Staff",
        password: "hashed_password",
      },
    });

    chefOtherRest = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantB.id } },
        email: `otherchef-${Date.now()}@tiffzytest.com`,
        name: "External Chef",
        role: "CHEF",
        designation: "Senior Chef",
        password: "hashed_password",
      },
    });

    // 5. Create Parent Order
    order1 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        orderNo: "ORD-SC-01",
        status: "PREPARING",
        subtotal: 1800,
        total: 1800,
        tableNo: "Table 4",
      },
    });

    // 6. Create KOT 1
    kot1 = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurantA.id,
        orderId: order1.id,
        kotNo: "KOT-427",
        sequenceNumber: 1,
        tableNo: "Table 4",
        status: "PREPARING",
        priority: "NORMAL",
        estimatedPrepTimeMinutes: 15,
      },
    });

    // 7. Create KOT 2
    kot2 = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurantA.id,
        orderId: order1.id,
        kotNo: "KOT-428",
        sequenceNumber: 2,
        tableNo: "Table 4",
        status: "READY",
        priority: "HIGH",
        estimatedPrepTimeMinutes: 10,
      },
    });

    // 8. Create completed items across multiple chefs
    const baseTime = Date.now();

    // Item 1: completed by Chef R14 (recent)
    itemR14_1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot2.id,
        itemName: "Naatu Kodi with chitti Gaarelu",
        qty: 1,
        status: "READY",
        assignedChefId: chefR14.id,
        assignedChefName: chefR14.name,
        assignedAt: new Date(baseTime - 25 * 60 * 1000),
        startedAt: new Date(baseTime - 20 * 60 * 1000),
        readyAt: new Date(baseTime - 5 * 60 * 1000), // Completed 5 mins ago
      },
    });

    // Item 2: duplicate item completed by Chef R14 (earlier today)
    itemR14_2 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Classic Connect",
        qty: 2,
        status: "READY",
        assignedChefId: chefR14.id,
        assignedChefName: chefR14.name,
        assignedAt: new Date(baseTime - 60 * 60 * 1000),
        startedAt: new Date(baseTime - 55 * 60 * 1000),
        readyAt: new Date(baseTime - 40 * 60 * 1000), // Completed 40 mins ago
      },
    });

    // Item 3: completed by Chef R15 (status SERVED)
    itemR15_1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot2.id,
        itemName: "Crispy Corn Kernels",
        qty: 1,
        status: "SERVED",
        assignedChefId: chefR15.id,
        assignedChefName: chefR15.name,
        assignedAt: new Date(baseTime - 90 * 60 * 1000),
        startedAt: new Date(baseTime - 85 * 60 * 1000),
        readyAt: new Date(baseTime - 70 * 60 * 1000),
      },
    });

    // Item 4: completed by Chef R16 (yesterday)
    const yesterdayDate = new Date(baseTime - 26 * 60 * 60 * 1000);
    itemR16_1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Paneer Butter Masala",
        qty: 1,
        status: "READY",
        assignedChefId: chefR16.id,
        assignedChefName: chefR16.name,
        assignedAt: new Date(yesterdayDate.getTime() - 25 * 60 * 1000),
        startedAt: new Date(yesterdayDate.getTime() - 20 * 60 * 1000),
        readyAt: yesterdayDate,
      },
    });

    // Item 5: In-progress item (not completed, must NOT appear in history)
    itemPending = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Butter Naan",
        qty: 4,
        status: "PREPARING",
        assignedChefId: chefR14.id,
        assignedChefName: chefR14.name,
        assignedAt: new Date(baseTime - 10 * 60 * 1000),
        startedAt: new Date(baseTime - 5 * 60 * 1000),
        readyAt: null,
      },
    });
  });

  t.after(async () => {
    // Cleanup
    await prisma.kitchenOrderTicketItem.deleteMany({
      where: { kot: { restaurantId: { in: [restaurantA.id, restaurantB.id] } } },
    }).catch(() => {});
    await prisma.kitchenOrderTicket.deleteMany({
      where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
    }).catch(() => {});
    await prisma.order.deleteMany({
      where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
    }).catch(() => {});
    await prisma.restaurant.deleteMany({
      where: { id: { in: [restaurantA.id, restaurantB.id] } },
    }).catch(() => {});
  });

  await t.test("1. Senior Chef can retrieve whole-kitchen history (all chefs)", async () => {
    const result = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: null, // whole kitchen
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(Array.isArray(result.items), true);
    // Should have 4 completed items (itemPending excluded)
    assert.equal(result.items.length, 4);

    // Verify uncompleted items are excluded
    const pendingFound = result.items.some((it) => it.id === itemPending.id);
    assert.equal(pendingFound, false);
  });

  await t.test("2. Senior Chef sees multiple chefs in whole-kitchen history", async () => {
    const result = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: null,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    const chefNames = new Set(result.items.map((it) => it.assignedChefName));
    assert.equal(chefNames.has(chefR14.name), true);
    assert.equal(chefNames.has(chefR15.name), true);
    assert.equal(chefNames.has(chefR16.name), true);
    assert.equal(chefNames.size >= 3, true);
  });

  await t.test("3. Chef filter restricts whole-kitchen history to selected chef", async () => {
    const result = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefR14.id,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.items.length, 2);
    for (const item of result.items) {
      assert.equal(item.assignedChefId, chefR14.id);
      assert.equal(item.assignedChefName, chefR14.name);
    }
  });

  await t.test("4. Date filters (today vs yesterday) isolate records correctly", async () => {
    // Today
    const todayResult = await getChefHistory({
      restaurantId: restaurantA.id,
      range: "today",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    // 3 items completed today
    assert.equal(todayResult.items.length, 3);
    assert.equal(todayResult.items.some((it) => it.id === itemR16_1.id), false);

    // Yesterday
    const yesterdayResult = await getChefHistory({
      restaurantId: restaurantA.id,
      range: "yesterday",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    // 1 item completed yesterday
    assert.equal(yesterdayResult.items.length, 1);
    assert.equal(yesterdayResult.items[0].id, itemR16_1.id);
  });

  await t.test("5. Status filter works (READY vs SERVED vs ALL)", async () => {
    const readyOnly = await getChefHistory({
      restaurantId: restaurantA.id,
      status: "READY",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(readyOnly.items.length, 3);
    for (const it of readyOnly.items) {
      assert.equal(it.status, "READY");
    }

    const servedOnly = await getChefHistory({
      restaurantId: restaurantA.id,
      status: "SERVED",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(servedOnly.items.length, 1);
    assert.equal(servedOnly.items[0].id, itemR15_1.id);
  });

  await t.test("6. Search works across item name, KOT#, Table#, and Chef name", async () => {
    // By item name
    const itemSearch = await getChefHistory({
      restaurantId: restaurantA.id,
      search: "Naatu Kodi",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(itemSearch.items.length, 1);
    assert.equal(itemSearch.items[0].id, itemR14_1.id);

    // By KOT number
    const kotSearch = await getChefHistory({
      restaurantId: restaurantA.id,
      search: "KOT-428",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(kotSearch.items.length, 2);

    // By Chef name
    const chefSearch = await getChefHistory({
      restaurantId: restaurantA.id,
      search: "R15",
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(chefSearch.items.length, 1);
    assert.equal(chefSearch.items[0].id, itemR15_1.id);
  });

  await t.test("7. Pagination works correctly with limit and page", async () => {
    const page1 = await getChefHistory({
      restaurantId: restaurantA.id,
      page: 1,
      limit: 2,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.pagination.hasMore, true);
    assert.equal(page1.pagination.totalPages, 2);
    assert.equal(page1.pagination.totalCount, 4);

    const page2 = await getChefHistory({
      restaurantId: restaurantA.id,
      page: 2,
      limit: 2,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });
    assert.equal(page2.items.length, 2);
    assert.equal(page2.pagination.hasMore, false);

    // Page 1 and Page 2 must not have overlapping item IDs
    const p1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      assert.equal(p1Ids.has(item.id), false);
    }
  });

  await t.test("8. Ordering: Newest completed work appears first (readyAt DESC)", async () => {
    const result = await getChefHistory({
      restaurantId: restaurantA.id,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    for (let i = 0; i < result.items.length - 1; i++) {
      const current = new Date(result.items[i].readyAt).getTime();
      const next = new Date(result.items[i + 1].readyAt).getTime();
      assert.equal(current >= next, true, `Item ${i} readyAt should be >= Item ${i + 1} readyAt`);
    }
  });

  await t.test("9. Date grouping groups items by date with descending order preserved", async () => {
    const result = await getChefHistory({
      restaurantId: restaurantA.id,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.equal(Array.isArray(result.groupedByDate), true);
    assert.equal(result.groupedByDate.length, 2); // Today and Yesterday
    assert.equal(result.groupedByDate[0].items.length, 3);
    assert.equal(result.groupedByDate[1].items.length, 1);
  });

  await t.test("10. Summary metrics are calculated authoritatively", async () => {
    const result = await getChefHistory({
      restaurantId: restaurantA.id,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.ok(result.summary);
    assert.equal(result.summary.completedItems, 4);
    assert.equal(result.summary.completedKots, 2);
    assert.equal(result.summary.activeChefs, 3); // R14, R15, R16
    assert.equal(typeof result.summary.avgPrepTimeMinutes, "number");
    assert.equal(typeof result.summary.overdueCompletions, "number");
  });

  await t.test("11. Consistency: Same OrderItem, KOT, and readyAt matches Chef Station History", async () => {
    const seniorResult = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefR14.id,
      requestingActor: {
        userId: seniorChef.id,
        role: "CHEF",
        designation: "Senior Chef",
        restaurantId: restaurantA.id,
      },
    });

    const chefResult = await getChefHistory({
      restaurantId: restaurantA.id,
      chefId: chefR14.id,
      requestingActor: {
        userId: chefR14.id,
        role: "CHEF",
        designation: "Line Chef",
        restaurantId: restaurantA.id,
      },
    });

    assert.equal(seniorResult.items.length, chefResult.items.length);
    assert.equal(seniorResult.items[0].id, chefResult.items[0].id);
    assert.equal(seniorResult.items[0].readyAt.toISOString(), chefResult.items[0].readyAt.toISOString());
    assert.equal(seniorResult.items[0].kotNo, chefResult.items[0].kotNo);
    assert.equal(seniorResult.items[0].assignedChefName, chefResult.items[0].assignedChefName);
  });

  await t.test("12. Security: Normal Line Chef CANNOT access whole-kitchen history (403)", async () => {
    await assert.rejects(
      async () => {
        await getChefHistory({
          restaurantId: restaurantA.id,
          chefId: null, // Whole kitchen requested by normal line chef
          requestingActor: {
            userId: lineChef.id,
            role: "CHEF",
            designation: "Junior Cook",
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

  await t.test("13. Security: Line Chef CANNOT access another chef's history (403)", async () => {
    await assert.rejects(
      async () => {
        await getChefHistory({
          restaurantId: restaurantA.id,
          chefId: chefR15.id, // R14 trying to access R15
          requestingActor: {
            userId: chefR14.id,
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

  await t.test("14. Security: Cross-restaurant access is rejected (403)", async () => {
    await assert.rejects(
      async () => {
        await getChefHistory({
          restaurantId: restaurantA.id,
          chefId: null,
          requestingActor: {
            userId: chefOtherRest.id,
            role: "CHEF",
            designation: "Senior Chef",
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

  await t.test("15. Security: Unauthorized staff (e.g. Waiter) is rejected from whole-kitchen history (403)", async () => {
    await assert.rejects(
      async () => {
        await getChefHistory({
          restaurantId: restaurantA.id,
          chefId: null,
          requestingActor: {
            userId: waiter.id,
            role: "WAITER",
            designation: "Floor Staff",
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
});
