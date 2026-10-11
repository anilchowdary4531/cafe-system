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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="theme-card rounded-2xl p-5 border border-[var(--app-border)] space-y-3 animate-pulse"
                    >
                        <div className="flex items-center justify-between">
                            <div className="h-4 w-24 bg-white/10 rounded-md"></div>
                            <div className="h-8 w-8 bg-white/10 rounded-xl"></div>
                        </div>
                        <div className="h-7 w-32 bg-white/10 rounded-md"></div>
                        <div className="h-3 w-28 bg-white/10 rounded-md"></div>
                    </div>
                ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. TOTAL TOP-UPS */}
            <div className="theme-card rounded-2xl p-5 border border-[var(--app-border)] hover:border-emerald-500/30 transition-all shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Total Top-ups
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                        <ArrowDownLeft size={18} />
                    </div>
                </div>
                <div className="mt-2.5">
                    <p className="text-2xl sm:text-[1.65rem] font-black text-emerald-400 tracking-tight">
                        +₹{formatINR(totalDeposited)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-400">
                        <Calendar size={12} className="text-stone-500" />
                        <span>This month: <strong className="text-emerald-400/90 font-semibold">₹{formatINR(monthDeposits)}</strong></span>
                    </div>
                </div>
            </div>

            {/* 2. TOTAL FOOD SPEND */}
            <div className="theme-card rounded-2xl p-5 border border-[var(--app-border)] hover:border-rose-500/30 transition-all shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Total Food Spend
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/20">
                        <ArrowUpRight size={18} />
                    </div>
                </div>
                <div className="mt-2.5">
                    <p className="text-2xl sm:text-[1.65rem] font-black text-rose-400 tracking-tight">
                        -₹{formatINR(totalSpent)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-400">
                        <Calendar size={12} className="text-stone-500" />
                        <span>This month: <strong className="text-rose-400/90 font-semibold">₹{formatINR(monthSpent)}</strong></span>
                    </div>
                </div>
            </div>

            {/* 3. TOTAL TRANSACTIONS */}
            <div className="theme-card rounded-2xl p-5 border border-[var(--app-border)] hover:border-amber-500/30 transition-all shadow-sm sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Total Transactions
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <Activity size={18} />
                    </div>
                </div>
                <div className="mt-2.5">
                    <p className="text-2xl sm:text-[1.65rem] font-black text-stone-100 tracking-tight">
                        {totalTransactions}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-400">
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
