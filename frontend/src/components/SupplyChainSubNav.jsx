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
    Activity
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
    { id: "reports", label: "Reports & Intel", path: "/owner/supply-chain/reports", icon: BarChart3 }
];

export default function SupplyChainSubNav() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 mb-6 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <nav className="flex items-center gap-1 overflow-x-auto py-2.5 scrollbar-none">
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
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-orange-500 text-slate-950 font-bold shadow-md shadow-orange-500/20"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                                }`}
                            >
                                <Icon size={15} className={isActive ? "text-slate-950 stroke-[2.5]" : "text-slate-400"} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
