import { Star, Gift, ArrowUpRight, ArrowDownLeft, RefreshCw, ShieldCheck } from "lucide-react";
import useCachedGet from "../../../hooks/useCachedGet";

export default function CustomerLoyaltySection() {
    const { data: loyaltyData, loading, error, refetch } = useCachedGet("/customer/loyalty", {
        ttlMs: 10_000,
    });

    const { data: historyData, loading: historyLoading } = useCachedGet("/customer/loyalty/history", {
        ttlMs: 10_000,
    });

    const transactions = Array.isArray(historyData?.transactions) ? historyData.transactions : [];

    const formatMoney = (val) => `₹${Number(val || 0).toFixed(2)}`;

    return (
        <div className="space-y-6">
            <header className="theme-panel rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.26em]">Loyalty & Rewards</p>
                        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Points Balance & History</h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="theme-soft-button inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-sm theme-muted">Loading loyalty account details...</div>
                ) : error ? (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">{error}</div>
                ) : (
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/5 p-4 border border-amber-500/30">
                            <div className="flex items-center gap-2 text-amber-400">
                                <Star size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">Available Points</span>
                            </div>
                            <p className="mt-3 text-3xl font-extrabold text-amber-300 tabular-nums">
                                {loyaltyData?.currentBalance || 0}
                            </p>
                            <p className="mt-1 text-xs theme-muted">
                                Worth <strong className="text-amber-300 font-semibold">{formatMoney(loyaltyData?.equivalentValue || 0)}</strong>
                            </p>
                        </div>

                        <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <ArrowUpRight size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">Lifetime Earned</span>
                            </div>
                            <p className="mt-3 text-3xl font-extrabold text-emerald-300 tabular-nums">
                                {loyaltyData?.lifetimeEarned || 0}
                            </p>
                            <p className="mt-1 text-xs theme-muted">Total reward points earned</p>
                        </div>

                        <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-rose-400">
                                <ArrowDownLeft size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">Lifetime Redeemed</span>
                            </div>
                            <p className="mt-3 text-3xl font-extrabold text-rose-300 tabular-nums">
                                {loyaltyData?.lifetimeRedeemed || 0}
                            </p>
                            <p className="mt-1 text-xs theme-muted">Total reward points spent</p>
                        </div>
                    </div>
                )}
            </header>

            {/* Loyalty Rules Card */}
            {loyaltyData?.config && (
                <div className="theme-panel rounded-3xl p-6">
                    <h3 className="text-base font-bold flex items-center gap-2">
                        <ShieldCheck size={18} className="text-amber-400" />
                        Restaurant Reward Program Rules
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <p className="theme-muted">Earning Rate</p>
                            <p className="mt-1 font-semibold text-sm">{loyaltyData.config.pointsPerCurrency} pt per ₹1 spent</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <p className="theme-muted">Redemption Valuation</p>
                            <p className="mt-1 font-semibold text-sm">1 pt = ₹{loyaltyData.config.currencyPerPoint}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <p className="theme-muted">Minimum Threshold</p>
                            <p className="mt-1 font-semibold text-sm">Min {loyaltyData.config.minPointsToRedeem} points to redeem</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Ledger Log */}
            <div className="theme-panel rounded-3xl p-6">
                <h3 className="text-lg font-bold">Points Audit History</h3>
                {historyLoading ? (
                    <div className="py-6 text-center text-xs theme-muted">Loading transaction history...</div>
                ) : !transactions.length ? (
                    <div className="py-6 text-center text-xs theme-muted">No point transactions recorded yet.</div>
                ) : (
                    <div className="mt-4 space-y-2">
                        {transactions.map((tx) => {
                            const isPositive = tx.pointsDelta > 0;
                            return (
                                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
                                    <div>
                                        <div className="flex items-center gap-2 font-bold">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                                isPositive ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                                            }`}>
                                                {tx.type}
                                            </span>
                                            {tx.reason && <span className="theme-muted font-normal">{tx.reason}</span>}
                                        </div>
                                        <p className="theme-muted mt-1 text-[11px]">{new Date(tx.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-extrabold tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                                            {isPositive ? `+${tx.pointsDelta}` : tx.pointsDelta} pts
                                        </p>
                                        <p className="theme-muted text-[10px]">Bal: {tx.balanceAfter}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
