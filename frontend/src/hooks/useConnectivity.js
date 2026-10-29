import { useEffect, useState } from "react";
import { connectivityService } from "../utils/offline/connectivityService";
import { useStaffSocket } from "../context/StaffSocketContext";

/**
 * CENTRAL CONNECTIVITY HOOK
 * Distinctly identifies and reconciles three distinct layers:
 * 1. Browser network status (`navigator.onLine`, window online/offline events)
 * 2. Backend API reachability (health probes and HTTP interaction telemetry)
 * 3. Realtime Socket.IO transport connection
 *
 * Rules:
 * - NEVER flashes "Offline" on initial mount or during normal startup.
 * - NEVER treats a reconnecting Socket.IO transport as browser/device offline.
 * - Retries reachability checks before declaring the API unreachable.
 */
export function useConnectivity() {
    const [connState, setConnState] = useState(() => connectivityService.getState());
    
    let socketCtx = null;
    try {
        socketCtx = typeof useStaffSocket === "function" ? useStaffSocket() : null;
    } catch {
        socketCtx = null;
    }

    const isSocketConnected = Boolean(socketCtx?.connected || socketCtx?.isConnected);

    useEffect(() => {
        const unsubscribe = connectivityService.subscribe(setConnState);
        return () => unsubscribe();
    }, []);

    const isOnline = Boolean(connState.isOnline);
    const isApiReachable = Boolean(connState.isApiReachable);
    const checked = Boolean(connState.checked);
    const lastSuccessfulCheck = connState.lastSuccessfulCheck;

    // Actual Offline state: browser has no network, or connectivity checks completed and confirmed API is unreachable.
    const isOffline = !isOnline || (checked && !isApiReachable);

    // Live state: network is up, API is reachable, and realtime socket is connected.
    const isLive = !isOffline && isSocketConnected;

    // Reconnecting state: network is up and API is reachable, but realtime socket is connecting/reconnecting.
    const isReconnecting = !isOffline && !isSocketConnected;

    const status = isOffline ? "offline" : isLive ? "live" : "reconnecting";

    return {
        isOnline,
        isApiReachable,
        isSocketConnected,
        isOffline,
        isLive,
        isReconnecting,
        status,
        checked,
        lastSuccessfulCheck,
        checkConnectivity: () => connectivityService.checkApiReachable(),
    };
}

export default useConnectivity;

