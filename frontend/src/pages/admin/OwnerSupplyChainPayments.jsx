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
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Paid</span>;
            case "PARTIALLY_PAID":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Partially Paid</span>;
            case "OVERDUE":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertTriangle className="w-3.5 h-3.5" /> Overdue</span>;
            default:
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20"><Clock className="w-3.5 h-3.5" /> Unpaid</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 font-sans">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-amber-400" />
                        Supply Chain Payments & Financial Settlement
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Procurement payment tracking, supplier account balances, credit notes & financial reconciliation
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh Settlement Data
                </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign className="w-16 h-16 text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Purchase Value</p>
                    <h3 className="text-2xl font-bold text-white mt-2">{formatCurrency(data.metrics?.totalPurchaseValue)}</h3>
                    <p className="text-xs text-slate-500 mt-2">Aggregate Procurement Value</p>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                    </div>
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Paid Amount</p>
                    <h3 className="text-2xl font-bold text-emerald-400 mt-2">{formatCurrency(data.metrics?.paidAmount)}</h3>
                    <p className="text-xs text-slate-500 mt-2">Settled Supplier Liabilities</p>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Clock className="w-16 h-16 text-amber-400" />
                    </div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Balance</p>
                    <h3 className="text-2xl font-bold text-amber-400 mt-2">{formatCurrency(data.metrics?.pendingAmount)}</h3>
                    <p className="text-xs text-slate-500 mt-2">Awaiting Payment Schedule</p>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <AlertTriangle className="w-16 h-16 text-rose-400" />
                    </div>
                    <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Overdue Amount</p>
                    <h3 className="text-2xl font-bold text-rose-400 mt-2">{formatCurrency(data.metrics?.overdueAmount)}</h3>
                    <p className="text-xs text-slate-500 mt-2">Critical Action Required</p>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Receipt className="w-16 h-16 text-purple-400" />
                    </div>
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Supplier Credits</p>
                    <h3 className="text-2xl font-bold text-purple-400 mt-2">{formatCurrency(data.metrics?.supplierCredits)}</h3>
                    <p className="text-xs text-slate-500 mt-2">Returns & Credit Notes</p>
                </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
                {/* Search Bar */}
                <div className="relative w-full lg:w-96">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Supplier, PO #, Invoice #..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto w-full lg:w-auto">
                    {["ALL", "UNPAID", "PARTIALLY_PAID", "OVERDUE", "PAID"].map((st) => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                statusFilter === st
                                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                            }`}
                        >
                            {st === "ALL" ? "All Invoices" : st.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Layout (Table + Optional Supplier Detail Drawer) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Invoice Table */}
                <div className={`${selectedSupplierDetail ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-300`}>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-amber-400" />
                                Procurement Invoices & Settlement Ledger
                            </h2>
                            <span className="text-xs text-slate-400 font-medium bg-slate-800/60 px-2.5 py-1 rounded-lg">
                                {filteredInvoices.length} Invoices Listed
                            </span>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                                <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                                <p className="text-sm font-medium">Loading Procurement Financial Data...</p>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-400" />
                                <p className="text-base font-semibold text-slate-300">No Invoices Found</p>
                                <p className="text-xs text-slate-500 mt-1">Try resetting your search query or status filter.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            <th className="p-3.5">Supplier</th>
                                            <th className="p-3.5">PO Ref</th>
                                            <th className="p-3.5">Invoice</th>
                                            <th className="p-3.5 text-right">Amount</th>
                                            <th className="p-3.5 text-right">Paid</th>
                                            <th className="p-3.5 text-right">Balance</th>
                                            <th className="p-3.5">Due Date</th>
                                            <th className="p-3.5">Status</th>
                                            <th className="p-3.5 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                        {filteredInvoices.map((inv) => {
                                            const isOverdue = String(inv.status).toUpperCase() === "OVERDUE";
                                            const isSelected = selectedSupplierId === inv.supplierId;

                                            return (
                                                <tr
                                                    key={inv.id}
                                                    className={`hover:bg-slate-800/40 transition-colors ${
                                                        isSelected ? "bg-amber-500/5 border-l-2 border-l-amber-500" : ""
                                                    }`}
                                                >
                                                    <td className="p-3.5 font-medium text-white">
                                                        <button
                                                            onClick={() => setSelectedSupplierId(inv.supplierId)}
                                                            className="text-left group hover:text-amber-400 transition-colors"
                                                        >
                                                            <div className="font-semibold flex items-center gap-1.5">
                                                                <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                                                                {inv.supplier?.profile?.companyName || inv.supplier?.name || "Supplier"}
                                                            </div>
                                                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                                GST: {inv.supplier?.profile?.gstin || "N/A"}
                                                            </div>
                                                        </button>
                                                    </td>
                                                    <td className="p-3.5 font-mono text-xs text-slate-400">
                                                        {inv.supplyOrder?.orderNo || `#${inv.supplyOrderId || "N/A"}`}
                                                    </td>
                                                    <td className="p-3.5 font-mono text-xs text-slate-300 font-semibold">
                                                        {inv.invoiceNumber}
                                                        {inv.vendorInvoiceNo && (
                                                            <div className="text-[10px] text-slate-500 font-normal">
                                                                Vendor: {inv.vendorInvoiceNo}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono font-semibold text-white">
                                                        {formatCurrency(inv.totalAmount)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono text-emerald-400">
                                                        {formatCurrency(inv.paidAmount)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono font-bold text-amber-400">
                                                        {formatCurrency(inv.balance)}
                                                    </td>
                                                    <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">
                                                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "Net 30"}
                                                        {isOverdue && (
                                                            <span className="block text-[10px] font-bold text-rose-400 uppercase mt-0.5">
                                                                Overdue
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 whitespace-nowrap">
                                                        {formatStatusBadge(inv.status)}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => setSelectedSupplierId(inv.supplierId)}
                                                                title="View Supplier Ledger & History"
                                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            {inv.balance > 0 && (
                                                                <button
                                                                    onClick={() => openRecordSettlement(inv)}
                                                                    title="Record Payment Settlement"
                                                                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all"
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

                {/* Supplier Detail Drawer / Audit Panel */}
                {selectedSupplierDetail && (
                    <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-5 relative">
                        {/* Close Drawer Button */}
                        <button
                            onClick={() => setSelectedSupplierId(null)}
                            className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Supplier Overview Banner */}
                        <div>
                            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Supplier Audit Ledger</span>
                            <h3 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-amber-400" />
                                {selectedSupplierDetail.name}
                            </h3>
                            <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-slate-400 bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono">
                                <div>GST: <span className="text-slate-200">{selectedSupplierDetail.gstin}</span></div>
                                <div>Contact: <span className="text-slate-200">{selectedSupplierDetail.contactName}</span></div>
                                <div>Phone: <span className="text-slate-200">{selectedSupplierDetail.phone}</span></div>
                                <div>Credits: <span className="text-purple-400 font-bold">{formatCurrency(selectedSupplierDetail.supplierCredits)}</span></div>
                            </div>
                        </div>

                        {/* Financial Summary Cards */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Purchases</p>
                                <p className="text-sm font-bold text-white font-mono mt-1">{formatCurrency(selectedSupplierDetail.totalPurchases)}</p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <p className="text-[10px] text-emerald-400 font-semibold uppercase">Total Paid</p>
                                <p className="text-sm font-bold text-emerald-400 font-mono mt-1">{formatCurrency(selectedSupplierDetail.paidAmount)}</p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <p className="text-[10px] text-amber-400 font-semibold uppercase">Balance Due</p>
                                <p className="text-sm font-bold text-amber-400 font-mono mt-1">{formatCurrency(selectedSupplierDetail.outstandingBalance)}</p>
                            </div>
                        </div>

                        {/* Invoices List */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                                <span>Invoices ({selectedSupplierDetail.invoices?.length || 0})</span>
                                <span className="text-[10px] font-normal text-slate-500">Financial Ledger</span>
                            </h4>
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                {(selectedSupplierDetail.invoices || []).map((inv) => (
                                    <div key={inv.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-mono font-bold text-white">{inv.invoiceNumber}</p>
                                            <p className="text-[10px] text-slate-500">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-slate-200">{formatCurrency(inv.totalAmount)}</p>
                                            <p className="text-[10px] text-amber-400">Bal: {formatCurrency(inv.balance)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payments Settlement Log */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                                <span>Settlement Payments ({selectedSupplierDetail.payments?.length || 0})</span>
                                <span className="text-[10px] font-normal text-slate-500">Audit History</span>
                            </h4>
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                {(selectedSupplierDetail.payments || []).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic p-2 text-center bg-slate-950/40 rounded-xl">No payments recorded yet</p>
                                ) : (
                                    (selectedSupplierDetail.payments || []).map((pay) => (
                                        <div key={pay.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-mono font-bold text-emerald-400">{pay.paymentCode}</p>
                                                <p className="text-[10px] text-slate-500">{pay.paymentMethod} • Ref: {pay.referenceNo || "N/A"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-emerald-400">{formatCurrency(pay.amount)}</p>
                                                <p className="text-[10px] text-slate-500">{new Date(pay.paymentDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Credit Notes & Returns */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                                <span>Credit Notes & Returns ({selectedSupplierDetail.returns?.length || 0})</span>
                                <span className="text-[10px] font-normal text-slate-500">Credits</span>
                            </h4>
                            <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                                {(selectedSupplierDetail.returns || []).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic p-2 text-center bg-slate-950/40 rounded-xl">No returns or credit notes</p>
                                ) : (
                                    (selectedSupplierDetail.returns || []).map((ret) => (
                                        <div key={ret.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-mono font-bold text-purple-400">{ret.returnCode}</p>
                                                <p className="text-[10px] text-slate-500">Reason: {ret.reason || "Return"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-purple-400">{formatCurrency(ret.totalValue)}</p>
                                                <p className="text-[10px] text-slate-500">{ret.status}</p>
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
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                        <button
                            onClick={() => setSettlementModalInvoice(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Record Settlement Payment</h3>
                                <p className="text-xs text-slate-400">Invoice #{settlementModalInvoice.invoiceNumber}</p>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs mb-4 space-y-1">
                            <div className="flex justify-between text-slate-400">
                                <span>Supplier:</span>
                                <span className="text-white font-medium">{settlementModalInvoice.supplier?.profile?.companyName || settlementModalInvoice.supplier?.name}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Invoice Total:</span>
                                <span className="text-white font-mono">{formatCurrency(settlementModalInvoice.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Outstanding Balance:</span>
                                <span className="text-amber-400 font-mono font-bold">{formatCurrency(settlementModalInvoice.balance)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                    Payment Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                                    placeholder="Enter payment amount"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                    Payment Method
                                </label>
                                <select
                                    value={paymentForm.paymentMethod}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                                    <option value="UPI">UPI / QR Code</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CREDIT_NOTE">Supplier Credit Note</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                    Reference Number / UTR
                                </label>
                                <input
                                    type="text"
                                    value={paymentForm.referenceNo}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none font-mono"
                                    placeholder="UTR / Cheque No / Transaction ID"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                    Notes / Settlement Remarks
                                </label>
                                <textarea
                                    rows="2"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSettlementModalInvoice(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingPayment}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {submittingPayment ? "Recording..." : "Record Settlement"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
