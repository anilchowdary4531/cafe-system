import { useEffect, useState } from "react";
import {
    IndianRupee,
    PlusCircle,
    History,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    Shield,
    CreditCard
} from "lucide-react";
import { api } from "../../../utils/apiClient";

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000];

export default function WalletSection({ customerToken }) {
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    
    // Top-up modal state
    const [topupAmount, setTopupAmount] = useState(500);
    const [topupLoading, setTopupLoading] = useState(false);

    const getAuthConfig = () => {
        const token = customerToken || localStorage.getItem("customerToken");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    };

    const loadWalletData = async () => {
        try {
            setLoading(true);
            setError("");
            
            const config = getAuthConfig();
            const [wRes, tRes] = await Promise.all([
                api.get("/api/wallet", config),
                api.get("/api/wallet/transactions?limit=30", config),
            ]);

            const wData = wRes?.data || wRes;
            const tData = tRes?.data || tRes;

            setWallet(wData?.wallet || null);
            setTransactions(tData?.transactions || []);
        } catch (err) {
            console.error("[WalletSection] Failed to load wallet:", err);
            setError(err.response?.data?.message || "Failed to load wallet balance");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWalletData();
    }, []);

    const handleAddMoney = async (amountToAdd) => {
        const amt = Number(amountToAdd || topupAmount);
        if (Number.isNaN(amt) || amt < 10) {
            setError("Minimum top-up amount is ₹10");
            return;
        }

        try {
            setTopupLoading(true);
            setError("");
            setSuccessMsg("");

            const config = getAuthConfig();

            // Step 1: Create top-up session
            const res = await api.post("/api/wallet/topup/create", {
                amount: amt,
                returnUrl: window.location.href,
            }, config);

            const data = res?.data || res;
            const session = data?.session;

            if (!session || !session.topupTxnId) {
                throw new Error("Invalid top-up session generated");
            }

            // Step 2: Open Cashfree Drop-in / SDK or Simulate/Verify Cashfree Payment
            if (window.Cashfree && session.paymentSessionId) {
                const cashfree = window.Cashfree({ mode: "sandbox" });
                cashfree.checkout({
                    paymentSessionId: session.paymentSessionId,
                    redirectTarget: "_self"
                });
            } else {
                // Cashfree SDK fallback / simulation verification for immediate testing
                const verifyRes = await api.post("/api/wallet/topup/verify", {
                    topupTxnId: session.topupTxnId,
                    gatewayOrderId: session.paymentSessionId || session.topupTxnId,
                    gatewayPaymentId: `PAY_${Date.now()}`,
                }, config);

                const vData = verifyRes?.data || verifyRes;
                if (vData?.success) {
                    setSuccessMsg(`Success! ₹${amt} added to your Tiffzy Wallet.`);
                    await loadWalletData();
                } else {
                    throw new Error(vData?.message || "Payment verification failed");
                }
            }
        } catch (err) {
            console.error("[WalletSection] Topup error:", err);
            setError(err.response?.data?.message || err.message || "Failed to complete wallet top-up");
        } finally {
            setTopupLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div>
                    <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">Prepaid Balance</p>
                    <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">Tiffzy Wallet</h1>
                </div>
                <button
                    onClick={loadWalletData}
                    className="theme-soft-button p-2.5 rounded-xl text-gray-300 hover:text-white"
                    title="Refresh Balance"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {error && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {successMsg && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-300 text-sm flex items-center gap-2">
                    <CheckCircle2 size={18} /> {successMsg}
                </div>
            )}

            {/* Main Balance Card */}
            <div className="theme-panel rounded-3xl border border-[var(--app-border)] p-6 md:p-8 bg-gradient-to-br from-amber-500/15 via-orange-600/10 to-transparent relative overflow-hidden shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
                            <CreditCard size={16} /> Current Wallet Balance
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl md:text-5xl font-black text-white tracking-tight">
                                ₹{wallet ? wallet.balance.toFixed(2) : "0.00"}
                            </span>
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                {wallet?.status || "ACTIVE"}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Use your wallet balance for instant 1-click checkout on all food orders.
                        </p>
                    </div>

                    {/* Quick Add Money Controls */}
                    <div className="theme-card p-5 rounded-2xl border border-white/10 max-w-md w-full space-y-4">
                        <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">Top-up Wallet</p>
                        <div className="flex flex-wrap gap-2">
                            {QUICK_AMOUNTS.map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => {
                                        setTopupAmount(amt);
                                        handleAddMoney(amt);
                                    }}
                                    disabled={topupLoading}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-amber-500 hover:text-black transition-all"
                                >
                                    +₹{amt}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">₹</span>
                                <input
                                    type="number"
                                    min="10"
                                    max="50000"
                                    value={topupAmount}
                                    onChange={(e) => setTopupAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="theme-input rounded-xl pl-8 pr-3 py-2 text-sm w-full outline-none"
                                />
                            </div>
                            <button
                                onClick={() => handleAddMoney(topupAmount)}
                                disabled={topupLoading}
                                className="theme-button px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-lg"
                            >
                                <PlusCircle size={16} />
                                {topupLoading ? "Processing..." : "Add Money"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ledger Transaction History */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1 text-sm font-bold text-gray-200">
                    <History size={18} className="text-amber-400" /> Transaction Ledger
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Loading transaction history...</div>
                ) : transactions.length === 0 ? (
                    <div className="theme-card rounded-2xl p-8 text-center text-gray-400 border theme-border">
                        No wallet transactions yet. Top-up money or place food orders to see your history!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {transactions.map((txn) => {
                            const isCredit = txn.direction === "CREDIT";
                            return (
                                <div
                                    key={txn.id}
                                    className="theme-card rounded-2xl p-4 border theme-border flex items-center justify-between gap-4 transition hover:bg-white/[0.03]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl border ${isCredit ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                                            {isCredit ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{txn.description}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(txn.createdAt).toLocaleString("en-IN", {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                })}
                                                {txn.orderId && ` • Order #${txn.orderId}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className={`text-base font-black ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
                                            {isCredit ? "+" : "-"}₹{txn.amount.toFixed(2)}
                                        </p>
                                        <p className="text-[11px] text-gray-400">
                                            Balance: ₹{txn.balanceAfter.toFixed(2)}
                                        </p>
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
