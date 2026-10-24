import React, { useState, useEffect } from "react";
import { X, ChefHat, Check, Clock, AlertTriangle, ArrowRight, CheckSquare, Square } from "lucide-react";

export default function KitchenAssignmentDrawer({
  isOpen = false,
  onClose,
  kot = null,
  chefs = [],
  onAssignItem,
  onBulkAssign,
  onAssignKot,
  onReassign,
  isSubmitting = false,
}) {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [selectedChefId, setSelectedChefId] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setSelectedItemIds([]);
    setActionError("");
    if (chefs.length > 0 && !selectedChefId) {
      setSelectedChefId(String(chefs[0].chefId));
    }
  }, [kot, isOpen]);

  if (!isOpen || !kot) return null;

  const items = Array.isArray(kot.items) ? kot.items : [];
  const unassignedItems = items.filter((it) => !it.assignedChefId && it.status !== "CANCELLED" && it.status !== "SERVED");
  const assignedItems = items.filter((it) => it.assignedChefId);

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllUnassigned = () => {
    setSelectedItemIds(unassignedItems.map((it) => it.id));
  };

  const handleAssignSelected = async () => {
    if (!selectedChefId) {
      setActionError("Please select a chef to assign to.");
      return;
    }
    if (!selectedItemIds.length) {
      setActionError("Please select at least one item.");
      return;
    }
    try {
      setActionError("");
      await onBulkAssign(selectedItemIds, Number(selectedChefId));
      setSelectedItemIds([]);
    } catch (err) {
      setActionError(err?.message || "Failed to assign items");
    }
  };

  const handleAssignAllUnassigned = async () => {
    if (!selectedChefId) {
      setActionError("Please select a chef to assign to.");
      return;
    }
    try {
      setActionError("");
      await onAssignKot(kot.id, Number(selectedChefId), false);
      setSelectedItemIds([]);
    } catch (err) {
      setActionError(err?.message || "Failed to assign KOT items");
    }
  };

  const handleSingleAssign = async (itemId, isReassign = false) => {
    if (!selectedChefId) {
      setActionError("Please select a chef to assign to.");
      return;
    }
    try {
      setActionError("");
      if (isReassign && onReassign) {
        await onReassign(itemId, Number(selectedChefId));
      } else {
        await onAssignItem(itemId, Number(selectedChefId));
      }
    } catch (err) {
      setActionError(err?.message || "Failed to update assignment");
    }
  };

  const orderTimeStr = kot.createdAt ? new Date(kot.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const elapsedMinutes = kot.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(kot.createdAt).getTime()) / 60000)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full max-w-full sm:max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-slate-800 animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Assign KOT #{kot.kotNo || kot.kotNumber || kot.id}
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                kot.priority === "URGENT" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                kot.priority === "HIGH" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}>
                {kot.priority || "NORMAL"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>Table: <strong>{kot.tableNo || "N/A"}</strong></span>
              <span>•</span>
              <span>Time: {orderTimeStr} ({elapsedMinutes}m ago)</span>
              <span>•</span>
              <span>Assigned: <strong>{assignedItems.length}/{items.length}</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Error banner */}
        {actionError && (
          <div className="mx-4 mt-3 p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Chef Selection Panel */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <ChefHat size={14} className="text-orange-500" />
            Select Target Chef:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chefs.map((c) => {
              const isSelected = String(selectedChefId) === String(c.chefId);
              return (
                <div
                  key={c.chefId}
                  onClick={() => setSelectedChefId(String(c.chefId))}
                  className={`cursor-pointer p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/10 text-orange-950 dark:text-orange-100 font-bold ring-1 ring-orange-500"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                >
                  <div className="truncate">
                    <div className="truncate">{c.chefName}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      Active: {c.assigned || 0} (Prep: {c.preparing || 0})
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-orange-500 shrink-0 ml-1" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              KOT Items ({items.length})
            </span>
            {unassignedItems.length > 0 && (
              <button
                type="button"
                onClick={selectAllUnassigned}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-semibold flex items-center gap-1"
              >
                Select all unassigned ({unassignedItems.length})
              </button>
            )}
          </div>

          {items.map((item) => {
            const isAssigned = Boolean(item.assignedChefId);
            const isSelected = selectedItemIds.includes(item.id);
            const isPreparingOrReady = item.status === "PREPARING" || item.status === "READY";

            return (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition ${
                  isSelected
                    ? "border-orange-500 bg-orange-500/5 dark:bg-orange-950/20"
                    : isAssigned
                    ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                    : "border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectItem(item.id)}
                      className="mt-0.5 text-slate-400 hover:text-orange-500 transition"
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-orange-500" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span>{item.quantity}x {item.name}</span>
                        {item.variant && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                            {item.variant}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                          Note: {item.notes}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className={`px-1.5 py-0.2 rounded font-semibold ${
                          item.status === "READY" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          item.status === "PREPARING" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {item.status}
                        </span>

                        {isAssigned ? (
                          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            Assigned to: <strong className="text-slate-900 dark:text-slate-100">{item.assignedChefName || `Chef #${item.assignedChefId}`}</strong>
                            <span className="text-[9px] text-slate-400">({item.assignmentSource || "DISPATCHED"})</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            UNASSIGNED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isAssigned ? (
                      <button
                        type="button"
                        onClick={() => handleSingleAssign(item.id, true)}
                        disabled={isSubmitting}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded transition"
                      >
                        Reassign
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSingleAssign(item.id, false)}
                        disabled={isSubmitting}
                        className="text-[11px] font-semibold bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded shadow-xs transition"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleAssignSelected}
              disabled={isSubmitting || selectedItemIds.length === 0}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Check size={14} />
              Assign Selected ({selectedItemIds.length})
            </button>

            {unassignedItems.length > 0 && (
              <button
                type="button"
                onClick={handleAssignAllUnassigned}
                disabled={isSubmitting}
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold py-2.5 px-3 rounded-lg shadow-sm transition min-h-[44px]"
              >
                Assign All Unassigned ({unassignedItems.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
