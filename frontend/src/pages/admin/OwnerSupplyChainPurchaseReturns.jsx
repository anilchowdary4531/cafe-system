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
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

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

    // Reason Badge Helper (Analytics Palette: Credit=green, Pending=amber, Adjustment=blue, Critical=red)
    const renderReasonBadge = (reason) => {
        const r = String(reason || "Damaged");
        switch (r) {
            case "Damaged":
            case "Expired":
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">{r}</span>;
            case "Wrong Item":
            case "Short/Incorrect Delivery":
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{r}</span>;
            case "Poor Quality":
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{r}</span>;
            default:
                return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{r}</span>;
        }
    };

    // Status Badge Helper (Analytics Palette: Credit=green, Pending=amber, Adjustment=blue, Critical=red)
    const renderStatusBadge = (status) => {
        const s = String(status || "PENDING").toUpperCase();
        switch (s) {
            case "PENDING":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={11} /> PENDING REVIEW
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <CheckCircle2 size={11} /> APPROVED
                    </span>
                );
            case "RETURNED":
            case "COMPLETED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <PackageCheck size={11} /> CONFIRMED & CREDITED
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle size={11} /> REJECTED
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {s}
                    </span>
                );
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* Header Console */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Supplier Credits & Credit Notes</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                            <Undo2 className="text-orange-500" size={20} />
                            Supplier Credits & Credit Notes
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200/80 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        <span>Refresh Data</span>
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Create Credit Note / Return</span>
                    </button>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* Compact Financial & Status Metrics (Analytics Line Style - No Heavy Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Requisitions</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{metrics.total}</div>
                    <span className="text-[10px] text-slate-400 font-medium">All Credit Notes</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pending Requisitions</span>
                    <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">{metrics.pending}</div>
                    <span className="text-[10px] text-amber-600/80 font-medium">Awaiting Vendor Review</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Approved & Adjustments</span>
                    <div className="text-lg font-bold text-blue-600 font-mono mt-0.5">{metrics.approved + metrics.replacementPending}</div>
                    <span className="text-[10px] text-blue-600/80 font-medium">Replacements & Adjustments</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Confirmed Credits</span>
                    <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">{metrics.returned}</div>
                    <span className="text-[10px] text-emerald-600/80 font-medium">Stock Deducted & Settled</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Critical Refund Pending</span>
                    <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">{metrics.refundPending}</div>
                    <span className="text-[10px] text-rose-600/80 font-medium">Overdue Financial Credits</span>
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1 print:hidden">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search by Credit ID, item name, vendor name, reason..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-lg text-xs font-sans text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition shadow-2xs"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200/80 rounded-lg shadow-2xs">
                        <Filter size={13} className="text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending Review (Amber)</option>
                            <option value="APPROVED">Approved (Blue)</option>
                            <option value="RETURNED">Returned & Confirmed (Green)</option>
                            <option value="REPLACEMENT_PENDING">Replacement Pending</option>
                            <option value="REFUND_PENDING">Refund Pending (Red)</option>
                        </select>
                    </div>

                    {/* Reason Filter */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200/80 rounded-lg shadow-2xs">
                        <select
                            value={reasonFilter}
                            onChange={(e) => setReasonFilter(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Reasons</option>
                            <option value="Damaged">Damaged (Red)</option>
                            <option value="Expired">Expired (Red)</option>
                            <option value="Wrong Item">Wrong Item (Blue)</option>
                            <option value="Poor Quality">Poor Quality (Amber)</option>
                            <option value="Short/Incorrect Delivery">Short Delivery</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Clean Credit Notes Ledger Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden print:hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-orange-500" />
                        Supplier Credits & Credit Notes Ledger
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {filteredReturns.length} Record{filteredReturns.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw size={22} className="animate-spin text-orange-500" />
                        <p className="text-xs font-medium">Loading Supplier Credit Notes...</p>
                    </div>
                ) : filteredReturns.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        <Undo2 size={32} className="mx-auto mb-2 opacity-40 text-orange-400" />
                        <h3 className="text-xs font-bold text-slate-800">No Supplier Credit Notes Found</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {searchQuery || statusFilter !== "ALL"
                                ? "No credit note records match your active search filters."
                                : "Click 'Create Credit Note / Return' to initiate a vendor requisition."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-3">Credit ID</th>
                                    <th className="py-2.5 px-3">Vendor Supplier</th>
                                    <th className="py-2.5 px-3">Linked PO / GRN</th>
                                    <th className="py-2.5 px-3">Item Name</th>
                                    <th className="py-2.5 px-3 text-right">Return Qty</th>
                                    <th className="py-2.5 px-3">Reason</th>
                                    <th className="py-2.5 px-3 text-right">Credit Value</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredReturns.map((ret) => {
                                    const isPending = ret.status === "PENDING";
                                    const isCritical = ret.resolution === "REFUND" && ret.status !== "COMPLETED" && ret.status !== "RETURNED";

                                    return (
                                        <tr
                                            key={ret.id}
                                            className={`hover:bg-slate-50/80 transition-colors ${
                                                isCritical
                                                    ? "bg-rose-50/20"
                                                    : isPending
                                                    ? "bg-amber-50/20"
                                                    : ""
                                            }`}
                                        >
                                            {/* Credit ID */}
                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                                #{ret.returnCode}
                                            </td>

                                            {/* Supplier */}
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-slate-400 shrink-0" />
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-xs">
                                                            {ret.supplier?.profile?.companyName || ret.supplier?.email || "Vendor Supplier"}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {ret.resolution || "REFUND"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Linked PO / GRN */}
                                            <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                                                {ret.grn?.grnNumber
                                                    ? `GRN #${ret.grn.grnNumber}`
                                                    : ret.supplyOrder?.orderNo
                                                    ? `PO #${ret.supplyOrder.orderNo}`
                                                    : "Direct"}
                                            </td>

                                            {/* Item Name */}
                                            <td className="py-2.5 px-3 font-bold text-slate-900">
                                                {ret.itemName}
                                            </td>

                                            {/* Return Qty */}
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                                -{ret.quantity} <span className="text-[10px] font-normal text-slate-400">{ret.unit}</span>
                                            </td>

                                            {/* Reason */}
                                            <td className="py-2.5 px-3">{renderReasonBadge(ret.reason)}</td>

                                            {/* Credit Value */}
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                                                ₹{Number(ret.totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>

                                            {/* Status */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                {renderStatusBadge(ret.status)}
                                                {ret.stockDeducted && (
                                                    <span className="block text-[10px] font-semibold text-emerald-600 mt-0.5">
                                                        ✓ Stock Deducted
                                                    </span>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(ret.createdAt).toLocaleDateString()}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2.5 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {!ret.stockDeducted && ret.status !== "REJECTED" && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedReturn(ret);
                                                                setTargetConfirmStatus("RETURNED");
                                                                setIsConfirmModalOpen(true);
                                                            }}
                                                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                                                            title="Confirm Return & Deduct Stock"
                                                        >
                                                            <Check size={12} /> Confirm
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            setSelectedReturn(ret);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                                        title="View Details"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
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

            {/* CREATE CREDIT NOTE / PURCHASE RETURN MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200/80 rounded-xl max-w-md w-full p-4 shadow-xl relative max-h-[90vh] overflow-y-auto font-sans">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                    <Undo2 className="text-orange-500" size={16} /> Create Supplier Credit Requisition
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">Issue credit note requisition for damaged or returned stock.</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateReturn} className="mt-3 space-y-2.5 text-xs">
                            {/* Vendor Supplier */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Select Vendor Supplier</label>
                                <select
                                    value={returnForm.supplierId}
                                    onChange={(e) => setReturnForm({ ...returnForm, supplierId: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-bold focus:border-orange-500 focus:outline-none"
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
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Linked GRN (Optional)</label>
                                    <select
                                        value={returnForm.grnId}
                                        onChange={(e) => handleSelectGRN(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none"
                                    >
                                        <option value="">-- Direct Credit --</option>
                                        {grns.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                #{g.grnNumber}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Inventory Item</label>
                                    <select
                                        value={returnForm.rawMaterialId}
                                        onChange={(e) => handleSelectRawMaterial(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none"
                                    >
                                        <option value="">-- Select Item --</option>
                                        {rawMaterials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.currentStock} {m.displayUnit || m.baseUnit})
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
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-bold focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            {/* Return Quantity & Unit Price */}
                            <div className="grid grid-cols-3 gap-2">
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
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono font-bold focus:border-orange-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={returnForm.unit}
                                        onChange={(e) => setReturnForm({ ...returnForm, unit: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={returnForm.unitPrice}
                                        onChange={(e) => setReturnForm({ ...returnForm, unitPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono font-bold focus:border-orange-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Return Reason & Resolution Preference */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Return Reason</label>
                                    <select
                                        value={returnForm.reason}
                                        onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold focus:border-orange-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="Damaged">Damaged Goods (Red)</option>
                                        <option value="Expired">Expired Stock (Red)</option>
                                        <option value="Wrong Item">Wrong Item Shipped (Blue)</option>
                                        <option value="Poor Quality">Poor Quality (Amber)</option>
                                        <option value="Short/Incorrect Delivery">Short Delivery</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Resolution Preference</label>
                                    <select
                                        value={returnForm.resolution}
                                        onChange={(e) => setReturnForm({ ...returnForm, resolution: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-purple-900 focus:border-orange-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="REFUND">Full Financial Refund</option>
                                        <option value="REPLACEMENT">Item Replacement</option>
                                        <option value="CREDIT_NOTE">Vendor Credit Note</option>
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description</label>
                                <textarea
                                    rows={2}
                                    placeholder="Detailed return justification..."
                                    value={returnForm.notes}
                                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            {/* Inventory Guard Notice */}
                            <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-lg flex items-center gap-2 text-[11px] text-amber-800">
                                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                                <div>
                                    <span className="font-bold">Inventory Guard:</span> Stock is deducted only upon confirmation.
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingAction ? "Initiating..." : "Initiate Credit Note"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRM RETURN & DEDUCT STOCK MODAL */}
            {isConfirmModalOpen && selectedReturn && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200/80 rounded-xl max-w-md w-full p-4 shadow-xl font-sans">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                                <CheckCircle2 size={18} /> Confirm Credit & Deduct Stock
                            </h3>
                            <button onClick={() => setIsConfirmModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="mt-3 space-y-3 text-xs">
                            <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                                <span className="font-bold text-emerald-900">Return #{selectedReturn.returnCode}</span>
                                <h4 className="text-xs font-extrabold text-slate-900 mt-0.5">{selectedReturn.itemName}</h4>
                                <p className="text-slate-700 mt-0.5 font-mono">
                                    Return Quantity: <span className="font-bold text-rose-600">-{selectedReturn.quantity} {selectedReturn.unit}</span>
                                </p>
                            </div>

                            <p className="text-slate-600">
                                Confirming will set status to <span className="font-bold text-emerald-700">CONFIRMED</span> and deduct <span className="font-bold font-mono text-slate-900">{selectedReturn.quantity} {selectedReturn.unit}</span> from active inventory.
                            </p>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button onClick={() => setIsConfirmModalOpen(false)} className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmReturnStatus}
                                    disabled={submittingAction}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingAction ? "Updating Stock..." : "Confirm & Deduct Stock"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {isDetailModalOpen && selectedReturn && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200/80 rounded-xl max-w-md w-full p-4 shadow-xl max-h-[90vh] overflow-y-auto font-sans">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Credit Note Record</span>
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5 font-mono">
                                    #{selectedReturn.returnCode}
                                </h3>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-3 space-y-3 text-xs">
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Current Status</span>
                                    <div className="mt-0.5">{renderStatusBadge(selectedReturn.status)}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Reason</span>
                                    <div className="mt-0.5">{renderReasonBadge(selectedReturn.reason)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
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
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Credit Value</span>
                                    <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">
                                        ₹{Number(selectedReturn.totalValue || 0).toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Resolution</span>
                                    <p className="text-xs font-bold text-purple-900 mt-0.5">{selectedReturn.resolution || "REFUND"}</p>
                                </div>
                            </div>

                            {selectedReturn.notes && (
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Notes</span>
                                    <p className="text-xs text-slate-700 mt-0.5">{selectedReturn.notes}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button onClick={() => setIsDetailModalOpen(false)} className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
