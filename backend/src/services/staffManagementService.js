import { logAuditEvent } from "./auditLogService.js";

/**
 * Assign or Reassign Waiter to Table & TableSession
 */
export const assignWaiterToTable = async ({
    prisma,
    restaurantId,
    tableId,
    tableSessionId = null,
    waiterId,
    actor = null,
    reason = null,
} = {}) => {
    const rid = Number(restaurantId);
    const tid = Number(tableId);
    const wid = Number(waiterId);

    if (!rid || !tid || !wid) {
        throw new Error("Missing required parameters for waiter assignment");
    }

    // 1. Verify Waiter User
    const waiter = await prisma.user.findFirst({
        where: { id: wid, restaurantId: rid, isActive: true },
        select: { id: true, name: true, role: true },
    });

    if (!waiter) {
        throw new Error("Active waiter not found for this restaurant");
    }

    // 2. Fetch Dining Table
    const table = await prisma.diningTable.findFirst({
        where: { id: tid, restaurantId: rid },
    });
    if (!table) throw new Error("table_not_found");

    const isReassignment = Boolean(table.assignedWaiterId && table.assignedWaiterId !== wid);

    // 3. Update DiningTable default assigned waiter
    const updatedTable = await prisma.diningTable.update({
        where: { id: tid },
        data: {
            assignedWaiterId: waiter.id,
            assignedWaiterName: waiter.name,
        },
    });

    // 4. If an active session exists on the table, update its assigned waiter as well
    let updatedSession = null;
    let targetSessionId = tableSessionId ? Number(tableSessionId) : null;

    if (!targetSessionId) {
        const activeSession = await prisma.tableSession.findFirst({
            where: { tableId: tid, restaurantId: rid, status: { in: ["OPEN", "BILLING"] } },
        });
        if (activeSession) targetSessionId = activeSession.id;
    }

    if (targetSessionId) {
        updatedSession = await prisma.tableSession.update({
            where: { id: targetSessionId },
            data: {
                waiterId: waiter.id,
                waiterName: waiter.name,
            },
        });
    }

    // 5. Record Assignment History
    const assignmentLog = await prisma.tableWaiterAssignment.create({
        data: {
            restaurantId: rid,
            tableId: tid,
            tableSessionId: targetSessionId || null,
            waiterId: waiter.id,
            waiterName: waiter.name,
            assignedByUserId: actor?.userId || actor?.id ? Number(actor?.userId || actor?.id) : null,
            assignedByName: actor?.userName || actor?.name || actor?.email || "Staff",
            action: isReassignment ? "REASSIGNED" : "ASSIGNED",
            reason: reason ? String(reason) : null,
        },
    });

    // 6. Audit Log
    await logAuditEvent({
        prisma,
        restaurantId: rid,
        actor,
        action: isReassignment ? "WAITER_REASSIGNED" : "WAITER_ASSIGNED",
        entity: "DiningTable",
        entityId: String(tid),
        details: {
            tableNo: table.tableNo,
            waiterId: waiter.id,
            waiterName: waiter.name,
            reason,
        },
    });

    return { table: updatedTable, session: updatedSession, assignmentLog };
};

/**
 * Get Waiter Assignment History for a Table
 */
export const getWaiterAssignmentHistory = async ({ prisma, restaurantId, tableId, limit = 20 } = {}) => {
    const rid = Number(restaurantId);
    const tid = Number(tableId);

    const history = await prisma.tableWaiterAssignment.findMany({
        where: { restaurantId: rid, tableId: tid },
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: { createdAt: "desc" },
    });

    return history;
};

/**
 * Waiter Workspace Data Aggregator
 */
export const getWaiterWorkspaceData = async ({ prisma, restaurantId, waiterId } = {}) => {
    const rid = Number(restaurantId);
    const wid = Number(waiterId);

    if (!rid || !wid) throw new Error("restaurantId and waiterId are required");

    // Assigned tables
    const assignedTables = await prisma.diningTable.findMany({
        where: { restaurantId: rid, assignedWaiterId: wid, isActive: true },
        include: {
            tableSessions: {
                where: { status: { in: ["OPEN", "BILLING"] } },
                orderBy: { openedAt: "desc" },
                take: 1,
            },
        },
    });

    const activeSessionIds = assignedTables
        .map((t) => t.tableSessions[0]?.id)
        .filter(Boolean);

    // Active Orders for assigned tables
    const openOrders = await prisma.order.findMany({
        where: {
            restaurantId: rid,
            status: { in: ["PLACED", "ACCEPTED", "PREPARING", "READY"] },
            OR: [
                { createdByUserId: wid },
                { tableSessionId: { in: activeSessionIds } },
                { tableNo: { in: assignedTables.map((t) => t.tableNo) } },
            ],
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
    });

    // Ready KOTs needing server delivery
    const readyKots = await prisma.kitchenOrderTicket.findMany({
        where: {
            restaurantId: rid,
            status: "READY",
            OR: [
                { waiterId: wid },
                { tableNo: { in: assignedTables.map((t) => t.tableNo) } },
            ],
        },
        include: { items: true, station: true },
        orderBy: { updatedAt: "desc" },
    });

    return {
        assignedTables,
        openOrders,
        readyKots,
        summary: {
            totalTables: assignedTables.length,
            activeOrdersCount: openOrders.length,
            readyKotsCount: readyKots.length,
        },
    };
};

/**
 * Staff Operational Performance Metrics
 */
export const getStaffPerformanceMetrics = async ({ prisma, restaurantId, staffUserId } = {}) => {
    const rid = Number(restaurantId);
    const sid = Number(staffUserId);

    if (!rid || !sid) throw new Error("restaurantId and staffUserId are required");

    const user = await prisma.user.findFirst({
        where: { id: sid, restaurantId: rid },
        select: { id: true, name: true, role: true, designation: true },
    });
    if (!user) throw new Error("Staff member not found");

    // Orders handled
    const orders = await prisma.order.findMany({
        where: {
            restaurantId: rid,
            OR: [
                { createdByUserId: sid },
            ],
        },
        select: { id: true, total: true, status: true, createdAt: true },
    });

    // Sessions served
    const sessions = await prisma.tableSession.findMany({
        where: { restaurantId: rid, waiterId: sid },
        select: { id: true, total: true, status: true, openedAt: true, closedAt: true },
    });

    const totalOrdersCount = orders.length;
    const completedOrders = orders.filter((o) => o.status === "DELIVERED" || o.status === "READY");
    const totalSales = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cancelledCount = orders.filter((o) => o.status === "CANCELLED").length;

    // Shift sessions
    const shifts = await prisma.cashierShift.findMany({
        where: { restaurantId: rid, userId: sid },
        take: 10,
        orderBy: { openedAt: "desc" },
    });

    return {
        staff: user,
        metrics: {
            totalOrdersCount,
            completedOrdersCount: completedOrders.length,
            totalSalesAttributed: totalSales,
            tablesServedCount: sessions.length,
            cancelledCount,
            shiftsCount: shifts.length,
        },
        recentShifts: shifts,
    };
};
