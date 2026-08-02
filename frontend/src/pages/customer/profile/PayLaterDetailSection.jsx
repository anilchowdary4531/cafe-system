import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import { useLanguage } from "../../../context/LanguageContext";
import {
    IndianRupee,
    ArrowLeft,
    Calendar,
    History,
    AlertCircle,
    TrendingUp,
    CreditCard,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    Receipt,
    Search,
    CheckCircle2,
    Sparkles,
    Building2,
    X,
    Filter
} from "lucide-react";

const toInr = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export default function PayLaterDetailSection() {
    const { t } = useLanguage();
    const { accountId } = useParams();
    const [searchParams] = useSearchParams();
    const forceCustomerMode = searchParams.get("scope") === "customer";
    const buildProfilePath = (path) => (forceCustomerMode ? `${path}?scope=customer` : path);

    const [loading, setLoading] = useState(true);
    const [account, setAccount] = useState(null);

    // Filter & Search
    const [activeTab, setActiveTab] = useState("all"); // "all" | "purchases" | "repayments"
    const [searchQuery, setSearchQuery] = useState("");

    // Repayment Modal
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [repayAmount, setRepayAmount] = useState("");
    const [repaySubmitting, setRepaySubmitting] = useState(false);

    // Expandable itemized receipts
    const [expandedOrders, setExpandedOrders] = useState(new Set());

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/customer/pay-later/accounts/${accountId}/details`);
            setAccount(res.data?.account || null);
        } catch (err) {
            showToast({
                title: "Error",
                message: err.response?.data?.message || "Failed to load Khata ledger details",
                variant: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (accountId) {
            fetchDetails();
        }
    }, [accountId]);

    const toggleOrderExpansion = (orderId) => {
        setExpandedOrders((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    const handleOpenRepayModal = (presetAmount = null) => {
        if (presetAmount) {
            setRepayAmount(String(presetAmount));
        } else if (account?.pendingBalance) {
            setRepayAmount(String(account.pendingBalance));
        }
        setShowRepayModal(true);
    };

    const handleRepaySubmit = async (e) => {
        e.preventDefault();
        const amount = Number(repayAmount);
        if (!amount || amount <= 0) {
            showToast({
                title: "Validation Error",
                message: "Please enter an amount greater than zero",
                variant: "warning"
            });
            return;
        }

        if (amount > account.pendingBalance) {
            showToast({
                title: "Validation Error",
                message: `Repayment amount cannot exceed the pending balance (₹${account.pendingBalance})`,
                variant: "warning"
            });
            return;
        }

        try {
            setRepaySubmitting(true);

            // Load SDK
            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) {
                showToast({
                    title: "Payment Error",
                    message: "Failed to load Razorpay payment gateway.",
                    variant: "error"
                });
                return;
            }

            // 1. Create repayment record and Razorpay order
            const res = await api.post(`/customer/pay-later/accounts/${accountId}/repay`, { amount });
            const { keyId, order } = res.data;

            // 2. Open Checkout
            const options = {
                key: keyId,
                amount: order.amount,
                currency: order.currency,
                name: account.restaurant?.name || "Khata Repayment",
                description: "Digital Khata Repayment via Tiffzy",
                order_id: order.id,
                handler: async (response) => {
                    try {
                        showToast({
                            title: "Payment Received",
                            message: "Verifying repayment with server...",
                            variant: "info"
                        });

                        // 3. Verify Payment Signature
                        await api.post(`/customer/pay-later/accounts/${accountId}/repay/verify`, {
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature
                        });

                        showToast({
                            title: "Khata Repayment Settled! 🎉",
                            message: `Payment of ₹${amount} applied successfully to your account.`,
                            variant: "success"
                        });
                        setShowRepayModal(false);
                        setRepayAmount("");
                        fetchDetails();
                    } catch (verifyErr) {
                        showToast({
                            title: "Verification Failed",
                            message: verifyErr.response?.data?.message || "Could not verify payment signature",
                            variant: "error"
                        });
                    }
                },
                prefill: {
                    contact: account.customer?.phone || "",
                    email: account.customer?.email || ""
                },
                theme: {
                    color: "#F59E0B"
                },
                modal: {
                    ondismiss: () => {
                        setRepaySubmitting(false);
                    }
                }
            };

            const rzpay = new window.Razorpay(options);
            rzpay.open();
        } catch (err) {
            showToast({
                title: "Error",
                message: err.response?.data?.message || "Repayment checkout failed",
                variant: "error"
            });
            setRepaySubmitting(false);
        }
    };

    // Filtered ledger transactions
    const filteredTransactions = useMemo(() => {
        if (!account?.transactions) return [];
        return account.transactions.filter((tx) => {
            const isRepay = tx.type?.includes("REPAYMENT");
            if (activeTab === "purchases" && isRepay) return false;
            if (activeTab === "repayments" && !isRepay) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const desc = String(tx.description || "").toLowerCase();
                const typeStr = String(tx.type || "").toLowerCase();
                const orderNo = String(tx.order?.orderNo || "").toLowerCase();
                return desc.includes(q) || typeStr.includes(q) || orderNo.includes(q);
            }

            return true;
        });
    }, [account?.transactions, activeTab, searchQuery]);

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 animate-spin">
                    <Sparkles size={24} />
                </div>
                <p className="theme-muted text-sm font-medium">Loading Khata ledger & transaction history...</p>
            </div>
        );
    }

    if (!account) {
        return (
            <div className="theme-panel rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
                    <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold">Khata Account Not Found</h3>
                <p className="theme-muted text-sm leading-relaxed">
                    The requested Pay Later credit account could not be found or you may not have permission to view it.
                </p>
                <Link
                    to={buildProfilePath("/profile/pay-later")}
                    className="theme-button inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-sm"
                >
                    <ArrowLeft size={16} /> Back to Accounts
                </Link>
            </div>
        );
    }

    const pendingBalance = Number(account.pendingBalance || 0);

    return (
        <div className="space-y-8 text-left max-w-4xl mx-auto">
            {/* BACK BUTTON */}
            <div className="flex items-center justify-between">
                <Link
                    to={buildProfilePath("/profile/pay-later")}
                    className="theme-soft-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                    <ArrowLeft size={16} /> Back to Pay Later Accounts
                </Link>
                <div className="inline-flex items-center gap-1.5 text-xs theme-muted">
                    <ShieldCheck size={14} className="text-emerald-500" /> Verified Restaurant Credit
                </div>
            </div>

            {/* VIRTUAL KHATA PASS / HERO CARD */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-900 p-6 sm:p-8 text-white shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-extrabold tracking-widest text-amber-400 border border-amber-500/30 uppercase">
                                Digital Khata Pass
                            </span>
                            <span className="text-xs text-white/50">ID: #{account.id}</span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl font-black text-white">{account.restaurant?.name}</h2>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 pt-1">
                            <span>Customer: <strong className="text-white">{account.customer?.name || "Customer"}</strong></span>
                            <span>•</span>
                            <span>Contact: <strong className="text-white">{account.customer?.phone}</strong></span>
                        </div>
                    </div>

                    {/* DUES & PAY BUTTON */}
                    <div className="rounded-2xl border border-amber-500/30 bg-black/40 p-5 backdrop-blur-md shrink-0 min-w-[260px] space-y-3">
                        <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">Outstanding Balance</p>
                            <h3 className="text-3xl font-black text-amber-300 mt-1">
                                ₹{toInr(pendingBalance)}
                            </h3>
                        </div>

                        {pendingBalance > 0 ? (
                            <button
                                type="button"
                                onClick={() => handleOpenRepayModal(pendingBalance)}
                                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-extrabold text-black shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-orange-400 active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <CreditCard size={18} />
                                Pay Outstanding Dues
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/20 p-2.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 size={16} /> All Dues Cleared!
                            </div>
                        )}
                    </div>
                </div>

                {/* PRESET QUICK REPAYMENT CHIPS */}
                {pendingBalance > 0 && (
                    <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-white/60 font-semibold mr-1">Quick Pay:</span>
                        <button
                            type="button"
                            onClick={() => handleOpenRepayModal(pendingBalance)}
                            className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition"
                        >
                            Full (₹{toInr(pendingBalance)})
                        </button>
                        {pendingBalance >= 100 && (
                            <button
                                type="button"
                                onClick={() => handleOpenRepayModal(100)}
                                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20 transition"
                            >
                                ₹100
                            </button>
                        )}
                        {pendingBalance >= 250 && (
                            <button
                                type="button"
                                onClick={() => handleOpenRepayModal(250)}
                                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20 transition"
                            >
                                ₹250
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* BALANCE METRICS SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="theme-panel rounded-2xl p-5 text-left border border-black/5 dark:border-white/5">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Pending Dues</p>
                    <h4 className="mt-1.5 text-2xl font-black text-amber-500">₹{toInr(account.pendingBalance)}</h4>
                    <p className="theme-muted mt-1 text-[11px]">Unpaid balance at outlet</p>
                </div>
                <div className="theme-panel rounded-2xl p-5 text-left border border-black/5 dark:border-white/5">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Total Borrowed</p>
                    <h4 className="mt-1.5 text-2xl font-bold text-rose-400">₹{toInr(account.totalBorrowed)}</h4>
                    <p className="theme-muted mt-1 text-[11px]">Lifetime credit taken</p>
                </div>
                <div className="theme-panel rounded-2xl p-5 text-left border border-black/5 dark:border-white/5">
                    <p className="theme-muted text-xs font-bold uppercase tracking-wider">Total Repaid</p>
                    <h4 className="mt-1.5 text-2xl font-bold text-emerald-400">₹{toInr(account.totalPaid)}</h4>
                    <p className="theme-muted mt-1 text-[11px]">Lifetime dues settled</p>
                </div>
            </div>

            {/* TRANSACTION LEDGER FEED */}
            <div className="theme-panel rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <History size={20} className="text-amber-500" />
                        <h3 className="text-xl font-bold">Khata Transaction Ledger</h3>
                    </div>

                    {/* SEARCH BOX */}
                    <div className="relative">
                        <Search size={16} className="theme-muted absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Search transactions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="theme-input rounded-xl pl-9 pr-4 py-2 text-xs outline-none w-full sm:w-64"
                        />
                    </div>
                </div>

                {/* FILTER TABS */}
                <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-3 text-xs overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab("all")}
                        className={`rounded-xl px-4 py-2 font-bold transition ${activeTab === "all" ? "bg-amber-500 text-black" : "theme-muted hover:theme-text"}`}
                    >
                        All Transactions ({account.transactions?.length || 0})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("purchases")}
                        className={`rounded-xl px-4 py-2 font-bold transition ${activeTab === "purchases" ? "bg-amber-500 text-black" : "theme-muted hover:theme-text"}`}
                    >
                        Food Purchases (+)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("repayments")}
                        className={`rounded-xl px-4 py-2 font-bold transition ${activeTab === "repayments" ? "bg-amber-500 text-black" : "theme-muted hover:theme-text"}`}
                    >
                        Repayments (-)
                    </button>
                </div>

                {/* LEDGER ITEMS LIST */}
                <div className="space-y-3">
                    {filteredTransactions.length === 0 ? (
                        <div className="py-12 text-center theme-muted text-sm space-y-2">
                            <Receipt size={32} className="mx-auto opacity-50" />
                            <p>No ledger entries found matching your filter.</p>
                        </div>
                    ) : (
                        filteredTransactions.map((tx) => {
                            const isRepayment = tx.type?.includes("REPAYMENT");
                            const isExpanded = expandedOrders.has(tx.orderId);

                            return (
                                <div
                                    key={tx.id}
                                    className="rounded-2xl border border-black/5 bg-black/5 p-4 sm:p-5 dark:border-white/5 dark:bg-white/5 space-y-3 transition hover:border-amber-500/30"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                                                        isRepayment
                                                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                    }`}
                                                >
                                                    {tx.type?.replace("_", " ")}
                                                </span>
                                                <span className="theme-muted text-xs">{formatDate(tx.createdAt)}</span>
                                            </div>

                                            <p className="text-base font-bold theme-text pt-0.5">
                                                {tx.description || (isRepayment ? "Khata Repayment" : "Food Purchase")}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className={`text-lg font-black ${isRepayment ? "text-emerald-500" : "text-amber-500"}`}>
                                                {isRepayment ? "-" : "+"}₹{toInr(tx.amount)}
                                            </p>

                                            {tx.orderId && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleOrderExpansion(tx.orderId)}
                                                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline"
                                                >
                                                    {isExpanded ? (
                                                        <>Hide Items <ChevronUp size={14} /></>
                                                    ) : (
                                                        <>Itemized Receipt <ChevronDown size={14} /></>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ITEMIZED RECEIPT BREAKDOWN */}
                                    {tx.orderId && isExpanded && tx.order && (
                                        <div className="mt-3 rounded-xl border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-black/30 space-y-2 text-xs animate-in fade-in duration-150">
                                            <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/5 font-bold theme-text">
                                                <span>Order #{tx.order.orderNo || tx.orderId}</span>
                                                <span className="theme-muted">Receipt Details</span>
                                            </div>

                                            <div className="space-y-1.5 pt-1">
                                                {tx.order.items?.map((it) => (
                                                    <div key={it.id} className="flex justify-between items-center theme-muted">
                                                        <span>
                                                            <strong className="theme-text font-medium">{it.itemName}</strong> × {it.qty}
                                                        </span>
                                                        <span className="font-semibold theme-text">₹{toInr(it.price * it.qty)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* PAY NOW REPAYMENT MODAL */}
            {showRepayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="theme-panel w-full max-w-md rounded-3xl border border-amber-500/30 p-6 shadow-2xl space-y-5">
                        <div className="flex justify-between items-center pb-3 border-b border-black/5 dark:border-white/5">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <CreditCard size={20} className="text-amber-500" />
                                Repay Khata Dues
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowRepayModal(false)}
                                className="theme-muted hover:theme-text"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleRepaySubmit} className="space-y-4">
                            <div>
                                <label className="theme-muted mb-1.5 block text-xs font-bold uppercase tracking-wider">
                                    Repayment Amount (₹) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={pendingBalance}
                                    required
                                    value={repayAmount}
                                    onChange={(e) => setRepayAmount(e.target.value)}
                                    placeholder={`Max ₹${toInr(pendingBalance)}`}
                                    className="theme-input w-full rounded-2xl px-4 py-3.5 text-lg font-bold outline-none"
                                />
                                <p className="theme-muted mt-1 text-xs">
                                    Current Outstanding Due: <strong>₹{toInr(pendingBalance)}</strong>
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRepayModal(false)}
                                    className="theme-soft-button w-full rounded-xl py-3 text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={repaySubmitting}
                                    className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-60"
                                >
                                    {repaySubmitting ? "Opening Payment Gateway..." : "Proceed to Pay"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
