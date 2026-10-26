import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
    Bell,
    User,
    LogOut,
    Wifi,
    WifiOff,
    CheckCircle2,
    UtensilsCrossed,
    Sparkles,
    Shield,
    Menu,
    X,
    Settings,
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
    fullWidth = false,
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { socket, isConnected, connected, connectionStatus } = useStaffSocket();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation || designation);
    const displayDesignation = designation || user?.designation || effectiveRole || "STAFF";
    const restaurantName = user?.restaurant?.name || "Tiffzy Restaurant";
    const designationTheme = getDesignationTheme(displayDesignation, effectiveRole);

    const online = Boolean(isConnected ?? connected);
    const resolvedStatus = connectionStatus || (online ? "connected" : "disconnected");

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out of staff station?")) {
            logout();
            navigate("/login?mode=staff");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            {/* Top Navigation Header */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-3 py-2 sm:px-6 sm:py-2.5">
                <div className={`w-full flex items-center justify-between gap-1.5 sm:gap-3 ${fullWidth ? "max-w-none px-1" : "max-w-[1720px] mx-auto"}`}>
                    {/* Left: Brand + Restaurant + Title */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Link
                            to={`/staff/${effectiveRole.toLowerCase()}`}
                            className="flex items-center gap-2 group shrink-0"
                            title="Tiffzy Staff Station"
                        >
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-600 flex items-center justify-center font-black text-white text-base sm:text-lg shadow-md shadow-orange-600/30 group-hover:scale-105 transition-transform">
                                T
                            </div>
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight truncate max-w-[80px] min-[360px]:max-w-[120px] sm:max-w-[200px]">
                                    {restaurantName}
                                </span>
                                <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${designationTheme.pill} uppercase tracking-wider shrink-0`}>
                                    {displayDesignation}
                                </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                                {title}
                            </div>
                        </div>
                    </div>

                    {/* Middle: Desktop tabs if provided */}
                    {tabs && tabs.length > 0 && onTabChange && (
                        <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
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
                                                ? `${designationTheme.accentBg} text-white shadow-xs`
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        {Icon && <Icon className="w-3.5 h-3.5" />}
                                        <span>{tab.label}</span>
                                        {tab.badge !== undefined && tab.badge > 0 && (
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                isActive ? `bg-white ${designationTheme.accentText}` : `${designationTheme.pill}`
                                            }`}>
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    )}

                    {/* Right: Actions, Realtime Status, Notifications, Profile, Logout */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                        {actions}

                        {/* Connection status indicator */}
                        <div
                            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                resolvedStatus === "connected"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : resolvedStatus === "reconnecting"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                    : resolvedStatus === "connecting"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            }`}
                            title={
                                resolvedStatus === "connected"
                                    ? "Realtime connected"
                                    : resolvedStatus === "reconnecting"
                                    ? "Reconnecting to realtime server..."
                                    : resolvedStatus === "connecting"
                                    ? "Connecting to realtime server..."
                                    : "Realtime disconnected"
                            }
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    resolvedStatus === "connected"
                                        ? "bg-emerald-500 animate-pulse"
                                        : resolvedStatus === "reconnecting"
                                        ? "bg-amber-500 animate-ping"
                                        : resolvedStatus === "connecting"
                                        ? "bg-amber-500 animate-pulse"
                                        : "bg-rose-500"
                                }`}
                            />
                            <span className="text-[11px] font-bold hidden sm:inline">
                                {resolvedStatus === "connected"
                                    ? "Live"
                                    : resolvedStatus === "reconnecting"
                                    ? "Reconnecting..."
                                    : resolvedStatus === "connecting"
                                    ? "Connecting..."
                                    : "Offline"}
                            </span>
                        </div>

                        {/* Notifications button */}
                        <button
                            type="button"
                            onClick={() => navigate("/staff/notifications")}
                            className="relative min-w-[40px] min-h-[40px] sm:min-w-[42px] sm:min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700/60"
                            title="Notifications"
                            aria-label="View staff notifications"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadNotificationCount > 0 && (
                                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white shadow-md animate-pulse">
                                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                                </span>
                            )}
                        </button>

                        {/* Settings button */}
                        <button
                            type="button"
                            data-testid="staff-settings-btn"
                            onClick={() => navigate("/staff/settings")}
                            className="min-w-[40px] min-h-[40px] sm:min-w-[42px] sm:min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700/60"
                            title="Settings"
                            aria-label="View staff settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Profile button */}
                        <button
                            type="button"
                            data-testid="staff-profile-btn"
                            onClick={() => navigate("/staff/profile")}
                            className="min-w-[40px] min-h-[40px] sm:min-w-[42px] sm:min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700/60"
                            title="My Profile"
                            aria-label="View staff profile"
                        >
                            <User className="w-4 h-4" />
                        </button>

                        {/* Logout button */}
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="min-w-[40px] min-h-[40px] sm:min-w-[42px] sm:min-h-[42px] rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center transition-colors border border-red-200 dark:border-red-800/40"
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
                <div className="md:hidden sticky top-[53px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-2.5 py-1.5 overflow-x-auto scrollbar-none">
                    <div className="flex items-center gap-1.5 min-w-max">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all ${
                                        isActive
                                            ? `${designationTheme.accentBg} text-white shadow-xs`
                                            : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    }`}
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    <span>{tab.label}</span>
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                            isActive ? `bg-white ${designationTheme.accentText}` : `${designationTheme.pill}`
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

            {/* Main Workspace Body */}
            <main className={`flex-1 w-full pb-16 md:pb-6 flex flex-col ${fullWidth ? "max-w-none px-3 sm:px-6 py-3 sm:py-4" : "max-w-[1600px] mx-auto p-3 sm:p-5"}`}>
                {children}
            </main>
        </div>
    );
}
