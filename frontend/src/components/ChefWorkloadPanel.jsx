import React, { useState } from "react";
import { ChefHat, Flame, Clock, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function ChefWorkloadPanel({
  chefs = [],
  selectedChefId = "ALL",
  onSelectChef,
  unassignedCount = 0,
  loading = false,
  isExpanded: controlledExpanded,
  showChefWorkload: aliasControlledExpanded,
  onToggleExpand: controlledOnToggle,
  defaultExpanded = false,
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded =
    controlledExpanded !== undefined
      ? controlledExpanded
      : aliasControlledExpanded !== undefined
      ? aliasControlledExpanded
      : internalExpanded;

  const toggleExpanded = () => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-xs transition-all">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        aria-expanded={isExpanded}
        aria-label="Chef Stations & Workload"
        className={`w-full flex items-center justify-between gap-2 cursor-pointer select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 transition group py-0.5 ${
          isExpanded ? "border-b border-slate-100 dark:border-slate-800/80 pb-2.5 mb-2.5" : ""
        }`}
      >
        {/* Left: Icon, Title, and Count Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <Users size={16} className="text-orange-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
            Chef Stations & Workload
          </span>
          <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
            {chefs.length}
          </span>
        </div>

        {/* Right: View All button (when expanded) & Expand/Collapse Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {isExpanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectChef && onSelectChef("ALL");
              }}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition ${
                selectedChefId === "ALL"
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              View All
            </button>
          )}

          <span
            className="flex items-center justify-center w-6 h-6 rounded-md text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:bg-orange-50 dark:group-hover:bg-slate-800/60 transition"
            aria-hidden="true"
          >
            {isExpanded ? (
              <ChevronUp size={16} className="transition-transform duration-200" />
            ) : (
              <ChevronDown size={16} className="transition-transform duration-200" />
            )}
          </span>
        </div>
      </div>

      {isExpanded && (
        <>
          {loading && !chefs.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 text-center text-xs text-slate-500">
              Loading chef workload...
            </div>
          ) : !chefs.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 text-center text-xs text-slate-500">
              No active kitchen chefs found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 transition-all">
              {/* Unassigned Work Tile */}
              <div
                onClick={() => onSelectChef && onSelectChef("UNASSIGNED")}
                className={`cursor-pointer rounded-lg border p-2.5 transition flex flex-col justify-between ${
                  selectedChefId === "UNASSIGNED"
                    ? "border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500"
                    : "border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 bg-slate-50/50 dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Clock size={12} />
                    Unassigned Queue
                  </span>
                  <span className="text-xs font-extrabold px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded-md">
                    {unassignedCount} items
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Click to isolate unassigned items on KDS
                </div>
              </div>

              {/* Individual Chef Cards */}
              {chefs.map((chef) => {
                const isSelected = String(selectedChefId) === String(chef.chefId);
                const loadRatio = Math.min(100, Math.round((chef.assigned / (chef.capacity || 10)) * 100));

                return (
                  <div
                    key={chef.chefId}
                    onClick={() => onSelectChef && onSelectChef(chef.chefId)}
                    className={`cursor-pointer rounded-lg border p-2.5 transition relative flex flex-col justify-between ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 shadow-xs ring-1 ring-orange-500"
                        : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-800 bg-white dark:bg-slate-800/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                            <ChefHat size={13} className="text-orange-500 shrink-0" />
                            <span className="truncate">{chef.chefName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {chef.designation || "Chef"}
                          </div>
                        </div>

                        <Link
                          to={`/kitchen/chef/${chef.chefId}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Open Chef Station"
                          className="shrink-0 p-1 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-700 rounded transition"
                        >
                          <ChevronRight size={14} />
                        </Link>
                      </div>

                      {/* Status counts breakdown */}
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold text-center my-1.5">
                        <div className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 rounded px-1 py-0.5">
                          <span className="block text-[9px] text-slate-400 font-normal">Pending</span>
                          <span>{chef.pending || 0}</span>
                        </div>
                        <div className="bg-amber-100/70 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded px-1 py-0.5">
                          <span className="block text-[9px] text-amber-500 font-normal">Prep</span>
                          <span>{chef.preparing || 0}</span>
                        </div>
                        <div className="bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded px-1 py-0.5">
                          <span className="block text-[9px] text-emerald-500 font-normal">Ready</span>
                          <span>{chef.ready || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Workload Progress Bar & Utilization */}
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <span>Assigned: <strong>{chef.assigned || 0}</strong> ({loadRatio}%)</span>
                        <span className="text-[9px]">Cap: {chef.capacity || 10}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            loadRatio >= 80 ? "bg-red-500" : loadRatio >= 50 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(5, loadRatio)}%` }}
                        />
                      </div>
                      {Number(chef.overdue || 0) > 0 && (
                        <div className="mt-1 text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          <span>Overdue: {chef.overdue}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
