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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

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
    const { socket, isConnected } = useStaffSocket();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation || designation);
    const displayDesignation = designation || user?.designation || effectiveRole || "STAFF";
    const restaurantName = user?.restaurant?.name || "Tiffzy Restaurant";

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out of staff station?")) {
            logout();
            navigate("/login?mode=staff");
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
            {/* Top Navigation Header */}
            <header className="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 py-3 sm:px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                    {/* Left: Brand + Restaurant + Title */}
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            to={`/staff/${effectiveRole.toLowerCase()}`}
                            className="flex items-center gap-2 group shrink-0"
                            title="Tiffzy Staff Station"
                        >
                            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-600/30 group-hover:scale-105 transition-transform">
                                T
                            </div>
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-base tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
                                    {restaurantName}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-wider shrink-0">
                                    {displayDesignation}
                                </span>
                            </div>
                            <div className="text-xs text-neutral-400 truncate hidden sm:block">
                                {title}
                            </div>
                        </div>
                    </div>

                    {/* Middle: Desktop tabs if provided */}
                    {tabs && tabs.length > 0 && onTabChange && (
                        <nav className="hidden md:flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
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
                                                ? "bg-orange-600 text-white shadow-sm"
                                                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                                        }`}
                                    >
                                        {Icon && <Icon className="w-3.5 h-3.5" />}
                                        <span>{tab.label}</span>
                                        {tab.badge !== undefined && tab.badge > 0 && (
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                isActive ? "bg-white text-orange-600" : "bg-orange-500/30 text-orange-300"
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
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {actions}

                        {/* Connection status indicator */}
                        <div
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${
                                isConnected
                                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                                    : "bg-amber-950/60 text-amber-400 border-amber-800/60"
                            }`}
                            title={isConnected ? "Realtime connected" : "Connecting to server..."}
                        >
                            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                            <span className="text-[11px] font-medium hidden sm:inline">
                                {isConnected ? "Live" : "Offline"}
                            </span>
                        </div>

                        {/* Notifications button */}
                        <button
                            type="button"
                            onClick={() => navigate("/staff/notifications")}
                            className="relative min-w-[44px] min-h-[44px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition-colors border border-neutral-700/50"
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

                        {/* Profile button */}
                        <button
                            type="button"
                            onClick={() => navigate("/staff/profile")}
                            className="min-w-[44px] min-h-[44px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition-colors border border-neutral-700/50"
                            title="My Profile"
                            aria-label="View staff profile"
                        >
                            <User className="w-4 h-4" />
                        </button>

                        {/* Logout button */}
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="min-w-[44px] min-h-[44px] rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 flex items-center justify-center transition-colors border border-red-800/40"
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
                <div className="md:hidden sticky top-[65px] z-30 bg-neutral-900/90 border-b border-neutral-800 px-3 py-2 overflow-x-auto">
                    <div className="flex items-center gap-1.5 min-w-max">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[44px] transition-all ${
                                        isActive
                                            ? "bg-orange-600 text-white shadow-sm"
                                            : "bg-neutral-800/70 text-neutral-300 hover:bg-neutral-700"
                                    }`}
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    <span>{tab.label}</span>
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                            isActive ? "bg-white text-orange-600" : "bg-orange-500/30 text-orange-300"
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
            <main className={`flex-1 w-full mx-auto p-3 sm:p-5 pb-20 md:pb-6 ${fullWidth ? "max-w-[1720px]" : "max-w-7xl"}`}>
                {children}
            </main>
        </div>
    );
}
