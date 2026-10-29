import { API } from "../../config";

/**
 * CONNECTIVITY DETECTION SERVICE
 * Combines browser `navigator.onLine` with lightweight API `/api/health` probes.
 * Emits real-time state change events for UI indicators and Sync Engine.
 * Resilient against transient blips: requires multiple consecutive probe failures
 * before declaring the API unreachable.
 */

const MAX_CONSECUTIVE_FAILURES = 2;

class ConnectivityService {
    constructor() {
        const initialOnline = typeof navigator !== "undefined" ? (navigator.onLine ?? true) : true;
        this.isOnline = initialOnline;
        this.isReachable = initialOnline;
        this.checked = false;
        this.lastSuccessfulCheck = Date.now();
        this.consecutiveFailures = 0;
        this.inFlightProbe = null;
        this.listeners = new Set();
        this.probeTimer = null;

        this.init();
    }

    init() {
        if (typeof window === "undefined") return;

        window.addEventListener("online", () => {
            this.isOnline = true;
            this.consecutiveFailures = 0;
            this.notify();
            this.checkApiReachable();
        });

        window.addEventListener("offline", () => {
            this.isOnline = false;
            this.isReachable = false;
            this.checked = true;
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
            const online = typeof navigator !== "undefined" ? (navigator.onLine ?? true) : true;
            if (online) {
                this.checkApiReachable();
            }
        }, intervalMs);
        if (this.probeTimer && typeof this.probeTimer.unref === "function") {
            this.probeTimer.unref();
        }
    }

    stopPeriodicProbe() {
        if (this.probeTimer) {
            clearInterval(this.probeTimer);
            this.probeTimer = null;
        }
    }

    async checkApiReachable() {
        if (this.inFlightProbe) {
            return this.inFlightProbe;
        }

        this.inFlightProbe = this._performCheckApiReachable();
        try {
            return await this.inFlightProbe;
        } finally {
            this.inFlightProbe = null;
        }
    }

    async _performCheckApiReachable() {
        const online = typeof navigator !== "undefined" ? (navigator.onLine ?? true) : true;
        if (!online) {
            this.isOnline = false;
            this.isReachable = false;
            this.checked = true;
            this.notify();
            return false;
        }

        const candidateUrls = [
            `${API}/health`,
            "/api/health",
            "/health",
        ].filter((url, idx, arr) => arr.indexOf(url) === idx);

        let reached = false;

        for (const url of candidateUrls) {
            let timeoutId = null;
            try {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 2000);
                if (timeoutId && typeof timeoutId.unref === "function") {
                    timeoutId.unref();
                }

                const res = await fetch(url, {
                    method: "GET",
                    signal: controller.signal,
                    headers: { "Cache-Control": "no-cache" },
                });

                // Any 2xx or 3xx response indicates the server is reached
                if (res.ok || (res.status >= 200 && res.status < 400)) {
                    reached = true;
                    break;
                }
            } catch {
                // Try next candidate URL
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        }

        this.checked = true;

        if (reached) {
            this.consecutiveFailures = 0;
            this.lastSuccessfulCheck = Date.now();
            this.updateState(true);
            return true;
        } else {
            this.consecutiveFailures += 1;
            // Only flip to unreachable if consecutive failures reach threshold
            if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                this.updateState(false);
            }
            return false;
        }
    }

    recordApiSuccess() {
        this.isOnline = true;
        this.isReachable = true;
        this.checked = true;
        this.consecutiveFailures = 0;
        this.lastSuccessfulCheck = Date.now();
        this.notify();
    }

    updateState(reachable) {
        const online = typeof navigator !== "undefined" ? (navigator.onLine ?? true) : true;
        const changed = this.isReachable !== reachable || this.isOnline !== online;
        this.isOnline = online;
        this.isReachable = reachable;
        if (changed) {
            this.notify();
        }
    }

    getState() {
        return {
            isOnline: this.isOnline,
            isApiReachable: this.isReachable,
            isReachable: this.isReachable,
            checked: this.checked,
            lastSuccessfulCheck: this.lastSuccessfulCheck,
        };
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }

    notify() {
        const state = this.getState();
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
