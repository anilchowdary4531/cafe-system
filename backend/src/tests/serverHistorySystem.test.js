import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
  KitchenAssignmentError,
  getServerHistory,
} from "../services/kitchenAssignmentService.js";

test("Server Station Food-Service History Backend Test Suite", async (t) => {
  let restaurantA = null;
  let restaurantB = null;
  let serverRavi = null;
  let serverKamalesh = null;
  let serverOtherRest = null;
  let managerUser = null;
  let guestCustomer = null;

  let order1 = null;
  let order2 = null;
  let order3 = null;
  let kot1 = null;
  let kot2 = null;
  let kot3 = null;

  let itemServed1 = null;
  let itemServed2Duplicate = null;
  let itemPreparing = null;
  let itemReady = null;
  let itemServedYesterday = null;

  t.before(async () => {
    // 1. Setup primary restaurant A
    restaurantA = await prisma.restaurant.create({
      data: {
        name: "Server History Restaurant A",
        slug: `server-hist-rest-a-${Date.now()}`,
        nextKotNumber: 600,
        timezone: "Asia/Kolkata",
      },
    });

    // 2. Setup restaurant B for isolation testing
    restaurantB = await prisma.restaurant.create({
      data: {
        name: "Other Restaurant B",
        slug: `other-rest-b-${Date.now()}`,
        nextKotNumber: 100,
        timezone: "Asia/Kolkata",
      },
    });

    // 3. Create servers in Restaurant A
    serverRavi = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `server-ravi-${Date.now()}@tiffzytest.com`,
        name: "Server Ravi",
        role: "WAITER",
        designation: "Head Server",
        password: "hashed_password",
      },
    });

    serverKamalesh = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `server-kamalesh-${Date.now()}@tiffzytest.com`,
        name: "Server Kamalesh",
        role: "WAITER",
        designation: "Server",
        password: "hashed_password",
      },
    });

    // 4. Create manager in Restaurant A
    managerUser = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `manager-${Date.now()}@tiffzytest.com`,
        name: "Manager Suresh",
        role: "MANAGER",
        designation: "Floor Manager",
        password: "hashed_password",
      },
    });

    // 5. Create server in Restaurant B
    serverOtherRest = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantB.id } },
        email: `server-other-${Date.now()}@tiffzytest.com`,
        name: "Other Server",
        role: "WAITER",
        designation: "Server",
        password: "hashed_password",
      },
    });

    // 6. Setup Tables & Orders
    order1 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        orderNo: `ORD-SRV-${Date.now()}-1`,
        tableNo: "Table 4",
        subtotal: 1200,
        total: 1200,
        status: "PREPARING",
        createdByUserId: serverRavi.id,
      },
    });

    order2 = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        orderNo: `ORD-SRV-${Date.now()}-2`,
        tableNo: "Table 12",
        subtotal: 800,
        total: 800,
        status: "DELIVERED",
        createdByUserId: serverRavi.id,
      },
    });

    kot1 = await prisma.kitchenOrderTicket.create({
      data: {
        kotNo: "KOT-SRV-428",
        sequenceNumber: 1,
        restaurantId: restaurantA.id,
        orderId: order1.id,
        tableNo: "Table 4",
        waiterId: serverRavi.id,
        waiterName: serverRavi.name,
        status: "PREPARING",
        priority: "HIGH",
        updatedAt: new Date(),
      },
    });

    kot2 = await prisma.kitchenOrderTicket.create({
      data: {
        kotNo: "KOT-SRV-429",
        sequenceNumber: 2,
        restaurantId: restaurantA.id,
        orderId: order2.id,
        tableNo: "Table 12",
        waiterId: serverRavi.id,
        waiterName: serverRavi.name,
        status: "SERVED",
        priority: "NORMAL",
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      },
    });

    // 7. Canonical Order Items and KOT Items
    // Item 1: SERVED (Today)
    itemServed1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        orderItemId: 5001,
        menuItemId: 101,
        itemName: "Naattu Kodi with Chitti Gaarelu",
        qty: 1,
        status: "SERVED",
        readyAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

    // Item 2: Duplicate item name, different OrderItem ID (SERVED Today)
    itemServed2Duplicate = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        orderItemId: 5002,
        menuItemId: 101,
        itemName: "Naattu Kodi with Chitti Gaarelu",
        qty: 2,
        variantName: "Spicy",
        status: "SERVED",
        readyAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    // Item 3: PREPARING (must NOT appear in history)
    itemPreparing = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        orderItemId: 5003,
        menuItemId: 102,
        itemName: "Butter Naan",
        qty: 4,
        status: "PREPARING",
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
    });

    // Item 4: READY (must NOT appear in history until SERVED)
    itemReady = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        orderItemId: 5004,
        menuItemId: 103,
        itemName: "Chicken Tikka",
        qty: 1,
        status: "READY",
        readyAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });

    // Item 5: SERVED Yesterday
    itemServedYesterday = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot2.id,
        orderItemId: 5005,
        menuItemId: 104,
        itemName: "Classic Connect",
        qty: 1,
        status: "SERVED",
        readyAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
  });

  t.after(async () => {
    // Cleanup
    if (restaurantA?.id) {
      await prisma.kitchenOrderTicketItem.deleteMany({
        where: { kot: { restaurantId: restaurantA.id } },
      }).catch(() => {});
      await prisma.kitchenOrderTicket.deleteMany({
        where: { restaurantId: restaurantA.id },
      }).catch(() => {});
      await prisma.order.deleteMany({
        where: { restaurantId: restaurantA.id },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { restaurantId: restaurantA.id },
      }).catch(() => {});
      await prisma.restaurant.delete({
        where: { id: restaurantA.id },
      }).catch(() => {});
    }

    if (restaurantB?.id) {
      await prisma.user.deleteMany({
        where: { restaurantId: restaurantB.id },
      }).catch(() => {});
      await prisma.restaurant.delete({
        where: { id: restaurantB.id },
      }).catch(() => {});
    }
  });

  // 1. Server Ravi can fetch his own completed food service history
  await t.test("1. Server Ravi can fetch his own completed food service history", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });

    assert.equal(res.ok, true);
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.items));
    // Must contain served items (itemServed1, itemServed2Duplicate, itemServedYesterday)
    const servedIds = res.items.map((i) => i.id);
    assert.ok(servedIds.includes(itemServed1.id), "Should include itemServed1");
    assert.ok(servedIds.includes(itemServed2Duplicate.id), "Should include itemServed2Duplicate");
    assert.ok(servedIds.includes(itemServedYesterday.id), "Should include itemServedYesterday");
  });

  // 2. Active PREPARING and READY items MUST NOT appear in server history
  await t.test("2. Active PREPARING and READY items MUST NOT appear in server history", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });

    const returnedIds = res.items.map((i) => i.id);
    assert.equal(returnedIds.includes(itemPreparing.id), false, "PREPARING item must NOT appear in history");
    assert.equal(returnedIds.includes(itemReady.id), false, "READY item must NOT appear in history until SERVED");
  });

  // 3. Partial order shows only SERVED items
  await t.test("3. Partial order shows only SERVED items", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });

    // For order1: items 5001 and 5002 are SERVED, but 5003 is PREPARING and 5004 is READY
    const order1Items = res.items.filter((i) => i.orderId === order1.id);
    assert.equal(order1Items.length, 2, "Partial order must only show the 2 served items");
    order1Items.forEach((it) => {
      assert.equal(it.status, "SERVED");
    });
  });

  // 4. Duplicate menu items remain separate canonical records
  await t.test("4. Duplicate menu items remain separate canonical records", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });

    const duplicates = res.items.filter((i) => i.name === "Naattu Kodi with Chitti Gaarelu");
    assert.equal(duplicates.length, 2, "Duplicate menu items must remain separate");
    assert.notEqual(duplicates[0].id, duplicates[1].id, "Must have distinct primary keys");
    assert.notEqual(duplicates[0].orderItemId, duplicates[1].orderItemId, "Must have distinct OrderItem IDs");
  });

  // 5. Date-wise grouping separates TODAY from YESTERDAY
  await t.test("5. Date-wise grouping separates TODAY from YESTERDAY", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });

    assert.ok(Array.isArray(res.groupedByDate));
    assert.ok(res.groupedByDate.length >= 2, "Should have at least 2 date groups");

    const todayGroup = res.groupedByDate.find((g) => g.dateHeading.startsWith("TODAY"));
    const yesterdayGroup = res.groupedByDate.find((g) => g.dateHeading.startsWith("YESTERDAY"));

    assert.ok(todayGroup, "Must have a TODAY group");
    assert.ok(yesterdayGroup, "Must have a YESTERDAY group");

    const todayIds = todayGroup.items.map((i) => i.id);
    assert.ok(todayIds.includes(itemServed1.id));
    assert.ok(todayIds.includes(itemServed2Duplicate.id));

    const yesterdayIds = yesterdayGroup.items.map((i) => i.id);
    assert.ok(yesterdayIds.includes(itemServedYesterday.id));
  });

  // 6. Today filter returns only items served today
  await t.test("6. Today filter returns only items served today", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "today",
    });

    const returnedIds = res.items.map((i) => i.id);
    assert.ok(returnedIds.includes(itemServed1.id));
    assert.ok(returnedIds.includes(itemServed2Duplicate.id));
    assert.equal(returnedIds.includes(itemServedYesterday.id), false, "Yesterday item must NOT be in today filter");
  });

  // 7. Yesterday filter returns only items served yesterday
  await t.test("7. Yesterday filter returns only items served yesterday", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: serverRavi.id,
        userId: serverRavi.id,
        role: "WAITER",
        restaurantId: restaurantA.id,
      },
      range: "yesterday",
    });

    const returnedIds = res.items.map((i) => i.id);
    assert.ok(returnedIds.includes(itemServedYesterday.id));
    assert.equal(returnedIds.includes(itemServed1.id), false);
  });

  // 8. Search filtering by item name, KOT number, table number, order number
  await t.test("8. Search filtering by item name, KOT number, table number, order number", async () => {
    // Search by item name
    const resItem = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: { id: serverRavi.id, userId: serverRavi.id, role: "WAITER", restaurantId: restaurantA.id },
      search: "Classic Connect",
      range: "all",
    });
    assert.equal(resItem.items.length, 1);
    assert.equal(resItem.items[0].id, itemServedYesterday.id);

    // Search by KOT number
    const resKot = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: { id: serverRavi.id, userId: serverRavi.id, role: "WAITER", restaurantId: restaurantA.id },
      search: "KOT-SRV-428",
      range: "all",
    });
    assert.equal(resKot.items.length, 2);

    // Search by Table number
    const resTable = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: { id: serverRavi.id, userId: serverRavi.id, role: "WAITER", restaurantId: restaurantA.id },
      search: "Table 12",
      range: "all",
    });
    assert.equal(resTable.items.length, 1);
    assert.equal(resTable.items[0].id, itemServedYesterday.id);
  });

  // 9. Pagination works cleanly with limit and page
  await t.test("9. Pagination works cleanly with limit and page", async () => {
    const page1 = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: { id: serverRavi.id, userId: serverRavi.id, role: "WAITER", restaurantId: restaurantA.id },
      limit: 2,
      page: 1,
      range: "all",
    });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.pagination.hasMore, true);
    assert.equal(page1.pagination.totalPages, 2);

    const page2 = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: { id: serverRavi.id, userId: serverRavi.id, role: "WAITER", restaurantId: restaurantA.id },
      limit: 2,
      page: 2,
      range: "all",
    });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.pagination.hasMore, false);
  });

  // 10. Security: Server Kamalesh cannot access Server Ravi's history
  await t.test("10. Security: Server Kamalesh cannot access Server Ravi's history", async () => {
    await assert.rejects(
      async () => {
        await getServerHistory({
          prisma,
          restaurantId: restaurantA.id,
          serverId: serverRavi.id,
          requestingActor: {
            id: serverKamalesh.id,
            userId: serverKamalesh.id,
            role: "WAITER",
            restaurantId: restaurantA.id,
          },
        });
      },
      (err) => {
        assert.ok(err instanceof KitchenAssignmentError);
        assert.equal(err.status, 403);
        assert.equal(err.code, "FORBIDDEN_HISTORY_ACCESS");
        return true;
      }
    );
  });

  // 11. Security: Cross-restaurant access is strictly rejected
  await t.test("11. Security: Cross-restaurant access is strictly rejected", async () => {
    await assert.rejects(
      async () => {
        await getServerHistory({
          prisma,
          restaurantId: restaurantA.id,
          serverId: serverRavi.id,
          requestingActor: {
            id: serverOtherRest.id,
            userId: serverOtherRest.id,
            role: "WAITER",
            restaurantId: restaurantB.id,
          },
        });
      },
      (err) => {
        assert.ok(err instanceof KitchenAssignmentError);
        assert.equal(err.status, 403);
        assert.equal(err.code, "FORBIDDEN_RESTAURANT_ACCESS");
        return true;
      }
    );
  });

  // 12. Manager can inspect any server's history or whole restaurant food-service history
  await t.test("12. Manager can inspect any server's history or whole restaurant history", async () => {
    // Specific server inspection
    const managerForRavi = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: {
        id: managerUser.id,
        userId: managerUser.id,
        role: "MANAGER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });
    assert.equal(managerForRavi.ok, true);
    assert.ok(managerForRavi.items.length >= 3);

    // Whole-restaurant server history
    const wholeRest = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: null,
      requestingActor: {
        id: managerUser.id,
        userId: managerUser.id,
        role: "MANAGER",
        restaurantId: restaurantA.id,
      },
      range: "all",
    });
    assert.equal(wholeRest.ok, true);
    assert.ok(wholeRest.summary.totalServedItems >= 3);
  });

  // 13. Operational info: OrderId, OrderNo, TableNo, KOTNo, ServedTime are accurately populated
  await t.test("13. Operational info: OrderId, OrderNo, TableNo, KOTNo, ServedTime are accurately populated", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverRavi.id,
      requestingActor: { id: serverRavi.id, userId: serverRavi.id, role: "WAITER", restaurantId: restaurantA.id },
      range: "all",
    });

    const item = res.items.find((i) => i.id === itemServed1.id);
    assert.ok(item, "itemServed1 must be present");
    assert.equal(item.orderId, order1.id);
    assert.equal(item.orderNo, order1.orderNo);
    assert.equal(item.kotNumber, "KOT-SRV-428");
    assert.equal(item.tableNo, "Table 4");
    assert.equal(item.waiterName, "Server Ravi");
    assert.equal(item.status, "SERVED");
    assert.ok(item.servedTime, "Must have formatted servedTime");
    assert.ok(item.dateHeading.startsWith("TODAY"), "Must have dateHeading starting with TODAY");
  });

  // 14. Empty history returns friendly empty response
  await t.test("14. Empty history returns friendly empty response", async () => {
    const res = await getServerHistory({
      prisma,
      restaurantId: restaurantA.id,
      serverId: serverKamalesh.id,
      requestingActor: { id: serverKamalesh.id, userId: serverKamalesh.id, role: "WAITER", restaurantId: restaurantA.id },
      range: "all",
    });

    assert.equal(res.ok, true);
    assert.equal(res.items.length, 0);
    assert.equal(res.groupedByDate.length, 0);
    assert.equal(res.summary.totalServedItems, 0);
  });
});
