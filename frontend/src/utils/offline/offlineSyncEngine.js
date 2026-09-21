import axios from "axios";
import { API } from "../../config";
import { invalidateGetCache } from "../apiClient";
import { getActiveStaffSession } from "../staffSessionStorage";
import { connectivityService } from "./connectivityService";
import {
    getPendingOfflineOperations,
    setServerIdMapping,
    updateOfflineOperationStatus,
} from "./offlineDb";

/**
 * OFFLINE SYNC ENGINE
 * Automatically synchronizes queued offline POS operations when API reachability is restored.
 */
class OfflineSyncEngine {
    constructor() {
        this.isSyncing = false;
        this.listeners = new Set();
        this.lastSyncTime = null;
        this.conflictPayload = null;

        this.init();
    }

    init() {
        connectivityService.subscribe(({ isReachable }) => {
            if (isReachable && !this.isSyncing) {
                this.triggerSync();
            }
        });
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener({
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            conflictPayload: this.conflictPayload,
        });
        return () => this.listeners.delete(listener);
    }

    notify() {
        const state = {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            conflictPayload: this.conflictPayload,
        };
        this.listeners.forEach((fn) => {
            try {
                fn(state);
            } catch {
                // ignore
            }
        });
    }

    clearConflict() {
        this.conflictPayload = null;
        this.notify();
    }

    async triggerSync() {
        if (this.isSyncing || !connectivityService.isReachable) return;

        const pendingOps = await getPendingOfflineOperations();
        if (!pendingOps.length) return;

        try {
            this.isSyncing = true;
            this.notify();

            const staffSession = getActiveStaffSession();
            const restaurantId = staffSession?.restaurantId || 1;
            const token = staffSession?.token || null;

            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            // Mark operations as SYNCING
            for (const op of pendingOps) {
                await updateOfflineOperationStatus(op.operationId, { status: "SYNCING" });
            }

            const res = await axios.post(
                `${API}/owner/${restaurantId}/sync/batch`,
                { operations: pendingOps },
                { headers, timeout: 20000 }
            );

            if (res.data?.success && res.data?.syncResult?.results) {
                const results = res.data.syncResult.results;

                for (const result of results) {
                    const { operationId, status, serverEntityId, conflictType, serverSession, error } = result;

                    if (status === "SYNCED") {
                        await updateOfflineOperationStatus(operationId, {
                            status: "SYNCED",
                            serverEntityId,
                            syncedAt: Date.now(),
                        });

                        if (serverEntityId) {
                            await setServerIdMapping(operationId, serverEntityId);
                        }
                    } else if (status === "CONFLICT") {
                        await updateOfflineOperationStatus(operationId, {
                            status: "CONFLICT",
                            conflictType,
                            error: result.message,
                        });
                        this.conflictPayload = {
                            operationId,
                            conflictType,
                            serverSession,
                            message: result.message,
                        };
                    } else {
                        await updateOfflineOperationStatus(operationId, {
                            status: "FAILED",
                            error: error || "Sync failed",
                        });
                    }
                }

                this.lastSyncTime = Date.now();
                invalidateGetCache();
            }
        } catch (err) {
            console.error("OfflineSyncEngine error:", err);
            // Revert SYNCING back to FAILED for retry
            for (const op of pendingOps) {
                await updateOfflineOperationStatus(op.operationId, {
                    status: "FAILED",
                    error: err.message || "Network error during sync",
                });
            }
        } finally {
            this.isSyncing = false;
            this.notify();
        }
    }
}

export const offlineSyncEngine = new OfflineSyncEngine();
