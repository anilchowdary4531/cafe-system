import { useState } from "react";
import { AlertTriangle, Lock, Unlock, X } from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function TableBlockModal({
    isOpen,
    onClose,
    table = null,
    restaurantId,
    onSuccess,
}) {
    if (!isOpen || !table) return null;

    const isCurrentlyBlocked = Boolean(table.isBlocked);
    const [reasonOption, setReasonOption] = useState("Maintenance / Cleaning");
    const [customReason, setCustomReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleToggleBlock = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const rid = restaurantId || 1;
            const finalReason = reasonOption === "Custom" ? customReason.trim() : reasonOption;

            let res;
            if (isCurrentlyBlocked) {
                res = await axios.post(`${API}/owner/${rid}/tables/${table.id}/unblock`);
            } else {
                res = await axios.post(`${API}/owner/${rid}/tables/${table.id}/block`, {
                    blockReason: finalReason || "Maintenance",
                });
            }

            if (res.data?.success) {
                showToast({
                    title: isCurrentlyBlocked ? "Table Unblocked" : "Table Blocked",
                    message: res.data.message || `Table ${table.tableNo} state updated.`,
                    variant: isCurrentlyBlocked ? "success" : "warning",
                });
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to update table block state.";
            showToast({ title: "Operation Failed", message: errMsg, variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className={`rounded-xl p-2 border ${
                            isCurrentlyBlocked
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        }`}>
                            {isCurrentlyBlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </div>
                        <div>
                            <h3 className="text-base font-bold tracking-tight">
                                {isCurrentlyBlocked ? `Unblock Table ${table.tableNo}` : `Block Table ${table.tableNo}`}
                            </h3>
                            <p className="text-[11px] theme-muted">
                                {isCurrentlyBlocked ? "Make table available for seating & reservations" : "Mark table out of service or reserved for private event"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleToggleBlock} className="p-5 space-y-4 text-xs">
                    {!isCurrentlyBlocked ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-[11px]">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>Blocking Table {table.tableNo} prevents orders, waitlist seating, and reservations from using this table.</span>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Select Block Reason *</label>
                                <select
                                    value={reasonOption}
                                    onChange={(e) => setReasonOption(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs outline-none"
                                >
                                    <option value="Maintenance / Cleaning">Maintenance / Cleaning</option>
                                    <option value="Private Booking / Event">Private Booking / Event</option>
                                    <option value="VIP Reserved">VIP Reserved</option>
                                    <option value="Staff Reserved">Staff Reserved</option>
                                    <option value="Damaged Furniture">Damaged Furniture</option>
                                    <option value="Custom">Other (Specify Below)</option>
                                </select>
                            </div>

                            {reasonOption === "Custom" && (
                                <div>
                                    <label className="block text-xs font-medium mb-1">Custom Reason Details</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Broken chair, deep cleaning"
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        required
                                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 space-y-1 text-slate-300">
                                <p><strong>Currently Blocked:</strong> {table.blockReason || "Maintenance"}</p>
                                {table.blockedByName && <p className="text-[11px] theme-muted">Blocked by: {table.blockedByName}</p>}
                            </div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                Click "Unblock Table" to restore Table {table.tableNo} to available status.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold theme-muted hover:bg-slate-100 dark:hover:bg-slate-800">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 ${
                                isCurrentlyBlocked
                                    ? "bg-emerald-600 hover:bg-emerald-500"
                                    : "bg-slate-700 hover:bg-slate-600"
                            }`}
                        >
                            {isCurrentlyBlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            {isCurrentlyBlocked ? "Unblock Table" : "Confirm Block Table"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
