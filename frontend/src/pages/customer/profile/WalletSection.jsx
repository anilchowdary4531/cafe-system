import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Clock,
} from "lucide-react";
import { api } from "../../../utils/apiClient";

const WALLET_TWM_PENDING_KEY = "tiffzy_pending_twm_wallet_topup";

const readPendingTwmWalletTopup = () => {
    try {
        const raw = sessionStorage.getItem(WALLET_TWM_PENDING_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const clearPendingTwmWalletTopup = () => {
    try {
        sessionStorage.removeItem(WALLET_TWM_PENDING_KEY);
    } catch {
        // Ignore storage errors
    }
};

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

export default function WalletSection({ customerToken, redirectToCheckout = null }) {
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
    const [pendingMsg, setPendingMsg] = useState("");
    const [pendingTwmTopupTxnId, setPendingTwmTopupTxnId] = useState("");
    const [selectedProvider, setSelectedProvider] = useState("CASHFREE");
    const [providerAvailability, setProviderAvailability] = useState({
        twmPayConfigured: false,
        cashfreeConfigured: true,
        loaded: false,
    });
    const pollTimerRef = useRef(null);

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

    // Poll TWM Pay top-up status when UTR_SUBMITTED / CREATED
    const reconcileTwmWalletTopup = useCallback(
        async ({ topupTxnId, orderRef, attempt = 0 }) => {
            if (!topupTxnId && !orderRef) return;
            const config = getAuthConfig();
            const targetTxnId = encodeURIComponent(topupTxnId || orderRef);
            const res = await api.get(
                `/api/wallet/topup/twm/status/${targetTxnId}${orderRef ? `?order_ref=${encodeURIComponent(orderRef)}` : ""}`,
                config
            );
            const data = res?.data || res;
            const gatewayStatus = String(data?.gatewayStatus || "").toUpperCase();
            const paymentStatus = String(data?.paymentStatus || data?.status || "").toUpperCase();

            if (paymentStatus === "PAID" || paymentStatus === "SUCCESS" || gatewayStatus === "PAID") {
                clearPendingTwmWalletTopup();
                setPendingTwmTopupTxnId("");
                setPendingMsg("");
                setError("");
                setSuccessMsg(`Success! ${data?.message || "Wallet top-up verified via TWM Pay."}`);
                await Promise.allSettled([fetchWallet(), fetchAnalytics(selectedPeriod), fetchTransactions(1, activeFilter)]);
                return;
            }

            if (paymentStatus === "FAILED" || gatewayStatus === "REJECTED" || gatewayStatus === "EXPIRED") {
                clearPendingTwmWalletTopup();
                setPendingTwmTopupTxnId("");
                setPendingMsg("");
                setError(
                    data?.message ||
                        (gatewayStatus === "EXPIRED"
                            ? "Top-up payment session expired. Please try again."
                            : "Top-up payment was rejected. Please try again.")
                );
                return;
            }

            const activeRef = data?.topupTxnId || topupTxnId || orderRef;
            setPendingTwmTopupTxnId(activeRef);
            setPendingMsg(
                gatewayStatus === "UTR_SUBMITTED"
                    ? "UTR submitted — verifying your UPI transfer with TWM Pay..."
                    : "Payment pending confirmation from TWM Pay."
            );

            if (attempt < 3) {
                pollTimerRef.current = window.setTimeout(() => {
                    reconcileTwmWalletTopup({ topupTxnId: activeRef, orderRef: data?.orderRef || orderRef, attempt: attempt + 1 }).catch(
                        () => {}
                    );
                }, 4000);
            }
        },
        [activeFilter, fetchAnalytics, fetchTransactions, fetchWallet, getAuthConfig, selectedPeriod]
    );

    // Fetch provider availability & run Initial Load + Cashfree / TWM Pay Redirect Verification
    useEffect(() => {
        let cancelled = false;

        const checkRedirectAndInitialize = async () => {
            setLoading(true);

            // Load provider availability (non-blocking)
            const providersPromise = api?.get?.("/api/payments/providers");
            if (providersPromise && typeof providersPromise.then === "function") {
                providersPromise
                    .then((res) => {
                        if (cancelled || !res?.data) return;
                        const data = res.data;
                        const twmConfigured = Boolean(data.twmPay?.configured);
                        const cfConfigured = Boolean(data.cashfree?.configured);
                        setProviderAvailability({
                            twmPayConfigured: twmConfigured,
                            cashfreeConfigured: cfConfigured,
                            loaded: true,
                        });
                        if (twmConfigured && !cfConfigured) {
                            setSelectedProvider("TWM_PAY");
                        } else if (!twmConfigured && cfConfigured) {
                            setSelectedProvider("CASHFREE");
                        } else if (data.defaultProvider === "TWM_PAY" || data.defaultProvider === "CASHFREE") {
                            setSelectedProvider(data.defaultProvider);
                        }
                    })
                    .catch(() => {});
            }

            const redirectOrderId = searchParams.get("order_id") || searchParams.get("topup_id");
            const twmOrderRef = searchParams.get("order_ref") || "";
            const twmStatus = searchParams.get("status") || "";
            const twmAmountPaise = searchParams.get("amount_paise") || "";
            const twmTxn = searchParams.get("txn") || "";
            const twmSignature = searchParams.get("signature") || "";
            const pendingTwm = readPendingTwmWalletTopup();

            const hasTwmReturnParams = Boolean(twmOrderRef || twmSignature || twmStatus || twmAmountPaise);
            const hasPendingTwm = Boolean(pendingTwm?.topupTxnId && !redirectOrderId);

            if (hasTwmReturnParams || hasPendingTwm) {
                try {
                    const config = getAuthConfig();
                    let vData;
                    if (hasTwmReturnParams) {
                        const verifyRes = await api.post(
                            "/api/wallet/topup/twm/return",
                            {
                                topupTxnId: twmOrderRef || pendingTwm?.topupTxnId || "",
                                order_ref: twmOrderRef || pendingTwm?.orderRef || "",
                                status: twmStatus,
                                amount_paise: twmAmountPaise,
                                txn: twmTxn,
                                signature: twmSignature,
                            },
                            config
                        );
                        vData = verifyRes?.data || verifyRes;
                    } else {
                        const statusRes = await api.get(
                            `/api/wallet/topup/twm/status/${encodeURIComponent(pendingTwm.topupTxnId)}`,
                            config
                        );
                        vData = statusRes?.data || statusRes;
                    }

                    const paymentStatus = String(vData?.paymentStatus || vData?.status || "").toUpperCase();
                    const gatewayStatus = String(vData?.gatewayStatus || "").toUpperCase();
                    if (paymentStatus === "PAID" || paymentStatus === "SUCCESS" || gatewayStatus === "PAID") {
                        clearPendingTwmWalletTopup();
                        setPendingMsg("");
                        setSuccessMsg(`Success! ${vData?.message || "Payment verified and credited to your wallet."}`);
                    } else if (paymentStatus === "FAILED" || gatewayStatus === "REJECTED" || gatewayStatus === "EXPIRED") {
                        clearPendingTwmWalletTopup();
                        setPendingMsg("");
                        setError(
                            vData?.message ||
                                (gatewayStatus === "EXPIRED"
                                    ? "Top-up payment session expired. Please try again."
                                    : "Top-up payment was rejected. Please try again.")
                        );
                    } else if (paymentStatus === "PENDING" || gatewayStatus === "UTR_SUBMITTED" || gatewayStatus === "CREATED") {
                        const activeRef = vData?.topupTxnId || twmOrderRef || pendingTwm?.topupTxnId;
                        setPendingTwmTopupTxnId(activeRef);
                        setPendingMsg(
                            gatewayStatus === "UTR_SUBMITTED"
                                ? "UTR submitted — verifying your UPI transfer with TWM Pay..."
                                : "Payment pending confirmation from TWM Pay."
                        );
                        pollTimerRef.current = window.setTimeout(() => {
                            reconcileTwmWalletTopup({ topupTxnId: activeRef, orderRef: twmOrderRef, attempt: 1 }).catch(() => {});
                        }, 4000);
                    }
                } catch (err) {
                    console.error("[WalletSection] TWM redirect verify error:", err);
                    setError(err.response?.data?.message || err.message || "Could not verify TWM Pay top-up status");
                } finally {
                    if (hasTwmReturnParams) {
                        const newParams = new URLSearchParams(searchParams);
                        ["order_ref", "status", "amount_paise", "txn", "signature", "topup_id", "order_id"].forEach((k) =>
                            newParams.delete(k)
                        );
                        setSearchParams(newParams, { replace: true });
                    }
                }
            } else if (redirectOrderId && redirectOrderId.startsWith("TOPUP_")) {
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
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        checkRedirectAndInitialize();
        return () => {
            cancelled = true;
            if (pollTimerRef.current) {
                window.clearTimeout(pollTimerRef.current);
            }
        };
    }, []);

    // Add Money Flow (TWM Pay Redirect + Working Cashfree Drop-in / SDK)
    const handleAddMoney = async (amountToAdd, providerOverride = null) => {
        const amt = Number(amountToAdd);
        if (Number.isNaN(amt) || amt < 10) {
            setError("Minimum top-up amount is ₹10");
            return;
        }

        const activeProvider = String(providerOverride || selectedProvider || "CASHFREE").toUpperCase();

        try {
            setTopupLoading(true);
            setError("");
            setSuccessMsg("");
            setPendingMsg("");

            const config = getAuthConfig();
            const isTwm = activeProvider === "TWM_PAY";
            const returnUrl = isTwm
                ? `${window.location.origin}/profile/wallet`
                : `${window.location.origin}/profile/wallet?order_id={order_id}`;

            // Step 1: Create top-up session
            const res = await api.post(
                "/api/wallet/topup/create",
                {
                    amount: amt,
                    provider: activeProvider,
                    returnUrl,
                },
                config
            );

            const data = res?.data || res;
            const session = data?.session || data;

            if (isTwm || String(session?.provider || session?.gateway || data?.provider || "").toUpperCase() === "TWM_PAY") {
                const topupTxnId = session?.topupTxnId || data?.topupTxnId;
                const checkoutUrl =
                    session?.checkoutUrl ||
                    session?.checkout_url ||
                    session?.paymentUrl ||
                    data?.checkoutUrl ||
                    data?.checkout_url;
                if (!topupTxnId || !checkoutUrl) {
                    throw new Error("TWM Pay did not return a checkout URL");
                }
                try {
                    sessionStorage.setItem(
                        WALLET_TWM_PENDING_KEY,
                        JSON.stringify({
                            topupTxnId,
                            orderRef: session?.orderRef || data?.orderRef || topupTxnId,
                            amount: amt,
                        })
                    );
                } catch {
                    // Ignore storage error
                }
                const doRedirect =
                    typeof redirectToCheckout === "function"
                        ? redirectToCheckout
                        : (url) => window.location.assign(url);
                doRedirect(checkoutUrl);
                return;
            }

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
        <div className="w-full space-y-3.5 font-sans text-sm text-[color:var(--app-text)] pb-6">
            {/* SUBHEADER: CONSOLE TITLE & REFRESH ACTION */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-[color:var(--app-border)]/30">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--app-text)]">
                            Tiffzy Wallet
                        </h1>
                        <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--app-primary)] border border-orange-500/20">
                            CUSTOMER CONSOLE
                        </span>
                    </div>
                    <p className="theme-muted text-xs mt-0.5">
                        Manage your wallet balance and transactions
                    </p>
                </div>

                {/* Refresh Action */}
                <button
                    type="button"
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer"
                    title="Refresh Wallet & Analytics"
                >
                    <RefreshCw size={12} className={refreshing ? "animate-spin text-[var(--app-primary)]" : ""} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Error & Success Messages */}
            {error && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-bold text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-white transition-colors cursor-pointer"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {pendingMsg && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                        <Clock size={15} className="shrink-0" />
                        <span>{pendingMsg}</span>
                    </div>
                    {pendingTwmTopupTxnId && (
                        <button
                            type="button"
                            onClick={() => reconcileTwmWalletTopup({ topupTxnId: pendingTwmTopupTxnId })}
                            className="font-bold text-amber-800 hover:underline dark:text-amber-200 cursor-pointer shrink-0"
                        >
                            Check Status
                        </button>
                    )}
                </div>
            )}

            {successMsg && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSuccessMsg("")}
                        className="font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-white transition-colors cursor-pointer"
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
                selectedProvider={selectedProvider}
                onProviderChange={setSelectedProvider}
                providerAvailability={providerAvailability}
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
