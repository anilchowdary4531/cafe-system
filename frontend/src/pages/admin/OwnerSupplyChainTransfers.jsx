import React, { useState, useEffect, useMemo } from "react";
import {
    ArrowLeftRight,
    Plus,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    RefreshCw,
    X,
    Eye,
    Truck,
    PackageCheck,
    ArrowRight,
    Check,
    Ban,
    Boxes,
    Warehouse,
    Utensils,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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
            if (trfRes.data?.metrics) setMetrics(trfRes.data.metrics);
            setLocations(locRes.data?.locations || []);
            setRawMaterials(matRes.data?.items || []);
        } catch (err) {
            showToast.error("Failed to load stock transfer requests.");
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
        return transfers.filter((trf) => {
            const matchesSearch =
                (trf.transferCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (trf.itemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (trf.fromName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (trf.toName || "").toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === "ALL" || trf.status === statusFilter;
            const matchesType = typeFilter === "ALL" || trf.transferType === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [transfers, searchQuery, statusFilter, typeFilter]);

    // Handle Create Transfer Submit
    const handleCreateTransfer = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                transferType: createForm.transferType,
                fromLocationId: createForm.fromLocationId ? Number(createForm.fromLocationId) : undefined,
                toLocationId: createForm.toLocationId ? Number(createForm.toLocationId) : undefined,
                fromName: createForm.fromName,
                toName: createForm.toName,
                rawMaterialId: createForm.rawMaterialId ? Number(createForm.rawMaterialId) : undefined,
                itemName: createForm.itemName,
                requestedQty: Number(createForm.requestedQty),
                unit: createForm.unit,
                reason: createForm.reason,
                notes: createForm.notes,
            };

            await api.post("/owner/stock-transfers", payload);
            showToast.success("Stock Transfer request initiated!");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to create transfer request");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Action Modal (Approve / Dispatch / Receive)
    const handleOpenActionModal = (trf, status) => {
        setSelectedTransfer(trf);
        setTargetActionStatus(status);
        setActionForm({
            dispatchedQty: trf.dispatchedQty || trf.requestedQty,
            receivedQty: trf.receivedQty || trf.dispatchedQty || trf.requestedQty,
            discrepancyReason: trf.discrepancyReason || "",
            notes: "",
        });
        setIsActionModalOpen(true);
    };

    // Submit Status Transition (Approve/Dispatch/Receive)
    const handleSubmitAction = async (e) => {
        e.preventDefault();
        if (!selectedTransfer) return;
        setSubmitting(true);

        try {
            const payload = {
                status: targetActionStatus,
                dispatchedQty: Number(actionForm.dispatchedQty),
                receivedQty: Number(actionForm.receivedQty),
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} /> Requested
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <CheckCircle2 size={12} /> Approved
                    </span>
                );
            case "DISPATCHED":
            case "IN_TRANSIT":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                        <Truck size={12} className="animate-pulse" /> In Transit
                    </span>
                );
            case "RECEIVED":
            case "COMPLETED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <PackageCheck size={12} /> Received
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
                        <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Stock Transfers</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <ArrowLeftRight className="text-orange-500" size={20} />
                            Stock Transfers Workflow
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                    >
                        <Plus size={15} />
                        Request Transfer
                    </button>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* Compact Financial KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pb-3 border-b border-slate-200/80 print:hidden">
                <div>
                    <span className="text-xs text-slate-500 font-medium">Total Requests</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.totalTransfers || 0}</div>
                </div>
                <div>
                    <span className="text-xs text-amber-600 font-medium">Pending Approval</span>
                    <div className="text-xl font-bold text-amber-600 mt-0.5">{metrics.requestedCount || 0}</div>
                </div>
                <div>
                    <span className="text-xs text-cyan-600 font-medium">In Transit</span>
                    <div className="text-xl font-bold text-cyan-600 mt-0.5">
                        {(metrics.dispatchedCount || 0) + (metrics.inTransitCount || 0)}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-emerald-600 font-medium">Received / Completed</span>
                    <div className="text-xl font-bold text-emerald-600 mt-0.5">
                        {(metrics.receivedCount || 0) + (metrics.completedCount || 0)}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-rose-600 font-medium">Rejected</span>
                    <div className="text-xl font-bold text-rose-600 mt-0.5">{metrics.rejectedCount || 0}</div>
                </div>
            </div>

            {/* Status Tabs Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200/80 print:hidden">
                {["ALL", "REQUESTED", "APPROVED", "DISPATCHED", "RECEIVED", "REJECTED"].map((st) => (
                    <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                            statusFilter === st
                                ? "bg-orange-500 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                    >
                        {st === "ALL" ? "All Statuses" : st}
                    </button>
                ))}
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 print:hidden">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search Code, Item Name, Source or Destination..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition"
                    />
                </div>
            </div>

            {/* Transfers Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print:hidden">
                <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Inter-Location Transfer Records</h3>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {filteredTransfers.length} Transfers
                    </span>
                </div>

                {loading ? (
                    <div className="p-10 text-center">
                        <RefreshCw size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">Loading transfer records...</p>
                    </div>
                ) : filteredTransfers.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        <ArrowLeftRight size={32} className="text-slate-300 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-slate-800">No transfer records found</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Click "Request Transfer" to initiate a stock movement.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                                    <th className="py-2.5 px-3.5">Transfer Code</th>
                                    <th className="py-2.5 px-3.5">Raw Material Item</th>
                                    <th className="py-2.5 px-3.5">Source → Destination</th>
                                    <th className="py-2.5 px-3.5 text-center">Req / Disp / Rec Qty</th>
                                    <th className="py-2.5 px-3.5">Status</th>
                                    <th className="py-2.5 px-3.5">Reason</th>
                                    <th className="py-2.5 px-3.5 text-right">Workflow Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTransfers.map((trf) => (
                                    <tr key={trf.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-2.5 px-3.5 font-mono font-extrabold text-slate-900 text-xs">
                                            {trf.transferCode}
                                            <span className="text-[10px] text-slate-400 block font-sans font-medium">
                                                {new Date(trf.createdAt).toLocaleDateString("en-IN")}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3.5 font-bold text-slate-900">{trf.itemName}</td>
                                        <td className="py-2.5 px-3.5">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <span className="font-semibold text-slate-900">{trf.fromName}</span>
                                                <ArrowRight size={12} className="text-orange-500 shrink-0" />
                                                <span className="font-semibold text-slate-900">{trf.toName}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3.5 text-center font-bold text-slate-900 font-mono">
                                            {trf.requestedQty} / {trf.dispatchedQty || "-"} / {trf.receivedQty || "-"} {trf.unit}
                                        </td>
                                        <td className="py-2.5 px-3.5">{getStatusBadge(trf.status)}</td>
                                        <td className="py-2.5 px-3.5 text-slate-600">{trf.reason || "—"}</td>
                                        <td className="py-2.5 px-3.5 text-right space-x-1.5">
                                            {trf.status === "REQUESTED" && isManagerOrOwner && (
                                                <>
                                                    <button
                                                        onClick={() => handleOpenActionModal(trf, "APPROVED")}
                                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenActionModal(trf, "REJECTED")}
                                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}

                                            {trf.status === "APPROVED" && (
                                                <button
                                                    onClick={() => handleOpenActionModal(trf, "DISPATCHED")}
                                                    className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                                >
                                                    Dispatch Stock
                                                </button>
                                            )}

                                            {(trf.status === "DISPATCHED" || trf.status === "IN_TRANSIT") && (
                                                <button
                                                    onClick={() => handleOpenActionModal(trf, "RECEIVED")}
                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                                >
                                                    Confirm Receive
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setSelectedTransfer(trf);
                                                    setIsDetailModalOpen(true);
                                                }}
                                                className="px-2 py-1 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CREATE TRANSFER MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 shadow-xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-50 text-orange-500 rounded-xl border border-orange-100">
                                    <ArrowLeftRight size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Request Stock Transfer</h2>
                                    <p className="text-xs text-slate-500">Move raw materials between locations</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTransfer} className="mt-4 space-y-3 text-xs">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Transfer Type *</label>
                                <select
                                    value={createForm.transferType}
                                    onChange={(e) => setCreateForm({ ...createForm, transferType: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                >
                                    <option value="WAREHOUSE_TO_KITCHEN">Warehouse → Central Kitchen</option>
                                    <option value="WAREHOUSE_TO_BRANCH">Warehouse → Branch Store</option>
                                    <option value="LOCATION_TO_LOCATION">Location → Location</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Source Location *</label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.fromName}
                                        onChange={(e) => setCreateForm({ ...createForm, fromName: e.target.value })}
                                        placeholder="e.g. Main Store Warehouse"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Destination Location *</label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.toName}
                                        onChange={(e) => setCreateForm({ ...createForm, toName: e.target.value })}
                                        placeholder="e.g. Central Kitchen"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Item Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={createForm.itemName}
                                    onChange={(e) => setCreateForm({ ...createForm, itemName: e.target.value })}
                                    placeholder="e.g. Tomatoes, Cooking Oil, Paneer"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Quantity Requested *</label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.01"
                                        required
                                        value={createForm.requestedQty}
                                        onChange={(e) => setCreateForm({ ...createForm, requestedQty: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={createForm.unit}
                                        onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                                        placeholder="kg, L, pcs"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Transfer</label>
                                <input
                                    type="text"
                                    value={createForm.reason}
                                    onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                                    placeholder="e.g. Stock Rebalancing, Low Stock Prep"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                                    {submitting ? "Initiating..." : "Submit Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ACTION MODAL (APPROVE / DISPATCH / RECEIVE) */}
            {isActionModalOpen && selectedTransfer && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-xl">
                        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Update Transfer Status: {targetActionStatus}
                                </h2>
                                <p className="text-xs text-slate-500">Transfer Ref: {selectedTransfer.transferCode}</p>
                            </div>
                            <button
                                onClick={() => setIsActionModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAction} className="mt-4 space-y-3 text-xs">
                            {targetActionStatus === "DISPATCHED" && (
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Dispatched Quantity</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={actionForm.dispatchedQty}
                                        onChange={(e) => setActionForm({ ...actionForm, dispatchedQty: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                            )}

                            {targetActionStatus === "RECEIVED" && (
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Actual Received Quantity</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={actionForm.receivedQty}
                                        onChange={(e) => setActionForm({ ...actionForm, receivedQty: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Discrepancy Comments</label>
                                <textarea
                                    rows={2}
                                    placeholder="Add any logistics or receipt comments..."
                                    value={actionForm.notes}
                                    onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsActionModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                                >
                                    <Check size={14} />
                                    {submitting ? "Processing..." : `Confirm ${targetActionStatus}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
