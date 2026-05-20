import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    ShoppingBag,
    UtensilsCrossed,
    TableProperties,
    ChefHat,
    BarChart3,
    IndianRupee,
    Users,
    Settings,
    LogOut,
    Bell,
    Menu,
    X,
    ClipboardPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resolveRestaurantName } from "../utils/restaurantContext";
import ThemeSelector from "../components/ThemeSelector";
import { useAuth } from "../context/AuthContext";

const MODULES = [
    "dashboard",
    "orders",
    "menu",
    "tables",
    "kitchen",
    "analytics",
    "finance",
    "staff",
    "settings",
];

const defaultAccessByRole = (role) => {
    const r = String(role || "OWNER").toUpperCase();

    if (r === "OWNER") {
        return MODULES.reduce((acc, key) => ({ ...acc, [key]: true }), {});
    }

    return {
        dashboard: true,
        orders: true,
        menu: true,
        tables: true,
        kitchen: true,
        analytics: true,
        finance: false,
        staff: false,
        settings: false,
    };
};

const normalizeAccess = (rawAccess, role) => {
    const fallback = defaultAccessByRole(role);

    if (!rawAccess || typeof rawAccess !== "object") return fallback;

    return MODULES.reduce((acc, key) => {
        acc[key] =
            rawAccess[key] === undefined ? fallback[key] : Boolean(rawAccess[key]);
        return acc;
    }, {});
};

export default function OwnerLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const { user, logout } = useAuth();

    const restaurantName = resolveRestaurantName(user, "Restaurant");

    const access = useMemo(
        () => normalizeAccess(user?.access, user?.role),
        [user]
    );

    // logout is provided by AuthContext (clears cache + navigates with replace).

    const navItems = [
        {
            label: "Dashboard",
            path: "/owner",
            icon: <LayoutDashboard size={18} />,
            accessKey: "dashboard",
        },
        {
            label: "New Order (POS)",
            path: "/admin/new-order",
            icon: <ClipboardPlus size={18} />,
            accessKey: "orders",
        },
        {
            label: "Live Orders",
            path: "/owner/orders",
            icon: <ShoppingBag size={18} />,
            accessKey: "orders",
        },
        {
            label: "Menu Studio",
            path: "/owner/menu",
            icon: <UtensilsCrossed size={18} />,
            accessKey: "menu",
        },
        {
            label: "Tables & QR",
            path: "/owner/tables",
            icon: <TableProperties size={18} />,
            accessKey: "tables",
        },
        {
            label: "Kitchen Live",
            path: "/owner/kitchen",
            icon: <ChefHat size={18} />,
            accessKey: "kitchen",
        },
        {
            label: "Analytics",
            path: "/owner/analytics",
            icon: <BarChart3 size={18} />,
            accessKey: "analytics",
        },
        {
            label: "Finance",
            path: "/owner/finance",
            icon: <IndianRupee size={18} />,
            accessKey: "finance",
        },
        {
            label: "Staff",
            path: "/owner/staff",
            icon: <Users size={18} />,
            accessKey: "staff",
        },
        {
            label: "Settings",
            path: "/owner/settings",
            icon: <Settings size={18} />,
            accessKey: "settings",
        },
    ];

    const visibleNavItems = navItems.filter((item) => access[item.accessKey]);

    const firstAllowedPath = visibleNavItems[0]?.path || "/owner";

    const findRouteAccess = (pathname) =>
        navItems.find((item) =>
            item.path === "/owner"
                ? pathname === "/owner"
                : pathname.startsWith(item.path)
        );

    const canAccessCurrentRoute = (() => {
        const match = findRouteAccess(location.pathname);
        if (!match) return true;
        return access[match.accessKey];
    })();

    useEffect(() => {
        if (!visibleNavItems.length) return;

        if (!canAccessCurrentRoute) {
            navigate(firstAllowedPath, { replace: true });
        }
    }, [canAccessCurrentRoute, firstAllowedPath, navigate, visibleNavItems.length]);

    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div className="theme-page flex min-h-screen overflow-x-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/70 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 bottom-0 z-50
          w-64 sm:w-72
          theme-sidebar border-r
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:flex-shrink-0
        `}
            >
                <div className="h-full flex flex-col p-5 overflow-y-auto">
                    {/* Logo */}
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="theme-accent-text text-2xl font-bold sm:text-3xl">
                            Suretra
                        </h1>

                        <button
                            className="theme-icon-button block rounded-xl p-2 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Nav */}
                    <div className="space-y-2">
                        {visibleNavItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === "/owner"}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                                        isActive
                                            ? "theme-nav-item-active"
                                            : "theme-nav-item"
                                    }`
                                }
                            >
                                {item.icon}
                                <span className="text-sm sm:text-base">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>

                    {/* Logout */}
                    <button
                        onClick={logout}
                        className="mt-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 min-w-0">
                {/* Header */}
                <header className="theme-nav border-b px-3 py-3 sm:px-4 md:px-6">
                    <div className="flex items-center justify-between gap-3">
                        {/* Left */}
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                className="theme-icon-button theme-icon-button-primary block shrink-0 rounded-xl p-2.5 shadow-lg lg:hidden"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <Menu size={20} />
                            </button>

                            <div className="min-w-0">
                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">
                                    Owner Panel
                                </h2>
                                <p className="theme-muted truncate text-[11px] sm:text-xs">
                                    {restaurantName}
                                </p>
                            </div>
                        </div>

                        {/* Right */}
                        <div className="flex shrink-0 items-center gap-2">
                            <ThemeSelector variant="compact" />
                            <button className="theme-icon-button relative rounded-2xl p-2.5 sm:p-3">
                                <Bell size={18} />
                                <span className="theme-count-badge absolute right-2 top-2 h-2 w-2 rounded-full"></span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page */}
                <main className="p-3 sm:p-4 md:p-6">
                    {visibleNavItems.length === 0 ? (
                        <div className="theme-panel rounded-2xl p-6 text-sm">
                            No modules are enabled for this account.
                        </div>
                    ) : canAccessCurrentRoute ? (
                        <Outlet />
                    ) : null}
                </main>
            </div>
        </div>
    );
}
