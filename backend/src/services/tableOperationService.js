import { recalculateSessionTotals, getOrCreateActiveSession } from "./tableSessionService.js";

const ACTIVE_STATUSES = ["OPEN", "BILLING"];

const emitTableOperationEvent = ({ realtime, restaurantId, event, data, session }) => {
    if (!realtime) return;
    try {
        if (typeof realtime.emitTableSessionUpdated === "function" && session) {
            realtime.emitTableSessionUpdated(session);
        }
        if (realtime.io) {
            const room = `restaurant:${Number(restaurantId || 0)}`;
            realtime.io.to(room).emit(event, data);
            realtime.io.to(`restaurant_${Number(restaurantId || 0)}`).emit(event, data);
        }
    } catch (e) {
        console.log("Realtime table operation emit error:", e?.message);
    }
};

/**
 * 1. MOVE TABLE SESSION
 * Relocates an active session from sourceTableId to targetTableId.
 */
export const moveTableSession = async ({
    prisma,
    restaurantId,
    sourceTableId,
    targetTableId,
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const srcTid = Number(sourceTableId);
    const tgtTid = Number(targetTableId);

    if (!rid || !srcTid || !tgtTid) {
        const err = new Error("restaurantId, sourceTableId, and targetTableId are required");
        err.code = "invalid_input";
        throw err;
    }

    if (srcTid === tgtTid) {
        const err = new Error("Source and target table cannot be the same");
        err.code = "same_table_invalid";
        throw err;
    }

    // 1. Fetch Source Table Session
    const sourceSession = await prisma.tableSession.findFirst({
        where: {
            tableId: srcTid,
            restaurantId: rid,
            status: { in: ACTIVE_STATUSES },
        },
        include: { orders: { include: { items: true } }, table: true },
    });

    if (!sourceSession) {
        const err = new Error("No active session found on source table");
        err.code = "source_session_not_found";
        throw err;
    }

    if (sourceSession.status === "PAID" || sourceSession.status === "CLOSED") {
        const err = new Error("Cannot move a paid or closed session");
        err.code = "session_closed_or_paid";
        throw err;
    }

    // 2. Fetch Target Table
    const targetTable = await prisma.diningTable.findUnique({
        where: { id: tgtTid },
    });

    if (!targetTable || Number(targetTable.restaurantId) !== rid) {
        const err = new Error("Target table not found or restaurant mismatch");
        err.code = "target_table_not_found";
        throw err;
    }

    // 3. Check if Target Table is already occupied
    const activeTargetSession = await prisma.tableSession.findFirst({
        where: {
            tableId: tgtTid,
            restaurantId: rid,
            status: { in: ACTIVE_STATUSES },
        },
    });

    if (activeTargetSession) {
        const err = new Error(`Table ${targetTable.tableNo} is already occupied.`);
        err.code = "target_table_occupied";
        err.targetSessionId = activeTargetSession.id;
        throw err;
    }

    const sourceTableNo = sourceSession.tableNo || sourceSession.table?.tableNo;
    const targetTableNo = targetTable.tableNo;

    // 4. Perform Move inside Transaction
    const updatedSession = await prisma.$transaction(async (tx) => {
        // Move TableSession to target table
        const movedSession = await tx.tableSession.update({
            where: { id: sourceSession.id },
            data: {
                tableId: tgtTid,
                tableNo: targetTableNo,
            },
            include: {
                orders: { include: { items: true } },
                table: true,
            },
        });

        // Update active orders linked to this session
        await tx.order.updateMany({
            where: {
                tableSessionId: sourceSession.id,
                status: { not: "CANCELLED" },
            },
            data: {
                tableNo: targetTableNo,
            },
        });

        // Audit Log
        await tx.tableOperationLog.create({
            data: {
                restaurantId: rid,
                operationType: "MOVE_TABLE",
                sourceSessionId: sourceSession.id,
                targetSessionId: sourceSession.id,
                sourceTableId: srcTid,
                sourceTableNo,
                targetTableId: tgtTid,
                targetTableNo,
                performedByUserId: actor?.userId || null,
                performedByName: actor?.userName || null,
                performedByUserRole: actor?.role || null,
                details: {
                    openedAt: sourceSession.openedAt,
                    guestCount: sourceSession.guestCount,
                    total: sourceSession.total,
                },
            },
        });

        return movedSession;
    });

    // 5. Emit Realtime Events
    emitTableOperationEvent({
        realtime: actor?.realtime,
        restaurantId: rid,
        event: "table:updated",
        session: updatedSession,
        data: {
            restaurantId: rid,
            tables: [
                { tableId: srcTid, isOccupied: false },
                { tableId: tgtTid, isOccupied: true, session: updatedSession },
            ],
        },
    });

    return updatedSession;
};

/**
 * 2. MERGE TABLES
 * Merges secondary session into primary session.
 */
export const mergeTableSessions = async ({
    prisma,
    restaurantId,
    primaryTableId,
    secondaryTableId,
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const primTid = Number(primaryTableId);
    const secTid = Number(secondaryTableId);

    if (!rid || !primTid || !secTid) {
        const err = new Error("restaurantId, primaryTableId, and secondaryTableId are required");
        err.code = "invalid_input";
        throw err;
    }

    if (primTid === secTid) {
        const err = new Error("Cannot merge a table into itself");
        err.code = "same_table_merge_invalid";
        throw err;
    }

    // 1. Fetch Primary & Secondary Active Sessions
    const primarySession = await prisma.tableSession.findFirst({
        where: {
            tableId: primTid,
            restaurantId: rid,
            status: { in: ACTIVE_STATUSES },
        },
        include: { orders: { include: { items: true } }, table: true },
    });

    const secondarySession = await prisma.tableSession.findFirst({
        where: {
            tableId: secTid,
            restaurantId: rid,
            status: { in: ACTIVE_STATUSES },
        },
        include: { orders: { include: { items: true } }, table: true },
    });

    if (!primarySession || !secondarySession) {
        const err = new Error("Active session not found on both tables");
        err.code = "session_not_found";
        throw err;
    }

    const primTableNo = primarySession.tableNo;
    const secTableNo = secondarySession.tableNo;

    // 2. Perform Merge inside Transaction
    const mergedResult = await prisma.$transaction(async (tx) => {
        // Transfer all active orders from secondary session to primary session
        await tx.order.updateMany({
            where: {
                tableSessionId: secondarySession.id,
                status: { not: "CANCELLED" },
            },
            data: {
                tableSessionId: primarySession.id,
                tableNo: primTableNo,
            },
        });

        // Mark secondary session as MERGED
        await tx.tableSession.update({
            where: { id: secondarySession.id },
            data: {
                status: "MERGED",
                mergedIntoSessionId: primarySession.id,
                closedAt: new Date(),
            },
        });

        // Combine guest counts on primary session
        await tx.tableSession.update({
            where: { id: primarySession.id },
            data: {
                guestCount: primarySession.guestCount + secondarySession.guestCount,
            },
        });

        // Audit Log
        await tx.tableOperationLog.create({
            data: {
                restaurantId: rid,
                operationType: "MERGE_TABLE",
                sourceSessionId: secondarySession.id,
                targetSessionId: primarySession.id,
                sourceTableId: secTid,
                sourceTableNo: secTableNo,
                targetTableId: primTid,
                targetTableNo: primTableNo,
                performedByUserId: actor?.userId || null,
                performedByName: actor?.userName || null,
                performedByUserRole: actor?.role || null,
                details: {
                    primaryPreviousTotal: primarySession.total,
                    secondaryPreviousTotal: secondarySession.total,
                },
            },
        });

        return primarySession.id;
    });

    // 3. Recalculate Totals for Primary Session
    const updatedPrimarySession = await recalculateSessionTotals({ prisma, sessionId: mergedResult });

    // 4. Emit Realtime Socket Events
    emitTableOperationEvent({
        realtime: actor?.realtime,
        restaurantId: rid,
        event: "table:updated",
        session: updatedPrimarySession,
        data: {
            restaurantId: rid,
            tables: [
                { tableId: secTid, isOccupied: false },
                { tableId: primTid, isOccupied: true, session: updatedPrimarySession },
            ],
        },
    });

    return updatedPrimarySession;
};

/**
 * 3. TRANSFER ITEMS / SPLIT TABLE
 * Transfers specific OrderItems or partial quantities from source table to target table.
 */
export const transferItemsBetweenTables = async ({
    prisma,
    restaurantId,
    sourceTableId,
    targetTableId,
    itemsToTransfer = [], // Array of { orderItemId, qtyToTransfer }
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const srcTid = Number(sourceTableId);
    const tgtTid = Number(targetTableId);

    if (!rid || !srcTid || !tgtTid || !Array.isArray(itemsToTransfer) || !itemsToTransfer.length) {
        const err = new Error("restaurantId, sourceTableId, targetTableId, and itemsToTransfer are required");
        err.code = "invalid_input";
        throw err;
    }

    if (srcTid === tgtTid) {
        const err = new Error("Source and target tables cannot be the same");
        err.code = "same_table_transfer_invalid";
        throw err;
    }

    // 1. Fetch Source Session
    const sourceSession = await prisma.tableSession.findFirst({
        where: {
            tableId: srcTid,
            restaurantId: rid,
            status: { in: ACTIVE_STATUSES },
        },
        include: { orders: { include: { items: true } }, table: true },
    });

    if (!sourceSession) {
        const err = new Error("No active session found on source table");
        err.code = "source_session_not_found";
        throw err;
    }

    // 2. Fetch or Create Target Session
    const targetSession = await getOrCreateActiveSession({
        prisma,
        restaurantId: rid,
        tableId: tgtTid,
        waiterId: actor?.userId || sourceSession.waiterId,
        waiterName: actor?.userName || sourceSession.waiterName,
        guestCount: 1,
    });

    // 3. Process Item Transfers inside Transaction
    await prisma.$transaction(async (tx) => {
        // Ensure Target Session has an active order to attach transferred items to
        let targetOrder = await tx.order.findFirst({
            where: {
                tableSessionId: targetSession.id,
                status: { not: "CANCELLED" },
            },
            orderBy: { createdAt: "desc" },
        });

        if (!targetOrder) {
            targetOrder = await tx.order.create({
                data: {
                    restaurantId: rid,
                    tableNo: targetSession.tableNo,
                    tableSessionId: targetSession.id,
                    orderNo: `ORD-${Date.now().toString().slice(-6)}`,
                    subtotal: 0,
                    total: 0,
                    status: "PLACED",
                    fulfillment: "DINE_IN",
                    createdByUserId: actor?.userId || null,
                    createdByRole: actor?.role || "WAITER",
                },
            });
        }

        for (const reqItem of itemsToTransfer) {
            const orderItemId = Number(reqItem.orderItemId || reqItem.id);
            const qtyToTransfer = Number(reqItem.qtyToTransfer || reqItem.quantity || reqItem.qty || 1);

            const sourceOrderItem = await tx.orderItem.findUnique({
                where: { id: orderItemId },
            });

            if (!sourceOrderItem || qtyToTransfer <= 0) continue;

            if (qtyToTransfer >= sourceOrderItem.qty) {
                // Transfer entire line item
                await tx.orderItem.update({
                    where: { id: orderItemId },
                    data: {
                        orderId: targetOrder.id,
                    },
                });
            } else {
                // Partial Transfer: Decrement source item & create new item on target order
                const remainingQty = sourceOrderItem.qty - qtyToTransfer;
                const unitPrice = Number(sourceOrderItem.price || 0);

                // Update Source Item Qty
                await tx.orderItem.update({
                    where: { id: orderItemId },
                    data: {
                        qty: remainingQty,
                        total: remainingQty * unitPrice,
                    },
                });

                // Create Target Item with exact snapshot
                await tx.orderItem.create({
                    data: {
                        orderId: targetOrder.id,
                        menuItemId: sourceOrderItem.menuItemId,
                        itemName: sourceOrderItem.itemName,
                        preparedByName: sourceOrderItem.preparedByName,
                        variantId: sourceOrderItem.variantId,
                        variantName: sourceOrderItem.variantName,
                        variantPrice: sourceOrderItem.variantPrice,
                        selectedModifiers: sourceOrderItem.selectedModifiers,
                        notes: sourceOrderItem.notes,
                        qty: qtyToTransfer,
                        price: unitPrice,
                        total: qtyToTransfer * unitPrice,
                    },
                });
            }
        }

        // Audit Log
        await tx.tableOperationLog.create({
            data: {
                restaurantId: rid,
                operationType: "ITEM_TRANSFER",
                sourceSessionId: sourceSession.id,
                targetSessionId: targetSession.id,
                sourceTableId: srcTid,
                sourceTableNo: sourceSession.tableNo,
                targetTableId: tgtTid,
                targetTableNo: targetSession.tableNo,
                performedByUserId: actor?.userId || null,
                performedByName: actor?.userName || null,
                performedByUserRole: actor?.role || null,
                details: { itemsTransferred: itemsToTransfer },
            },
        });
    });

    // 4. Recalculate totals for both sessions
    const updatedSource = await recalculateSessionTotals({ prisma, sessionId: sourceSession.id });
    const updatedTarget = await recalculateSessionTotals({ prisma, sessionId: targetSession.id });

    // 5. Emit Realtime Events
    emitTableOperationEvent({
        realtime: actor?.realtime,
        restaurantId: rid,
        event: "table:updated",
        session: updatedSource,
        data: {
            restaurantId: rid,
            tables: [
                { tableId: srcTid, isOccupied: true, session: updatedSource },
                { tableId: tgtTid, isOccupied: true, session: updatedTarget },
            ],
        },
    });

    return {
        sourceSession: updatedSource,
        targetSession: updatedTarget,
    };
};
