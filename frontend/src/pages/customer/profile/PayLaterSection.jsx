import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import { useLanguage } from "../../../context/LanguageContext";
import {
    IndianRupee,
    ArrowRight,
    ShieldCheck,
    CreditCard,
    Building2,
    CheckCircle2,
    AlertCircle,
    Receipt,
    Sparkles,
    ChevronRight,
    HelpCircle,
    Coins
} from "lucide-react";

const toInr = (val) => {
    const n = Number(val || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export default function PayLaterSection() {
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const forceCustomerMode = searchParams.get("scope") === "customer";
    const buildProfilePath = (path) => (forceCustomerMode ? `${path}?scope=customer` : path);

    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await api.get("/customer/pay-later/accounts");
            setAccounts(res.data?.accounts || []);
        } catch (err) {
            showToast({
                title: "Error",
                message: err.response?.data?.message || "Failed to load credit accounts",
                variant: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const totalPendingDues = accounts.reduce((acc, a) => acc + Number(a.pendingBalance || 0), 0);
    const totalLoyaltyPoints = accounts.reduce((acc, a) => Math.max(acc, Number(a.rewardPoints || 0)), 0);

    if (loading) {
        return (
            <div className="py-6 text-center space-y-2.5">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 animate-spin">
                    <Sparkles size={20} />
                </div>
                <p className="theme-muted text-xs sm:text-sm font-medium">Loading your Pay Later Khata accounts...</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4 text-left">
            {/* HERO SUMMARY BANNER */}
            <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-white/60 p-4 sm:p-5 dark:bg-slate-900/40">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="space-y-1.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)] flex items-center gap-1.5">
                            <ShieldCheck size={14} />
                            VERIFIED DIGITAL KHATA
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[color:var(--app-text)]">
                            Pay Later Accounts
                        </h1>
                        <p className="theme-muted text-xs sm:text-sm max-w-xl leading-relaxed">
                            Track your dining credit, view itemized receipts, earn loyalty points, and clear pending dues across restaurant partners.
                        </p>
                    </div>

                    {/* OVERALL PORTFOLIO & LOYALTY METRICS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0 lg:w-[420px]">
                        {/* LOYALTY BALANCE */}
                        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Loyalty Balance
                            </p>
                            <h2 className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <Coins size={20} />
                                {totalLoyaltyPoints} pts
                            </h2>
                            <p className="mt-1 text-[11px] theme-muted font-medium">
                                Earned on Khata repayments
                            </p>
                        </div>

                        {/* OUTSTANDING DUES */}
                        <div className="rounded-lg border border-orange-500/25 bg-orange-500/[0.05] p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-primary)]">
                                Total Outstanding Dues
                            </p>
                            <h2 className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">
                                ₹{toInr(totalPendingDues)}
                            </h2>
                            <p className="mt-1 text-[11px] theme-muted">
                                {accounts.length} Active {accounts.length === 1 ? "Partner" : "Partners"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACCOUNTS LIST */}
            <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-bold text-[color:var(--app-text)] flex items-center gap-2">
                        <Building2 size={18} className="text-[var(--app-primary)]" />
                        Dining Khata Partners ({accounts.length})
                    </h2>
                </div>

                {accounts.length === 0 ? (
                    <div className="rounded-xl border border-[color:var(--app-border)]/40 p-6 sm:p-8 text-center space-y-2 bg-white/40 dark:bg-slate-900/40">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/10 text-[var(--app-primary)]">
                            <CreditCard size={22} />
                        </div>
                        <h4 className="text-base font-bold text-[color:var(--app-text)]">No Active Credit Accounts Found</h4>
                        <p className="theme-muted text-xs max-w-md mx-auto leading-relaxed">
                            Pay Later is a digital Khata service. Once a restaurant owner approves your phone number or adds credit for you, your account will automatically appear here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {accounts.map((acc) => {
                            const hasDue = Number(acc.pendingBalance || 0) > 0;
                            return (
                                <Link
                                    key={acc.accountId}
                                    to={buildProfilePath(`/profile/pay-later/${acc.accountId}`)}
                                    className="group relative overflow-hidden rounded-xl border border-[color:var(--app-border)]/40 bg-white/80 p-5 transition hover:border-[var(--app-primary)]/40 dark:bg-slate-900/80"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-[var(--app-primary)] border border-orange-500/20 font-bold text-lg">
                                                {acc.restaurantName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base sm:text-lg font-bold text-[color:var(--app-text)] group-hover:text-[var(--app-primary)] transition">
                                                        {acc.restaurantName}
                                                    </h4>
                                                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        Active Khata
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        <Coins size={11} /> {acc.rewardPoints || 0} pts
                                                    </span>
                                                </div>

                                                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs theme-muted">
                                                    <span>Total Borrowed: <strong className="text-[color:var(--app-text)]">₹{toInr(acc.totalBorrowed)}</strong></span>
                                                    <span>•</span>
                                                    <span>Total Repaid: <strong className="text-emerald-600 dark:text-emerald-400">₹{toInr(acc.totalPaid)}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-[color:var(--app-border)]/20">
                                            <div className="text-left sm:text-right">
                                                <p className="text-[11px] font-bold uppercase tracking-wider theme-muted">Pending Dues</p>
                                                <p className={`text-xl sm:text-2xl font-bold ${hasDue ? "text-[var(--app-primary)]" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                    ₹{toInr(acc.pendingBalance)}
                                                </p>
                                            </div>

                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-[var(--app-primary)] group-hover:bg-[var(--app-primary)] group-hover:text-white transition">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* HOW IT WORKS INFO FOOTER */}
            <div className="rounded-xl border border-[color:var(--app-border)]/40 p-5 sm:p-6 space-y-3.5 bg-white/40 dark:bg-slate-900/40">
                <h4 className="text-sm sm:text-base font-bold text-[color:var(--app-text)] flex items-center gap-2">
                    <HelpCircle size={17} className="text-[var(--app-primary)]" />
                    How Tiffzy Pay Later & Loyalty Points Work
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs theme-muted leading-relaxed">
                    <div className="space-y-1 p-3.5 rounded-lg border border-[color:var(--app-border)]/20 bg-black/[0.02] dark:bg-white/[0.02]">
                        <strong className="block text-xs font-bold text-[var(--app-primary)] flex items-center gap-1.5">
                            <ShieldCheck size={14} /> 1. Interest-Free Credit
                        </strong>
                        <p>Enjoy dining now and paying later without interest charges or hidden fees.</p>
                    </div>
                    <div className="space-y-1 p-3.5 rounded-lg border border-[color:var(--app-border)]/20 bg-black/[0.02] dark:bg-white/[0.02]">
                        <strong className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <Coins size={14} /> 2. Earn Loyalty Rewards
                        </strong>
                        <p>Earn +20 pts (within 15 days) or +10 pts (within 30 days) per ₹500 repaid on time.</p>
                    </div>
                    <div className="space-y-1 p-3.5 rounded-lg border border-[color:var(--app-border)]/20 bg-black/[0.02] dark:bg-white/[0.02]">
                        <strong className="block text-xs font-bold text-[var(--app-primary)] flex items-center gap-1.5">
                            <CreditCard size={14} /> 3. Instant Online Repayment
                        </strong>
                        <p>Repay anytime securely via Cashfree Payment Gateway (Cards, UPI, Net Banking, Wallets).</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
