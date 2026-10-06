import React, { useState, useEffect, useMemo } from "react";
import {
    Trash2,
    Plus,
    Search,
    Filter,
    TrendingDown,
    DollarSign,
    Percent,
    PieChart,
    BarChart3,
    Calendar,
    RefreshCw,
    X,
    Save,
    Clock,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

const WASTAGE_CATEGORIES = [
    "Expired",
    "Spoiled",
    "Damaged",
    "Overproduction",
    "Preparation Waste",
    "Kitchen Error",
    "Customer Return",
    "Other",
];

export default function OwnerSupplyChainWastage() {
    const [wastageLogs, setWastageLogs] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [locations, setLocations] = useState([]);
    const [metrics, setMetrics] = useState({
        todayWastageValue: 0,
        monthWastageValue: 0,
        totalWastageValue: 0,
        wastagePercent: 0,
        totalLogsCount: 0,
    });
    const [charts, setCharts] = useState({
        byCategory: [],
        byItem: [],
        trend: [],
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");

    // Modal State
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        rawMaterialId: "",
        quantity: "",
        unit: "g",
        category: "Preparation Waste",
        locationId: "",
        notes: "",
    });

    const fetchWastageData = async () => {
        try {
            setRefreshing(true);
            const res = await api.get("/api/supply/wastage");
            if (res.data) {
                setWastageLogs(res.data.wastage || []);
                setRawMaterials(res.data.rawMaterials || []);
                setLocations(res.data.locations || []);
                if (res.data.metrics) setMetrics(res.data.metrics);
                if (res.data.charts) setCharts(res.data.charts);
            }
        } catch (err) {
            console.error("Failed to fetch wastage data:", err);
            showToast.error("Failed to load wastage management logs");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchWastageData();
    }, []);

    // Filtered Wastage Logs
    const filteredLogs = useMemo(() => {
        return wastageLogs.filter((log) => {
            const matchesSearch =
                (log.itemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.location || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.notes || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.recordedBy || "").toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = categoryFilter === "ALL" || log.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [wastageLogs, searchQuery, categoryFilter]);

    // Open Modal
    const handleOpenRecordModal = () => {
        const firstRm = rawMaterials[0];
        const firstLoc = locations[0];
        setFormData({
            rawMaterialId: firstRm?.id || "",
            quantity: "",
            unit: firstRm?.baseUnit || firstRm?.displayUnit || "g",
            category: "Preparation Waste",
            locationId: firstLoc?.id || "",
            notes: "",
        });
        setIsRecordModalOpen(true);
    };

    // When raw material selection changes
    const handleMaterialChange = (rmId) => {
        const selected = rawMaterials.find((r) => r.id === Number(rmId));
        setFormData((prev) => ({
            ...prev,
            rawMaterialId: rmId,
            unit: selected?.baseUnit || selected?.displayUnit || "g",
        }));
    };

    // Live calculation of wastage cost in modal
    const modalLiveCost = useMemo(() => {
        if (!formData.rawMaterialId || !formData.quantity) return 0;
        const selected = rawMaterials.find((r) => r.id === Number(formData.rawMaterialId));
        if (!selected) return 0;
        return Number(formData.quantity) * (selected.costPerBaseUnit || 0);
    }, [formData.rawMaterialId, formData.quantity, rawMaterials]);

    // Submit Record Wastage
    const handleSubmitWastage = async (e) => {
        e.preventDefault();
        if (!formData.rawMaterialId || !formData.quantity || Number(formData.quantity) <= 0) {
            showToast.error("Please select an item and enter a positive quantity");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                rawMaterialId: Number(formData.rawMaterialId),
                quantity: Number(formData.quantity),
                unit: formData.unit,
                category: formData.category,
                locationId: formData.locationId ? Number(formData.locationId) : undefined,
                notes: formData.notes,
            };

            await api.post("/api/supply/wastage", payload);
            showToast.success("Wastage recorded successfully! Stock deducted.");
            setIsRecordModalOpen(false);
            fetchWastageData();
        } catch (err) {
            console.error("Error recording wastage:", err);
            showToast.error(err.response?.data?.error || "Failed to record wastage");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">Wastage Management</h1>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">
                                Spoilage Audit
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span className="text-slate-700 font-medium">Wastage</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchWastageData}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>

                    <button
                        onClick={handleOpenRecordModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                    >
                        <Plus size={14} /> Record Wastage
                    </button>
                </div>
            </div>

            {/* Subnav */}
            <SupplyChainSubNav />

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Today's Wastage</span>
                        <Clock className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <div className="text-xl font-bold text-rose-600">
                        ₹{metrics.todayWastageValue.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Value wasted today</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>This Month</span>
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-xl font-bold text-amber-600">
                        ₹{metrics.monthWastageValue.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Cumulative monthly waste</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Wastage Value</span>
                        <DollarSign className="w-3.5 h-3.5 text-cyan-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                        ₹{metrics.totalWastageValue.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Total historical loss</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Wastage %</span>
                        <Percent className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <div className={`text-xl font-bold ${metrics.wastagePercent <= 2.5 ? "text-emerald-600" : "text-rose-600"}`}>
                            {metrics.wastagePercent.toFixed(2)}%
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${metrics.wastagePercent <= 2.5 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                            {metrics.wastagePercent <= 2.5 ? "Healthy" : "Alert"}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Target benchmark: &lt; 2.5%</p>
                </div>
            </div>

            {/* Visual Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Wastage by Category */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <PieChart className="w-3.5 h-3.5 text-amber-500" /> Wastage by Category
                        </h3>
                    </div>

                    {charts.byCategory.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">No category breakdown data</div>
                    ) : (
                        <div className="space-y-2">
                            {charts.byCategory.map((cat, idx) => {
                                const maxVal = charts.byCategory[0]?.value || 1;
                                const pct = Math.round((cat.value / maxVal) * 100);

                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-700 font-medium">{cat.category} ({cat.count})</span>
                                            <span className="text-rose-600 font-bold">₹{cat.value.toFixed(2)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Wasted Items */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" /> Top Wasted Items
                        </h3>
                    </div>

                    {charts.byItem.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">No item breakdown data</div>
                    ) : (
                        <div className="space-y-2">
                            {charts.byItem.slice(0, 5).map((item, idx) => {
                                const maxVal = charts.byItem[0]?.value || 1;
                                const pct = Math.round((item.value / maxVal) * 100);

                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-700 font-medium truncate max-w-[150px]">{item.item}</span>
                                            <span className="text-amber-600 font-bold">₹{item.value.toFixed(2)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 14-Day Wastage Trend */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-cyan-500" /> 14-Day Wastage Trend
                        </h3>
                    </div>

                    {charts.trend.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">No trend timeline data</div>
                    ) : (
                        <div className="h-28 flex items-end justify-between gap-1.5 pt-3">
                            {charts.trend.map((t, idx) => {
                                const maxVal = Math.max(...charts.trend.map((x) => x.value)) || 1;
                                const heightPct = Math.max(10, Math.round((t.value / maxVal) * 100));

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        <div className="absolute -top-7 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xs z-10">
                                            ₹{t.value.toFixed(0)}
                                        </div>
                                        <div
                                            className={`w-full rounded-t transition-all ${t.value > 0 ? "bg-cyan-500 hover:bg-cyan-600" : "bg-slate-100"}`}
                                            style={{ height: `${heightPct}%` }}
                                        />
                                        <span className="text-[9px] text-slate-400 tracking-tighter truncate w-full text-center">{t.label.split(" ")[0]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search item, location, or notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
                        >
                            <option value="ALL">All Categories</option>
                            {WASTAGE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Wastage Log Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Auditable Wastage Log</h3>
                        <p className="text-xs text-slate-500">Inventory movement records of all recorded spoilage and losses</p>
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
                        <Trash2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <h3 className="text-xs font-bold text-slate-700">No wastage records found</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                            Click "Record Wastage" to log kitchen waste and deduct items from inventory.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-3.5">Date & Time</th>
                                    <th className="py-2.5 px-3.5">Item</th>
                                    <th className="py-2.5 px-3.5">Reason / Category</th>
                                    <th className="py-2.5 px-3.5">Location</th>
                                    <th className="py-2.5 px-3.5 text-right">Quantity</th>
                                    <th className="py-2.5 px-3.5 text-right">Value</th>
                                    <th className="py-2.5 px-3.5">Recorded By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-2.5 px-3.5 text-slate-600 font-medium">
                                            {new Date(log.date).toLocaleString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                                            {log.itemName}
                                            <span className="text-[10px] text-slate-500 block font-normal uppercase">{log.itemCategory}</span>
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                                {log.category}
                                            </span>
                                            {log.notes && (
                                                <span className="text-[11px] text-slate-500 block mt-0.5 line-clamp-1">{log.notes}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-600">
                                            {log.location}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-rose-600">
                                            -{log.quantity} {log.unit}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">
                                            ₹{log.value.toFixed(2)}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-600">
                                            {log.recordedBy}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Record Wastage Modal */}
            {isRecordModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-5 shadow-xl">
                        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Record Kitchen Wastage</h2>
                                <p className="text-xs text-slate-500">Deduct damaged or spoiled items from inventory</p>
                            </div>
                            <button
                                onClick={() => setIsRecordModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitWastage} className="mt-4 space-y-3.5 text-xs">
                            {/* Raw Material Selector */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Select Raw Material Item *</label>
                                <select
                                    required
                                    value={formData.rawMaterialId}
                                    onChange={(e) => handleMaterialChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="">-- Choose Raw Material --</option>
                                    {rawMaterials.map((rm) => (
                                        <option key={rm.id} value={rm.id}>
                                            {rm.name} (Stock: {rm.currentStock} {rm.baseUnit}) - ₹{rm.costPerBaseUnit}/unit
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Quantity & Unit */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Quantity *</label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.001"
                                        required
                                        placeholder="0.00"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        placeholder="g, ml, pcs"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                            </div>

                            {/* Category Selector */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Wastage Category / Reason *</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    {WASTAGE_CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Location Selector */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Storage Location</label>
                                <select
                                    value={formData.locationId}
                                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="">Default / Main Store</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Additional Notes */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Explanation</label>
                                <textarea
                                    rows={2}
                                    placeholder="Explain why item was wasted..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>

                            {/* Live Value Preview */}
                            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200/80 flex items-center justify-between text-xs">
                                <span className="text-slate-700 font-medium">Estimated Loss Value:</span>
                                <span className="text-sm font-bold text-rose-600">₹{modalLiveCost.toFixed(2)}</span>
                            </div>

                            {/* Buttons */}
                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsRecordModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                                >
                                    <Save size={14} />
                                    {submitting ? "Saving..." : "Confirm & Deduct Stock"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
