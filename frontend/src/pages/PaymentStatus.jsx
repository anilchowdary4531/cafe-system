import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { api } from "../utils/apiClient";
import ThankYou from "./ThankYou";

export default function PaymentStatus() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [orderData, setOrderData] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);

    const rawOrderId = searchParams.get("order_id") || searchParams.get("orderId") || searchParams.get("id");

    const fetchVerifiedStatus = async (pollAttempt = 0) => {
        if (!rawOrderId) {
            setLoading(false);
            return;
        }

        try {
            // Server-side Cashfree API verification - NEVER send frontend status claims
            const verifyRes = await api.get(`/api/payments/cashfree/status/${rawOrderId}`);
            const data = verifyRes?.data || {};

            setOrderData(data);

            if (data.status === "SUCCESS") {
                try {
                    localStorage.removeItem("cart");
                    window.dispatchEvent(new Event("storage"));
                } catch {}
            }

            // Limited polling for PENDING status (max 5 attempts with 3s delay = 15s total)
            if (data.status === "PENDING" && pollAttempt < 5) {
                setTimeout(() => {
                    fetchVerifiedStatus(pollAttempt + 1);
                }, 3000);
                return;
            }
        } catch (err) {
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
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchVerifiedStatus(0);
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
                    <p className="theme-muted mt-1 text-sm">Communicating with Cashfree secure gateway...</p>
                </div>
            </div>
        );
    }

    return <ThankYou orderFromStatus={orderData} onRefreshStatus={handleRefreshStatus} />;
}
