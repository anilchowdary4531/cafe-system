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
    Check,
    TrendingDown,
    TrendingUp,
    Warehouse,
    User,
    FileText,
    DollarSign,
    Save,
    Send,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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

    // Filtered Stock Counts
    const filteredCounts = useMemo(() => {
        return counts.filter((cnt) => {
            const matchesSearch =
                (cnt.countCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (cnt.locationName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (cnt.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (cnt.assignedTo?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === "ALL" || cnt.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [counts, searchQuery, statusFilter]);

    // Create New Stock Count Session
    const handleCreateCount = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                locationId: createForm.locationId ? Number(createForm.locationId) : undefined,
                category: createForm.category,
                notes: createForm.notes,
            };

            const res = await api.post("/owner/stock-counts", payload);
            showToast.success("New Physical Stock Count Session initiated!");
            setIsCreateModalOpen(false);
            setCreateForm({ locationId: "", category: "ALL", notes: "" });

            // Automatically open active counting session if count created
            if (res.data?.count) {
                handleOpenCountingSession(res.data.count);
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to initiate stock count session");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Live Counting Session View
    const handleOpenCountingSession = (cnt) => {
        setActiveCountSession(cnt);
        // Initialize editable item state
        const items = (cnt.items || []).map((it) => ({
            id: it.id,
            rawMaterialId: it.rawMaterialId,
            itemName: it.itemName,
            unit: it.unit,
            systemQty: it.systemQty,
            physicalQty: it.physicalQty !== null && it.physicalQty !== undefined ? it.physicalQty : it.systemQty,
            notes: it.notes || "",
        }));
        setCountingItems(items);
    };

    // Update physical quantity for an item in counting state
    const handlePhysicalQtyChange = (itemId, val) => {
        setCountingItems((prev) =>
            prev.map((it) => {
                if (it.id === itemId) {
                    return { ...it, physicalQty: val === "" ? "" : Number(val) };
                }
                return it;
            })
        );
    };

    // Update item notes in counting state
    const handleItemNotesChange = (itemId, notesVal) => {
        setCountingItems((prev) =>
            prev.map((it) => {
                if (it.id === itemId) {
                    return { ...it, notes: notesVal };
                }
                return it;
            })
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} className="animate-pulse" /> Counting In Progress
                    </span>
                );
            case "REVIEW":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Eye size={12} /> Pending Review
                    </span>
                );
            case "APPROVED":
            case "ADJUSTED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} /> Approved & Adjusted
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle size={12} /> Rejected
                    </span>
                );
            default:
                return <span className="text-xs text-slate-500">{st}</span>;
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
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">Physical Stock Counts & Audit</h1>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-wider">
                                Reconciliation
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span className="text-slate-700 font-medium">Stock Counts</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>

                    {isManagerOrOwner && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                        >
                            <Plus size={14} /> Start Stock Count
                        </button>
                    )}
                </div>
            </div>

            {/* Subnav */}
            <SupplyChainSubNav />

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Total Audits</span>
                        <ClipboardCheck className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{metrics.totalCounts || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Audit sessions</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">
                        <span>In Progress</span>
                        <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    </div>
                    <div className="text-xl font-bold text-amber-600">{metrics.countingCount || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Counting active</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">
                        <span>Pending Review</span>
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <div className="text-xl font-bold text-blue-600">{metrics.reviewCount || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Awaiting manager</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                        <span>Reconciled</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-xl font-bold text-emerald-600">
                        {(metrics.approvedCount || 0) + (metrics.adjustedCount || 0)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Adjustments logged</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600 uppercase tracking-wider mb-1">
                        <span>Variance Value</span>
                        <DollarSign className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <div className="text-xl font-bold text-rose-600">
                        ₹{(metrics.totalVarianceValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Discrepancy total</div>
                </div>
            </div>

            {/* LIVE COUNTING WORKFLOW INTERFACE */}
            {activeCountSession && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">
                                    LIVE COUNTING SESSION
                                </span>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">{activeCountSession.countCode}</h2>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                                Location: <span className="font-semibold text-slate-900">{activeCountSession.locationName}</span> • Category: <span className="font-semibold text-slate-900">{activeCountSession.category}</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSaveCountingProgress("COUNTING")}
                                disabled={submitting}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                                <Save className="w-3.5 h-3.5 text-amber-500" />
                                <span>Save Progress</span>
                            </button>

                            <button
                                onClick={() => handleSaveCountingProgress("REVIEW")}
                                disabled={submitting}
                                className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Submit for Review</span>
                            </button>

                            <button
                                onClick={() => setActiveCountSession(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                                title="Close Live View"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Active Items Table */}
                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-2.5 px-3">Item Name</th>
                                    <th className="py-2.5 px-3">Category</th>
                                    <th className="py-2.5 px-3 text-right">System Qty</th>
                                    <th className="py-2.5 px-3 text-center">Physical Qty (Counted)</th>
                                    <th className="py-2.5 px-3 text-right">Difference</th>
                                    <th className="py-2.5 px-3 text-right">Variance Value</th>
                                    <th className="py-2.5 px-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(activeCountSession.items || []).map((it) => {
                                    const stateItem = countingItems.find((c) => c.id === it.id) || {
                                        physicalQty: it.physicalQty,
                                        notes: "",
                                    };
                                    const physicalVal = Number(stateItem.physicalQty !== undefined ? stateItem.physicalQty : it.systemQty);
                                    const diff = physicalVal - it.systemQty;
                                    const varVal = Math.abs(diff) * (it.costPerUnit || 0);

                                    return (
                                        <tr key={it.id} className="hover:bg-slate-50/70 transition">
                                            <td className="py-2 px-3 text-slate-900 font-semibold">{it.itemName}</td>
                                            <td className="py-2 px-3 text-slate-500">{it.category}</td>
                                            <td className="py-2 px-3 text-right font-semibold text-slate-700">
                                                {it.systemQty} {it.unit}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={stateItem.physicalQty}
                                                    onChange={(e) => handlePhysicalQtyChange(it.id, e.target.value)}
                                                    className="w-20 px-2 py-1 bg-amber-50/40 border border-slate-300 rounded-lg text-center text-xs font-bold text-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold">
                                                {diff === 0 ? (
                                                    <span className="text-slate-400">0</span>
                                                ) : diff < 0 ? (
                                                    <span className="text-rose-600 inline-flex items-center gap-0.5">
                                                        <TrendingDown className="w-3 h-3" /> {diff.toFixed(2)} {it.unit}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-600 inline-flex items-center gap-0.5">
                                                        <TrendingUp className="w-3 h-3" /> +{diff.toFixed(2)} {it.unit}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-amber-700">
                                                ₹{varVal.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    placeholder="Reason..."
                                                    value={stateItem.notes}
                                                    onChange={(e) => handleItemNotesChange(it.id, e.target.value)}
                                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
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

            {/* SEARCH AND STATUS FILTERS BAR */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Count ID, Location, Category, Staff..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {["ALL", "COUNTING", "REVIEW", "APPROVED", "ADJUSTED"].map((st) => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                statusFilter === st
                                    ? "bg-orange-500 text-white shadow-2xs"
                                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                            }`}
                        >
                            {st === "ALL" ? "All Audits" : st === "COUNTING" ? "Counting" : st === "REVIEW" ? "Pending Review" : st.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* AUDIT LOG TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Physical Stock Count Log</h3>
                        <p className="text-xs text-slate-500">Auditable physical inventory reconciliation records</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {filteredCounts.length} Audits
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                    </div>
                ) : filteredCounts.length === 0 ? (
                    <div className="text-center py-14 px-4">
                        <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <h3 className="text-xs font-bold text-slate-700">No stock counts found</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                            Start a stock count session to audit physical inventory vs system stock.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-3.5">Count Code</th>
                                    <th className="py-2.5 px-3.5">Location</th>
                                    <th className="py-2.5 px-3.5">Category</th>
                                    <th className="py-2.5 px-3.5">Status</th>
                                    <th className="py-2.5 px-3.5 text-center">Items Audited</th>
                                    <th className="py-2.5 px-3.5 text-right">Variance Value</th>
                                    <th className="py-2.5 px-3.5">Assigned To</th>
                                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCounts.map((cnt) => (
                                    <tr key={cnt.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                                            {cnt.countCode}
                                            <span className="text-[10px] text-slate-500 block font-sans font-normal">
                                                {new Date(cnt.createdAt).toLocaleDateString("en-IN")}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3.5 font-medium text-slate-800">{cnt.locationName}</td>
                                        <td className="py-2.5 px-3.5 text-slate-600">{cnt.category}</td>
                                        <td className="py-2.5 px-3.5">{getStatusBadge(cnt.status)}</td>
                                        <td className="py-2.5 px-3.5 text-center font-semibold text-slate-800">
                                            {cnt.itemCount || (cnt.items || []).length}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right font-bold text-rose-600">
                                            ₹{(cnt.totalVarianceValue || 0).toFixed(2)}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-600">
                                            {cnt.assignedTo?.name || "Unassigned"}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right space-x-1.5">
                                            {cnt.status === "COUNTING" && (
                                                <button
                                                    onClick={() => handleOpenCountingSession(cnt)}
                                                    className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-[11px] transition shadow-2xs cursor-pointer"
                                                >
                                                    Continue Count
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setSelectedCount(cnt);
                                                    setIsDetailModalOpen(true);
                                                }}
                                                className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-[11px] transition cursor-pointer"
                                            >
                                                View Audit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CREATE COUNT MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-xl">
                        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Start Stock Count Session</h2>
                                <p className="text-xs text-slate-500">Initiate physical inventory counting</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCount} className="mt-4 space-y-3.5 text-xs">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Storage Location *</label>
                                <select
                                    required
                                    value={createForm.locationId}
                                    onChange={(e) => setCreateForm({ ...createForm, locationId: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="">-- Select Location --</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Item Category Filter</label>
                                <select
                                    value={createForm.category}
                                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="ALL">All Categories</option>
                                    <option value="Produce">Produce</option>
                                    <option value="Meat">Meat & Poultry</option>
                                    <option value="Dairy">Dairy</option>
                                    <option value="Dry Goods">Dry Goods</option>
                                    <option value="Beverages">Beverages</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Instructions / Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Enter instructions for counting staff..."
                                    value={createForm.notes}
                                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                                >
                                    <Plus size={14} />
                                    {submitting ? "Initiating..." : "Start Count"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AUDIT DETAIL MODAL */}
            {isDetailModalOpen && selectedCount && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl p-5 shadow-xl">
                        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <span>Stock Count Audit Details</span>
                                    <span className="font-mono text-xs text-orange-600">({selectedCount.countCode})</span>
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Location: {selectedCount.locationName} • Created on {new Date(selectedCount.createdAt).toLocaleDateString("en-IN")}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Current Status</span>
                                    <div className="mt-1">{getStatusBadge(selectedCount.status)}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Total Discrepancy Value</span>
                                    <span className="text-sm font-bold text-rose-600">
                                        ₹{(selectedCount.totalVarianceValue || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Manager Approval Button */}
                            {isManagerOrOwner && selectedCount.status === "REVIEW" && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between gap-3">
                                    <div className="text-xs text-amber-800 font-medium">
                                        Staff has completed physical count. Review variances and approve to auto-adjust inventory stock ledger.
                                    </div>
                                    <button
                                        onClick={() => handleApproveCount(selectedCount.id)}
                                        disabled={submitting}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
                                    >
                                        <Check size={14} /> Approve & Adjust Stock
                                    </button>
                                </div>
                            )}

                            {/* Itemized Table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                                            <th className="py-2.5 px-3">Item</th>
                                            <th className="py-2.5 px-3 text-right">System Qty</th>
                                            <th className="py-2.5 px-3 text-right">Physical Qty</th>
                                            <th className="py-2.5 px-3 text-right">Diff</th>
                                            <th className="py-2.5 px-3 text-right">Variance Value</th>
                                            <th className="py-2.5 px-3">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(selectedCount.items || []).map((it) => (
                                            <tr key={it.id} className="hover:bg-slate-50 transition">
                                                <td className="py-2.5 px-3 font-semibold text-slate-800">{it.itemName}</td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    {it.systemQty} {it.unit}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-orange-600">
                                                    {it.physicalQty} {it.unit}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold">
                                                    {it.difference === 0 ? (
                                                        <span className="text-slate-400">0</span>
                                                    ) : it.difference < 0 ? (
                                                        <span className="text-rose-600">{it.difference.toFixed(2)} {it.unit}</span>
                                                    ) : (
                                                        <span className="text-emerald-600">+{it.difference.toFixed(2)} {it.unit}</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                                                    ₹{(it.varianceValue || 0).toFixed(2)}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-500">{it.notes || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
