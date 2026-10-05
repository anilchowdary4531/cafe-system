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
    AlertTriangle,
    Building2,
    User,
    FileText,
    CheckCircle2,
    Layers,
    Save,
    Clock,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

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
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Wastage Management</h1>
                            <p className="text-sm text-slate-400">
                                Track kitchen spoilage, expiry, and prep waste with auditable stock movements.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchWastageData}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition font-medium text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>

                    <button
                        onClick={handleOpenRecordModal}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-rose-500/10"
                    >
                        <Plus className="w-4 h-4" /> Record Wastage
                    </button>
                </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Today's Wastage</span>
                        <Clock className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-400">
                        ₹{metrics.todayWastageValue.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Value of items wasted today</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">This Month</span>
                        <Calendar className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400">
                        ₹{metrics.monthWastageValue.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Cumulative monthly waste value</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Wastage Value</span>
                        <DollarSign className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        ₹{metrics.totalWastageValue.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Total historical loss recorded</p>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Wastage %</span>
                        <Percent className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                        {metrics.wastagePercent.toFixed(2)}%
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Target benchmark: &lt; 2.5%</p>
                </div>
            </div>

            {/* VISUAL CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Wastage by Category */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-amber-400" /> Wastage by Category
                        </h3>
                    </div>

                    {charts.byCategory.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">No category breakdown data</div>
                    ) : (
                        <div className="space-y-2.5">
                            {charts.byCategory.map((cat, idx) => {
                                const maxVal = charts.byCategory[0]?.value || 1;
                                const pct = Math.round((cat.value / maxVal) * 100);

                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-300 font-medium">{cat.category} ({cat.count})</span>
                                            <span className="text-rose-400 font-bold">₹{cat.value.toFixed(2)}</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Wastage by Item */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-400" /> Top Wasted Items
                        </h3>
                    </div>

                    {charts.byItem.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">No item breakdown data</div>
                    ) : (
                        <div className="space-y-2.5">
                            {charts.byItem.slice(0, 5).map((item, idx) => {
                                const maxVal = charts.byItem[0]?.value || 1;
                                const pct = Math.round((item.value / maxVal) * 100);

                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-300 font-medium truncate max-w-[150px]">{item.item}</span>
                                            <span className="text-amber-400 font-bold">₹{item.value.toFixed(2)}</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Wastage Trend */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-cyan-400" /> 14-Day Wastage Trend
                        </h3>
                    </div>

                    {charts.trend.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">No trend timeline data</div>
                    ) : (
                        <div className="h-36 flex items-end justify-between gap-1.5 pt-4">
                            {charts.trend.map((t, idx) => {
                                const maxVal = Math.max(...charts.trend.map((x) => x.value)) || 1;
                                const heightPct = Math.max(10, Math.round((t.value / maxVal) * 100));

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        {/* Tooltip */}
                                        <div className="absolute -top-8 bg-slate-800 text-[10px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap border border-slate-700 shadow">
                                            ₹{t.value.toFixed(0)}
                                        </div>
                                        <div
                                            className={`w-full rounded-t transition-all ${t.value > 0 ? "bg-cyan-500 hover:bg-cyan-400" : "bg-slate-800"}`}
                                            style={{ height: `${heightPct}%` }}
                                        />
                                        <span className="text-[9px] text-slate-500 tracking-tighter truncate w-full text-center">{t.label.split(" ")[0]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search item, location, or reason..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-sm text-slate-200 focus:outline-none"
                        >
                            <option value="ALL" className="bg-slate-900">All Categories</option>
                            {WASTAGE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Wastage Log Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-xl">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-white">Auditable Wastage Log</h3>
                        <p className="text-xs text-slate-400">Inventory movement records of all recorded spoilage and losses</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                        {filteredLogs.length} Records
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-16">
                        <Trash2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-slate-300">No wastage records found</h3>
                        <p className="text-sm text-slate-500">Click "Record Wastage" to log kitchen waste.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Date & Time</th>
                                    <th className="py-3.5 px-4">Item</th>
                                    <th className="py-3.5 px-4">Reason / Category</th>
                                    <th className="py-3.5 px-4">Location</th>
                                    <th className="py-3.5 px-4 text-right">Quantity</th>
                                    <th className="py-3.5 px-4 text-right">Value</th>
                                    <th className="py-3.5 px-4">Recorded By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                                        <td className="py-3.5 px-4 text-xs text-slate-300">
                                            {new Date(log.date).toLocaleString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="py-3.5 px-4 font-semibold text-slate-100">
                                            {log.itemName}
                                            <span className="text-[10px] text-slate-400 block uppercase">{log.itemCategory}</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                {log.category}
                                            </span>
                                            {log.notes && (
                                                <span className="text-xs text-slate-400 block mt-1 line-clamp-1">{log.notes}</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-slate-300">
                                            {log.location}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-rose-400">
                                            -{log.quantity} {log.unit}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                                            ₹{log.value.toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-slate-300">
                                            {log.recordedBy}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* RECORD WASTAGE MODAL */}
            {isRecordModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Record Kitchen Wastage</h2>
                                    <p className="text-xs text-slate-400">Deduct damaged or spoiled items from inventory</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsRecordModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitWastage} className="p-6 space-y-4">
                            {/* Raw Material Selector */}
                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Select Raw Material Item *</label>
                                <select
                                    required
                                    value={formData.rawMaterialId}
                                    onChange={(e) => handleMaterialChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                                    <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity *</label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.001"
                                        required
                                        placeholder="0.00"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-300 block mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        placeholder="g, ml, pcs"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                            </div>

                            {/* Category Selector */}
                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Wastage Category / Reason *</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                >
                                    {WASTAGE_CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Location Selector */}
                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Storage Location</label>
                                <select
                                    value={formData.locationId}
                                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                >
                                    <option value="">Default / Main Store</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Additional Notes */}
                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Explanation</label>
                                <textarea
                                    rows={2}
                                    placeholder="Explain why item was wasted (e.g. fridge malfunction, burnt during prep)..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            {/* Live Value Preview */}
                            <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 flex items-center justify-between text-xs">
                                <span className="text-slate-300 font-medium">Estimated Loss Value:</span>
                                <span className="text-base font-bold text-rose-400">₹{modalLiveCost.toFixed(2)}</span>
                            </div>

                            {/* Buttons */}
                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRecordModalOpen(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-500/10"
                                >
                                    <Save className="w-4 h-4" />
                                    {submitting ? "Saving..." : "Confirm & Deduct Stock"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
