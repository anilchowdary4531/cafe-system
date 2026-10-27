import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import { getCanonicalReadyItems, updateKotItemStatus } from "../services/kotService.js";

test("CRITICAL CANONICAL READY-TO-DISTRIBUTE INTEGRATION SUITE", async (t) => {
  let restaurant1 = null;
  let restaurant2 = null;
  let table1 = null;
  let table2 = null;
  let chef = null;
  let order1 = null;
  let kot1 = null;
  let kotItemA = null;
  let kotItemB = null;
  let kotItemC = null;
  let duplicateItem1 = null;
  let duplicateItem2 = null;

  t.before(async () => {
    // 1. Setup Restaurant 1 and Restaurant 2 for tenant isolation
    restaurant1 = await prisma.restaurant.create({
      data: {
        name: `Canonical Ready Rest 1 ${Date.now()}`,
        slug: `canonical-rest1-${Date.now()}`,
        phone: `+9199991${Math.floor(10000 + Math.random() * 90000)}`,
        email: `rest1_${Date.now()}@test.com`,
      },
    });

    restaurant2 = await prisma.restaurant.create({
      data: {
        name: `Canonical Ready Rest 2 ${Date.now()}`,
        slug: `canonical-rest2-${Date.now()}`,
        phone: `+9199992${Math.floor(10000 + Math.random() * 90000)}`,
        email: `rest2_${Date.now()}@test.com`,
      },
    });

    table1 = await prisma.diningTable.create({
      data: {
        restaurantId: restaurant1.id,
        tableNo: "T1",
        seats: 4,
        cleaningStatus: "CLEAN",
      },
    });

    table2 = await prisma.diningTable.create({
      data: {
        restaurantId: restaurant2.id,
        tableNo: "T2",
        seats: 4,
        cleaningStatus: "CLEAN",
      },
    });

    chef = await prisma.user.create({
      data: {
        restaurantId: restaurant1.id,
        name: "Chef Mario",
        email: `chef_mario_${Date.now()}@test.com`,
        role: "CHEF",
        designation: "Line Chef",
        password: "hash",
      },
    });

    // Create Order 1 in Restaurant 1 with 3 items:
    // Item A (Pizza), Item B (Coffee), Item C (Burger)
    order1 = await prisma.order.create({
      data: {
        restaurantId: restaurant1.id,
        orderNo: `ORD-CANONICAL-1`,
        status: "PREPARING",
        tableNo: "T1",
        subtotal: 500,
        total: 500,
      },
    });

    kot1 = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurant1.id,
        orderId: order1.id,
        kotNo: "KOT-901",
        sequenceNumber: 1,
        status: "PREPARING",
        tableNo: "T1",
      },
    });

    kotItemA = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Pizza",
        qty: 1,
        status: "PREPARING",
        assignedChefId: chef.id,
        assignedChefName: chef.name,
      },
    });

    kotItemB = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Coffee",
        qty: 1,
        status: "PREPARING",
        assignedChefId: chef.id,
        assignedChefName: chef.name,
      },
    });

    kotItemC = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Burger",
        qty: 1,
        status: "PENDING",
        assignedChefId: chef.id,
        assignedChefName: chef.name,
      },
    });
  });

  t.after(async () => {
    // Cleanup
    if (restaurant1) {
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: restaurant1.id } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant1.id } });
      await prisma.order.deleteMany({ where: { restaurantId: restaurant1.id } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant1.id } });
      await prisma.user.deleteMany({ where: { restaurantId: restaurant1.id } });
      await prisma.restaurant.delete({ where: { id: restaurant1.id } });
    }
    if (restaurant2) {
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: restaurant2.id } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant2.id } });
      await prisma.order.deleteMany({ where: { restaurantId: restaurant2.id } });
      await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant2.id } });
      await prisma.restaurant.delete({ where: { id: restaurant2.id } });
    }
  });

  // TEST A & C & E: Chef marks 1 item READY in a multi-item order -> Server sees exactly 1 item
  await t.test("A & C & E: Chef marks Item A READY -> Server sees exactly 1 ready item with same KOTItem ID", async () => {
    // Chef marks Pizza (kotItemA) READY
    await updateKotItemStatus({
      prisma,
      kotId: kot1.id,
      itemId: kotItemA.id,
      restaurantId: restaurant1.id,
      nextStatus: "READY",
      actor: { userId: chef.id, userName: chef.name },
    });

    const readyItems = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    
    assert.equal(readyItems.length, 1, "Exactly 1 item ready to distribute");
    assert.equal(readyItems[0].id, kotItemA.id, "Ready item matches exact KOTItem ID");
    assert.equal(readyItems[0].itemName, "Pizza");
    assert.equal(readyItems[0].tableNo, "T1");
    assert.equal(readyItems[0].kotNo, "KOT-901");
    assert.equal(readyItems[0].status, "READY");

    // Check parent order status is not completely served or delivered
    const checkOrder = await prisma.order.findUnique({ where: { id: order1.id } });
    assert.notEqual(checkOrder.status, "DELIVERED", "Order is NOT marked DELIVERED");
    assert.notEqual(checkOrder.status, "SERVED", "Order is NOT marked SERVED");
  });

  // TEST B: Multiple READY items in queue
  await t.test("B: Chef marks Item B READY -> Server queue length = 2 with exact KOTItem IDs", async () => {
    // Chef marks Coffee (kotItemB) READY
    await updateKotItemStatus({
      prisma,
      kotId: kot1.id,
      itemId: kotItemB.id,
      restaurantId: restaurant1.id,
      nextStatus: "READY",
      actor: { userId: chef.id, userName: chef.name },
    });

    const readyItems = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    
    assert.equal(readyItems.length, 2, "Exactly 2 items ready to distribute");
    const itemIds = readyItems.map((it) => it.id);
    assert.ok(itemIds.includes(kotItemA.id), "kotItemA is present");
    assert.ok(itemIds.includes(kotItemB.id), "kotItemB is present");
    assert.ok(!itemIds.includes(kotItemC.id), "kotItemC (PENDING) is NOT present");
  });

  // TEST D & 6: Distribute only 1 item -> item is removed from ready queue, remaining item stays READY
  await t.test("D & 6: Server distributes Item A -> only Item A is removed; Item B stays READY; Burger stays PENDING", async () => {
    // Server distributes Pizza (kotItemA)
    await updateKotItemStatus({
      prisma,
      kotId: kot1.id,
      itemId: kotItemA.id,
      restaurantId: restaurant1.id,
      nextStatus: "SERVED",
    });

    const readyItems = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    
    assert.equal(readyItems.length, 1, "Only 1 item left in ready queue");
    assert.equal(readyItems[0].id, kotItemB.id, "Remaining item is kotItemB (Coffee)");
    
    // In DB, kotItemA is SERVED, kotItemB is READY, kotItemC is PENDING
    const checkA = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: kotItemA.id } });
    const checkB = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: kotItemB.id } });
    const checkC = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: kotItemC.id } });

    assert.equal(checkA.status, "SERVED");
    assert.equal(checkB.status, "READY");
    assert.equal(checkC.status, "PENDING");
  });

  // TEST I: Duplicate item names tracked independently
  await t.test("I: Duplicate item names (Chocolate x1, Chocolate x1) are tracked independently by KOTItem ID", async () => {
    duplicateItem1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Chocolate Truffle",
        qty: 1,
        status: "READY",
        readyAt: new Date(),
      },
    });

    duplicateItem2 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kot1.id,
        itemName: "Chocolate Truffle",
        qty: 1,
        status: "READY",
        readyAt: new Date(),
      },
    });

    const readyItems = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    // readyItems should now contain: kotItemB (Coffee) + duplicateItem1 + duplicateItem2 = 3 items
    assert.equal(readyItems.length, 3, "Queue contains exactly 3 ready items");

    const dupItems = readyItems.filter((it) => it.itemName === "Chocolate Truffle");
    assert.equal(dupItems.length, 2, "Both duplicate items appear independently");
    assert.notEqual(dupItems[0].id, dupItems[1].id, "Duplicate items have unique KOTItem IDs");

    // Distribute duplicateItem1
    await updateKotItemStatus({
      prisma,
      kotId: kot1.id,
      itemId: duplicateItem1.id,
      restaurantId: restaurant1.id,
      nextStatus: "SERVED",
    });

    const readyAfter = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    assert.equal(readyAfter.length, 2, "Queue decrements to 2 items");
    assert.ok(readyAfter.some((it) => it.id === duplicateItem2.id), "duplicateItem2 is still ready");
    assert.ok(!readyAfter.some((it) => it.id === duplicateItem1.id), "duplicateItem1 is removed");
  });

  // TEST J: Tenant isolation
  await t.test("J: Tenant isolation prevents items from Restaurant 2 appearing in Restaurant 1 queue", async () => {
    // Create an order & ready item in Restaurant 2
    const orderRest2 = await prisma.order.create({
      data: {
        restaurantId: restaurant2.id,
        orderNo: "ORD-REST2-1",
        status: "READY",
        tableNo: "T2",
        subtotal: 100,
        total: 100,
      },
    });

    const kotRest2 = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurant2.id,
        orderId: orderRest2.id,
        kotNo: "KOT-REST2-01",
        sequenceNumber: 1,
        status: "READY",
        tableNo: "T2",
      },
    });

    const readyRest2Item = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: kotRest2.id,
        itemName: "Secret Dish Rest 2",
        qty: 1,
        status: "READY",
        readyAt: new Date(),
      },
    });

    // Query Restaurant 1
    const rest1Queue = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    assert.ok(!rest1Queue.some((it) => it.id === readyRest2Item.id), "Rest 2 item NEVER appears in Rest 1 queue");
    assert.ok(rest1Queue.every((it) => it.restaurantId === restaurant1.id), "All items belong strictly to Rest 1");

    // Query Restaurant 2
    const rest2Queue = await getCanonicalReadyItems({ prisma, restaurantId: restaurant2.id });
    assert.equal(rest2Queue.length, 1, "Rest 2 has exactly 1 ready item");
    assert.equal(rest2Queue[0].id, readyRest2Item.id, "Rest 2 queue returns readyRest2Item");
  });

  // TEST K: Already served item cannot reappear
  await t.test("K: Already served item cannot reappear in ready queue", async () => {
    const checkQueue = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    assert.ok(!checkQueue.some((it) => it.id === kotItemA.id), "Served Item A cannot reappear");
    assert.ok(!checkQueue.some((it) => it.id === duplicateItem1.id), "Served duplicateItem1 cannot reappear");
  });

  // TEST L: Cancelled item cannot appear
  await t.test("L: Cancelled item cannot appear in ready queue", async () => {
    // Cancel kotItemC
    await updateKotItemStatus({
      prisma,
      kotId: kot1.id,
      itemId: kotItemC.id,
      restaurantId: restaurant1.id,
      nextStatus: "CANCELLED",
    });

    const queue = await getCanonicalReadyItems({ prisma, restaurantId: restaurant1.id });
    assert.ok(!queue.some((it) => it.id === kotItemC.id), "Cancelled item does not appear");
  });
});
