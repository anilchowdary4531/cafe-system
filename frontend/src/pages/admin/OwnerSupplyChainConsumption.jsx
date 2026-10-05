import React, { useState, useEffect, useMemo } from "react";
import {
    Activity,
    Search,
    Filter,
    Calendar,
    TrendingUp,
    RefreshCw,
    Utensils,
    Package,
    Scale,
    FileText,
    ArrowUpRight,
    PieChart,
    Sparkles,
    BarChart2,
    Layers,
    Clock,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function OwnerSupplyChainConsumption() {
    const [consumption, setConsumption] = useState([]);
    const [topIngredients, setTopIngredients] = useState([]);
    const [summary, setSummary] = useState({
        todayCost: 0,
        weekCost: 0,
        monthCost: 0,
        totalConsumptionCost: 0,
        totalOrdersAnalyzed: 0,
        totalConsumptionEvents: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [period, setPeriod] = useState("THIS_WEEK");
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");

    const fetchConsumption = async () => {
        try {
            setRefreshing(true);
            const res = await api.get(`/api/supply/consumption?period=${period}`);
            if (res.data) {
                setConsumption(res.data.consumption || []);
                setTopIngredients(res.data.topIngredients || []);
                if (res.data.summary) {
                    setSummary(res.data.summary);
                }
            }
        } catch (err) {
            console.error("Failed to fetch consumption data:", err);
            showToast.error("Failed to load ingredient consumption intelligence");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchConsumption();
    }, [period]);

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set(consumption.map((c) => c.ingredientCategory).filter(Boolean));
        return ["ALL", ...Array.from(set)];
    }, [consumption]);

    // Filtered Log
    const filteredLogs = useMemo(() => {
        return consumption.filter((item) => {
            const matchesSearch =
                (item.orderNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.menuItemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.ingredientName || "").toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = categoryFilter === "ALL" || item.ingredientCategory === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [consumption, searchQuery, categoryFilter]);

    // Format quantity helper
    const formatQty = (qty, unit) => {
        if (!qty) return `0 ${unit || ""}`;
        if (unit === "g" && qty >= 1000) {
            return `${(qty / 1000).toFixed(2)} kg`;
        }
        if (unit === "ml" && qty >= 1000) {
            return `${(qty / 1000).toFixed(2)} L`;
        }
        return `${Number(qty).toFixed(2)} ${unit || ""}`;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Ingredient Consumption Intelligence</h1>
                            <p className="text-sm text-slate-400">
                                Automatic raw material depletion tracking based on fulfilled orders and active recipe BOMs.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchConsumption}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition font-medium text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Today's Consumption</span>
                        <Clock className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                        ₹{summary.todayCost.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Cost of raw materials used today</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">This Week's Consumption</span>
                        <Calendar className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400">
                        ₹{summary.weekCost.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Cumulative 7-day ingredient cost</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">This Month's Consumption</span>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-bold text-cyan-400">
                        ₹{summary.monthCost.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Monthly raw material COGS</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Orders Analyzed</span>
                        <Utensils className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {summary.totalOrdersAnalyzed} <span className="text-xs text-slate-400 font-normal">Orders</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{summary.totalConsumptionEvents} ingredient log events</p>
                </div>
            </div>

            {/* Top Consumed Ingredients Bar Chart Breakdown */}
            {topIngredients.length > 0 && (
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-emerald-400" /> Top Consumed Ingredients
                            </h3>
                            <p className="text-xs text-slate-400">Highest value raw material consumption in selected period</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {topIngredients.slice(0, 4).map((ing, idx) => {
                            const maxCost = topIngredients[0]?.totalCost || 1;
                            const pct = Math.min(100, Math.round((ing.totalCost / maxCost) * 100));

                            return (
                                <div key={idx} className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">{ing.category}</span>
                                            <h4 className="text-sm font-bold text-white mt-0.5">{ing.name}</h4>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-400">₹{ing.totalCost.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>Volume Used</span>
                                        <span className="font-semibold text-slate-200">{formatQty(ing.totalQuantity, ing.baseUnit)}</span>
                                    </div>

                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filter & Period Toolbar */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search order ref, item or ingredient..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-sm text-slate-200 focus:outline-none"
                        >
                            <option value="ALL" className="bg-slate-900">All Categories</option>
                            {categories.filter((c) => c !== "ALL").map((cat) => (
                                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Period Switcher */}
                    <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs font-medium">
                        <button
                            onClick={() => setPeriod("TODAY")}
                            className={`px-3 py-1.5 rounded-lg transition ${period === "TODAY" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setPeriod("THIS_WEEK")}
                            className={`px-3 py-1.5 rounded-lg transition ${period === "THIS_WEEK" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => setPeriod("THIS_MONTH")}
                            className={`px-3 py-1.5 rounded-lg transition ${period === "THIS_MONTH" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={() => setPeriod("ALL")}
                            className={`px-3 py-1.5 rounded-lg transition ${period === "ALL" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                        >
                            All Time
                        </button>
                    </div>
                </div>
            </div>

            {/* Consumption Log Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-xl">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-white">Consumption Audit Trail</h3>
                        <p className="text-xs text-slate-400">Itemized raw material breakdown per order item sold</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                        {filteredLogs.length} Records
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-16">
                        <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-slate-300">No consumption logs found</h3>
                        <p className="text-sm text-slate-500">Ensure menu items have active recipes mapped to inventory.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Date & Time</th>
                                    <th className="py-3.5 px-4">Order / KOT Ref</th>
                                    <th className="py-3.5 px-4">Menu Item Sold</th>
                                    <th className="py-3.5 px-4">Ingredient Consumed</th>
                                    <th className="py-3.5 px-4 text-right">Quantity Consumed</th>
                                    <th className="py-3.5 px-4 text-right">Ingredient Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                                        <td className="py-3.5 px-4 text-xs text-slate-300">
                                            {new Date(log.date).toLocaleString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                                {log.orderNo}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">{log.tableNo}</span>
                                        </td>
                                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                                            {log.menuItemName} <span className="text-xs font-normal text-slate-400">(x{log.itemQuantity})</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="font-semibold text-white block">{log.ingredientName}</span>
                                            <span className="text-[10px] text-slate-400 uppercase">{log.ingredientCategory}</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                                            {formatQty(log.quantityConsumed, log.baseUnit)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                                            ₹{log.totalCost.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
