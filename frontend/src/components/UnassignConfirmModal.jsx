import React, { useState } from "react";
import { X, AlertTriangle, ChefHat, Tag, ArrowRight } from "lucide-react";

export default function UnassignConfirmModal({
  isOpen = false,
  onClose,
  item = null,
  kot = null,
  onConfirm,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !item) return null;

  const canonicalItemId = item.orderItemId || item.id;
  const itemName = `${item.qty || item.quantity || 1}× ${item.itemName || item.name}`;
  const currentChefName = item.assignedChefName || (item.assignedChefId ? `Chef #${item.assignedChefId}` : "Assigned Chef");
  const kotLabel = kot?.kotNo
    ? (String(kot.kotNo).startsWith("KOT-") ? kot.kotNo : `KOT-${kot.kotNo}`)
    : "KOT Item";

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm(canonicalItemId, item);
      onClose();
    } catch (err) {
      console.error("Failed to unassign chef:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to unassign chef. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unassign-modal-title"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 id="unassign-modal-title" className="text-sm font-bold text-slate-900">
                Unassign Chef
              </h3>
              <p className="text-[11px] text-slate-500">
                Confirm returning item to unassigned work queue
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                <Tag size={15} className="text-orange-500" />
                <span>{itemName}</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                {kotLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 text-slate-600">
              <span className="text-slate-400">Current Assignee:</span>
              <div className="flex items-center gap-1 font-semibold text-slate-800">
                <ChefHat size={14} className="text-orange-600" />
                <span>{currentChefName}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              OrderItem ID: #{canonicalItemId}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-3 text-amber-900 space-y-1">
            <p className="font-semibold text-amber-950 flex items-center gap-1.5">
              <span>Return to Work Queue</span>
              <ArrowRight size={13} />
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Unassigning will remove this item from <strong>{currentChefName}</strong>'s active station. The item will return to the <strong>UNASSIGNED WORK QUEUE</strong> and become available for manual dispatch or self-pick.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3.5 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-unassign-btn"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
          >
            {loading ? "Unassigning..." : "Confirm Unassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
