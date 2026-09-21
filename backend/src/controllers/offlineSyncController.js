import { prisma } from "../config/prisma.js";
import { processOfflineSyncBatch } from "../services/offlineSyncService.js";

const getActor = (req) => ({
    userId: req.user?.id || req.user?.userId || null,
    userName: req.user?.name || req.user?.userName || "Staff",
    role: req.user?.role || "WAITER",
    restaurantId: req.user?.restaurantId || null,
});

// 1. LIGHTWEIGHT API HEALTH PROBE
export async function getHealthController(req, reply) {
    return reply.send({
        status: "ok",
        online: true,
        timestamp: Date.now(),
        service: "Tiffzy POS API",
    });
}

// 2. OFFLINE SYNC BATCH PROCESSOR
export async function processSyncBatchController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
        const operations = req.body?.operations || req.body?.batch || [];

        if (!restaurantId) {
            return reply.code(400).send({ success: false, message: "restaurantId is required" });
        }

        const actor = getActor(req);
        const syncResult = await processOfflineSyncBatch({
            prisma,
            restaurantId,
            operations,
            actor,
        });

        // Trigger real-time refresh if socket emitter exists
        if (req.server?.realtime?.emitTableSessionUpdated) {
            // Send socket signal that offline sync batch completed
            req.server.realtime.emitTableSessionUpdated({ type: "OFFLINE_SYNC_COMPLETED", restaurantId });
        }

        return reply.send({
            success: true,
            message: `Processed ${syncResult.processedCount} operations`,
            syncResult,
        });
    } catch (err) {
        console.error("Error processing offline sync batch:", err);
        return reply.code(400).send({
            success: false,
            message: err.message || "Failed to process offline sync batch",
            code: err.code || "sync_failed",
        });
    }
}
