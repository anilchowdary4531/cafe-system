import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import PaymentSuccessScreen from "../../components/PaymentSuccessScreen";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

export default function PaymentSuccess() {
    const location = useLocation();
    const [params] = useSearchParams();

    const data = useMemo(() => {
        const state = location.state || {};
        const orderId = params.get("orderId") || state.orderId || "";
        const amount = params.get("amount") || state.amount || "";
        const orderStatus = params.get("orderStatus") || state.orderStatus || "PLACED";
        return {
            orderId: String(orderId || "").trim(),
            amount: toInr(amount),
            orderStatus: String(orderStatus || "PLACED").toUpperCase(),
        };
    }, [location.state, params]);

    return (
        <PaymentSuccessScreen
            orderId={data.orderId}
            total={data.amount}
            orderStatus={data.orderStatus}
            redirectTo="/admin/new-order"
            redirectAfterMs={60_000}
            showTracking
        />
    );
}
