import { useEffect } from "react";
import {
    X,
    Receipt,
    ArrowDownLeft,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar,
    Hash,
    Layers,
    FileText,
} from "lucide-react";

const formatINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
        dateStyle: "full",
        timeStyle: "medium",
    });
};

const getTypeName = (type) => {
    switch (type) {
        case "WALLET_TOPUP":
            return "Wallet Top-up";
        case "ORDER_PAYMENT":
            return "Food Order Payment";
        case "REFUND":
            return "Order Refund";
        default:
            return type || "Transaction";
    }
};

export default function WalletTransactionDetailModal({
    transaction,
    onClose,
}) {
    // ESC key listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (!transaction) return null;

    const isCredit = transaction.direction === "CREDIT";
    const typeName = getTypeName(transaction.type);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            {/* Modal Box */}
            <div
                className="w-full max-w-lg rounded-3xl bg-stone-900 border border-white/15 p-6 sm:p-7 shadow-2xl relative text-stone-200 space-y-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Close */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                                isCredit
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                    : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            }`}
                        >
                            {isCredit ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">
                                Transaction Details
                            </h3>
                            <p className="text-xs text-stone-400">{typeName}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Amount Hero */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                    <p className="text-xs uppercase tracking-wider font-semibold text-stone-400">
                        {isCredit ? "Credited Amount" : "Debited Amount"}
                    </p>
                    <p
                        className={`text-3xl sm:text-4xl font-black ${
                            isCredit ? "text-emerald-400" : "text-rose-400"
                        }`}
                    >
                        {isCredit ? "+" : "-"}₹{formatINR(transaction.amount)}
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold ${
                                transaction.status === "SUCCESS"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : transaction.status === "PENDING"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            }`}
                        >
                            {transaction.status === "SUCCESS" && <CheckCircle2 size={12} />}
                            {transaction.status === "PENDING" && <Clock size={12} />}
                            {transaction.status === "FAILED" && <AlertCircle size={12} />}
                            {transaction.status || "SUCCESS"}
                        </span>
                        <span className="text-xs text-stone-400">·</span>
                        <span className="text-xs font-semibold text-stone-300">
                            {transaction.direction}
                        </span>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-3 text-xs">
                    {/* Description */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
                        <FileText size={16} className="text-stone-400 mt-0.5 shrink-0" />
                        <div>
                            <span className="text-stone-400 block font-semibold">Description</span>
                            <span className="text-stone-200 text-sm font-medium">
                                {transaction.description || "N/A"}
                            </span>
                        </div>
                    </div>

                    {/* Balance Before & Balance After */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                            <span className="text-stone-400 block font-semibold">Balance Before</span>
                            <span className="text-stone-200 text-sm font-bold">
                                ₹{formatINR(transaction.balanceBefore)}
                            </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                            <span className="text-stone-400 block font-semibold">Balance After</span>
                            <span className="text-amber-400 text-sm font-bold">
                                ₹{formatINR(transaction.balanceAfter)}
                            </span>
                        </div>
                    </div>

                    {/* Order Reference if present */}
                    {transaction.orderId && (
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                            <span className="text-stone-400 flex items-center gap-1.5 font-semibold">
                                <Receipt size={14} className="text-amber-400" />
                                Order ID
                            </span>
                            <span className="font-mono text-stone-200 font-bold">
                                #{transaction.orderId}
                            </span>
                        </div>
                    )}

                    {/* Reference ID if present */}
                    {transaction.referenceId && (
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                            <span className="text-stone-400 flex items-center gap-1.5 font-semibold">
                                <Hash size={14} className="text-stone-400" />
                                Reference ID
                            </span>
                            <span className="font-mono text-stone-300 font-medium truncate max-w-[200px]">
                                {transaction.referenceId}
                            </span>
                        </div>
                    )}

                    {/* Reference Type if present */}
                    {transaction.referenceType && (
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                            <span className="text-stone-400 flex items-center gap-1.5 font-semibold">
                                <Layers size={14} className="text-stone-400" />
                                Reference Type
                            </span>
                            <span className="text-stone-300 font-medium">
                                {transaction.referenceType}
                            </span>
                        </div>
                    )}

                    {/* Date & Time */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                        <span className="text-stone-400 flex items-center gap-1.5 font-semibold">
                            <Calendar size={14} className="text-stone-400" />
                            Timestamp
                        </span>
                        <span className="text-stone-300 text-right font-medium">
                            {formatDateTime(transaction.createdAt)}
                        </span>
                    </div>
                </div>

                {/* Footer button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 font-bold text-xs transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
