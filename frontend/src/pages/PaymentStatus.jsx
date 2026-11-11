import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { api } from "../utils/apiClient";
import ThankYou from "./ThankYou";

/**
 * Safely parses URL search parameters, including defensive handling if an external
 * payment gateway appended `?order_ref=...` to a return URL that already had `?`.
 */
export const parsePaymentReturnParams = (searchStr = "") => {
    const normalizedSearch = String(searchStr || "").replace(/^\?/, "").replace(/\?/g, "&");
    const params = new URLSearchParams(normalizedSearch);

    const get = (k) => {
        const val = params.get(k);
        return val !== null ? val.trim() : null;
    };

    return {
        provider: get("provider"),
        orderId: get("order_id") || get("orderId") || get("id"),
        orderRef: get("order_ref") || get("orderRef"),
        status: get("status"),
        amountPaise: get("amount_paise") || get("amountPaise"),
        txn: get("txn"),
        signature: get("signature"),
    };
};

export default function PaymentStatus() {
    const [searchParams] = useSearchParams();
    const { orderId: routeOrderId } = useParams();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [orderData, setOrderData] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const pollTimerRef = useRef(null);
    const mountedRef = useRef(true);

    const parsedParams = parsePaymentReturnParams(location?.search || `?${searchParams.toString()}`);

    let storedTwmPending = null;
    try {
        const rawStored = sessionStorage.getItem("tiffzy:pending_twm_payment");
        if (rawStored) storedTwmPending = JSON.parse(rawStored);
    } catch {
        // ignore storage errors
    }

    const rawOrderId = parsedParams.orderId || routeOrderId || storedTwmPending?.orderId || null;
    const rawOrderRef = parsedParams.orderRef || null;
    const isTwmFlow = Boolean(
        rawOrderRef ||
        parsedParams.signature ||
        String(parsedParams.provider || "").toLowerCase() === "twm_pay" ||
        (storedTwmPending?.orderRef && (!parsedParams.orderId || parsedParams.orderId === storedTwmPending.orderId))
    );

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, []);

    const clearCartAndPending = () => {
        try {
            localStorage.removeItem("cart");
            sessionStorage.removeItem("tiffzy:pending_twm_payment");
            window.dispatchEvent(new Event("storage"));
        } catch {
            // ignore storage errors
        }
    };

    const pollTwmStatus = async (identifier, pollAttempt = 0) => {
        if (!mountedRef.current || !identifier) {
            if (mountedRef.current) setLoading(false);
            return;
        }

        try {
            const statusRes = await api.get(`/api/payments/twm/status/${encodeURIComponent(identifier)}`);
            const data = statusRes?.data || {};
            if (!mountedRef.current) return;

            setOrderData(data);

            if (data.paymentStatus === "PAID" || data.status === "SUCCESS") {
                clearCartAndPending();
                setLoading(false);
                return;
            }

            if ((data.paymentStatus === "PENDING" || data.status === "PENDING") && pollAttempt < 12) {
                setLoading(false);
                pollTimerRef.current = setTimeout(() => {
                    pollTwmStatus(identifier, pollAttempt + 1);
                }, 3000);
                return;
            }
        } catch (err) {
            if (!mountedRef.current) return;
            const errData = err?.response?.data;
            setOrderData((prev) => ({
                ...(prev || {}),
                verified: false,
                provider: "TWM_PAY",
                status: errData?.status || "UNKNOWN",
                paymentStatus: errData?.paymentStatus || "UNKNOWN",
                reason: errData?.message || "Payment verification failed or status could not be confirmed",
                orderId: rawOrderId || rawOrderRef,
            }));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    const verifyTwmReturn = async () => {
        const orderRefToUse = rawOrderRef || storedTwmPending?.orderRef || null;
        const identifier = rawOrderId || orderRefToUse;

        if (!orderRefToUse && !identifier) {
            setLoading(false);
            return;
        }

        // If gateway return query params include signature/status/order_ref, verify signature on backend first
        if (rawOrderRef && parsedParams.signature) {
            try {
                const verifyRes = await api.post("/api/payments/twm/return", {
                    order_ref: rawOrderRef,
                    status: parsedParams.status,
                    amount_paise: parsedParams.amountPaise,
                    txn: parsedParams.txn ?? "",
                    signature: parsedParams.signature,
                    orderId: rawOrderId || undefined,
                });
                const data = verifyRes?.data || {};
                if (!mountedRef.current) return;

                setOrderData(data);
                if (data.paymentStatus === "PAID" || data.status === "SUCCESS") {
                    clearCartAndPending();
                    setLoading(false);
                    return;
                }

                // For pending / utr_submitted states, begin automatic background reconciliation polling
                if (data.paymentStatus === "PENDING" || data.status === "PENDING") {
                    setLoading(false);
                    const nextIdentifier = data.orderId || rawOrderRef;
                    pollTimerRef.current = setTimeout(() => {
                        pollTwmStatus(nextIdentifier, 0);
                    }, 3000);
                    return;
                }
                setLoading(false);
                return;
            } catch (err) {
                if (!mountedRef.current) return;
                const errData = err?.response?.data;
                setOrderData({
                    verified: false,
                    provider: "TWM_PAY",
                    status: errData?.status || "FAILED",
                    paymentStatus: errData?.paymentStatus || "FAILED",
                    reason: errData?.message || "Payment signature or amount verification failed",
                    orderId: rawOrderId || rawOrderRef,
                    orderRef: rawOrderRef,
                });
                setLoading(false);
                return;
            }
        }

        // Otherwise reconcile status directly with backend via TWM order-status API
        await pollTwmStatus(identifier, 0);
    };

    const fetchCashfreeVerifiedStatus = async (pollAttempt = 0) => {
        if (!rawOrderId) {
            setLoading(false);
            return;
        }

        try {
            // Server-side Cashfree API verification - NEVER send frontend status claims
            const verifyRes = await api.get(`/api/payments/cashfree/status/${rawOrderId}`);
            const data = verifyRes?.data || {};
            if (!mountedRef.current) return;

            setOrderData(data);

            if (data.status === "SUCCESS" || data.paymentStatus === "PAID") {
                clearCartAndPending();
                setLoading(false);
                return;
            }

            // Limited polling for PENDING status (max 5 attempts with 3s delay = 15s total)
            if (data.status === "PENDING" && pollAttempt < 5) {
                pollTimerRef.current = setTimeout(() => {
                    fetchCashfreeVerifiedStatus(pollAttempt + 1);
                }, 3000);
                return;
            }
        } catch (err) {
            if (!mountedRef.current) return;
            console.warn("[PaymentStatus] Server-side verification notice:", err.message);
            setOrderData((prev) => ({
                ...(prev || {}),
                verified: false,
                status: "UNKNOWN",
                paymentStatus: "UNKNOWN",
                reason: "Payment status could not be verified due to a network or server error",
                orderId: rawOrderId,
            }));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        setLoading(true);
        if (isTwmFlow) {
            verifyTwmReturn();
        } else {
            fetchCashfreeVerifiedStatus(0);
        }
    }, [rawOrderId, rawOrderRef, parsedParams.signature, refreshCount]);

    const handleRefreshStatus = () => {
        setLoading(true);
        setRefreshCount((prev) => prev + 1);
    };

    if (loading) {
        return (
            <div className="theme-page flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4 py-16">
                <LoaderCircle size={44} className="animate-spin text-emerald-400" />
                <div>
                    <h2 className="text-xl font-bold">Verifying Payment Status</h2>
                    <p className="theme-muted mt-1 text-sm">
                        {isTwmFlow
                            ? "Verifying secure payment response with TWM Pay..."
                            : "Communicating with Cashfree secure gateway..."}
                    </p>
                </div>
            </div>
        );
    }

    return <ThankYou orderFromStatus={orderData} onRefreshStatus={handleRefreshStatus} />;
}
