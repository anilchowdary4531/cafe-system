import {
    getHealthController,
    processSyncBatchController,
} from "../controllers/offlineSyncController.js";

export default async function offlineSyncRoutes(fastify) {
    // Health probe
    fastify.get("/health", getHealthController);
    fastify.get("/api/health", getHealthController);

    // Batch sync
    fastify.post("/sync/batch", processSyncBatchController);
    fastify.post("/owner/:restaurantId/sync/batch", processSyncBatchController);
    fastify.post("/api/owner/:restaurantId/sync/batch", processSyncBatchController);
}
