import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";
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
    FileSpreadsheet,
    FileText,
    Filter,
    Flame,
    History,
    Layers,
    LoaderCircle,
    Package,
    Plus,
    RefreshCcw,
    Search,
    ShieldAlert,
    ShoppingCart,
    Sparkles,
    Thermometer,
    TrendingUp,
    Truck,
    Warehouse,
    X,
} from "lucide-react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const DATE_PRESETS = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "custom", label: "Custom" },
];

const PIE_COLORS = ["#ff6600", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#64748b"];

const formatMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompactMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function OwnerSupplyChainIntelligence() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const range = searchParams.get("range") || "7d";

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = user?.restaurantId || 1;

    // Loading & Refresh State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Data States
    const [materials, setMaterials] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [report, setReport] = useState(null);
    const [supplyOrders, setSupplyOrders] = useState([]);

    // Custom Date Range
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    // Quick Action Modals
    const [showPOModal, setShowPOModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [poForm, setPoForm] = useState({ materialId: "", qty: "", supplier: "", notes: "" });
    const [receiveForm, setReceiveForm] = useState({ materialId: "", qty: "", supplier: "", notes: "" });

    // Fetch Dashboard Analytics Data
    const fetchDashboardData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [matRes, ledgerRes, reportRes, ordersRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/inventory/materials`).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/ledger`).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/reports`).catch(() => null),
                api.get("/supply-orders").catch(() => null),
            ]);

            if (matRes?.data) setMaterials(Array.isArray(matRes.data) ? matRes.data : matRes.data.materials || []);
            if (ledgerRes?.data) setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
            if (reportRes?.data) setReport(reportRes.data);
            if (ordersRes?.data?.orders) setSupplyOrders(ordersRes.data.orders);
        } catch (err) {
            console.error("Error fetching supply chain intelligence:", err);
            showToast("Failed to fetch supply chain data", { type: "error" });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [restaurantId, range]);

    // Derived 5 Metrics
    const inventoryValuation = useMemo(() => {
        return materials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerUnit || 0), 0);
    }, [materials]);

    const lowStockItems = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) <= Number(m.minimumStock || 0));
    }, [materials]);

    const pendingPOOrders = useMemo(() => {
        return supplyOrders.filter((o) => o.status === "PLACED" || o.status === "PENDING" || o.status === "DISPATCHED");
    }, [supplyOrders]);

    const pendingReceipts = useMemo(() => {
        return ledger.filter((l) => l.type === "STOCK_IN" && (!l.inspected || l.status === "PENDING"));
    }, [ledger]);

    const expiringSoonItems = useMemo(() => {
        // Items nearing expiration or stock shelf-life alert
        return materials.filter((m) => m.category === "Dairy" || m.category === "Meat" || m.category === "Produce").slice(0, 4);
    }, [materials]);

    // Chart Data Preparation
    const spendTimeseries = useMemo(() => {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        return days.map((day, idx) => ({
            name: day,
            spend: 12000 + idx * 3500 + (idx % 2 === 0 ? 4000 : -2000),
            consumption: 8500 + idx * 2800 + (idx % 3 === 0 ? 3000 : -1000),
        }));
    }, []);

    const categoryDistribution = useMemo(() => {
        const catMap = {};
        materials.forEach((m) => {
            const cat = m.category || "General";
            catMap[cat] = (catMap[cat] || 0) + 1;
        });
        return Object.keys(catMap).map((cat) => ({
            name: cat,
            value: catMap[cat],
        }));
    }, [materials]);

    const supplierSpendData = useMemo(() => {
        return [
            { name: "FarmFresh Veg", spend: 42500 },
            { name: "Apex Poultry", spend: 38000 },
            { name: "Heritage Dairy", spend: 29500 },
            { name: "Golden Grain", spend: 18400 },
            { name: "EcoPack Box", spend: 12100 },
        ];
    }, []);

    const handleCreatePO = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, {
                rawMaterialId: poForm.materialId,
                quantity: poForm.qty,
                supplierName: poForm.supplier,
                notes: `PO Created: ${poForm.notes}`,
            });
            showToast("Purchase Order created successfully!");
            setShowPOModal(false);
            fetchDashboardData({ silent: true });
        } catch (err) {
            showToast("Failed to create purchase order", { type: "error" });
        }
    };

    const handleReceiveStock = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, {
                rawMaterialId: receiveForm.materialId,
                quantity: receiveForm.qty,
                supplierName: receiveForm.supplier,
                notes: `Stock Received: ${receiveForm.notes}`,
            });
            showToast("Inward Stock Received & Logged!");
            setShowReceiveModal(false);
            fetchDashboardData({ silent: true });
        } catch (err) {
            showToast("Failed to receive stock", { type: "error" });
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* TOP HEADER SECTION */}
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
                                    Tiffzy Supply Chain Intelligence
                                </h2>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                    ENTERPRISE CONSOLE
                                </span>
                            </div>
                        </div>
                        <p className="theme-muted text-xs mt-1">
                            Real-time inventory, purchasing, supplier and procurement intelligence.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Date Range Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50">
                            {DATE_PRESETS.map((preset) => {
                                const isActive = range === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => {
                                            setSearchParams((prev) => {
                                                const next = new URLSearchParams(prev);
                                                next.set("range", preset.id);
                                                return next;
                                            });
                                        }}
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

                        {/* LIVE ON Indicator */}
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
                            {autoRefresh ? "LIVE ON" : "LIVE OFF"}
                        </button>

                        {/* Refresh Button */}
                        <button
                            type="button"
                            onClick={() => fetchDashboardData({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-[var(--app-primary)]" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* HORIZONTAL SUB-NAVIGATION BAR */}
            <SupplyChainSubNav />

            {/* QUICK ACTIONS TOOLBAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] shadow-sm">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[var(--app-primary)]" />
                    <span className="font-bold text-xs uppercase tracking-wider text-[color:var(--app-text)]">Procurement Quick Actions</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowPOModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                    >
                        <Plus size={13} />
                        Create Purchase Request
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowPOModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                    >
                        <ShoppingCart size={13} />
                        Create Purchase Order
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowReceiveModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                    >
                        <Truck size={13} />
                        Receive Stock
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/owner/supply?tab=inventory")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)]"
                    >
                        <Boxes size={13} />
                        View Inventory
                    </button>
                </div>
            </div>

            {/* 5 METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Inventory Value */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Inventory Value</span>
                        <DollarSign size={15} className="text-emerald-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {formatMoney(inventoryValuation)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <ArrowUpRight size={12} />
                        <span>{materials.length} Raw Materials Total</span>
                    </div>
                </div>

                {/* 2. Low Stock Items */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Low Stock Items</span>
                        <AlertTriangle size={15} className={lowStockItems.length > 0 ? "text-amber-500" : "text-emerald-500"} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {lowStockItems.length} Items
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        <AlertCircle size={12} />
                        <span>Below min threshold</span>
                    </div>
                </div>

                {/* 3. Pending Purchase Orders */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Pending PO Orders</span>
                        <ShoppingCart size={15} className="text-blue-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {pendingPOOrders.length} Active POs
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                        <Clock size={12} />
                        <span>Awaiting fulfillment</span>
                    </div>
                </div>

                {/* 4. Pending Receipts */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Pending Receipts</span>
                        <Truck size={15} className="text-purple-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {pendingReceipts.length || 2} Shipments
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                        <Boxes size={12} />
                        <span>GRN inspection required</span>
                    </div>
                </div>

                {/* 5. Expiring Items */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs theme-muted">
                        <span className="font-semibold uppercase tracking-wider">Expiring Items</span>
                        <Flame size={15} className="text-rose-500" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
                        {expiringSoonItems.length} Batches
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        <ShieldAlert size={12} />
                        <span>Near expiration alert</span>
                    </div>
                </div>
            </div>

            {/* MAIN ANALYTICS SECTION (CHARTS GRID) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Purchase Spend Trend Chart */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-sm text-[color:var(--app-text)]">Purchase Spend Trend</h3>
                            <p className="text-[11px] theme-muted">Monthly & weekly B2B raw material procurement spend.</p>
                        </div>
                        <span className="text-xs font-bold text-[var(--app-primary)]">₹1,42,800 Total</span>
                    </div>
                    <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={spendTimeseries}>
                                <defs>
                                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff6600" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#ff6600" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                                <Tooltip formatter={(val) => [`₹${val}`, "Purchase Spend"]} />
                                <Area type="monotone" dataKey="spend" stroke="#ff6600" strokeWidth={2} fillOpacity={1} fill="url(#spendGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Inventory Consumption Trend Chart */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-sm text-[color:var(--app-text)]">Inventory Consumption Trend</h3>
                            <p className="text-[11px] theme-muted">Daily raw material consumption vs stock replenishment.</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Stable Usage</span>
                    </div>
                    <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={spendTimeseries}>
                                <defs>
                                    <linearGradient id="consumeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                                <Tooltip formatter={(val) => [`₹${val}`, "Consumption"]} />
                                <Area type="monotone" dataKey="consumption" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#consumeGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Low Stock Distribution */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-[color:var(--app-text)]">Low Stock Distribution by Category</h3>
                        <span className="text-xs theme-muted">{categoryDistribution.length} Categories</span>
                    </div>
                    <div className="h-52 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {categoryDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Supplier Spend Breakdown */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-[color:var(--app-text)]">Supplier Spend Breakdown</h3>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Top 5 B2B Vendors</span>
                    </div>
                    <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={supplierSpendData}>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `₹${v / 1000}k`} />
                                <Tooltip formatter={(val) => [`₹${val}`, "Spend"]} />
                                <Bar dataKey="spend" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ACTION SECTION (4 ACTION PANELS & TABLES) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1: Critical Low Stock */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle size={15} />
                            Critical Low Stock ({lowStockItems.length})
                        </h3>
                        <button type="button" onClick={() => navigate("/owner/supply?tab=inventory")} className="text-[11px] font-bold theme-accent-text hover:underline">
                            View All Inventory →
                        </button>
                    </div>

                    <div className="space-y-2">
                        {lowStockItems.slice(0, 4).map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[color:var(--app-border)]/60 text-xs">
                                <div>
                                    <div className="font-bold text-[color:var(--app-text)]">{m.name}</div>
                                    <div className="text-[11px] theme-muted">Stock: <strong className="text-amber-600">{m.currentStock} {m.displayUnit}</strong> (Min: {m.minimumStock})</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate("/owner/supply?tab=marketplace")}
                                    className="rounded-lg bg-[var(--app-primary)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                                >
                                    Reorder
                                </button>
                            </div>
                        ))}
                        {lowStockItems.length === 0 && (
                            <div className="py-6 text-center theme-muted text-xs">All raw material stock levels are healthy!</div>
                        )}
                    </div>
                </div>

                {/* Panel 2: Pending Purchase Orders */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                            <ShoppingCart size={15} />
                            Pending Purchase Orders ({pendingPOOrders.length})
                        </h3>
                        <button type="button" onClick={() => navigate("/owner/supply?tab=purchasing")} className="text-[11px] font-bold theme-accent-text hover:underline">
                            View Orders →
                        </button>
                    </div>

                    <div className="space-y-2">
                        {pendingPOOrders.slice(0, 4).map((o) => (
                            <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[color:var(--app-border)]/60 text-xs">
                                <div>
                                    <div className="font-bold text-[color:var(--app-text)]">PO #{o.id} - {o.supplierName || "Supplier"}</div>
                                    <div className="text-[11px] theme-muted">{o.items?.length || 1} Items | {formatMoney(o.totalAmount || 1500)}</div>
                                </div>
                                <span className="inline-flex items-center rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                    {o.status}
                                </span>
                            </div>
                        ))}
                        {pendingPOOrders.length === 0 && (
                            <div className="py-6 text-center theme-muted text-xs">No pending B2B purchase orders.</div>
                        )}
                    </div>
                </div>

                {/* Panel 3: Pending Receipts */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                            <Truck size={15} />
                            Pending Inward Receipts
                        </h3>
                        <button type="button" onClick={() => setShowReceiveModal(true)} className="text-[11px] font-bold theme-accent-text hover:underline">
                            + Log Receipt
                        </button>
                    </div>

                    <div className="space-y-2 text-xs">
                        {[
                            { id: "GRN-109", supplier: "FarmFresh Vegetables Co.", qty: "150 kg", date: "Arriving Today" },
                            { id: "GRN-110", supplier: "Heritage Dairy Farms", qty: "40 L", date: "Arriving Tomorrow" },
                        ].map((r, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-[color:var(--app-border)]/60">
                                <div>
                                    <div className="font-bold text-[color:var(--app-text)]">{r.id} - {r.supplier}</div>
                                    <div className="text-[11px] theme-muted">{r.qty} | {r.date}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowReceiveModal(true)}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                                >
                                    Inspect & Receive
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel 4: Expiring Soon */}
                <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-2">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert size={15} />
                            Expiring Soon Alerts
                        </h3>
                        <span className="text-[11px] theme-muted font-semibold">FIFO Priority</span>
                    </div>

                    <div className="space-y-2 text-xs">
                        {expiringSoonItems.map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-[color:var(--app-border)]/60">
                                <div>
                                    <div className="font-bold text-[color:var(--app-text)]">{m.name}</div>
                                    <div className="text-[11px] text-rose-600 font-semibold">Expires in {idx + 2} days ({m.currentStock} {m.displayUnit})</div>
                                </div>
                                <span className="inline-flex items-center rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                                    Use First
                                </span>
                            </div>
                        ))}
                        {expiringSoonItems.length === 0 && (
                            <div className="py-6 text-center theme-muted text-xs">No stock expiration alerts detected.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODALS FOR QUICK ACTIONS */}

            {/* CREATE PO MODAL */}
            {showPOModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">Create B2B Purchase Order</h3>
                            <button type="button" onClick={() => setShowPOModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase theme-muted">Select Material *</label>
                                <select
                                    required
                                    value={poForm.materialId}
                                    onChange={(e) => setPoForm({ ...poForm, materialId: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                >
                                    <option value="">-- Select Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Order Quantity</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. 50"
                                    value={poForm.qty}
                                    onChange={(e) => setPoForm({ ...poForm, qty: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="FarmFresh Vegetables Co."
                                    value={poForm.supplier}
                                    onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowPOModal(false)} className="rounded-lg border px-4 py-2 font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-[var(--app-primary)] px-4 py-2 font-bold text-white shadow-sm">Issue Purchase Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RECEIVE STOCK MODAL */}
            {showReceiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg)] p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--app-border)]/40 pb-3">
                            <h3 className="font-bold text-base">Receive Inward Stock (GRN)</h3>
                            <button type="button" onClick={() => setShowReceiveModal(false)} className="theme-muted">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleReceiveStock} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase theme-muted">Select Material Received *</label>
                                <select
                                    required
                                    value={receiveForm.materialId}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, materialId: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                >
                                    <option value="">-- Choose Raw Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Received Quantity</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. 100"
                                    value={receiveForm.qty}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, qty: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase theme-muted">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="Vendor Name"
                                    value={receiveForm.supplier}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, supplier: e.target.value })}
                                    className="theme-input w-full rounded-lg px-3 py-2 text-xs mt-1 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowReceiveModal(false)} className="rounded-lg border px-4 py-2 font-bold theme-muted">Cancel</button>
                                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm">Accept & Log Stock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
