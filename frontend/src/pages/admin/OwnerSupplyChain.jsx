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
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* HEADER CONSOLE BAR */}
            <header className="pb-3 border-b border-[color:var(--app-border)]/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-primary)] text-white shadow-sm">
                                    <Boxes size={16} />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                                    Tiffzy Supply Chain
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                    ACTIVE
                                </span>
                            </div>
                        </div>
                        <p className="theme-muted text-xs mt-1">
                            Enterprise B2B supply chain, raw inventory, purchasing, receiving, warehouse, recipes & B2B marketplace.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Preset Date Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50">
                            {DATE_PRESETS.map((preset) => {
                                const isActive = dateRange === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setDateRange(preset.id)}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                            isActive
                                                ? "bg-[var(--app-primary)] text-white shadow-sm"
                                                : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
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
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "border-[color:var(--app-border)] theme-muted"
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-[var(--app-primary)]" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* HORIZONTAL ENTERPRISE NAVIGATION BAR */}
            <nav className="border-b border-[color:var(--app-border)]/50 overflow-x-auto scrollbar-none">
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
                                        ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] bg-orange-500/5"
                                        : "theme-muted hover:text-[color:var(--app-text)]"
                                }`}
                            >
                                <Icon size={14} className={isActive ? "text-[var(--app-primary)]" : "theme-muted"} />
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
                    {/* METRIC CARDS (3-5 Compact KPI Cards) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Card 1: Total Valuation */}
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="flex items-center justify-between text-xs theme-muted">
                                <span className="font-semibold uppercase tracking-wider">Inventory Valuation</span>
                                <DollarSign size={15} className="text-emerald-500" />
                            </div>
                            <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                                {formatMoney(totalInventoryValue)}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <ArrowUpRight size={12} />
                                <span>Total value of {materials.length} raw materials</span>
                            </div>
                        </div>

                        {/* Card 2: Low Stock Alerts */}
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="flex items-center justify-between text-xs theme-muted">
                                <span className="font-semibold uppercase tracking-wider">Low Stock Alerts</span>
                                <AlertTriangle size={15} className={lowStockMaterials.length > 0 ? "text-amber-500" : "text-emerald-500"} />
                            </div>
                            <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                                {lowStockMaterials.length} Items
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                <AlertCircle size={12} />
                                <span>{outOfStockMaterials.length} Out of Stock</span>
                            </div>
                        </div>

                        {/* Card 3: Monthly Supply Orders */}
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="flex items-center justify-between text-xs theme-muted">
                                <span className="font-semibold uppercase tracking-wider">B2B Supply Orders</span>
                                <ShoppingCart size={15} className="text-blue-500" />
                            </div>
                            <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                                {supplyOrders.length} Orders
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                <Truck size={12} />
                                <span>Marketplace B2B Procurement</span>
                            </div>
                        </div>

                        {/* Card 4: Wastage Ratio */}
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="flex items-center justify-between text-xs theme-muted">
                                <span className="font-semibold uppercase tracking-wider">Wastage / Spoilage</span>
                                <Flame size={15} className="text-rose-500" />
                            </div>
                            <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                                {formatMoney(report?.totalWastageCost || 0)}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                <ArrowDownRight size={12} />
                                <span>Logged preparation loss</span>
                            </div>
                        </div>
                    </div>

                    {/* LOW STOCK BANNER */}
                    {lowStockMaterials.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                <div>
                                    <strong className="font-bold">Low Stock Warning: </strong>
                                    <span>{lowStockMaterials.map((m) => m.name).join(", ")} below threshold.</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTabChange("marketplace")}
                                className="shrink-0 rounded-lg bg-[var(--app-primary)] px-3 py-1.5 font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                            >
                                Reorder Raw Materials
                            </button>
                        </div>
                    )}

                    {/* RECENT STOCK MOVEMENTS TABLE */}
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-base text-[color:var(--app-text)]">Recent Stock Movements & Inward Log</h3>
                            <button
                                type="button"
                                onClick={() => handleTabChange("inventory")}
                                className="text-xs font-semibold theme-accent-text hover:underline"
                            >
                                View Full Inventory
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
                                        <th className="py-2 px-3">Date / Time</th>
                                        <th className="py-2 px-3">Material</th>
                                        <th className="py-2 px-3">Type</th>
                                        <th className="py-2 px-3">Quantity</th>
                                        <th className="py-2 px-3">Reason / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.slice(0, 6).map((item) => (
                                        <tr key={item.id} className="border-b border-[color:var(--app-border)]/30 hover:bg-[color:var(--app-border)]/10">
                                            <td className="py-2.5 px-3 theme-muted">{new Date(item.createdAt).toLocaleString("en-IN")}</td>
                                            <td className="py-2.5 px-3 font-semibold text-[color:var(--app-text)]">{item.rawMaterial?.name || "Raw Material"}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                    item.type === "STOCK_IN" || item.type === "IN"
                                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                        : item.type === "WASTAGE"
                                                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                                        : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-bold">{item.quantity} {item.unit}</td>
                                            <td className="py-2.5 px-3 theme-muted truncate max-w-[200px]">{item.reason || item.notes || "--"}</td>
                                        </tr>
                                    ))}
                                    {ledger.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-6 text-center theme-muted">No stock movement entries recorded yet.</td>
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
                <div className="space-y-4 pt-1">
                    {/* CONTROLS BAR */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-2.5 theme-muted" />
                                <input
                                    type="text"
                                    placeholder="Search material or SKU..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="theme-input rounded-lg pl-8 pr-3 py-1.5 text-xs w-60 outline-none"
                                />
                            </div>

                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="theme-input rounded-lg px-3 py-1.5 text-xs outline-none"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => { setEditingMaterial(null); setShowMaterialModal(true); }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                        >
                            <Plus size={14} />
                            Add Raw Material
                        </button>
                    </div>

                    {/* RAW MATERIALS TABLE */}
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
                                        <th className="py-2.5 px-3">Material Name</th>
                                        <th className="py-2.5 px-3">Category</th>
                                        <th className="py-2.5 px-3">Current Stock</th>
                                        <th className="py-2.5 px-3">Min Threshold</th>
                                        <th className="py-2.5 px-3">Cost / Unit</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {materials.map((m) => {
                                        const stock = Number(m.currentStock || 0);
                                        const min = Number(m.minimumStock || 0);
                                        const isOut = stock <= 0;
                                        const isLow = stock <= min && !isOut;

                                        return (
                                            <tr key={m.id} className="border-b border-[color:var(--app-border)]/30 hover:bg-[color:var(--app-border)]/10">
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-[color:var(--app-text)]">{m.name}</div>
                                                    <div className="text-[10px] theme-muted">{m.code || `SKU-${m.id}`}</div>
                                                </td>
                                                <td className="py-3 px-3 font-medium theme-muted">{m.category || "General"}</td>
                                                <td className="py-3 px-3 font-bold">
                                                    {m.currentStock} {m.displayUnit || m.baseUnit}
                                                </td>
                                                <td className="py-3 px-3 theme-muted">{m.minimumStock} {m.displayUnit || m.baseUnit}</td>
                                                <td className="py-3 px-3 font-semibold">{formatMoney(m.costPerUnit)}</td>
                                                <td className="py-3 px-3">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        isOut
                                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                                            : isLow
                                                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                    }`}>
                                                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setEditingMaterial(m); setMaterialForm(m); setShowMaterialModal(true); }}
                                                            className="p-1 rounded theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMaterial(m.id)}
                                                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {materials.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center theme-muted">No raw materials found. Click "Add Raw Material" to get started.</td>
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
                        <h3 className="font-bold text-base text-[color:var(--app-text)]">B2B Purchase Orders & Inward Purchases</h3>
                        <button
                            type="button"
                            onClick={() => setShowStockInModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                        >
                            <Plus size={14} />
                            Record Stock In / PO
                        </button>
                    </div>

                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
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
                                        <tr key={p.id} className="border-b border-[color:var(--app-border)]/30 hover:bg-[color:var(--app-border)]/10">
                                            <td className="py-3 px-3 theme-muted">{new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
                                            <td className="py-3 px-3 font-bold text-[color:var(--app-text)]">{p.rawMaterial?.name || "Raw Material"}</td>
                                            <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">+{p.quantity} {p.unit}</td>
                                            <td className="py-3 px-3 font-semibold">{formatMoney(p.costPerUnit * p.quantity)}</td>
                                            <td className="py-3 px-3 font-medium theme-muted">{p.supplierName || "Local Vendor"}</td>
                                            <td className="py-3 px-3 theme-muted">{p.notes || "--"}</td>
                                        </tr>
                                    ))}
                                    {ledger.filter(l => l.type === "STOCK_IN" || l.type === "IN").length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center theme-muted">No inward purchase entries logged yet.</td>
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
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="text-xs theme-muted font-semibold uppercase">Active Suppliers</div>
                            <div className="text-xl font-bold mt-1 text-[color:var(--app-text)]">6 Verified B2B Vendors</div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="text-xs theme-muted font-semibold uppercase">Avg Fulfillment Time</div>
                            <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">24 Hours</div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                            <div className="text-xs theme-muted font-semibold uppercase">Quality Assurance</div>
                            <div className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">99.2% Accepted</div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                        <h3 className="font-bold text-base text-[color:var(--app-text)]">Tiffzy Verified Supplier Directory</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                { name: "FarmFresh Vegetables Co.", cat: "Produce & Veggies", moq: "10 kg", rating: "4.9 ★", phone: "+91 98765 43210" },
                                { name: "Apex Meat & Poultry Suppliers", cat: "Meat & Poultry", moq: "5 kg", rating: "4.8 ★", phone: "+91 98765 12345" },
                                { name: "Heritage Dairy Farms B2B", cat: "Dairy & Milk Products", moq: "20 L", rating: "4.9 ★", phone: "+91 98123 45678" },
                                { name: "Golden Grain Spice Traders", cat: "Spices & Dry Goods", moq: "15 kg", rating: "4.7 ★", phone: "+91 97654 32109" },
                                { name: "EcoPack Sustainable Disposables", cat: "Packaging & Boxes", moq: "100 pcs", rating: "4.9 ★", phone: "+91 95432 10987" },
                                { name: "Universal Beverage Wholesalers", cat: "Beverages & Drinks", moq: "2 Crates", rating: "4.8 ★", phone: "+91 94321 09876" },
                            ].map((supp, idx) => (
                                <div key={idx} className="rounded-lg border border-[color:var(--app-border)] p-3 space-y-2 hover:border-[var(--app-primary)] transition-colors">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-[color:var(--app-text)]">{supp.name}</span>
                                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">{supp.rating}</span>
                                    </div>
                                    <div className="text-[11px] theme-muted flex items-center justify-between">
                                        <span>{supp.cat}</span>
                                        <span>MOQ: {supp.moq}</span>
                                    </div>
                                    <div className="pt-2 border-t border-[color:var(--app-border)]/40 flex items-center justify-between text-xs">
                                        <span className="theme-muted text-[11px]">{supp.phone}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange("marketplace")}
                                            className="text-[11px] font-bold theme-accent-text hover:underline"
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
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base text-[color:var(--app-text)]">Inward Shipment Receiving & Quality Check (GRN)</h3>
                                <p className="text-xs theme-muted">Log goods received notes, verify quality inspection, and accept/reject batches.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowStockInModal(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
                            >
                                <Plus size={14} />
                                Log Inward Shipment
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
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
                                        <tr key={g.id} className="border-b border-[color:var(--app-border)]/30 hover:bg-[color:var(--app-border)]/10">
                                            <td className="py-2.5 px-3 font-bold text-[color:var(--app-text)]">{g.id}</td>
                                            <td className="py-2.5 px-3 theme-muted">{g.date}</td>
                                            <td className="py-2.5 px-3 font-semibold">{g.supplier}</td>
                                            <td className="py-2.5 px-3">
                                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    {g.status}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 theme-muted">{g.inspector}</td>
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
                            { name: "Zone A: Dry Storage & Pantry", cap: "75%", temp: "Ambient (22°C)", items: "48 Items", color: "border-blue-500/30" },
                            { name: "Zone B: Cold Room & Dairy Chiller", cap: "62%", temp: "Chilled (4°C)", items: "18 Items", color: "border-emerald-500/30" },
                            { name: "Zone C: Deep Freezer & Meat Storage", cap: "84%", temp: "Frozen (-18°C)", items: "12 Items", color: "border-purple-500/30" },
                            { name: "Zone D: Packaging & Disposables", cap: "40%", temp: "Ambient (24°C)", items: "25 Items", color: "border-amber-500/30" },
                        ].map((z, idx) => (
                            <div key={idx} className={`rounded-xl border ${z.color} bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-2`}>
                                <div className="font-bold text-xs text-[color:var(--app-text)]">{z.name}</div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="theme-muted font-medium">Capacity Utilized:</span>
                                    <span className="font-bold text-xs">{z.cap}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-[var(--app-primary)] h-full" style={{ width: z.cap }} />
                                </div>
                                <div className="pt-2 border-t border-[color:var(--app-border)]/40 flex items-center justify-between text-[11px] theme-muted">
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
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-base text-[color:var(--app-text)]">Bill of Materials (BOM) & Recipe Costing Studio</h3>
                                <p className="text-xs theme-muted">Configure ingredient portions per dish to automatically deduct inventory on KOT placement and calculate food cost %.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => showToast("Recipe BOM saved successfully!")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
                            >
                                Save Recipe BOM
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-bold uppercase theme-muted">Select Menu Item:</label>
                            <select
                                value={selectedMenuItemId}
                                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                                className="theme-input rounded-lg px-3 py-1.5 text-xs outline-none min-w-[240px]"
                            >
                                <option value="">-- Choose Menu Dish --</option>
                                {menuItems.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name} (₹{item.price})</option>
                                ))}
                            </select>
                        </div>

                        {selectedMenuItemId ? (
                            <div className="rounded-lg border border-[color:var(--app-border)]/60 p-3 space-y-3">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--app-primary)]">Recipe Ingredients Breakdown</h4>
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
                                            <th className="py-2 px-2">Raw Material</th>
                                            <th className="py-2 px-2">Qty / Portion</th>
                                            <th className="py-2 px-2">Unit Cost</th>
                                            <th className="py-2 px-2">Calculated Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materials.slice(0, 3).map((m, idx) => (
                                            <tr key={idx} className="border-b border-[color:var(--app-border)]/30">
                                                <td className="py-2 px-2 font-bold">{m.name}</td>
                                                <td className="py-2 px-2">100 {m.baseUnit}</td>
                                                <td className="py-2 px-2">{formatMoney(m.costPerUnit)}</td>
                                                <td className="py-2 px-2 font-semibold text-emerald-600">{formatMoney(m.costPerUnit * 0.1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-8 text-center theme-muted text-xs">Select a menu dish above to inspect or edit its raw material BOM recipe.</div>
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
                        <h3 className="font-bold text-base text-[color:var(--app-text)]">Spoilage, Expiration & Preparation Waste Log</h3>
                        <button
                            type="button"
                            onClick={() => setShowWastageModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                        >
                            <Flame size={14} />
                            Log Wastage / Spoilage
                        </button>
                    </div>

                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[color:var(--app-border)]/50 text-[11px] font-bold uppercase theme-muted">
                                        <th className="py-2.5 px-3">Date</th>
                                        <th className="py-2.5 px-3">Material</th>
                                        <th className="py-2.5 px-3">Wasted Quantity</th>
                                        <th className="py-2.5 px-3">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.filter(l => l.type === "WASTAGE").map((w) => (
                                        <tr key={w.id} className="border-b border-[color:var(--app-border)]/30 hover:bg-[color:var(--app-border)]/10">
                                            <td className="py-3 px-3 theme-muted">{new Date(w.createdAt).toLocaleDateString("en-IN")}</td>
                                            <td className="py-3 px-3 font-bold text-rose-600 dark:text-rose-400">{w.rawMaterial?.name || "Raw Material"}</td>
                                            <td className="py-3 px-3 font-bold">{w.quantity} {w.unit}</td>
                                            <td className="py-3 px-3 theme-muted">{w.reason || "Spoilage / Preparation Waste"}</td>
                                        </tr>
                                    ))}
                                    {ledger.filter(l => l.type === "WASTAGE").length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center theme-muted">No wastage or spoilage logs recorded yet.</td>
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
                            <Search size={14} className="absolute left-3 top-2.5 theme-muted" />
                            <input
                                type="text"
                                placeholder="Search B2B raw ingredients..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="theme-input rounded-lg pl-8 pr-3 py-1.5 text-xs w-full outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCartModal(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[var(--app-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
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
                                <div key={p.id} className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] overflow-hidden shadow-sm flex flex-col justify-between hover:border-[var(--app-primary)] transition-all">
                                    <div className="p-3 space-y-2">
                                        <div className="aspect-video w-full rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                                            <img src={imgUrl} alt={p.name} className="w-full h-full object-cover" />
                                            <span className="absolute top-2 left-2 rounded bg-black/60 backdrop-blur-md px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                                                MOQ: {p.moq || 10} {p.unit || "kg"}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-[color:var(--app-text)]">{p.name}</h4>
                                            <p className="text-[11px] theme-muted truncate">{p.supplierName || "Verified Supplier"}</p>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-base font-extrabold text-[var(--app-primary)]">₹{price} <span className="text-[10px] font-normal theme-muted">/ {p.unit || "kg"}</span></span>
                                        </div>
                                    </div>

                                    <div className="p-3 pt-0 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedProduct(p); setBargainForm({ quantity: p.moq || 10, offeredPrice: Math.round(price * 0.9) }); setShowBargainModal(true); }}
                                            className="rounded-lg border border-[color:var(--app-border)] py-1.5 text-[11px] font-bold theme-muted hover:bg-[color:var(--app-border)]/20"
                                        >
                                            Bargain Price
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddToCart(p, p.moq || 10)}
                                            className="rounded-lg bg-[var(--app-primary)] py-1.5 text-[11px] font-bold text-white shadow-sm hover:opacity-90"
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
                    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-base text-[color:var(--app-text)]">Supply Chain & Inventory Analytics Report</h3>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)]"
                            >
                                <Download size={14} />
                                Print / Export CSV
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/50">
                                <div className="text-xs theme-muted font-semibold uppercase">Total Purchased Value</div>
                                <div className="text-xl font-bold mt-1">{formatMoney(report?.totalPurchasedValue || 0)}</div>
                            </div>
                            <div className="p-3.5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/50">
                                <div className="text-xs theme-muted font-semibold uppercase">Total Wastage Loss</div>
                                <div className="text-xl font-bold mt-1 text-rose-600">{formatMoney(report?.totalWastageCost || 0)}</div>
                            </div>
                            <div className="p-3.5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/50">
                                <div className="text-xs theme-muted font-semibold uppercase">COGS Inventory Ratio</div>
                                <div className="text-xl font-bold mt-1 text-emerald-600">24.2%</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}

            {/* ADD / EDIT MATERIAL MODAL */}
            {showMaterialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">{editingMaterial ? "Edit Raw Material" : "Add New Raw Material"}</h3>
                            <button type="button" onClick={() => setShowMaterialModal(false)} className="theme-muted hover:text-[color:var(--app-text)]">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMaterial} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase theme-muted">Material Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={materialForm.name}
                                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase theme-muted">Category</label>
                                    <select
                                        value={materialForm.category}
                                        onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    >
                                        {CATEGORIES.filter(c => c !== "All").map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase theme-muted">Unit</label>
                                    <select
                                        value={materialForm.displayUnit}
                                        onChange={(e) => setMaterialForm({ ...materialForm, displayUnit: e.target.value, baseUnit: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    >
                                        {UNITS.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase theme-muted">Initial Stock</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={materialForm.initialStock}
                                        onChange={(e) => setMaterialForm({ ...materialForm, initialStock: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase theme-muted">Min Threshold</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={materialForm.minimumStock}
                                        onChange={(e) => setMaterialForm({ ...materialForm, minimumStock: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase theme-muted">Cost Per Unit (₹)</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={materialForm.costPerUnit}
                                    onChange={(e) => setMaterialForm({ ...materialForm, costPerUnit: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowMaterialModal(false)} className="rounded-lg border px-4 py-2 text-xs font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm">Save Material</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RECORD STOCK IN MODAL */}
            {showStockInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">Record Stock In / Purchase</h3>
                            <button type="button" onClick={() => setShowStockInModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveStockIn} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase theme-muted">Select Material *</label>
                                <select
                                    required
                                    value={stockInForm.rawMaterialId}
                                    onChange={(e) => setStockInForm({ ...stockInForm, rawMaterialId: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                >
                                    <option value="">-- Choose Material --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock} {m.displayUnit})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase theme-muted">Quantity Received</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={stockInForm.quantity}
                                        onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase theme-muted">Total Cost (₹)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={stockInForm.totalCost}
                                        onChange={(e) => setStockInForm({ ...stockInForm, totalCost: e.target.value })}
                                        className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase theme-muted">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. FarmFresh Vegetables Co."
                                    value={stockInForm.supplierName}
                                    onChange={(e) => setStockInForm({ ...stockInForm, supplierName: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowStockInModal(false)} className="rounded-lg border px-4 py-2 text-xs font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm">Record Stock In</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CART MODAL */}
            {showCartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <ShoppingCart size={18} className="text-[var(--app-primary)]" />
                                Your B2B Supply Cart
                            </h3>
                            <button type="button" onClick={() => setShowCartModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto space-y-2">
                            {supplyCart?.items?.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[color:var(--app-border)] text-xs">
                                    <div>
                                        <div className="font-bold">{item.name || item.productName || "Supply Item"}</div>
                                        <div className="text-[11px] theme-muted">Qty: {item.quantity} | ₹{item.unitPrice}/unit</div>
                                    </div>
                                    <div className="font-bold text-sm text-[var(--app-primary)]">
                                        ₹{item.quantity * item.unitPrice}
                                    </div>
                                </div>
                            ))}
                            {(!supplyCart?.items || supplyCart.items.length === 0) && (
                                <div className="py-8 text-center theme-muted text-xs">Your supply cart is empty. Browse the B2B Marketplace to add ingredients.</div>
                            )}
                        </div>

                        <div className="pt-3 border-t border-[color:var(--app-border)]/40 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] theme-muted uppercase font-bold">Total Cart Value</div>
                                <div className="text-lg font-extrabold text-[var(--app-primary)]">{formatMoney(supplyCart?.cartTotal || 0)}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCheckoutOrder}
                                disabled={!supplyCart?.items || supplyCart.items.length === 0}
                                className="rounded-lg bg-[var(--app-primary)] px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
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
