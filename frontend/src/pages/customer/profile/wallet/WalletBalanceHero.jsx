import { useState } from "react";
import { PlusCircle, ShieldCheck, Loader2 } from "lucide-react";

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
        <div className="pb-4 border-b border-[color:var(--app-border)]/30">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT: Current Wallet Balance */}
                <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                            Current Wallet Balance
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {wallet?.status || "ACTIVE"}
                        </span>
                    </div>

                    <div className="pt-0.5">
                        {loadingWallet ? (
                            <div className="h-9 w-44 rounded bg-[color:var(--app-border)]/30 animate-pulse" />
                        ) : (
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[color:var(--app-text)]">
                                ₹{formatINR(wallet?.balance)}
                            </div>
                        )}
                        <p className="theme-muted text-xs mt-1 leading-relaxed">
                            Use your wallet balance for instant food ordering.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs theme-muted pt-1">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <ShieldCheck size={13} /> Safe & Instant Checkout
                        </span>
                        <span>•</span>
                        <span className="text-[var(--app-primary)] font-semibold">Zero Transaction Fees</span>
                    </div>
                </div>

                {/* RIGHT: Add Money Dashboard Section */}
                <div className="lg:col-span-7 space-y-2 lg:pl-6 lg:border-l lg:border-[color:var(--app-border)]/30">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                            Add Money
                        </span>
                        <span className="theme-muted text-[11px]">
                            Min ₹10 · Max ₹50,000
                        </span>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                        {QUICK_AMOUNTS.map((amt) => {
                            const isSelected = Number(selectedAmount) === amt;
                            return (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => handleQuickSelect(amt)}
                                    disabled={topupLoading}
                                    className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-[var(--app-primary)] text-white shadow-sm font-bold"
                                            : "border border-[color:var(--app-border)]/60 theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/20"
                                    }`}
                                >
                                    +₹{amt.toLocaleString("en-IN")}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Amount Form & Inline Add Button */}
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 theme-muted font-bold text-xs select-none pointer-events-none">
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
                                className="w-full pl-6 pr-3 py-1.5 rounded-lg text-xs font-medium border border-[color:var(--app-border)] bg-[color:var(--app-bg)] text-[color:var(--app-text)] focus:border-[var(--app-primary)] outline-none transition-colors"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={topupLoading || !isAmountValid}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--app-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                        >
                            {topupLoading ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Initiating...</span>
                                </>
                            ) : (
                                <>
                                    <PlusCircle size={13} />
                                    <span>Add ₹{Number(selectedAmount || 0).toLocaleString("en-IN")}</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="flex items-center justify-between text-[11px] theme-muted pt-0.5">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Instant credit upon payment
                        </span>
                        <span>100% Encrypted & Secure</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
