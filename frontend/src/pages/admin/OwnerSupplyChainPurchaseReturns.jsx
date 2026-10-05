import React, { useState, useEffect, useMemo } from "react";
import {
    Undo2,
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
    Check,
    Eye,
    AlertTriangle,
    ShieldAlert,
    FileText,
    DollarSign,
    PackageCheck,
    Paperclip,
    ArrowLeftRight,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";

export default function OwnerSupplyChainPurchaseReturns() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [returns, setReturns] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [grns, setGrns] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [reasonFilter, setReasonFilter] = useState("ALL");

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [submittingAction, setSubmittingAction] = useState(false);
    const [targetConfirmStatus, setTargetConfirmStatus] = useState("APPROVED");

    // Create Return Form State
    const [returnForm, setReturnForm] = useState({
        supplierId: "",
        grnId: "",
        supplyOrderId: "",
        rawMaterialId: "",
        itemName: "",
        quantity: 5,
        unit: "kg",
        unitPrice: 120,
        reason: "Damaged",
        resolution: "REFUND",
        notes: "Packaging damaged during transit, goods oxidized.",
        attachmentUrl: "",
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [retRes, supRes, grnRes, poRes, matRes] = await Promise.all([
                api.get("/api/owner/purchase-returns").catch(() => ({ data: { returns: [] } })),
                api.get("/api/owner/suppliers").catch(() => ({ data: { suppliers: [] } })),
                api.get("/api/owner/goods-receipts").catch(() => ({ data: { grns: [] } })),
                api.get("/api/owner/purchase-orders").catch(() => ({ data: { orders: [] } })),
                api.get("/api/owner/inventory").catch(() => ({ data: { items: [] } })),
            ]);

            setReturns(retRes.data?.returns || []);
            setSuppliers(supRes.data?.suppliers || []);
            setGrns(grnRes.data?.grns || []);
            setPurchaseOrders(poRes.data?.orders || []);
            setRawMaterials(matRes.data?.items || matRes.data?.rawMaterials || []);
        } catch (err) {
            console.error("Error loading Purchase Returns data:", err);
            showToast("Failed to fetch Purchase Returns data", "error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Calculate Summary Metrics
    const metrics = useMemo(() => {
        const pending = returns.filter((r) => r.status === "PENDING" || r.status === "DRAFT").length;
        const approved = returns.filter((r) => r.status === "APPROVED").length;
        const returned = returns.filter((r) => r.status === "RETURNED" || r.status === "COMPLETED").length;
        const replacementPending = returns.filter(
            (r) => r.resolution === "REPLACEMENT" && r.status !== "COMPLETED" && r.status !== "REJECTED"
        ).length;
        const refundPending = returns.filter(
            (r) => r.resolution === "REFUND" && r.status !== "COMPLETED" && r.status !== "REJECTED"
        ).length;

        return { pending, approved, returned, replacementPending, refundPending, total: returns.length };
    }, [returns]);

    // Filtered Purchase Returns
    const filteredReturns = useMemo(() => {
        return returns.filter((r) => {
            const matchesSearch =
                !searchQuery ||
                r.returnCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.supplier?.profile?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.reason?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus =
                statusFilter === "ALL" ||
                (statusFilter === "REPLACEMENT_PENDING" && r.resolution === "REPLACEMENT" && r.status !== "COMPLETED") ||
                (statusFilter === "REFUND_PENDING" && r.resolution === "REFUND" && r.status !== "COMPLETED") ||
                r.status === statusFilter;

            const matchesReason = reasonFilter === "ALL" || r.reason === reasonFilter;

            return matchesSearch && matchesStatus && matchesReason;
        });
    }, [returns, searchQuery, statusFilter, reasonFilter]);

    // Autofill from GRN Selection
    const handleSelectGRN = (grnId) => {
        if (!grnId) {
            setReturnForm((prev) => ({ ...prev, grnId: "", supplyOrderId: "", supplierId: "" }));
            return;
        }
        const grn = grns.find((g) => String(g.id) === String(grnId));
        if (grn) {
            const firstItem = grn.items?.[0];
            setReturnForm((prev) => ({
                ...prev,
                grnId: String(grn.id),
                supplyOrderId: grn.supplyOrderId ? String(grn.supplyOrderId) : "",
                supplierId: grn.supplierId ? String(grn.supplierId) : "",
                itemName: firstItem ? firstItem.itemName : prev.itemName,
                unit: firstItem ? firstItem.unit : prev.unit,
                rawMaterialId: firstItem?.rawMaterialId ? String(firstItem.rawMaterialId) : "",
            }));
        }
    };

    // Autofill from RawMaterial Selection
    const handleSelectRawMaterial = (matId) => {
        if (!matId) return;
        const mat = rawMaterials.find((m) => String(m.id) === String(matId));
        if (mat) {
            setReturnForm((prev) => ({
                ...prev,
                rawMaterialId: String(mat.id),
                itemName: mat.name,
                unit: mat.displayUnit || mat.baseUnit || "kg",
                unitPrice: mat.costPerBaseUnit || 100,
            }));
        }
    };

    // Submit Create Purchase Return
    const handleCreateReturn = async (e) => {
        e.preventDefault();
        if (!returnForm.itemName || !returnForm.quantity) {
            showToast("Please enter item name and return quantity", "error");
            return;
        }

        try {
            setSubmittingAction(true);
            await api.post("/api/owner/purchase-returns", returnForm);
            showToast("Purchase Return initiated! (Stock will be deducted upon confirmation).", "success");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (err) {
            console.error("Create Purchase Return failed:", err);
            showToast(err.response?.data?.error || "Failed to initiate Purchase Return", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Confirm Return & Deduct Stock
    const handleConfirmReturnStatus = async () => {
        if (!selectedReturn) return;
        try {
            setSubmittingAction(true);
            await api.put(`/api/owner/purchase-returns/${selectedReturn.id}/status`, {
                status: targetConfirmStatus,
            });
            showToast(`Purchase Return #${selectedReturn.returnCode} updated to ${targetConfirmStatus}. Returned inventory deducted.`, "success");
            setIsConfirmModalOpen(false);
            setSelectedReturn(null);
            fetchData();
        } catch (err) {
            console.error("Confirm return failed:", err);
            showToast(err.response?.data?.error || "Failed to update return status", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Reason Badge Helper
    const renderReasonBadge = (reason) => {
        const r = String(reason || "Damaged");
        switch (r) {
            case "Damaged":
                return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Damaged</span>;
            case "Expired":
                return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Expired</span>;
            case "Wrong Item":
                return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Wrong Item</span>;
            case "Poor Quality":
                return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">Poor Quality</span>;
            default:
                return <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">{r}</span>;
        }
    };

    // Status Badge Helper
    const renderStatusBadge = (status, stockDeducted) => {
        const s = String(status || "PENDING").toUpperCase();
        switch (s) {
            case "PENDING":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock size={12} /> PENDING REVIEW
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                        <CheckCircle2 size={12} /> APPROVED
                    </span>
                );
            case "RETURNED":
            case "COMPLETED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <PackageCheck size={12} /> RETURN CONFIRMED
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                        <XCircle size={12} /> REJECTED
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {s}
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-6 font-sans">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
                        <span>Supply Chain</span>
                        <span>/</span>
                        <span>Vendor Returns</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                        <Undo2 className="text-orange-500" size={28} />
                        Purchase Returns
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Manage vendor returns for damaged, expired, or incorrect goods with strict inventory deduction controls.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-2xs transition ${
                            refreshing ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                        disabled={refreshing}
                    >
                        <RefreshCw size={15} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md transition cursor-pointer"
                    >
                        <Plus size={18} />
                        Create Purchase Return
                    </button>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Returns</span>
                    <div className="text-3xl font-extrabold text-amber-900 mt-2">{metrics.pending}</div>
                    <p className="text-xs text-slate-500 mt-1">Awaiting vendor confirmation</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Approved</span>
                    <div className="text-3xl font-extrabold text-blue-900 mt-2">{metrics.approved}</div>
                    <p className="text-xs text-slate-500 mt-1">Confirmed for return shipment</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Returned & Settled</span>
                    <div className="text-3xl font-extrabold text-emerald-900 mt-2">{metrics.returned}</div>
                    <p className="text-xs text-slate-500 mt-1">Stock deducted from inventory</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Replacement Pending</span>
                    <div className="text-3xl font-extrabold text-purple-900 mt-2">{metrics.replacementPending}</div>
                    <p className="text-xs text-slate-500 mt-1">Awaiting vendor reshipment</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Refund Pending</span>
                    <div className="text-3xl font-extrabold text-rose-900 mt-2">{metrics.refundPending}</div>
                    <p className="text-xs text-slate-500 mt-1">Awaiting credit note / payout</p>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs mb-6 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Return ID, item name, vendor name, or return reason..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <Filter size={14} className="text-slate-500" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">Pending Review</option>
                                <option value="APPROVED">Approved</option>
                                <option value="RETURNED">Returned & Confirmed</option>
                                <option value="REPLACEMENT_PENDING">Replacement Pending</option>
                                <option value="REFUND_PENDING">Refund Pending</option>
                            </select>
                        </div>

                        {/* Reason Filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <select
                                value={reasonFilter}
                                onChange={(e) => setReasonFilter(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Reasons</option>
                                <option value="Damaged">Damaged</option>
                                <option value="Expired">Expired</option>
                                <option value="Wrong Item">Wrong Item</option>
                                <option value="Poor Quality">Poor Quality</option>
                                <option value="Short/Incorrect Delivery">Short Delivery</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <RefreshCw size={28} className="animate-spin text-orange-500 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">Loading Purchase Returns...</p>
                    </div>
                ) : filteredReturns.length === 0 ? (
                    <div className="p-12 text-center">
                        <Undo2 size={40} className="text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800">No Purchase Returns Found</h3>
                        <p className="text-slate-500 text-xs mt-1">
                            {searchQuery || statusFilter !== "ALL"
                                ? "No purchase return records match your active search."
                                : "Click 'Create Purchase Return' to initiate a vendor return."}
                        </p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-orange-700"
                        >
                            <Plus size={14} /> Create Purchase Return
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-500 tracking-wider">
                                    <th className="py-3.5 px-4">Return ID</th>
                                    <th className="py-3.5 px-4">Supplier Vendor</th>
                                    <th className="py-3.5 px-4">Linked PO / GRN</th>
                                    <th className="py-3.5 px-4">Item Name</th>
                                    <th className="py-3.5 px-4">Return Qty</th>
                                    <th className="py-3.5 px-4">Reason</th>
                                    <th className="py-3.5 px-4">Return Value</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Date</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredReturns.map((ret) => (
                                    <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                                        {/* Return ID */}
                                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 text-xs">
                                            #{ret.returnCode}
                                        </td>

                                        {/* Supplier */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg border border-orange-100">
                                                    <Building2 size={14} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-xs">
                                                        {ret.supplier?.profile?.companyName || ret.supplier?.email || "Vendor Supplier"}
                                                    </p>
                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                        Preference: {ret.resolution || "REFUND"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Linked PO / GRN */}
                                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600">
                                            {ret.grn?.grnNumber
                                                ? `GRN #${ret.grn.grnNumber}`
                                                : ret.supplyOrder?.orderNo
                                                ? `PO #${ret.supplyOrder.orderNo}`
                                                : "Direct Return"}
                                        </td>

                                        {/* Item Name */}
                                        <td className="py-3.5 px-4 font-bold text-slate-900 text-xs">
                                            {ret.itemName}
                                        </td>

                                        {/* Return Qty */}
                                        <td className="py-3.5 px-4 font-extrabold text-rose-700 text-sm">
                                            {ret.quantity} <span className="text-xs font-medium text-slate-500">{ret.unit}</span>
                                        </td>

                                        {/* Reason */}
                                        <td className="py-3.5 px-4">{renderReasonBadge(ret.reason)}</td>

                                        {/* Return Value */}
                                        <td className="py-3.5 px-4 font-extrabold text-slate-900 text-sm">
                                            ₹{Number(ret.totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4">
                                            {renderStatusBadge(ret.status, ret.stockDeducted)}
                                            {ret.stockDeducted && (
                                                <span className="block text-[10px] font-semibold text-emerald-600 mt-0.5">
                                                    ✓ Inventory Deducted
                                                </span>
                                            )}
                                        </td>

                                        {/* Date */}
                                        <td className="py-3.5 px-4 text-xs font-medium text-slate-500">
                                            {new Date(ret.createdAt).toLocaleDateString()}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Confirm Return & Deduct Stock Action */}
                                                {!ret.stockDeducted && ret.status !== "REJECTED" && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedReturn(ret);
                                                            setTargetConfirmStatus("RETURNED");
                                                            setIsConfirmModalOpen(true);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                                                        title="Confirm Return & Deduct Inventory Stock"
                                                    >
                                                        <Check size={13} /> Confirm & Deduct
                                                    </button>
                                                )}

                                                {/* View Details */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedReturn(ret);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                                                    title="View Full Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CREATE PURCHASE RETURN MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Undo2 className="text-orange-500" size={20} /> Create Purchase Return
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Initiate vendor return requisition for damaged or expired items.</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateReturn} className="mt-4 space-y-4">
                            {/* Vendor Supplier */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Select Vendor Supplier</label>
                                <select
                                    value={returnForm.supplierId}
                                    onChange={(e) => setReturnForm({ ...returnForm, supplierId: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                >
                                    <option value="">-- Select Vendor Supplier --</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.profile?.companyName || s.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Linked GRN or Inventory Item */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Linked GRN (Optional)</label>
                                    <select
                                        value={returnForm.grnId}
                                        onChange={(e) => handleSelectGRN(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                    >
                                        <option value="">-- Direct Return --</option>
                                        {grns.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                #{g.grnNumber} ({new Date(g.receivedDate).toLocaleDateString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Inventory Item</label>
                                    <select
                                        value={returnForm.rawMaterialId}
                                        onChange={(e) => handleSelectRawMaterial(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                    >
                                        <option value="">-- Select Item --</option>
                                        {rawMaterials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} (Stock: {m.currentStock} {m.displayUnit || m.baseUnit})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Item Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Item Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Item Name"
                                    value={returnForm.itemName}
                                    onChange={(e) => setReturnForm({ ...returnForm, itemName: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                                />
                            </div>

                            {/* Return Quantity & Unit Price */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Return Qty <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        required
                                        value={returnForm.quantity}
                                        onChange={(e) => setReturnForm({ ...returnForm, quantity: parseFloat(e.target.value) || "" })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={returnForm.unit}
                                        onChange={(e) => setReturnForm({ ...returnForm, unit: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={returnForm.unitPrice}
                                        onChange={(e) => setReturnForm({ ...returnForm, unitPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                                    />
                                </div>
                            </div>

                            {/* Return Reason & Resolution Preference */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Return Reason</label>
                                    <select
                                        value={returnForm.reason}
                                        onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    >
                                        <option value="Damaged">Damaged Packaging / Goods</option>
                                        <option value="Expired">Expired / Near Expiry</option>
                                        <option value="Wrong Item">Wrong Item Shipped</option>
                                        <option value="Poor Quality">Poor Quality / Substandard</option>
                                        <option value="Short/Incorrect Delivery">Short / Incorrect Delivery</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Resolution Preference</label>
                                    <select
                                        value={returnForm.resolution}
                                        onChange={(e) => setReturnForm({ ...returnForm, resolution: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-purple-900"
                                    >
                                        <option value="REFUND">Full Financial Refund</option>
                                        <option value="REPLACEMENT">Item Replacement</option>
                                        <option value="CREDIT_NOTE">Vendor Credit Note</option>
                                    </select>
                                </div>
                            </div>

                            {/* Photo / Attachment URL */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Photo / Attachment Reference URL (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="https://... photo link of damaged goods"
                                    value={returnForm.attachmentUrl}
                                    onChange={(e) => setReturnForm({ ...returnForm, attachmentUrl: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Return Description</label>
                                <textarea
                                    rows={2}
                                    placeholder="Detailed return justification notes..."
                                    value={returnForm.notes}
                                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                />
                            </div>

                            {/* CRITICAL INVENTORY NOTICE */}
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-900">
                                <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                                <div>
                                    <span className="font-extrabold">Inventory Guard Rule:</span> Stock will be removed from available inventory <span className="font-bold underline">only when this return is confirmed/approved</span>.
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="px-5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                                >
                                    {submittingAction ? "Submitting..." : "Initiate Purchase Return"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRM RETURN & DEDUCT STOCK MODAL */}
            {isConfirmModalOpen && selectedReturn && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 size={22} /> Confirm Purchase Return
                            </h3>
                            <button onClick={() => setIsConfirmModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="mt-4 space-y-4 text-xs">
                            <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                <span className="font-bold text-emerald-900">Return #{selectedReturn.returnCode}</span>
                                <h4 className="text-sm font-extrabold text-slate-900 mt-1">{selectedReturn.itemName}</h4>
                                <p className="text-slate-700 mt-0.5">
                                    Return Quantity: <span className="font-bold text-rose-700">-{selectedReturn.quantity} {selectedReturn.unit}</span>
                                </p>
                            </div>

                            <p className="text-slate-600">
                                Confirming this return will set its status to <span className="font-bold text-emerald-700">RETURNED</span> and automatically deduct <span className="font-bold text-slate-900">{selectedReturn.quantity} {selectedReturn.unit}</span> from your active raw material inventory stock.
                            </p>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmReturnStatus}
                                    disabled={submittingAction}
                                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submittingAction ? "Updating Stock..." : "Confirm & Deduct Inventory"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {isDetailModalOpen && selectedReturn && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Purchase Return Record</span>
                                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
                                    #{selectedReturn.returnCode}
                                </h3>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mt-5 space-y-4 text-xs">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Current Status</span>
                                    <div className="mt-1">{renderStatusBadge(selectedReturn.status, selectedReturn.stockDeducted)}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Reason</span>
                                    <div className="mt-1">{renderReasonBadge(selectedReturn.reason)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor Supplier</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {selectedReturn.supplier?.profile?.companyName || selectedReturn.supplier?.email || "Vendor"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Returned Item</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {selectedReturn.itemName} ({selectedReturn.quantity} {selectedReturn.unit})
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Return Value</span>
                                    <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                                        ₹{Number(selectedReturn.totalValue || 0).toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Resolution Preference</span>
                                    <p className="text-xs font-bold text-purple-900 mt-0.5">{selectedReturn.resolution || "REFUND"}</p>
                                </div>
                            </div>

                            {selectedReturn.notes && (
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Return Description / Notes</span>
                                    <p className="text-xs text-slate-700 mt-0.5">{selectedReturn.notes}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
