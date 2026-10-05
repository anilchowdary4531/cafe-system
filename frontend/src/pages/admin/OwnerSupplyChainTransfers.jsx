import React, { useState, useEffect, useMemo } from "react";
import {
    ArrowLeftRight,
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
    Truck,
    PackageCheck,
    ArrowRight,
    User,
    FileText,
    Check,
    Ban,
    Boxes,
    Layers,
    Warehouse,
    Utensils,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";

export default function OwnerSupplyChainTransfers() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [transfers, setTransfers] = useState([]);
    const [metrics, setMetrics] = useState({
        totalTransfers: 0,
        requestedCount: 0,
        approvedCount: 0,
        dispatchedCount: 0,
        inTransitCount: 0,
        receivedCount: 0,
        completedCount: 0,
        rejectedCount: 0,
    });
    const [locations, setLocations] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);

    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [targetActionStatus, setTargetActionStatus] = useState(""); // "APPROVED" | "DISPATCHED" | "RECEIVED" | "COMPLETED" | "REJECTED"
    const [submitting, setSubmitting] = useState(false);

    // Create Form State
    const [createForm, setCreateForm] = useState({
        transferType: "LOCATION_TO_LOCATION",
        fromLocationId: "",
        toLocationId: "",
        fromName: "Main Store Warehouse",
        toName: "Central Kitchen",
        rawMaterialId: "",
        itemName: "",
        requestedQty: 1,
        unit: "kg",
        reason: "Stock Rebalancing",
        notes: "",
    });

    // Action / Receive Form State
    const [actionForm, setActionForm] = useState({
        dispatchedQty: 0,
        receivedQty: 0,
        discrepancyReason: "",
        notes: "",
    });

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [trfRes, locRes, matRes] = await Promise.all([
                api.get("/owner/stock-transfers").catch(() => ({ data: { transfers: [], metrics: {} } })),
                api.get("/owner/storage-locations").catch(() => ({ data: { locations: [] } })),
                api.get("/owner/inventory/movements").catch(() => ({ data: { items: [] } })),
            ]);

            setTransfers(trfRes.data?.transfers || []);
            if (trfRes.data?.metrics) {
                setMetrics(trfRes.data.metrics);
            }
            setLocations(locRes.data?.locations || []);
            setRawMaterials(matRes.data?.items || []);
        } catch (err) {
            showToast.error("Failed to load stock transfers data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filtered Transfers
    const filteredTransfers = useMemo(() => {
        return transfers.filter((t) => {
            const q = searchQuery.toLowerCase();
            const code = (t.transferCode || "").toLowerCase();
            const item = (t.itemName || "").toLowerCase();
            const from = (t.fromLocation?.name || t.fromName || "").toLowerCase();
            const to = (t.toLocation?.name || t.toName || "").toLowerCase();

            const matchesSearch = !q || code.includes(q) || item.includes(q) || from.includes(q) || to.includes(q);
            const matchesStatus = statusFilter === "ALL" || String(t.status).toUpperCase() === statusFilter.toUpperCase();
            const matchesType = typeFilter === "ALL" || String(t.transferType).toUpperCase() === typeFilter.toUpperCase();

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [transfers, searchQuery, statusFilter, typeFilter]);

    // Handle Item Selection in Create Form
    const handleItemSelect = (matId) => {
        const mat = rawMaterials.find((m) => String(m.id) === String(matId));
        if (mat) {
            setCreateForm((prev) => ({
                ...prev,
                rawMaterialId: mat.id,
                itemName: mat.name,
                unit: mat.displayUnit || mat.baseUnit || "kg",
            }));
        }
    };

    // Create Transfer Submit
    const handleCreateTransfer = async (e) => {
        e.preventDefault();
        if (!createForm.itemName || Number(createForm.requestedQty) <= 0) {
            showToast.error("Please specify a valid item and quantity");
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post("/owner/stock-transfers", createForm);
            showToast.success(res.data?.message || "Stock transfer created!");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to create stock transfer");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Action Modal (Approve / Dispatch / Receive / Reject)
    const handleOpenActionModal = (trf, actionStatus) => {
        setSelectedTransfer(trf);
        setTargetActionStatus(actionStatus);
        setActionForm({
            dispatchedQty: trf.dispatchedQty || trf.requestedQty,
            receivedQty: trf.receivedQty || trf.dispatchedQty || trf.requestedQty,
            discrepancyReason: "",
            notes: "",
        });
        setIsActionModalOpen(true);
    };

    // Action Submit (Update Status)
    const handleExecuteStatusUpdate = async (e) => {
        e.preventDefault();
        if (!selectedTransfer) return;

        setSubmitting(true);
        try {
            const payload = {
                status: targetActionStatus,
                dispatchedQty: actionForm.dispatchedQty,
                receivedQty: actionForm.receivedQty,
                discrepancyReason: actionForm.discrepancyReason,
                notes: actionForm.notes,
            };

            const res = await api.put(`/owner/stock-transfers/${selectedTransfer.id}/status`, payload);
            showToast.success(res.data?.message || `Transfer status updated to ${targetActionStatus}`);
            setIsActionModalOpen(false);
            if (isDetailModalOpen) {
                setSelectedTransfer(res.data?.transfer || selectedTransfer);
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to update transfer status");
        } finally {
            setSubmitting(false);
        }
    };

    // Helper for Status Badges
    const getStatusBadge = (status) => {
        const st = String(status || "REQUESTED").toUpperCase();
        switch (st) {
            case "REQUESTED":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5" /> Requested
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                );
            case "DISPATCHED":
            case "IN_TRANSIT":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Truck className="w-3.5 h-3.5 animate-pulse" /> In Transit
                    </span>
                );
            case "RECEIVED":
            case "COMPLETED":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <PackageCheck className="w-3.5 h-3.5" /> Received
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
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
                        <div className="p-2.5 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                            <ArrowLeftRight className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Stock Transfers Workflow</h1>
                            <p className="text-xs text-slate-400">
                                Multi-stage inventory transfers: Warehouse → Kitchen, Warehouse → Branch, Location → Location
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
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-slate-950 font-semibold text-sm shadow-md transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Request Stock Transfer</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TOP METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Transfers */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-md">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                        <span>Total Transfers</span>
                        <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">{metrics.totalTransfers || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-1">All inter-location & branch requests</div>
                </div>

                {/* Requested */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-amber-500/20 shadow-md">
                    <div className="flex items-center justify-between text-amber-400 text-xs font-medium mb-2">
                        <span>Requested</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-300">{metrics.requestedCount || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-1">Awaiting manager approval</div>
                </div>

                {/* Approved */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-blue-500/20 shadow-md">
                    <div className="flex items-center justify-between text-blue-400 text-xs font-medium mb-2">
                        <span>Approved</span>
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-300">{metrics.approvedCount || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-1">Ready for warehouse dispatch</div>
                </div>

                {/* In Transit */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-cyan-500/20 shadow-md">
                    <div className="flex items-center justify-between text-cyan-400 text-xs font-medium mb-2">
                        <span>In Transit</span>
                        <Truck className="w-4 h-4 text-cyan-400 animate-pulse" />
                    </div>
                    <div className="text-2xl font-bold text-cyan-300">
                        {(metrics.dispatchedCount || 0) + (metrics.inTransitCount || 0)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Source stock decremented</div>
                </div>

                {/* Received / Completed */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-emerald-500/20 shadow-md">
                    <div className="flex items-center justify-between text-emerald-400 text-xs font-medium mb-2">
                        <span>Received / Completed</span>
                        <PackageCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-300">
                        {(metrics.receivedCount || 0) + (metrics.completedCount || 0)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Destination stock incremented</div>
                </div>
            </div>

            {/* SEARCH AND FILTER BAR */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Transfer ID, Item Name, Source, Destination..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 text-xs font-medium">
                        {["ALL", "REQUESTED", "APPROVED", "DISPATCHED", "RECEIVED", "COMPLETED"].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                                    statusFilter === st
                                        ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                                }`}
                            >
                                {st === "ALL" ? "All Statuses" : st}
                            </button>
                        ))}
                    </div>

                    {/* Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                        <option value="ALL">All Directions</option>
                        <option value="LOCATION_TO_LOCATION">Storage → Storage</option>
                        <option value="WAREHOUSE_TO_KITCHEN">Warehouse → Kitchen</option>
                        <option value="WAREHOUSE_TO_BRANCH">Warehouse → Branch</option>
                    </select>
                </div>
            </div>

            {/* MAIN TRANSFERS TABLE */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
                        <p className="text-sm">Loading stock transfers workflow data...</p>
                    </div>
                ) : filteredTransfers.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <ArrowLeftRight className="w-12 h-12 stroke-[1.5] text-slate-600 mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-slate-200">No Stock Transfers Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
                                ? "No transfers match your search or filters. Try adjusting your search query."
                                : "Create your first Stock Transfer request to move items across warehouses, kitchens, and branches."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-4 px-5">Transfer ID</th>
                                    <th className="py-4 px-5">From (Source)</th>
                                    <th className="py-4 px-5">To (Destination)</th>
                                    <th className="py-4 px-5">Item</th>
                                    <th className="py-4 px-5 text-right">Qty (Req / Disp / Rec)</th>
                                    <th className="py-4 px-5">Requested By</th>
                                    <th className="py-4 px-5">Date</th>
                                    <th className="py-4 px-5">Status</th>
                                    <th className="py-4 px-5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-sm">
                                {filteredTransfers.map((trf) => {
                                    const fromLocName = trf.fromLocation?.name || trf.fromName || "Main Warehouse";
                                    const toLocName = trf.toLocation?.name || trf.toName || "Kitchen / Branch";

                                    return (
                                        <tr key={trf.id} className="hover:bg-slate-800/30 transition-colors">
                                            {/* Transfer ID */}
                                            <td className="py-4 px-5 font-mono font-semibold text-cyan-400">
                                                {trf.transferCode}
                                            </td>

                                            {/* From */}
                                            <td className="py-4 px-5 text-xs text-slate-200 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{fromLocName}</span>
                                                </div>
                                            </td>

                                            {/* To */}
                                            <td className="py-4 px-5 text-xs text-slate-200 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <Utensils className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{toLocName}</span>
                                                </div>
                                            </td>

                                            {/* Item */}
                                            <td className="py-4 px-5 font-medium text-white">
                                                {trf.itemName}
                                            </td>

                                            {/* Quantity Breakdown */}
                                            <td className="py-4 px-5 text-right font-mono text-xs">
                                                <span className="text-slate-300 font-semibold">{trf.requestedQty}</span> /{" "}
                                                <span className="text-cyan-400">{trf.dispatchedQty}</span> /{" "}
                                                <span className="text-emerald-400 font-bold">{trf.receivedQty}</span>{" "}
                                                <span className="text-slate-500">{trf.unit}</span>
                                            </td>

                                            {/* Requested By */}
                                            <td className="py-4 px-5 text-xs text-slate-400">
                                                {trf.requestedBy?.name || "Staff"}
                                            </td>

                                            {/* Date */}
                                            <td className="py-4 px-5 text-xs text-slate-400">
                                                {new Date(trf.createdAt).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </td>

                                            {/* Status */}
                                            <td className="py-4 px-5">{getStatusBadge(trf.status)}</td>

                                            {/* Actions */}
                                            <td className="py-4 px-5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTransfer(trf);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
                                                        title="View Transfer Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {/* Workflow Action Buttons */}
                                                    {isManagerOrOwner && trf.status === "REQUESTED" && (
                                                        <button
                                                            onClick={() => handleOpenActionModal(trf, "APPROVED")}
                                                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-semibold"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}

                                                    {isManagerOrOwner && (trf.status === "APPROVED" || trf.status === "REQUESTED") && (
                                                        <button
                                                            onClick={() => handleOpenActionModal(trf, "DISPATCHED")}
                                                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold"
                                                        >
                                                            Dispatch
                                                        </button>
                                                    )}

                                                    {isManagerOrOwner && (trf.status === "DISPATCHED" || trf.status === "IN_TRANSIT") && (
                                                        <button
                                                            onClick={() => handleOpenActionModal(trf, "RECEIVED")}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
                                                        >
                                                            Receive
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CREATE TRANSFER REQUEST MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
                                <h2 className="text-lg font-bold text-white">Create Stock Transfer Request</h2>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Transfer Direction / Type</label>
                                <select
                                    value={createForm.transferType}
                                    onChange={(e) => setCreateForm({ ...createForm, transferType: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                                >
                                    <option value="LOCATION_TO_LOCATION">Storage Location → Storage Location</option>
                                    <option value="WAREHOUSE_TO_KITCHEN">Warehouse → Central Kitchen</option>
                                    <option value="WAREHOUSE_TO_BRANCH">Warehouse → Restaurant Branch</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-medium text-slate-400 mb-1">Source Location (From)</label>
                                    <select
                                        value={createForm.fromLocationId}
                                        onChange={(e) => setCreateForm({ ...createForm, fromLocationId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                                    >
                                        <option value="">Select Source Location</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                {l.name} ({l.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-400 mb-1">Destination (To)</label>
                                    <select
                                        value={createForm.toLocationId}
                                        onChange={(e) => setCreateForm({ ...createForm, toLocationId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                                    >
                                        <option value="">Select Destination</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                {l.name} ({l.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Select Raw Material / Item *</label>
                                <select
                                    value={createForm.rawMaterialId}
                                    onChange={(e) => handleItemSelect(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                                >
                                    <option value="">Select Item from Inventory</option>
                                    {rawMaterials.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} (Stock: {m.currentStock || 0} {m.displayUnit || m.baseUnit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-medium text-slate-400 mb-1">Requested Quantity *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={createForm.requestedQty}
                                        onChange={(e) => setCreateForm({ ...createForm, requestedQty: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-400 mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={createForm.unit}
                                        onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Transfer Reason / Purpose</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Daily kitchen prep replenishment"
                                    value={createForm.reason}
                                    onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
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
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-slate-950 font-bold shadow-md disabled:opacity-50"
                                >
                                    {submitting ? "Submitting..." : "Submit Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* WORKFLOW ACTION MODAL (APPROVE / DISPATCH / RECEIVE) */}
            {isActionModalOpen && selectedTransfer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span>Action: {targetActionStatus}</span>
                                </h2>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedTransfer.transferCode}</p>
                            </div>
                            <button
                                onClick={() => setIsActionModalOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Summary Banner */}
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Item:</span>
                                <span className="font-semibold text-white">{selectedTransfer.itemName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Requested Qty:</span>
                                <span className="font-bold text-amber-300">
                                    {selectedTransfer.requestedQty} {selectedTransfer.unit}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleExecuteStatusUpdate} className="space-y-4 text-xs">
                            {targetActionStatus === "DISPATCHED" && (
                                <div>
                                    <label className="block font-medium text-slate-400 mb-1">
                                        Dispatched Quantity (Source stock will be decremented) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={actionForm.dispatchedQty}
                                        onChange={(e) => setActionForm({ ...actionForm, dispatchedQty: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-cyan-400 focus:border-cyan-500 focus:outline-none"
                                    />
                                </div>
                            )}

                            {targetActionStatus === "RECEIVED" && (
                                <>
                                    <div>
                                        <label className="block font-medium text-slate-400 mb-1">
                                            Received Quantity (Destination stock will be incremented) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={actionForm.receivedQty}
                                            onChange={(e) => setActionForm({ ...actionForm, receivedQty: e.target.value })}
                                            required
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>

                                    {Number(actionForm.dispatchedQty) !== Number(actionForm.receivedQty) && (
                                        <div>
                                            <label className="block font-medium text-rose-400 mb-1">
                                                Discrepancy / Variance Reason
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 1 kg spilled / damaged during transit"
                                                value={actionForm.discrepancyReason}
                                                onChange={(e) => setActionForm({ ...actionForm, discrepancyReason: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-800 border border-rose-500/50 rounded-xl text-xs text-slate-100 focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="block font-medium text-slate-400 mb-1">Notes / Remarks</label>
                                <textarea
                                    rows={2}
                                    placeholder="Add optional workflow comments..."
                                    value={actionForm.notes}
                                    onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsActionModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-slate-950 font-bold shadow-md disabled:opacity-50"
                                >
                                    {submitting ? "Executing..." : `Confirm ${targetActionStatus}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TRANSFER DETAIL VIEW MODAL */}
            {isDetailModalOpen && selectedTransfer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold font-mono text-cyan-400">{selectedTransfer.transferCode}</h2>
                                    {getStatusBadge(selectedTransfer.status)}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Transfer Type: <span className="text-slate-200">{selectedTransfer.transferType?.replace("_", " ")}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Source & Destination */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                                <div className="text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                                    <Warehouse className="w-4 h-4 text-cyan-400" />
                                    <span>Source (From)</span>
                                </div>
                                <div className="text-sm font-bold text-white">
                                    {selectedTransfer.fromLocation?.name || selectedTransfer.fromName || "Main Warehouse"}
                                </div>
                            </div>

                            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                                <div className="text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                                    <Utensils className="w-4 h-4 text-emerald-400" />
                                    <span>Destination (To)</span>
                                </div>
                                <div className="text-sm font-bold text-white">
                                    {selectedTransfer.toLocation?.name || selectedTransfer.toName || "Central Kitchen"}
                                </div>
                            </div>
                        </div>

                        {/* Quantity Breakdown Grid */}
                        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Quantity Breakdown & Variance
                            </h3>
                            <div className="grid grid-cols-4 gap-4 text-center">
                                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                                    <div className="text-[11px] text-slate-400">Requested</div>
                                    <div className="text-lg font-bold text-amber-300">
                                        {selectedTransfer.requestedQty} {selectedTransfer.unit}
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                                    <div className="text-[11px] text-slate-400">Dispatched</div>
                                    <div className="text-lg font-bold text-cyan-300">
                                        {selectedTransfer.dispatchedQty} {selectedTransfer.unit}
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                                    <div className="text-[11px] text-slate-400">Received</div>
                                    <div className="text-lg font-bold text-emerald-300">
                                        {selectedTransfer.receivedQty} {selectedTransfer.unit}
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                                    <div className="text-[11px] text-slate-400">Difference</div>
                                    <div className={`text-lg font-bold ${selectedTransfer.differenceQty > 0 ? "text-rose-400" : "text-slate-400"}`}>
                                        {selectedTransfer.differenceQty} {selectedTransfer.unit}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Discrepancy & Notes */}
                        {selectedTransfer.discrepancyReason && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-rose-400" /> Discrepancy Remarks
                                </div>
                                <p>{selectedTransfer.discrepancyReason}</p>
                            </div>
                        )}

                        {/* Audit Log */}
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                            <div className="text-slate-400 font-semibold mb-2">Workflow Timeline & Audit</div>
                            <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                                <span className="text-slate-400">Requested By:</span>
                                <span className="text-slate-200">
                                    {selectedTransfer.requestedBy?.name || "Staff"} on{" "}
                                    {new Date(selectedTransfer.createdAt).toLocaleString("en-IN")}
                                </span>
                            </div>
                            {selectedTransfer.approvedBy && (
                                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                                    <span className="text-slate-400">Approved By:</span>
                                    <span className="text-slate-200">{selectedTransfer.approvedBy.name}</span>
                                </div>
                            )}
                            {selectedTransfer.dispatchedBy && (
                                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                                    <span className="text-slate-400">Dispatched By:</span>
                                    <span className="text-slate-200">
                                        {selectedTransfer.dispatchedBy.name}
                                        {selectedTransfer.dispatchedAt && ` (${new Date(selectedTransfer.dispatchedAt).toLocaleString("en-IN")})`}
                                    </span>
                                </div>
                            )}
                            {selectedTransfer.receivedBy && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Received By:</span>
                                    <span className="text-slate-200">
                                        {selectedTransfer.receivedBy.name}
                                        {selectedTransfer.receivedAt && ` (${new Date(selectedTransfer.receivedAt).toLocaleString("en-IN")})`}
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
