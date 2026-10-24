import React, { useState, useEffect } from "react";
import { X, ChefHat, Check, UserCheck, AlertCircle, Loader2 } from "lucide-react";

export default function ReassignChefModal({
  isOpen = false,
  onClose,
  item = null,
  kot = null,
  chefs = [],
  onReassign,
  isSubmitting = false,
}) {
  const [selectedChefId, setSelectedChefId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setErrorMsg("");
    if (item && chefs.length > 0) {
      // Find a chef other than current if available
      const otherChef = chefs.find((c) => Number(c.chefId) !== Number(item.assignedChefId));
      if (otherChef) {
        setSelectedChefId(String(otherChef.chefId));
      } else {
        setSelectedChefId(String(chefs[0].chefId));
      }
    }
  }, [item, chefs, isOpen]);

  if (!isOpen || !item) return null;

  const currentChefId = Number(item.assignedChefId);
  const canonicalItemId = item.orderItemId || item.id;
  const isSameChef = Number(selectedChefId) === currentChefId;

  const handleConfirm = async () => {
    if (!selectedChefId) {
      setErrorMsg("Please select a target chef.");
      return;
    }
    if (isSameChef) {
      setErrorMsg("Please choose a different chef than the currently assigned one.");
      return;
    }
    try {
      setErrorMsg("");
      await onReassign(canonicalItemId, Number(selectedChefId));
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Failed to reassign chef");
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
        aria-labelledby="reassign-modal-title"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 id="reassign-modal-title" className="text-sm font-bold text-slate-900">
                Reassign to another Chef
              </h3>
              <p className="text-[11px] text-slate-500">
                Transfer preparation responsibility to an active chef
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
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Target Item Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span className="text-sm">{item.qty || item.quantity || 1}× {item.itemName || item.name}</span>
              <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-mono">
                Item #{canonicalItemId}
              </span>
            </div>
            <div className="text-slate-500 flex items-center gap-2 flex-wrap text-[11px]">
              <span>KOT #{kot?.kotNo}</span>
              <span>•</span>
              <span>Table: {kot?.tableNo || "Takeaway"}</span>
              <span>•</span>
              <span className="text-orange-600 font-semibold">
                Current: {item.assignedChefName || (currentChefId ? `Chef #${currentChefId}` : "Unassigned")}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Available Active Chefs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select New Chef:
            </label>
            <div className="space-y-1.5">
              {chefs.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  No active chefs found
                </div>
              ) : (
                chefs.map((c) => {
                  const isCurrent = Number(c.chefId) === currentChefId;
                  const isSelected = String(selectedChefId) === String(c.chefId);
                  const assignedCount = Number(c.assigned || 0);
                  const prepCount = Number(c.preparing || 0);
                  const capacity = Number(c.capacity || 10);
                  const loadPercent = Math.min(100, Math.round((assignedCount / Math.max(1, capacity)) * 100));

                  return (
                    <div
                      key={c.chefId}
                      data-testid={`chef-option-${c.chefId}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => !isCurrent && setSelectedChefId(String(c.chefId))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!isCurrent) setSelectedChefId(String(c.chefId));
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs transition flex items-center justify-between cursor-pointer ${
                        isCurrent
                          ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "border-orange-500 bg-orange-50/60 font-bold ring-1 ring-orange-500"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ChefHat size={13} className={isSelected ? "text-orange-500" : "text-slate-400"} />
                          <span className="font-bold text-slate-900">{c.chefName || c.name || `Chef #${c.chefId}`}</span>
                          {c.designation && (
                            <span className="text-[10px] text-slate-400">({c.designation})</span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded font-semibold">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>Active: <strong>{assignedCount}</strong></span>
                          <span>•</span>
                          <span>Prep: <strong>{prepCount}</strong></span>
                          <span>•</span>
                          <span className={loadPercent >= 80 ? "text-red-600 font-semibold" : "text-slate-500"}>
                            Load: {loadPercent}%
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected && !isCurrent && (
                          <div className="h-5 w-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-3.5 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-reassign-btn"
            disabled={isSubmitting || !selectedChefId || isSameChef}
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Reassigning...</span>
              </>
            ) : (
              <span>Confirm Reassignment</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
