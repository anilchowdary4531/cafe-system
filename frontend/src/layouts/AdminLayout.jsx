import {
    Link,
    Outlet,
    useLocation,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { resolveRestaurantName } from "../utils/restaurantContext";
import ThemeSelector from "../components/ThemeSelector";

export default function AdminLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();

    const [open, setOpen] = useState(false);
    const restaurantName = resolveRestaurantName(user, "All Restaurants");

    const menus = [
        { name: "Dashboard", path: "/admin", icon: "📊" },
        { name: "Menu", path: "/admin/menu", icon: "🍔" },
        { name: "Orders", path: "/admin/orders", icon: "📦" },
        { name: "Tables", path: "/admin/tables", icon: "🪑" },
    ];

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="theme-page flex min-h-screen">

            {/* MOBILE OVERLAY */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                />
            )}

            {/* SIDEBAR */}
            <aside
                className={`
          fixed lg:static z-50 top-0 left-0 h-full w-72
          theme-sidebar border-r backdrop-blur-xl
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
            >

                {/* LOGO */}
                <div className="theme-border border-b p-6">
                    <h1 className="theme-accent-text text-3xl font-bold">
                        ☕ Cafe Admin
                    </h1>
                </div>

                {/* USER CARD */}
                <div className="p-4">
                    <div className="theme-card rounded-2xl p-4">
                        <p className="theme-muted text-sm">
                            Logged in as
                        </p>

                        <h2 className="font-semibold text-lg">
                            {user?.name || "Admin"}
                        </h2>

                        <p className="theme-accent-text text-xs">
                            {user?.email}
                        </p>
                    </div>
                </div>

                {/* MENUS */}
                <nav className="px-4 space-y-2">

                    {menus.map((item) => {
                        const active =
                            location.pathname === item.path;

                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                onClick={() => setOpen(false)}
                                className={`
                  flex items-center gap-3 px-4 py-3 rounded-2xl transition
                  ${
                                    active
                                        ? "theme-nav-item-active shadow-lg"
                                        : "theme-nav-item"
                                }
                `}
                            >
                                <span>{item.icon}</span>
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}

                </nav>

                {/* LOGOUT */}
                <div className="absolute bottom-0 w-full p-4">
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-500 hover:bg-red-600 py-3 rounded-2xl font-semibold"
                    >
                        Logout
                    </button>
                </div>

            </aside>

            {/* MAIN */}
            <div className="flex-1 lg:ml-0">

                {/* TOPBAR */}
                <header className="theme-nav flex h-16 items-center justify-between border-b px-6">

                    {/* HAMBURGER */}
                    <button
                        onClick={() => setOpen(true)}
                        className="lg:hidden text-3xl"
                    >
                        ☰
                    </button>

                    <div>
                        <h2 className="text-xl font-semibold">
                            Admin Dashboard
                        </h2>
                        <p className="theme-muted hidden text-xs sm:block">
                            {restaurantName}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeSelector variant="compact" />
                        <div className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-400">
                            Live
                        </div>
                    </div>

                </header>

                {/* PAGE */}
                <main className="p-6">
                    <Outlet />
                </main>

            </div>

        </div>
    );
}
