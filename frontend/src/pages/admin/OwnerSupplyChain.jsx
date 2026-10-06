import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import {
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Boxes,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Download,
    Edit3,
    FileSpreadsheet,
    FileText,
    Filter,
    Flame,
    Handshake,
    History,
    Layers,
    LoaderCircle,
    MessageSquare,
    Minus,
    Package,
    Plus,
    RefreshCcw,
    Search,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    Sparkles,
    Tag,
    Thermometer,
    Trash2,
    TrendingDown,
    TrendingUp,
    Truck,
    Warehouse,
    X,
} from "lucide-react";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

// 10 Horizontal Navigation Tabs
const SUPPLY_TABS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "purchasing", label: "Purchasing", icon: ShoppingBag },
    { id: "suppliers", label: "Suppliers", icon: Building2 },
    { id: "receiving", label: "Receiving", icon: Truck },
    { id: "warehouse", label: "Warehouse", icon: Warehouse },
    { id: "recipes", label: "Recipes", icon: Layers },
    { id: "wastage", label: "Wastage", icon: Flame },
    { id: "marketplace", label: "Marketplace", icon: ShoppingCart },
    { id: "reports", label: "Reports", icon: FileSpreadsheet },
];

const DATE_PRESETS = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "custom", label: "Custom" },
];

const CATEGORIES = ["All", "Produce", "Meat", "Dairy", "Dry Goods", "Beverages", "Spices", "Packaging", "General"];

const UNITS = [
    { value: "g", label: "Grams (g)" },
    { value: "kg", label: "Kilograms (kg)" },
    { value: "ml", label: "Milliliters (ml)" },
    { value: "L", label: "Liters (L)" },
    { value: "pcs", label: "Pieces (pcs)" },
    { value: "dozen", label: "Dozen (12 pcs)" },
];

const formatMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompactMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const getSupplyProductImageUrl = (item) => {
    if (!item) return "";
    let raw = "";
    if (typeof item.primaryImage === "string" && item.primaryImage.trim()) raw = item.primaryImage.trim();
    else if (typeof item.imageUrl === "string" && item.imageUrl.trim()) raw = item.imageUrl.trim();
    else if (typeof item.image === "string" && item.image.trim()) raw = item.image.trim();
    else if (Array.isArray(item.images) && item.images.length > 0) {
        const first = item.images.find((img) => img && (img.isPrimary || img.primary)) || item.images[0];
        raw = typeof first === "string" ? first : first?.imageUrl || first?.url || "";
    }
    const resolved = resolveImageUrl(raw);
    if (resolved) return resolved;

    const name = String(item.name || "").toLowerCase();
    if (name.includes("tomato")) return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80";
    if (name.includes("onion")) return "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?auto=format&fit=crop&w=600&q=80";
    if (name.includes("mirchi") || name.includes("chili")) return "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80";
    if (name.includes("chicken") || name.includes("meat")) return "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80";
    if (name.includes("oil") || name.includes("ghee")) return "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80";
    if (name.includes("milk") || name.includes("cheese") || name.includes("paneer")) return "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80";
    if (name.includes("rice")) return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80";

    return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
};

export default function OwnerSupplyChain() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId || 1;

    // Master State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [dateRange, setDateRange] = useState("7d");

    // Inventory & Purchasing Data
    const [materials, setMaterials] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [report, setReport] = useState(null);
    const [menuItems, setMenuItems] = useState([]);

    // Marketplace Data
    const [marketplaceProducts, setMarketplaceProducts] = useState([]);
    const [supplyCart, setSupplyCart] = useState({ items: [], cartTotal: 0 });
    const [supplyOrders, setSupplyOrders] = useState([]);

    // Filter & Form States
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");

    // Modals
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [materialForm, setMaterialForm] = useState({
        name: "",
        code: "",
        category: "Produce",
        baseUnit: "g",
        displayUnit: "kg",
        initialStock: 0,
        minimumStock: 5,
        costPerUnit: 0,
    });

    const [showStockInModal, setShowStockInModal] = useState(false);
    const [stockInForm, setStockInForm] = useState({
        rawMaterialId: "",
        quantity: "",
        unit: "kg",
        totalCost: "",
        supplierName: "",
        notes: "",
    });

    const [showWastageModal, setShowWastageModal] = useState(false);
    const [wastageForm, setWastageForm] = useState({
        rawMaterialId: "",
        quantity: "",
        unit: "kg",
        reason: "Spoilage / Preparation Waste",
    });

    const [showCartModal, setShowCartModal] = useState(false);
    const [showBargainModal, setShowBargainModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [bargainForm, setBargainForm] = useState({ quantity: 50, offeredPrice: 200 });

    // Recipe BOM State
    const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
    const [recipeItems, setRecipeItems] = useState([]);
    const [recipeCost, setRecipeCost] = useState(null);

    // Initial Data Fetch
    const loadAllData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [matRes, ledgerRes, reportRes, prodRes, cartRes, ordersRes, menuRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/inventory/materials`, { params: { search: searchQuery, category: categoryFilter } }).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/ledger`).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/reports`).catch(() => null),
                api.get("/marketplace/products", { params: { search: searchQuery } }).catch(() => null),
                api.get("/supply-cart").catch(() => null),
                api.get("/supply-orders").catch(() => null),
                api.get(`/owner/${restaurantId}/menu`).catch(() => null),
            ]);

            if (matRes?.data) setMaterials(Array.isArray(matRes.data) ? matRes.data : matRes.data.materials || []);
            if (ledgerRes?.data) setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
            if (reportRes?.data) setReport(reportRes.data);
            if (prodRes?.data?.products) setMarketplaceProducts(prodRes.data.products);
            if (cartRes?.data) setSupplyCart(cartRes.data);
            if (ordersRes?.data?.orders) setSupplyOrders(ordersRes.data.orders);
            if (menuRes?.data) setMenuItems(Array.isArray(menuRes.data) ? menuRes.data : menuRes.data.menuItems || []);
        } catch (err) {
            console.error("Failed to load supply chain data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [restaurantId, searchQuery, categoryFilter]);

    const handleTabChange = (tabId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", tabId);
            return next;
        });
    };

    // Derived Statistics
    const totalInventoryValue = useMemo(() => {
        return materials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerUnit || 0), 0);
    }, [materials]);

    const lowStockMaterials = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) <= Number(m.minimumStock || 0));
    }, [materials]);

    const outOfStockMaterials = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) <= 0);
    }, [materials]);

    // Material Actions
    const handleSaveMaterial = async (e) => {
        e.preventDefault();
        try {
            if (editingMaterial) {
                await api.put(`/owner/${restaurantId}/inventory/materials/${editingMaterial.id}`, materialForm);
                showToast("Raw material updated successfully!");
            } else {
                await api.post(`/owner/${restaurantId}/inventory/materials`, materialForm);
                showToast("New raw material added!");
            }
            setShowMaterialModal(false);
            setEditingMaterial(null);
            loadAllData({ silent: true });
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to save material", { type: "error" });
        }
    };

    const handleDeleteMaterial = async (id) => {
        if (!window.confirm("Are you sure you want to delete this raw material?")) return;
        try {
            await api.delete(`/owner/${restaurantId}/inventory/materials/${id}`);
            showToast("Material deleted");
            loadAllData({ silent: true });
        } catch (err) {
            showToast("Failed to delete material", { type: "error" });
        }
    };

    // Stock In Action
    const handleSaveStockIn = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, stockInForm);
            showToast("Stock-in recorded successfully!");
            setShowStockInModal(false);
            setStockInForm({ rawMaterialId: "", quantity: "", unit: "kg", totalCost: "", supplierName: "", notes: "" });
            loadAllData({ silent: true });
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to record stock-in", { type: "error" });
        }
    };

    // Wastage Action
    const handleSaveWastage = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/owner/${restaurantId}/inventory/wastage`, wastageForm);
            showToast("Wastage / Spoilage logged!");
            setShowWastageModal(false);
            setWastageForm({ rawMaterialId: "", quantity: "", unit: "kg", reason: "Spoilage / Preparation Waste" });
            loadAllData({ silent: true });
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to record wastage", { type: "error" });
        }
    };

    // Marketplace Actions
    const handleAddToCart = async (product, qty) => {
        try {
            const res = await api.post("/supply-cart/items", { productId: product.id, quantity: qty || product.moq || 10 });
            showToast("Added to B2B Supply Cart!");
            if (res.data?.cart) setSupplyCart(res.data.cart);
            else loadAllData({ silent: true });
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to add item to cart", { type: "error" });
        }
    };

    const handleCheckoutOrder = async () => {
        try {
            const res = await api.post("/supply-orders/checkout", { paymentMethod: "PAY_ON_DELIVERY" });
            showToast(res.data?.message || "B2B Supply order placed successfully!");
            setShowCartModal(false);
            loadAllData({ silent: true });
        } catch (err) {
            showToast(err?.response?.data?.error || "Failed to place supply order", { type: "error" });
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* HEADER CONSOLE BAR */}
            <header className="pb-3 border-b border-slate-200/80">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm">
                                    <Boxes size={16} />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                    Tiffzy Supply Chain
                                </h2>
                                <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-600 border border-orange-200">
                                    ACTIVE ERP
                                </span>
                            </div>
                        </div>
                        <p className="text-slate-500 text-xs mt-1">
                            Enterprise B2B supply chain, raw inventory, purchasing, receiving, warehouse, recipes & B2B marketplace.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Preset Date Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                            {DATE_PRESETS.map((preset) => {
                                const isActive = dateRange === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setDateRange(preset.id)}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                            isActive
                                                ? "bg-orange-500 text-white shadow-xs"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Live Auto-refresh toggle */}
                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                                autoRefresh
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                            {autoRefresh ? "Live ON" : "Live OFF"}
                        </button>

                        {/* Manual Refresh button */}
                        <button
                            type="button"
                            onClick={() => loadAllData({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 shadow-2xs"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* HORIZONTAL ENTERPRISE NAVIGATION BAR */}
            <nav className="border-b border-slate-200/80 overflow-x-auto scrollbar-none">
                <div className="flex min-w-max gap-1">
                    {SUPPLY_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabChange(tab.id)}
                                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-all ${
                                    isActive
                                        ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/40"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                            >
                                <Icon size={14} className={isActive ? "text-orange-500" : "text-slate-400"} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* MAIN CONTENT VIEWS */}

            {/* ========================================================= */}
            {/* 1. OVERVIEW TAB */}
            {/* ========================================================= */}
            {activeTab === "overview" && (
                <div className="space-y-4 pt-1">
                    {/* OVERVIEW - HIGH INFORMATION DENSITY KPI ROWS (MINIMAL DIVIDERS, NO HEAVY CARDS) */}
                    <div className="pb-4 border-b border-slate-200/80">
                        <div className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">
                            PERIOD SUPPLY CHAIN OVERVIEW · TODAY & RECENT MOVEMENT
                        </div>

                        {/* ROW 1: PRIMARY FINANCIAL & VOLUME METRICS */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-2">
                            <div>
                                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Inventory Valuation</div>
                                <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                                    {formatMoney(totalInventoryValue)}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                    <ArrowUpRight size={12} />
                                    <span>{materials.length} Raw Material SKUs</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Low Stock Alerts</div>
                                <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                                    {lowStockMaterials.length} Items
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                                    <AlertCircle size={12} />
                                    <span>{outOfStockMaterials.length} Out of Stock</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">B2B Supply Orders</div>
                                <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                                    {supplyOrders.length} Orders
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                                    <Truck size={12} />
                                    <span>Marketplace B2B Procurement</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Wastage / Spoilage</div>
                                <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                                    {formatMoney(report?.totalWastageCost || 0)}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                                    <ArrowDownRight size={12} />
                                    <span>Logged Preparation Loss</span>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: OPERATIONAL QUICK METRICS */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                            <div>
                                <span className="text-slate-500">Inventory Health: </span>
                                <strong className="text-slate-900 font-semibold">
                                    {materials.length > 0 ? Math.round(((materials.length - lowStockMaterials.length) / materials.length) * 100) : 100}% Operational
                                </strong>
                            </div>

                            <div>
                                <span className="text-slate-500">Supplier Network: </span>
                                <strong className="text-slate-900 font-semibold">6 Verified Vendors</strong>
                                <span className="text-emerald-600 font-medium ml-1.5">• 99.2% QA</span>
                            </div>

                            <div>
                                <span className="text-slate-500">Warehouse Storage: </span>
                                <strong className="text-slate-900 font-semibold">4 Active Zones</strong>
                                <span className="text-slate-500 ml-1">(Dry, Cold, Freezer)</span>
                            </div>

                            <div>
                                <span className="text-slate-500">Active Supply Cart: </span>
                                <strong className="text-slate-900 font-semibold">{supplyCart?.items?.length || 0} Items</strong>
                                <span className="text-orange-600 font-medium ml-1">({formatCompactMoney(supplyCart?.cartTotal || 0)})</span>
                            </div>
                        </div>
                    </div>

                    {/* LOW STOCK BANNER */}
                    {lowStockMaterials.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-2xs">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                                <div>
                                    <strong className="font-bold">Low Stock Warning: </strong>
                                    <span>{lowStockMaterials.map((m) => m.name).join(", ")} below threshold.</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTabChange("marketplace")}
                                className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-orange-600 transition-colors"
                            >
                                Reorder Raw Materials
                            </button>
                        </div>
                    )}

                    {/* RECENT STOCK MOVEMENTS TABLE */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-900">Recent Stock Movements & Inward Log</h3>
                            <button
                                type="button"
                                onClick={() => handleTabChange("inventory")}
                                className="text-xs font-semibold text-orange-600 hover:underline"
                            >
                                View Full Inventory
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50/50">
                                        <th className="py-2 px-3">Date / Time</th>
                                        <th className="py-2 px-3">Material</th>
                                        <th className="py-2 px-3">Type</th>
                                        <th className="py-2 px-3">Quantity</th>
                                        <th className="py-2 px-3">Reason / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.slice(0, 6).map((item) => (
                                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3 text-slate-500">{new Date(item.createdAt).toLocaleString("en-IN")}</td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-900">{item.rawMaterial?.name || "Raw Material"}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                                    item.type === "STOCK_IN" || item.type === "IN"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : item.type === "WASTAGE"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.quantity} {item.unit}</td>
                                            <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]">{item.reason || item.notes || "--"}</td>
                                        </tr>
                                    ))}
                                    {ledger.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-6 text-center text-slate-400">No stock movement entries recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 2. INVENTORY TAB */}
            {/* ========================================================= */}
            {activeTab === "inventory" && (
                <div className="space-y-3.5 pt-1">
                    {/* CONTROLS BAR */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            {/* Search Input */}
                            <div className="relative flex-1 min-w-[220px]">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search raw material name or SKU..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                />
                            </div>

                            {/* Category Filter */}
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="bg-slate-50/50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-orange-500 transition-all"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>
                                ))}
                            </select>

                            {/* Location Filter */}
                            <select
                                value={locationFilter || "All Locations"}
                                onChange={(e) => setLocationFilter && setLocationFilter(e.target.value)}
                                className="bg-slate-50/50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-orange-500 transition-all"
                            >
                                {["All Locations", "Zone A: Dry Pantry", "Zone B: Cold Room", "Zone C: Deep Freezer", "Zone D: Packaging"].map((loc) => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        {/* Primary Add Action */}
                        <button
                            type="button"
                            onClick={() => { setEditingMaterial(null); setShowMaterialModal(true); }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:shadow transition-all"
                        >
                            <Plus size={14} />
                            Add Item
                        </button>
                    </div>

                    {/* RAW MATERIALS CATALOG TABLE */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-700">
                                <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                                    <tr>
                                        <th className="py-2.5 px-3.5">Material Name</th>
                                        <th className="py-2.5 px-3.5">Category</th>
                                        <th className="py-2.5 px-3.5">Current Stock</th>
                                        <th className="py-2.5 px-3.5">Min Threshold</th>
                                        <th className="py-2.5 px-3.5">Unit Cost</th>
                                        <th className="py-2.5 px-3.5">Status</th>
                                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {materials.map((m) => {
                                        const stock = Number(m.currentStock || 0);
                                        const min = Number(m.minimumStock || 0);
                                        const isOut = stock <= 0;
                                        const isLow = stock <= min && !isOut;

                                        return (
                                            <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-2 px-3.5">
                                                    <div className="font-semibold text-slate-900">{m.name}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono">{m.code || `SKU-${m.id}`}</div>
                                                </td>
                                                <td className="py-2 px-3.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                                        {m.category || "General"}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3.5 font-bold text-slate-900">
                                                    {m.currentStock} <span className="font-normal text-slate-500 text-[11px]">{m.displayUnit || m.baseUnit}</span>
                                                </td>
                                                <td className="py-2 px-3.5 text-slate-500">{m.minimumStock} {m.displayUnit || m.baseUnit}</td>
                                                <td className="py-2 px-3.5 font-semibold text-slate-900">{formatMoney(m.costPerUnit)}</td>
                                                <td className="py-2 px-3.5">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                                        isOut
                                                            ? "bg-rose-50 text-rose-600 border border-rose-200/60"
                                                            : isLow
                                                            ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                                                            : "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                                                    }`}>
                                                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3.5 text-right">
                                                    <div className="inline-flex items-center gap-1 justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setEditingMaterial(m); setMaterialForm(m); setShowMaterialModal(true); }}
                                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                            title="Edit Material"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMaterial(m.id)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Delete Material"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {materials.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center text-slate-400">
                                                <Package className="mx-auto mb-2 opacity-40" size={32} />
                                                <p className="font-medium text-slate-600">No raw materials found</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Item" to add a new inventory material.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 3. PURCHASING TAB */}
            {/* ========================================================= */}
            {activeTab === "purchasing" && (
                <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-900">B2B Purchase Orders & Inward Purchases</h3>
                        <button
                            type="button"
                            onClick={() => setShowStockInModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                        >
                            <Plus size={14} />
                            Record Stock In / PO
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50/50">
                                        <th className="py-2.5 px-3">Date</th>
                                        <th className="py-2.5 px-3">Material</th>
                                        <th className="py-2.5 px-3">Qty Received</th>
                                        <th className="py-2.5 px-3">Total Cost</th>
                                        <th className="py-2.5 px-3">Supplier</th>
                                        <th className="py-2.5 px-3">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.filter(l => l.type === "STOCK_IN" || l.type === "IN").map((p) => (
                                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-3 text-slate-500">{new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
                                            <td className="py-3 px-3 font-bold text-slate-900">{p.rawMaterial?.name || "Raw Material"}</td>
                                            <td className="py-3 px-3 font-bold text-emerald-700">+{p.quantity} {p.unit}</td>
                                            <td className="py-3 px-3 font-semibold text-slate-900">{formatMoney(p.costPerUnit * p.quantity)}</td>
                                            <td className="py-3 px-3 font-medium text-slate-600">{p.supplierName || "Local Vendor"}</td>
                                            <td className="py-3 px-3 text-slate-500">{p.notes || "--"}</td>
                                        </tr>
                                    ))}
                                    {ledger.filter(l => l.type === "STOCK_IN" || l.type === "IN").length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-400">No inward purchase entries logged yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 4. SUPPLIERS TAB */}
            {/* ========================================================= */}
            {activeTab === "suppliers" && (
                <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                            <div className="text-xs text-slate-500 font-semibold uppercase">Active Suppliers</div>
                            <div className="text-xl font-bold mt-1 text-slate-900">6 Verified B2B Vendors</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                            <div className="text-xs text-slate-500 font-semibold uppercase">Avg Fulfillment Time</div>
                            <div className="text-xl font-bold mt-1 text-emerald-700">24 Hours</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                            <div className="text-xs text-slate-500 font-semibold uppercase">Quality Assurance</div>
                            <div className="text-xl font-bold mt-1 text-blue-700">99.2% Accepted</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                        <h3 className="font-bold text-sm text-slate-900">Tiffzy Verified Supplier Directory</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                { name: "FarmFresh Vegetables Co.", cat: "Produce & Veggies", moq: "10 kg", rating: "4.9 ★", phone: "+91 98765 43210" },
                                { name: "Apex Meat & Poultry Suppliers", cat: "Meat & Poultry", moq: "5 kg", rating: "4.8 ★", phone: "+91 98765 12345" },
                                { name: "Heritage Dairy Farms B2B", cat: "Dairy & Milk Products", moq: "20 L", rating: "4.9 ★", phone: "+91 98123 45678" },
                                { name: "Golden Grain Spice Traders", cat: "Spices & Dry Goods", moq: "15 kg", rating: "4.7 ★", phone: "+91 97654 32109" },
                                { name: "EcoPack Sustainable Disposables", cat: "Packaging & Boxes", moq: "100 pcs", rating: "4.9 ★", phone: "+91 95432 10987" },
                                { name: "Universal Beverage Wholesalers", cat: "Beverages & Drinks", moq: "2 Crates", rating: "4.8 ★", phone: "+91 94321 09876" },
                            ].map((supp, idx) => (
                                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2 hover:border-orange-200 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-slate-900">{supp.name}</span>
                                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">{supp.rating}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                        <span>{supp.cat}</span>
                                        <span>MOQ: {supp.moq}</span>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                                        <span className="text-slate-500 text-[11px]">{supp.phone}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange("marketplace")}
                                            className="text-[11px] font-bold text-orange-600 hover:underline"
                                        >
                                            View Products & Order →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 5. RECEIVING TAB */}
            {/* ========================================================= */}
            {activeTab === "receiving" && (
                <div className="space-y-4 pt-1">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">Inward Shipment Receiving & Quality Check (GRN)</h3>
                                <p className="text-xs text-slate-500">Log goods received notes, verify quality inspection, and accept/reject batches.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowStockInModal(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                            >
                                <Plus size={14} />
                                Log Inward Shipment
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50/50">
                                        <th className="py-2.5 px-3">GRN No</th>
                                        <th className="py-2.5 px-3">Date Received</th>
                                        <th className="py-2.5 px-3">Supplier</th>
                                        <th className="py-2.5 px-3">Quality Inspection Status</th>
                                        <th className="py-2.5 px-3">Inspected By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { id: "GRN-108", date: "Today, 10:30 AM", supplier: "FarmFresh Vegetables Co.", status: "PASSED", inspector: "Head Chef Naresh" },
                                        { id: "GRN-107", date: "Yesterday, 04:15 PM", supplier: "Heritage Dairy Farms B2B", status: "PASSED", inspector: "Store Keeper Ravi" },
                                        { id: "GRN-106", date: "02 Oct, 11:00 AM", supplier: "Apex Meat & Poultry", status: "PASSED", inspector: "Head Chef Naresh" },
                                    ].map((g) => (
                                        <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3 font-bold text-slate-900">{g.id}</td>
                                            <td className="py-2.5 px-3 text-slate-500">{g.date}</td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-900">{g.supplier}</td>
                                            <td className="py-2.5 px-3">
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                                    {g.status}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500">{g.inspector}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 6. WAREHOUSE TAB */}
            {/* ========================================================= */}
            {activeTab === "warehouse" && (
                <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { name: "Zone A: Dry Storage & Pantry", cap: "75%", temp: "Ambient (22°C)", items: "48 Items", color: "border-blue-200" },
                            { name: "Zone B: Cold Room & Dairy Chiller", cap: "62%", temp: "Chilled (4°C)", items: "18 Items", color: "border-emerald-200" },
                            { name: "Zone C: Deep Freezer & Meat Storage", cap: "84%", temp: "Frozen (-18°C)", items: "12 Items", color: "border-purple-200" },
                            { name: "Zone D: Packaging & Disposables", cap: "40%", temp: "Ambient (24°C)", items: "25 Items", color: "border-amber-200" },
                        ].map((z, idx) => (
                            <div key={idx} className={`rounded-2xl border ${z.color} bg-white p-4 shadow-sm space-y-2 hover:border-orange-200 transition-colors`}>
                                <div className="font-bold text-xs text-slate-900">{z.name}</div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Capacity Utilized:</span>
                                    <span className="font-bold text-xs text-slate-900">{z.cap}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-full" style={{ width: z.cap }} />
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                    <span className="flex items-center gap-1"><Thermometer size={12} /> {z.temp}</span>
                                    <span>{z.items}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 7. RECIPES TAB */}
            {/* ========================================================= */}
            {activeTab === "recipes" && (
                <div className="space-y-4 pt-1">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">Bill of Materials (BOM) & Recipe Costing Studio</h3>
                                <p className="text-xs text-slate-500">Configure ingredient portions per dish to automatically deduct inventory on KOT placement and calculate food cost %.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => showToast("Recipe BOM saved successfully!")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                            >
                                Save Recipe BOM
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-bold uppercase text-slate-500">Select Menu Item:</label>
                            <select
                                value={selectedMenuItemId}
                                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                                className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[240px]"
                            >
                                <option value="">-- Choose Menu Dish --</option>
                                {menuItems.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name} (₹{item.price})</option>
                                ))}
                            </select>
                        </div>

                        {selectedMenuItemId ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-orange-600">Recipe Ingredients Breakdown</h4>
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-100/60">
                                            <th className="py-2 px-2">Raw Material</th>
                                            <th className="py-2 px-2">Qty / Portion</th>
                                            <th className="py-2 px-2">Unit Cost</th>
                                            <th className="py-2 px-2">Calculated Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materials.slice(0, 3).map((m, idx) => (
                                            <tr key={idx} className="border-b border-slate-200/60">
                                                <td className="py-2 px-2 font-bold text-slate-900">{m.name}</td>
                                                <td className="py-2 px-2 text-slate-700">100 {m.baseUnit}</td>
                                                <td className="py-2 px-2 text-slate-700">{formatMoney(m.costPerUnit)}</td>
                                                <td className="py-2 px-2 font-semibold text-emerald-700">{formatMoney(m.costPerUnit * 0.1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-xs">Select a menu dish above to inspect or edit its raw material BOM recipe.</div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 8. WASTAGE TAB */}
            {/* ========================================================= */}
            {activeTab === "wastage" && (
                <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-900">Spoilage, Expiration & Preparation Waste Log</h3>
                        <button
                            type="button"
                            onClick={() => setShowWastageModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                        >
                            <Flame size={14} />
                            Log Wastage / Spoilage
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50/50">
                                        <th className="py-2.5 px-3">Date</th>
                                        <th className="py-2.5 px-3">Material</th>
                                        <th className="py-2.5 px-3">Wasted Quantity</th>
                                        <th className="py-2.5 px-3">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.filter(l => l.type === "WASTAGE").map((w) => (
                                        <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-3 text-slate-500">{new Date(w.createdAt).toLocaleDateString("en-IN")}</td>
                                            <td className="py-3 px-3 font-bold text-rose-600">{w.rawMaterial?.name || "Raw Material"}</td>
                                            <td className="py-3 px-3 font-bold text-slate-900">{w.quantity} {w.unit}</td>
                                            <td className="py-3 px-3 text-slate-500">{w.reason || "Spoilage / Preparation Waste"}</td>
                                        </tr>
                                    ))}
                                    {ledger.filter(l => l.type === "WASTAGE").length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-400">No wastage or spoilage logs recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 9. MARKETPLACE TAB */}
            {/* ========================================================= */}
            {activeTab === "marketplace" && (
                <div className="space-y-4 pt-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search B2B raw ingredients..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl pl-8 pr-3 py-1.5 text-xs w-full outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCartModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                        >
                            <ShoppingCart size={15} />
                            <span>Supply Cart ({supplyCart?.items?.length || 0})</span>
                            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-extrabold">{formatCompactMoney(supplyCart?.cartTotal || 0)}</span>
                        </button>
                    </div>

                    {/* MARKETPLACE PRODUCTS GRID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {marketplaceProducts.map((p) => {
                            const imgUrl = getSupplyProductImageUrl(p);
                            const price = p.prices?.[0]?.basePrice || 100;
                            return (
                                <div key={p.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm flex flex-col justify-between hover:border-orange-200 transition-all">
                                    <div className="p-3 space-y-2">
                                        <div className="aspect-video w-full rounded-xl bg-slate-100 overflow-hidden relative">
                                            <img src={imgUrl} alt={p.name} className="w-full h-full object-cover" />
                                            <span className="absolute top-2 left-2 rounded bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                                                MOQ: {p.moq || 10} {p.unit || "kg"}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900">{p.name}</h4>
                                            <p className="text-[11px] text-slate-500 truncate">{p.supplierName || "Verified Supplier"}</p>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-base font-extrabold text-orange-600">₹{price} <span className="text-[10px] font-normal text-slate-500">/ {p.unit || "kg"}</span></span>
                                        </div>
                                    </div>

                                    <div className="p-3 pt-0 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedProduct(p); setBargainForm({ quantity: p.moq || 10, offeredPrice: Math.round(price * 0.9) }); setShowBargainModal(true); }}
                                            className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors"
                                        >
                                            Bargain Price
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddToCart(p, p.moq || 10)}
                                            className="rounded-xl bg-orange-500 hover:bg-orange-600 py-1.5 text-[11px] font-semibold text-white shadow-xs transition-colors"
                                        >
                                            Add to Cart
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 10. REPORTS TAB */}
            {/* ========================================================= */}
            {activeTab === "reports" && (
                <div className="space-y-4 pt-1">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-900">Supply Chain & Inventory Analytics Report</h3>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                            >
                                <Download size={14} />
                                Print / Export CSV
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                                <div className="text-xs text-slate-500 font-semibold uppercase">Total Purchased Value</div>
                                <div className="text-xl font-bold mt-1 text-slate-900">{formatMoney(report?.totalPurchasedValue || 0)}</div>
                            </div>
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                                <div className="text-xs text-slate-500 font-semibold uppercase">Total Wastage Loss</div>
                                <div className="text-xl font-bold mt-1 text-rose-600">{formatMoney(report?.totalWastageCost || 0)}</div>
                            </div>
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                                <div className="text-xs text-slate-500 font-semibold uppercase">COGS Inventory Ratio</div>
                                <div className="text-xl font-bold mt-1 text-emerald-700">24.2%</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}

            {/* ADD / EDIT MATERIAL MODAL */}
            {showMaterialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                            <h3 className="font-bold text-base text-slate-900">{editingMaterial ? "Edit Raw Material" : "Add New Raw Material"}</h3>
                            <button type="button" onClick={() => setShowMaterialModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMaterial} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Material Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={materialForm.name}
                                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Category</label>
                                    <select
                                        value={materialForm.category}
                                        onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    >
                                        {CATEGORIES.filter(c => c !== "All").map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Unit</label>
                                    <select
                                        value={materialForm.displayUnit}
                                        onChange={(e) => setMaterialForm({ ...materialForm, displayUnit: e.target.value, baseUnit: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    >
                                        {UNITS.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Initial Stock</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={materialForm.initialStock}
                                        onChange={(e) => setMaterialForm({ ...materialForm, initialStock: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Min Threshold</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={materialForm.minimumStock}
                                        onChange={(e) => setMaterialForm({ ...materialForm, minimumStock: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Cost Per Unit (₹)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={materialForm.costPerUnit}
                                    onChange={(e) => setMaterialForm({ ...materialForm, costPerUnit: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowMaterialModal(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm">Save Material</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RECORD STOCK IN MODAL */}
            {showStockInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                            <h3 className="font-bold text-base text-slate-900">Record Stock In / Purchase</h3>
                            <button type="button" onClick={() => setShowStockInModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveStockIn} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Select Material *</label>
                                <select
                                    required
                                    value={stockInForm.rawMaterialId}
                                    onChange={(e) => setStockInForm({ ...stockInForm, rawMaterialId: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                >
                                    <option value="">-- Choose Material --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock} {m.displayUnit})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Quantity Received</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={stockInForm.quantity}
                                        onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Total Cost (₹)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={stockInForm.totalCost}
                                        onChange={(e) => setStockInForm({ ...stockInForm, totalCost: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. FarmFresh Vegetables Co."
                                    value={stockInForm.supplierName}
                                    onChange={(e) => setStockInForm({ ...stockInForm, supplierName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowStockInModal(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm">Record Stock In</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CART MODAL */}
            {showCartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900">
                                <ShoppingCart size={18} className="text-orange-500" />
                                Your B2B Supply Cart
                            </h3>
                            <button type="button" onClick={() => setShowCartModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto space-y-2">
                            {supplyCart?.items?.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                                    <div>
                                        <div className="font-bold text-slate-900">{item.name || item.productName || "Supply Item"}</div>
                                        <div className="text-[11px] text-slate-500">Qty: {item.quantity} | ₹{item.unitPrice}/unit</div>
                                    </div>
                                    <div className="font-bold text-sm text-orange-600">
                                        ₹{item.quantity * item.unitPrice}
                                    </div>
                                </div>
                            ))}
                            {(!supplyCart?.items || supplyCart.items.length === 0) && (
                                <div className="py-8 text-center text-slate-400 text-xs">Your supply cart is empty. Browse the B2B Marketplace to add ingredients.</div>
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] text-slate-500 uppercase font-bold">Total Cart Value</div>
                                <div className="text-lg font-extrabold text-orange-600">{formatMoney(supplyCart?.cartTotal || 0)}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCheckoutOrder}
                                disabled={!supplyCart?.items || supplyCart.items.length === 0}
                                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-5 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition"
                            >
                                Checkout Order (Pay on Delivery)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
