import { useState, useMemo } from "react";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    History,
} from "lucide-react";

const FILTER_TABS = [
    { id: "", label: "All" },
    { id: "WALLET_TOPUP", label: "Top-ups" },
    { id: "ORDER_PAYMENT", label: "Food Orders" },
    { id: "REFUND", label: "Refunds" },
];

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
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
};

const getTransactionMeta = (txn) => {
    const type = String(txn?.type || "").toUpperCase();
    const isCredit = txn?.direction === "CREDIT";

    if (type === "WALLET_TOPUP") {
        return {
            title: "Wallet Top-up",
        };
    }
    if (type === "ORDER_PAYMENT") {
        return {
            title: "Food Order Payment",
        };
    }
    if (type === "REFUND") {
        return {
            title: "Order Refund",
        };
    }
    return {
        title: isCredit ? "Credit Adjustment" : "Debit Adjustment",
    };
};

export default function WalletTransactionTable({
    transactions = [],
    total = 0,
    page = 1,
    totalPages = 1,
    limit = 20,
    loading = false,
    activeType = "",
    onTypeChange,
    onPageChange,
    onSelectTransaction,
}) {
    const [searchQuery, setSearchQuery] = useState("");

    // Client-side search over currently loaded page of transactions
    const filteredTransactions = useMemo(() => {
        if (!searchQuery.trim()) return transactions;
        const q = searchQuery.toLowerCase().trim();
        return transactions.filter((t) => {
            const desc = String(t.description || "").toLowerCase();
            const orderId = String(t.orderId || "").toLowerCase();
            const refId = String(t.referenceId || "").toLowerCase();
            const type = String(t.type || "").toLowerCase();
            return (
                desc.includes(q) ||
                orderId.includes(q) ||
                refId.includes(q) ||
                type.includes(q)
            );
        });
    }, [transactions, searchQuery]);

    const startIndex = (page - 1) * limit + 1;
    const endIndex = Math.min(page * limit, total);

    return (
        <div className="pb-4 border-b border-[color:var(--app-border)]/30 space-y-3">
            {/* Header & Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                        Recent Wallet Activity
                    </div>
                    <p className="theme-muted text-xs mt-0.5">
                        Latest Wallet Transactions & Statement
                    </p>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Preset Filter Tabs */}
                    <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50 overflow-x-auto">
                        {FILTER_TABS.map((tab) => {
                            const isSelected = activeType === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTypeChange(tab.id)}
                                    disabled={loading}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                                        isSelected
                                            ? "bg-[var(--app-primary)] text-white shadow-sm font-bold"
                                            : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Field */}
                    <div className="relative min-w-[180px]">
                        <Search
                            size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 theme-muted pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search transactions..."
                            className="w-full pl-7 pr-6 py-1 rounded-lg text-xs border border-[color:var(--app-border)] bg-[color:var(--app-bg)] text-[color:var(--app-text)] focus:border-[var(--app-primary)] outline-none transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 theme-muted hover:text-[color:var(--app-text)] cursor-pointer"
                                title="Clear search"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Transactions Content */}
            {loading ? (
                <div className="py-12 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs theme-muted">Loading wallet ledger...</p>
                </div>
            ) : filteredTransactions.length === 0 ? (
                <div className="py-10 text-center rounded-lg border border-dashed border-[color:var(--app-border)]/40 p-6 space-y-1">
                    <History size={26} className="theme-muted mx-auto mb-1" />
                    <p className="text-sm font-semibold text-[color:var(--app-text)]">
                        No wallet transactions yet.
                    </p>
                    <p className="text-xs theme-muted max-w-sm mx-auto">
                        {searchQuery
                            ? `No transactions match "${searchQuery}". Try clearing the search.`
                            : "Add money or make a food purchase to view your transaction ledger."}
                    </p>
                </div>
            ) : (
                <>
                    {/* DESKTOP TABLE VIEW (md and up) */}
                    <div className="hidden md:block overflow-x-auto border border-[color:var(--app-border)]/50 rounded-md">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[color:var(--app-bg)]/80 theme-muted border-b border-[color:var(--app-border)]/40 font-semibold">
                                <tr>
                                    <th className="p-2.5 whitespace-nowrap">Date / Time</th>
                                    <th className="p-2.5">Description</th>
                                    <th className="p-2.5">Type</th>
                                    <th className="p-2.5">Reference / Order</th>
                                    <th className="p-2.5 text-center">Status</th>
                                    <th className="p-2.5 text-right">Amount</th>
                                    <th className="p-2.5 text-right">Balance After</th>
                                    <th className="p-2.5 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[color:var(--app-border)]/20">
                                {filteredTransactions.map((txn) => {
                                    const meta = getTransactionMeta(txn);
                                    const isCredit = txn.direction === "CREDIT";

                                    return (
                                        <tr
                                            key={txn.id}
                                            onClick={() => onSelectTransaction(txn)}
                                            className="hover:bg-[color:var(--app-border)]/15 transition-colors cursor-pointer group"
                                        >
                                            {/* Date & Time */}
                                            <td className="p-2.5 theme-muted whitespace-nowrap">
                                                {formatDateTime(txn.createdAt)}
                                            </td>

                                            {/* Description */}
                                            <td className="p-2.5">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-[color:var(--app-text)] group-hover:text-[var(--app-primary)] transition-colors truncate max-w-[240px]">
                                                        {txn.description || meta.title}
                                                    </p>
                                                    <p className="text-[11px] theme-muted">
                                                        {meta.title}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Type */}
                                            <td className="p-2.5 whitespace-nowrap">
                                                <span
                                                    className={`font-semibold ${
                                                        isCredit
                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                            : "text-rose-600 dark:text-rose-400"
                                                    }`}
                                                >
                                                    {isCredit ? "Credit" : "Debit"}
                                                </span>
                                            </td>

                                            {/* Order Reference */}
                                            <td className="p-2.5 text-[color:var(--app-text)]">
                                                {txn.orderId ? (
                                                    <span className="font-mono px-1.5 py-0.5 rounded bg-[color:var(--app-border)]/20 border border-[color:var(--app-border)]/40 text-xs">
                                                        #{txn.orderId}
                                                    </span>
                                                ) : txn.referenceId ? (
                                                    <span className="font-mono theme-muted text-[11px] truncate block max-w-[120px]">
                                                        {txn.referenceId}
                                                    </span>
                                                ) : (
                                                    <span className="theme-muted">—</span>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <span
                                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                                        txn.status === "SUCCESS"
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                            : txn.status === "PENDING"
                                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                                    }`}
                                                >
                                                    {txn.status || "SUCCESS"}
                                                </span>
                                            </td>

                                            {/* Amount */}
                                            <td className="p-2.5 text-right whitespace-nowrap font-bold">
                                                <span
                                                    className={
                                                        isCredit
                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                            : "text-rose-600 dark:text-rose-400"
                                                    }
                                                >
                                                    {isCredit ? "+" : "-"}₹{formatINR(txn.amount)}
                                                </span>
                                            </td>

                                            {/* Balance After */}
                                            <td className="p-2.5 text-right font-medium text-[color:var(--app-text)] whitespace-nowrap">
                                                ₹{formatINR(txn.balanceAfter)}
                                            </td>

                                            {/* Action */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectTransaction(txn);
                                                    }}
                                                    className="p-1 rounded text-stone-400 hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/20 transition-colors cursor-pointer"
                                                    title="View details"
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

                    {/* MOBILE CARD VIEW (below md) */}
                    <div className="md:hidden space-y-2">
                        {filteredTransactions.map((txn) => {
                            const meta = getTransactionMeta(txn);
                            const isCredit = txn.direction === "CREDIT";

                            return (
                                <div
                                    key={txn.id}
                                    onClick={() => onSelectTransaction(txn)}
                                    className="p-3 rounded-lg border border-[color:var(--app-border)]/40 bg-[color:var(--app-bg)]/40 active:bg-[color:var(--app-border)]/20 transition-all cursor-pointer space-y-1.5"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-[color:var(--app-text)] truncate">
                                                {txn.description || meta.title}
                                            </p>
                                            <p className="text-[11px] theme-muted">
                                                {meta.title}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p
                                                className={`text-xs font-bold ${
                                                    isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                                }`}
                                            >
                                                {isCredit ? "+" : "-"}₹{formatINR(txn.amount)}
                                            </p>
                                            <span
                                                className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                                    txn.status === "SUCCESS"
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-amber-600 dark:text-amber-400"
                                                }`}
                                            >
                                                {txn.status || "SUCCESS"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-1.5 border-t border-[color:var(--app-border)]/20 flex items-center justify-between text-[11px] theme-muted">
                                        <span>{formatDateTime(txn.createdAt)}</span>
                                        <span className="font-semibold text-[color:var(--app-text)]">
                                            Bal: ₹{formatINR(txn.balanceAfter)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs theme-muted">
                    <p>
                        Showing <strong className="text-[color:var(--app-text)]">{startIndex}</strong> to{" "}
                        <strong className="text-[color:var(--app-text)]">{endIndex}</strong> of{" "}
                        <strong className="text-[color:var(--app-text)]">{total}</strong> transactions
                    </p>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1 || loading}
                            className="px-2.5 py-1 rounded-md border border-[color:var(--app-border)] hover:bg-[color:var(--app-border)]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-[color:var(--app-text)] transition-all cursor-pointer"
                        >
                            <ChevronLeft size={13} />
                            <span>Previous</span>
                        </button>

                        <span className="px-2.5 py-1 rounded-md border border-[color:var(--app-border)]/60 font-semibold text-[var(--app-primary)]">
                            {page} / {totalPages}
                        </span>

                        <button
                            type="button"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages || loading}
                            className="px-2.5 py-1 rounded-md border border-[color:var(--app-border)] hover:bg-[color:var(--app-border)]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-[color:var(--app-text)] transition-all cursor-pointer"
                        >
                            <span>Next</span>
                            <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
