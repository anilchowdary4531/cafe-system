import { addOrderToTableSession, getOrCreateActiveSession } from "./tableSessionService.js";
import { recordSessionPayment } from "./splitBillingService.js";

/**
 * OFFLINE SYNC BATCH SERVICE
 * Processes queued offline operations transactionally and idempotently.
 */
export const processOfflineSyncBatch = async ({
    prisma,
    restaurantId,
    operations = [],
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    if (!rid) {
        const err = new Error("restaurantId is required for offline sync batch");
        err.code = "invalid_input";
        throw err;
    }

    if (!Array.isArray(operations) || operations.length === 0) {
        return { success: true, processedCount: 0, results: [] };
    }

    const results = [];

    for (const op of operations) {
        const { operationId, type, clientOperationId, payload = {} } = op;
        const opKey = clientOperationId || operationId;

        if (!opKey) {
            results.push({
                operationId: operationId || "UNKNOWN",
                status: "FAILED",
                error: "Missing clientOperationId or operationId",
            });
            continue;
        }

        try {
            let opResult = null;

            if (type === "CREATE_TABLE_SESSION") {
                opResult = await syncCreateTableSession({ prisma, restaurantId: rid, opKey, payload, actor });
            } else if (type === "ADD_ITEMS_TO_SESSION") {
                opResult = await syncAddItemsToSession({ prisma, restaurantId: rid, opKey, payload, actor });
            } else if (type === "RECORD_CASH_PAYMENT") {
                opResult = await syncRecordCashPayment({ prisma, restaurantId: rid, opKey, payload, actor });
            } else if (type === "CREATE_KOT") {
                opResult = await syncCreateKot({ prisma, restaurantId: rid, opKey, payload, actor });
            } else {
                opResult = {
                    operationId: opKey,
                    status: "FAILED",
                    error: `Unsupported offline operation type: '${type}'`,
                };
            }

            results.push(opResult);
        } catch (err) {
            console.error(`[OfflineSync] Error processing operation '${type}' (${opKey}):`, err);
            results.push({
                operationId: opKey,
                type,
                status: "FAILED",
                error: err.message || "Failed to process offline operation",
                errorCode: err.code || "sync_operation_error",
            });
        }
    }

    return {
        success: true,
        processedCount: results.length,
        results,
    };
};

/**
 * 1. SYNC CREATE TABLE SESSION
 */
async function syncCreateTableSession({ prisma, restaurantId, opKey, payload, actor }) {
    const tableId = Number(payload.tableId);
    if (!tableId) {
        throw new Error("tableId is required for CREATE_TABLE_SESSION");
    }

    // Idempotency check: see if session with this clientOperationId exists
    const existingSession = await prisma.tableSession.findUnique({
        where: { clientOperationId: String(opKey) },
    });
    if (existingSession) {
        return {
            operationId: opKey,
            type: "CREATE_TABLE_SESSION",
            status: "SYNCED",
            serverEntityId: existingSession.id,
            session: existingSession,
            idempotentRetried: true,
        };
    }

    // Check if table already has an active session created by another device
    const activeSession = await prisma.tableSession.findFirst({
        where: { tableId, restaurantId, status: { in: ["OPEN", "BILLING"] } },
    });

    if (activeSession) {
        return {
            operationId: opKey,
            type: "CREATE_TABLE_SESSION",
            status: "CONFLICT",
            conflictType: "TABLE_SESSION_ALREADY_ACTIVE",
            message: `Table ${activeSession.tableNo} was already opened by another device while offline.`,
            serverEntityId: activeSession.id,
            serverSession: activeSession,
        };
    }

    // Create session
    const newSession = await prisma.tableSession.create({
        data: {
            restaurantId,
            tableId,
            tableNo: String(payload.tableNo || tableId),
            guestCount: Number(payload.guestCount || 1),
            waiterId: actor?.userId || null,
            waiterName: actor?.userName || payload.waiterName || null,
            status: "OPEN",
            clientOperationId: String(opKey),
        },
    });

    return {
        operationId: opKey,
        type: "CREATE_TABLE_SESSION",
        status: "SYNCED",
        serverEntityId: newSession.id,
        session: newSession,
    };
}

/**
 * 2. SYNC ADD ITEMS TO SESSION
 */
async function syncAddItemsToSession({ prisma, restaurantId, opKey, payload, actor }) {
    const tableId = Number(payload.tableId);
    const sessionIdInput = payload.tableSessionId ? Number(payload.tableSessionId) : null;
    const items = payload.items || [];

    if ((!tableId && !sessionIdInput) || !items.length) {
        throw new Error("tableId/tableSessionId and non-empty items array are required");
    }

    // Idempotency check: see if order with this clientOperationId exists
    const existingOrder = await prisma.order.findUnique({
        where: { clientOperationId: String(opKey) },
        include: { items: true },
    });
    if (existingOrder) {
        return {
            operationId: opKey,
            type: "ADD_ITEMS_TO_SESSION",
            status: "SYNCED",
            serverEntityId: existingOrder.id,
            serverOrderNo: existingOrder.orderNo,
            order: existingOrder,
            idempotentRetried: true,
        };
    }

    // Target session ID
    let targetTableId = tableId;
    if (!targetTableId && sessionIdInput) {
        const targetSession = await prisma.tableSession.findUnique({ where: { id: sessionIdInput } });
        if (targetSession) targetTableId = targetSession.tableId;
    }

    const result = await addOrderToTableSession({
        prisma,
        actor: { restaurantId, userId: actor?.userId, role: actor?.role || "STAFF" },
        tableId: targetTableId,
        restaurantId,
        items,
        notes: payload.notes || null,
        customerName: payload.customerName || null,
        phone: payload.phone || null,
        guestCount: payload.guestCount || 1,
    });

    // Attach clientOperationId to created order
    const updatedOrder = await prisma.order.update({
        where: { id: result.order.id },
        data: { clientOperationId: String(opKey) },
        include: { items: true },
    });

    return {
        operationId: opKey,
        type: "ADD_ITEMS_TO_SESSION",
        status: "SYNCED",
        serverEntityId: updatedOrder.id,
        serverOrderNo: updatedOrder.orderNo,
        order: updatedOrder,
        session: result.session,
    };
}

/**
 * 3. SYNC RECORD CASH PAYMENT
 */
async function syncRecordCashPayment({ prisma, restaurantId, opKey, payload, actor }) {
    const tableSessionId = Number(payload.tableSessionId);
    const amount = Number(payload.amount || 0);

    if (!tableSessionId || amount <= 0) {
        throw new Error("tableSessionId and positive payment amount are required for cash payment");
    }

    const payResult = await recordSessionPayment({
        prisma,
        restaurantId,
        tableSessionId,
        paymentMode: "CASH",
        amount,
        amountReceived: payload.amountReceived ? Number(payload.amountReceived) : amount,
        idempotencyKey: String(opKey),
        actor,
    });

    return {
        operationId: opKey,
        type: "RECORD_CASH_PAYMENT",
        status: "SYNCED",
        serverEntityId: payResult.payment.id,
        payment: payResult.payment,
        session: payResult.session,
    };
}

/**
 * 4. SYNC CREATE KOT
 */
async function syncCreateKot({ prisma, restaurantId, opKey, payload, actor }) {
    const orderId = Number(payload.orderId);
    if (!orderId) {
        throw new Error("orderId is required for CREATE_KOT");
    }

    // Idempotency check
    const existingKot = await prisma.kitchenOrderTicket.findUnique({
        where: { clientOperationId: String(opKey) },
        include: { items: true },
    });
    if (existingKot) {
        return {
            operationId: opKey,
            type: "CREATE_KOT",
            status: "SYNCED",
            serverEntityId: existingKot.id,
            kotNo: existingKot.kotNo,
            kot: existingKot,
            idempotentRetried: true,
        };
    }

    // Fetch Order to get table session ID & items
    const order = await prisma.order.findUnique({
        where: { id: orderId, restaurantId },
        include: { items: true },
    });
    if (!order) {
        throw new Error(`Order #${orderId} not found for KOT creation`);
    }

    // Generate KOT sequence
    const lastKot = await prisma.kitchenOrderTicket.findFirst({
        where: { restaurantId },
        orderBy: { sequenceNumber: "desc" },
    });
    const seq = (lastKot?.sequenceNumber || 0) + 1;
    const kotNo = `KOT-${String(seq).padStart(4, "0")}`;

    const newKot = await prisma.kitchenOrderTicket.create({
        data: {
            restaurantId,
            tableSessionId: order.tableSessionId,
            orderId: order.id,
            kotNo,
            sequenceNumber: seq,
            tableNo: order.tableNo || "N/A",
            waiterName: actor?.userName || "Staff",
            status: "PENDING",
            type: "NEW",
            clientOperationId: String(opKey),
            idempotencyKey: String(opKey),
            items: {
                create: (payload.items || order.items || []).map((item) => ({
                    itemName: item.itemName,
                    qty: Number(item.qty || item.quantity || 1),
                    notes: item.notes || null,
                    status: "PENDING",
                })),
            },
        },
        include: { items: true },
    });

    return {
        operationId: opKey,
        type: "CREATE_KOT",
        status: "SYNCED",
        serverEntityId: newKot.id,
        kotNo: newKot.kotNo,
        kot: newKot,
    };
}
