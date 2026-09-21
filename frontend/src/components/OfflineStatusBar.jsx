import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { connectivityService } from "../utils/offline/connectivityService";
import { offlineSyncEngine } from "../utils/offline/offlineSyncEngine";
import { getPendingOfflineOperations } from "../utils/offline/offlineDb";

export default function OfflineStatusBar() {
    const [connState, setConnState] = useState({
        isOnline: navigator.onLine,
        isReachable: navigator.onLine,
    });
    const [syncState, setSyncState] = useState({
        isSyncing: false,
        lastSyncTime: null,
        conflictPayload: null,
    });
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const unsubConn = connectivityService.subscribe(setConnState);
        const unsubSync = offlineSyncEngine.subscribe(setSyncState);

        const checkPending = async () => {
            const ops = await getPendingOfflineOperations();
            setPendingCount(ops.length);
        };

        checkPending();
        const interval = setInterval(checkPending, 3000);

        return () => {
            unsubConn();
            unsubSync();
            clearInterval(interval);
        };
    }, []);

    const isOffline = !connState.isReachable;
    const isSyncing = syncState.isSyncing;
    const hasConflict = !!syncState.conflictPayload;

    if (!isOffline && !isSyncing && !hasConflict && pendingCount === 0) {
        // All normal online, small subtle indicator
        return (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
            </div>
        );
    }

    return (
        <div className="w-full text-xs font-bold transition-all">
            {hasConflict && (
                <div className="flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-700 px-4 py-2 text-white shadow-md">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 animate-bounce text-amber-300" />
                        <span>SYNC CONFLICT DETECTED: A table session was modified on another device.</span>
                    </div>
                    <button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent("offline:open-conflict-modal"));
                        }}
                        className="rounded-lg bg-white px-3 py-1 text-xs font-extrabold text-red-700 hover:bg-gray-100 shadow"
                    >
                        Resolve Conflict
                    </button>
                </div>
            )}

            {isSyncing && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-white shadow-md">
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-200" />
                    <span>Synchronizing {pendingCount} offline operation{pendingCount > 1 ? "s" : ""} to server...</span>
                </div>
            )}

            {isOffline && !isSyncing && (
                <div className="flex items-center justify-between bg-gradient-to-r from-rose-700 to-pink-700 px-4 py-2 text-white shadow-md">
                    <div className="flex items-center gap-2">
                        <WifiOff className="h-4 w-4 text-rose-200 animate-pulse" />
                        <span>OFFLINE MODE — Orders saved locally on this device ({pendingCount} pending sync)</span>
                    </div>
                    <button
                        onClick={() => connectivityService.checkApiReachable()}
                        className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] text-white hover:bg-white/30"
                    >
                        Check Connection
                    </button>
                </div>
            )}
        </div>
    );
}
