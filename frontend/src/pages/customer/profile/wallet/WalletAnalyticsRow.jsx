import { ArrowDownLeft, ArrowUpRight, Activity, Calendar } from "lucide-react";

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
            <div className="theme-panel rounded-3xl p-5 border border-[var(--app-border)] space-y-3 animate-pulse">
                <div className="h-4 w-32 bg-white/10 rounded-md"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-white/5 rounded-xl"></div>
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
        <div className="theme-panel rounded-3xl p-5 sm:p-6 border border-[var(--app-border)] shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <Activity size={14} />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                        Wallet Summary
                    </h3>
                </div>
                <span className="text-[11px] text-stone-500">
                    Period overview & activity
                </span>
            </div>

            {/* Compact 3-Column Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                {/* 1. Total Top-ups / Total Added */}
                <div className="pt-3 sm:pt-0 sm:pr-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Total Top-ups
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <ArrowDownLeft size={14} />
                        </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                        +₹{formatINR(totalDeposited)}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                        <Calendar size={11} className="text-stone-500" />
                        <span>This month: <strong className="text-emerald-400/90 font-semibold">₹{formatINR(monthDeposits)}</strong></span>
                    </div>
                </div>

                {/* 2. Total Food Spend / Food Spend */}
                <div className="pt-3 sm:pt-0 sm:px-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Total Food Spend
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                            <ArrowUpRight size={14} />
                        </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-rose-400 tracking-tight">
                        -₹{formatINR(totalSpent)}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                        <Calendar size={11} className="text-stone-500" />
                        <span>This month: <strong className="text-rose-400/90 font-semibold">₹{formatINR(monthSpent)}</strong></span>
                    </div>
                </div>

                {/* 3. Total Transactions / Transactions */}
                <div className="pt-3 sm:pt-0 sm:pl-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Total Transactions
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                            <Activity size={14} />
                        </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-stone-100 tracking-tight">
                        {totalTransactions}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                        {totalRefunded > 0 ? (
                            <span>Refunds credited: <strong className="text-amber-400 font-semibold">₹{formatINR(totalRefunded)}</strong></span>
                        ) : (
                            <span>Ledger activity records in selected period</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
