import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    LayoutDashboard,
    Menu,
    Settings,
    Store,
    Users,
    X,
    Image as ImageIcon,
    Utensils,
    Wallet
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ThemeSelector from "../../components/ThemeSelector";
import { useAuth } from "../../context/AuthContext";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, to: "/super-admin" },
    { key: "restaurants", label: "Restaurant Management", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "restaurant-profile", label: "Restaurant Profile Page", icon: Utensils, to: "/super-admin/restaurant-profiles" },
    { key: "wallets", label: "Customer Wallet Ledger", icon: Wallet, to: "/super-admin/wallets" },
    { key: "categories", label: "Home Categories", icon: Menu, to: "/super-admin/categories" },
    { key: "banners", label: "Promotion Banners", icon: ImageIcon, to: "/super-admin/banners" },
    { key: "users", label: "All Users & Staff", icon: Users, to: "/super-admin/users" },
    { key: "settlements", label: "Cashfree Easy Split", icon: BarChart3, to: "/super-admin/settlements" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "System Settings", icon: Settings, to: "/super-admin/settings" },
];

export default function SuperAdminSettings() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeMenuKey, setActiveMenuKey] = useState("settings");

    useEffect(() => {
        if (!sidebarOpen) return undefined;

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [sidebarOpen]);

    useEffect(() => {
        if (location.pathname === "/super-admin/settings") {
            setActiveMenuKey("settings");
        }
    }, [location.pathname]);

    const handleMenuClick = (item) => {
        setActiveMenuKey(item.key);
        setSidebarOpen(false);
        navigate(item.to);
    };

    return (
        <div className="theme-page min-h-screen">
            <div className={`fixed inset-0 z-50 transition ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
                <button
                    type="button"
                    aria-label="Close Tiffzy menu"
                    onClick={() => setSidebarOpen(false)}
                    className={`absolute inset-0 bg-black/45 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
                />
                <aside
                    className={`theme-panel theme-border absolute left-0 top-0 h-full w-72 max-w-[84vw] border-r p-5 shadow-2xl transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.2em]">Menu</p>
                            <h2 className="text-xl font-bold">Tiffzy</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="theme-soft-button inline-flex h-9 w-9 items-center justify-center rounded-xl"
                            aria-label="Close sidebar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <nav className="mt-5 grid gap-2">
                        {SUPER_ADMIN_MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.key === activeMenuKey;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleMenuClick(item)}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${isActive ? "theme-button" : "theme-soft-button"}`}
                                >
                                    <Icon size={17} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
            </div>

            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                            <Menu size={16} />
                            Tiffzy
                        </button>
                        <div className="flex h-12 w-12 -rotate-2 items-center justify-center overflow-hidden rounded-md border border-[#d9c8af] bg-transparent p-0.5 shadow-[0_3px_8px_rgba(88,61,36,0.14)]">
                            <img src={tiffzyLogo} alt="Tiffzy logo" className="h-full w-full object-contain mix-blend-multiply" />
                        </div>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.28em]">Super Admin</p>
                            <h1 className="text-2xl font-bold">Settings</h1>
                            <p className="theme-muted text-sm">{user?.email || "admin@tiffzy.com"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
                <section className="theme-panel rounded-3xl p-5">
                    <div className="flex items-center gap-2">
                        <Settings className="theme-accent-text" size={20} />
                        <h2 className="text-xl font-bold">Required Settings</h2>
                    </div>
                    <p className="theme-muted mt-2 text-sm">Manage application-level settings from this page.</p>

                    <div className="mt-5 max-w-xl">
                        <p className="theme-muted mb-2 text-sm font-semibold">UI Theme</p>
                        <ThemeSelector />
                    </div>
                </section>
            </main>
        </div>
    );
}
