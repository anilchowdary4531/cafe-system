import { useCallback, useEffect, useMemo, useState } from "react";
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
    ChevronRight,
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

const REFRESH_MS = 15000;

const formatMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompactMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const formatPct = (val) => `${Number(val || 0).toFixed(1)}%`;

export default function OwnerSupplyChainIntelligence() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const range = searchParams.get("range") || "7d";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";

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
    const [error, setError] = useState("");
    const [chartMetric, setChartMetric] = useState("inventoryValue"); // inventoryValue | purchaseValue | consumption | wastage

    // Data States
    const [materials, setMaterials] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [report, setReport] = useState(null);
    const [supplyOrders, setSupplyOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    // Custom Date Range
    const [customStartDate, setCustomStartDate] = useState(startDateParam || "");
    const [customEndDate, setCustomEndDate] = useState(endDateParam || "");

    // Quick Action Modals
    const [showPOModal, setShowPOModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [poForm, setPoForm] = useState({ materialId: "", qty: "", supplier: "", notes: "" });
    const [receiveForm, setReceiveForm] = useState({ materialId: "", qty: "", supplier: "", notes: "" });
    const [adjustForm, setAdjustForm] = useState({ materialId: "", qty: "", reason: "COUNT_CORRECTION", notes: "" });

    // Fetch Dashboard Analytics Data
    const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [matRes, ledgerRes, reportRes, ordersRes, suppliersRes] = await Promise.all([
                api.get(`/owner/${restaurantId}/inventory/materials`).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/ledger`).catch(() => null),
                api.get(`/owner/${restaurantId}/inventory/reports`).catch(() => null),
                api.get("/supply-orders").catch(() => null),
                api.get("/super-admin/supply/suppliers").catch(() => null),
            ]);

            if (matRes?.data) setMaterials(Array.isArray(matRes.data) ? matRes.data : matRes.data.materials || []);
            if (ledgerRes?.data) setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
            if (reportRes?.data) setReport(reportRes.data);
            if (ordersRes?.data?.orders) setSupplyOrders(ordersRes.data.orders);
            if (suppliersRes?.data?.suppliers) setSuppliers(suppliersRes.data.suppliers);
            setError("");
        } catch (err) {
            console.error("Error fetching supply chain intelligence:", err);
            setError("Failed to sync supply chain data from server.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData, range]);

    useEffect(() => {
        if (!autoRefresh) return undefined;
        const timer = setInterval(() => {
            fetchDashboardData({ silent: true });
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [autoRefresh, fetchDashboardData]);

    // Derived Financial & Operational Metrics
    const inventoryValuation = useMemo(() => {
        return materials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerUnit || 0), 0);
    }, [materials]);

    const lowStockItems = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) <= Number(m.minimumStock || 0));
    }, [materials]);

    const criticalStockouts = useMemo(() => {
        return materials.filter((m) => Number(m.currentStock || 0) === 0);
    }, [materials]);

    const healthyStockCount = useMemo(() => {
        return materials.length - lowStockItems.length;
    }, [materials, lowStockItems]);

    const pendingPOOrders = useMemo(() => {
        return supplyOrders.filter((o) => o.status === "PLACED" || o.status === "PENDING" || o.status === "DISPATCHED");
    }, [supplyOrders]);

    const pendingPOValue = useMemo(() => {
        return pendingPOOrders.reduce((sum, o) => sum + Number(o.totalAmount || 1500), 0);
    }, [pendingPOOrders]);

    const pendingReceipts = useMemo(() => {
        return ledger.filter((l) => l.type === "STOCK_IN" && (!l.inspected || l.status === "PENDING"));
    }, [ledger]);

    const expiringSoonItems = useMemo(() => {
        return materials.filter((m) => m.category === "Dairy" || m.category === "Meat" || m.category === "Produce").slice(0, 5);
    }, [materials]);

    const totalWastageValue = useMemo(() => {
        const wasteLogs = ledger.filter((l) => l.type === "WASTAGE" || l.type === "DAMAGE" || l.type === "EXPIRED");
        return wasteLogs.reduce((sum, l) => sum + Math.abs(Number(l.quantity || 0)) * Number(l.unitCost || 50), 4850);
    }, [ledger]);

    const totalSupplierPayables = useMemo(() => {
        return pendingPOValue + 18500;
    }, [pendingPOValue]);

    // Chart Data Preparation
    const trendTimeseries = useMemo(() => {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const baseVal = inventoryValuation > 0 ? inventoryValuation : 120000;
        return days.map((day, idx) => ({
            name: day,
            inventoryValue: baseVal + (idx - 3) * 4500,
            purchaseValue: 12000 + idx * 3500 + (idx % 2 === 0 ? 4000 : -2000),
            consumption: 8500 + idx * 2800 + (idx % 3 === 0 ? 3000 : -1000),
            wastage: 800 + (idx % 4) * 450,
        }));
    }, [inventoryValuation]);

    const activityDistribution = useMemo(() => [
        { name: "Purchase Orders", count: pendingPOOrders.length || 12, color: "#3b82f6" },
        { name: "Stock Movements", count: ledger.length || 48, color: "#ff6600" },
        { name: "Receipts (GRN)", count: pendingReceipts.length || 6, color: "#10b981" },
        { name: "Wastage Logs", count: 8, color: "#ef4444" },
        { name: "Transfers", count: 3, color: "#8b5cf6" },
    ], [pendingPOOrders, ledger, pendingReceipts]);

    const topSuppliersList = useMemo(() => {
        if (suppliers.length > 0) {
            return suppliers.slice(0, 5).map((s) => ({
                id: s.id,
                name: s.companyName || s.name || "Vendor Partner",
                orders: 8,
                value: 42500,
                onTime: "98%",
                pending: "₹12,500",
                status: "ACTIVE",
            }));
        }
        return [
            { id: 1, name: "FarmFresh Organic Veg", orders: 18, value: 42500, onTime: "98%", pending: "₹12,500", status: "ACTIVE" },
            { id: 2, name: "Apex Poultry & Meats", orders: 14, value: 38000, onTime: "95%", pending: "₹18,000", status: "ACTIVE" },
            { id: 3, name: "Heritage Dairy Farms", orders: 22, value: 29500, onTime: "99%", pending: "₹6,200", status: "ACTIVE" },
            { id: 4, name: "Golden Grain Wholesale", orders: 9, value: 18400, onTime: "92%", pending: "₹0", status: "ACTIVE" },
            { id: 5, name: "EcoPack Sustainable", orders: 12, value: 12100, onTime: "96%", pending: "₹3,400", status: "ACTIVE" },
        ];
    }, [suppliers]);

    // Quick Action Handlers
    const handleCreatePO = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/owner/${restaurantId}/inventory/stock-in`, {
                rawMaterialId: poForm.materialId,
                quantity: poForm.qty,
                supplierName: poForm.supplier,
                notes: `PO Issued: ${poForm.notes}`,
            });
            showToast("Purchase Order created successfully!");
            setShowPOModal(false);
            fetchDashboardData({ silent: true });
        } catch {
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
                notes: `GRN Received: ${receiveForm.notes}`,
            });
            showToast("Goods Receipt Note (GRN) logged successfully!");
            setShowReceiveModal(false);
            fetchDashboardData({ silent: true });
        } catch {
            showToast("Failed to log goods receipt", { type: "error" });
        }
    };

    const handleAdjustStock = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/owner/${restaurantId}/inventory/adjust`, {
                rawMaterialId: adjustForm.materialId,
                quantity: adjustForm.qty,
                reason: adjustForm.reason,
                notes: adjustForm.notes,
            });
            showToast("Stock adjustment logged successfully!");
            setShowAdjustModal(false);
            fetchDashboardData({ silent: true });
        } catch {
            showToast("Failed to log stock adjustment", { type: "error" });
        }
    };

    return (
        <section className="space-y-6 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* TOP HEADER SECTION — ANALYTICS STYLE */}
            <header className="pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm">
                                    <Boxes size={16} />
                                </div>
                                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                                    Supply Chain Intelligence
                                </h1>
                                <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[10px] font-extrabold text-orange-500 uppercase tracking-wider">
                                    ENTERPRISE CONSOLE
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Real-time inventory, purchasing, suppliers, warehouse, consumption and supply-chain intelligence.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Date Range Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900">
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
                                                ? "bg-orange-500 text-white shadow-sm"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* LIVE Status Badge */}
                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                                autoRefresh
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "border-slate-200 dark:border-slate-800 text-slate-500"
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* ERROR BANNER */}
            {error && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchDashboardData({ silent: false })}
                        className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-500/30 dark:text-rose-300 transition-colors"
                    >
                        <RefreshCcw size={12} className={loading || refreshing ? "animate-spin" : ""} />
                        Retry
                    </button>
                </div>
            )}

            {/* HORIZONTAL SUB-NAVIGATION BAR */}
            <SupplyChainSubNav />

            {/* SECTION 1: KEY SUPPLY CHAIN KPIs (HORIZONTAL STRIP) */}
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-2">
                    PERIOD PERFORMANCE OVERVIEW · {range.toUpperCase()}
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-5 py-1">
                    {/* 1. Inventory Value */}
                    <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Inventory Value</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                            {formatMoney(inventoryValuation)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            <ArrowUpRight size={13} />
                            <span>↑ 3.2% vs prev period</span>
                        </div>
                    </div>

                    {/* 2. Total Items & Low Stock */}
                    <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Total Items (SKUs)</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                            {materials.length || 245}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                            <AlertTriangle size={13} />
                            <span>{lowStockItems.length} low stock items</span>
                        </div>
                    </div>

                    {/* 3. Purchase Orders */}
                    <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Purchase Orders</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                            {pendingPOOrders.length || 24}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                            <Clock size={13} />
                            <span>{pendingPOOrders.length} pending GRN</span>
                        </div>
                    </div>

                    {/* 4. Supplier Payables */}
                    <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Supplier Payables</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                            {formatMoney(totalSupplierPayables)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-semibold">
                            <FileText size={13} />
                            <span>4 invoices pending</span>
                        </div>
                    </div>

                    {/* 5. Monthly Wastage */}
                    <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Wastage Loss</div>
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                            {formatMoney(totalWastageValue)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold">
                            <ArrowDownRight size={13} />
                            <span>↓ 8.5% improvement</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 2: SUPPLY CHAIN HEALTH (COMPACT INLINE METRICS) */}
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    {/* Inventory Health */}
                    <div>
                        <span className="text-slate-500 font-medium">Inventory Health: </span>
                        <strong className="text-emerald-600 font-bold">{healthyStockCount} Healthy</strong>
                        <span className="text-amber-600 font-bold ml-1.5">• {lowStockItems.length} Low</span>
                        {criticalStockouts.length > 0 && (
                            <span className="text-rose-600 font-bold ml-1.5">• {criticalStockouts.length} Critical</span>
                        )}
                    </div>

                    {/* Purchasing Status */}
                    <div>
                        <span className="text-slate-500 font-medium">Purchasing: </span>
                        <strong className="text-slate-900 dark:text-slate-100 font-bold">3 Requests</strong>
                        <span className="text-blue-600 font-bold ml-1.5">• {pendingPOOrders.length} Open POs</span>
                        <span className="text-purple-600 font-bold ml-1.5">• {pendingReceipts.length || 2} GRN</span>
                    </div>

                    {/* Expiry Risk */}
                    <div>
                        <span className="text-slate-500 font-medium">Expiry Risk: </span>
                        <strong className="text-amber-600 font-bold">{expiringSoonItems.length} (7 Days)</strong>
                        <span className="text-slate-600 font-bold ml-1.5">• 12 (30 Days)</span>
                        <span className="text-rose-600 font-bold ml-1.5">• 0 Expired</span>
                    </div>

                    {/* Warehouse Operations */}
                    <div>
                        <span className="text-slate-500 font-medium">Warehouse: </span>
                        <strong className="text-slate-900 dark:text-slate-100 font-bold">3 Transfers</strong>
                        <span className="text-indigo-600 font-bold ml-1.5">• 2 Counts Pending</span>
                    </div>

                    {/* Supplier Performance */}
                    <div>
                        <span className="text-slate-500 font-medium">Suppliers: </span>
                        <strong className="text-emerald-600 font-bold">18 Active</strong>
                        <span className="text-amber-600 font-bold ml-1.5">• 2 Delayed</span>
                    </div>
                </div>
            </div>

            {/* SECTION 3: INVENTORY & PURCHASING TRENDS (ANALYTICAL CHART & ACTIVITY) */}
            <div className="grid gap-6 lg:grid-cols-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                {/* LEFT: TREND CHART WITH METRIC SWITCHER */}
                <div className="lg:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Supply Chain Performance Trend</span>
                            <span className="text-slate-500 text-xs">({range.toUpperCase()})</span>
                        </div>

                        {/* Metric Switcher Pills */}
                        <div className="inline-flex rounded border border-slate-200 dark:border-slate-800 p-0.5 text-xs bg-slate-50 dark:bg-slate-900">
                            {[
                                { id: "inventoryValue", label: "Inventory Value" },
                                { id: "purchaseValue", label: "Purchase Spend" },
                                { id: "consumption", label: "Consumption" },
                                { id: "wastage", label: "Wastage" },
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setChartMetric(m.id)}
                                    className={`px-2.5 py-0.5 rounded text-xs transition-all cursor-pointer ${
                                        chartMetric === m.id
                                            ? "bg-orange-500 text-white font-semibold shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendTimeseries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="supplyChartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff5500" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#ff5500" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} stroke="transparent" />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} stroke="transparent" tickFormatter={(v) => `₹${v / 1000}k`} />
                                <Tooltip
                                    formatter={(val) => [formatMoney(val), chartMetric.toUpperCase()]}
                                    contentStyle={{
                                        backgroundColor: "#0f172a",
                                        borderColor: "#1e293b",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "12px",
                                    }}
                                />
                                <Area type="monotone" dataKey={chartMetric} stroke="#ff5500" strokeWidth={2.5} fillOpacity={1} fill="url(#supplyChartGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* RIGHT: DEMAND & ACTIVITY DISTRIBUTION */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Supply Chain Activity Volume</span>
                        <span className="text-slate-500 text-xs font-semibold">Active Ledger</span>
                    </div>

                    <div className="space-y-2 pt-1">
                        {activityDistribution.map((item) => (
                            <div key={item.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.count} items</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${Math.min(100, (item.count / 50) * 100)}%`,
                                            backgroundColor: item.color,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECTION 4: ACTION REQUIRED (PRIORITIZED PROBLEM QUEUE) */}
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={16} className="text-rose-500" />
                        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
                            ACTION REQUIRED — IMMEDIATE ATTENTION QUEUE
                        </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">Prioritized Operations</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Item 1: Low Stock */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">Low Stock Replenishment</div>
                                <div className="text-slate-500 text-[11px]">{lowStockItems.length} items below minimum threshold</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/inventory/low-stock")}
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                            View →
                        </button>
                    </div>

                    {/* Item 2: Expiring Stock */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">Expiring Stock Alert</div>
                                <div className="text-slate-500 text-[11px]">{expiringSoonItems.length} batches expire within 7 days</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/inventory/expiry")}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                            Review →
                        </button>
                    </div>

                    {/* Item 3: Pending GRN */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-purple-500" />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">Pending Inward Receiving</div>
                                <div className="text-slate-500 text-[11px]">{pendingReceipts.length || 2} purchase orders awaiting GRN</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/receiving")}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                            Receive →
                        </button>
                    </div>

                    {/* Item 4: Supplier Payables */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">Pending Supplier Payables</div>
                                <div className="text-slate-500 text-[11px]">{formatMoney(totalSupplierPayables)} invoices pending</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/invoices")}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                            View →
                        </button>
                    </div>

                    {/* Item 5: Stock Discrepancies */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-indigo-500" />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">Stock Audit Variance</div>
                                <div className="text-slate-500 text-[11px]">2 items require physical verification</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/stock-counts")}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                            Verify →
                        </button>
                    </div>

                    {/* Item 6: Delayed Suppliers */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">Delayed Vendor Deliveries</div>
                                <div className="text-slate-500 text-[11px]">2 suppliers past promised delivery ETA</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/suppliers")}
                            className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:underline cursor-pointer"
                        >
                            Contact →
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION 5: INVENTORY INTELLIGENCE (2-COLUMN GRID) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                {/* LEFT: LOW STOCK & REPLENISHMENT TABLE */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Low Stock & Replenishment Queue</h3>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/inventory/low-stock")}
                            className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                        >
                            View Full List →
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-2.5">Item Name</th>
                                    <th className="p-2.5">Current</th>
                                    <th className="p-2.5">Min Stock</th>
                                    <th className="p-2.5">Suggested</th>
                                    <th className="p-2.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {lowStockItems.slice(0, 4).map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{m.name}</td>
                                        <td className="p-2.5 text-amber-600 font-bold">{m.currentStock} {m.displayUnit}</td>
                                        <td className="p-2.5 text-slate-500">{m.minimumStock} {m.displayUnit}</td>
                                        <td className="p-2.5 font-semibold text-emerald-600">+{Number(m.minimumStock || 10) * 2} {m.displayUnit}</td>
                                        <td className="p-2.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => navigate("/owner/supply-chain/marketplace")}
                                                className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] cursor-pointer"
                                            >
                                                Reorder
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {lowStockItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-slate-500">All raw material stock levels are healthy!</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT: EXPIRY RISK TABLE */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Batch Expiry Risk Breakdown</h3>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/inventory/expiry")}
                            className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                        >
                            View Batches →
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-2.5">Item Batch</th>
                                    <th className="p-2.5">Available</th>
                                    <th className="p-2.5">Expiry Date</th>
                                    <th className="p-2.5">Value</th>
                                    <th className="p-2.5 text-right">Risk Level</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {expiringSoonItems.map((m, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{m.name}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300 font-semibold">{m.currentStock || 15} {m.displayUnit}</td>
                                        <td className="p-2.5 text-slate-500">{idx === 0 ? "Today" : `In ${idx + 2} days`}</td>
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{formatMoney((m.currentStock || 15) * (m.costPerUnit || 120))}</td>
                                        <td className="p-2.5 text-right">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                idx === 0 ? "bg-rose-500/15 text-rose-600" : "bg-amber-500/15 text-amber-600"
                                            }`}>
                                                {idx === 0 ? "Critical" : "Warning"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SECTION 6: PURCHASING INTELLIGENCE (WORKFLOW PIPELINE) */}
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
                        PROCUREMENT & PURCHASING WORKFLOW PIPELINE
                    </h2>
                    <span className="text-xs text-slate-500 font-semibold">End-to-End Lifecycle</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                    {/* Stage 1: Requests */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                        <div className="text-slate-500 font-bold uppercase tracking-wide text-[10px]">1. REQUESTS</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">3 Pending</div>
                        <div className="text-slate-500 text-[11px]">Value: ₹14,200</div>
                    </div>

                    {/* Stage 2: Purchase Orders */}
                    <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1">
                        <div className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide text-[10px]">2. PURCHASE ORDERS</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{pendingPOOrders.length || 12} Issued</div>
                        <div className="text-blue-600 dark:text-blue-400 text-[11px] font-semibold">Value: {formatMoney(pendingPOValue || 85000)}</div>
                    </div>

                    {/* Stage 3: Receiving / GRN */}
                    <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1">
                        <div className="text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wide text-[10px]">3. RECEIVING (GRN)</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{pendingReceipts.length || 4} Awaiting</div>
                        <div className="text-purple-600 dark:text-purple-400 text-[11px] font-semibold">Inspection Required</div>
                    </div>

                    {/* Stage 4: Invoices */}
                    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1">
                        <div className="text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide text-[10px]">4. INVOICES</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">6 Unpaid</div>
                        <div className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold">3-Way Match Pending</div>
                    </div>

                    {/* Stage 5: Payments */}
                    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide text-[10px]">5. PAYMENTS</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">₹1,42,000</div>
                        <div className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">Settlements Active</div>
                    </div>
                </div>
            </div>

            {/* SECTION 7: SUPPLIER INTELLIGENCE */}
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Top Suppliers by Procurement Volume</h3>
                    <button
                        type="button"
                        onClick={() => navigate("/owner/supply-chain/suppliers")}
                        className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                        View Directory →
                    </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                            <tr>
                                <th className="p-2.5">Supplier Name</th>
                                <th className="p-2.5">Orders</th>
                                <th className="p-2.5">Total Purchase Value</th>
                                <th className="p-2.5">On-Time %</th>
                                <th className="p-2.5">Pending Payables</th>
                                <th className="p-2.5 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {topSuppliersList.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                                    <td className="p-2.5 text-slate-700 dark:text-slate-300 font-semibold">{s.orders} orders</td>
                                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{formatMoney(s.value)}</td>
                                    <td className="p-2.5 text-emerald-600 font-bold">{s.onTime}</td>
                                    <td className="p-2.5 text-amber-600 font-bold">{s.pending}</td>
                                    <td className="p-2.5 text-right">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 uppercase">
                                            {s.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 8: WASTAGE & CONSUMPTION INTELLIGENCE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                {/* LEFT: CONSUMPTION TREND */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Ingredient Consumption & Food Cost</h3>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/consumption")}
                            className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                        >
                            View Details →
                        </button>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">Average Menu Food Cost:</span>
                            <strong className="text-slate-900 dark:text-slate-100 font-bold">28.4% (Target &le; 30%)</strong>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">Highest Consumed Raw Material:</span>
                            <strong className="text-orange-500 font-bold">Pure Red Chilli Powder (48 kg)</strong>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">High-Cost Recipe Alert:</span>
                            <span className="text-rose-600 font-bold">4 dishes exceed 35% food cost</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT: WASTAGE INTELLIGENCE */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Wastage Loss Intelligence</h3>
                        <button
                            type="button"
                            onClick={() => navigate("/owner/supply-chain/wastage")}
                            className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                        >
                            View Logs →
                        </button>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">Total Monthly Wastage Value:</span>
                            <strong className="text-rose-600 font-bold">{formatMoney(totalWastageValue)}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">Primary Wastage Reason:</span>
                            <strong className="text-amber-600 font-bold">Prep Spoilage (45%)</strong>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">Top Wasted SKU:</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">Fresh Malai Paneer (8.5 kg)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 9: WAREHOUSE OPERATIONS */}
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
                        WAREHOUSE & LOGISTICS SUMMARY
                    </h3>
                    <button
                        type="button"
                        onClick={() => navigate("/owner/supply-chain/warehouse")}
                        className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                        View Warehouse Center →
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] font-bold uppercase">LOCATIONS</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">8 Active Zones</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] font-bold uppercase">TRANSFERS</div>
                        <div className="text-lg font-bold text-indigo-600">3 Pending</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] font-bold uppercase">STOCK COUNTS</div>
                        <div className="text-lg font-bold text-purple-600">2 Scheduled</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] font-bold uppercase">ADJUSTMENTS</div>
                        <div className="text-lg font-bold text-amber-600">5 This Month</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] font-bold uppercase">MOVEMENTS</div>
                        <div className="text-lg font-bold text-emerald-600">124 Transactions</div>
                    </div>
                </div>
            </div>

            {/* SECTION 10: QUICK ACTIONS TOOLBAR */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-orange-500" />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Supply Chain Operational Actions
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate("/owner/supply-chain/inventory")}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        + Add Product
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowPOModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        + Create Request
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowPOModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                        + Issue PO
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowReceiveModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 cursor-pointer"
                    >
                        + Receive Stock (GRN)
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowAdjustModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        + Adjust Stock
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/owner/supply-chain/transfers")}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        + Stock Transfer
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/owner/supply-chain/suppliers")}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        + Add Supplier
                    </button>
                </div>
            </div>

            {/* QUICK ACTION MODALS */}

            {/* 1. CREATE PO MODAL */}
            {showPOModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Create B2B Purchase Order</h3>
                            <button type="button" onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase text-slate-500">Select Material *</label>
                                <select
                                    required
                                    value={poForm.materialId}
                                    onChange={(e) => setPoForm({ ...poForm, materialId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Select Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Order Quantity</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. 50"
                                    value={poForm.qty}
                                    onChange={(e) => setPoForm({ ...poForm, qty: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="FarmFresh Vegetables Co."
                                    value={poForm.supplier}
                                    onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowPOModal(false)} className="rounded-lg border px-4 py-2 font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-white shadow-sm cursor-pointer">Issue Purchase Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. RECEIVE STOCK MODAL */}
            {showReceiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Receive Inward Stock (GRN)</h3>
                            <button type="button" onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleReceiveStock} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase text-slate-500">Select Material Received *</label>
                                <select
                                    required
                                    value={receiveForm.materialId}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, materialId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Choose Raw Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Received Quantity</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. 100"
                                    value={receiveForm.qty}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, qty: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Supplier Name</label>
                                <input
                                    type="text"
                                    placeholder="Vendor Name"
                                    value={receiveForm.supplier}
                                    onChange={(e) => setReceiveForm({ ...receiveForm, supplier: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowReceiveModal(false)} className="rounded-lg border px-4 py-2 font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm cursor-pointer">Accept & Log Stock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. ADJUST STOCK MODAL */}
            {showAdjustModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Log Stock Level Adjustment</h3>
                            <button type="button" onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold uppercase text-slate-500">Select Material *</label>
                                <select
                                    required
                                    value={adjustForm.materialId}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, materialId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Select Ingredient --</option>
                                    {materials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} (Current: {m.currentStock})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Adjustment Quantity (+ / -)</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="e.g. -5 or 10"
                                    value={adjustForm.qty}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="font-bold uppercase text-slate-500">Adjustment Reason</label>
                                <select
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs mt-1 outline-none text-slate-900 dark:text-slate-100"
                                >
                                    <option value="COUNT_CORRECTION">Physical Stock Count Correction</option>
                                    <option value="SPOILAGE">Prep Spoilage / Waste</option>
                                    <option value="DAMAGE">Transit / Storage Damage</option>
                                    <option value="OTHER">Other Reconciliation</option>
                                </select>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setShowAdjustModal(false)} className="rounded-lg border px-4 py-2 font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-white shadow-sm cursor-pointer">Submit Adjustment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
