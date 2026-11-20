import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { api } from "../utils/apiClient";
import ThankYou from "./ThankYou";

/**
 * Safely parses URL search parameters from payment returns.
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
        status: get("status"),
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
    const rawOrderId = parsedParams.orderId || routeOrderId || null;

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

    const clearCart = () => {
        try {
            localStorage.removeItem("cart");
            window.dispatchEvent(new Event("storage"));
        } catch {
            // ignore storage errors
        }
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
                clearCart();
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
        fetchCashfreeVerifiedStatus(0);
    }, [rawOrderId, refreshCount]);

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
                        Communicating with Cashfree secure gateway...
                    </p>
                </div>
            </div>
        );
    }

    return <ThankYou orderFromStatus={orderData} onRefreshStatus={handleRefreshStatus} />;
}
