import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../prisma.js";
import {
  assignWaiterToTable,
  getWaiterAssignmentHistory,
  getWaiterWorkspaceData,
  getStaffPerformanceMetrics,
} from "../services/staffManagementService.js";
import { createAuditLog, getAuditLogs } from "../services/auditLogService.js";
import {
  approveCancellation,
  approveDiscount,
  approveReprint,
} from "../controllers/managerApprovalController.js";
import { getOrCreateActiveSession } from "../services/tableSessionService.js";

test("Feature 20 - Staff Management, Waiter Workspace & Manager Approvals Integration Suite", async (t) => {
  let testRestaurant = null;
  let testRestaurantB = null;
  let waiterUser = null;
  let waiterUser2 = null;
  let managerUser = null;
  let testTable = null;
  let testSession = null;
  let testOrder = null;

  t.before(async () => {
    // 1. Create primary restaurant
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: "Staff Ops Bistro",
        slug: `staff-ops-${Date.now()}`,
      },
    });

    // 2. Create secondary restaurant for tenant isolation checks
    testRestaurantB = await prisma.restaurant.create({
      data: {
        name: "Isolated Diner",
        slug: `isolated-diner-${Date.now()}`,
      },
    });

    // 3. Create Waiter staff users
    waiterUser = await prisma.user.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "John Waiter",
        email: `john.waiter.${Date.now()}@example.com`,
        role: "WAITER",
        designation: "Head Waiter",
        isActive: true,
        sessionVersion: 1,
      },
    });

    waiterUser2 = await prisma.user.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Sarah Waiter",
        email: `sarah.waiter.${Date.now()}@example.com`,
        role: "WAITER",
        designation: "Junior Waiter",
        isActive: true,
        sessionVersion: 1,
      },
    });

    // 4. Create Manager staff user
    managerUser = await prisma.user.create({
      data: {
        restaurantId: testRestaurant.id,
        name: "Alice Manager",
        email: `alice.manager.${Date.now()}@example.com`,
        role: "MANAGER",
        designation: "Floor Manager",
        isActive: true,
        sessionVersion: 1,
      },
    });

    // 5. Create Dining Table
    testTable = await prisma.diningTable.create({
      data: {
        restaurantId: testRestaurant.id,
        tableNo: "T-20",
        capacity: 4,
        floor: "Main Floor",
        qrToken: `QR-T20-${Date.now()}`,
      },
    });
  });

  t.after(async () => {
    // Cleanup created records in reverse order
    if (testOrder) {
      await prisma.kOTItem.deleteMany({ where: { orderId: testOrder.id } });
      await prisma.kOT.deleteMany({ where: { orderId: testOrder.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
      await prisma.order.delete({ where: { id: testOrder.id } }).catch(() => {});
    }
    if (testTable) {
      await prisma.tableWaiterAssignment.deleteMany({ where: { tableId: testTable.id } });
      await prisma.tableSession.deleteMany({ where: { tableId: testTable.id } });
      await prisma.diningTable.delete({ where: { id: testTable.id } }).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { restaurantId: testRestaurant?.id } });
    if (waiterUser) await prisma.user.delete({ where: { id: waiterUser.id } }).catch(() => {});
    if (waiterUser2) await prisma.user.delete({ where: { id: waiterUser2.id } }).catch(() => {});
    if (managerUser) await prisma.user.delete({ where: { id: managerUser.id } }).catch(() => {});
    if (testRestaurant) await prisma.restaurant.delete({ where: { id: testRestaurant.id } }).catch(() => {});
    if (testRestaurantB) await prisma.restaurant.delete({ where: { id: testRestaurantB.id } }).catch(() => {});
  });

  await t.test("1. Waiter Assignment to Table & Session Inheritance", async () => {
    // Assign John Waiter to T-20
    const assignRes = await assignWaiterToTable({
      prisma,
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
      waiterId: waiterUser.id,
      actor: { userId: managerUser.id, userName: managerUser.name, role: managerUser.role },
      reason: "Initial shift assignment",
    });

    assert.equal(assignRes.table.assignedWaiterId, waiterUser.id);
    assert.equal(assignRes.table.assignedWaiterName, "John Waiter");
    assert.ok(assignRes.assignmentLog);

    // Verify diningTable record in DB
    const updatedTable = await prisma.diningTable.findUnique({ where: { id: testTable.id } });
    assert.equal(updatedTable.assignedWaiterId, waiterUser.id);

    // Now start a TableSession on T-20 without specifying waiter — should inherit John Waiter
    testSession = await getOrCreateActiveSession({
      db: prisma,
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
    });

    assert.equal(testSession.assignedWaiterId, waiterUser.id);
    assert.equal(testSession.assignedWaiterName, "John Waiter");
  });

  await t.test("2. Table Waiter Reassignment & Log Tracking", async () => {
    // Reassign T-20 from John Waiter to Sarah Waiter
    const reassignRes = await assignWaiterToTable({
      prisma,
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
      tableSessionId: testSession.id,
      waiterId: waiterUser2.id,
      actor: { userId: managerUser.id, userName: managerUser.name, role: managerUser.role },
      reason: "Table reassigned for break coverage",
    });

    assert.equal(reassignRes.table.assignedWaiterId, waiterUser2.id);
    assert.equal(reassignRes.table.assignedWaiterName, "Sarah Waiter");

    // Check active session was updated as well
    const sessionInDb = await prisma.tableSession.findUnique({ where: { id: testSession.id } });
    assert.equal(sessionInDb.assignedWaiterId, waiterUser2.id);

    // Fetch assignment history log for T-20
    const history = await getWaiterAssignmentHistory({
      prisma,
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
    });

    assert.ok(history.length >= 2);
    assert.equal(history[0].action, "REASSIGNED");
    assert.equal(history[0].waiterId, waiterUser2.id);
    assert.equal(history[1].action, "ASSIGNED");
    assert.equal(history[1].waiterId, waiterUser.id);
  });

  await t.test("3. Waiter Workspace Data Aggregation", async () => {
    // Create an order for testSession
    testOrder = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        orderNo: `ORD-W1-${Date.now()}`,
        orderType: "DINE_IN",
        orderSource: "POS",
        status: "PREPARING",
        paymentStatus: "PENDING",
        tableSessionId: testSession.id,
        waiterId: waiterUser2.id,
        waiterName: waiterUser2.name,
        total: 500,
        subtotal: 500,
      },
    });

    // Create a KOT ready for pickup
    const testKot = await prisma.kOT.create({
      data: {
        restaurantId: testRestaurant.id,
        orderId: testOrder.id,
        kotNo: "KOT-901",
        status: "READY",
        tableSessionId: testSession.id,
      },
    });

    // Aggregated workspace data for Sarah Waiter
    const workspace = await getWaiterWorkspaceData({
      prisma,
      restaurantId: testRestaurant.id,
      waiterId: waiterUser2.id,
    });

    assert.equal(workspace.waiter.id, waiterUser2.id);
    assert.ok(Array.isArray(workspace.assignedTables));
    assert.equal(workspace.assignedTables.length, 1);
    assert.equal(workspace.assignedTables[0].id, testTable.id);

    assert.ok(Array.isArray(workspace.openOrders));
    assert.equal(workspace.openOrders.length, 1);
    assert.equal(workspace.openOrders[0].id, testOrder.id);

    assert.ok(Array.isArray(workspace.readyKots));
    assert.equal(workspace.readyKots.length, 1);
    assert.equal(workspace.readyKots[0].id, testKot.id);

    // Clean up created KOT
    await prisma.kOT.delete({ where: { id: testKot.id } });
  });

  await t.test("4. Manager Approvals & Database Audit Logging", async () => {
    // Audit log creation directly
    const audit = await createAuditLog({
      prisma,
      restaurantId: testRestaurant.id,
      actorUserId: managerUser.id,
      actorName: managerUser.name,
      actorRole: managerUser.role,
      action: "MANAGER_APPROVAL_DISCOUNT",
      entity: "Order",
      entityId: String(testOrder.id),
      details: { discountPercent: 15, reason: "VIP Customer" },
    });

    assert.ok(audit.id);
    assert.equal(audit.action, "MANAGER_APPROVAL_DISCOUNT");

    // Retrieve audit logs via service
    const logsRes = await getAuditLogs({
      prisma,
      restaurantId: testRestaurant.id,
      action: "MANAGER_APPROVAL_DISCOUNT",
    });

    assert.ok(logsRes.logs.length >= 1);
    assert.equal(logsRes.logs[0].entityId, String(testOrder.id));

    // Test controller endpoint functions
    let replyMockCode = null;
    let replyMockPayload = null;
    const mockReply = {
      code(c) {
        replyMockCode = c;
        return this;
      },
      send(p) {
        replyMockPayload = p;
        return p;
      },
    };

    const reqMock = {
      params: { restaurantId: testRestaurant.id },
      body: {
        orderId: testOrder.id,
        discountAmount: 50,
        discountReason: "Manager promotion",
      },
      user: {
        id: managerUser.id,
        name: managerUser.name,
        role: managerUser.role,
        restaurantId: testRestaurant.id,
      },
    };

    const approvalRes = await approveDiscount(reqMock, mockReply);
    assert.equal(approvalRes.ok, true);
    assert.ok(approvalRes.auditLog);
  });

  await t.test("5. Staff Performance Metrics Aggregation", async () => {
    // Sarah Waiter metrics
    const metrics = await getStaffPerformanceMetrics({
      prisma,
      restaurantId: testRestaurant.id,
      staffUserId: waiterUser2.id,
    });

    assert.equal(metrics.staff.id, waiterUser2.id);
    assert.ok(metrics.metrics.tablesAssignedCurrent >= 1);
    assert.ok(metrics.metrics.totalSalesAttributed >= 500);
    assert.ok(metrics.metrics.totalOrdersHandled >= 1);
  });

  await t.test("6. Staff Deactivation Session Invalidation Logic", async () => {
    const updatedStaff = await prisma.user.update({
      where: { id: waiterUser.id },
      data: {
        isActive: false,
        sessionVersion: { increment: 1 },
      },
    });

    assert.equal(updatedStaff.isActive, false);
    assert.equal(updatedStaff.sessionVersion, 2);
  });

  await t.test("7. Tenant Isolation Enforcement", async () => {
    // Attempting to query workspace across tenants should return isolated result
    const workspaceTenantB = await getWaiterWorkspaceData({
      prisma,
      restaurantId: testRestaurantB.id,
      waiterId: waiterUser2.id,
    });

    assert.equal(workspaceTenantB.assignedTables.length, 0);
    assert.equal(workspaceTenantB.openOrders.length, 0);
  });
});
