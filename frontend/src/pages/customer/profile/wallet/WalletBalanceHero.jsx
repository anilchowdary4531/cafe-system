import { useState } from "react";
import { CreditCard, PlusCircle, ShieldCheck, Sparkles, Loader2 } from "lucide-react";

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000];

const formatINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

export default function WalletBalanceHero({
    wallet,
    loadingWallet,
    onAddMoney,
    topupLoading,
}) {
    const [selectedAmount, setSelectedAmount] = useState(500);

    const handleQuickSelect = (amt) => {
        setSelectedAmount(amt);
    };

    const handleCustomChange = (e) => {
        const val = e.target.value;
        setSelectedAmount(val);
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        onAddMoney(selectedAmount);
    };

    const isAmountValid = Number(selectedAmount) >= 10;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* LEFT: Wallet Balance Card */}
            <div className="lg:col-span-5 theme-panel rounded-3xl p-6 sm:p-7 border border-[var(--app-border)] relative overflow-hidden flex flex-col justify-between shadow-lg bg-gradient-to-br from-amber-500/15 via-orange-600/10 to-transparent">
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
                            <CreditCard size={15} />
                            <span>Current Wallet Balance</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {wallet?.status || "ACTIVE"}
                        </span>
                    </div>

                    <div className="pt-1 pb-2">
                        {loadingWallet ? (
                            <div className="h-12 w-48 rounded-xl bg-white/10 animate-pulse" />
                        ) : (
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                                    ₹{formatINR(wallet?.balance)}
                                </span>
                            </div>
                        )}
                        <p className="mt-2 text-xs text-stone-400 leading-relaxed">
                            Use your wallet balance for instant food ordering.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
                    <span className="flex items-center gap-1.5 text-stone-300">
                        <ShieldCheck size={14} className="text-emerald-400" />
                        Safe & Instant Checkout
                    </span>
                    <span className="font-medium text-amber-400/90">Zero Transaction Fees</span>
                </div>

                {/* Subtle background glow */}
                <div className="pointer-events-none absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-amber-500/10 blur-3xl"></div>
            </div>

            {/* RIGHT: Add Money Card */}
            <div className="lg:col-span-7 theme-card rounded-3xl p-6 sm:p-7 border border-[var(--app-border)] flex flex-col justify-between shadow-lg">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-400" />
                            Add Money
                        </h2>
                        <span className="text-[11px] font-medium text-stone-400">
                            Min ₹10 · Max ₹50,000
                        </span>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="space-y-1.5 mb-4">
                        <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                            Select Amount
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {QUICK_AMOUNTS.map((amt) => {
                                const isSelected = Number(selectedAmount) === amt;
                                return (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => handleQuickSelect(amt)}
                                        disabled={topupLoading}
                                        className={`min-h-[44px] px-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
                                            isSelected
                                                ? "bg-amber-500 text-stone-950 border-amber-400 shadow-md scale-[1.02]"
                                                : "bg-white/5 text-stone-200 border-white/10 hover:bg-white/10 hover:border-amber-400/50"
                                        }`}
                                    >
                                        +₹{amt.toLocaleString("en-IN")}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Amount Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <div className="relative flex items-center">
                                <span className="absolute left-3.5 text-stone-400 font-bold text-base select-none pointer-events-none">
                                    ₹
                                </span>
                                <input
                                    type="number"
                                    min="10"
                                    max="50000"
                                    step="1"
                                    value={selectedAmount}
                                    onChange={handleCustomChange}
                                    placeholder="Enter custom amount"
                                    disabled={topupLoading}
                                    className="theme-input min-h-[44px] w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={topupLoading || !isAmountValid}
                            className="theme-button min-h-[44px] w-full py-3 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {topupLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Initiating Secure Payment...</span>
                                </>
                            ) : (
                                <>
                                    <PlusCircle size={16} />
                                    <span>Add ₹{Number(selectedAmount || 0).toLocaleString("en-IN")}</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Instant credit upon payment
                    </span>
                    <span>100% Encrypted & Secure</span>
                </div>
            </div>
        </div>
    );
}
