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
            <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 animate-spin">
                    <Sparkles size={24} />
                </div>
                <p className="theme-muted text-sm font-medium">Loading your Pay Later Khata accounts...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 text-left max-w-4xl mx-auto">
            {/* HERO SUMMARY BANNER */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-6 sm:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-500">
                            <ShieldCheck size={14} />
                            Verified Digital Khata
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Pay Later Accounts</h1>
                        <p className="theme-muted text-sm max-w-md leading-relaxed">
                            Track your dining credit, view itemized receipts, earn loyalty points, and clear pending dues across restaurant partners.
                        </p>
                    </div>

                    {/* OVERALL PORTFOLIO & LOYALTY CARDS */}
                    <div className="flex flex-wrap sm:flex-nowrap gap-4 shrink-0">
                        {/* LOYALTY BALANCE CARD */}
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 backdrop-blur-md dark:bg-emerald-950/40 min-w-[180px] flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Loyalty Balance</p>
                            <h2 className="mt-1 text-3xl font-black text-emerald-400 flex items-center gap-2">
                                <Coins size={26} className="text-emerald-400" />
                                {totalLoyaltyPoints} pts
                            </h2>
                            <p className="mt-2 text-[11px] text-emerald-300/80 font-medium pt-2 border-t border-emerald-500/20">
                                Earned on Khata repayments
                            </p>
                        </div>

                        {/* OUTSTANDING DUES CARD */}
                        <div className="rounded-2xl border border-black/10 bg-white/50 p-5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60 min-w-[200px] flex-1">
                            <p className="theme-muted text-xs font-bold uppercase tracking-wider">Total Outstanding Dues</p>
                            <h2 className="mt-1 text-3xl font-black text-amber-500">
                                ₹{toInr(totalPendingDues)}
                            </h2>
                            <div className="mt-2 flex items-center justify-between text-xs theme-muted pt-2 border-t border-black/5 dark:border-white/5">
                                <span>{accounts.length} Active {accounts.length === 1 ? "Partner" : "Partners"}</span>
                                <span className="font-semibold text-emerald-500">0 Overdue</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACCOUNTS LIST */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Building2 size={20} className="text-amber-500" />
                        Dining Khata Partners ({accounts.length})
                    </h3>
                </div>

                {accounts.length === 0 ? (
                    <div className="theme-panel rounded-3xl p-10 text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                            <CreditCard size={28} />
                        </div>
                        <h4 className="text-lg font-bold">No Active Credit Accounts Found</h4>
                        <p className="theme-muted text-sm max-w-md mx-auto leading-relaxed">
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
                                    className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white p-6 shadow-sm transition hover:border-amber-500/40 hover:shadow-md dark:border-white/10 dark:bg-slate-900/80"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-xl shadow-md">
                                                {acc.restaurantName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xl font-bold group-hover:text-amber-500 transition">
                                                        {acc.restaurantName}
                                                    </h4>
                                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                                                        Active Khata
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                                                        <Coins size={11} /> {acc.rewardPoints || 0} pts
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs theme-muted">
                                                    <span>Total Borrowed: <strong className="theme-text">₹{toInr(acc.totalBorrowed)}</strong></span>
                                                    <span>•</span>
                                                    <span>Total Repaid: <strong className="text-emerald-500">₹{toInr(acc.totalPaid)}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5">
                                            <div className="text-left sm:text-right">
                                                <p className="text-[11px] font-bold uppercase tracking-wider theme-muted">Pending Dues</p>
                                                <p className={`text-2xl font-black ${hasDue ? "text-amber-500" : "text-emerald-500"}`}>
                                                    ₹{toInr(acc.pendingBalance)}
                                                </p>
                                            </div>

                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 theme-text group-hover:bg-amber-500 group-hover:text-black transition">
                                                <ChevronRight size={20} />
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
            <div className="theme-panel rounded-3xl p-6 sm:p-8 space-y-4">
                <h4 className="text-base font-bold flex items-center gap-2">
                    <HelpCircle size={18} className="text-amber-500" />
                    How Tiffzy Pay Later & Loyalty Points Work
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs theme-muted leading-relaxed">
                    <div className="space-y-1.5 p-4 rounded-2xl bg-black/5 dark:bg-white/5">
                        <strong className="block theme-text text-sm font-semibold flex items-center gap-1.5 text-amber-500">
                            <ShieldCheck size={16} /> 1. Interest-Free Credit
                        </strong>
                        <p>Enjoy dining now and paying later without interest charges or hidden fees.</p>
                    </div>
                    <div className="space-y-1.5 p-4 rounded-2xl bg-black/5 dark:bg-white/5">
                        <strong className="block theme-text text-sm font-semibold flex items-center gap-1.5 text-emerald-400">
                            <Coins size={16} /> 2. Earn Loyalty Rewards
                        </strong>
                        <p>Earn +20 pts (within 15 days) or +10 pts (within 30 days) per ₹500 repaid on time.</p>
                    </div>
                    <div className="space-y-1.5 p-4 rounded-2xl bg-black/5 dark:bg-white/5">
                        <strong className="block theme-text text-sm font-semibold flex items-center gap-1.5 text-amber-500">
                            <CreditCard size={16} /> 3. Instant Online Repayment
                        </strong>
                        <p>Repay anytime using UPI, Google Pay, PhonePe, Paytm, or debit/credit cards.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
