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
import SuperAdminSidebar from "../../components/super-admin/SuperAdminSidebar";

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
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey="settings" />

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
