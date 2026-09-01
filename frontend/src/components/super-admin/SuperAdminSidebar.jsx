import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
    Wallet,
    Truck,
} from "lucide-react";
import tiffzyLogo from "../../assets/tiffzy-logo.png";

export const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, to: "/super-admin" },
    { key: "restaurants", label: "Restaurant Management", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "restaurant-profile", label: "Restaurant Profile Page", icon: Utensils, to: "/super-admin/restaurant-profiles" },
    { key: "wallets", label: "Customer Wallet Ledger", icon: Wallet, to: "/super-admin/wallets" },
    { key: "categories", label: "Home Categories", icon: Menu, to: "/super-admin/categories" },
    { key: "banners", label: "Promotion Banners", icon: ImageIcon, to: "/super-admin/banners" },
    { key: "users", label: "All Users & Staff", icon: Users, to: "/super-admin/users" },
    { key: "settlements", label: "Cashfree Easy Split", icon: BarChart3, to: "/super-admin/settlements" },
    { key: "supply", label: "Supply Chain Hub", icon: Truck, to: "/super-admin/supply" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "System Settings", icon: Settings, to: "/super-admin/settings" },
];

export default function SuperAdminSidebar({ open, setOpen, currentKey }) {
    const navigate = useNavigate();
    const location = useLocation();

    // Close sidebar on ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && open) setOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, setOpen]);

    const handleMenuClick = (item) => {
        setOpen(false);
        if (item.to.includes("#")) {
            const [path, hash] = item.to.split("#");
            if (location.pathname === path) {
                const target = document.getElementById(hash);
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                navigate(item.to);
            }
        } else {
            navigate(item.to);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 transition-all duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close menu backdrop"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Sidebar drawer */}
            <aside
                className={`theme-panel theme-border absolute left-0 top-0 h-full w-72 max-w-[84vw] border-r p-5 shadow-2xl transition-transform duration-300 ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--app-border)]">
                    <div className="flex items-center gap-2.5">
                        <img src={tiffzyLogo} alt="Tiffzy" className="h-7 w-auto object-contain" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] theme-muted">MENU</p>
                            <h2 className="text-base font-extrabold text-[color:var(--app-text)] leading-none">Tiffzy Admin</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="theme-soft-button flex h-8 w-8 items-center justify-center rounded-xl transition hover:scale-105"
                        aria-label="Close sidebar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Clean Navigation Menu WITHOUT individual dividing box cards */}
                <nav className="mt-4 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-100px)] pr-1">
                    {SUPER_ADMIN_MENU_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentKey === item.key || location.pathname === item.to;

                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => handleMenuClick(item)}
                                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold transition-all duration-200 ${
                                    isActive
                                        ? "bg-gradient-to-r from-[#ff8a1f] to-[#d97706] text-white shadow-md shadow-[#ff8a1f]/25 scale-[1.02]"
                                        : "text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-1"
                                }`}
                            >
                                <Icon size={18} className={isActive ? "text-white" : "text-amber-500 group-hover:scale-110 transition-transform"} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>
        </div>
    );
}
