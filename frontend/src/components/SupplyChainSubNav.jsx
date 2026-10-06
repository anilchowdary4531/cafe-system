import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Package,
    ShoppingBag,
    Users,
    Truck,
    Warehouse,
    ClipboardCheck,
    ArrowLeftRight,
    ChefHat,
    Trash2,
    Store,
    Handshake,
    CreditCard,
    BarChart3,
    Activity,
    Settings
} from "lucide-react";

export const SUPPLY_CHAIN_NAV_ITEMS = [
    { id: "overview", label: "Overview", path: "/owner/supply-chain", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", path: "/owner/supply-chain/inventory", icon: Package },
    { id: "purchasing", label: "Purchasing", path: "/owner/supply-chain/purchase-orders", icon: ShoppingBag },
    { id: "suppliers", label: "Suppliers", path: "/owner/supply-chain/suppliers", icon: Users },
    { id: "receiving", label: "Receiving", path: "/owner/supply-chain/receiving", icon: Truck },
    { id: "warehouse", label: "Warehouse", path: "/owner/supply-chain/warehouse", icon: Warehouse },
    { id: "stock-counts", label: "Stock Counts", path: "/owner/supply-chain/stock-counts", icon: ClipboardCheck },
    { id: "transfers", label: "Transfers", path: "/owner/supply-chain/transfers", icon: ArrowLeftRight },
    { id: "recipes", label: "Recipes", path: "/owner/supply-chain/recipes", icon: ChefHat },
    { id: "consumption", label: "Consumption", path: "/owner/supply-chain/consumption", icon: Activity },
    { id: "wastage", label: "Wastage", path: "/owner/supply-chain/wastage", icon: Trash2 },
    { id: "marketplace", label: "Marketplace", path: "/owner/supply-chain/marketplace", icon: Store },
    { id: "negotiations", label: "Negotiations", path: "/owner/supply-chain/negotiations", icon: Handshake },
    { id: "payments", label: "Payments", path: "/owner/supply-chain/payments", icon: CreditCard },
    { id: "reports", label: "Reports & Intel", path: "/owner/supply-chain/reports", icon: BarChart3 },
    { id: "settings", label: "Settings", path: "/owner/supply-chain/settings", icon: Settings }
];

export default function SupplyChainSubNav() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="w-full bg-[color:var(--app-card-bg,#ffffff)] border-b border-[color:var(--app-border,#e2e8f0)]/80 sticky top-0 z-30 mb-5 shadow-xs">
            <div className="max-w-7xl mx-auto px-2 sm:px-4">
                <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
                    {SUPPLY_CHAIN_NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            item.path === "/owner/supply-chain"
                                ? location.pathname === "/owner/supply-chain" || location.pathname === "/owner/supply-chain/"
                                : location.pathname.startsWith(item.path);

                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.path)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-orange-500 text-white font-bold shadow-xs"
                                        : "text-[color:var(--app-text-muted,#64748b)] hover:text-[color:var(--app-text,#1e293b)] hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                }`}
                            >
                                <Icon size={14} className={isActive ? "text-white" : "text-slate-400"} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
