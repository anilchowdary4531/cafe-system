import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { api } from "../utils/apiClient";
import ThankYou from "./ThankYou";

export default function PaymentStatus() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [orderData, setOrderData] = useState(null);

    const rawOrderId = searchParams.get("order_id") || searchParams.get("orderId") || searchParams.get("id");

    useEffect(() => {
        let isMounted = true;

        async function verifyAndLoadOrder() {
            if (!rawOrderId) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                // 1. Verify Cashfree payment with backend & receive verified order details
                const verifyRes = await api.post("/api/payments/verify", {
                    orderId: rawOrderId,
                    status: "SUCCESS",
                    paymentMode: "ONLINE",
                });

                if (isMounted && verifyRes.data) {
                    setOrderData(verifyRes.data);
                }
            } catch (err) {
                console.warn("[PaymentStatus] Verification notice:", err.message);
            }

            try {
                // 2. Fetch order status details from backend if not already set
                const statusRes = await api.get(`/api/payments/status/${rawOrderId}`);
                if (isMounted && statusRes.data) {
                    setOrderData((prev) => ({ ...prev, ...statusRes.data }));
                }
            } catch (err) {
                console.warn("[PaymentStatus] Status check notice:", err.message);
            } finally {
                if (isMounted) {
                    try {
                        localStorage.removeItem("cart");
                        window.dispatchEvent(new Event("storage"));
                    } catch {}
                    setLoading(false);
                }
            }
        }

        verifyAndLoadOrder();

        return () => {
            isMounted = false;
        };
    }, [rawOrderId]);

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

    return <ThankYou orderFromStatus={orderData} />;
}
