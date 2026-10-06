import React, { useState, useEffect, useMemo } from "react";
import {
    PackageCheck,
    Plus,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    ShoppingBag,
    Printer,
    Truck,
    Building2,
    Calendar,
    RefreshCw,
    X,
    Check,
    Eye,
    AlertTriangle,
    ShieldAlert,
    FileText,
    Layers,
    MapPin,
    Tag,
    Trash2,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainReceiving() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();

    const [grns, setGrns] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // Modal States
    const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedGRN, setSelectedGRN] = useState(null);
    const [submittingAction, setSubmittingAction] = useState(false);

    // Form State for Goods Receiving
    const [receivingForm, setReceivingForm] = useState({
        supplyOrderId: "",
        supplierId: "",
        deliveryReference: "DC-9042",
        invoiceNumber: "INV-2026-8812",
        receivedDate: new Date().toISOString().split("T")[0],
        notes: "Inspected at loading bay, temperature and packaging intact.",
        items: [
            {
                rawMaterialId: "",
                itemName: "Whole Milk Packets",
                unit: "L",
                expectedQty: 50,
                receivedQty: 45,
                damagedQty: 0,
                rejectedQty: 5,
                batchNumber: "BAT-2026-10A",
                expiryDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                storageLocation: "Cold Room 1",
                notes: "5 L rejected due to seal leakage",
            },
        ],
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [grnRes, poRes, supRes, matRes] = await Promise.all([
                api.get("/api/owner/goods-receipts").catch(() => ({ data: { grns: [] } })),
                api.get("/api/owner/purchase-orders").catch(() => ({ data: { orders: [] } })),
                api.get("/api/owner/suppliers").catch(() => ({ data: { suppliers: [] } })),
                api.get("/api/owner/inventory").catch(() => ({ data: { items: [] } })),
            ]);

            setGrns(grnRes.data?.grns || []);
            setPurchaseOrders(poRes.data?.orders || []);
            setSuppliers(supRes.data?.suppliers || []);
            setRawMaterials(matRes.data?.items || matRes.data?.rawMaterials || []);
        } catch (err) {
            console.error("Error loading Goods Receiving data:", err);
            showToast("Failed to fetch Goods Receiving records", "error");
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
        const todayStr = new Date().toISOString().split("T")[0];
        const expectedToday = grns.filter((g) => new Date(g.receivedDate).toISOString().split("T")[0] === todayStr).length;
        const pending = grns.filter((g) => g.status === "PENDING").length;
        const partiallyReceived = grns.filter((g) => g.status === "PARTIALLY_RECEIVED").length;
        const receivedToday = grns.filter(
            (g) => (g.status === "FULLY_RECEIVED" || g.status === "PARTIALLY_RECEIVED") &&
                new Date(g.createdAt).toISOString().split("T")[0] === todayStr
        ).length;
        const rejected = grns.filter((g) => g.status === "REJECTED" || g.totalRejectedQty > 0).length;

        return { expectedToday, pending, partiallyReceived, receivedToday, rejected, total: grns.length };
    }, [grns]);

    // Filtered GRNs
    const filteredGrns = useMemo(() => {
        return grns.filter((g) => {
            const matchesSearch =
                !searchQuery ||
                g.grnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.supplyOrder?.orderNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.supplier?.profile?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === "ALL" || g.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [grns, searchQuery, statusFilter]);

    // Pre-fill Receiving Form when a Purchase Order is selected
    const handleSelectPO = (poId) => {
        if (!poId) {
            setReceivingForm((prev) => ({ ...prev, supplyOrderId: "", supplierId: "" }));
            return;
        }
        const po = purchaseOrders.find((p) => String(p.id) === String(poId));
        if (po) {
            const poItems = po.items?.map((item) => {
                const mat = rawMaterials.find((m) => m.name.toLowerCase() === item.productName?.toLowerCase());
                return {
                    rawMaterialId: mat ? String(mat.id) : "",
                    itemName: item.productName,
                    unit: item.unit || "kg",
                    expectedQty: item.quantity,
                    receivedQty: item.quantity, // Default to full expected
                    damagedQty: 0,
                    rejectedQty: 0,
                    batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
                    expiryDate: new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0],
                    storageLocation: "Main Kitchen",
                    notes: "",
                };
            });

            setReceivingForm((prev) => ({
                ...prev,
                supplyOrderId: String(po.id),
                supplierId: String(po.supplierId),
                items: poItems.length ? poItems : prev.items,
            }));
        }
    };

    // Form item row management
    const handleAddItemRow = () => {
        setReceivingForm((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    rawMaterialId: "",
                    itemName: "",
                    unit: "kg",
                    expectedQty: 10,
                    receivedQty: 10,
                    damagedQty: 0,
                    rejectedQty: 0,
                    batchNumber: "",
                    expiryDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                    storageLocation: "Main Kitchen",
                    notes: "",
                },
            ],
        }));
    };

    const handleRemoveItemRow = (index) => {
        if (receivingForm.items.length === 1) return;
        setReceivingForm((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...receivingForm.items];
        updated[index][field] = value;

        if (field === "rawMaterialId" && value) {
            const mat = rawMaterials.find((m) => String(m.id) === String(value));
            if (mat) {
                updated[index].itemName = mat.name;
                updated[index].unit = mat.displayUnit || mat.baseUnit || "kg";
            }
        }
        setReceivingForm({ ...receivingForm, items: updated });
    };

    // Submit Process Goods Receipt Note (GRN)
    const handleCreateGRN = async (e) => {
        e.preventDefault();
        if (!receivingForm.items.some((i) => i.itemName && Number(i.receivedQty) >= 0)) {
            showToast("Please enter at least one item with received quantity", "error");
            return;
        }

        try {
            setSubmittingAction(true);
            await api.post("/api/owner/goods-receipts", receivingForm);
            showToast("Auditable GRN created! Inventory increased by actual accepted quantity.", "success");
            setIsReceivingModalOpen(false);
            fetchData();
        } catch (err) {
            console.error("Create GRN failed:", err);
            showToast(err.response?.data?.error || "Failed to process Goods Receipt", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Render Status Badge
    const renderStatusBadge = (status) => {
        const s = String(status || "FULLY_RECEIVED").toUpperCase();
        switch (s) {
            case "FULLY_RECEIVED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={12} /> FULLY RECEIVED
                    </span>
                );
            case "PARTIALLY_RECEIVED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle size={12} /> PARTIALLY RECEIVED
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <XCircle size={12} /> REJECTED
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
                        <Clock size={12} /> PENDING
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
            {/* Header Console Bar */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
                <div className="w-full px-3 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <OwnerMenuButton />
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                                    <span>Supply Chain</span>
                                    <span>/</span>
                                    <span>Goods Receiving (GRN)</span>
                                </div>
                            </div>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <PackageCheck className="text-orange-500" size={20} />
                                Goods Receiving & GRN
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Inspect physical deliveries, track short shipments, record batches/expiries, and generate auditable GRN notes.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleRefresh}
                                className={`p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer ${
                                    refreshing ? "opacity-60 cursor-not-allowed" : ""
                                }`}
                                disabled={refreshing}
                                title="Refresh Records"
                            >
                                <RefreshCw size={15} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            </button>

                            <button
                                onClick={() => setIsReceivingModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>Process Goods Receipt (GRN)</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="w-full px-3 py-4 space-y-4">
                <SupplyChainSubNav />

                {/* Metrics Row (Flat Horizontal Analytics Layout) */}
                <div className="border-b border-slate-200/80 pb-4 space-y-2">
                    <p className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">RECEIVING PERFORMANCE OVERVIEW</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">EXPECTED TODAY</span>
                            <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{metrics.expectedToday}</div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Scheduled deliveries</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">PENDING INSPECTION</span>
                            <div className="text-2xl font-black text-amber-900 tracking-tight mt-0.5">{metrics.pending}</div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Awaiting verification</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">PARTIALLY RECEIVED</span>
                            <div className="text-2xl font-black text-amber-900 tracking-tight mt-0.5">{metrics.partiallyReceived}</div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Short shipments</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">RECEIVED TODAY</span>
                            <div className="text-2xl font-black text-emerald-700 tracking-tight mt-0.5">{metrics.receivedToday}</div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Added to stock</p>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">REJECTED / DAMAGED</span>
                            <div className="text-2xl font-black text-rose-700 tracking-tight mt-0.5">{metrics.rejected}</div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Quality variance records</p>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search by GRN #, PO Number, vendor name, or invoice #..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50/50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            >
                                <option value="ALL">All GRN Statuses</option>
                                <option value="FULLY_RECEIVED">Fully Received</option>
                                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                                <option value="PENDING">Pending</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main GRN Table */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="p-4 bg-slate-50/60 border-b border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Goods Receipt Notes (GRN) History</h3>
                            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                                {filteredGrns.length} records
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">Auditable physical receiving history</p>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center">
                            <RefreshCw size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
                            <p className="text-slate-500 text-xs font-medium">Loading Goods Receiving records...</p>
                        </div>
                    ) : filteredGrns.length === 0 ? (
                        <div className="p-12 text-center">
                            <PackageCheck size={36} className="text-slate-300 mx-auto mb-2" />
                            <h3 className="text-sm font-bold text-slate-900">No Goods Receipt Notes Found</h3>
                            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                                {searchQuery || statusFilter !== "ALL"
                                    ? "No GRN records match your active search."
                                    : "Click 'Process Goods Receipt (GRN)' to log incoming stock."}
                            </p>
                            <button
                                onClick={() => setIsReceivingModalOpen(true)}
                                className="mt-4 px-3.5 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:bg-orange-600 shadow-xs cursor-pointer"
                            >
                                <Plus size={14} /> Process Goods Receipt (GRN)
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2.5 px-3.5">GRN #</th>
                                        <th className="py-2.5 px-3.5">PO Number</th>
                                        <th className="py-2.5 px-3.5">Supplier Vendor</th>
                                        <th className="py-2.5 px-3.5 text-center">Expected Qty</th>
                                        <th className="py-2.5 px-3.5 text-center">Received Qty</th>
                                        <th className="py-2.5 px-3.5 text-center">Variance / Shortage</th>
                                        <th className="py-2.5 px-3.5">Received Date</th>
                                        <th className="py-2.5 px-3.5 text-center">Status</th>
                                        <th className="py-2.5 px-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {filteredGrns.map((grn) => {
                                        const diff = Number(grn.differenceQty || 0);

                                        return (
                                            <tr key={grn.id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* GRN Number */}
                                                <td className="py-2 px-3.5 font-mono font-extrabold text-amber-900 text-[11px] whitespace-nowrap">
                                                    #{grn.grnNumber}
                                                </td>

                                                {/* PO Number */}
                                                <td className="py-2 px-3.5 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
                                                    {grn.supplyOrder?.orderNo ? `#${grn.supplyOrder.orderNo}` : "Direct Receipt"}
                                                </td>

                                                {/* Supplier */}
                                                <td className="py-2 px-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                                            <Building2 size={13} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-xs">
                                                                {grn.supplier?.profile?.companyName || grn.supplier?.email || "Vendor Supplier"}
                                                            </p>
                                                            {grn.invoiceNumber && (
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    Inv: {grn.invoiceNumber}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Expected Qty */}
                                                <td className="py-2 px-3.5 text-center font-bold text-slate-700">
                                                    {grn.totalExpectedQty}
                                                </td>

                                                {/* Received Qty */}
                                                <td className="py-2 px-3.5 text-center font-black text-emerald-700 text-xs">
                                                    {grn.totalReceivedQty}
                                                </td>

                                                {/* Difference */}
                                                <td className="py-2 px-3.5 text-center whitespace-nowrap">
                                                    {diff > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200">
                                                            -{diff} (Shortage)
                                                        </span>
                                                    ) : diff < 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                                                            +{Math.abs(diff)} (Excess)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                                            Exact Match
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Received Date */}
                                                <td className="py-2 px-3.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                                                    {new Date(grn.receivedDate).toLocaleDateString()}
                                                </td>

                                                {/* Status */}
                                                <td className="py-2 px-3.5 text-center whitespace-nowrap">
                                                    {renderStatusBadge(grn.status)}
                                                </td>

                                                {/* Action */}
                                                <td className="py-2 px-3.5 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedGRN(grn);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition shadow-2xs cursor-pointer"
                                                        title="View Full GRN Record"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* PROCESS GOODS RECEIPT (GRN) MODAL */}
            {isReceivingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-5 shadow-xl border border-slate-200/80 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <PackageCheck className="text-orange-500" size={18} /> Process Goods Receiving Note (GRN)
                                </h3>
                                <p className="text-xs text-slate-500">Physical receiving verification & auditable stock entry.</p>
                            </div>
                            <button onClick={() => setIsReceivingModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGRN} className="mt-4 space-y-4 text-xs">
                            {/* PO Selection & Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Purchase Order (Optional)</label>
                                    <select
                                        value={receivingForm.supplyOrderId}
                                        onChange={(e) => handleSelectPO(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="">-- Direct Supplier Receipt --</option>
                                        {purchaseOrders.map((po) => (
                                            <option key={po.id} value={po.id}>
                                                #{po.orderNo} ({po.supplier?.profile?.companyName || "Vendor"})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Vendor</label>
                                    <select
                                        value={receivingForm.supplierId}
                                        onChange={(e) => setReceivingForm({ ...receivingForm, supplierId: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="">-- Select Vendor --</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.profile?.companyName || s.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Reference / Challan #</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. DC-9042, LR-102"
                                        value={receivingForm.deliveryReference}
                                        onChange={(e) => setReceivingForm({ ...receivingForm, deliveryReference: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Invoice #</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-2026-8812"
                                        value={receivingForm.invoiceNumber}
                                        onChange={(e) => setReceivingForm({ ...receivingForm, invoiceNumber: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            {/* AUDIT NOTICE BANNER */}
                            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-extrabold">Auditable Receiving Rule:</span> Inventory stock will be increased strictly by the <span className="font-bold underline">actual accepted quantity</span>. Shortages or damages are recorded as variance notes.
                                </div>
                            </div>

                            {/* Receiving Items Table */}
                            <div className="border border-slate-200/80 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-extrabold uppercase text-amber-900 tracking-wider">Item Physical Verification Table</h4>
                                    <button
                                        type="button"
                                        onClick={handleAddItemRow}
                                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-orange-600 hover:bg-orange-50 flex items-center gap-1 shadow-2xs cursor-pointer"
                                    >
                                        <Plus size={13} /> Add Item
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {receivingForm.items.map((item, idx) => {
                                        const exp = Number(item.expectedQty || 0);
                                        const rec = Number(item.receivedQty || 0);
                                        const diff = exp - rec;

                                        return (
                                            <div key={idx} className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-2 text-xs">
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                    {/* Item Name */}
                                                    <div className="col-span-4">
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Item Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Item / Product Name"
                                                            value={item.itemName}
                                                            onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                                                            className="w-full px-2.5 py-1 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                                                        />
                                                    </div>

                                                    {/* Expected Qty */}
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Ordered Qty</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.expectedQty}
                                                            onChange={(e) => handleItemChange(idx, "expectedQty", e.target.value)}
                                                            className="w-full px-2 py-1 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-900"
                                                        />
                                                    </div>

                                                    {/* Actual Accepted Qty */}
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-extrabold text-emerald-800 mb-0.5">Accepted Qty *</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.receivedQty}
                                                            onChange={(e) => handleItemChange(idx, "receivedQty", e.target.value)}
                                                            className="w-full px-2 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-extrabold text-center text-emerald-900"
                                                        />
                                                    </div>

                                                    {/* Rejected / Damaged */}
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-bold text-rose-700 mb-0.5">Rejected / Damaged</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.rejectedQty}
                                                            onChange={(e) => handleItemChange(idx, "rejectedQty", e.target.value)}
                                                            className="w-full px-2 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-center text-rose-800"
                                                        />
                                                    </div>

                                                    {/* Variance Display */}
                                                    <div className="col-span-1 text-center">
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Shortage</label>
                                                        <span className={`font-bold text-xs ${diff > 0 ? "text-amber-900 font-extrabold" : "text-slate-600"}`}>
                                                            {diff} {item.unit}
                                                        </span>
                                                    </div>

                                                    {/* Delete */}
                                                    <div className="col-span-1 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItemRow(idx)}
                                                            disabled={receivingForm.items.length === 1}
                                                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Batch, Expiry & Storage Location */}
                                                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500">Batch Number</label>
                                                        <input
                                                            type="text"
                                                            placeholder="BAT-10492"
                                                            value={item.batchNumber}
                                                            onChange={(e) => handleItemChange(idx, "batchNumber", e.target.value)}
                                                            className="w-full px-2 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-slate-900 font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500">Expiry Date</label>
                                                        <input
                                                            type="date"
                                                            value={item.expiryDate}
                                                            onChange={(e) => handleItemChange(idx, "expiryDate", e.target.value)}
                                                            className="w-full px-2 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-slate-900 font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500">Storage Location</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Cold Room 1, Dry Pantry"
                                                            value={item.storageLocation}
                                                            onChange={(e) => handleItemChange(idx, "storageLocation", e.target.value)}
                                                            className="w-full px-2 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-slate-900 font-medium"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Inspection Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Overall Receiving Inspection Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Enter physical inspection notes, driver details, or quality comments..."
                                    value={receivingForm.notes}
                                    onChange={(e) => setReceivingForm({ ...receivingForm, notes: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsReceivingModalOpen(false)}
                                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="px-4 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingAction ? "Processing..." : "Confirm GRN & Update Inventory"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AUDITABLE GRN DETAIL MODAL */}
            {isDetailModalOpen && selectedGRN && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-xl border border-slate-200/80 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Goods Receipt Note (GRN)</span>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
                                    #{selectedGRN.grnNumber}
                                </h3>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-3.5 text-xs">
                            {/* Summary Metadata Banner */}
                            <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Vendor Supplier</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {selectedGRN.supplier?.profile?.companyName || selectedGRN.supplier?.email || "Vendor"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">PO Number</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {selectedGRN.supplyOrder?.orderNo ? `#${selectedGRN.supplyOrder.orderNo}` : "Direct Receipt"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Received Date</span>
                                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                                        {new Date(selectedGRN.receivedDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* References & Invoice */}
                            <div className="grid grid-cols-2 gap-2.5 p-3 bg-white border border-slate-200/80 rounded-xl">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Delivery Reference / Challan</span>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedGRN.deliveryReference || "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor Invoice #</span>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedGRN.invoiceNumber || "N/A"}</p>
                                </div>
                            </div>

                            {/* Item Inspection Breakdown Table */}
                            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80 text-[10px]">
                                            <th className="py-2 px-3">Item</th>
                                            <th className="py-2 px-3 text-center">Ordered</th>
                                            <th className="py-2 px-3 text-center text-emerald-800">Accepted</th>
                                            <th className="py-2 px-3 text-center text-rose-800">Rejected</th>
                                            <th className="py-2 px-3">Batch & Expiry</th>
                                            <th className="py-2 px-3">Location</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                        {selectedGRN.items?.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 px-3 font-bold text-slate-900">{item.itemName}</td>
                                                <td className="py-2 px-3 text-center font-medium">{item.expectedQty} {item.unit}</td>
                                                <td className="py-2 px-3 text-center font-black text-emerald-700">
                                                    {item.receivedQty} {item.unit}
                                                </td>
                                                <td className="py-2 px-3 text-center font-bold text-rose-600">{item.rejectedQty}</td>
                                                <td className="py-2 px-3 text-[11px] text-slate-600">
                                                    <div>Batch: {item.batchNumber || "N/A"}</div>
                                                    <div>Exp: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}</div>
                                                </td>
                                                <td className="py-2 px-3 text-[11px] font-semibold text-slate-700">{item.storageLocation || "Main Kitchen"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Inspection Notes */}
                            {selectedGRN.notes && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Inspection Notes</span>
                                    <p className="text-xs text-slate-700 font-medium mt-0.5">{selectedGRN.notes}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-4 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition cursor-pointer"
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
