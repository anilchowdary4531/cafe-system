import { logAuditEvent } from "./auditLogService.js";
import { createAndDispatchNotification } from "./notificationService.js";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES } from "../constants/notificationTypes.js";
import { inferRoleFromDesignation } from "./staffSessionService.js";

/**
 * Unassign Waiter from Table & TableSession
 */
export const unassignWaiterFromTable = async ({
    prisma,
    restaurantId,
    tableId,
    tableSessionId = null,
    actor = null,
    reason = null,
    realtime = null,
} = {}) => {
    const rid = Number(restaurantId);
    const tid = Number(tableId);

    if (!rid || !tid) {
        throw new Error("Missing required parameters for waiter unassignment");
    }

    // 1. Fetch Dining Table
    let table = await prisma.diningTable.findFirst({
        where: { id: tid, restaurantId: rid },
    });
    if (!table) {
        table = await prisma.diningTable.findUnique({ where: { id: tid } });
    }
    if (!table) throw new Error("table_not_found");
    const effectiveRid = table.restaurantId || rid;

    const previousWaiterId = table.assignedWaiterId;
    const previousWaiterName = table.assignedWaiterName;

    // 2. Update DiningTable
    const updatedTable = await prisma.diningTable.update({
        where: { id: tid },
        data: {
            assignedWaiterId: null,
            assignedWaiterName: null,
        },
    });

    // 3. If an active session exists on the table, unassign its waiter as well
    let updatedSession = null;
    let targetSessionId = tableSessionId ? Number(tableSessionId) : null;

    if (!targetSessionId) {
        const activeSession = await prisma.tableSession.findFirst({
            where: { tableId: tid, restaurantId: effectiveRid, status: { in: ["OPEN", "BILLING"] } },
        });
        if (activeSession) targetSessionId = activeSession.id;
    }

    if (targetSessionId) {
        updatedSession = await prisma.tableSession.update({
            where: { id: targetSessionId },
            data: {
                waiterId: null,
                waiterName: null,
            },
        });
    }

    // 4. Record Assignment History
    let assignmentLog = null;
    if (previousWaiterId) {
        assignmentLog = await prisma.tableWaiterAssignment.create({
            data: {
                restaurantId: effectiveRid,
                tableId: tid,
                tableSessionId: targetSessionId || null,
                waiterId: previousWaiterId,
                waiterName: previousWaiterName,
                assignedByUserId: actor?.userId || actor?.id ? Number(actor?.userId || actor?.id) : null,
                assignedByName: actor?.userName || actor?.name || actor?.email || "Staff",
                action: "UNASSIGNED",
                reason: reason ? String(reason) : "Unassigned from table",
            },
        });
    }

    // 5. Audit Log
    await logAuditEvent({
        prisma,
        restaurantId: effectiveRid,
        actor,
        action: "WAITER_UNASSIGNED",
        entity: "DiningTable",
        entityId: String(tid),
        details: {
            tableNo: table.tableNo,
            previousWaiterId,
            previousWaiterName,
            reason,
        },
    });

    // 6. Dispatch persistent in-app notification to unassigned waiter
    if (previousWaiterId) {
        try {
            await createAndDispatchNotification({
                prisma,
                realtime,
                recipientType: RECIPIENT_TYPES.USER,
                recipientId: previousWaiterId,
                restaurantId: effectiveRid,
                notificationType: NOTIFICATION_TYPES.TABLE_UNASSIGNED || "TABLE_UNASSIGNED",
                title: `Table Assigned — Unassigned Table ${table.tableNo}`,
                message: `You have been unassigned from Table ${table.tableNo}.`,
                data: {
                    tableId: tid,
                    tableNo: table.tableNo,
                    restaurantId: effectiveRid,
                    action: "UNASSIGNED",
                },
                idempotencyKey: `waiter_unassigned_${tid}_${previousWaiterId}_${Math.floor(Date.now() / 30000)}`,
            }).catch((err) => console.warn("[StaffService] Unassignment notification warning:", err?.message));
        } catch (_) {}
    }

    return { table: updatedTable, session: updatedSession, assignmentLog };
};

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
    realtime = null,
} = {}) => {
    const rid = Number(restaurantId);
    const tid = Number(tableId);

    if (!rid || !tid) {
        throw new Error("Missing required parameters for waiter assignment");
    }

    if (waiterId === null || waiterId === undefined || waiterId === "" || Number(waiterId) === 0) {
        return unassignWaiterFromTable({
            prisma,
            restaurantId: rid,
            tableId: tid,
            tableSessionId,
            actor,
            reason,
            realtime,
        });
    }

    const wid = Number(waiterId);

    // 1. Fetch Dining Table first to determine effective restaurant context
    let table = await prisma.diningTable.findFirst({
        where: { id: tid, restaurantId: rid },
    });
    if (!table) {
        table = await prisma.diningTable.findUnique({ where: { id: tid } });
    }
    if (!table) throw new Error("table_not_found");
    const effectiveRid = table.restaurantId || rid;

    // 2. Verify Waiter User
    const waiter = await prisma.user.findFirst({
        where: {
            id: wid,
            isActive: true,
            OR: [
                { restaurantId: effectiveRid },
                { staffAccess: { restaurantId: effectiveRid } },
                { role: "OWNER", OR: [{ restaurantId: effectiveRid }, { restaurantId: null }] },
                { role: "SUPER_ADMIN" },
            ],
        },
        select: { id: true, name: true, role: true },
    });

    if (!waiter) {
        throw new Error("Active waiter not found for this restaurant");
    }

    const isReassignment = Boolean(table.assignedWaiterId && table.assignedWaiterId !== wid);
    const previousWaiterId = isReassignment ? table.assignedWaiterId : null;

    // Concurrency / Permission Guard:
    // Ordinary staff members cannot overwrite an existing server's table assignment without Owner/Manager authorization or force flag
    if (isReassignment && actor && actor.role !== "OWNER" && actor.role !== "MANAGER" && !actor.force) {
        throw new Error(`Table ${table.tableNo} is already assigned to ${table.assignedWaiterName || 'another server'}. Manager/Owner re-assignment required.`);
    }

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

    // 7. Dispatch persistent in-app notification to assigned waiter
    try {
        await createAndDispatchNotification({
            prisma,
            realtime,
            recipientType: RECIPIENT_TYPES.USER,
            recipientId: waiter.id,
            restaurantId: rid,
            notificationType: NOTIFICATION_TYPES.TABLE_ASSIGNMENT || "TABLE_ASSIGNMENT",
            title: `📋 Table Assigned — Table ${table.tableNo}`,
            message: `Table ${table.tableNo} has been assigned to you. Please check/attend Table ${table.tableNo}.`,
            data: {
                tableId: tid,
                tableNo: table.tableNo,
                restaurantId: rid,
                action: isReassignment ? "REASSIGNED" : "ASSIGNED",
            },
            idempotencyKey: `waiter_assigned_${tid}_${waiter.id}_${Math.floor(Date.now() / 30000)}`,
        }).catch((err) => console.warn("[StaffService] Assignment notification warning:", err?.message));
    } catch (_) {}

    // 8. If reassignment, dispatch notification to previous waiter
    if (isReassignment && previousWaiterId) {
        try {
            await createAndDispatchNotification({
                prisma,
                realtime,
                recipientType: RECIPIENT_TYPES.USER,
                recipientId: previousWaiterId,
                restaurantId: rid,
                notificationType: NOTIFICATION_TYPES.TABLE_UNASSIGNED || "TABLE_UNASSIGNED",
                title: `Table Assigned — Reassigned Table ${table.tableNo}`,
                message: `Table ${table.tableNo} has been reassigned to ${waiter.name}.`,
                data: {
                    tableId: tid,
                    tableNo: table.tableNo,
                    restaurantId: rid,
                    action: "REASSIGNED",
                    newWaiterId: waiter.id,
                    newWaiterName: waiter.name,
                },
                idempotencyKey: `waiter_reassigned_prev_${tid}_${previousWaiterId}_${Math.floor(Date.now() / 30000)}`,
            }).catch((err) => console.warn("[StaffService] Reassignment previous waiter notification warning:", err?.message));
        } catch (_) {}
    }

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

/**
 * Determine if a user's authoritative designation/role maps to CLEANER / HOUSEKEEPING.
 */
export const isCleanerStaff = (user) => {
    if (!user || user.isActive === false) return false;
    const des = String(user.designation || "").trim().toUpperCase();
    const role = String(user.role || "").trim().toUpperCase();
    return (
        des.includes("CLEANER") ||
        des.includes("HOUSEKEEPING") ||
        role === "CLEANER" ||
        inferRoleFromDesignation(user.designation) === "CLEANER"
    );
};

/**
 * Determine if a user's authoritative designation/role maps to STEWARD.
 */
export const isStewardStaff = (user) => {
    if (!user || user.isActive === false) return false;
    const des = String(user.designation || "").trim().toUpperCase();
    const role = String(user.role || "").trim().toUpperCase();
    return (
        des.includes("STEWARD") ||
        role === "STEWARD" ||
        inferRoleFromDesignation(user.designation) === "STEWARD"
    );
};

/**
 * Authoritatively calculates active staff capabilities for a restaurant.
 */
export const getActiveStaffByCapability = async ({ prisma, restaurantId }) => {
    const rid = Number(restaurantId);
    if (!rid || !prisma?.user?.findMany) {
        return {
            activeCleaners: [],
            activeStewards: [],
            hasCleaner: false,
            hasSteward: false,
            cleanerCount: 0,
            stewardCount: 0,
        };
    }

    const activeStaff = await prisma.user.findMany({
        where: {
            isActive: true,
            OR: [
                { restaurantId: rid },
                { staffAccess: { restaurantId: rid } },
            ],
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            designation: true,
            isActive: true,
            restaurantId: true,
        },
    }).catch(() => []);

    const activeCleaners = activeStaff.filter(isCleanerStaff);
    const activeStewards = activeStaff.filter(isStewardStaff);

    return {
        activeCleaners,
        activeStewards,
        hasCleaner: activeCleaners.length > 0,
        hasSteward: activeStewards.length > 0,
        cleanerCount: activeCleaners.length,
        stewardCount: activeStewards.length,
    };
};

export const hasActiveCleaner = async ({ prisma, restaurantId }) => {
    const res = await getActiveStaffByCapability({ prisma, restaurantId });
    return res.hasCleaner;
};

export const hasActiveSteward = async ({ prisma, restaurantId }) => {
    const res = await getActiveStaffByCapability({ prisma, restaurantId });
    return res.hasSteward;
};

/**
 * Authoritatively handles staff creation, deletion, deactivation, or role/designation edits.
 * Derives operational availability from actual staff configuration.
 * Safely handles orphaned assignments, updates table dirty states when no cleaner remains,
 * and emits realtime events to both staff and io rooms.
 */
export const handleStaffLifecycleChange = async ({
    prisma,
    restaurantId,
    staffId = null,
    previousStaff = null,
    updatedStaff = null,
    realtime = null,
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    if (!rid || !prisma) return null;

    const capabilities = await getActiveStaffByCapability({ prisma, restaurantId: rid });
    const { hasCleaner, hasSteward, cleanerCount, stewardCount } = capabilities;

    const io = realtime?.io || null;
    const staff = realtime?.staff || null;

    const nowTimestamp = Date.now();
    const nowIso = new Date(nowTimestamp).toISOString();

    // 1. Handle orphaned tasks assigned to this specific staff member if deleted or deactivated
    const sid = staffId ? Number(staffId) : null;
    const wasStaffDeactivatedOrDeleted =
        sid &&
        (updatedStaff === null ||
            updatedStaff?.isActive === false ||
            (previousStaff && !updatedStaff));

    if (sid && prisma.staffTask) {
        const pendingTasks = await prisma.staffTask.findMany({
            where: {
                restaurantId: rid,
                assignedTo: sid,
                isCompleted: false,
            },
            include: { table: true },
        }).catch(() => []);

        for (const task of pendingTasks) {
            const isCleaning = task.category === "CLEANING" || task.roleTarget === "CLEANER";
            const isSteward = task.roleTarget === "STEWARD" || task.category === "SERVICE";

            if (isCleaning) {
                if (hasCleaner) {
                    // Other active cleaners exist: return to unassigned pool
                    const reassigned = await prisma.staffTask.update({
                        where: { id: task.id },
                        data: { assignedTo: null, status: "PENDING" },
                        include: {
                            assignedUser: { select: { id: true, name: true, role: true, designation: true } },
                            table: { select: { id: true, tableNo: true, section: true, cleaningStatus: true } },
                        },
                    }).catch(() => null);

                    if (reassigned && staff) {
                        staff.to(`restaurant_${rid}`).emit("task:updated", { task: reassigned });
                        staff.to(`restaurant:${rid}`).emit("task:updated", { task: reassigned });
                    }
                } else {
                    // No cleaner remains in restaurant: auto-cancel task
                    await prisma.staffTask.update({
                        where: { id: task.id },
                        data: {
                            status: "CANCELLED",
                            isCompleted: true,
                            completedAt: new Date(),
                            description: task.description
                                ? `${task.description}\n[Auto-cancelled: No active cleaner available in restaurant]`
                                : "[Auto-cancelled: No active cleaner available in restaurant]",
                        },
                    }).catch(() => null);
                }
            } else if (isSteward) {
                if (hasSteward) {
                    // Other stewards exist: return to unassigned pool
                    const reassigned = await prisma.staffTask.update({
                        where: { id: task.id },
                        data: { assignedTo: null, status: "PENDING" },
                        include: {
                            assignedUser: { select: { id: true, name: true, role: true, designation: true } },
                            table: { select: { id: true, tableNo: true, section: true } },
                        },
                    }).catch(() => null);

                    if (reassigned && staff) {
                        staff.to(`restaurant_${rid}`).emit("task:updated", { task: reassigned });
                        staff.to(`restaurant:${rid}`).emit("task:updated", { task: reassigned });
                    }
                } else {
                    // No steward remains: auto-cancel task
                    await prisma.staffTask.update({
                        where: { id: task.id },
                        data: {
                            status: "CANCELLED",
                            isCompleted: true,
                            completedAt: new Date(),
                            description: task.description
                                ? `${task.description}\n[Auto-cancelled: No active steward available in restaurant]`
                                : "[Auto-cancelled: No active steward available in restaurant]",
                        },
                    }).catch(() => null);
                }
            }
        }
    }

    // 2. Global cleanup if NO cleaner remains in the restaurant:
    // Cancel ALL pending cleaning tasks and mark tables CLEAN/AVAILABLE so they are not permanently locked
    if (!hasCleaner && prisma.staffTask && prisma.diningTable) {
        const uncompletedCleaningTasks = await prisma.staffTask.findMany({
            where: {
                restaurantId: rid,
                category: "CLEANING",
                isCompleted: false,
            },
            select: { id: true, tableId: true, description: true },
        }).catch(() => []);

        if (uncompletedCleaningTasks.length > 0) {
            await prisma.staffTask.updateMany({
                where: {
                    id: { in: uncompletedCleaningTasks.map((t) => t.id) },
                },
                data: {
                    status: "CANCELLED",
                    isCompleted: true,
                    completedAt: new Date(),
                },
            }).catch(() => {});
        }

        // Release all DIRTY tables to CLEAN and AVAILABLE
        const dirtyTables = await prisma.diningTable.findMany({
            where: {
                restaurantId: rid,
                cleaningStatus: "DIRTY",
            },
        }).catch(() => []);

        if (dirtyTables.length > 0) {
            await prisma.diningTable.updateMany({
                where: {
                    restaurantId: rid,
                    cleaningStatus: "DIRTY",
                },
                data: {
                    cleaningStatus: "CLEAN",
                },
            }).catch(() => {});

            for (const t of dirtyTables) {
                const payload = {
                    type: "TABLE_UPDATED",
                    restaurantId: rid,
                    tableId: t.id,
                    id: t.id,
                    tableNo: t.tableNo,
                    status: "AVAILABLE",
                    cleaningStatus: "CLEAN",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    activeOrderStatus: null,
                    paymentStatus: null,
                    occupiedSince: null,
                    version: nowTimestamp,
                    updatedAt: nowIso,
                };
                if (io) {
                    io.to(`restaurant_${rid}`).emit("table:updated", payload);
                    io.to(`restaurant:${rid}`).emit("table:updated", payload);
                }
                if (staff) {
                    staff.to(`restaurant_${rid}`).emit("table:updated", payload);
                    staff.to(`restaurant:${rid}`).emit("table:updated", payload);
                }
            }

            if (io) {
                io.to(`restaurant_${rid}`).emit("table:layout_updated", { restaurantId: rid });
                io.to(`restaurant:${rid}`).emit("table:layout_updated", { restaurantId: rid });
            }
            if (staff) {
                staff.to(`restaurant_${rid}`).emit("table:layout_updated", { restaurantId: rid });
                staff.to(`restaurant:${rid}`).emit("table:layout_updated", { restaurantId: rid });
            }
        }
    }

    // 3. Global cleanup if NO steward remains in the restaurant:
    // Cancel all pending steward tasks
    if (!hasSteward && prisma.staffTask) {
        await prisma.staffTask.updateMany({
            where: {
                restaurantId: rid,
                roleTarget: "STEWARD",
                isCompleted: false,
            },
            data: {
                status: "CANCELLED",
                isCompleted: true,
                completedAt: new Date(),
            },
        }).catch(() => {});
    }

    // 4. Realtime capability broadcast to both staff and io sockets
    const capPayload = {
        restaurantId: rid,
        hasCleaner,
        hasSteward,
        cleanerCount,
        stewardCount,
        timestamp: nowIso,
    };

    if (io) {
        io.to(`restaurant_${rid}`).emit("capabilities:updated", capPayload);
        io.to(`restaurant:${rid}`).emit("capabilities:updated", capPayload);
        io.to(`restaurant_${rid}`).emit("staff:updated", { restaurantId: rid });
        io.to(`restaurant:${rid}`).emit("staff:updated", { restaurantId: rid });
    }

    if (staff) {
        staff.to(`restaurant_${rid}`).emit("capabilities:updated", capPayload);
        staff.to(`restaurant:${rid}`).emit("capabilities:updated", capPayload);
        staff.to(`restaurant_${rid}`).emit("staff:updated", { restaurantId: rid });
        staff.to(`restaurant:${rid}`).emit("staff:updated", { restaurantId: rid });
    }

    return capPayload;
};
