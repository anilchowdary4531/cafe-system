import React, { useState, useEffect, useMemo } from "react";
import {
    Activity,
    Search,
    Filter,
    Calendar,
    TrendingUp,
    RefreshCw,
    Utensils,
    Clock,
    BarChart2,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">Consumption Intelligence</h1>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-wider">
                                Real-Time COGS
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span className="text-slate-700 font-medium">Consumption</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchConsumption}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Subnav */}
            <SupplyChainSubNav />

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Today's Consumption</span>
                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-xl font-bold text-emerald-600">
                        ₹{summary.todayCost.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Used today</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>This Week</span>
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-xl font-bold text-amber-600">
                        ₹{summary.weekCost.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Cumulative 7-day cost</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>This Month</span>
                        <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
                    </div>
                    <div className="text-xl font-bold text-cyan-600">
                        ₹{summary.monthCost.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Monthly COGS</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Orders Analyzed</span>
                        <Utensils className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                        {summary.totalOrdersAnalyzed} <span className="text-xs text-slate-400 font-normal">Orders</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{summary.totalConsumptionEvents} log events</p>
                </div>
            </div>

            {/* Top Consumed Ingredients Breakdown */}
            {topIngredients.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                <BarChart2 className="w-3.5 h-3.5 text-emerald-500" /> Top Consumed Ingredients
                            </h3>
                            <p className="text-xs text-slate-500">Highest value raw material consumption in selected period</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {topIngredients.slice(0, 4).map((ing, idx) => {
                            const maxCost = topIngredients[0]?.totalCost || 1;
                            const pct = Math.min(100, Math.round((ing.totalCost / maxCost) * 100));

                            return (
                                <div key={idx} className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider block">{ing.category}</span>
                                            <h4 className="text-xs font-bold text-slate-900 mt-0.5">{ing.name}</h4>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-600">₹{ing.totalCost.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span>Volume Used</span>
                                        <span className="font-semibold text-slate-800">{formatQty(ing.totalQuantity, ing.baseUnit)}</span>
                                    </div>

                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filter & Period Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col sm:flex-row gap-3 justify-between items-center">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search order ref, item or ingredient..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
                        >
                            <option value="ALL">All Categories</option>
                            {categories.filter((c) => c !== "ALL").map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Period Switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto scrollbar-none">
                        {[
                            { id: "TODAY", label: "Today" },
                            { id: "THIS_WEEK", label: "This Week" },
                            { id: "THIS_MONTH", label: "This Month" },
                            { id: "ALL", label: "All Time" },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setPeriod(item.id)}
                                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                                    period === item.id
                                        ? "bg-orange-500 text-white font-bold shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Consumption Log Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Consumption Audit Trail</h3>
                        <p className="text-xs text-slate-500">Itemized raw material breakdown per order item sold</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {filteredLogs.length} Records
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-14 px-4">
                        <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <h3 className="text-xs font-bold text-slate-700">No consumption logs found</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                            Ensure menu items have active recipes mapped to inventory.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-3.5">Date & Time</th>
                                    <th className="py-2.5 px-3.5">Order / KOT Ref</th>
                                    <th className="py-2.5 px-3.5">Menu Item Sold</th>
                                    <th className="py-2.5 px-3.5">Ingredient Consumed</th>
                                    <th className="py-2.5 px-3.5 text-right">Quantity Consumed</th>
                                    <th className="py-2.5 px-3.5 text-right">Ingredient Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-2.5 px-3.5 text-slate-600 font-medium">
                                            {new Date(log.date).toLocaleString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                {log.orderNo}
                                            </span>
                                            <span className="text-[10px] text-slate-500 block mt-0.5">{log.tableNo}</span>
                                        </td>
                                        <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                                            {log.menuItemName} <span className="text-[11px] font-normal text-slate-500">(x{log.itemQuantity})</span>
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                            <span className="font-semibold text-slate-900 block">{log.ingredientName}</span>
                                            <span className="text-[10px] text-slate-500 uppercase">{log.ingredientCategory}</span>
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-600">
                                            {formatQty(log.quantityConsumed, log.baseUnit)}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">
                                            ₹{log.totalCost.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}

