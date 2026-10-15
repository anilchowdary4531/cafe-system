import { useState, useMemo } from "react";
import {
    History,
    ArrowDownLeft,
    ArrowUpRight,
    Search,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Utensils,
    CreditCard,
    AlertCircle,
    Eye,
    X,
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
            icon: ArrowDownLeft,
            iconClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
        };
    }
    if (type === "ORDER_PAYMENT") {
        return {
            title: "Food Order Payment",
            icon: Utensils,
            iconClass: "bg-rose-500/15 text-rose-400 border-rose-500/25",
        };
    }
    if (type === "REFUND") {
        return {
            title: "Order Refund",
            icon: RotateCcw,
            iconClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
        };
    }
    return {
        title: isCredit ? "Credit Adjustment" : "Debit Adjustment",
        icon: isCredit ? ArrowDownLeft : ArrowUpRight,
        iconClass: isCredit
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
            : "bg-rose-500/15 text-rose-400 border-rose-500/25",
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
        <div className="theme-panel rounded-3xl p-5 sm:p-7 border border-[var(--app-border)] shadow-md space-y-5">
            {/* Header & Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <History size={18} />
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                            Recent Wallet Activity
                        </h3>
                        <p className="text-[11px] text-stone-400">
                            Latest wallet transactions & statement
                        </p>
                    </div>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Tabs */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto">
                        {FILTER_TABS.map((tab) => {
                            const isSelected = activeType === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTypeChange(tab.id)}
                                    disabled={loading}
                                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                        isSelected
                                            ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                                            : "text-stone-300 hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Field */}
                    <div className="relative min-w-[200px]">
                        <Search
                            size={14}
                            className="absolute left-3 top-3 text-stone-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search transactions..."
                            className="theme-input min-h-[38px] w-full pl-8 pr-7 py-1.5 rounded-xl text-xs border border-white/10 focus:border-amber-500 outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-white"
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Transactions Content */}
            {loading ? (
                <div className="py-16 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-stone-400">Loading wallet ledger...</p>
                </div>
            ) : filteredTransactions.length === 0 ? (
                <div className="py-14 text-center rounded-2xl border border-dashed border-white/10 p-6 space-y-2">
                    <History size={32} className="text-stone-500 mx-auto" />
                    <p className="text-sm font-semibold text-stone-300">
                        No wallet transactions yet.
                    </p>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                        {searchQuery
                            ? `No transactions match "${searchQuery}". Try clearing the search.`
                            : "Add money or make a food purchase to view your transaction ledger."}
                    </p>
                </div>
            ) : (
                <>
                    {/* DESKTOP TABLE VIEW (md and up) */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 text-stone-400 uppercase tracking-wider font-semibold border-b border-white/10">
                                <tr>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Date / Time</th>
                                    <th className="px-4 py-3.5">Description</th>
                                    <th className="px-4 py-3.5">Type</th>
                                    <th className="px-4 py-3.5">Reference / Order</th>
                                    <th className="px-4 py-3.5 text-center">Status</th>
                                    <th className="px-4 py-3.5 text-right">Amount</th>
                                    <th className="px-4 py-3.5 text-right">Balance After</th>
                                    <th className="px-4 py-3.5 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTransactions.map((txn) => {
                                    const meta = getTransactionMeta(txn);
                                    const Icon = meta.icon;
                                    const isCredit = txn.direction === "CREDIT";

                                    return (
                                        <tr
                                            key={txn.id}
                                            onClick={() => onSelectTransaction(txn)}
                                            className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                        >
                                            {/* Date & Time */}
                                            <td className="px-4 py-3.5 text-stone-300 whitespace-nowrap">
                                                {formatDateTime(txn.createdAt)}
                                            </td>

                                            {/* Description */}
                                            <td className="px-4 py-3.5">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                                                        {txn.description || meta.title}
                                                    </p>
                                                    <p className="text-[11px] text-stone-400">
                                                        {meta.title}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Type */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                                        isCredit
                                                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                                            : "bg-rose-500/15 text-rose-400 border-rose-500/25"
                                                    }`}
                                                >
                                                    <Icon size={13} />
                                                    <span>{isCredit ? "Credit" : "Debit"}</span>
                                                </div>
                                            </td>

                                            {/* Order Reference */}
                                            <td className="px-4 py-3.5 text-stone-300">
                                                {txn.orderId ? (
                                                    <span className="font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-stone-300">
                                                        #{txn.orderId}
                                                    </span>
                                                ) : txn.referenceId ? (
                                                    <span className="font-mono text-stone-400 text-[11px] truncate block max-w-[120px]">
                                                        {txn.referenceId}
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-500">—</span>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                <span
                                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                                                        txn.status === "SUCCESS"
                                                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                                            : txn.status === "PENDING"
                                                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                                    }`}
                                                >
                                                    {txn.status || "SUCCESS"}
                                                </span>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <span
                                                    className={`text-sm font-black ${
                                                        isCredit ? "text-emerald-400" : "text-rose-400"
                                                    }`}
                                                >
                                                    {isCredit ? "+" : "-"}₹{formatINR(txn.amount)}
                                                </span>
                                            </td>

                                            {/* Balance After */}
                                            <td className="px-4 py-3.5 text-right font-medium text-stone-300 whitespace-nowrap">
                                                ₹{formatINR(txn.balanceAfter)}
                                            </td>

                                            {/* Action */}
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectTransaction(txn);
                                                    }}
                                                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* MOBILE CARD VIEW (below md) */}
                    <div className="md:hidden space-y-3">
                        {filteredTransactions.map((txn) => {
                            const meta = getTransactionMeta(txn);
                            const Icon = meta.icon;
                            const isCredit = txn.direction === "CREDIT";

                            return (
                                <div
                                    key={txn.id}
                                    onClick={() => onSelectTransaction(txn)}
                                    className="theme-card rounded-2xl p-4 border border-white/10 active:bg-white/[0.04] transition-all cursor-pointer space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${meta.iconClass}`}
                                            >
                                                <Icon size={18} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white">
                                                    {meta.title}
                                                </p>
                                                <p className="text-[11px] text-stone-400 line-clamp-1">
                                                    {txn.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p
                                                className={`text-sm font-black ${
                                                    isCredit ? "text-emerald-400" : "text-rose-400"
                                                }`}
                                            >
                                                {isCredit ? "+" : "-"}₹{formatINR(txn.amount)}
                                            </p>
                                            <span
                                                className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                                                    txn.status === "SUCCESS"
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : "bg-amber-500/20 text-amber-400"
                                                }`}
                                            >
                                                {txn.status || "SUCCESS"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-stone-400">
                                        <span>{formatDateTime(txn.createdAt)}</span>
                                        <span className="font-medium text-stone-300">
                                            Balance: ₹{formatINR(txn.balanceAfter)}
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
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
                    <p>
                        Showing <strong className="text-stone-200">{startIndex}</strong> to{" "}
                        <strong className="text-stone-200">{endIndex}</strong> of{" "}
                        <strong className="text-stone-200">{total}</strong> transactions
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1 || loading}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-stone-200 transition-all"
                        >
                            <ChevronLeft size={15} />
                            <span>Previous</span>
                        </button>

                        <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 font-bold text-amber-400">
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages || loading}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold text-stone-200 transition-all"
                        >
                            <span>Next</span>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
