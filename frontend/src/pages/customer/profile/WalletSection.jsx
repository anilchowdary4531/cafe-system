import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Info,
} from "lucide-react";
import { api } from "../../../utils/apiClient";

// Modular Subcomponents
import WalletBalanceHero from "./wallet/WalletBalanceHero";
import WalletAnalyticsRow from "./wallet/WalletAnalyticsRow";
import WalletActivityChart from "./wallet/WalletActivityChart";
import WalletTransactionTable from "./wallet/WalletTransactionTable";
import WalletTransactionDetailModal from "./wallet/WalletTransactionDetailModal";

const loadCashfreeSdk = () => {
    return new Promise((resolve) => {
        if (typeof window !== "undefined" && typeof window.Cashfree === "function") {
            resolve(window.Cashfree);
            return;
        }
        const existingScript = document.getElementById("cashfree-js-sdk");
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.Cashfree));
            return;
        }
        const script = document.createElement("script");
        script.id = "cashfree-js-sdk";
        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        script.onload = () => resolve(window.Cashfree);
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
};

export default function WalletSection({ customerToken }) {
    const [searchParams, setSearchParams] = useSearchParams();

    // Data States
    const [wallet, setWallet] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState("30d");
    const [transactions, setTransactions] = useState([]);
    const [activeFilter, setActiveFilter] = useState("");
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
    });
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Loading & Status States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [transactionsLoading, setTransactionsLoading] = useState(false);
    const [topupLoading, setTopupLoading] = useState(false);

    // Message & Error States
    const [error, setError] = useState("");
    const [analyticsError, setAnalyticsError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const getAuthConfig = useCallback(() => {
        const token = customerToken || localStorage.getItem("customerToken");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }, [customerToken]);

    // Fetch Authoritative Wallet Data
    const fetchWallet = useCallback(async () => {
        try {
            const config = getAuthConfig();
            const res = await api.get("/api/wallet", config);
            const data = res?.data || res;
            setWallet(data?.wallet || null);
            return data?.wallet || null;
        } catch (err) {
            console.error("[WalletSection] fetchWallet error:", err);
            setError(err.response?.data?.message || "Failed to load wallet balance");
            return null;
        }
    }, [getAuthConfig]);

    // Fetch Wallet Analytics (Period-Scoped)
    const fetchAnalytics = useCallback(async (periodToFetch = selectedPeriod) => {
        try {
            setAnalyticsLoading(true);
            setAnalyticsError("");
            const config = getAuthConfig();
            const res = await api.get(`/api/wallet/analytics?period=${periodToFetch}`, config);
            const data = res?.data || res;
            if (data?.data) {
                setAnalytics(data.data);
            } else if (data?.summary) {
                setAnalytics(data);
            }
        } catch (err) {
            console.warn("[WalletSection] fetchAnalytics non-blocking warning:", err);
            // Non-blocking: Do not block wallet balance or add money if analytics fails
            setAnalyticsError(err.response?.data?.message || "Analytics data is temporarily unavailable");
        } finally {
            setAnalyticsLoading(false);
        }
    }, [getAuthConfig, selectedPeriod]);

    // Fetch Wallet Transactions (Paged & Filtered)
    const fetchTransactions = useCallback(async (targetPage = 1, typeFilter = activeFilter) => {
        try {
            setTransactionsLoading(true);
            const config = getAuthConfig();
            const queryParams = new URLSearchParams({
                page: String(targetPage),
                limit: "10",
            });
            if (typeFilter) {
                queryParams.append("type", typeFilter);
            }

            const res = await api.get(`/api/wallet/transactions?${queryParams.toString()}`, config);
            const data = res?.data || res;

            setTransactions(data?.transactions || []);
            setPagination({
                page: data?.page || targetPage,
                limit: data?.limit || 10,
                total: data?.total || 0,
                totalPages: data?.totalPages || 1,
            });
        } catch (err) {
            console.error("[WalletSection] fetchTransactions error:", err);
        } finally {
            setTransactionsLoading(false);
        }
    }, [getAuthConfig, activeFilter]);

    // Unified Refresh Handler
    const handleRefreshAll = async () => {
        setRefreshing(true);
        setError("");
        try {
            await Promise.allSettled([
                fetchWallet(),
                fetchAnalytics(selectedPeriod),
                fetchTransactions(pagination.page, activeFilter),
            ]);
        } finally {
            setRefreshing(false);
        }
    };

    // Period Change Handler
    const handlePeriodChange = (newPeriod) => {
        setSelectedPeriod(newPeriod);
        fetchAnalytics(newPeriod);
    };

    // Filter Change Handler
    const handleFilterChange = (newFilter) => {
        setActiveFilter(newFilter);
        fetchTransactions(1, newFilter);
    };

    // Page Change Handler
    const handlePageChange = (newPage) => {
        fetchTransactions(newPage, activeFilter);
    };

    // Initial Load & Cashfree Redirect Verification
    useEffect(() => {
        const checkRedirectAndInitialize = async () => {
            setLoading(true);
            const redirectOrderId = searchParams.get("order_id") || searchParams.get("topup_id");

            if (redirectOrderId && redirectOrderId.startsWith("TOPUP_")) {
                try {
                    const config = getAuthConfig();
                    const verifyRes = await api.post(
                        "/api/wallet/topup/verify",
                        {
                            topupTxnId: redirectOrderId,
                            gatewayOrderId: redirectOrderId,
                            gatewayPaymentId: `PAY_REDIRECT_${Date.now()}`,
                        },
                        config
                    );
                    const vData = verifyRes?.data || verifyRes;
                    if (vData?.success) {
                        setSuccessMsg(`Success! ${vData.message || "Payment verified and credited to your wallet."}`);
                    }
                } catch (err) {
                    console.error("[WalletSection] Redirect verify error:", err);
                } finally {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete("order_id");
                    newParams.delete("topup_id");
                    setSearchParams(newParams, { replace: true });
                }
            }

            try {
                await Promise.allSettled([
                    fetchWallet(),
                    fetchAnalytics(selectedPeriod),
                    fetchTransactions(1, activeFilter),
                ]);
            } finally {
                setLoading(false);
            }
        };

        checkRedirectAndInitialize();
    }, []);

    // Add Money Flow (Preserving Complete Working Cashfree Drop-in / SDK)
    const handleAddMoney = async (amountToAdd) => {
        const amt = Number(amountToAdd);
        if (Number.isNaN(amt) || amt < 10) {
            setError("Minimum top-up amount is ₹10");
            return;
        }

        try {
            setTopupLoading(true);
            setError("");
            setSuccessMsg("");

            const config = getAuthConfig();
            const returnUrl = `${window.location.origin}/profile/wallet?order_id={order_id}`;

            // Step 1: Create top-up session
            const res = await api.post(
                "/api/wallet/topup/create",
                {
                    amount: amt,
                    returnUrl,
                },
                config
            );

            const data = res?.data || res;
            const session = data?.session || data;

            const sessionId =
                session?.paymentSessionId ||
                session?.payment_session_id ||
                data?.paymentSessionId ||
                data?.payment_session_id;
            const topupTxnId = session?.topupTxnId || data?.topupTxnId;

            if (!session || !topupTxnId) {
                throw new Error("Invalid top-up session generated");
            }

            // Step 2: Open Cashfree Drop-in / SDK Checkout
            const CashfreeSdk = await loadCashfreeSdk();
            if (CashfreeSdk && sessionId) {
                const isProdSession =
                    session.isProduction !== undefined
                        ? Boolean(session.isProduction)
                        : session.is_production !== undefined
                        ? Boolean(session.is_production)
                        : String(session.cfEnv || session.cf_env || "").toUpperCase() === "PRODUCTION";

                const envSetting = (import.meta.env.VITE_CASHFREE_ENV || "").toUpperCase();
                const isProdHostname =
                    typeof window !== "undefined" && window.location.hostname.includes("tiffzy.com");
                const mode =
                    isProdSession || envSetting === "PRODUCTION" || (isProdHostname && envSetting !== "TEST")
                        ? "production"
                        : "sandbox";

                const cashfree = CashfreeSdk({ mode });
                const cfResult = await cashfree.checkout({
                    paymentSessionId: sessionId,
                });

                if (cfResult?.error) {
                    setError(cfResult.error.message || "Payment cancelled or failed. Please try again.");
                    return;
                }

                if (cfResult?.redirect) {
                    return;
                }

                // Modal completed: verify on backend
                const gatewayOrderId =
                    session.gatewayOrderId || session.cfOrderId || session.cf_order_id || topupTxnId;
                const verifyRes = await api.post(
                    "/api/wallet/topup/verify",
                    {
                        topupTxnId,
                        gatewayOrderId,
                        gatewayPaymentId: `PAY_CF_${Date.now()}`,
                    },
                    config
                );

                const vData = verifyRes?.data || verifyRes;
                if (vData?.success) {
                    setSuccessMsg(`Success! ₹${amt.toLocaleString("en-IN")} added to your Tiffzy Wallet.`);
                    await handleRefreshAll();
                } else {
                    throw new Error(vData?.message || "Payment verification failed");
                }
            } else {
                // Fallback verification when SDK is not loaded
                const verifyRes = await api.post(
                    "/api/wallet/topup/verify",
                    {
                        topupTxnId,
                        gatewayOrderId: session.gatewayOrderId || session.cfOrderId || topupTxnId,
                        gatewayPaymentId: `PAY_${Date.now()}`,
                    },
                    config
                );

                const vData = verifyRes?.data || verifyRes;
                if (vData?.success) {
                    setSuccessMsg(`Success! ₹${amt.toLocaleString("en-IN")} added to your Tiffzy Wallet.`);
                    await handleRefreshAll();
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
        <div className="space-y-6 pb-12 animate-fadeIn">
            {/* SECTION 1: WALLET HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight md:text-[2rem] text-white">
                        Tiffzy Wallet
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-stone-400">
                        Manage your wallet balance and transactions
                    </p>
                </div>

                {/* Refresh Action */}
                <button
                    type="button"
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    className="theme-soft-button min-h-[44px] px-4 py-2 rounded-2xl text-stone-200 hover:text-white transition-all flex items-center gap-2 border border-white/10 hover:border-white/20 font-semibold text-xs sm:text-sm shadow-sm self-start sm:self-auto"
                    title="Refresh Wallet & Analytics"
                >
                    <RefreshCw size={16} className={refreshing ? "animate-spin text-amber-400" : ""} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Error & Success Messages */}
            {error && (
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-300 text-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="text-rose-400 hover:text-rose-200 text-xs font-bold"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {successMsg && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-300 text-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSuccessMsg("")}
                        className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* 1 & 2: HERO AREA (Balance Card + Add Money Card side-by-side) */}
            <WalletBalanceHero
                wallet={wallet}
                loadingWallet={loading}
                onAddMoney={handleAddMoney}
                topupLoading={topupLoading}
            />

            {/* 3: WALLET BALANCE & ACTIVITY GRAPH (Full width, 6 periods, Recharts AreaChart) */}
            <WalletActivityChart
                trend={analytics?.trend || []}
                selectedPeriod={selectedPeriod}
                onPeriodChange={handlePeriodChange}
                loading={analyticsLoading}
                error={analyticsError}
                onRetry={() => fetchAnalytics(selectedPeriod)}
            />

            {/* 4: RECENT WALLET ACTIVITY (Wide desktop table, mobile responsive cards) */}
            <WalletTransactionTable
                transactions={transactions}
                total={pagination.total}
                page={pagination.page}
                totalPages={pagination.totalPages}
                limit={pagination.limit}
                loading={transactionsLoading}
                activeType={activeFilter}
                onTypeChange={handleFilterChange}
                onPageChange={handlePageChange}
                onSelectTransaction={(txn) => setSelectedTransaction(txn)}
            />

            {/* 5: COMPACT WALLET SUMMARY (Total Added, Food Spend, Total Transactions) */}
            <WalletAnalyticsRow
                summary={analytics?.summary}
                loading={loading || analyticsLoading}
            />

            {/* SECTION 7: TRANSACTION DETAILS MODAL */}
            {selectedTransaction && (
                <WalletTransactionDetailModal
                    transaction={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                />
            )}
        </div>
    );
}
