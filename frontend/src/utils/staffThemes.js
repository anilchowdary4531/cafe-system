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
    activeTab: "bg-orange-600 text-white shadow-xs border border-orange-500",
    activeBadge: "bg-white text-orange-600 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30",
    accentText: "text-[#EA580C]",
    accentBorder: "border-[#F97316]",
    accentBg: "bg-orange-600",
    accentHover: "hover:bg-orange-500",
  },
  SENIOR_CHEF: {
    id: "SENIOR_CHEF",
    label: "Senior Chef",
    activeTab: "bg-amber-600 text-white shadow-xs border border-amber-500",
    activeBadge: "bg-white text-amber-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30",
    accentText: "text-amber-500",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
  },
  SERVER: {
    id: "SERVER",
    label: "Server",
    activeTab: "bg-orange-500 text-white shadow-xs border border-orange-400",
    activeBadge: "bg-white text-orange-600 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30",
    accentText: "text-[#EA580C]",
    accentBorder: "border-[#F97316]",
    accentBg: "bg-orange-500",
    accentHover: "hover:bg-orange-400",
  },
  STEWARD: {
    id: "STEWARD",
    label: "Steward",
    activeTab: "bg-amber-600 text-white shadow-xs border border-amber-500",
    activeBadge: "bg-white text-amber-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30",
    accentText: "text-amber-500",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
  },
  CASHIER: {
    id: "CASHIER",
    label: "Cashier",
    activeTab: "bg-emerald-600 text-white shadow-xs border border-emerald-500",
    activeBadge: "bg-white text-emerald-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#ECFDF5] text-[#059669] border border-[#059669]/30",
    accentText: "text-[#059669]",
    accentBorder: "border-[#059669]",
    accentBg: "bg-emerald-600",
    accentHover: "hover:bg-emerald-500",
  },
  CLEANER: {
    id: "CLEANER",
    label: "Cleaner",
    activeTab: "bg-cyan-600 text-white shadow-xs border border-cyan-500",
    activeBadge: "bg-white text-cyan-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#ECFEFF] text-[#0891B2] border border-[#0891B2]/30",
    accentText: "text-cyan-500",
    accentBorder: "border-cyan-500",
    accentBg: "bg-cyan-600",
    accentHover: "hover:bg-cyan-500",
  },
  SWIPER: {
    id: "SWIPER",
    label: "Swiper",
    activeTab: "bg-indigo-600 text-white shadow-xs border border-indigo-500",
    activeBadge: "bg-white text-indigo-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/30",
    accentText: "text-indigo-500",
    accentBorder: "border-indigo-500",
    accentBg: "bg-indigo-600",
    accentHover: "hover:bg-indigo-500",
  },
  MANAGER: {
    id: "MANAGER",
    label: "Manager",
    activeTab: "bg-amber-600 text-white shadow-xs border border-amber-500",
    activeBadge: "bg-white text-amber-700 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30",
    accentText: "text-amber-500",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600",
    accentHover: "hover:bg-amber-500",
  },
  STAFF: {
    id: "STAFF",
    label: "Staff",
    activeTab: "bg-slate-800 text-white shadow-xs border border-slate-700",
    activeBadge: "bg-white text-slate-800 font-black",
    activeIcon: "text-white",
    inactiveTab: "bg-white text-slate-600 border border-[#E7E5E4] hover:bg-[#FFF7ED] hover:text-[#171717]",
    inactiveBadge: "bg-slate-100 text-slate-600 font-bold",
    inactiveIcon: "text-[#78716C]",
    pill: "bg-[#F1F5F9] text-[#475569] border border-[#475569]/30",
    accentText: "text-slate-600",
    accentBorder: "border-slate-500",
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
