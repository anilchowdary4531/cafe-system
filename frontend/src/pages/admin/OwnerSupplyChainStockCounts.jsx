import React, { useState, useEffect, useMemo } from "react";
import {
    ClipboardCheck,
    Plus,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    Building2,
    Calendar,
    RefreshCw,
    X,
    Eye,
    AlertTriangle,
    ShieldAlert,
    Check,
    TrendingDown,
    TrendingUp,
    Warehouse,
    User,
    FileText,
    History,
    SlidersHorizontal,
    DollarSign,
    Save,
    Send,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";

export default function OwnerSupplyChainStockCounts() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [counts, setCounts] = useState([]);
    const [metrics, setMetrics] = useState({
        totalCounts: 0,
        countingCount: 0,
        reviewCount: 0,
        approvedCount: 0,
        adjustedCount: 0,
        totalVarianceValue: 0,
    });
    const [locations, setLocations] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // Active Session & Modals
    const [activeCountSession, setActiveCountSession] = useState(null); // When performing live counting
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedCount, setSelectedCount] = useState(null);

    const [submitting, setSubmitting] = useState(false);

    // Create Count Form State
    const [createForm, setCreateForm] = useState({
        locationId: "",
        category: "ALL",
        notes: "",
    });

    // Editable Items in Counting Session
    const [countingItems, setCountingItems] = useState([]);

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [cntRes, locRes] = await Promise.all([
                api.get("/owner/stock-counts").catch(() => ({ data: { counts: [], metrics: {} } })),
                api.get("/owner/storage-locations").catch(() => ({ data: { locations: [] } })),
            ]);

            setCounts(cntRes.data?.counts || []);
            if (cntRes.data?.metrics) {
                setMetrics(cntRes.data.metrics);
            }
            setLocations(locRes.data?.locations || []);
        } catch (err) {
            showToast.error("Failed to load physical stock count audit data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filtered Counts
    const filteredCounts = useMemo(() => {
        return counts.filter((c) => {
            const q = searchQuery.toLowerCase();
            const code = (c.countCode || "").toLowerCase();
            const locName = (c.locationName || "").toLowerCase();
            const cat = (c.category || "").toLowerCase();
            const assigned = (c.assignedTo?.name || "").toLowerCase();

            const matchesSearch = !q || code.includes(q) || locName.includes(q) || cat.includes(q) || assigned.includes(q);
            const matchesStatus = statusFilter === "ALL" || String(c.status).toUpperCase() === statusFilter.toUpperCase();

            return matchesSearch && matchesStatus;
        });
    }, [counts, searchQuery, statusFilter]);

    // Start New Physical Count Session
    const handleStartCount = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post("/owner/stock-counts", createForm);
            showToast.success(res.data?.message || "Physical stock count session started!");
            setIsCreateModalOpen(false);

            // Open counting session directly
            const newSession = res.data?.count;
            if (newSession) {
                setActiveCountSession(newSession);
                setCountingItems(
                    (newSession.items || []).map((it) => ({
                        id: it.id,
                        physicalQty: it.physicalQty,
                        notes: it.notes || "",
                    }))
                );
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to start stock count");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Existing Counting Session
    const handleOpenCountingSession = (cnt) => {
        setActiveCountSession(cnt);
        setCountingItems(
            (cnt.items || []).map((it) => ({
                id: it.id,
                physicalQty: it.physicalQty !== undefined ? it.physicalQty : it.systemQty,
                notes: it.notes || "",
            }))
        );
    };

    // Update Item Physical Quantity in Local State
    const handlePhysicalQtyChange = (itemId, val) => {
        setCountingItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, physicalQty: val } : it))
        );
    };

    const handleItemNotesChange = (itemId, text) => {
        setCountingItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, notes: text } : it))
        );
    };

    // Save or Submit Counting Progress
    const handleSaveCountingProgress = async (targetStatus = "REVIEW") => {
        if (!activeCountSession) return;
        setSubmitting(true);
        try {
            const payload = {
                status: targetStatus,
                items: countingItems,
            };

            const res = await api.put(`/owner/stock-counts/${activeCountSession.id}/items`, payload);
            showToast.success(
                targetStatus === "REVIEW"
                    ? "Stock count submitted for Manager Review!"
                    : "Stock count progress saved!"
            );
            if (targetStatus === "REVIEW") {
                setActiveCountSession(null);
            } else {
                setActiveCountSession(res.data?.count || activeCountSession);
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to update stock count progress");
        } finally {
            setSubmitting(false);
        }
    };

    // Approve Count & Apply Adjustments (Manager Action)
    const handleApproveCount = async (countId) => {
        setSubmitting(true);
        try {
            const res = await api.put(`/owner/stock-counts/${countId}/approve`, { status: "APPROVED" });
            showToast.success(res.data?.message || "Physical Stock Count approved & stock adjusted!");
            if (isDetailModalOpen) {
                setSelectedCount(res.data?.count || selectedCount);
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to approve stock count");
        } finally {
            setSubmitting(false);
        }
    };

    // Helper Status Badges
    const getStatusBadge = (status) => {
        const st = String(status || "COUNTING").toUpperCase();
        switch (st) {
            case "COUNTING":
            case "DRAFT":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5 animate-pulse" /> Counting In Progress
                    </span>
                );
            case "REVIEW":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Eye className="w-3.5 h-3.5" /> Pending Review
                    </span>
                );
            case "APPROVED":
            case "ADJUSTED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Adjusted
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" /> Rejected
                    </span>
                );
            default:
                return <span className="text-xs text-slate-400">{st}</span>;
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6 text-slate-100 font-sans">
            {/* TOP HEADER BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Physical Stock Counts & Audit</h1>
                            <p className="text-xs text-slate-400">
                                Compare physical stock vs system inventory, reconcile variances, and log manager-approved adjustments
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60 disabled:opacity-50"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    </button>

                    {isManagerOrOwner && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold text-sm shadow-md transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Start Stock Count</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TOP METRICS SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Audits */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-md">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                        <span>Total Audits</span>
                        <ClipboardCheck className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">{metrics.totalCounts || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-1">Audit sessions created</div>
                </div>

                {/* Counting In Progress */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-amber-500/20 shadow-md">
                    <div className="flex items-center justify-between text-amber-400 text-xs font-medium mb-2">
                        <span>In Progress</span>
                        <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>
                    <div className="text-2xl font-bold text-amber-300">{metrics.countingCount || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-1">Active staff counting sessions</div>
                </div>

                {/* Pending Review */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-blue-500/20 shadow-md">
                    <div className="flex items-center justify-between text-blue-400 text-xs font-medium mb-2">
                        <span>Pending Review</span>
                        <Eye className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-300">{metrics.reviewCount || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-1">Awaiting manager approval</div>
                </div>

                {/* Approved & Adjusted */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-emerald-500/20 shadow-md">
                    <div className="flex items-center justify-between text-emerald-400 text-xs font-medium mb-2">
                        <span>Approved & Adjusted</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-300">
                        {(metrics.approvedCount || 0) + (metrics.adjustedCount || 0)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Stock variances reconciled</div>
                </div>

                {/* Total Variance Value */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-rose-500/20 shadow-md">
                    <div className="flex items-center justify-between text-rose-400 text-xs font-medium mb-2">
                        <span>Total Variance Value</span>
                        <DollarSign className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-300">
                        ₹{(metrics.totalVarianceValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Absolute discrepancy value</div>
                </div>
            </div>

            {/* ACTIVE COUNTING SESSION WORKFLOW INTERFACE */}
            {activeCountSession && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-indigo-500/40 shadow-2xl space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    LIVE COUNTING SESSION
                                </span>
                                <h2 className="text-xl font-bold text-white font-mono">{activeCountSession.countCode}</h2>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Location: <span className="text-slate-200 font-semibold">{activeCountSession.locationName}</span> • Category:{" "}
                                <span className="text-slate-200 font-semibold">{activeCountSession.category}</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleSaveCountingProgress("COUNTING")}
                                disabled={submitting}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700/60 flex items-center gap-1.5"
                            >
                                <Save className="w-4 h-4 text-amber-400" />
                                <span>Save Progress</span>
                            </button>

                            <button
                                onClick={() => handleSaveCountingProgress("REVIEW")}
                                disabled={submitting}
                                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                            >
                                <Send className="w-4 h-4" />
                                <span>Submit for Review</span>
                            </button>

                            <button
                                onClick={() => setActiveCountSession(null)}
                                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                                title="Close Live View"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Active Items Table */}
                    <div className="overflow-x-auto bg-slate-950/80 rounded-xl border border-slate-800">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                                <tr>
                                    <th className="py-3 px-4">Item Name</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4 text-right">System Quantity</th>
                                    <th className="py-3 px-4 text-center">Physical Quantity (Counted)</th>
                                    <th className="py-3 px-4 text-right">Difference</th>
                                    <th className="py-3 px-4 text-right">Variance Value (₹)</th>
                                    <th className="py-3 px-4">Notes / Explanation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {(activeCountSession.items || []).map((it) => {
                                    const stateItem = countingItems.find((c) => c.id === it.id) || {
                                        physicalQty: it.physicalQty,
                                        notes: "",
                                    };
                                    const physicalVal = Number(stateItem.physicalQty !== undefined ? stateItem.physicalQty : it.systemQty);
                                    const diff = physicalVal - it.systemQty;
                                    const varVal = Math.abs(diff) * (it.costPerUnit || 0);

                                    return (
                                        <tr key={it.id} className="hover:bg-slate-800/30">
                                            <td className="py-3 px-4 text-slate-200 font-semibold">{it.itemName}</td>
                                            <td className="py-3 px-4 text-slate-400">{it.category}</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-300">
                                                {it.systemQty} {it.unit}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={stateItem.physicalQty}
                                                    onChange={(e) => handlePhysicalQtyChange(it.id, e.target.value)}
                                                    className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-bold text-center text-sm text-cyan-300 focus:border-indigo-500 focus:outline-none"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold font-mono">
                                                {diff === 0 ? (
                                                    <span className="text-slate-500">0</span>
                                                ) : diff < 0 ? (
                                                    <span className="text-rose-400 flex items-center justify-end gap-1">
                                                        <TrendingDown className="w-3.5 h-3.5" /> {diff.toFixed(2)} {it.unit}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-400 flex items-center justify-end gap-1">
                                                        <TrendingUp className="w-3.5 h-3.5" /> +{diff.toFixed(2)} {it.unit}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-amber-300">
                                                ₹{varVal.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="text"
                                                    placeholder="Reason for discrepancy..."
                                                    value={stateItem.notes}
                                                    onChange={(e) => handleItemNotesChange(it.id, e.target.value)}
                                                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700/60 rounded text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SEARCH AND FILTER BAR */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Count ID, Location, Category, Assigned Counter..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 text-xs font-medium">
                    {["ALL", "COUNTING", "REVIEW", "APPROVED", "ADJUSTED"].map((st) => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === st
                                    ? "bg-indigo-500 text-white font-bold shadow-sm"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                            }`}
                        >
                            {st === "ALL" ? "All Audits" : st.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* AUDIT HISTORY TABLE */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-sm">Loading physical stock count history & audit trail...</p>
                    </div>
                ) : filteredCounts.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <ClipboardCheck className="w-12 h-12 stroke-[1.5] text-slate-600 mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-slate-200">No Physical Stock Counts Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            {searchQuery || statusFilter !== "ALL"
                                ? "No stock count sessions match your active filters. Adjust your search parameters."
                                : "Start your first Physical Stock Count audit to reconcile physical stock against system inventory."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-4 px-5">Count ID</th>
                                    <th className="py-4 px-5">Location</th>
                                    <th className="py-4 px-5">Category</th>
                                    <th className="py-4 px-5 text-right">Items Counted</th>
                                    <th className="py-4 px-5 text-right">Variance Count</th>
                                    <th className="py-4 px-5 text-right">Total Variance (₹)</th>
                                    <th className="py-4 px-5">Assigned Staff</th>
                                    <th className="py-4 px-5">Date</th>
                                    <th className="py-4 px-5">Status</th>
                                    <th className="py-4 px-5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-sm">
                                {filteredCounts.map((cnt) => (
                                    <tr key={cnt.id} className="hover:bg-slate-800/30 transition-colors">
                                        {/* Count Code */}
                                        <td className="py-4 px-5 font-mono font-semibold text-indigo-400">
                                            {cnt.countCode}
                                        </td>

                                        {/* Location */}
                                        <td className="py-4 px-5 font-medium text-slate-200">
                                            {cnt.locationName}
                                        </td>

                                        {/* Category */}
                                        <td className="py-4 px-5 text-xs text-slate-400">
                                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                                                {cnt.category}
                                            </span>
                                        </td>

                                        {/* Total Items */}
                                        <td className="py-4 px-5 text-right font-bold text-slate-200">
                                            {cnt.totalItems}
                                        </td>

                                        {/* Variance Items */}
                                        <td className="py-4 px-5 text-right font-bold">
                                            <span className={cnt.varianceItems > 0 ? "text-rose-400" : "text-emerald-400"}>
                                                {cnt.varianceItems}
                                            </span>
                                        </td>

                                        {/* Total Variance Value */}
                                        <td className="py-4 px-5 text-right font-bold text-amber-300">
                                            ₹{(cnt.totalVarianceValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>

                                        {/* Assigned Staff */}
                                        <td className="py-4 px-5 text-xs text-slate-400">
                                            {cnt.assignedTo?.name || "Unassigned"}
                                        </td>

                                        {/* Date */}
                                        <td className="py-4 px-5 text-xs text-slate-400">
                                            {new Date(cnt.createdAt).toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>

                                        {/* Status */}
                                        <td className="py-4 px-5">{getStatusBadge(cnt.status)}</td>

                                        {/* Actions */}
                                        <td className="py-4 px-5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* Open Live Count Interface */}
                                                {(cnt.status === "COUNTING" || cnt.status === "DRAFT") && (
                                                    <button
                                                        onClick={() => handleOpenCountingSession(cnt)}
                                                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold"
                                                    >
                                                        Continue Count
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        setSelectedCount(cnt);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
                                                    title="View Audit Detail"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                {/* Manager Approval Button */}
                                                {isManagerOrOwner && cnt.status === "REVIEW" && (
                                                    <button
                                                        onClick={() => handleApproveCount(cnt.id)}
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold"
                                                    >
                                                        Approve & Adjust
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CREATE / START COUNT SESSION MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-lg font-bold text-white">Start Physical Stock Count</h2>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleStartCount} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Select Storage Location</label>
                                <select
                                    value={createForm.locationId}
                                    onChange={(e) => setCreateForm({ ...createForm, locationId: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                                >
                                    <option value="">All Storage Zones & Warehouses</option>
                                    {locations.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name} ({l.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Category Filter</label>
                                <select
                                    value={createForm.category}
                                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                                >
                                    <option value="ALL">All Categories</option>
                                    <option value="Produce">Produce & Fresh Vegetables</option>
                                    <option value="Meat">Meats & Seafood</option>
                                    <option value="Dairy">Dairy & Cheese</option>
                                    <option value="Dry Goods">Dry Goods & Grains</option>
                                    <option value="Beverages">Beverages & Coffee</option>
                                    <option value="Packaging">Packaging & Consumables</option>
                                </select>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Audit Notes / Directives</label>
                                <textarea
                                    rows={2}
                                    placeholder="Add instructions for counter staff..."
                                    value={createForm.notes}
                                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold shadow-md disabled:opacity-50"
                                >
                                    {submitting ? "Initializing..." : "Start Count Audit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* COUNT DETAIL VIEW MODAL */}
            {isDetailModalOpen && selectedCount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold font-mono text-indigo-400">{selectedCount.countCode}</h2>
                                    {getStatusBadge(selectedCount.status)}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Location: <span className="text-slate-200">{selectedCount.locationName}</span> • Category:{" "}
                                    <span className="text-slate-200">{selectedCount.category}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Summary Metrics Banner */}
                        <div className="grid grid-cols-4 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-center text-xs">
                            <div>
                                <div className="text-slate-400">Total Items</div>
                                <div className="text-lg font-bold text-white">{selectedCount.totalItems}</div>
                            </div>
                            <div>
                                <div className="text-slate-400">Matched</div>
                                <div className="text-lg font-bold text-emerald-400">{selectedCount.matchedItems}</div>
                            </div>
                            <div>
                                <div className="text-slate-400">Variances</div>
                                <div className="text-lg font-bold text-rose-400">{selectedCount.varianceItems}</div>
                            </div>
                            <div>
                                <div className="text-slate-400">Variance Value</div>
                                <div className="text-lg font-bold text-amber-300">
                                    ₹{(selectedCount.totalVarianceValue || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Manager Approval Banner */}
                        {isManagerOrOwner && selectedCount.status === "REVIEW" && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-4">
                                <div className="text-xs text-emerald-300">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4" /> Ready for Manager Approval
                                    </div>
                                    <p className="mt-0.5">
                                        Approving will automatically update system inventory stock balances and log auditable movements.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleApproveCount(selectedCount.id)}
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md whitespace-nowrap"
                                >
                                    Approve & Apply Adjustments
                                </button>
                            </div>
                        )}

                        {/* Item Breakdown Table */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-200">Item Variance Breakdown</h3>
                            <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                                        <tr>
                                            <th className="py-2.5 px-4">Item Name</th>
                                            <th className="py-2.5 px-4 text-right">System Qty</th>
                                            <th className="py-2.5 px-4 text-right">Physical Qty</th>
                                            <th className="py-2.5 px-4 text-right">Difference</th>
                                            <th className="py-2.5 px-4 text-right">Variance Value (₹)</th>
                                            <th className="py-2.5 px-4">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {(selectedCount.items || []).map((it) => (
                                            <tr key={it.id}>
                                                <td className="py-2.5 px-4 font-semibold text-slate-200">{it.itemName}</td>
                                                <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                                                    {it.systemQty} {it.unit}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-mono font-bold text-cyan-300">
                                                    {it.physicalQty} {it.unit}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-mono font-bold">
                                                    {it.difference === 0 ? (
                                                        <span className="text-slate-500">0</span>
                                                    ) : it.difference < 0 ? (
                                                        <span className="text-rose-400">{it.difference.toFixed(2)} {it.unit}</span>
                                                    ) : (
                                                        <span className="text-emerald-400">+{it.difference.toFixed(2)} {it.unit}</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-bold text-amber-300">
                                                    ₹{(it.varianceValue || 0).toFixed(2)}
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-400">{it.notes || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Audit Trail Info */}
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                            <div className="text-slate-400 font-semibold mb-1">Audit Trail & Sign-offs</div>
                            <div className="flex justify-between border-b border-slate-800/60 pb-1">
                                <span className="text-slate-400">Created / Counter Staff:</span>
                                <span className="text-slate-200">
                                    {selectedCount.assignedTo?.name || selectedCount.createdBy?.name || "Staff"} on{" "}
                                    {new Date(selectedCount.createdAt).toLocaleString("en-IN")}
                                </span>
                            </div>
                            {selectedCount.approvedBy && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Approved By Manager:</span>
                                    <span className="text-emerald-400 font-semibold">
                                        {selectedCount.approvedBy.name} on{" "}
                                        {selectedCount.approvedAt && new Date(selectedCount.approvedAt).toLocaleString("en-IN")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
