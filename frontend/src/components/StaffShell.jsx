import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
    Bell,
    User,
    LogOut,
    Settings,
    Menu,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import { getDesignationTheme } from "../utils/staffThemes";

export default function StaffShell({
    title = "Staff Workspace",
    designation = "",
    children,
    activeTab,
    onTabChange,
    tabs = [],
    unreadNotificationCount = 0,
    actions = null,
    fullWidth = true,
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { socket, isConnected } = useStaffSocket();

    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation || designation);
    const displayDesignation = designation || user?.designation || effectiveRole || "STAFF";
    const restaurantName = user?.restaurant?.name || "Tiffzy Restaurant";
    const designationTheme = getDesignationTheme(displayDesignation, effectiveRole);

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out of staff station?")) {
            logout();
            navigate("/login?mode=staff");
        }
    };

    return (
        <div className="min-h-screen bg-white text-[#171717] flex flex-col font-sans">
            {/* Top Navigation Header */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E7E5E4] px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs">
                <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
                    {/* Left: Brand + Restaurant + Title */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Link
                            to={`/staff/${effectiveRole.toLowerCase()}`}
                            className="flex items-center gap-2 group shrink-0"
                            title="Tiffzy Staff Station"
                        >
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#F97316] flex items-center justify-center font-black text-white text-base sm:text-lg shadow-sm shadow-[#F97316]/30 group-hover:scale-105 transition-transform">
                                T
                            </div>
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="font-bold text-[#171717] text-sm sm:text-base tracking-tight truncate max-w-[100px] min-[360px]:max-w-[140px] sm:max-w-[220px]">
                                    {restaurantName}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30 uppercase tracking-wider shrink-0">
                                    {displayDesignation}
                                </span>
                            </div>
                            <div className="text-xs text-[#78716C] truncate hidden sm:block">
                                {title}
                            </div>
                        </div>
                    </div>

                    {/* Middle: Desktop tabs if provided */}
                    {tabs && tabs.length > 0 && onTabChange && (
                        <nav className="hidden md:flex items-center gap-1 bg-[#FFF7ED] p-1 rounded-xl border border-[#E7E5E4]">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        data-testid={`staff-tab-${tab.id}`}
                                        onClick={() => onTabChange(tab.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            isActive
                                                ? "bg-[#F97316] text-white shadow-xs font-bold"
                                                : "text-[#57534E] hover:text-[#171717] hover:bg-white"
                                        }`}
                                    >
                                        {Icon && <Icon className="w-3.5 h-3.5" />}
                                        <span>{tab.label}</span>
                                        {tab.badge !== undefined && tab.badge > 0 && (
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                isActive ? "bg-white text-[#EA580C]" : "bg-white/80 text-[#57534E] border border-[#E7E5E4]"
                                            }`}>
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    )}

                    {/* Right: Actions, Realtime Status, Notifications, Settings, Profile, Logout */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {actions}

                        {/* Connection status indicator */}
                        <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                                isConnected
                                    ? "bg-[#ECFDF5] text-[#059669] border-[#059669]/30"
                                    : "bg-[#FFFBEB] text-[#D97706] border-[#D97706]/30"
                            }`}
                            title={isConnected ? "Realtime connected" : "Connecting to server..."}
                        >
                            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-[#059669] animate-pulse" : "bg-[#D97706]"}`} />
                            <span className="text-[11px] font-bold hidden sm:inline">
                                {isConnected ? "Live" : "Offline"}
                            </span>
                        </div>

                        {/* Notifications button */}
                        <button
                            type="button"
                            onClick={() => navigate("/staff/notifications")}
                            className="relative min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-white hover:bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] flex items-center justify-center transition-colors border border-[#E7E5E4] shadow-xs"
                            title="Notifications"
                            aria-label="View staff notifications"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadNotificationCount > 0 && (
                                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F97316] text-white shadow-xs animate-pulse">
                                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                                </span>
                            )}
                        </button>

                        {/* Settings button */}
                        <button
                            type="button"
                            onClick={() => navigate("/staff/settings")}
                            className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-white hover:bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] flex items-center justify-center transition-colors border border-[#E7E5E4] shadow-xs"
                            title="Staff Settings"
                            aria-label="View staff settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Profile button */}
                        <button
                            type="button"
                            onClick={() => navigate("/staff/profile")}
                            className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-white hover:bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] flex items-center justify-center transition-colors border border-[#E7E5E4] shadow-xs"
                            title="My Profile"
                            aria-label="View staff profile"
                        >
                            <User className="w-4 h-4" />
                        </button>

                        {/* Logout button */}
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center transition-colors border border-[#DC2626]/20 shadow-xs"
                            title="Log Out"
                            aria-label="Log out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Tabs Bar if tabs provided */}
            {tabs && tabs.length > 0 && onTabChange && (
                <div className="md:hidden sticky top-[53px] z-30 bg-white/95 backdrop-blur border-b border-[#E7E5E4] px-2.5 py-1.5 overflow-x-auto scrollbar-none shadow-xs">
                    <div className="flex items-center gap-1.5 min-w-max">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[38px] transition-all ${
                                        isActive
                                            ? "bg-[#F97316] text-white shadow-xs font-bold"
                                            : "bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] border border-[#E7E5E4]"
                                    }`}
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    <span>{tab.label}</span>
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                            isActive ? "bg-white text-[#EA580C]" : "bg-white/80 text-[#57534E] border border-[#E7E5E4]"
                                        }`}>
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Workspace Body - Full width operational layout */}
            <main className="flex-1 w-full px-3 sm:px-4 md:px-5 py-3 sm:py-4 pb-20 md:pb-6">
                {children}
            </main>
        </div>
    );
}
