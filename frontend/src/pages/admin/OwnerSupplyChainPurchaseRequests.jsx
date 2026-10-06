import React, { useState, useEffect, useMemo } from "react";
import {
    FileCheck2,
    Plus,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    ShoppingBag,
    AlertCircle,
    User,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    FileText,
    Building2,
    ShieldAlert,
    RefreshCw,
    X,
    Check,
    Send,
    Edit2,
    Eye,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainPurchaseRequests() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [requests, setRequests] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [submittingAction, setSubmittingAction] = useState(false);

    // Create Request Form State
    const [requestForm, setRequestForm] = useState({
        itemName: "",
        category: "Produce",
        quantity: 10,
        unit: "kg",
        priority: "MEDIUM",
        requiredDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        reason: "Inventory reorder threshold reached",
        supplierId: "",
        rawMaterialId: "",
        notes: "",
        submitImmediately: true,
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [prRes, matRes, supRes] = await Promise.all([
                api.get("/api/owner/purchase-requests").catch(() => ({ data: { requests: [] } })),
                api.get("/api/owner/inventory").catch(() => ({ data: { items: [] } })),
                api.get("/api/owner/suppliers").catch(() => ({ data: { suppliers: [] } })),
            ]);

            const loadedRequests = prRes.data?.requests || [];
            setRequests(loadedRequests);

            const items = matRes.data?.items || matRes.data?.rawMaterials || [];
            setRawMaterials(items);

            const loadedSuppliers = supRes.data?.suppliers || [];
            setSuppliers(loadedSuppliers);
        } catch (err) {
            console.error("Error loading purchase requests:", err);
            showToast("Failed to fetch purchase requests data", "error");
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
        const pending = requests.filter((r) => r.status === "SUBMITTED" || r.status === "PENDING").length;
        const approved = requests.filter((r) => r.status === "APPROVED").length;
        const rejected = requests.filter((r) => r.status === "REJECTED").length;
        const converted = requests.filter((r) => r.status === "CONVERTED_TO_PO").length;
        const draft = requests.filter((r) => r.status === "DRAFT").length;
        return { pending, approved, rejected, converted, draft, total: requests.length };
    }, [requests]);

    // Filter Requests
    const filteredRequests = useMemo(() => {
        return requests.filter((r) => {
            const matchesSearch =
                !searchQuery ||
                r.requestCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.requestedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.reason?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus =
                statusFilter === "ALL" ||
                (statusFilter === "PENDING" && (r.status === "SUBMITTED" || r.status === "PENDING")) ||
                r.status === statusFilter;

            const matchesPriority = priorityFilter === "ALL" || r.priority === priorityFilter;
            const matchesCategory = categoryFilter === "ALL" || r.category === categoryFilter;

            return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
        });
    }, [requests, searchQuery, statusFilter, priorityFilter, categoryFilter]);

    // Select Raw Material autofill
    const handleSelectRawMaterial = (matId) => {
        if (!matId) {
            setRequestForm((prev) => ({ ...prev, rawMaterialId: "", itemName: "" }));
            return;
        }
        const mat = rawMaterials.find((m) => String(m.id) === String(matId));
        if (mat) {
            setRequestForm((prev) => ({
                ...prev,
                rawMaterialId: String(mat.id),
                itemName: mat.name,
                category: mat.category || "Produce",
                unit: mat.displayUnit || mat.baseUnit || "kg",
            }));
        }
    };

    // Create Purchase Request
    const handleCreateRequest = async (e) => {
        e.preventDefault();
        if (!requestForm.itemName || !requestForm.quantity) {
            showToast("Please enter an item name and valid quantity", "error");
            return;
        }
        try {
            setSubmittingAction(true);
            await api.post("/api/owner/purchase-requests", requestForm);
            showToast("Purchase Request created successfully", "success");
            setIsCreateModalOpen(false);
            setRequestForm({
                itemName: "",
                category: "Produce",
                quantity: 10,
                unit: "kg",
                priority: "MEDIUM",
                requiredDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
                reason: "Inventory reorder threshold reached",
                supplierId: "",
                rawMaterialId: "",
                notes: "",
                submitImmediately: true,
            });
            fetchData();
        } catch (err) {
            console.error("Create request failed:", err);
            showToast(err.response?.data?.error || "Failed to create purchase request", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Status Update Action
    const handleUpdateStatus = async (requestId, targetStatus, reasonText = "") => {
        if (["APPROVED", "REJECTED"].includes(targetStatus) && !isManagerOrOwner) {
            showToast("Authorization required. Only Managers and Owners can approve or reject requests.", "error");
            return;
        }

        try {
            setSubmittingAction(true);
            await api.put(`/api/owner/purchase-requests/${requestId}/status`, {
                status: targetStatus,
                rejectionReason: reasonText,
            });
            showToast(`Request #${selectedRequest?.requestCode || requestId} updated to ${targetStatus}`, "success");
            setIsRejectModalOpen(false);
            setIsDetailModalOpen(false);
            setSelectedRequest(null);
            fetchData();
        } catch (err) {
            console.error("Update status failed:", err);
            showToast(err.response?.data?.error || "Failed to update request status", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Convert to PO
    const handleConvertToPO = async (requestId) => {
        if (!isManagerOrOwner) {
            showToast("Authorization required. Only Managers and Owners can convert requests to POs.", "error");
            return;
        }
        try {
            setSubmittingAction(true);
            await api.post(`/api/owner/purchase-requests/${requestId}/convert`);
            showToast(`Request #${selectedRequest?.requestCode || requestId} converted to Purchase Order!`, "success");
            setIsConvertModalOpen(false);
            setSelectedRequest(null);
            fetchData();
        } catch (err) {
            console.error("Convert to PO failed:", err);
            showToast(err.response?.data?.error || "Failed to convert to Purchase Order", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Priority Badge Helper
    const renderPriorityBadge = (priority) => {
        const p = String(priority || "MEDIUM").toUpperCase();
        switch (p) {
            case "CRITICAL":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">CRITICAL</span>;
            case "HIGH":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">HIGH</span>;
            case "LOW":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">LOW</span>;
            default:
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">MEDIUM</span>;
        }
    };

    // Status Badge Helper
    const renderStatusBadge = (status) => {
        const s = String(status || "DRAFT").toUpperCase();
        switch (s) {
            case "SUBMITTED":
            case "PENDING":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                        <Clock size={12} className="animate-spin" /> SUBMITTED
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={12} /> APPROVED
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <XCircle size={12} /> REJECTED
                    </span>
                );
            case "CONVERTED_TO_PO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                        <ShoppingBag size={12} /> CONVERTED TO PO
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                        <FileText size={12} /> DRAFT
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-6 font-sans">
            {/* Page Header */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
                                <span>Supply Chain</span>
                                <span>/</span>
                                <span>Requisitions</span>
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                            <FileCheck2 className="text-orange-500" size={28} />
                            Purchase Requests
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Allow kitchen & store staff to request raw materials before generating formal Purchase Orders.
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
                            Create Request
                        </button>
                    </div>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Pending */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-600 tracking-wider uppercase">Pending Approval</span>
                        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-3">{metrics.pending}</div>
                    <p className="text-xs text-slate-500 mt-1">Awaiting manager verification</p>
                </div>

                {/* Approved */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase">Approved</span>
                        <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-3">{metrics.approved}</div>
                    <p className="text-xs text-slate-500 mt-1">Ready for Purchase Order creation</p>
                </div>

                {/* Rejected */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-600 tracking-wider uppercase">Rejected</span>
                        <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
                            <XCircle size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-3">{metrics.rejected}</div>
                    <p className="text-xs text-slate-500 mt-1">Declined requisitions with notes</p>
                </div>

                {/* Converted to PO */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-600 tracking-wider uppercase">Converted to PO</span>
                        <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 border border-purple-100">
                            <ShoppingBag size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-3">{metrics.converted}</div>
                    <p className="text-xs text-slate-500 mt-1">Issued supply marketplace POs</p>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs mb-6 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Request ID, item name, requested by user, or reason..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                        />
                    </div>

                    {/* Filter Dropdowns */}
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
                                <option value="PENDING">Pending (Submitted)</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="CONVERTED_TO_PO">Converted to PO</option>
                                <option value="DRAFT">Draft</option>
                            </select>
                        </div>

                        {/* Priority Filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <select
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Priorities</option>
                                <option value="CRITICAL">Critical</option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                            </select>
                        </div>

                        {/* Category Filter */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Categories</option>
                                <option value="Produce">Produce</option>
                                <option value="Dairy">Dairy</option>
                                <option value="Meat">Meat & Poultry</option>
                                <option value="Dry Goods">Dry Goods & Spices</option>
                                <option value="Beverages">Beverages</option>
                                <option value="Packaging">Packaging</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Requests Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <RefreshCw size={28} className="animate-spin text-orange-500 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">Loading purchase requests...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileCheck2 size={40} className="text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800">No Purchase Requests Found</h3>
                        <p className="text-slate-500 text-xs mt-1">
                            {searchQuery || statusFilter !== "ALL"
                                ? "Try adjusting your filters or search terms."
                                : "Click 'Create Request' to submit a raw material requisition."}
                        </p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-orange-700"
                        >
                            <Plus size={14} /> Create Request
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-500 tracking-wider">
                                    <th className="py-3.5 px-4">Request ID</th>
                                    <th className="py-3.5 px-4">Requested By</th>
                                    <th className="py-3.5 px-4">Item & Category</th>
                                    <th className="py-3.5 px-4">Quantity</th>
                                    <th className="py-3.5 px-4">Required Date</th>
                                    <th className="py-3.5 px-4">Priority</th>
                                    <th className="py-3.5 px-4">Reason</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Created At</th>
                                    <th className="py-3.5 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                                        {/* Request ID */}
                                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 text-xs">
                                            #{req.requestCode || `PR-${req.id}`}
                                        </td>

                                        {/* Requested By */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                                                    {(req.requestedBy?.name || "Staff").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 text-xs">{req.requestedBy?.name || "Kitchen Staff"}</p>
                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                        {req.requestedBy?.role || "KITCHEN"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Item & Category */}
                                        <td className="py-3.5 px-4">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{req.itemName}</p>
                                                <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {req.category || "General"}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Quantity */}
                                        <td className="py-3.5 px-4 font-extrabold text-slate-900 text-sm">
                                            {req.quantity} <span className="text-xs font-medium text-slate-500">{req.unit}</span>
                                        </td>

                                        {/* Required Date */}
                                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                                            {req.requiredDate ? (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={13} className="text-slate-400" />
                                                    {new Date(req.requiredDate).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-amber-600 font-semibold">Immediate</span>
                                            )}
                                        </td>

                                        {/* Priority */}
                                        <td className="py-3.5 px-4">{renderPriorityBadge(req.priority)}</td>

                                        {/* Reason */}
                                        <td className="py-3.5 px-4 max-w-[200px]">
                                            <p className="text-xs text-slate-600 truncate" title={req.reason || "No reason specified"}>
                                                {req.reason || "Standard restocking"}
                                            </p>
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4">{renderStatusBadge(req.status)}</td>

                                        {/* Created At */}
                                        <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                                            {new Date(req.createdAt).toLocaleDateString()}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* SUBMITTED / PENDING Actions */}
                                                {(req.status === "SUBMITTED" || req.status === "PENDING") && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(req.id, "APPROVED")}
                                                            title={isManagerOrOwner ? "Approve Request" : "Owner/Manager Auth Required"}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer ${
                                                                !isManagerOrOwner ? "opacity-50 cursor-not-allowed" : ""
                                                            }`}
                                                        >
                                                            <Check size={13} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequest(req);
                                                                setIsRejectModalOpen(true);
                                                            }}
                                                            title={isManagerOrOwner ? "Reject Request" : "Owner/Manager Auth Required"}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 cursor-pointer ${
                                                                !isManagerOrOwner ? "opacity-50 cursor-not-allowed" : ""
                                                            }`}
                                                        >
                                                            <X size={13} /> Reject
                                                        </button>
                                                    </>
                                                )}

                                                {/* APPROVED Actions */}
                                                {req.status === "APPROVED" && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRequest(req);
                                                            setIsConvertModalOpen(true);
                                                        }}
                                                        className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                                                    >
                                                        <ShoppingBag size={13} /> Convert to PO
                                                    </button>
                                                )}

                                                {/* DRAFT Actions */}
                                                {req.status === "DRAFT" && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(req.id, "SUBMITTED")}
                                                        className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                                                    >
                                                        <Send size={13} /> Submit
                                                    </button>
                                                )}

                                                {/* View Details */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedRequest(req);
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

            {/* CREATE PURCHASE REQUEST MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Plus className="text-orange-500" size={20} /> Create Purchase Request
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Submit raw material requisition for owner/manager review.</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRequest} className="mt-4 space-y-4">
                            {/* Raw Material Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Select Existing Inventory Item (Optional)</label>
                                <select
                                    value={requestForm.rawMaterialId}
                                    onChange={(e) => handleSelectRawMaterial(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                >
                                    <option value="">-- Manual Custom Item --</option>
                                    {rawMaterials.map((mat) => (
                                        <option key={mat.id} value={mat.id}>
                                            {mat.name} ({mat.category}) - Stock: {mat.currentStock} {mat.displayUnit || mat.baseUnit}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Item Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Item Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Fresh Tomatoes, Whole Milk, Butter"
                                    value={requestForm.itemName}
                                    onChange={(e) => setRequestForm({ ...requestForm, itemName: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            {/* Category & Priority */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={requestForm.category}
                                        onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="Produce">Produce</option>
                                        <option value="Dairy">Dairy</option>
                                        <option value="Meat">Meat & Poultry</option>
                                        <option value="Dry Goods">Dry Goods & Spices</option>
                                        <option value="Beverages">Beverages</option>
                                        <option value="Packaging">Packaging</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                                    <select
                                        value={requestForm.priority}
                                        onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="LOW">LOW</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="CRITICAL">CRITICAL</option>
                                    </select>
                                </div>
                            </div>

                            {/* Quantity & Unit */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Quantity <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        required
                                        value={requestForm.quantity}
                                        onChange={(e) => setRequestForm({ ...requestForm, quantity: parseFloat(e.target.value) || "" })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={requestForm.unit}
                                        placeholder="kg, L, pcs, box"
                                        onChange={(e) => setRequestForm({ ...requestForm, unit: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            {/* Required Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Required Delivery Date</label>
                                <input
                                    type="date"
                                    value={requestForm.requiredDate}
                                    onChange={(e) => setRequestForm({ ...requestForm, requiredDate: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Justification</label>
                                <textarea
                                    rows={2}
                                    placeholder="Why is this item needed? (e.g. Weekend banquet event, low stock alert)"
                                    value={requestForm.reason}
                                    onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            {/* Preferred Supplier */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Supplier (Optional)</label>
                                <select
                                    value={requestForm.supplierId}
                                    onChange={(e) => setRequestForm({ ...requestForm, supplierId: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                >
                                    <option value="">-- Select Preferred Supplier --</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.profile?.companyName || s.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Submit Options */}
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="submitImm"
                                    checked={requestForm.submitImmediately}
                                    onChange={(e) => setRequestForm({ ...requestForm, submitImmediately: e.target.checked })}
                                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                />
                                <label htmlFor="submitImm" className="text-xs text-slate-700 font-semibold cursor-pointer">
                                    Submit immediately for approval (otherwise save as Draft)
                                </label>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="px-5 py-2 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm hover:shadow transition disabled:opacity-50"
                                >
                                    {submittingAction ? "Saving..." : requestForm.submitImmediately ? "Submit Request" : "Save Draft"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* REJECT REQUEST MODAL */}
            {isRejectModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-rose-700 flex items-center gap-2">
                                <XCircle size={22} /> Reject Purchase Request
                            </h3>
                            <button onClick={() => setIsRejectModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="mt-4 space-y-3">
                            <p className="text-xs text-slate-600">
                                Rejecting request <span className="font-bold text-slate-900">#{selectedRequest.requestCode}</span> for{" "}
                                <span className="font-bold text-slate-900">{selectedRequest.itemName}</span> ({selectedRequest.quantity} {selectedRequest.unit}).
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Rejection Reason <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Enter reason for rejecting this requisition..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(selectedRequest.id, "REJECTED", rejectionReason)}
                                    disabled={submittingAction || !rejectionReason.trim()}
                                    className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submittingAction ? "Rejecting..." : "Confirm Rejection"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONVERT TO PO MODAL */}
            {isConvertModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-purple-700 flex items-center gap-2">
                                <ShoppingBag size={22} /> Convert to Purchase Order
                            </h3>
                            <button onClick={() => setIsConvertModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="mt-4 space-y-4">
                            <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-2xl">
                                <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                                    <span>Requisition #{selectedRequest.requestCode}</span>
                                    <span>{renderPriorityBadge(selectedRequest.priority)}</span>
                                </div>
                                <h4 className="text-base font-extrabold text-slate-900 mt-1">{selectedRequest.itemName}</h4>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    Quantity: <span className="font-bold text-slate-900">{selectedRequest.quantity} {selectedRequest.unit}</span>
                                </p>
                            </div>

                            <p className="text-xs text-slate-600">
                                Converting this approved request will change its status to <span className="font-bold text-purple-700">CONVERTED TO PO</span> and add the item into your Supply Marketplace cart.
                            </p>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    onClick={() => setIsConvertModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleConvertToPO(selectedRequest.id)}
                                    disabled={submittingAction}
                                    className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submittingAction ? "Converting..." : "Convert Now"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REQUEST DETAIL MODAL / DRAWER */}
            {isDetailModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Purchase Requisition Details</span>
                                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
                                    #{selectedRequest.requestCode}
                                </h3>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mt-5 space-y-4 text-xs">
                            {/* Status & Priority Banner */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500">Current Status</span>
                                    <div className="mt-1">{renderStatusBadge(selectedRequest.status)}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-slate-500">Priority Level</span>
                                    <div className="mt-1">{renderPriorityBadge(selectedRequest.priority)}</div>
                                </div>
                            </div>

                            {/* Item Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Item Name</span>
                                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">{selectedRequest.itemName}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Category</span>
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{selectedRequest.category || "General"}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Requested Quantity</span>
                                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                                        {selectedRequest.quantity} {selectedRequest.unit}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Required Delivery</span>
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                                        {selectedRequest.requiredDate ? new Date(selectedRequest.requiredDate).toLocaleDateString() : "Immediate"}
                                    </p>
                                </div>
                            </div>

                            {/* Requested By & Approver */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Requested By</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">{selectedRequest.requestedBy?.name || "Kitchen Staff"}</p>
                                    <p className="text-[10px] text-slate-500">{selectedRequest.requestedBy?.role || "Staff"}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Verified / Approved By</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {selectedRequest.approvedBy?.name || (selectedRequest.status === "APPROVED" ? "Store Manager" : "Pending")}
                                    </p>
                                    {selectedRequest.approvedBy?.role && (
                                        <p className="text-[10px] text-slate-500">{selectedRequest.approvedBy.role}</p>
                                    )}
                                </div>
                            </div>

                            {/* Justification & Rejection Notes */}
                            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Reason / Justification</span>
                                    <p className="text-xs text-slate-700 mt-1 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                        {selectedRequest.reason || "Standard inventory restocking request."}
                                    </p>
                                </div>

                                {selectedRequest.status === "REJECTED" && selectedRequest.rejectionReason && (
                                    <div className="pt-2">
                                        <span className="text-rose-600 font-bold uppercase text-[10px]">Rejection Reason</span>
                                        <p className="text-xs text-rose-800 mt-1 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                                            {selectedRequest.rejectionReason}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                                >
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
