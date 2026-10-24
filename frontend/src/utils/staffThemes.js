/**
 * TIFFZY STAFF WORKSPACE DESIGNATION THEME SYSTEM
 * 
 * Centralized design tokens and theme resolvers for staff designation workspaces.
 * Guarantees visual consistency across Chef, Senior Chef, Server, Steward, Cashier,
 * Cleaner, Swiper, Manager, and Custom Staff stations.
 */

export const STAFF_THEMES = {
  CHEF: {
    id: "CHEF",
    label: "Chef",
    // Active navigation tab
    activeTab: "bg-orange-600 text-white shadow-sm shadow-orange-600/30 border border-orange-500",
    activeBadge: "bg-white text-orange-600 font-black",
    activeIcon: "text-white",
    // Inactive navigation tab
    inactiveTab: "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200",
    inactiveBadge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold",
    inactiveIcon: "text-slate-400 dark:text-slate-500",
    // Badge & shell tokens
    pill: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    accentText: "text-orange-500",
    accentBorder: "border-orange-500",
    accentBg: "bg-orange-600",
    accentHover: "hover:bg-orange-500",
  },
  SENIOR_CHEF: {
    id: "SENIOR_CHEF",
    label: "Senior Chef",
    activeTab: "bg-amber-600 text-white shadow-sm shadow-amber-600/30 border border-amber-500",
    activeBadge: "bg-white text-amber-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200",
    inactiveBadge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold",
    inactiveIcon: "text-slate-400 dark:text-slate-500",
    pill: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    accentText: "text-amber-500",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
  },
  SERVER: {
    id: "SERVER",
    label: "Server",
    activeTab: "bg-orange-500 text-white shadow-sm shadow-orange-500/30 border border-orange-400",
    activeBadge: "bg-white text-orange-600 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200",
    inactiveBadge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold",
    inactiveIcon: "text-slate-400 dark:text-slate-500",
    pill: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    accentText: "text-orange-500",
    accentBorder: "border-orange-500",
    accentBg: "bg-orange-500",
    accentHover: "hover:bg-orange-400",
  },
  STEWARD: {
    id: "STEWARD",
    label: "Steward",
    activeTab: "bg-amber-600 text-white shadow-sm shadow-amber-600/30 border border-amber-500",
    activeBadge: "bg-white text-amber-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200",
    inactiveBadge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold",
    inactiveIcon: "text-slate-400 dark:text-slate-500",
    pill: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30",
    accentText: "text-amber-600 dark:text-amber-400",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
  },
  CASHIER: {
    id: "CASHIER",
    label: "Cashier",
    activeTab: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 border border-emerald-500",
    activeBadge: "bg-white text-emerald-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white",
    inactiveBadge: "bg-neutral-800 text-neutral-400 font-bold",
    inactiveIcon: "text-neutral-400",
    pill: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    accentText: "text-emerald-400",
    accentBorder: "border-emerald-500",
    accentBg: "bg-emerald-600",
    accentHover: "hover:bg-emerald-500",
  },
  CLEANER: {
    id: "CLEANER",
    label: "Cleaner",
    activeTab: "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30 border border-cyan-500",
    activeBadge: "bg-white text-cyan-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white",
    inactiveBadge: "bg-neutral-800 text-neutral-400 font-bold",
    inactiveIcon: "text-neutral-400",
    pill: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    accentText: "text-cyan-400",
    accentBorder: "border-cyan-500",
    accentBg: "bg-cyan-600",
    accentHover: "hover:bg-cyan-500",
  },
  SWIPER: {
    id: "SWIPER",
    label: "Swiper",
    activeTab: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 border border-indigo-500",
    activeBadge: "bg-white text-indigo-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white",
    inactiveBadge: "bg-neutral-800 text-neutral-400 font-bold",
    inactiveIcon: "text-neutral-400",
    pill: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
    accentText: "text-indigo-400",
    accentBorder: "border-indigo-500",
    accentBg: "bg-indigo-600",
    accentHover: "hover:bg-indigo-500",
  },
  MANAGER: {
    id: "MANAGER",
    label: "Manager",
    activeTab: "bg-amber-600 text-white shadow-sm shadow-amber-600/30 border border-amber-500",
    activeBadge: "bg-white text-amber-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white",
    inactiveBadge: "bg-neutral-800 text-neutral-400 font-bold",
    inactiveIcon: "text-neutral-400",
    pill: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    accentText: "text-amber-400",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
  },
  STAFF: {
    id: "STAFF",
    label: "Staff",
    activeTab: "bg-slate-800 text-white shadow-sm shadow-slate-800/30 border border-slate-700",
    activeBadge: "bg-white text-slate-800 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white",
    inactiveBadge: "bg-neutral-800 text-neutral-400 font-bold",
    inactiveIcon: "text-neutral-400",
    pill: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
    accentText: "text-slate-300",
    accentBorder: "border-slate-600",
    accentBg: "bg-slate-700",
    accentHover: "hover:bg-slate-600",
  },
};

/**
 * Resolves a designation theme from designation or role string
 * @param {string} designation - Staff designation or role
 * @param {string} [role] - Optional staff role fallback
 * @returns {typeof STAFF_THEMES.CHEF} Theme configuration
 */
export const getDesignationTheme = (designation, role = "") => {
  const text = String(designation || role || "").trim().toUpperCase();

  if (text.includes("SENIOR") || text.includes("HEAD CHEF") || text.includes("EXECUTIVE") || text.includes("LEAD CHEF") || text.includes("SOUS")) {
    return STAFF_THEMES.SENIOR_CHEF;
  }
  if (text.includes("CHEF")) {
    return STAFF_THEMES.CHEF;
  }
  if (text.includes("SERVER") || text.includes("WAITER")) {
    return STAFF_THEMES.SERVER;
  }
  if (text.includes("STEWARD") || text.includes("RUNNER")) {
    return STAFF_THEMES.STEWARD;
  }
  if (text.includes("CASHIER") || text.includes("BILLING") || text.includes("POS")) {
    return STAFF_THEMES.CASHIER;
  }
  if (text.includes("CLEANER") || text.includes("SANITATION") || text.includes("BUSSER")) {
    return STAFF_THEMES.CLEANER;
  }
  if (text.includes("SWIPER")) {
    return STAFF_THEMES.SWIPER;
  }
  if (text.includes("MANAGER") || text.includes("OWNER") || text.includes("ADMIN")) {
    return STAFF_THEMES.MANAGER;
  }

  return STAFF_THEMES.STAFF;
};
