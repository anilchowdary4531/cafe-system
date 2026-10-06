import React, { useState, useEffect, useMemo } from "react";
import {
    FileText,
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
    CreditCard,
    DollarSign,
    Receipt,
    History,
    ArrowUpRight,
    Check,
    Tag,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../context/AuthContext";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainInvoices() {
    const { user } = useAuth();
    const userRole = String(user?.role || "OWNER").toUpperCase();
    const isManagerOrOwner = ["OWNER", "MANAGER", "SUPER_ADMIN", "ADMIN"].includes(userRole);

    const [invoices, setInvoices] = useState([]);
    const [metrics, setMetrics] = useState({
        totalInvoices: 0,
        totalPurchases: 0,
        unpaidCount: 0,
        partiallyPaidCount: 0,
        paidCount: 0,
        overdueCount: 0,
        totalUnpaidAmount: 0,
        totalPaidAmount: 0,
        totalBalanceAmount: 0,
    });
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [grns, setGrns] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [supplierFilter, setSupplierFilter] = useState("ALL");

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Create Invoice Form State
    const [createForm, setCreateForm] = useState({
        supplierId: "",
        supplyOrderId: "",
        grnId: "",
        vendorInvoiceNo: "",
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        paymentTerms: "Net 30",
        gstin: "",
        notes: "",
        discount: 0,
        items: [
            { rawMaterialId: "", itemName: "", quantity: 1, unit: "kg", unitPrice: 0, taxRate: 5 }
        ],
    });

    // Payment Form State
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        paymentMethod: "BANK_TRANSFER",
        referenceNo: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: "",
    });

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [invRes, supRes, poRes, grnRes, matRes] = await Promise.all([
                api.get("/owner/purchase-invoices").catch(() => ({ data: { invoices: [], metrics: {} } })),
                api.get("/owner/suppliers").catch(() => ({ data: { suppliers: [] } })),
                api.get("/owner/purchase-orders").catch(() => ({ data: { purchaseOrders: [] } })),
                api.get("/owner/goods-receipts").catch(() => ({ data: { goodsReceipts: [] } })),
                api.get("/owner/inventory/expiry").catch(() => ({ data: { batches: [] } })),
            ]);

            setInvoices(invRes.data?.invoices || []);
            if (invRes.data?.metrics) {
                setMetrics(invRes.data.metrics);
            }
            setSuppliers(supRes.data?.suppliers || []);
            setPurchaseOrders(poRes.data?.purchaseOrders || []);
            setGrns(grnRes.data?.goodsReceipts || []);

            // Also fetch raw materials for dropdowns
            const matListRes = await api.get("/owner/inventory/movements").catch(() => ({ data: { items: [] } }));
            setRawMaterials(matListRes.data?.items || []);
        } catch (err) {
            showToast.error("Failed to load purchase invoices data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            const q = searchQuery.toLowerCase();
            const invNo = (inv.invoiceNumber || "").toLowerCase();
            const vInvNo = (inv.vendorInvoiceNo || "").toLowerCase();
            const supName = (inv.supplier?.profile?.businessName || inv.supplier?.name || "").toLowerCase();
            const poNo = (inv.supplyOrder?.orderCode || "").toLowerCase();

            const matchesSearch = !q || invNo.includes(q) || vInvNo.includes(q) || supName.includes(q) || poNo.includes(q);

            const matchesStatus =
                statusFilter === "ALL" || String(inv.status).toUpperCase() === statusFilter.toUpperCase();

            const matchesSupplier =
                supplierFilter === "ALL" || String(inv.supplierId) === String(supplierFilter);

            return matchesSearch && matchesStatus && matchesSupplier;
        });
    }, [invoices, searchQuery, statusFilter, supplierFilter]);

    // Handle Create Form Items Update
    const handleItemChange = (index, field, value) => {
        const updated = [...createForm.items];
        updated[index][field] = value;

        if (field === "rawMaterialId") {
            const selectedMat = rawMaterials.find((m) => String(m.id) === String(value));
            if (selectedMat) {
                updated[index].itemName = selectedMat.name;
                updated[index].unit = selectedMat.unit || "kg";
                updated[index].unitPrice = selectedMat.costPerBaseUnit || selectedMat.averageCost || 0;
            }
        }
        setCreateForm({ ...createForm, items: updated });
    };

    const addItemRow = () => {
        setCreateForm({
            ...createForm,
            items: [
                ...createForm.items,
                { rawMaterialId: "", itemName: "", quantity: 1, unit: "kg", unitPrice: 0, taxRate: 5 },
            ],
        });
    };

    const removeItemRow = (index) => {
        if (createForm.items.length <= 1) return;
        const updated = createForm.items.filter((_, i) => i !== index);
        setCreateForm({ ...createForm, items: updated });
    };

    // Calculate Form Totals
    const formCalculations = useMemo(() => {
        let subtotal = 0;
        let totalTax = 0;
        createForm.items.forEach((it) => {
            const qty = Number(it.quantity || 0);
            const price = Number(it.unitPrice || 0);
            const tax = Number(it.taxRate || 0);
            const lineSub = qty * price;
            const lineTax = (lineSub * tax) / 100;
            subtotal += lineSub;
            totalTax += lineTax;
        });
        const discount = Number(createForm.discount || 0);
        const grandTotal = Math.max(0, subtotal + totalTax - discount);
        return { subtotal, totalTax, grandTotal };
    }, [createForm.items, createForm.discount]);

    // Auto-fill when PO or GRN is selected in Create Form
    const handlePOSelect = (poId) => {
        const po = purchaseOrders.find((p) => String(p.id) === String(poId));
        if (!po) return;

        setCreateForm((prev) => ({
            ...prev,
            supplyOrderId: po.id,
            supplierId: po.supplierId || prev.supplierId,
            gstin: po.supplier?.profile?.gstin || prev.gstin,
            items: (po.items || []).map((it) => ({
                rawMaterialId: it.rawMaterialId || "",
                itemName: it.productName || it.rawMaterial?.name || "Item",
                quantity: it.quantity || 1,
                unit: it.unit || "kg",
                unitPrice: it.unitPrice || 0,
                taxRate: 5,
            })),
        }));
    };

    // Create Invoice Handler
    const handleCreateInvoice = async (e) => {
        e.preventDefault();
        if (!createForm.supplierId) {
            showToast.error("Please select a supplier");
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post("/owner/purchase-invoices", createForm);
            showToast.success(res.data?.message || "Purchase Invoice created successfully!");
            setIsCreateModalOpen(false);
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to create Purchase Invoice");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Payment Modal
    const handleOpenPaymentModal = (inv) => {
        setSelectedInvoice(inv);
        setPaymentForm({
            amount: inv.balance || 0,
            paymentMethod: "BANK_TRANSFER",
            referenceNo: "",
            paymentDate: new Date().toISOString().slice(0, 10),
            notes: "",
        });
        setIsPaymentModalOpen(true);
    };

    // Record Payment Handler
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        const payAmt = Number(paymentForm.amount);
        if (payAmt <= 0 || payAmt > selectedInvoice.balance + 0.01) {
            showToast.error(`Enter a valid payment amount between ₹1 and ₹${selectedInvoice.balance.toFixed(2)}`);
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post(`/owner/purchase-invoices/${selectedInvoice.id}/payments`, paymentForm);
            showToast.success(res.data?.message || "Payment recorded successfully!");
            setIsPaymentModalOpen(false);
            if (isDetailModalOpen) {
                setSelectedInvoice(res.data?.invoice || selectedInvoice);
            }
            fetchData();
        } catch (err) {
            showToast.error(err.response?.data?.error || "Failed to record payment");
        } finally {
            setSubmitting(false);
        }
    };

    // Helper for Status Badge
    const getStatusBadge = (status) => {
        const st = String(status || "UNPAID").toUpperCase();
        switch (st) {
            case "PAID":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                    </span>
                );
            case "PARTIALLY_PAID":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Clock className="w-3.5 h-3.5" /> Partially Paid
                    </span>
                );
            case "OVERDUE":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                    </span>
                );
            case "UNPAID":
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5" /> Unpaid
                    </span>
                );
        }
    };

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* TOP HEADER BAR */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <OwnerMenuButton />
                            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
                                <span>Supply Chain</span>
                                <span>/</span>
                                <span>Invoices & Payments</span>
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                            <Receipt className="text-orange-500" size={28} />
                            Purchase Invoices & Payments
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Manage supplier tax invoices, payment schedules, accounts payable, and reconciliation records.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition border border-slate-200 shadow-sm disabled:opacity-50"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin text-orange-500" : ""}`} />
                        </button>

                        {isManagerOrOwner && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm shadow-sm transition"
                            >
                                <Plus className="w-4 h-4 stroke-[3]" />
                                <span>Create Invoice</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* TOP 5 METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Purchases */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Total Purchases</span>
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                            <Receipt className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        ₹{(metrics.totalPurchases || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {metrics.totalInvoices || 0} Total Tax Invoices
                    </div>
                </div>

                {/* Unpaid */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Unpaid</span>
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                        {metrics.unpaidCount || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Balance: ₹{(metrics.totalUnpaidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Partially Paid */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Partially Paid</span>
                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                            <CreditCard className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
                        {metrics.partiallyPaidCount || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Active partial settlements
                    </div>
                </div>

                {/* Paid */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Paid</span>
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                        {metrics.paidCount || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Settled: ₹{(metrics.totalPaidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Overdue */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase tracking-wider mb-2">
                        <span>Overdue</span>
                        <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">
                        {metrics.overdueCount || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Requires immediate payment
                    </div>
                </div>
            </div>

            {/* SEARCH AND FILTER BAR */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Invoice #, Vendor Invoice #, Supplier, PO #..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs font-medium">
                        {["ALL", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    statusFilter === st
                                        ? "bg-amber-500 text-white font-bold shadow-xs"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                }`}
                            >
                                {st === "ALL" ? "All Statuses" : st.replace("_", " ")}
                            </button>
                        ))}
                    </div>

                    {/* Supplier Filter */}
                    <select
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                        <option value="ALL">All Suppliers</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.profile?.businessName || s.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* MAIN DATA TABLE */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                        <p className="text-sm">Loading purchase invoices and payment records...</p>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Receipt className="w-12 h-12 stroke-[1.5] text-slate-600 mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-slate-200">No Purchase Invoices Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            {searchQuery || statusFilter !== "ALL" || supplierFilter !== "ALL"
                                ? "No invoices match your active filters. Try adjusting your search criteria."
                                : "Create your first Purchase Invoice to manage supplier payables and reconciliation."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-3.5">Invoice #</th>
                                    <th className="py-2.5 px-3.5">Supplier</th>
                                    <th className="py-2.5 px-3.5">PO / Reference</th>
                                    <th className="py-2.5 px-3.5">Invoice Date</th>
                                    <th className="py-2.5 px-3.5">Due Date</th>
                                    <th className="py-2.5 px-3.5 text-right">Amount (₹)</th>
                                    <th className="py-2.5 px-3.5 text-right">Paid (₹)</th>
                                    <th className="py-2.5 px-3.5 text-right">Balance (₹)</th>
                                    <th className="py-2.5 px-3.5">Status</th>
                                    <th className="py-2.5 px-3.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                                {filteredInvoices.map((inv) => {
                                    const supplierName = inv.supplier?.profile?.businessName || inv.supplier?.name || "Unassigned";
                                    const isPastDue = new Date(inv.dueDate) < new Date() && inv.balance > 0;

                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Invoice Number */}
                                            <td className="py-4 px-5">
                                                <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                                                    <span>{inv.invoiceNumber}</span>
                                                </div>
                                                {inv.vendorInvoiceNo && (
                                                    <div className="text-[11px] text-slate-500">
                                                        Vendor: #{inv.vendorInvoiceNo}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Supplier */}
                                            <td className="py-4 px-5">
                                                <div className="font-medium text-slate-200">{supplierName}</div>
                                                {inv.gstin && (
                                                    <div className="text-[11px] text-slate-500">GST: {inv.gstin}</div>
                                                )}
                                            </td>

                                            {/* PO / Reference */}
                                            <td className="py-4 px-5 text-xs text-slate-300">
                                                {inv.supplyOrder ? (
                                                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                        {inv.supplyOrder.orderCode}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">—</span>
                                                )}
                                            </td>

                                            {/* Invoice Date */}
                                            <td className="py-4 px-5 text-xs text-slate-400">
                                                {new Date(inv.invoiceDate).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </td>

                                            {/* Due Date */}
                                            <td className="py-4 px-5 text-xs">
                                                <span className={isPastDue ? "text-rose-400 font-semibold" : "text-slate-400"}>
                                                    {inv.dueDate
                                                        ? new Date(inv.dueDate).toLocaleDateString("en-IN", {
                                                              day: "2-digit",
                                                              month: "short",
                                                              year: "numeric",
                                                          })
                                                        : "Immediate"}
                                                </span>
                                            </td>

                                            {/* Total Amount */}
                                            <td className="py-4 px-5 text-right font-semibold text-white">
                                                ₹{(inv.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Paid Amount */}
                                            <td className="py-4 px-5 text-right text-emerald-400 font-medium">
                                                ₹{(inv.paidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Balance */}
                                            <td className="py-4 px-5 text-right font-bold text-amber-300">
                                                ₹{(inv.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Status */}
                                            <td className="py-4 px-5">{getStatusBadge(inv.status)}</td>

                                            {/* Actions */}
                                            <td className="py-4 px-5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedInvoice(inv);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                                                        title="View Invoice Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {isManagerOrOwner && inv.balance > 0 && (
                                                        <button
                                                            onClick={() => handleOpenPaymentModal(inv)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium text-xs transition-all"
                                                        >
                                                            <CreditCard className="w-3.5 h-3.5" />
                                                            <span>Record Payment</span>
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

            {/* CREATE PURCHASE INVOICE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg border border-orange-200">
                                    <Receipt className="w-5 h-5" />
                                </div>
                                <h2 className="text-sm font-bold text-slate-900">Create Purchase Invoice</h2>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateInvoice} className="space-y-6">
                            {/* Supplier & Linked PO */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Supplier *</label>
                                    <select
                                        value={createForm.supplierId}
                                        onChange={(e) => {
                                            const sId = e.target.value;
                                            const selectedSup = suppliers.find((s) => String(s.id) === String(sId));
                                            setCreateForm({
                                                ...createForm,
                                                supplierId: sId,
                                                gstin: selectedSup?.profile?.gstin || createForm.gstin,
                                            });
                                        }}
                                        required
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="">Select Supplier</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.profile?.businessName || s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Link PO (Optional)</label>
                                    <select
                                        value={createForm.supplyOrderId}
                                        onChange={(e) => handlePOSelect(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="">Select PO to autofill</option>
                                        {purchaseOrders.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.orderCode} (₹{p.totalAmount?.toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Vendor Invoice #</label>
                                    <input
                                        type="text"
                                        placeholder="Supplier Tax Invoice No"
                                        value={createForm.vendorInvoiceNo}
                                        onChange={(e) => setCreateForm({ ...createForm, vendorInvoiceNo: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Dates & Terms */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Invoice Date</label>
                                    <input
                                        type="date"
                                        value={createForm.invoiceDate}
                                        onChange={(e) => setCreateForm({ ...createForm, invoiceDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Due Date</label>
                                    <input
                                        type="date"
                                        value={createForm.dueDate}
                                        onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Payment Terms</label>
                                    <select
                                        value={createForm.paymentTerms}
                                        onChange={(e) => setCreateForm({ ...createForm, paymentTerms: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="Immediate">Immediate / Advance</option>
                                        <option value="Net 15">Net 15 Days</option>
                                        <option value="Net 30">Net 30 Days</option>
                                        <option value="Net 60">Net 60 Days</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Supplier GSTIN</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 29ABCDE1234F1Z5"
                                        value={createForm.gstin}
                                        onChange={(e) => setCreateForm({ ...createForm, gstin: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-200">Line Items</h3>
                                    <button
                                        type="button"
                                        onClick={addItemRow}
                                        className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Line Item
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {createForm.items.map((it, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                            <div className="col-span-4">
                                                <input
                                                    type="text"
                                                    placeholder="Item Description / Name"
                                                    value={it.itemName}
                                                    onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                                                    required
                                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Qty"
                                                    value={it.quantity}
                                                    onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                                    required
                                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:border-amber-500 focus:outline-none text-right"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Rate (₹)"
                                                    value={it.unitPrice}
                                                    onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                                                    required
                                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:border-amber-500 focus:outline-none text-right"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <select
                                                    value={it.taxRate}
                                                    onChange={(e) => handleItemChange(idx, "taxRate", e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                                >
                                                    <option value="0">GST 0%</option>
                                                    <option value="5">GST 5%</option>
                                                    <option value="12">GST 12%</option>
                                                    <option value="18">GST 18%</option>
                                                </select>
                                            </div>

                                            <div className="col-span-2 flex items-center justify-between pl-2">
                                                <span className="text-xs font-semibold text-slate-200">
                                                    ₹{((it.quantity || 0) * (it.unitPrice || 0) * (1 + (it.taxRate || 0) / 100)).toFixed(2)}
                                                </span>
                                                {createForm.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItemRow(idx)}
                                                        className="text-slate-500 hover:text-rose-400 p-1"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary & Totals */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-800">
                                <div className="w-full md:w-1/2">
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes / Payment Remarks</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Add payment terms, bank details, or internal reference notes..."
                                        value={createForm.notes}
                                        onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div className="w-full md:w-1/3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Subtotal:</span>
                                        <span>₹{formCalculations.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Taxes (GST):</span>
                                        <span>₹{formCalculations.totalTax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400 items-center">
                                        <span>Discount:</span>
                                        <input
                                            type="number"
                                            value={createForm.discount}
                                            onChange={(e) => setCreateForm({ ...createForm, discount: e.target.value })}
                                            className="w-20 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-xs text-slate-100"
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                                        <span>Grand Total:</span>
                                        <span className="text-amber-400">₹{formCalculations.grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-bold shadow-md disabled:opacity-50"
                                >
                                    {submitting ? "Saving Invoice..." : "Save Invoice"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* INVOICE DETAIL VIEW MODAL */}
            {isDetailModalOpen && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-slate-900">{selectedInvoice.invoiceNumber}</h2>
                                    {getStatusBadge(selectedInvoice.status)}
                                </div>
                                {selectedInvoice.vendorInvoiceNo && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Vendor Tax Invoice #: <span className="text-slate-800 font-semibold">{selectedInvoice.vendorInvoiceNo}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Metadata Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Supplier Card */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1 text-xs">
                                <div className="text-[10px] font-bold uppercase text-slate-400">Supplier Info</div>
                                <div className="text-xs font-bold text-slate-900">
                                    {selectedInvoice.supplier?.profile?.businessName || selectedInvoice.supplier?.name || "N/A"}
                                </div>
                                {selectedInvoice.gstin && <div className="text-[11px] text-slate-600">GSTIN: {selectedInvoice.gstin}</div>}
                                {selectedInvoice.supplier?.phone && <div className="text-[11px] text-slate-600">Phone: {selectedInvoice.supplier.phone}</div>}
                            </div>

                            {/* Invoice Summary Card */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1 text-xs">
                                <div className="text-[10px] font-bold uppercase text-slate-400">Invoice Timeline & Terms</div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Invoice Date:</span>
                                    <span className="text-slate-900 font-medium">
                                        {new Date(selectedInvoice.invoiceDate).toLocaleDateString("en-IN")}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Due Date:</span>
                                    <span className="text-orange-600 font-bold">
                                        {selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString("en-IN") : "Immediate"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Payment Terms:</span>
                                    <span className="text-slate-900 font-medium">{selectedInvoice.paymentTerms || "Net 30"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Line Items Table */}
                        <div className="space-y-1.5">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Line Items</h3>
                            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-3.5">Item Name</th>
                                            <th className="py-2.5 px-3.5 text-right">Qty</th>
                                            <th className="py-2.5 px-3.5 text-right">Rate (₹)</th>
                                            <th className="py-2.5 px-3.5 text-right">Tax (%)</th>
                                            <th className="py-2.5 px-3.5 text-right">Total (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {(selectedInvoice.items || []).map((it) => (
                                            <tr key={it.id} className="hover:bg-slate-50/80">
                                                <td className="py-2.5 px-3.5 text-slate-900 font-bold">{it.itemName}</td>
                                                <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                                                    {it.quantity} {it.unit}
                                                </td>
                                                <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                                                    ₹{(it.unitPrice || 0).toFixed(2)}
                                                </td>
                                                <td className="py-2.5 px-3.5 text-right font-mono text-slate-500">{it.taxRate}%</td>
                                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                                                    ₹{(it.total || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Financial Totals */}
                        <div className="flex justify-end">
                            <div className="w-full md:w-1/2 bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-500">
                                    <span>Subtotal:</span>
                                    <span className="font-mono font-medium">₹{(selectedInvoice.subtotal || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Total Tax (GST):</span>
                                    <span className="font-mono font-medium">₹{(selectedInvoice.taxAmount || 0).toFixed(2)}</span>
                                </div>
                                {selectedInvoice.discount > 0 && (
                                    <div className="flex justify-between text-slate-500">
                                        <span>Discount:</span>
                                        <span className="font-mono font-medium">-₹{selectedInvoice.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                                    <span>Total Amount:</span>
                                    <span className="font-mono">₹{(selectedInvoice.totalAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-emerald-600 font-bold">
                                    <span>Amount Paid:</span>
                                    <span className="font-mono">₹{(selectedInvoice.paidAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-extrabold text-orange-600 pt-1 border-t border-slate-200">
                                    <span>Balance Due:</span>
                                    <span className="font-mono">₹{(selectedInvoice.balance || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment History */}
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                    <History className="w-4 h-4 text-orange-500" />
                                    <span>Payment History & Reconciliation</span>
                                </h3>
                                {isManagerOrOwner && selectedInvoice.balance > 0 && (
                                    <button
                                        onClick={() => handleOpenPaymentModal(selectedInvoice)}
                                        className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs cursor-pointer"
                                    >
                                        + Record Payment
                                    </button>
                                )}
                            </div>

                            {(!selectedInvoice.payments || selectedInvoice.payments.length === 0) ? (
                                <div className="p-3 text-center bg-slate-50 rounded-lg border border-slate-200/80 text-slate-400 text-xs">
                                    No payments recorded yet against this invoice.
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-2.5 px-3.5">Payment Code</th>
                                                <th className="py-2.5 px-3.5">Date</th>
                                                <th className="py-2.5 px-3.5">Method</th>
                                                <th className="py-2.5 px-3.5">Reference / UTR #</th>
                                                <th className="py-2.5 px-3.5 text-right">Amount (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {selectedInvoice.payments.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50/80">
                                                    <td className="py-2.5 px-3.5 font-mono font-bold text-orange-600">{p.paymentCode}</td>
                                                    <td className="py-2.5 px-3.5 text-slate-500">
                                                        {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 font-bold text-slate-900">
                                                        {p.paymentMethod.replace("_", " ")}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-slate-500 font-mono">{p.referenceNo || "N/A"}</td>
                                                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600">
                                                        ₹{(p.amount || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* RECORD PAYMENT MODAL */}
            {isPaymentModalOpen && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl p-5 space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-orange-500" />
                                <h2 className="text-sm font-bold text-slate-900">Record Supplier Payment</h2>
                            </div>
                            <button
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Invoice Summary Banner */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Invoice:</span>
                                <span className="font-mono font-bold text-orange-600">{selectedInvoice.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Supplier:</span>
                                <span className="text-slate-900 font-bold">
                                    {selectedInvoice.supplier?.profile?.businessName || selectedInvoice.supplier?.name}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                                <span>Balance Due:</span>
                                <span className="font-mono text-orange-600">₹{(selectedInvoice.balance || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Amount (₹) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    max={selectedInvoice.balance}
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    required
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Method</label>
                                <select
                                    value={paymentForm.paymentMethod}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                >
                                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                                    <option value="UPI">UPI Payment</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="CREDIT_NOTE">Credit Note Adjustment</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Reference / UTR #</label>
                                <input
                                    type="text"
                                    placeholder="Bank UTR, Cheque #, or Txn Reference"
                                    value={paymentForm.referenceNo}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Date</label>
                                <input
                                    type="date"
                                    value={paymentForm.paymentDate}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Notes / Remarks</label>
                                <textarea
                                    rows={2}
                                    placeholder="Add any payment comments..."
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? "Processing..." : "Confirm & Save Payment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
