import {
    getHealthController,
    processSyncBatchController,
} from "../controllers/offlineSyncController.js";

export default async function offlineSyncRoutes(fastify) {
    // Offline Health probe
    fastify.get("/api/offline/health", getHealthController);

    // Batch sync
    fastify.post("/sync/batch", processSyncBatchController);
    fastify.post("/owner/:restaurantId/sync/batch", processSyncBatchController);
    fastify.post("/api/owner/:restaurantId/sync/batch", processSyncBatchController);
}
