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
    Printer,
    Download,
    Truck,
    Building2,
    Calendar,
    Send,
    RefreshCw,
    X,
    Check,
    Eye,
    ChevronRight,
    ArrowUpRight,
    DollarSign,
    PackageCheck,
    AlertCircle,
    Trash2,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainPurchaseOrders() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [orders, setOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [receivingFilter, setReceivingFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [submittingAction, setSubmittingAction] = useState(false);
    const [receiveNotes, setReceiveNotes] = useState("");
    const [receivingOption, setReceivingOption] = useState("FULLY_RECEIVED");

    // Create PO Form State
    const [poForm, setPoForm] = useState({
        supplierId: "",
        deliveryAddress: "Tiffzy Enterprise Cafe, Main Branch, Hitech City, Hyderabad",
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        notes: "",
        status: "DRAFT",
        items: [
            {
                productId: "",
                productName: "Fresh Vegetables Assortment",
                quantity: 25,
                unit: "kg",
                unitPrice: 80,
                taxRate: 5,
                discount: 0,
            },
        ],
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [poRes, supRes, matRes] = await Promise.all([
                api.get("/api/owner/purchase-orders").catch(() => ({ data: { orders: [] } })),
                api.get("/api/owner/suppliers").catch(() => ({ data: { suppliers: [] } })),
                api.get("/api/owner/inventory").catch(() => ({ data: { items: [] } })),
            ]);

            const loadedOrders = poRes.data?.orders || [];
            setOrders(loadedOrders);

            const loadedSuppliers = supRes.data?.suppliers || [];
            setSuppliers(loadedSuppliers);

            const loadedItems = matRes.data?.items || matRes.data?.rawMaterials || [];
            setRawMaterials(loadedItems);
        } catch (err) {
            console.error("Error loading purchase orders data:", err);
            showToast("Failed to fetch purchase orders", "error");
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
        const draft = orders.filter((o) => o.status === "DRAFT").length;
        const pendingApproval = orders.filter((o) => o.status === "PENDING_APPROVAL").length;
        const sent = orders.filter((o) => o.status === "SENT" || o.status === "PLACED").length;
        const confirmed = orders.filter((o) => o.status === "CONFIRMED" || o.status === "ACCEPTED").length;
        const partiallyReceived = orders.filter(
            (o) => o.receivingStatus === "PARTIALLY_RECEIVED" || o.status === "PARTIALLY_RECEIVED"
        ).length;
        const completed = orders.filter(
            (o) => o.status === "COMPLETED" || o.status === "DELIVERED" || o.receivingStatus === "FULLY_RECEIVED"
        ).length;
        return { draft, pendingApproval, sent, confirmed, partiallyReceived, completed, total: orders.length };
    }, [orders]);

    // Filtered Purchase Orders
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            const matchesSearch =
                !searchQuery ||
                o.orderNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.supplier?.profile?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.supplier?.email?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
            const matchesReceiving = receivingFilter === "ALL" || o.receivingStatus === receivingFilter;
            const matchesPayment = paymentFilter === "ALL" || o.paymentStatus === paymentFilter;

            return matchesSearch && matchesStatus && matchesReceiving && matchesPayment;
        });
    }, [orders, searchQuery, statusFilter, receivingFilter, paymentFilter]);

    // PO Item Form Handlers
    const handleAddItemRow = () => {
        setPoForm((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    productId: "",
                    productName: "",
                    quantity: 10,
                    unit: "kg",
                    unitPrice: 100,
                    taxRate: 5,
                    discount: 0,
                },
            ],
        }));
    };

    const handleRemoveItemRow = (index) => {
        if (poForm.items.length === 1) return;
        setPoForm((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...poForm.items];
        updated[index][field] = value;

        if (field === "productId" && value) {
            const mat = rawMaterials.find((m) => String(m.id) === String(value));
            if (mat) {
                updated[index].productName = mat.name;
                updated[index].unit = mat.displayUnit || mat.baseUnit || "kg";
                if (mat.costPerBaseUnit) updated[index].unitPrice = mat.costPerBaseUnit;
            }
        }
        setPoForm({ ...poForm, items: updated });
    };

    // Calculate Dynamic Form Totals
    const poTotals = useMemo(() => {
        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;

        poForm.items.forEach((item) => {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.unitPrice || 0);
            const taxPct = Number(item.taxRate || 0);
            const discPct = Number(item.discount || 0);

            const gross = qty * rate;
            const disc = (gross * discPct) / 100;
            const net = gross - disc;
            const tax = (net * taxPct) / 100;

            subtotal += net;
            taxAmount += tax;
            discountAmount += disc;
        });

        return { subtotal, taxAmount, discountAmount, grandTotal: subtotal + taxAmount };
    }, [poForm.items]);

    // Submit Create PO
    const handleCreatePO = async (targetStatus = "DRAFT") => {
        if (!poForm.supplierId) {
            showToast("Please select a vendor supplier", "error");
            return;
        }
        if (!poForm.items.some((i) => i.productName && i.quantity > 0)) {
            showToast("Please add at least one line item with quantity", "error");
            return;
        }

        try {
            setSubmittingAction(true);
            await api.post("/api/owner/purchase-orders", {
                ...poForm,
                status: targetStatus,
            });
            showToast(`Purchase Order created as ${targetStatus}!`, "success");
            setIsCreateModalOpen(false);
            setPoForm({
                supplierId: "",
                deliveryAddress: "Tiffzy Enterprise Cafe, Main Branch, Hitech City, Hyderabad",
                expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
                notes: "",
                status: "DRAFT",
                items: [
                    {
                        productId: "",
                        productName: "Fresh Vegetables Assortment",
                        quantity: 25,
                        unit: "kg",
                        unitPrice: 80,
                        taxRate: 5,
                        discount: 0,
                    },
                ],
            });
            fetchData();
        } catch (err) {
            console.error("Create PO failed:", err);
            showToast(err.response?.data?.error || "Failed to create Purchase Order", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Update Status Action
    const handleUpdatePOStatus = async (orderId, targetStatus) => {
        try {
            setSubmittingAction(true);
            await api.put(`/api/owner/purchase-orders/${orderId}/status`, { status: targetStatus });
            showToast(`PO status updated to ${targetStatus}`, "success");
            setIsDetailModalOpen(false);
            fetchData();
        } catch (err) {
            console.error("Update PO status failed:", err);
            showToast(err.response?.data?.error || "Failed to update PO status", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Goods Receipt Action
    const handleProcessReceipt = async () => {
        if (!selectedOrder) return;
        try {
            setSubmittingAction(true);
            await api.put(`/api/owner/purchase-orders/${selectedOrder.id}/receive`, {
                receivingStatus: receivingOption,
                notes: receiveNotes,
            });
            showToast(`Goods received! Inventory stock updated.`, "success");
            setIsReceiveModalOpen(false);
            setSelectedOrder(null);
            fetchData();
        } catch (err) {
            console.error("Process receipt failed:", err);
            showToast(err.response?.data?.error || "Failed to process goods receipt", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Trigger Print / PDF
    const handlePrintDocument = () => {
        window.print();
    };

    // Render Status Badges
    const renderPOStatusBadge = (status) => {
        const s = String(status || "DRAFT").toUpperCase();
        switch (s) {
            case "DRAFT":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">DRAFT</span>;
            case "PENDING_APPROVAL":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">PENDING APPROVAL</span>;
            case "SENT":
            case "PLACED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">SENT TO VENDOR</span>;
            case "CONFIRMED":
            case "ACCEPTED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">VENDOR CONFIRMED</span>;
            case "PARTIALLY_RECEIVED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">PARTIALLY RECEIVED</span>;
            case "COMPLETED":
            case "DELIVERED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">COMPLETED</span>;
            case "CANCELLED":
            case "REJECTED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">CANCELLED</span>;
            default:
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{s}</span>;
        }
    };

    const renderReceivingBadge = (status) => {
        const s = String(status || "PENDING").toUpperCase();
        switch (s) {
            case "FULLY_RECEIVED":
                return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Fully Received</span>;
            case "PARTIALLY_RECEIVED":
                return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Partially Received</span>;
            default:
                return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Pending Receipt</span>;
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
                            <span>Procurement</span>
                            <span>/</span>
                            <span>Purchase Orders</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <ShoppingBag className="text-orange-500" size={20} />
                            Purchase Orders
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition ${
                            refreshing ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                        disabled={refreshing}
                    >
                        <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                        Refresh
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                    >
                        <Plus size={15} />
                        Create Purchase Order
                    </button>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* KPI Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-3 border-b border-slate-200/80 print:hidden">
                <div>
                    <span className="text-xs text-slate-500 font-medium">Draft</span>
                    <div className="text-xl font-bold text-slate-700 mt-0.5">{metrics.draft}</div>
                </div>
                <div>
                    <span className="text-xs text-amber-600 font-medium">Pending Approval</span>
                    <div className="text-xl font-bold text-amber-600 mt-0.5">{metrics.pendingApproval}</div>
                </div>
                <div>
                    <span className="text-xs text-blue-600 font-medium">Sent to Vendor</span>
                    <div className="text-xl font-bold text-blue-600 mt-0.5">{metrics.sent}</div>
                </div>
                <div>
                    <span className="text-xs text-indigo-600 font-medium">Confirmed</span>
                    <div className="text-xl font-bold text-indigo-600 mt-0.5">{metrics.confirmed}</div>
                </div>
                <div>
                    <span className="text-xs text-amber-700 font-medium">Partially Received</span>
                    <div className="text-xl font-bold text-amber-700 mt-0.5">{metrics.partiallyReceived}</div>
                </div>
                <div>
                    <span className="text-xs text-emerald-600 font-medium">Completed</span>
                    <div className="text-xl font-bold text-emerald-600 mt-0.5">{metrics.completed}</div>
                </div>
            </div>

            {/* Status Tabs Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200/80 print:hidden">
                {[
                    { id: "ALL", label: "All Orders" },
                    { id: "DRAFT", label: "Draft" },
                    { id: "PENDING_APPROVAL", label: "Pending Approval" },
                    { id: "SENT", label: "Sent / Placed" },
                    { id: "CONFIRMED", label: "Confirmed" },
                    { id: "PARTIALLY_RECEIVED", label: "Partially Received" },
                    { id: "COMPLETED", label: "Completed / Delivered" },
                    { id: "CANCELLED", label: "Cancelled" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                            statusFilter === tab.id
                                ? "bg-orange-500 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Compact Search & Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 print:hidden">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search by PO #, vendor, or contact..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                        <Filter size={13} className="text-slate-400" />
                        <select
                            value={receivingFilter}
                            onChange={(e) => setReceivingFilter(e.target.value)}
                            className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Receiving Statuses</option>
                            <option value="PENDING">Pending Receipt</option>
                            <option value="PARTIALLY_RECEIVED">Partially Received</option>
                            <option value="FULLY_RECEIVED">Fully Received</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* PO Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print:hidden">
                {loading ? (
                    <div className="p-10 text-center">
                        <RefreshCw size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">Loading purchase orders...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-10 text-center">
                        <ShoppingBag size={36} className="text-slate-300 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-slate-800">No Purchase Orders Found</h3>
                        <p className="text-slate-500 text-xs mt-0.5">
                            {searchQuery || statusFilter !== "ALL"
                                ? "No POs match your active filters."
                                : "Click 'Create Purchase Order' to generate your first PO."}
                        </p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-3 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                            <Plus size={14} /> Create Purchase Order
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                                    <th className="py-2.5 px-3.5">PO Number</th>
                                    <th className="py-2.5 px-3.5">Supplier Vendor</th>
                                    <th className="py-2.5 px-3.5">Order Date</th>
                                    <th className="py-2.5 px-3.5">Expected Delivery</th>
                                    <th className="py-2.5 px-3.5">Amount</th>
                                    <th className="py-2.5 px-3.5">Payment</th>
                                    <th className="py-2.5 px-3.5">Goods Receipt</th>
                                    <th className="py-2.5 px-3.5">PO Status</th>
                                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredOrders.map((po) => (
                                    <tr key={po.id} className="hover:bg-slate-50/70 transition">
                                        {/* PO Number */}
                                        <td className="py-2.5 px-3.5 font-mono font-extrabold text-slate-900 text-xs">
                                            #{po.orderNo}
                                        </td>

                                        {/* Supplier */}
                                        <td className="py-2.5 px-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 bg-orange-50 text-orange-600 rounded border border-orange-100">
                                                    <Building2 size={13} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-xs">
                                                        {po.supplier?.profile?.companyName || po.supplier?.email || "Vendor Supplier"}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {po.supplier?.phone || po.supplier?.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Order Date */}
                                        <td className="py-2.5 px-3.5 text-xs font-medium text-slate-600">
                                            {new Date(po.createdAt).toLocaleDateString()}
                                        </td>

                                        {/* Expected Delivery */}
                                        <td className="py-2.5 px-3.5 text-xs font-medium text-slate-700">
                                            {po.expectedDeliveryDate ? (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">Standard</span>
                                            )}
                                        </td>

                                        {/* Amount */}
                                        <td className="py-2.5 px-3.5 font-extrabold text-slate-900 text-xs">
                                            ₹{Number(po.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>

                                        {/* Payment Status */}
                                        <td className="py-2.5 px-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                po.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                                            }`}>
                                                {po.paymentStatus || "UNPAID"}
                                            </span>
                                        </td>

                                        {/* Goods Receipt */}
                                        <td className="py-2.5 px-3.5">{renderReceivingBadge(po.receivingStatus)}</td>

                                        {/* PO Status */}
                                        <td className="py-2.5 px-3.5">{renderPOStatusBadge(po.status)}</td>

                                        {/* Actions */}
                                        <td className="py-2.5 px-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Receive Goods Button */}
                                                {po.status !== "CANCELLED" && po.receivingStatus !== "FULLY_RECEIVED" && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedOrder(po);
                                                            setIsReceiveModalOpen(true);
                                                        }}
                                                        className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition cursor-pointer"
                                                        title="Receive Goods into Inventory"
                                                    >
                                                        <PackageCheck size={12} /> Receive
                                                    </button>
                                                )}

                                                {/* Print PO */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrder(po);
                                                        setIsPrintModalOpen(true);
                                                    }}
                                                    className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                                                    title="Print / Export PO Document"
                                                >
                                                    <Printer size={15} />
                                                </button>

                                                {/* View Details */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrder(po);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                    className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                                                    title="View Full PO Details"
                                                >
                                                    <Eye size={15} />
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

            {/* CREATE PURCHASE ORDER MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
                    <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                                    <ShoppingBag className="text-orange-500" size={22} /> Create Purchase Order
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Zoho/Odoo-inspired multi-line item vendor procurement entry.</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-4">
                            {/* Vendor Supplier & Address */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Vendor Supplier <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={poForm.supplierId}
                                        onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="">-- Select Vendor --</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.profile?.companyName || s.email} ({s.profile?.businessCategory || "General"})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Expected Delivery Date</label>
                                    <input
                                        type="date"
                                        value={poForm.expectedDeliveryDate}
                                        onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Destination</label>
                                    <input
                                        type="text"
                                        value={poForm.deliveryAddress}
                                        onChange={(e) => setPoForm({ ...poForm, deliveryAddress: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            {/* Items Entry Table */}
                            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider">Purchase Items Table</h4>
                                    <button
                                        type="button"
                                        onClick={handleAddItemRow}
                                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-orange-600 hover:bg-orange-50 flex items-center gap-1 shadow-2xs"
                                    >
                                        <Plus size={14} /> Add Line Item
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {poForm.items.map((item, idx) => {
                                        const qty = Number(item.quantity || 0);
                                        const rate = Number(item.unitPrice || 0);
                                        const taxPct = Number(item.taxRate || 0);
                                        const discPct = Number(item.discount || 0);
                                        const lineGross = qty * rate;
                                        const lineDisc = (lineGross * discPct) / 100;
                                        const lineNet = lineGross - lineDisc;
                                        const lineTotal = lineNet + (lineNet * taxPct) / 100;

                                        return (
                                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl grid grid-cols-12 gap-2 items-center text-xs">
                                                {/* Select or type Product */}
                                                <div className="col-span-4">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Item Name</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Item / Product Name"
                                                        value={item.productName}
                                                        onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                                                    />
                                                </div>

                                                {/* Quantity & Unit */}
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Qty & Unit</label>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0.1"
                                                            step="0.1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                                            className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={item.unit}
                                                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                                            className="w-12 px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-center"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Rate */}
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Rate (₹)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-right"
                                                    />
                                                </div>

                                                {/* Tax % */}
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Tax %</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="28"
                                                        value={item.taxRate}
                                                        onChange={(e) => handleItemChange(idx, "taxRate", e.target.value)}
                                                        className="w-full px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-center"
                                                    />
                                                </div>

                                                {/* Line Total */}
                                                <div className="col-span-2 text-right">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Line Total</label>
                                                    <span className="font-extrabold text-slate-900 text-xs">
                                                        ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>

                                                {/* Delete Row */}
                                                <div className="col-span-1 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItemRow(idx)}
                                                        disabled={poForm.items.length === 1}
                                                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Summary & Notes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Procurement Notes / Terms</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Payment terms, delivery instructions, quality expectations..."
                                        value={poForm.notes}
                                        onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
                                    <div className="flex items-center justify-between text-slate-400 font-medium">
                                        <span>Subtotal Net</span>
                                        <span>₹{poTotals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-400 font-medium">
                                        <span>GST Tax</span>
                                        <span>+₹{poTotals.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-base font-extrabold text-white">
                                        <span>Grand Total PO Amount</span>
                                        <span className="text-orange-400">₹{poTotals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                    </div>
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
                                    type="button"
                                    onClick={() => handleCreatePO("DRAFT")}
                                    disabled={submittingAction}
                                    className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl shadow-2xs"
                                >
                                    Save as Draft
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCreatePO("SENT")}
                                    disabled={submittingAction}
                                    className="px-5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                                >
                                    {submittingAction ? "Processing..." : "Issue & Send PO"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RECEIVE GOODS MODAL */}
            {isReceiveModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                                <PackageCheck size={22} /> Goods Receipt Confirmation
                            </h3>
                            <button onClick={() => setIsReceiveModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="mt-4 space-y-4">
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                <span className="text-xs font-bold text-emerald-900">PO #{selectedOrder.orderNo}</span>
                                <p className="text-xs text-slate-700 mt-0.5">
                                    Supplier: <span className="font-bold">{selectedOrder.supplier?.profile?.companyName || selectedOrder.supplier?.email}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Fulfillment Status</label>
                                <select
                                    value={receivingOption}
                                    onChange={(e) => setReceivingOption(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                >
                                    <option value="FULLY_RECEIVED">Fully Received (All Goods In Stock)</option>
                                    <option value="PARTIALLY_RECEIVED">Partially Received (Partial Delivery)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Inspection Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Good condition, batch dates checked..."
                                    value={receiveNotes}
                                    onChange={(e) => setReceiveNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button onClick={() => setIsReceiveModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleProcessReceipt}
                                    disabled={submittingAction}
                                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {submittingAction ? "Updating Inventory..." : "Confirm Receipt"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINTABLE PO DOCUMENT MODAL */}
            {isPrintModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 my-8">
                        {/* Printable PO Sheet Header */}
                        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                            <div>
                                <span className="text-xs font-extrabold text-orange-600 uppercase tracking-widest">Tiffzy Enterprise Requisition</span>
                                <h2 className="text-2xl font-black text-slate-900">PURCHASE ORDER</h2>
                                <p className="text-xs font-mono text-slate-500 mt-0.5">Order No: #{selectedOrder.orderNo}</p>
                            </div>
                            <div className="text-right print:hidden flex items-center gap-2">
                                <button
                                    onClick={handlePrintDocument}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                                >
                                    <Printer size={15} /> Print / Save PDF
                                </button>
                                <button onClick={() => setIsPrintModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* PO Header Data */}
                        <div className="grid grid-cols-2 gap-6 my-6 text-xs">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor Details</span>
                                <p className="text-sm font-extrabold text-slate-900 mt-1">
                                    {selectedOrder.supplier?.profile?.companyName || "Vendor Supplier"}
                                </p>
                                <p className="text-slate-600 mt-0.5">{selectedOrder.supplier?.email}</p>
                                <p className="text-slate-600">{selectedOrder.supplier?.phone}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Meta</span>
                                <p className="text-xs font-bold text-slate-900 mt-1">
                                    Date: {new Date(selectedOrder.createdAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs font-bold text-slate-900 mt-0.5">
                                    Delivery: {selectedOrder.expectedDeliveryDate ? new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString() : "Immediate"}
                                </p>
                                <div className="mt-2">{renderPOStatusBadge(selectedOrder.status)}</div>
                            </div>
                        </div>

                        {/* Line Items Table */}
                        <table className="w-full text-left text-xs border-collapse my-6">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                                    <th className="py-2.5 px-3">Item Description</th>
                                    <th className="py-2.5 px-3 text-center">Qty</th>
                                    <th className="py-2.5 px-3 text-right">Rate</th>
                                    <th className="py-2.5 px-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {selectedOrder.items?.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="py-3 px-3 font-semibold text-slate-900">{item.productName}</td>
                                        <td className="py-3 px-3 text-center font-bold">
                                            {item.quantity} {item.unit}
                                        </td>
                                        <td className="py-3 px-3 text-right">₹{item.unitPrice}</td>
                                        <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                                            ₹{Number(item.totalPrice || item.quantity * item.unitPrice).toLocaleString("en-IN")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Footer Calculations */}
                        <div className="flex justify-end my-4">
                            <div className="w-64 space-y-1.5 text-xs text-slate-700">
                                <div className="flex justify-between font-medium">
                                    <span>Subtotal:</span>
                                    <span>₹{Number(selectedOrder.subtotal || 0).toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                    <span>GST Tax:</span>
                                    <span>+₹{Number(selectedOrder.taxAmount || 0).toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
                                    <span>Total Amount:</span>
                                    <span>₹{Number(selectedOrder.totalAmount || 0).toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
