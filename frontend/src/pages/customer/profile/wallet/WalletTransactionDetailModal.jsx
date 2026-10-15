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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            {/* Modal Box */}
            <div
                className="w-full max-w-md rounded-xl bg-[color:var(--app-bg)] border border-[color:var(--app-border)] p-5 sm:p-6 shadow-2xl relative text-[color:var(--app-text)] space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Close */}
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-base font-bold text-[color:var(--app-text)] tracking-tight">
                            Transaction Details
                        </h3>
                        <p className="text-xs theme-muted">{typeName}</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/20 transition-colors cursor-pointer"
                        title="Close modal"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Amount Hero */}
                <div className="p-4 rounded-lg bg-[color:var(--app-border)]/10 border border-[color:var(--app-border)]/30 text-center space-y-1">
                    <p className="text-xs uppercase tracking-wider font-semibold theme-muted">
                        {isCredit ? "Credited Amount" : "Debited Amount"}
                    </p>
                    <p
                        className={`text-2xl sm:text-3xl font-extrabold ${
                            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                    >
                        {isCredit ? "+" : "-"}₹{formatINR(transaction.amount)}
                    </p>
                    <div className="pt-1 flex items-center justify-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                transaction.status === "SUCCESS"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : transaction.status === "PENDING"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                        >
                            {transaction.status === "SUCCESS" && <CheckCircle2 size={11} />}
                            {transaction.status === "PENDING" && <Clock size={11} />}
                            {transaction.status === "FAILED" && <AlertCircle size={11} />}
                            {transaction.status || "SUCCESS"}
                        </span>
                        <span className="text-xs theme-muted">·</span>
                        <span className="text-xs font-semibold theme-muted">
                            {transaction.direction}
                        </span>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-2 text-xs">
                    {/* Description */}
                    <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5 flex items-start gap-2.5">
                        <FileText size={15} className="theme-muted mt-0.5 shrink-0" />
                        <div>
                            <span className="theme-muted block font-semibold">Description</span>
                            <span className="text-[color:var(--app-text)] text-xs font-medium">
                                {transaction.description || "N/A"}
                            </span>
                        </div>
                    </div>

                    {/* Balance Before & Balance After */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5">
                            <span className="theme-muted block font-semibold">Balance Before</span>
                            <span className="text-[color:var(--app-text)] font-bold">
                                ₹{formatINR(transaction.balanceBefore)}
                            </span>
                        </div>
                        <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5">
                            <span className="theme-muted block font-semibold">Balance After</span>
                            <span className="text-[var(--app-primary)] font-bold">
                                ₹{formatINR(transaction.balanceAfter)}
                            </span>
                        </div>
                    </div>

                    {/* Order Reference if present */}
                    {transaction.orderId && (
                        <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5 flex items-center justify-between">
                            <span className="theme-muted flex items-center gap-1.5 font-semibold">
                                <Receipt size={13} className="text-[var(--app-primary)]" />
                                Order ID
                            </span>
                            <span className="font-mono text-[color:var(--app-text)] font-bold">
                                #{transaction.orderId}
                            </span>
                        </div>
                    )}

                    {/* Reference ID if present */}
                    {transaction.referenceId && (
                        <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5 flex items-center justify-between">
                            <span className="theme-muted flex items-center gap-1.5 font-semibold">
                                <Hash size={13} className="theme-muted" />
                                Reference ID
                            </span>
                            <span className="font-mono text-[color:var(--app-text)] font-medium truncate max-w-[180px]">
                                {transaction.referenceId}
                            </span>
                        </div>
                    )}

                    {/* Reference Type if present */}
                    {transaction.referenceType && (
                        <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5 flex items-center justify-between">
                            <span className="theme-muted flex items-center gap-1.5 font-semibold">
                                <Layers size={13} className="theme-muted" />
                                Reference Type
                            </span>
                            <span className="text-[color:var(--app-text)] font-medium">
                                {transaction.referenceType}
                            </span>
                        </div>
                    )}

                    {/* Date & Time */}
                    <div className="p-2.5 rounded-lg border border-[color:var(--app-border)]/20 bg-[color:var(--app-border)]/5 flex items-center justify-between">
                        <span className="theme-muted flex items-center gap-1.5 font-semibold">
                            <Calendar size={13} className="theme-muted" />
                            Timestamp
                        </span>
                        <span className="text-[color:var(--app-text)] text-right font-medium">
                            {formatDateTime(transaction.createdAt)}
                        </span>
                    </div>
                </div>

                {/* Footer button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2 rounded-lg border border-[color:var(--app-border)]/60 hover:bg-[color:var(--app-border)]/20 text-[color:var(--app-text)] font-semibold text-xs transition-colors cursor-pointer"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
