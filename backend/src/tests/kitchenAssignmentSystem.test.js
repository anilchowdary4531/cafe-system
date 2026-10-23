import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
  KitchenAssignmentError,
  getKitchenConfig,
  updateKitchenConfig,
  getKitchenWorkload,
  assignItemToChef,
  bulkAssignItems,
  assignAllKotItems,
  reassignItem,
  getChefAssignedItems,
  selfPickItem,
  selfPickKot,
  getAvailableKitchenWork,
} from "../services/kitchenAssignmentService.js";
import { updateKotItemStatus } from "../services/kotService.js";

test("Kitchen Senior Chef Dispatch + Self-Pick System Integration Suite", async (t) => {
  let restaurantA = null;
  let restaurantB = null;
  let seniorChef = null;
  let chefRavi = null;
  let chefSuresh = null;
  let chefOtherRest = null;
  let testKot = null;
  let item1 = null;
  let item2 = null;
  let item3 = null;

  t.before(async () => {
    // 1. Setup primary restaurant A
    restaurantA = await prisma.restaurant.create({
      data: {
        name: "Command Center Kitchen A",
        slug: `kitchen-a-${Date.now()}`,
        nextKotNumber: 200,
        kitchenAssignmentMode: "DISPATCHER",
        kitchenSelfPickScope: "ITEMS",
      },
    });

    // 2. Setup secondary restaurant B for tenant isolation testing
    restaurantB = await prisma.restaurant.create({
      data: {
        name: "Command Center Kitchen B",
        slug: `kitchen-b-${Date.now()}`,
        nextKotNumber: 1,
        kitchenAssignmentMode: "DISPATCHER",
        kitchenSelfPickScope: "ITEMS",
      },
    });

    // 3. Create Staff Members in Restaurant A
    seniorChef = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `seniorchef-${Date.now()}@tiffzy.com`,
        name: "Chef Vikram",
        role: "CHEF",
        designation: "Senior Chef",
        password: "dummy-password",
        isActive: true,
      },
    });

    chefRavi = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `chef-ravi-${Date.now()}@tiffzy.com`,
        name: "Chef Ravi",
        role: "CHEF",
        designation: "Line Chef",
        password: "dummy-password",
        isActive: true,
      },
    });

    chefSuresh = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantA.id } },
        email: `chef-suresh-${Date.now()}@tiffzy.com`,
        name: "Chef Suresh",
        role: "CHEF",
        designation: "Line Chef",
        password: "dummy-password",
        isActive: true,
      },
    });

    // 4. Create Staff in Restaurant B (Tenant Isolation)
    chefOtherRest = await prisma.user.create({
      data: {
        restaurant: { connect: { id: restaurantB.id } },
        email: `chef-other-${Date.now()}@tiffzy.com`,
        name: "Chef Other",
        role: "CHEF",
        designation: "Line Chef",
        password: "dummy-password",
        isActive: true,
      },
    });

    // 5. Create Order & KOT with Items in Restaurant A
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurantA.id,
        orderNo: `ORD-${Date.now()}`,
        status: "PLACED",
        tableNo: "T1",
        subtotal: 750,
        total: 750,
      },
    });

    testKot = await prisma.kitchenOrderTicket.create({
      data: {
        restaurantId: restaurantA.id,
        orderId: order.id,
        kotNo: "KOT-500",
        sequenceNumber: 1,
        status: "PENDING",
        priority: "NORMAL",
        tableNo: "T1",
      },
    });

    item1 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: testKot.id,
        itemName: "Paneer Butter Masala",
        qty: 2,
        status: "PENDING",
      },
    });

    item2 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: testKot.id,
        itemName: "Garlic Naan",
        qty: 4,
        status: "PENDING",
      },
    });

    item3 = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: testKot.id,
        itemName: "Jeera Rice",
        qty: 1,
        status: "PENDING",
      },
    });
  });

  t.after(async () => {
    // Cleanup
    if (restaurantA) {
      await prisma.auditLog.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: restaurantA.id } } });
      await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.order.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.user.deleteMany({ where: { restaurantId: restaurantA.id } });
      await prisma.restaurant.delete({ where: { id: restaurantA.id } });
    }
    if (restaurantB) {
      await prisma.auditLog.deleteMany({ where: { restaurantId: restaurantB.id } });
      await prisma.user.deleteMany({ where: { restaurantId: restaurantB.id } });
      await prisma.restaurant.delete({ where: { id: restaurantB.id } });
    }
  });

  // TEST 1: Config Fetch & Update
  await t.test("1. Kitchen Config: Fetch and toggle mode and scope", async () => {
    const config = await getKitchenConfig({ restaurantId: restaurantA.id });
    assert.equal(config.ok, true);
    assert.equal(config.mode, "DISPATCHER");
    assert.equal(config.scope, "ITEMS");

    const updated = await updateKitchenConfig({
      restaurantId: restaurantA.id,
      mode: "SELF_PICK",
      scope: "BOTH",
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });
    assert.equal(updated.mode, "SELF_PICK");
    assert.equal(updated.scope, "BOTH");

    // Reset back to DISPATCHER for dispatcher assignment tests
    await updateKitchenConfig({
      restaurantId: restaurantA.id,
      mode: "DISPATCHER",
      scope: "ITEMS",
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });
  });

  // TEST 2: Dispatcher Individual Item Assignment
  await t.test("2. Dispatcher Mode: Assign individual item to Chef Ravi", async () => {
    const result = await assignItemToChef({
      restaurantId: restaurantA.id,
      itemId: item1.id,
      chefId: chefRavi.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.item.assignedChefId, chefRavi.id);
    assert.equal(result.item.assignedChefName, "Chef Ravi");
    assert.equal(result.item.assignmentSource, "DISPATCHED");
    assert.ok(result.item.assignedAt);

    // Verify in database
    const dbItem = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item1.id } });
    assert.equal(dbItem.assignedChefId, chefRavi.id);
    assert.equal(dbItem.assignmentSource, "DISPATCHED");
  });

  // TEST 3: Tenant Isolation: Cannot assign Chef from another restaurant
  await t.test("3. Security / Tenant Isolation: Rejects chef from different restaurant", async () => {
    await assert.rejects(
      async () => {
        await assignItemToChef({
          restaurantId: restaurantA.id,
          itemId: item2.id,
          chefId: chefOtherRest.id,
          actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
        });
      },
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.code, "CHEF_NOT_FOUND");
        return true;
      }
    );
  });

  // TEST 4: Reassignment
  await t.test("4. Reassignment: Senior Chef reassigns item1 from Ravi to Suresh", async () => {
    const reassigned = await reassignItem({
      restaurantId: restaurantA.id,
      itemId: item1.id,
      newChefId: chefSuresh.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });

    assert.equal(reassigned.ok, true);
    assert.equal(reassigned.item.assignedChefId, chefSuresh.id);
    assert.equal(reassigned.item.assignedChefName, "Chef Suresh");

    const dbItem = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item1.id } });
    assert.equal(dbItem.assignedChefId, chefSuresh.id);
  });

  // TEST 5: Bulk Assignment
  await t.test("5. Bulk Assignment: Assign multiple items atomically to Chef Ravi", async () => {
    const bulkRes = await bulkAssignItems({
      restaurantId: restaurantA.id,
      itemIds: [item2.id, item3.id],
      chefId: chefRavi.id,
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });

    assert.equal(bulkRes.ok, true);
    assert.equal(bulkRes.count, 2);

    const dbItem2 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item2.id } });
    const dbItem3 = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item3.id } });
    assert.equal(dbItem2.assignedChefId, chefRavi.id);
    assert.equal(dbItem3.assignedChefId, chefRavi.id);
  });

  // TEST 6: Chef Station Security (Chef Ravi cannot inspect Chef Suresh's station)
  await t.test("6. Station Access Control: Chef Ravi requesting Chef Suresh station returns 403", async () => {
    await assert.rejects(
      async () => {
        await getChefAssignedItems({
          restaurantId: restaurantA.id,
          chefId: chefSuresh.id,
          requestingActor: { userId: chefRavi.id, id: chefRavi.id, role: "CHEF", designation: "Line Chef" },
        });
      },
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.code, "FORBIDDEN_STATION_ACCESS");
        return true;
      }
    );

    // But Senior Chef or Chef Suresh himself CAN request Chef Suresh station
    const selfRes = await getChefAssignedItems({
      restaurantId: restaurantA.id,
      chefId: chefSuresh.id,
      requestingActor: { userId: chefSuresh.id, id: chefSuresh.id, role: "CHEF", designation: "Line Chef" },
    });
    assert.equal(selfRes.ok, true);
    assert.equal(selfRes.items.length, 1);
    assert.equal(selfRes.items[0].id, item1.id);
  });

  // TEST 7: Workload Calculation
  await t.test("7. Kitchen Workload: Returns active workload metrics", async () => {
    const workload = await getKitchenWorkload({ restaurantId: restaurantA.id });
    assert.equal(workload.ok, true);
    assert.ok(Array.isArray(workload.chefs));

    const raviStats = workload.chefs.find((c) => c.chefId === chefRavi.id);
    assert.ok(raviStats);
    assert.equal(raviStats.assigned, 2); // item2 and item3

    const sureshStats = workload.chefs.find((c) => c.chefId === chefSuresh.id);
    assert.ok(sureshStats);
    assert.equal(sureshStats.assigned, 1); // item1
  });

  // TEST 8: Preparation Status Lifecycle
  await t.test("8. Preparation Lifecycle: START PREPARING and MARK READY", async () => {
    // Start preparing item1
    const prepResult = await updateKotItemStatus({
      prisma,
      kotId: testKot.id,
      itemId: item1.id,
      restaurantId: restaurantA.id,
      nextStatus: "PREPARING",
      actor: { userId: chefSuresh.id, userName: "Chef Suresh" },
    });

    const dbPrepItem = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item1.id } });
    assert.equal(dbPrepItem.status, "PREPARING");
    assert.ok(dbPrepItem.startedAt);

    // Mark ready item1
    await updateKotItemStatus({
      prisma,
      kotId: testKot.id,
      itemId: item1.id,
      restaurantId: restaurantA.id,
      nextStatus: "READY",
      actor: { userId: chefSuresh.id, userName: "Chef Suresh" },
    });

    const dbReadyItem = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: item1.id } });
    assert.equal(dbReadyItem.status, "READY");
    assert.ok(dbReadyItem.readyAt);
    assert.equal(dbReadyItem.preparedByUserId, chefSuresh.id);
  });

  // TEST 9 & 10: Self-Pick & Atomic Race Condition Test
  await t.test("9 & 10. CRITICAL CONCURRENCY: Simultaneous Self-Pick Race Condition", async () => {
    // Enable SELF_PICK mode
    await updateKitchenConfig({
      restaurantId: restaurantA.id,
      mode: "SELF_PICK",
      scope: "BOTH",
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });

    // Create a new unassigned item on KOT
    const raceItem = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: testKot.id,
        itemName: "Butter Chicken Special",
        qty: 1,
        status: "PENDING",
        assignedChefId: null,
      },
    });

    // Simulate simultaneous claiming: Chef Ravi and Chef Suresh claim raceItem at the exact same time
    const results = await Promise.allSettled([
      selfPickItem({
        restaurantId: restaurantA.id,
        itemId: raceItem.id,
        chefId: chefRavi.id,
        actor: { userId: chefRavi.id, userName: "Chef Ravi" },
      }),
      selfPickItem({
        restaurantId: restaurantA.id,
        itemId: raceItem.id,
        chefId: chefSuresh.id,
        actor: { userId: chefSuresh.id, userName: "Chef Suresh" },
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // EXACTLY ONE must succeed
    assert.equal(fulfilled.length, 1, "Exactly one claim must succeed");
    assert.equal(rejected.length, 1, "Exactly one claim must fail with conflict");

    // The failing one must receive 409 Conflict with ITEM_ALREADY_CLAIMED
    const rejectionReason = rejected[0].reason;
    assert.equal(rejectionReason.status, 409);
    assert.equal(rejectionReason.code, "ITEM_ALREADY_CLAIMED");

    // Database verification: exactly one chef assigned
    const dbWinner = await prisma.kitchenOrderTicketItem.findUnique({ where: { id: raceItem.id } });
    assert.ok(dbWinner.assignedChefId === chefRavi.id || dbWinner.assignedChefId === chefSuresh.id);
    assert.equal(dbWinner.assignmentSource, "SELF_PICKED");
  });

  // TEST 11: Self-Pick Disabled in Dispatcher Mode
  await t.test("11. Self-Pick: Rejected when kitchen mode is DISPATCHER", async () => {
    // Switch to DISPATCHER
    await updateKitchenConfig({
      restaurantId: restaurantA.id,
      mode: "DISPATCHER",
      scope: "ITEMS",
      actor: { userId: seniorChef.id, userName: seniorChef.name, role: "CHEF" },
    });

    const unassignedItem = await prisma.kitchenOrderTicketItem.create({
      data: {
        kotId: testKot.id,
        itemName: "Roti",
        qty: 2,
        status: "PENDING",
        assignedChefId: null,
      },
    });

    await assert.rejects(
      async () => {
        await selfPickItem({
          restaurantId: restaurantA.id,
          itemId: unassignedItem.id,
          chefId: chefRavi.id,
          actor: { userId: chefRavi.id, userName: "Chef Ravi" },
        });
      },
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.code, "SELF_PICK_DISABLED");
        return true;
      }
    );
  });

  // TEST 12: Audit Logging Verification
  await t.test("12. Audit Logging: Structured audit events exist in PostgreSQL", async () => {
    const logs = await prisma.auditLog.findMany({
      where: { restaurantId: restaurantA.id },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(logs.length >= 3, "Expected at least 3 audit log events");
    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes("KITCHEN_ASSIGNMENT_MODE_CHANGED"), "Mode change logged");
    assert.ok(actions.includes("KITCHEN_ITEM_ASSIGNED"), "Item assign logged");
    assert.ok(actions.includes("KITCHEN_ITEM_REASSIGNED"), "Item reassign logged");
    assert.ok(actions.includes("KITCHEN_ITEM_SELF_PICKED"), "Self pick logged");
  });
});
