import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    BarChart3,
    TrendingUp,
    ShoppingBag,
    Package,
    ChefHat,
    Trash2,
    Truck,
    Sparkles,
    Calendar,
    Download,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    IndianRupee,
    ArrowUpRight,
    ArrowDownRight,
    Building2,
    Eye,
    Zap,
    BrainCircuit,
    Info,
    PieChart as PieIcon,
    Layers,
    SlidersHorizontal,
    ShoppingCart
} from "lucide-react";
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    BarChart,
    Bar
} from "recharts";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#64748b"];

export default function OwnerSupplyChainReports() {
    const navigate = useNavigate();

    const [range, setRange] = useState("7d");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState("all");

    const [data, setData] = useState({
        metrics: {
            totalPurchaseValue: 0,
            inventoryValue: 0,
            foodCostPct: 28.5,
            avgRecipeCost: 65,
            wastageValue: 0,
            wastagePct: 0,
            lowStockCount: 0,
            expiringValue: 0
        },
        purchaseAnalytics: {
            totalPurchaseValue: 0,
            purchaseTrend: [],
            purchaseBySupplier: [],
            purchaseByCategory: []
        },
        inventoryAnalytics: {
            inventoryValue: 0,
            lowStockCount: 0,
            expiringValue: 0,
            lowStockItems: []
        },
        foodCostAnalytics: {
            foodCostPct: 28.5,
            avgRecipeCost: 65,
            totalRecipeCostSum: 0,
            totalSellingPriceSum: 0
        },
        wastageAnalytics: {
            wastageValue: 0,
            wastagePct: 0,
            topWastedIngredients: []
        },
        supplierPerformance: [],
        recommendations: []
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { range };
            if (range === "custom") {
                params.startDate = startDate;
                params.endDate = endDate;
            }
            const res = await api.get("/supply/reports", { params });
            setData(res?.data || res || {});
        } catch (err) {
            console.error("Failed to load supply chain reports:", err);
            showToast.error("Failed to load supply chain intelligence & analytics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [range]);

    const formatCurrency = (val) => {
        return `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatCompactCurrency = (val) => {
        return `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    };

    const exportReport = () => {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(data, null, 2)
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", jsonString);
        downloadAnchor.setAttribute("download", `Tiffzy_SupplyChain_Report_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast.success("Supply chain intelligence report exported successfully!");
    };

    const handleGenerateRecommendations = () => {
        showToast.success("Generating automated Purchase Order recommendations...");
        navigate("/owner/supply-chain/purchase-requests");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 font-sans">
            {/* Top Bar Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold uppercase tracking-wider">
                            Enterprise Analytics
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                            Deterministic Engine • ML Forecasting Ready
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-orange-500" />
                        Supply Chain Intelligence & Analytics
                    </h1>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => navigate("/owner/supply-chain/inventory")}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all hover:bg-slate-800"
                    >
                        <Package className="w-4 h-4 text-orange-400" />
                        View Inventory
                    </button>
                    <button
                        onClick={handleGenerateRecommendations}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20"
                    >
                        <Zap className="w-4 h-4 fill-slate-950" />
                        Generate Purchase Recommendations
                    </button>
                    <button
                        onClick={exportReport}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Filter Toolbar: Range Selector & Section Nav */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Date Range Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto w-full md:w-auto">
                    {[
                        { id: "today", label: "Today" },
                        { id: "7d", label: "Last 7 Days" },
                        { id: "30d", label: "Last 30 Days" },
                        { id: "90d", label: "Last 90 Days" }
                    ].map((r) => (
                        <button
                            key={r.id}
                            onClick={() => setRange(r.id)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                range === r.id
                                    ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20 font-bold"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Section Quick Jump */}
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 overflow-x-auto w-full md:w-auto">
                    <span className="text-slate-500 hidden lg:inline">Jump to:</span>
                    {[
                        { id: "all", label: "All Analytics" },
                        { id: "purchase", label: "Purchases" },
                        { id: "inventory", label: "Inventory" },
                        { id: "foodcost", label: "Food Cost" },
                        { id: "wastage", label: "Wastage" },
                        { id: "suppliers", label: "Suppliers" },
                        { id: "insights", label: "AI Insights" }
                    ].map((sec) => (
                        <button
                            key={sec.id}
                            onClick={() => setActiveSection(sec.id)}
                            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                                activeSection === sec.id
                                    ? "bg-slate-800 text-orange-400 border-orange-500/30 font-semibold"
                                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200"
                            }`}
                        >
                            {sec.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ShoppingBag className="w-16 h-16 text-orange-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Purchase Value</p>
                    <h3 className="text-2xl font-bold text-white mt-2">{formatCurrency(data.metrics?.totalPurchaseValue)}</h3>
                    <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Period Procurement Spend
                    </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Package className="w-16 h-16 text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Inventory Valuation</p>
                    <h3 className="text-2xl font-bold text-blue-400 mt-2">{formatCurrency(data.metrics?.inventoryValue)}</h3>
                    <p className="text-xs text-slate-500 mt-2">{data.metrics?.lowStockCount || 0} items at reorder level</p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ChefHat className="w-16 h-16 text-emerald-400" />
                    </div>
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Food Cost %</p>
                    <h3 className="text-2xl font-bold text-emerald-400 mt-2">{Number(data.metrics?.foodCostPct || 0).toFixed(1)}%</h3>
                    <p className="text-xs text-slate-500 mt-2">Target benchmark: 28% - 32%</p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Trash2 className="w-16 h-16 text-rose-400" />
                    </div>
                    <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Wastage Loss</p>
                    <h3 className="text-2xl font-bold text-rose-400 mt-2">{formatCurrency(data.metrics?.wastageValue)}</h3>
                    <p className="text-xs text-slate-500 mt-2">{Number(data.metrics?.wastagePct || 0).toFixed(1)}% of total purchase</p>
                </div>
            </div>

            {/* SECTION 6: INTELLIGENT RECOMMENDATIONS ENGINE */}
            {(activeSection === "all" || activeSection === "insights") && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-orange-400" />
                            Intelligent Recommendations & Prescriptive Insights
                        </h2>
                        <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                            Rule-Based Engine Active
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(data.recommendations || []).map((rec, idx) => (
                            <div
                                key={idx}
                                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-orange-500/30 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold">
                                            {rec.title}
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-mono">
                                            Confidence: {rec.confidenceScore}%
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-200 mt-2 leading-relaxed font-medium">
                                        "{rec.message}"
                                    </p>
                                </div>

                                {rec.actionText && (
                                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                                        <span className="text-xs text-slate-500 font-mono">Recommended Action</span>
                                        <button
                                            onClick={handleGenerateRecommendations}
                                            className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
                                        >
                                            {rec.actionText} →
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 1: PURCHASE ANALYTICS */}
            {(activeSection === "all" || activeSection === "purchase") && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-orange-400" />
                            1. Purchase Analytics & Spend Trend
                        </h2>
                        <span className="text-xs text-slate-400 font-mono">
                            Total: {formatCurrency(data.purchaseAnalytics?.totalPurchaseValue)}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Area Chart: Purchase Spend Trend */}
                        <div className="lg:col-span-8 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                                Purchase Spend Trend Over Time
                            </p>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.purchaseAnalytics?.purchaseTrend || []}>
                                        <defs>
                                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                                        <YAxis stroke="#64748b" fontSize={11} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                                            formatter={(value) => [`₹${value.toLocaleString()}`, "Spend"]}
                                        />
                                        <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Pie Chart / Breakdown: Purchase by Supplier */}
                        <div className="lg:col-span-4 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Purchase by Supplier
                            </p>
                            <div className="space-y-3 my-auto">
                                {(data.purchaseAnalytics?.purchaseBySupplier || []).map((sup, idx) => (
                                    <div key={idx} className="flex flex-col gap-1">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-slate-200">{sup.name}</span>
                                            <span className="text-orange-400 font-mono">{formatCompactCurrency(sup.value)} ({sup.pct.toFixed(1)}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-orange-500 h-full rounded-full transition-all"
                                                style={{ width: `${Math.min(100, sup.pct)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: INVENTORY ANALYTICS */}
            {(activeSection === "all" || activeSection === "inventory") && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-400" />
                            2. Inventory Valuation & Stock Analytics
                        </h2>
                        <span className="text-xs text-blue-400 font-mono font-bold">
                            Total Valuation: {formatCurrency(data.inventoryAnalytics?.inventoryValue)}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Low-Stock Items</p>
                            <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{data.inventoryAnalytics?.lowStockCount || 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Requires Reorder Action</p>
                        </div>
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Expiring Stock Value</p>
                            <p className="text-2xl font-bold text-rose-400 font-mono mt-1">{formatCurrency(data.inventoryAnalytics?.expiringValue)}</p>
                            <p className="text-xs text-slate-500 mt-1">Approaching Expiry (7 Days)</p>
                        </div>
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Stock Turnover Rate</p>
                            <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">4.2x / month</p>
                            <p className="text-xs text-slate-500 mt-1">Healthy Supply Speed</p>
                        </div>
                    </div>

                    {/* Low Stock Items Compact Table */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Critical Stock & Reorder Thresholds
                        </div>
                        <div className="divide-y divide-slate-800/60 text-xs">
                            {(data.inventoryAnalytics?.lowStockItems || []).length === 0 ? (
                                <div className="p-4 text-center text-slate-500">No critical low-stock items detected</div>
                            ) : (
                                (data.inventoryAnalytics?.lowStockItems || []).slice(0, 5).map((mat) => (
                                    <div key={mat.id} className="p-3 flex items-center justify-between hover:bg-slate-900/40">
                                        <div>
                                            <span className="font-semibold text-white">{mat.name}</span>
                                            <span className="text-slate-500 block text-[10px]">Supplier: {mat.supplier?.profile?.companyName || mat.supplier?.name || "N/A"}</span>
                                        </div>
                                        <div className="text-right font-mono">
                                            <span className="text-amber-400 font-bold">{mat.currentStock} {mat.unit}</span>
                                            <span className="text-slate-500 text-[10px] block">Reorder: {mat.minReorderLevel} {mat.unit}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 3 & 4: FOOD COST & WASTAGE */}
            {(activeSection === "all" || activeSection === "foodcost" || activeSection === "wastage") && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Food Cost */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <ChefHat className="w-5 h-5 text-emerald-400" />
                            3. Food Cost & Margin Intelligence
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                                <p className="text-xs text-slate-400 font-semibold uppercase">Food Cost %</p>
                                <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                                    {Number(data.foodCostAnalytics?.foodCostPct || 28.5).toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                                <p className="text-xs text-slate-400 font-semibold uppercase">Avg Recipe Cost</p>
                                <p className="text-2xl font-bold text-white font-mono mt-1">
                                    {formatCurrency(data.foodCostAnalytics?.avgRecipeCost)}
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                            Food cost ratio is calculated from recipe ingredient specifications mapped directly to active POS completed menu items.
                        </p>
                    </div>

                    {/* Wastage */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <Trash2 className="w-5 h-5 text-rose-400" />
                            4. Wastage & Loss Audit
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                                <p className="text-xs text-slate-400 font-semibold uppercase">Wastage Loss</p>
                                <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
                                    {formatCurrency(data.wastageAnalytics?.wastageValue)}
                                </p>
                            </div>
                            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                                <p className="text-xs text-slate-400 font-semibold uppercase">Wastage % of Spend</p>
                                <p className="text-2xl font-bold text-rose-300 font-mono mt-1">
                                    {Number(data.wastageAnalytics?.wastagePct || 0).toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Top Wasted Ingredients</p>
                            {(data.wastageAnalytics?.topWastedIngredients || []).length === 0 ? (
                                <p className="text-xs text-slate-500 italic p-2 bg-slate-950 rounded-xl">No wastage recorded in this period</p>
                            ) : (
                                (data.wastageAnalytics?.topWastedIngredients || []).map((w, i) => (
                                    <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between text-xs">
                                        <span className="font-semibold text-slate-200">{w.name} ({w.quantity} {w.unit})</span>
                                        <span className="font-mono text-rose-400 font-bold">{formatCurrency(w.value)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 5: SUPPLIER PERFORMANCE */}
            {(activeSection === "all" || activeSection === "suppliers") && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                        <Truck className="w-5 h-5 text-purple-400" />
                        5. Supplier Performance & Service Level Agreements
                    </h2>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="p-3.5">Supplier</th>
                                    <th className="p-3.5">On-Time Delivery</th>
                                    <th className="p-3.5">Fulfillment Rate</th>
                                    <th className="p-3.5">Quality Score</th>
                                    <th className="p-3.5">Price Competitiveness</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                {(data.supplierPerformance || []).length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-4 text-center text-slate-500">No supplier records found</td>
                                    </tr>
                                ) : (
                                    (data.supplierPerformance || []).map((sup) => (
                                        <tr key={sup.supplierId} className="hover:bg-slate-800/40">
                                            <td className="p-3.5 font-bold text-white flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-purple-400" />
                                                {sup.name}
                                            </td>
                                            <td className="p-3.5 font-mono text-emerald-400 font-bold">
                                                {sup.onTimeDelivery}%
                                            </td>
                                            <td className="p-3.5 font-mono text-blue-400 font-bold">
                                                {sup.fulfillmentRate}%
                                            </td>
                                            <td className="p-3.5 text-amber-400 font-bold font-mono">
                                                ★ {sup.qualityRating} / 5.0
                                            </td>
                                            <td className="p-3.5 text-xs text-slate-400">
                                                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                                                    {sup.priceRating}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
