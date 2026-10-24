import React from "react";
import { UtensilsCrossed, History as HistoryIcon } from "lucide-react";
import { getDesignationTheme } from "../utils/staffThemes";

/**
 * TIFFZY SHARED STAFF ASSIGNED ITEMS & HISTORY NAVIGATION TABS
 *
 * Provides designation-aware theme styling for staff workspace tabs.
 * Dynamically applies each designation's visual identity (Chef, Senior Chef,
 * Server, Steward, Cashier, Cleaner, Swiper, Manager, Custom Staff) while
 * preserving exact routing, test IDs, and data structures.
 */
export default function StaffWorkHistoryTabs({
  designation = "CHEF",
  theme: customTheme = null,
  activeTab = "QUEUE",
  onTabChange,
  assignedCount,
  historyCount,
  assignedLabel = "MY ASSIGNED ITEMS",
  historyLabel = "HISTORY",
  assignedIcon: AssignedIcon = UtensilsCrossed,
  historyIcon: HistoryIconComponent = HistoryIcon,
  assignedTestId = "tab-assigned-items",
  historyTestId = "tab-chef-history",
  tabs: customTabs = null,
  className = "",
  ariaLabel = "Staff workspace navigation tabs",
}) {
  const resolvedTheme =
    customTheme && typeof customTheme === "object"
      ? customTheme
      : getDesignationTheme(customTheme || designation);

  // If custom tabs array is provided, render each tab using the designation theme;
  // otherwise default to canonical Assigned Items vs History layout.
  const tabsToRender = customTabs || [
    {
      id: "QUEUE",
      label: assignedLabel,
      icon: AssignedIcon,
      count: assignedCount,
      testId: assignedTestId,
    },
    {
      id: "HISTORY",
      label: historyLabel,
      icon: HistoryIconComponent,
      count: historyCount,
      testId: historyTestId,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap ${className}`}
    >
      {tabsToRender.map((tab) => {
        const isActive =
          activeTab === tab.id ||
          (tab.id === "QUEUE" && (activeTab === "QUEUE" || activeTab === "ASSIGNED"));
        const Icon = tab.icon;
        const count = tab.count ?? tab.badge;
        const showBadge = count !== undefined && count !== null;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={tab.testId || `tab-${tab.id.toLowerCase()}`}
            onClick={() => onTabChange && onTabChange(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isActive ? resolvedTheme.activeTab : resolvedTheme.inactiveTab
            }`}
          >
            {Icon && (
              <Icon
                size={14}
                className={isActive ? resolvedTheme.activeIcon : resolvedTheme.inactiveIcon}
              />
            )}
            <span>{tab.label}</span>
            {showBadge && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                  isActive ? resolvedTheme.activeBadge : resolvedTheme.inactiveBadge
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Canonical alias as specified in requirements
export const StaffAssignedHistoryTabs = StaffWorkHistoryTabs;
