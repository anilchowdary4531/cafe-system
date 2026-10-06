import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Package,
    ShoppingBag,
    Users,
    Warehouse,
    ChefHat,
    Trash2,
    Store,
    Handshake,
    CreditCard,
    BarChart3,
    Settings,
    AlertTriangle,
    Clock,
    Activity,
    SlidersHorizontal,
    IndianRupee,
    ClipboardPlus,
    PackageCheck,
    Undo2,
    Receipt,
    ArrowLeftRight,
    ClipboardCheck
} from "lucide-react";

export const SUPPLY_CHAIN_MAIN_NAV = [
    { id: "overview", label: "Overview", path: "/owner/supply-chain", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", path: "/owner/supply-chain/inventory", icon: Package, matchPrefixes: ["/owner/supply-chain/inventory"] },
    { id: "purchasing", label: "Purchasing", path: "/owner/supply-chain/purchase-orders", icon: ShoppingBag, matchPrefixes: ["/owner/supply-chain/purchase-requests", "/owner/supply-chain/purchase-orders", "/owner/supply-chain/receiving", "/owner/supply-chain/purchase-returns", "/owner/supply-chain/invoices"] },
    { id: "suppliers", label: "Suppliers", path: "/owner/supply-chain/suppliers", icon: Users },
    { id: "warehouse", label: "Warehouse", path: "/owner/supply-chain/warehouse", icon: Warehouse, matchPrefixes: ["/owner/supply-chain/warehouse", "/owner/supply-chain/transfers", "/owner/supply-chain/stock-counts"] },
    { id: "recipes", label: "Recipes", path: "/owner/supply-chain/recipes", icon: ChefHat, matchPrefixes: ["/owner/supply-chain/recipes", "/owner/supply-chain/consumption"] },
    { id: "wastage", label: "Wastage", path: "/owner/supply-chain/wastage", icon: Trash2 },
    { id: "marketplace", label: "Marketplace", path: "/owner/supply-chain/marketplace", icon: Store },
    { id: "negotiations", label: "Negotiations", path: "/owner/supply-chain/negotiations", icon: Handshake },
    { id: "payments", label: "Payments", path: "/owner/supply-chain/payments", icon: CreditCard },
    { id: "intelligence", label: "Intelligence", path: "/owner/supply-chain/reports", icon: BarChart3 },
    { id: "settings", label: "Settings", path: "/owner/supply-chain/settings", icon: Settings }
];

// Sub-groups definition
export const INVENTORY_SUB_NAV = [
    { id: "all", label: "All Items", path: "/owner/supply-chain/inventory", icon: Package, exact: true },
    { id: "low-stock", label: "Low Stock", path: "/owner/supply-chain/inventory/low-stock", icon: AlertTriangle },
    { id: "expiry", label: "Expiry & Batches", path: "/owner/supply-chain/inventory/expiry", icon: Clock },
    { id: "movements", label: "Movements", path: "/owner/supply-chain/inventory/movements", icon: Activity },
    { id: "adjustments", label: "Adjustments", path: "/owner/supply-chain/inventory/adjustments", icon: SlidersHorizontal },
    { id: "valuation", label: "Valuation", path: "/owner/supply-chain/inventory/valuation", icon: IndianRupee },
];

export const PURCHASING_SUB_NAV = [
    { id: "po", label: "Purchase Orders", path: "/owner/supply-chain/purchase-orders", icon: ShoppingBag },
    { id: "pr", label: "Purchase Requests", path: "/owner/supply-chain/purchase-requests", icon: ClipboardPlus },
    { id: "grn", label: "Receiving (GRN)", path: "/owner/supply-chain/receiving", icon: PackageCheck },
    { id: "returns", label: "Returns", path: "/owner/supply-chain/purchase-returns", icon: Undo2 },
    { id: "invoices", label: "Invoices", path: "/owner/supply-chain/invoices", icon: Receipt },
];

export const WAREHOUSE_SUB_NAV = [
    { id: "locations", label: "Locations", path: "/owner/supply-chain/warehouse", icon: Warehouse },
    { id: "transfers", label: "Transfers", path: "/owner/supply-chain/transfers", icon: ArrowLeftRight },
    { id: "counts", label: "Stock Counts", path: "/owner/supply-chain/stock-counts", icon: ClipboardCheck },
];

export const RECIPES_SUB_NAV = [
    { id: "all-recipes", label: "All Recipes", path: "/owner/supply-chain/recipes", icon: ChefHat },
    { id: "consumption", label: "Consumption", path: "/owner/supply-chain/consumption", icon: Activity },
];

// Backwards compatibility export
export const SUPPLY_CHAIN_NAV_ITEMS = SUPPLY_CHAIN_MAIN_NAV;

export default function SupplyChainSubNav() {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine current sub-nav items based on active route
    const currentPath = location.pathname;

    let activeSubNav = null;
    if (currentPath.startsWith("/owner/supply-chain/inventory")) {
        activeSubNav = INVENTORY_SUB_NAV;
    } else if (
        currentPath.startsWith("/owner/supply-chain/purchase") ||
        currentPath.startsWith("/owner/supply-chain/receiving") ||
        currentPath.startsWith("/owner/supply-chain/invoices")
    ) {
        activeSubNav = PURCHASING_SUB_NAV;
    } else if (
        currentPath.startsWith("/owner/supply-chain/warehouse") ||
        currentPath.startsWith("/owner/supply-chain/transfers") ||
        currentPath.startsWith("/owner/supply-chain/stock-counts")
    ) {
        activeSubNav = WAREHOUSE_SUB_NAV;
    } else if (
        currentPath.startsWith("/owner/supply-chain/recipes") ||
        currentPath.startsWith("/owner/supply-chain/consumption")
    ) {
        activeSubNav = RECIPES_SUB_NAV;
    }

    return (
        <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 mb-5 shadow-xs transition-colors">
            {/* Tier 1: Main Category Tabs */}
            <div className="max-w-7xl mx-auto px-2 sm:px-4">
                <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
                    {SUPPLY_CHAIN_MAIN_NAV.map((item) => {
                        const Icon = item.icon;
                        const isOverview = item.path === "/owner/supply-chain";
                        const isMainActive = isOverview
                            ? currentPath === "/owner/supply-chain" || currentPath === "/owner/supply-chain/"
                            : item.matchPrefixes
                            ? item.matchPrefixes.some((prefix) => currentPath.startsWith(prefix))
                            : currentPath.startsWith(item.path);

                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.path)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    isMainActive
                                        ? "bg-orange-500 text-white font-bold shadow-xs"
                                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                }`}
                            >
                                <Icon size={14} className={isMainActive ? "text-white" : "text-slate-400"} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tier 2: Sub-View Tabs (Rendered conditionally when section has sub-views) */}
            {activeSubNav && (
                <div className="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800/80 px-2 sm:px-4 py-1.5">
                    <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                        {activeSubNav.map((subItem) => {
                            const SubIcon = subItem.icon;
                            const isSubActive = subItem.exact
                                ? currentPath === subItem.path
                                : currentPath.startsWith(subItem.path);

                            return (
                                <button
                                    key={subItem.id}
                                    onClick={() => navigate(subItem.path)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                                        isSubActive
                                            ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-700/50"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
                                    }`}
                                >
                                    <SubIcon size={12} className={isSubActive ? "text-amber-700 dark:text-amber-300" : "text-slate-400"} />
                                    <span>{subItem.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
