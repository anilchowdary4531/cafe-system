import { API } from "../../config";

/**
 * CONNECTIVITY DETECTION SERVICE
 * Combines browser `navigator.onLine` with lightweight API `/api/health` probes.
 * Emits real-time state change events for UI indicators and Sync Engine.
 */

class ConnectivityService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isReachable = navigator.onLine;
        this.listeners = new Set();
        this.probeTimer = null;

        this.init();
    }

    init() {
        if (typeof window === "undefined") return;

        window.addEventListener("online", () => {
            this.isOnline = true;
            this.checkApiReachable();
        });

        window.addEventListener("offline", () => {
            this.isOnline = false;
            this.isReachable = false;
            this.notify();
        });

        // Initial check
        this.checkApiReachable();
        // Periodic probe every 15 seconds
        this.startPeriodicProbe(15000);
    }

    startPeriodicProbe(intervalMs = 15000) {
        if (this.probeTimer) clearInterval(this.probeTimer);
        this.probeTimer = setInterval(() => {
            if (navigator.onLine) {
                this.checkApiReachable();
            }
        }, intervalMs);
    }

    async checkApiReachable() {
        if (!navigator.onLine) {
            this.updateState(false);
            return false;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(`${API}/health`, {
                method: "GET",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                this.updateState(true);
                return true;
            } else {
                this.updateState(false);
                return false;
            }
        } catch {
            this.updateState(false);
            return false;
        }
    }

    updateState(reachable) {
        const changed = this.isReachable !== reachable;
        this.isOnline = navigator.onLine;
        this.isReachable = reachable;
        if (changed) {
            this.notify();
        }
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener({ isOnline: this.isOnline, isReachable: this.isReachable });
        return () => this.listeners.delete(listener);
    }

    notify() {
        const state = { isOnline: this.isOnline, isReachable: this.isReachable };
        this.listeners.forEach((listener) => {
            try {
                listener(state);
            } catch {
                // ignore
            }
        });
    }
}

export const connectivityService = new ConnectivityService();
