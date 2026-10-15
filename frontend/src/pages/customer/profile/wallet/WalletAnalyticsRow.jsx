import { Calendar } from "lucide-react";

const formatINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

export default function WalletAnalyticsRow({ summary, loading }) {
    if (loading) {
        return (
            <div className="pb-4 border-b border-[color:var(--app-border)]/30 space-y-2 animate-pulse">
                <div className="h-3 w-28 bg-[color:var(--app-border)]/40 rounded"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-y border-[color:var(--app-border)]/20">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-[color:var(--app-border)]/20 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    const totalDeposited = summary?.totalDeposited || 0;
    const totalSpent = summary?.totalSpent || 0;
    const totalTransactions = summary?.totalTransactions || 0;
    const monthDeposits = summary?.monthDeposits || 0;
    const monthSpent = summary?.monthSpent || 0;
    const totalRefunded = summary?.totalRefunded || 0;

    return (
        <div className="pb-4 border-b border-[color:var(--app-border)]/30 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                    Wallet Summary
                </div>
                <span className="theme-muted text-[11px]">
                    Period overview & activity
                </span>
            </div>

            {/* Flat 3-Column Analytics KPI Row (Matching Owner Analytics Overview Row) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-y border-[color:var(--app-border)]/30 text-xs">
                {/* 1. Total Top-ups / Total Added */}
                <div>
                    <div className="theme-muted text-xs font-medium uppercase tracking-wide">
                        Total Top-ups
                    </div>
                    <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +₹{formatINR(totalDeposited)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs theme-muted">
                        <Calendar size={11} className="text-[var(--app-primary)]" />
                        <span>This month: <strong className="text-[color:var(--app-text)] font-semibold">₹{formatINR(monthDeposits)}</strong></span>
                    </div>
                </div>

                {/* 2. Total Food Spend / Food Spend */}
                <div>
                    <div className="theme-muted text-xs font-medium uppercase tracking-wide">
                        Total Food Spend
                    </div>
                    <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">
                        -₹{formatINR(totalSpent)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs theme-muted">
                        <Calendar size={11} className="text-[var(--app-primary)]" />
                        <span>This month: <strong className="text-[color:var(--app-text)] font-semibold">₹{formatINR(monthSpent)}</strong></span>
                    </div>
                </div>

                {/* 3. Total Transactions / Transactions */}
                <div>
                    <div className="theme-muted text-xs font-medium uppercase tracking-wide">
                        Total Transactions
                    </div>
                    <div className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--app-text)] mt-0.5">
                        {totalTransactions}
                    </div>
                    <div className="mt-0.5 text-xs theme-muted">
                        {totalRefunded > 0 ? (
                            <span>Refunds credited: <strong className="text-amber-600 dark:text-amber-400 font-semibold">₹{formatINR(totalRefunded)}</strong></span>
                        ) : (
                            <span>Ledger activity records in selected period</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
