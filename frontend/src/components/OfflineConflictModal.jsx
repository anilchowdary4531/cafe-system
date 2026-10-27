import { useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw, X } from "lucide-react";
import { offlineSyncEngine } from "../utils/offline/offlineSyncEngine";

export default function OfflineConflictModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [conflict, setConflict] = useState(null);

    useEffect(() => {
        const unsub = offlineSyncEngine.subscribe((state) => {
            if (state.conflictPayload) {
                setConflict(state.conflictPayload);
            }
        });

        const handleOpen = () => setIsOpen(true);
        window.addEventListener("offline:open-conflict-modal", handleOpen);

        return () => {
            unsub();
            window.removeEventListener("offline:open-conflict-modal", handleOpen);
        };
    }, []);

    useEffect(() => {
        if (conflict) {
            setIsOpen(true);
        }
    }, [conflict]);

    if (!isOpen || !conflict) return null;

    const handleDismiss = () => {
        offlineSyncEngine.clearConflict();
        setIsOpen(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[#0f172a] p-6 shadow-2xl text-white space-y-4">
                <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                    <div className="flex items-center gap-2.5 text-red-400">
                        <AlertTriangle className="h-6 w-6" />
                        <h3 className="text-lg font-bold">Offline Sync Conflict</h3>
                    </div>
                    <button onClick={handleDismiss} className="text-gray-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 space-y-2 text-xs">
                    <p className="font-semibold text-red-200">{conflict.message}</p>
                    {conflict.serverSession && (
                        <div className="rounded-xl bg-black/40 p-3 space-y-1 text-[11px] text-gray-300">
                            <div>Table: <strong className="text-white">{conflict.serverSession.tableNo}</strong></div>
                            <div>Server Session Status: <strong className="text-emerald-400">{conflict.serverSession.status}</strong></div>
                            <div>Server Total: <strong className="text-amber-300">₹{conflict.serverSession.total}</strong></div>
                        </div>
                    )}
                </div>

                <p className="text-xs text-gray-400">
                    To maintain financial accuracy, the server session was preserved. You can review active tables or create a separate order if needed.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={handleDismiss}
                        className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:from-red-500 hover:to-rose-500"
                    >
                        Acknowledge & Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
