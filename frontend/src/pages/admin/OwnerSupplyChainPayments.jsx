import { useState, useEffect, useMemo } from "react";
import {
    IndianRupee,
    CreditCard,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Search,
    Filter,
    RefreshCw,
    X,
    FileText,
    Truck,
    Receipt,
    DollarSign,
    ArrowDownRight,
    ArrowUpRight,
    Building2,
    ChevronRight,
    Calendar,
    Check,
    AlertCircle,
    UserCheck,
    PlusCircle,
    Download,
    Eye
} from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";
import OwnerMenuButton from "../../components/OwnerMenuButton";

export default function OwnerSupplyChainPayments() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        invoices: [],
        payments: [],
        returns: [],
        suppliersSummary: [],
        metrics: {
            totalPurchaseValue: 0,
            paidAmount: 0,
            pendingAmount: 0,
            overdueAmount: 0,
            supplierCredits: 0
        }
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedSupplierId, setSelectedSupplierId] = useState(null);

    // Record Payment Modal State
    const [settlementModalInvoice, setSettlementModalInvoice] = useState(null);
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        paymentMethod: "BANK_TRANSFER",
        referenceNo: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: ""
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/supply/payments");
            setData(res?.data || res || {});
        } catch (err) {
            console.error("Failed to load supply chain payments:", err);
            showToast.error("Failed to load supply chain payments & settlements data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Invoices for the main Table
    const filteredInvoices = useMemo(() => {
        return (data.invoices || []).filter((inv) => {
            const supName = String(inv.supplier?.profile?.companyName || inv.supplier?.name || "").toLowerCase();
            const poNo = String(inv.supplyOrder?.orderNo || inv.supplyOrderId || "").toLowerCase();
            const invNo = String(inv.invoiceNumber || inv.vendorInvoiceNo || "").toLowerCase();
            const query = searchQuery.toLowerCase().trim();

            const matchesSearch = !query || supName.includes(query) || poNo.includes(query) || invNo.includes(query);
            const matchesStatus = statusFilter === "ALL" || String(inv.status).toUpperCase() === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [data.invoices, searchQuery, statusFilter]);

    // Selected Supplier Details
    const selectedSupplierDetail = useMemo(() => {
        if (!selectedSupplierId) return null;
        return (data.suppliersSummary || []).find((s) => s.supplierId === Number(selectedSupplierId));
    }, [data.suppliersSummary, selectedSupplierId]);

    const openRecordSettlement = (invoice) => {
        setSettlementModalInvoice(invoice);
        setPaymentForm({
            amount: String(invoice.balance || 0),
            paymentMethod: "BANK_TRANSFER",
            referenceNo: "",
            paymentDate: new Date().toISOString().slice(0, 10),
            notes: `Settlement payment for invoice #${invoice.invoiceNumber}`
        });
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!settlementModalInvoice) return;
        const amt = Number(paymentForm.amount);
        if (isNaN(amt) || amt <= 0) {
            showToast.error("Please enter a valid positive payment amount");
            return;
        }

        setSubmittingPayment(true);
        try {
            const res = await api.post(`/owner/purchase-invoices/${settlementModalInvoice.id}/payments`, {
                amount: amt,
                paymentMethod: paymentForm.paymentMethod,
                referenceNo: paymentForm.referenceNo,
                paymentDate: paymentForm.paymentDate,
                notes: paymentForm.notes
            });

            showToast.success(res?.data?.message || "Payment settlement recorded successfully!");
            setSettlementModalInvoice(null);
            fetchData();
        } catch (err) {
            console.error("Payment error:", err);
            showToast.error(err.response?.data?.error || "Failed to record payment settlement");
        } finally {
            setSubmittingPayment(false);
        }
    };

    const formatCurrency = (val) => {
        return `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatStatusBadge = (status) => {
        const st = String(status || "").toUpperCase();
        switch (st) {
            case "PAID":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} /> Paid
                    </span>
                );
            case "PARTIALLY_PAID":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} /> Partially Paid
                    </span>
                );
            case "OVERDUE":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle size={12} /> Overdue
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock size={12} /> Unpaid
                    </span>
                );
        }
    };    return (
        <section className="space-y-4 font-sans text-sm text-slate-900 pb-12">
            {/* Header Console */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                            <span>Supply Chain</span>
                            <span>/</span>
                            <span>Supplier Settlement & Payments</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                            <CreditCard className="text-orange-500" size={20} />
                            Supplier Settlement
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200/80 text-slate-700 rounded-lg hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={13} className={loading ? "animate-spin text-orange-500" : ""} />
                        <span>Refresh Data</span>
                    </button>
                </div>
            </div>

            <SupplyChainSubNav />

            {/* Overdue Alert Banner (Visually Obvious without Dark Panels) */}
            {data.metrics?.overdueAmount > 0 && (
                <div className="bg-rose-50/90 border border-rose-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs print:hidden">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-rose-100/80 rounded-lg text-rose-600">
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                                Overdue Settlement Balance Attention Needed
                            </span>
                            <p className="text-[11px] text-rose-700 mt-0.5">
                                You have <span className="font-bold font-mono text-rose-800">{formatCurrency(data.metrics.overdueAmount)}</span> in overdue supplier invoices past net payment terms.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setStatusFilter("OVERDUE")}
                        className="self-start sm:self-auto px-3 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-2xs cursor-pointer whitespace-nowrap"
                    >
                        View Overdue Invoices ({data.invoices?.filter(i => String(i.status).toUpperCase() === "OVERDUE").length || 0})
                    </button>
                </div>
            )}

            {/* Compact Financial Settlement Metrics Summary (Analytics Style - No Dark Panels) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Settlement Summary</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{formatCurrency(data.metrics?.totalPurchaseValue)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Total Purchase Volume</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Paid Amount</span>
                    <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">{formatCurrency(data.metrics?.paidAmount)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Settled to Suppliers</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pending Balances</span>
                    <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">{formatCurrency(data.metrics?.pendingAmount)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Outstanding Liability</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Overdue Amount</span>
                    <div className={`text-lg font-bold font-mono mt-0.5 ${data.metrics?.overdueAmount > 0 ? "text-rose-600 font-extrabold" : "text-slate-400"}`}>
                        {formatCurrency(data.metrics?.overdueAmount)}
                    </div>
                    <span className="text-[10px] text-rose-600/80 font-medium">Past Due Terms</span>
                </div>
                <div className="py-1">
                    <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Supplier Credits</span>
                    <div className="text-lg font-bold text-purple-600 font-mono mt-0.5">{formatCurrency(data.metrics?.supplierCredits)}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Available Credit Notes</span>
                </div>
            </div>

            {/* Invoice Status Navigation Tabs & Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1 print:hidden">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {[
                        { id: "ALL", label: "All Invoices" },
                        { id: "UNPAID", label: "Unpaid" },
                        { id: "PARTIALLY_PAID", label: "Partially Paid" },
                        { id: "OVERDUE", label: "Overdue" },
                        { id: "PAID", label: "Paid" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                                statusFilter === tab.id
                                    ? "bg-orange-500 text-white font-bold shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search supplier, PO #, invoice #..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-lg text-xs font-sans text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition shadow-2xs"
                    />
                </div>
            </div>

            {/* Main Content Layout (Settlement History Table + Supplier Drawer) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Invoice Table */}
                <div className={`${selectedSupplierDetail ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-300`}>
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden print:hidden">
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <Receipt size={14} className="text-orange-500" />
                                Settlement History & Invoices
                            </h2>
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {filteredInvoices.length} Record{filteredInvoices.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                                <RefreshCw size={22} className="animate-spin text-orange-500" />
                                <p className="text-xs font-medium">Loading Settlement History...</p>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">
                                <AlertCircle size={30} className="mx-auto mb-2 opacity-40 text-orange-400" />
                                <p className="text-xs font-semibold text-slate-800">No Settlement Invoices Found</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Try changing your search query or status filter.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="py-2.5 px-3">Supplier</th>
                                            <th className="py-2.5 px-3">PO Ref</th>
                                            <th className="py-2.5 px-3">Invoice #</th>
                                            <th className="py-2.5 px-3 text-right">Amount</th>
                                            <th className="py-2.5 px-3 text-right">Paid</th>
                                            <th className="py-2.5 px-3 text-right">Balance</th>
                                            <th className="py-2.5 px-3">Due Date</th>
                                            <th className="py-2.5 px-3">Status</th>
                                            <th className="py-2.5 px-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {filteredInvoices.map((inv) => {
                                            const isOverdue = String(inv.status).toUpperCase() === "OVERDUE";
                                            const isSelected = selectedSupplierId === inv.supplierId;

                                            return (
                                                <tr
                                                    key={inv.id}
                                                    className={`hover:bg-slate-50/80 transition-colors ${
                                                        isOverdue
                                                            ? "bg-rose-50/30 border-l-2 border-l-rose-500"
                                                            : isSelected
                                                            ? "bg-orange-50/50 border-l-2 border-l-orange-500"
                                                            : ""
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-3 font-medium text-slate-900">
                                                        <button
                                                            onClick={() => setSelectedSupplierId(inv.supplierId)}
                                                            className="text-left group hover:text-orange-600 transition-colors cursor-pointer"
                                                        >
                                                            <div className="font-bold flex items-center gap-1.5 text-slate-900 group-hover:text-orange-600">
                                                                <Building2 size={13} className="text-slate-400 group-hover:text-orange-500" />
                                                                {inv.supplier?.profile?.companyName || inv.supplier?.name || "Supplier"}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                GST: {inv.supplier?.profile?.gstin || "N/A"}
                                                            </div>
                                                        </button>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                                                        {inv.supplyOrder?.orderNo || `#${inv.supplyOrderId || "N/A"}`}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-xs text-slate-900 font-bold">
                                                        {inv.invoiceNumber}
                                                        {inv.vendorInvoiceNo && (
                                                            <div className="text-[10px] text-slate-400 font-normal">
                                                                Vendor: {inv.vendorInvoiceNo}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                                        {formatCurrency(inv.totalAmount)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">
                                                        {formatCurrency(inv.paidAmount)}
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${isOverdue ? "text-rose-600" : "text-amber-600"}`}>
                                                        {formatCurrency(inv.balance)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                                                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "Net 30"}
                                                        {isOverdue && (
                                                            <span className="block text-[10px] font-bold text-rose-600 uppercase mt-0.5">
                                                                Overdue
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        {formatStatusBadge(inv.status)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => setSelectedSupplierId(inv.supplierId)}
                                                                title="View Supplier Audit Ledger"
                                                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            {inv.balance > 0 && (
                                                                <button
                                                                    onClick={() => openRecordSettlement(inv)}
                                                                    title="Record Payment Settlement"
                                                                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white transition shadow-2xs cursor-pointer"
                                                                >
                                                                    Settle
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
                </div>

                {/* Supplier Detail Audit Drawer */}
                {selectedSupplierDetail && (
                    <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col gap-3 relative">
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedSupplierId(null)}
                            className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                            <X size={15} />
                        </button>

                        {/* Supplier Overview Banner */}
                        <div>
                            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Supplier Settlement Ledger</span>
                            <h3 className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                                <Building2 size={15} className="text-orange-500" />
                                {selectedSupplierDetail.name}
                            </h3>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600 bg-slate-50/80 p-2 rounded-lg border border-slate-100 font-mono">
                                <div>GST: <span className="text-slate-900 font-bold">{selectedSupplierDetail.gstin || "N/A"}</span></div>
                                <div>Contact: <span className="text-slate-900 font-bold">{selectedSupplierDetail.contactName || "N/A"}</span></div>
                                <div>Phone: <span className="text-slate-900 font-bold">{selectedSupplierDetail.phone || "N/A"}</span></div>
                                <div>Credits: <span className="text-purple-600 font-bold">{formatCurrency(selectedSupplierDetail.supplierCredits)}</span></div>
                            </div>
                        </div>

                        {/* Financial Metrics Summary for Supplier */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-slate-500 font-semibold uppercase">Total Purchases</p>
                                <p className="text-xs font-bold text-slate-900 font-mono mt-0.5">{formatCurrency(selectedSupplierDetail.totalPurchases)}</p>
                            </div>
                            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-emerald-600 font-semibold uppercase">Paid Amount</p>
                                <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">{formatCurrency(selectedSupplierDetail.paidAmount)}</p>
                            </div>
                            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-amber-600 font-semibold uppercase">Balance Due</p>
                                <p className="text-xs font-bold text-amber-600 font-mono mt-0.5">{formatCurrency(selectedSupplierDetail.outstandingBalance)}</p>
                            </div>
                        </div>

                        {/* Invoices List */}
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                                <span>Invoices ({selectedSupplierDetail.invoices?.length || 0})</span>
                                <span className="text-[10px] font-normal text-slate-400">Financial Ledger</span>
                            </h4>
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                {(selectedSupplierDetail.invoices || []).map((inv) => (
                                    <div key={inv.id} className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</p>
                                            <p className="text-[10px] text-amber-600 font-semibold">Bal: {formatCurrency(inv.balance)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Settlement Payments Log */}
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                                <span>Settlement Payments ({selectedSupplierDetail.payments?.length || 0})</span>
                                <span className="text-[10px] font-normal text-slate-400">Audit Log</span>
                            </h4>
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                {(selectedSupplierDetail.payments || []).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic p-2 text-center bg-slate-50/80 rounded-lg">No payments recorded yet</p>
                                ) : (
                                    (selectedSupplierDetail.payments || []).map((pay) => (
                                        <div key={pay.id} className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-mono font-bold text-emerald-600">{pay.paymentCode}</p>
                                                <p className="text-[10px] text-slate-400">{pay.paymentMethod} • Ref: {pay.referenceNo || "N/A"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-emerald-600">{formatCurrency(pay.amount)}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(pay.paymentDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Credit Notes & Returns */}
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                                <span>Credit Notes & Returns ({selectedSupplierDetail.returns?.length || 0})</span>
                                <span className="text-[10px] font-normal text-slate-400">Credits</span>
                            </h4>
                            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                {(selectedSupplierDetail.returns || []).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic p-2 text-center bg-slate-50/80 rounded-lg">No returns or credit notes</p>
                                ) : (
                                    (selectedSupplierDetail.returns || []).map((ret) => (
                                        <div key={ret.id} className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-mono font-bold text-purple-600">{ret.returnCode}</p>
                                                <p className="text-[10px] text-slate-400">Reason: {ret.reason || "Return"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-purple-600">{formatCurrency(ret.totalValue)}</p>
                                                <p className="text-[10px] text-slate-400">{ret.status}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Record Payment Settlement Modal */}
            {settlementModalInvoice && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200/80 rounded-xl max-w-md w-full p-4 shadow-xl relative">
                        <button
                            onClick={() => setSettlementModalInvoice(null)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="p-2 bg-orange-50 border border-orange-100 rounded-lg text-orange-500">
                                <CreditCard size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Record Settlement Payment</h3>
                                <p className="text-xs text-slate-500">Invoice #{settlementModalInvoice.invoiceNumber}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs mb-3 space-y-1 font-sans">
                            <div className="flex justify-between text-slate-600">
                                <span>Supplier:</span>
                                <span className="text-slate-900 font-bold">{settlementModalInvoice.supplier?.profile?.companyName || settlementModalInvoice.supplier?.name}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Invoice Total:</span>
                                <span className="text-slate-900 font-mono font-semibold">{formatCurrency(settlementModalInvoice.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Outstanding Balance:</span>
                                <span className="text-amber-600 font-mono font-bold">{formatCurrency(settlementModalInvoice.balance)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-2.5 text-xs">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Payment Amount (₹) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono font-bold focus:border-orange-500 focus:outline-none"
                                    placeholder="Enter payment amount"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Payment Method
                                </label>
                                <select
                                    value={paymentForm.paymentMethod}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-orange-500 focus:outline-none cursor-pointer"
                                >
                                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                                    <option value="UPI">UPI / QR Code</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CREDIT_NOTE">Supplier Credit Note</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Reference Number / UTR
                                </label>
                                <input
                                    type="text"
                                    value={paymentForm.referenceNo}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none font-mono"
                                    placeholder="UTR / Cheque No / Transaction ID"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Notes / Settlement Remarks
                                </label>
                                <textarea
                                    rows="2"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSettlementModalInvoice(null)}
                                    className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingPayment}
                                    className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingPayment ? "Recording..." : "Record Settlement"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
