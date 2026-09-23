import { logAuditEvent } from "../services/auditLogService.js";
import { reprintKot } from "../services/kotService.js";

/**
 * Helper to verify manager/owner role or explicitly granted approval permissions
 */
const verifyManagerAuth = (user) => {
    const role = String(user?.role || "").toUpperCase();
    const isAuthorized = role === "OWNER" || role === "SUPER_ADMIN" || role === "MANAGER" || role === "KITCHEN_MANAGER";
    if (!isAuthorized) {
        const err = new Error("Manager approval authority required");
        err.statusCode = 403;
        throw err;
    }
    return true;
};

/**
 * Approve Order or Item Cancellation
 */
export const approveCancellation = async (req, res) => {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
        const { orderId, kotItemId, reason } = req.body;

        verifyManagerAuth(req.user);
        if (!restaurantId) return res.status(400).send({ message: "Restaurant ID required" });

        const actor = {
            userId: req.user.id,
            userName: req.user.name || req.user.email,
            role: req.user.role,
        };

        if (orderId) {
            const order = await req.prisma.order.update({
                where: { id: Number(orderId), restaurantId },
                data: { status: "CANCELLED" },
            });

            await logAuditEvent({
                prisma: req.prisma,
                restaurantId,
                actor,
                action: "ORDER_CANCELLED_APPROVED",
                entity: "Order",
                entityId: String(orderId),
                details: { reason: reason || "Manager approved order cancellation" },
            });

            return res.send({ ok: true, message: "Order cancellation approved", order });
        }

        if (kotItemId) {
            const item = await req.prisma.kitchenOrderTicketItem.update({
                where: { id: Number(kotItemId) },
                data: { status: "CANCELLED" },
            });

            await logAuditEvent({
                prisma: req.prisma,
                restaurantId,
                actor,
                action: "KOT_ITEM_CANCELLED_APPROVED",
                entity: "KitchenOrderTicketItem",
                entityId: String(kotItemId),
                details: { reason: reason || "Manager approved item cancellation" },
            });

            return res.send({ ok: true, message: "Item cancellation approved", item });
        }

        return res.status(400).send({ message: "orderId or kotItemId is required" });
    } catch (err) {
        return res.status(err?.statusCode || 500).send({ message: err?.message || "Failed to approve cancellation" });
    }
};

/**
 * Approve Manual Discount
 */
export const approveDiscount = async (req, res) => {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
        const { orderId, tableSessionId, discountAmount, discountReason } = req.body;

        verifyManagerAuth(req.user);
        if (!restaurantId || (!orderId && !tableSessionId)) {
            return res.status(400).send({ message: "Missing required parameters" });
        }

        const disc = Math.max(0, Number(discountAmount || 0));
        const actor = {
            userId: req.user.id,
            userName: req.user.name || req.user.email,
            role: req.user.role,
        };

        if (orderId) {
            const existingOrder = await req.prisma.order.findFirst({
                where: { id: Number(orderId), restaurantId },
            });
            if (!existingOrder) return res.status(404).send({ message: "Order not found" });

            const newTotal = Math.max(0, existingOrder.subtotal + existingOrder.taxAmount - disc);
            const updatedOrder = await req.prisma.order.update({
                where: { id: Number(orderId) },
                data: {
                    discountAmount: disc,
                    discountReason: discountReason ? String(discountReason) : "Manager Discount",
                    total: newTotal,
                },
            });

            await logAuditEvent({
                prisma: req.prisma,
                restaurantId,
                actor,
                action: "DISCOUNT_APPROVED",
                entity: "Order",
                entityId: String(orderId),
                details: { discountAmount: disc, discountReason },
            });

            return res.send({ ok: true, message: "Order discount approved", order: updatedOrder });
        }

        if (tableSessionId) {
            const session = await req.prisma.tableSession.findFirst({
                where: { id: Number(tableSessionId), restaurantId },
            });
            if (!session) return res.status(404).send({ message: "Table session not found" });

            const newTotal = Math.max(0, session.subtotal + session.taxAmount - disc);
            const updatedSession = await req.prisma.tableSession.update({
                where: { id: Number(tableSessionId) },
                data: {
                    discountAmount: disc,
                    total: newTotal,
                },
            });

            await logAuditEvent({
                prisma: req.prisma,
                restaurantId,
                actor,
                action: "DISCOUNT_APPROVED",
                entity: "TableSession",
                entityId: String(tableSessionId),
                details: { discountAmount: disc, discountReason },
            });

            return res.send({ ok: true, message: "Table session discount approved", session: updatedSession });
        }
    } catch (err) {
        return res.status(err?.statusCode || 500).send({ message: err?.message || "Failed to approve discount" });
    }
};

/**
 * Approve KOT Reprint
 */
export const approveReprint = async (req, res) => {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId || 0);
        const { kotId } = req.body;

        verifyManagerAuth(req.user);
        if (!restaurantId || !kotId) return res.status(400).send({ message: "kotId is required" });

        const actor = {
            userId: req.user.id,
            userName: req.user.name || req.user.email,
            role: req.user.role,
        };

        const result = await reprintKot({
            prisma: req.prisma,
            kotId: Number(kotId),
            restaurantId,
        });

        await logAuditEvent({
            prisma: req.prisma,
            restaurantId,
            actor,
            action: "REPRINT_APPROVED",
            entity: "KitchenOrderTicket",
            entityId: String(kotId),
            details: { printResult: result?.ok ? "SUCCESS" : result?.message },
        });

        return res.send({ ok: true, message: "KOT reprint approved", result });
    } catch (err) {
        return res.status(err?.statusCode || 500).send({ message: err?.message || "Failed to approve reprint" });
    }
};
