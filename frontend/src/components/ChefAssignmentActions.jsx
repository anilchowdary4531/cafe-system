import React, { useState, useEffect, useRef } from "react";
import { ChefHat, MoreVertical, UserCheck, UserX, Info } from "lucide-react";

/**
 * ChefAssignmentActions component
 * Clean item-level assignment action controller:
 * - If unassigned (assignedChefId == null): displays UNASSIGNED badge and [Assign] button.
 * - If assigned (assignedChefId != null): displays assigned chef badge and [ ⋮ ] three-dot overflow button.
 * - Three-dot menu provides: Reassign to another Chef, View Assignment Details, Unassign Chef.
 */
export default function ChefAssignmentActions({
  item,
  kot,
  onOpenAssignDrawer,
  onOpenReassignModal,
  onOpenDetailsModal,
  onOpenUnassignModal,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const isAssigned = Boolean(item?.assignedChefId);
  const itemId = item?.id;
  const canonicalId = item?.orderItemId || item?.id;

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  if (!item) return null;

  if (isAssigned) {
    return (
      <div className="flex items-center gap-1.5" ref={menuRef}>
        {/* Preserved Assigned Chef Badge */}
        <span
          data-testid={`chef-badge-${itemId}`}
          data-order-item-id={canonicalId}
          data-chef-id={item.assignedChefId}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 flex items-center gap-1 border border-slate-200"
          title={`Assigned to ${item.assignedChefName || "Chef"}`}
        >
          <ChefHat size={11} className="text-orange-500 shrink-0" />
          <span className="truncate max-w-[130px]">
            {item.assignedChefName || `Chef #${item.assignedChefId}`}
          </span>
          <span className="text-[9px] text-slate-400">
            ({item.assignmentSource === "SELF_PICKED" ? "SELF" : "DISP"})
          </span>
        </span>

        {/* Three-Dot Overflow Action Button */}
        <div className="relative">
          <button
            type="button"
            data-testid={`three-dot-menu-btn-${itemId}`}
            data-order-item-id={canonicalId}
            aria-label={`Actions for ${item.itemName || item.name}`}
            aria-haspopup="true"
            aria-expanded={isOpen}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            title="More actions"
          >
            <MoreVertical size={14} />
          </button>

          {/* Overflow Menu */}
          {isOpen && (
            <div
              data-testid={`three-dot-menu-${itemId}`}
              className="absolute right-0 top-full mt-1 z-40 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Reassign to another Chef */}
              <button
                type="button"
                data-testid={`menu-action-reassign-${itemId}`}
                onClick={() => {
                  setIsOpen(false);
                  onOpenReassignModal && onOpenReassignModal(item, kot);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition cursor-pointer"
              >
                <UserCheck size={14} className="text-orange-500 shrink-0" />
                <span>Reassign to another Chef</span>
              </button>

              {/* 2. View Assignment Details */}
              <button
                type="button"
                data-testid={`menu-action-details-${itemId}`}
                onClick={() => {
                  setIsOpen(false);
                  onOpenDetailsModal && onOpenDetailsModal(item, kot);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Info size={14} className="text-blue-500 shrink-0" />
                <span>View Assignment Details</span>
              </button>

              {/* 3. Unassign Chef */}
              <button
                type="button"
                data-testid={`menu-action-unassign-${itemId}`}
                onClick={() => {
                  setIsOpen(false);
                  onOpenUnassignModal && onOpenUnassignModal(item, kot);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer border-t border-slate-100 mt-0.5 pt-1.5"
              >
                <UserX size={14} className="text-red-500 shrink-0" />
                <span>Unassign Chef</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Unassigned State: Display UNASSIGNED badge + [Assign] button
  return (
    <div className="flex items-center gap-1.5">
      <span
        data-testid={`unassigned-badge-${itemId}`}
        data-order-item-id={canonicalId}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
      >
        UNASSIGNED
      </span>
      <button
        type="button"
        data-testid={`assign-item-btn-${itemId}`}
        data-order-item-id={canonicalId}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onOpenAssignDrawer && onOpenAssignDrawer(kot, itemId);
        }}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-0.5 rounded transition border border-orange-200 cursor-pointer disabled:opacity-50"
      >
        <ChefHat size={11} className="shrink-0" />
        Assign
      </button>
    </div>
  );
}
