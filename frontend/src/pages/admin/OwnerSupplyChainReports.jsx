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

import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* Global Horizontal Enterprise Sub-Nav Bar */}
            <SupplyChainSubNav />

            {/* Header Console */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Reports & Analytics</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                            <BarChart3 className="text-orange-500" size={20} />
                            Supply Chain Intelligence & Analytics
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate("/owner/supply-chain/inventory")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200/80 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition cursor-pointer"
                    >
                        <Package size={13} className="text-orange-500" />
                        <span>View Inventory</span>
                    </button>
                    <button
                        onClick={handleGenerateRecommendations}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                    >
                        <Zap size={13} className="fill-white" />
                        <span>Generate PO Requisitions</span>
                    </button>
                    <button
                        onClick={exportReport}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200/80 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition cursor-pointer"
                    >
                        <Download size={13} />
                        <span>Export Report</span>
                    </button>
                </div>
            </div>

            {/* Filter Toolbar: Range Selector & Section Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1 print:hidden">
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/80 p-0.5 rounded-lg">
                    {[
                        { id: "today", label: "Today" },
                        { id: "7d", label: "Last 7 Days" },
                        { id: "30d", label: "Last 30 Days" },
                        { id: "90d", label: "Last 90 Days" }
                    ].map((r) => (
                        <button
                            key={r.id}
                            onClick={() => setRange(r.id)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                                range === r.id
                                    ? "bg-orange-500 text-white font-bold shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
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
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                                activeSection === sec.id
                                    ? "bg-orange-500/10 text-orange-600 border border-orange-200 font-bold"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                        >
                            {sec.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Analytics KPI Summaries Bar (Analytics Line Style - No Heavy Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Purchase Spend</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{formatCurrency(data.metrics?.totalPurchaseValue)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Procurement Total</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Inventory Valuation</span>
                    <div className="text-lg font-bold text-blue-600 font-mono mt-0.5">{formatCurrency(data.metrics?.inventoryValue)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Active Stock Value</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Food Cost %</span>
                    <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">{Number(data.metrics?.foodCostPct || 0).toFixed(1)}%</div>
                    <span className="text-[10px] text-slate-400 font-medium">Benchmark: 28% - 32%</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Wastage Loss</span>
                    <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">{formatCurrency(data.metrics?.wastageValue)}</div>
                    <span className="text-[10px] text-rose-600/80 font-medium">{Number(data.metrics?.wastagePct || 0).toFixed(1)}% of Spend</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Low Stock Items</span>
                    <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">{data.metrics?.lowStockCount || 0}</div>
                    <span className="text-[10px] text-amber-600/80 font-medium">At Reorder Point</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Expiring Stock</span>
                    <div className="text-lg font-bold text-purple-600 font-mono mt-0.5">{formatCurrency(data.metrics?.expiringValue)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Next 7 Days</span>
                </div>
            </div>

            {/* SECTION 6: INTELLIGENT RECOMMENDATIONS & INSIGHTS */}
            {(activeSection === "all" || activeSection === "insights") && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-orange-500" />
                            Prescriptive Insights & Recommendations
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                            Deterministic Engine Active
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(data.recommendations || []).map((rec, idx) => (
                            <div
                                key={idx}
                                className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100 text-[10px] font-bold">
                                            {rec.title}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            Confidence: {rec.confidenceScore}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                        "{rec.message}"
                                    </p>
                                </div>

                                {rec.actionText && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-400 font-mono">Recommended Action</span>
                                        <button
                                            onClick={handleGenerateRecommendations}
                                            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors cursor-pointer"
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
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <ShoppingBag size={14} className="text-orange-500" />
                            1. Purchase Analytics & Spend Trend
                        </h2>
                        <span className="text-xs font-bold text-slate-900 font-mono">
                            Total Spend: {formatCurrency(data.purchaseAnalytics?.totalPurchaseValue)}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                        {/* Compact Area Chart: Purchase Spend Trend */}
                        <div className="lg:col-span-8 rounded-lg border border-slate-100 p-2.5 bg-slate-50/50">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Purchase Spend Trend Over Time
                            </p>
                            <div className="h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.purchaseAnalytics?.purchaseTrend || []}>
                                        <defs>
                                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", color: "#0f172a", fontSize: "11px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                                            formatter={(value) => [`₹${value.toLocaleString()}`, "Spend"]}
                                        />
                                        <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Compact Breakdown: Purchase by Supplier */}
                        <div className="lg:col-span-4 rounded-lg border border-slate-100 p-2.5 bg-slate-50/50 flex flex-col justify-between">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Purchase by Supplier
                            </p>
                            <div className="space-y-2.5 my-auto">
                                {(data.purchaseAnalytics?.purchaseBySupplier || []).map((sup, idx) => (
                                    <div key={idx} className="flex flex-col gap-0.5">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-slate-900 font-semibold">{sup.name}</span>
                                            <span className="text-orange-600 font-mono font-bold">{formatCompactCurrency(sup.value)} ({sup.pct.toFixed(1)}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
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
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Package size={14} className="text-blue-500" />
                            2. Inventory Valuation & Stock Analytics
                        </h2>
                        <span className="text-xs font-bold text-blue-600 font-mono">
                            Total Valuation: {formatCurrency(data.inventoryAnalytics?.inventoryValue)}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <p className="text-[10px] font-bold text-amber-600 uppercase">Low-Stock Items</p>
                            <p className="text-xl font-bold text-amber-600 font-mono mt-0.5">{data.inventoryAnalytics?.lowStockCount || 0}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Requires Reorder Action</p>
                        </div>
                        <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <p className="text-[10px] font-bold text-rose-600 uppercase">Expiring Stock Value</p>
                            <p className="text-xl font-bold text-rose-600 font-mono mt-0.5">{formatCurrency(data.inventoryAnalytics?.expiringValue)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Approaching Expiry (7 Days)</p>
                        </div>
                        <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase">Stock Turnover Rate</p>
                            <p className="text-xl font-bold text-emerald-600 font-mono mt-0.5">4.2x / month</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Healthy Supply Velocity</p>
                        </div>
                    </div>

                    {/* Low Stock Items Clean Table */}
                    <div className="border border-slate-100 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Critical Stock & Reorder Thresholds
                        </div>
                        <div className="divide-y divide-slate-100 text-xs">
                            {(data.inventoryAnalytics?.lowStockItems || []).length === 0 ? (
                                <div className="p-3 text-center text-slate-400">No critical low-stock items detected</div>
                            ) : (
                                (data.inventoryAnalytics?.lowStockItems || []).slice(0, 5).map((mat) => (
                                    <div key={mat.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                        <div>
                                            <span className="font-bold text-slate-900">{mat.name}</span>
                                            <span className="text-slate-400 block text-[10px]">Supplier: {mat.supplier?.profile?.companyName || mat.supplier?.name || "N/A"}</span>
                                        </div>
                                        <div className="text-right font-mono">
                                            <span className="text-amber-600 font-bold">{mat.currentStock} {mat.unit}</span>
                                            <span className="text-slate-400 text-[10px] block">Reorder: {mat.minReorderLevel} {mat.unit}</span>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Food Cost */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <ChefHat size={14} className="text-emerald-500" />
                            3. Food Cost & Margin Intelligence
                        </h2>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Food Cost %</p>
                                <p className="text-xl font-bold text-emerald-600 font-mono mt-0.5">
                                    {Number(data.foodCostAnalytics?.foodCostPct || 28.5).toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Avg Recipe Cost</p>
                                <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                                    {formatCurrency(data.foodCostAnalytics?.avgRecipeCost)}
                                </p>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                            Food cost ratio is calculated from recipe ingredient specifications mapped directly to active POS completed menu items.
                        </p>
                    </div>

                    {/* Wastage */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <Trash2 size={14} className="text-rose-500" />
                            4. Wastage & Loss Audit
                        </h2>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Wastage Loss</p>
                                <p className="text-xl font-bold text-rose-600 font-mono mt-0.5">
                                    {formatCurrency(data.wastageAnalytics?.wastageValue)}
                                </p>
                            </div>
                            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Wastage % of Spend</p>
                                <p className="text-xl font-bold text-rose-600 font-mono mt-0.5">
                                    {Number(data.wastageAnalytics?.wastagePct || 0).toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Top Wasted Ingredients</p>
                            {(data.wastageAnalytics?.topWastedIngredients || []).length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic p-2 bg-slate-50 rounded-lg">No wastage recorded in this period</p>
                            ) : (
                                (data.wastageAnalytics?.topWastedIngredients || []).map((w, i) => (
                                    <div key={i} className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 flex justify-between text-xs">
                                        <span className="font-semibold text-slate-900">{w.name} ({w.quantity} {w.unit})</span>
                                        <span className="font-mono text-rose-600 font-bold">{formatCurrency(w.value)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 5: SUPPLIER PERFORMANCE */}
            {(activeSection === "all" || activeSection === "suppliers") && (
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Truck size={14} className="text-purple-500" />
                            5. Supplier Performance & Service Level Agreements (SLA)
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-3.5">Supplier</th>
                                    <th className="py-2.5 px-3.5">On-Time Delivery</th>
                                    <th className="py-2.5 px-3.5">Fulfillment Rate</th>
                                    <th className="py-2.5 px-3.5">Quality Score</th>
                                    <th className="py-2.5 px-3.5">Price Rating</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {(data.supplierPerformance || []).length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-4 text-center text-slate-400">No supplier records found</td>
                                    </tr>
                                ) : (
                                    (data.supplierPerformance || []).map((sup) => (
                                        <tr key={sup.supplierId} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                                                <Building2 size={13} className="text-purple-500" />
                                                {sup.name}
                                            </td>
                                            <td className="py-2.5 px-3.5 font-mono text-emerald-600 font-bold">
                                                {sup.onTimeDelivery}%
                                            </td>
                                            <td className="py-2.5 px-3.5 font-mono text-blue-600 font-bold">
                                                {sup.fulfillmentRate}%
                                            </td>
                                            <td className="py-2.5 px-3.5 text-amber-600 font-bold font-mono">
                                                ★ {sup.qualityRating} / 5.0
                                            </td>
                                            <td className="py-2.5 px-3.5 text-xs">
                                                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px]">
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
        </section>
    );
}
