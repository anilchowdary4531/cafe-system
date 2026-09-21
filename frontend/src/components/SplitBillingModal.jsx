import { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Banknote,
    Check,
    CheckCircle2,
    CreditCard,
    Divide,
    DollarSign,
    IndianRupee,
    LoaderCircle,
    Printer,
    QrCode,
    Receipt,
    RefreshCw,
    Split,
    User,
    Users,
    X,
} from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { showToast } from "../utils/toast";

const toInr = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export default function SplitBillingModal({
    isOpen,
    onClose,
    session,
    restaurantId,
    onSessionUpdated,
}) {
    if (!isOpen || !session) return null;

    const [activeTab, setActiveTab] = useState("PAY_FULL"); // PAY_FULL | SPLIT_MODE | PAYMENT_HISTORY
    const [splitMode, setSplitMode] = useState("ITEM"); // ITEM | QUANTITY | EQUAL | CUSTOM
    const [equalCount, setEqualCount] = useState(2);
    const [customAmountsInput, setCustomAmountsInput] = useState(["", ""]);

    // Items allocation for ITEM / QUANTITY mode
    // splitsAllocations: [ { label: "Customer 1", items: { orderItemId: qty } }, ... ]
    const [customerSplits, setCustomerSplits] = useState([
        { label: "Customer 1", items: {} },
        { label: "Customer 2", items: {} },
    ]);

    // Split Billing state fetched from backend
    const [existingSplits, setExistingSplits] = useState([]);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingSplits, setLoadingSplits] = useState(false);
    const [savingSplits, setSavingSplits] = useState(false);

    // Payment Form state
    const [selectedSplitId, setSelectedSplitId] = useState(null); // null = full bill
    const [paymentMode, setPaymentMode] = useState("CASH"); // CASH | UPI | CARD | CASHFREE
    const [payAmount, setPayAmount] = useState("");
    const [cashReceived, setCashReceived] = useState("");
    const [transactionId, setTransactionId] = useState("");
    const [submittingPayment, setSubmittingPayment] = useState(false);

    const allOrderItems = useMemo(() => {
        if (!session?.orders) return [];
        return session.orders.flatMap((o) => o.items || []);
    }, [session]);

    const sessionTotal = Number(session.total || 0);
    const totalPaidSoFar = useMemo(() => {
        return (paymentHistory || [])
            .filter((p) => p.status === "SUCCESS")
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }, [paymentHistory]);

    const remainingBalance = Math.max(0, sessionTotal - totalPaidSoFar);

    // Fetch splits and payment history when modal opens
    const fetchSplitsAndHistory = async () => {
        try {
            setLoadingSplits(true);
            const rid = restaurantId || session.restaurantId;
            const sid = session.id;

            const [splitsRes, historyRes] = await Promise.all([
                axios.get(`${API}/owner/${rid}/tables/sessions/${sid}/splits`),
                axios.get(`${API}/owner/${rid}/tables/sessions/${sid}/payment-history`),
            ]);

            if (splitsRes.data?.success) {
                setExistingSplits(splitsRes.data.splits || []);
            }
            if (historyRes.data?.success) {
                setPaymentHistory(historyRes.data.payments || []);
            }
        } catch (err) {
            console.error("Failed to fetch split billing data:", err);
        } finally {
            setLoadingSplits(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSplitsAndHistory();
            setPayAmount(String(remainingBalance));
        }
    }, [isOpen, session]);

    useEffect(() => {
        setPayAmount(String(remainingBalance));
    }, [remainingBalance]);

    // Handle Custom Amount changes
    const handleCustomAmountChange = (idx, val) => {
        const next = [...customAmountsInput];
        next[idx] = val;
        setCustomAmountsInput(next);
    };

    const addCustomCustomer = () => {
        setCustomAmountsInput((prev) => [...prev, ""]);
    };

    const removeCustomCustomer = (idx) => {
        setCustomAmountsInput((prev) => prev.filter((_, i) => i !== idx));
    };

    // Item/Quantity Allocation Helpers
    const addCustomerSplit = () => {
        setCustomerSplits((prev) => [
            ...prev,
            { label: `Customer ${prev.length + 1}`, items: {} },
        ]);
    };

    const removeCustomerSplit = (custIdx) => {
        setCustomerSplits((prev) => prev.filter((_, i) => i !== custIdx));
    };

    const setItemQtyForCustomer = (custIdx, orderItemId, qty) => {
        setCustomerSplits((prev) => {
            const next = [...prev];
            const updatedItems = { ...next[custIdx].items };
            if (qty <= 0) {
                delete updatedItems[orderItemId];
            } else {
                updatedItems[orderItemId] = qty;
            }
            next[custIdx] = { ...next[custIdx], items: updatedItems };
            return next;
        });
    };

    // Calculate unassigned quantity per order item
    const getUnassignedQty = (orderItemId, origQty) => {
        let assigned = 0;
        customerSplits.forEach((cust) => {
            assigned += Number(cust.items[orderItemId] || 0);
        });
        return Math.max(0, origQty - assigned);
    };

    // Save Bill Splits to Backend
    const handleSaveSplits = async () => {
        try {
            setSavingSplits(true);
            const rid = restaurantId || session.restaurantId;
            const sid = session.id;

            let payload = { splitType };

            if (splitType === "ITEM" || splitType === "QUANTITY") {
                payload.splits = customerSplits.map((cust) => ({
                    label: cust.label,
                    items: Object.entries(cust.items).map(([oiId, qty]) => ({
                        orderItemId: Number(oiId),
                        qty: Number(qty),
                    })),
                }));
            } else if (splitType === "EQUAL") {
                payload.splitCount = Number(equalCount);
            } else if (splitType === "CUSTOM") {
                payload.customAmounts = customAmountsInput.map((a) => Number(a || 0));
            }

            const res = await axios.post(
                `${API}/owner/${rid}/tables/sessions/${sid}/split-bill`,
                payload
            );

            if (res.data?.success) {
                showToast({
                    title: "Bill Split Created",
                    message: res.data.message || "Splits created successfully.",
                    variant: "success",
                });
                setExistingSplits(res.data.splits || []);
                setActiveTab("PAY_FULL");
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to create split bill.";
            showToast({ title: "Split Error", message: errMsg, variant: "error" });
        } finally {
            setSavingSplits(false);
        }
    };

    // Execute Payment
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        const amt = Number(payAmount || 0);
        if (amt <= 0) {
            showToast({ title: "Invalid Amount", message: "Enter a valid payment amount.", variant: "warning" });
            return;
        }

        if (paymentMode === "CASH" && cashReceived && Number(cashReceived) < amt) {
            showToast({
                title: "Insufficient Cash",
                message: `Cash received (₹${cashReceived}) is less than payment amount (₹${amt}).`,
                variant: "error",
            });
            return;
        }

        try {
            setSubmittingPayment(true);
            const rid = restaurantId || session.restaurantId;
            const sid = session.id;
            const idempotencyKey = `PAY-${sid}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

            const payload = {
                restaurantId: rid,
                tableSessionId: sid,
                billSplitId: selectedSplitId || null,
                paymentMode,
                amount: amt,
                amountReceived: cashReceived ? Number(cashReceived) : amt,
                transactionId: transactionId || null,
                idempotencyKey,
            };

            const res = await axios.post(
                `${API}/owner/${rid}/tables/sessions/${sid}/record-payment`,
                payload
            );

            if (res.data?.success) {
                showToast({
                    title: "Payment Recorded",
                    message: res.data.message || "Payment processed successfully.",
                    variant: "success",
                });

                fetchSplitsAndHistory();
                if (onSessionUpdated) {
                    onSessionUpdated(res.data.result?.session);
                }

                if (res.data.result?.isFullyPaid) {
                    onClose();
                } else {
                    setPayAmount(String(res.data.result?.remainingBalance || 0));
                    setCashReceived("");
                    setTransactionId("");
                }
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to record payment.";
            showToast({ title: "Payment Failed", message: errMsg, variant: "error" });
        } finally {
            setSubmittingPayment(false);
        }
    };

    const currentCashChange = useMemo(() => {
        if (paymentMode !== "CASH" || !cashReceived) return 0;
        const amt = Number(payAmount || 0);
        const rcvd = Number(cashReceived || 0);
        return Math.max(0, rcvd - amt);
    }, [paymentMode, cashReceived, payAmount]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl text-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-slate-900/60">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-amber-500/20 p-2.5 text-amber-400 border border-amber-500/30">
                            <Receipt className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold tracking-tight">
                                Table {session.tableNo} — Checkout & Billing
                            </h3>
                            <p className="text-xs text-gray-400">
                                Grand Total: <strong className="text-emerald-400">₹{toInr(sessionTotal)}</strong> | Paid: <span className="text-sky-400">₹{toInr(totalPaidSoFar)}</span> | Balance: <strong className="text-amber-400">₹{toInr(remainingBalance)}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-slate-950/40 px-6 pt-3 gap-2">
                    <button
                        onClick={() => setActiveTab("PAY_FULL")}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${activeTab === "PAY_FULL" ? "border-amber-400 text-amber-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}
                    >
                        <Banknote className="h-4 w-4" />
                        Pay Full / Single Payment
                    </button>
                    <button
                        onClick={() => setActiveTab("SPLIT_MODE")}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${activeTab === "SPLIT_MODE" ? "border-purple-400 text-purple-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}
                    >
                        <Split className="h-4 w-4" />
                        Split Bill ({existingSplits.length ? `${existingSplits.length} Splits` : "Configure"})
                    </button>
                    <button
                        onClick={() => setActiveTab("PAYMENT_HISTORY")}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${activeTab === "PAYMENT_HISTORY" ? "border-sky-400 text-sky-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}
                    >
                        <Receipt className="h-4 w-4" />
                        Payment History ({paymentHistory.length})
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* TAB 1: PAY FULL / RECORD PAYMENT */}
                    {activeTab === "PAY_FULL" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Bill / Split Selection Card */}
                            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
                                <h4 className="text-base font-bold text-gray-200 flex items-center justify-between">
                                    <span>Select Bill / Split to Pay</span>
                                    {existingSplits.length > 0 && (
                                        <span className="text-xs font-normal text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                            Split Active
                                        </span>
                                    )}
                                </h4>

                                {existingSplits.length === 0 ? (
                                    <div
                                        onClick={() => setSelectedSplitId(null)}
                                        className={`cursor-pointer rounded-xl border p-4 transition ${selectedSplitId === null ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/5"}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-amber-300">Entire Bill (Single Payment)</span>
                                            <strong className="text-lg text-emerald-400">₹{toInr(remainingBalance)}</strong>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Pay full remaining balance for Table {session.tableNo}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div
                                            onClick={() => { setSelectedSplitId(null); setPayAmount(String(remainingBalance)); }}
                                            className={`cursor-pointer rounded-xl border p-3 transition ${selectedSplitId === null ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/5"}`}
                                        >
                                            <div className="flex justify-between items-center text-sm font-bold">
                                                <span>Total Session Balance</span>
                                                <span className="text-emerald-400">₹{toInr(remainingBalance)}</span>
                                            </div>
                                        </div>

                                        {existingSplits.map((split) => {
                                            const isSelected = selectedSplitId === split.id;
                                            const isPaid = split.status === "PAID";
                                            return (
                                                <div
                                                    key={split.id}
                                                    onClick={() => {
                                                        if (!isPaid) {
                                                            setSelectedSplitId(split.id);
                                                            setPayAmount(String(split.pendingAmount));
                                                        }
                                                    }}
                                                    className={`cursor-pointer rounded-xl border p-3.5 transition ${isPaid ? "opacity-60 border-emerald-500/30 bg-emerald-500/5 cursor-not-allowed" : isSelected ? "border-purple-400 bg-purple-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                                                >
                                                    <div className="flex justify-between items-center font-semibold text-sm">
                                                        <span className="flex items-center gap-2">
                                                            {split.label}
                                                            {isPaid && <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">PAID</span>}
                                                        </span>
                                                        <span className="text-amber-300">Total: ₹{toInr(split.total)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                                                        <span>Paid: ₹{toInr(split.paidAmount)}</span>
                                                        <span className="font-bold text-emerald-400">Pending: ₹{toInr(split.pendingAmount)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Payment Method & Amount Form */}
                            <form onSubmit={handleRecordPayment} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
                                <h4 className="text-base font-bold text-gray-200">Payment Collection</h4>

                                {/* Method Selector */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-2">Payment Method</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: "CASH", label: "Cash", icon: Banknote, color: "text-emerald-400" },
                                            { id: "UPI", label: "UPI QR / Direct", icon: QrCode, color: "text-amber-400" },
                                            { id: "CARD", label: "Card Swipe", icon: CreditCard, color: "text-sky-400" },
                                            { id: "CASHFREE", label: "Cashfree Online", icon: IndianRupee, color: "text-purple-400" },
                                        ].map((m) => {
                                            const Icon = m.icon;
                                            const active = paymentMode === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setPaymentMode(m.id)}
                                                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-bold transition ${active ? "border-amber-400 bg-amber-500/10 text-white" : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"}`}
                                                >
                                                    <Icon className={`h-4 w-4 ${m.color}`} />
                                                    {m.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Amount Inputs */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Amount to Collect (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            value={payAmount}
                                            onChange={(e) => setPayAmount(e.target.value)}
                                            required
                                            className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-lg font-extrabold text-emerald-400 outline-none focus:border-amber-400"
                                        />
                                    </div>

                                    {/* Cash Received & Change */}
                                    {paymentMode === "CASH" && (
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-semibold text-emerald-300">Cash Tendered by Customer (₹)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder={payAmount}
                                                    value={cashReceived}
                                                    onChange={(e) => setCashReceived(e.target.value)}
                                                    className="w-32 rounded-lg border border-emerald-500/30 bg-[#111827] px-3 py-1.5 text-sm font-bold text-white text-right outline-none focus:border-emerald-400"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-xs border-t border-emerald-500/20 pt-1.5">
                                                <span className="text-gray-300 font-medium">Change to Return:</span>
                                                <strong className="text-base font-black text-amber-300">₹{toInr(currentCashChange)}</strong>
                                            </div>
                                        </div>
                                    )}

                                    {(paymentMode === "UPI" || paymentMode === "CARD") && (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1">Transaction Ref / Approval Code (Optional)</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. UPI-998822 / Approval 443"
                                                value={transactionId}
                                                onChange={(e) => setTransactionId(e.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                                            />
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingPayment || remainingBalance <= 0}
                                    className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-extrabold text-white shadow-lg transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submittingPayment ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                    Record Payment of ₹{toInr(payAmount)}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* TAB 2: SPLIT BILL CONFIGURATION */}
                    {activeTab === "SPLIT_MODE" && (
                        <div className="space-y-6">
                            {/* Mode Selection */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { id: "ITEM", label: "Mode A: By Item", desc: "Assign specific items to customer" },
                                    { id: "QUANTITY", label: "Mode B: By Quantity", desc: "Split item quantities (e.g. 2 Coke each)" },
                                    { id: "EQUAL", label: "Mode C: Equal Split", desc: "Split bill total equally into N splits" },
                                    { id: "CUSTOM", label: "Mode D: Custom Amount", desc: "Enter specific custom split amounts" },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setSplitMode(m.id)}
                                        className={`rounded-2xl border p-3.5 text-left transition ${splitMode === m.id ? "border-purple-400 bg-purple-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                                    >
                                        <div className="font-bold text-sm text-purple-300">{m.label}</div>
                                        <div className="text-[11px] text-gray-400 mt-1">{m.desc}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Mode A & B Editor */}
                            {(splitMode === "ITEM" || splitMode === "QUANTITY") && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-gray-200">Customer Splits Setup</h4>
                                        <button
                                            type="button"
                                            onClick={addCustomerSplit}
                                            className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500/20"
                                        >
                                            + Add Customer Split
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {customerSplits.map((cust, custIdx) => (
                                            <div key={custIdx} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                                    <input
                                                        type="text"
                                                        value={cust.label}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setCustomerSplits((prev) => {
                                                                const next = [...prev];
                                                                next[custIdx].label = val;
                                                                return next;
                                                            });
                                                        }}
                                                        className="bg-transparent font-bold text-amber-300 outline-none focus:border-b border-amber-400 text-sm"
                                                    />
                                                    {customerSplits.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCustomerSplit(custIdx)}
                                                            className="text-xs text-red-400 hover:text-red-300"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {allOrderItems.map((item) => {
                                                        const currentQty = cust.items[item.id] || 0;
                                                        const unassigned = getUnassignedQty(item.id, item.qty);
                                                        const maxAllowed = currentQty + unassigned;

                                                        return (
                                                            <div key={item.id} className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5">
                                                                <div>
                                                                    <div className="font-semibold text-gray-200">{item.itemName}</div>
                                                                    <div className="text-[10px] text-gray-400">₹{item.price} ea | Max: {item.qty}</div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setItemQtyForCustomer(custIdx, item.id, currentQty - 1)}
                                                                        disabled={currentQty <= 0}
                                                                        className="h-6 w-6 rounded bg-white/10 font-bold hover:bg-white/20 disabled:opacity-30"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="w-5 text-center font-bold">{currentQty}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setItemQtyForCustomer(custIdx, item.id, currentQty + 1)}
                                                                        disabled={currentQty >= maxAllowed}
                                                                        className="h-6 w-6 rounded bg-purple-600 font-bold hover:bg-purple-500 disabled:opacity-30"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Mode C: Equal Split Setup */}
                            {splitMode === "EQUAL" && (
                                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 max-w-md mx-auto">
                                    <h4 className="text-sm font-bold text-gray-200">Equal Split Configuration</h4>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1">Number of Customers</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="10"
                                            value={equalCount}
                                            onChange={(e) => setEqualCount(e.target.value)}
                                            className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-lg font-bold text-amber-400 outline-none"
                                        />
                                    </div>
                                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">Grand Total:</span>
                                            <strong className="text-emerald-400">₹{toInr(sessionTotal)}</strong>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">Each Customer Pays:</span>
                                            <strong className="text-amber-300 text-sm">₹{toInr(sessionTotal / Math.max(1, Number(equalCount)))}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mode D: Custom Amount Setup */}
                            {splitMode === "CUSTOM" && (
                                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 max-w-md mx-auto">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-gray-200">Custom Split Amounts</h4>
                                        <button
                                            type="button"
                                            onClick={addCustomCustomer}
                                            className="text-xs text-purple-400 font-bold hover:underline"
                                        >
                                            + Add Amount
                                        </button>
                                    </div>

                                    {customAmountsInput.map((amt, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <span className="text-xs font-bold text-gray-400 w-16">Split #{idx + 1}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="₹ Amount"
                                                value={amt}
                                                onChange={(e) => handleCustomAmountChange(idx, e.target.value)}
                                                className="flex-1 rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm font-bold text-white outline-none focus:border-purple-400"
                                            />
                                            {customAmountsInput.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomCustomer(idx)}
                                                    className="text-red-400 text-xs hover:text-red-300"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">Target Session Total:</span>
                                            <strong className="text-emerald-400">₹{toInr(sessionTotal)}</strong>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">Sum of Custom Splits:</span>
                                            <strong className="text-amber-300 font-bold">
                                                ₹{toInr(customAmountsInput.reduce((s, a) => s + Number(a || 0), 0))}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Save Split Button */}
                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={handleSaveSplits}
                                    disabled={savingSplits}
                                    className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-purple-500 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {savingSplits ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Split className="h-5 w-5" />}
                                    Generate & Lock Bill Splits
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: PAYMENT HISTORY */}
                    {activeTab === "PAYMENT_HISTORY" && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-200">Recorded Payment History</h4>
                            {paymentHistory.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-gray-400">
                                    No payments recorded yet for this session.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {paymentHistory.map((p) => (
                                        <div
                                            key={p.id}
                                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-xs"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <span>{p.paymentMethod} Payment</span>
                                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                                                        {p.status}
                                                    </span>
                                                </div>
                                                <div className="text-gray-400 text-[11px]">
                                                    Txn: {p.transactionId || "N/A"} | Staff: {p.performedByName || "Staff"}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <strong className="text-base font-extrabold text-emerald-400">₹{toInr(p.amount)}</strong>
                                                {p.changeAmount > 0 && (
                                                    <div className="text-[10px] text-amber-300">Change: ₹{toInr(p.changeAmount)}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
