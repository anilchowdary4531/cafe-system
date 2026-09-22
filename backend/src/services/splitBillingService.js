import { recalculateSessionTotals } from "./tableSessionService.js";
import { computeBill } from "./billingService.js";

/**
 * 1. CREATE OR UPDATE BILL SPLITS
 * Handles Item Split, Quantity Split, Equal Split, and Custom Amount Split.
 */
export const createOrUpdateBillSplits = async ({
    prisma,
    restaurantId,
    tableSessionId,
    splitType = "ITEM", // ITEM | QUANTITY | EQUAL | CUSTOM
    splitsInput = [],
    splitCount = 2,
    customAmounts = [],
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const sid = Number(tableSessionId);

    if (!rid || !sid) {
        const err = new Error("restaurantId and tableSessionId are required");
        err.code = "invalid_input";
        throw err;
    }

    // 1. Fetch Session with active orders and items
    const session = await prisma.tableSession.findFirst({
        where: { id: sid, restaurantId: rid },
        include: {
            orders: {
                where: { status: { not: "CANCELLED" } },
                include: { items: true },
            },
            restaurant: true,
        },
    });

    if (!session) {
        const err = new Error("Active table session not found");
        err.code = "session_not_found";
        throw err;
    }

    if (session.status === "CLOSED") {
        const err = new Error("Cannot split a closed session");
        err.code = "session_closed";
        throw err;
    }

    // 2. Extract all order items
    const allSessionItems = session.orders.flatMap((o) => o.items || []);
    if (!allSessionItems.length) {
        const err = new Error("No active order items found in session to split");
        err.code = "no_items_in_session";
        throw err;
    }

    const sessionTotal = session.total || 0;
    const sessionTax = session.taxAmount || 0;
    const sessionService = session.serviceChargeAmount || 0;
    const sessionDiscount = session.discountAmount || 0;
    const sessionSubtotal = session.subtotal || 0;

    let computedSplits = [];

    // MODE A & B: SPLIT BY ITEM / QUANTITY
    if (splitType === "ITEM" || splitType === "QUANTITY") {
        if (!Array.isArray(splitsInput) || !splitsInput.length) {
            const err = new Error("splitsInput array is required for ITEM/QUANTITY split");
            err.code = "invalid_split_input";
            throw err;
        }

        // Validate allocation quantity bounds
        const itemAllocatedMap = {};
        for (const s of splitsInput) {
            for (const itemReq of s.items || []) {
                const oiId = Number(itemReq.orderItemId || itemReq.id);
                const reqQty = Number(itemReq.qty || itemReq.quantity || 1);
                itemAllocatedMap[oiId] = (itemAllocatedMap[oiId] || 0) + reqQty;

                const origItem = allSessionItems.find((i) => i.id === oiId);
                if (!origItem) {
                    const err = new Error(`Order item ID ${oiId} not found in session`);
                    err.code = "item_not_found";
                    throw err;
                }

                if (itemAllocatedMap[oiId] > origItem.qty) {
                    const err = new Error(`Allocated quantity for '${origItem.itemName}' exceeds ordered quantity (${origItem.qty})`);
                    err.code = "qty_exceeded";
                    throw err;
                }
            }
        }

        // Build splits with proportional tax, service charge, and discount
        let splitIndex = 1;
        for (const sInput of splitsInput) {
            const splitItems = [];
            let splitSubtotal = 0;

            for (const itemReq of sInput.items || []) {
                const oiId = Number(itemReq.orderItemId || itemReq.id);
                const reqQty = Number(itemReq.qty || itemReq.quantity || 1);
                const origItem = allSessionItems.find((i) => i.id === oiId);

                if (origItem && reqQty > 0) {
                    const unitPrice = Number(origItem.price || 0);
                    const itemTotal = unitPrice * reqQty;
                    splitSubtotal += itemTotal;
                    splitItems.push({
                        orderItemId: oiId,
                        qty: reqQty,
                        price: unitPrice,
                        total: itemTotal,
                    });
                }
            }

            const ratio = sessionSubtotal > 0 ? splitSubtotal / sessionSubtotal : 0;
            const splitTax = Math.round(sessionTax * ratio * 100) / 100;
            const splitService = Math.round(sessionService * ratio * 100) / 100;
            const splitDiscount = Math.round(sessionDiscount * ratio * 100) / 100;
            const splitGrandTotal = Math.max(0, splitSubtotal + splitTax + splitService - splitDiscount);

            computedSplits.push({
                splitNo: splitIndex++,
                label: sInput.label || `Split #${splitIndex - 1}`,
                splitType,
                subtotal: splitSubtotal,
                taxAmount: splitTax,
                serviceChargeAmount: splitService,
                discountAmount: splitDiscount,
                total: splitGrandTotal,
                paidAmount: 0,
                pendingAmount: splitGrandTotal,
                items: splitItems,
            });
        }
    }
    // MODE C: EQUAL SPLIT
    else if (splitType === "EQUAL") {
        const count = Math.max(2, Number(splitCount || 2));
        const equalSubtotal = Math.round((sessionSubtotal / count) * 100) / 100;
        const equalTax = Math.round((sessionTax / count) * 100) / 100;
        const equalService = Math.round((sessionService / count) * 100) / 100;
        const equalDiscount = Math.round((sessionDiscount / count) * 100) / 100;
        const equalTotal = Math.round((sessionTotal / count) * 100) / 100;

        for (let i = 1; i <= count; i++) {
            computedSplits.push({
                splitNo: i,
                label: `Customer #${i}`,
                splitType: "EQUAL",
                subtotal: equalSubtotal,
                taxAmount: equalTax,
                serviceChargeAmount: equalService,
                discountAmount: equalDiscount,
                total: equalTotal,
                paidAmount: 0,
                pendingAmount: equalTotal,
                items: [],
            });
        }
    }
    // MODE D: CUSTOM AMOUNT SPLIT
    else if (splitType === "CUSTOM") {
        const amounts = Array.isArray(customAmounts) ? customAmounts.map(Number).filter((n) => n > 0) : [];
        const sumCustom = amounts.reduce((a, b) => a + b, 0);

        if (Math.abs(sumCustom - sessionTotal) > 0.01) {
            const err = new Error(`Sum of custom split amounts (₹${sumCustom}) must equal total session bill (₹${sessionTotal})`);
            err.code = "custom_sum_mismatch";
            throw err;
        }

        amounts.forEach((amt, idx) => {
            computedSplits.push({
                splitNo: idx + 1,
                label: `Split #${idx + 1} (₹${amt})`,
                splitType: "CUSTOM",
                subtotal: amt,
                taxAmount: 0,
                serviceChargeAmount: 0,
                discountAmount: 0,
                total: amt,
                paidAmount: 0,
                pendingAmount: amt,
                items: [],
            });
        });
    }

    // 3. Persist Splits inside Transaction
    return await prisma.$transaction(async (tx) => {
        // Delete existing unpaid bill splits for this session
        await tx.billSplit.deleteMany({
            where: {
                tableSessionId: sid,
                status: "UNPAID",
                paidAmount: 0,
            },
        });

        const createdSplits = [];
        for (const sData of computedSplits) {
            const split = await tx.billSplit.create({
                data: {
                    restaurantId: rid,
                    tableSessionId: sid,
                    splitNo: sData.splitNo,
                    label: sData.label,
                    splitType: sData.splitType,
                    subtotal: sData.subtotal,
                    taxAmount: sData.taxAmount,
                    serviceChargeAmount: sData.serviceChargeAmount,
                    discountAmount: sData.discountAmount,
                    total: sData.total,
                    paidAmount: 0,
                    pendingAmount: sData.total,
                    status: "UNPAID",
                    items: {
                        create: sData.items.map((i) => ({
                            orderItemId: i.orderItemId,
                            qty: i.qty,
                            price: i.price,
                            total: i.total,
                        })),
                    },
                },
                include: { items: { include: { orderItem: true } } },
            });
            createdSplits.push(split);
        }

        // Audit Log
        await tx.tableOperationLog.create({
            data: {
                restaurantId: rid,
                operationType: "SPLIT_BILL_CREATED",
                sourceSessionId: sid,
                performedByUserId: actor?.userId || null,
                performedByName: actor?.userName || null,
                performedByUserRole: actor?.role || null,
                details: { splitType, count: createdSplits.length },
            },
        });

        return createdSplits;
    });
};

/**
 * 2. RECORD SINGLE / MULTI / PARTIAL PAYMENT
 * Handles Cash (with change), UPI, Card, and Cashfree payments.
 * Enforces server-side financial verification, idempotency, and session lifecycle.
 */
export const recordSessionPayment = async ({
    prisma,
    restaurantId,
    tableSessionId,
    billSplitId = null,
    paymentMode = "CASH", // CASH | UPI | CARD | CASHFREE
    amount = 0,
    amountReceived = null,
    transactionId = null,
    idempotencyKey = null,
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const sid = Number(tableSessionId);
    const splitId = billSplitId ? Number(billSplitId) : null;
    const payAmount = Number(amount || 0);

    if (!rid || !sid || payAmount <= 0) {
        const err = new Error("restaurantId, tableSessionId, and positive payment amount are required");
        err.code = "invalid_input";
        throw err;
    }

    // 1. Check Idempotency Key
    if (idempotencyKey) {
        const existingPayment = await prisma.payment.findUnique({
            where: { idempotencyKey: String(idempotencyKey) },
        });
        if (existingPayment) {
            return {
                payment: existingPayment,
                idempotentRetried: true,
            };
        }
    }

    // 2. Fetch Session
    const session = await prisma.tableSession.findFirst({
        where: { id: sid, restaurantId: rid },
        include: { payments: true, billSplits: true },
    });

    if (!session) {
        const err = new Error("Table session not found");
        err.code = "session_not_found";
        throw err;
    }

    if (session.status === "CLOSED" || session.status === "PAID") {
        const err = new Error("Table session has already been closed or paid");
        err.code = "session_already_paid";
        throw err;
    }

    // Determine target split or full session bill balance
    let targetSplit = null;
    if (splitId) {
        targetSplit = await prisma.billSplit.findUnique({
            where: { id: splitId },
        });
        if (!targetSplit || targetSplit.tableSessionId !== sid) {
            const err = new Error("Specified bill split not found on this session");
            err.code = "split_not_found";
            throw err;
        }
    }

    const currentPaidSum = (session.payments || [])
        .filter((p) => p.status === "SUCCESS")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const remainingSessionBalance = Math.max(0, session.total - currentPaidSum);

    // Overpayment Protection
    if (payAmount > remainingSessionBalance + 0.01) {
        const err = new Error(`Payment amount (₹${payAmount}) exceeds remaining session balance (₹${remainingSessionBalance.toFixed(2)})`);
        err.code = "overpayment_rejected";
        throw err;
    }

    // Cash Change Calculation
    let rcvd = amountReceived !== null && amountReceived !== undefined ? Number(amountReceived) : payAmount;
    if (paymentMode === "CASH" && rcvd < payAmount) {
        const err = new Error(`Cash received (₹${rcvd}) is less than payment amount (₹${payAmount})`);
        err.code = "insufficient_cash";
        throw err;
    }

    const changeAmount = paymentMode === "CASH" ? Math.max(0, rcvd - payAmount) : 0;

    // 3. Execute Transaction
    return await prisma.$transaction(async (tx) => {
        // Find active cashier shift for restaurant
        const activeShift = await tx.cashierShift.findFirst({
            where: { restaurantId: rid, status: "OPEN" },
            orderBy: { openedAt: "desc" },
        });

        // Create Payment record
        const newPayment = await tx.payment.create({
            data: {
                restaurantId: rid,
                tableSessionId: sid,
                orderId: session.orders?.[0]?.id || null,
                billSplitId: splitId,
                shiftId: activeShift ? activeShift.id : null,
                amount: payAmount,
                amountDue: payAmount,
                amountReceived: rcvd,
                changeAmount,
                currency: "INR",
                paymentMethod: paymentMode,
                method: paymentMode,
                status: "SUCCESS",
                transactionId: transactionId || `TXN-${Date.now()}`,
                idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
                performedByName: actor?.userName || "Staff",
            },
        });

        // If Cash payment & active shift exists, record CashMovement
        if (paymentMode === "CASH" && activeShift) {
            await tx.cashMovement.create({
                data: {
                    shiftId: activeShift.id,
                    restaurantId: rid,
                    type: "CASH_SALE",
                    amount: payAmount,
                    reason: `Cash Payment for Session #${sid}`,
                    paymentId: newPayment.id,
                    performedByUserId: actor?.userId || activeShift.userId,
                    performedByName: actor?.userName || "Staff",
                },
            });

            // Update expected cash on shift
            const movements = await tx.cashMovement.findMany({
                where: { shiftId: activeShift.id },
                select: { type: true, amount: true },
            });

            let exp = 0;
            for (const m of movements) {
                if (["OPENING_CASH", "CASH_SALE", "CASH_IN"].includes(m.type)) exp += Number(m.amount || 0);
                else if (["CASH_REFUND", "CASH_OUT"].includes(m.type)) exp -= Number(m.amount || 0);
            }

            await tx.cashierShift.update({
                where: { id: activeShift.id },
                data: { expectedCash: Math.max(0, exp) },
            });
        }

        // Update target BillSplit status if applicable
        if (targetSplit) {
            const updatedSplitPaid = targetSplit.paidAmount + payAmount;
            const updatedSplitPending = Math.max(0, targetSplit.total - updatedSplitPaid);
            const splitStatus = updatedSplitPending <= 0.01 ? "PAID" : "PARTIALLY_PAID";

            await tx.billSplit.update({
                where: { id: targetSplit.id },
                data: {
                    paidAmount: updatedSplitPaid,
                    pendingAmount: updatedSplitPending,
                    status: splitStatus,
                },
            });
        }

        // Recalculate total session payments
        const allSuccessPayments = await tx.payment.findMany({
            where: { tableSessionId: sid, status: "SUCCESS" },
        });

        const totalPaidSoFar = allSuccessPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const newRemaining = Math.max(0, session.total - totalPaidSoFar);

        // SESSION LIFECYCLE: Close session ONLY when totalPaid >= session.total
        let sessionStatus = "BILLING";
        let closedAt = null;
        let paidAt = session.paidAt || null;

        if (newRemaining <= 0.01) {
            sessionStatus = "PAID";
            paidAt = new Date();
            closedAt = new Date();
        }

        const updatedSession = await tx.tableSession.update({
            where: { id: sid },
            data: {
                status: sessionStatus,
                paidAt,
                closedAt,
            },
            include: {
                orders: { include: { items: true } },
                payments: true,
                billSplits: { include: { items: true } },
            },
        });

        // Audit Log
        await tx.tableOperationLog.create({
            data: {
                restaurantId: rid,
                operationType: "PAYMENT_RECORDED",
                sourceSessionId: sid,
                performedByUserId: actor?.userId || null,
                performedByName: actor?.userName || null,
                performedByUserRole: actor?.role || null,
                details: {
                    paymentId: newPayment.id,
                    paymentMode,
                    amount: payAmount,
                    totalPaidSoFar,
                    sessionStatus,
                },
            },
        });

        return {
            payment: newPayment,
            session: updatedSession,
            totalPaidSoFar,
            remainingBalance: newRemaining,
            isFullyPaid: sessionStatus === "PAID",
        };
    });
};
