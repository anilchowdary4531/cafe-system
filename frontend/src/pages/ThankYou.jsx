import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, RotateCcw, XCircle } from "lucide-react";
import { useRestaurantContext } from "../context/RestaurantContext";
import OrderTrackingTimeline from "../components/OrderTrackingTimeline";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

const DELIVERY_TRACKING_STEPS = [
    { key: "PLACED", label: "Placed", hint: "Order received" },
    { key: "PREPARING", label: "Preparing", hint: "Kitchen is working on it" },
    { key: "READY", label: "Ready", hint: "Out for delivery" },
    { key: "DELIVERED", label: "Delivered", hint: "Order delivered" },
];

const PICKUP_TRACKING_STEPS = [
    { key: "PLACED", label: "Placed", hint: "Order received" },
    { key: "PREPARING", label: "Preparing", hint: "Kitchen is working on it" },
    { key: "READY", label: "Ready", hint: "Ready for pickup" },
    { key: "PICKED_UP", label: "Picked Up", hint: "Collected by customer" },
];

export default function ThankYou({ orderFromStatus = null }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();

    const state = location.state || {};
    const merged = { ...state, ...(orderFromStatus || {}) };

    const slug = String(merged?.slug || searchParams.get("slug") || "").trim();
    const orderNo = String(merged?.orderNo || searchParams.get("orderNo") || "").trim();
    const orderId = String(merged?.orderId || searchParams.get("orderId") || searchParams.get("order_id") || "").trim();
    const amount = String(merged?.amount !== undefined && merged?.amount !== null ? merged.amount : searchParams.get("amount") || "").trim();
    const orderStatus = String(merged?.orderStatus || merged?.status || searchParams.get("orderStatus") || searchParams.get("status") || "PLACED").trim();
    const fulfillment = String(merged?.fulfillment || searchParams.get("fulfillment") || "").trim().toLowerCase();

    const paymentModeRaw = String(merged?.paymentMethod || merged?.paymentMode || searchParams.get("paymentMode") || "ONLINE").trim().toUpperCase();
    const isOnlinePayment = paymentModeRaw.includes("ONLINE") || paymentModeRaw.includes("UPI") || paymentModeRaw.includes("CASHFREE") || paymentModeRaw.includes("CARD");
    const paymentModeLabel = isOnlinePayment ? "Online (Cashfree)" : paymentModeRaw === "PAY_LATER" ? "Khata Pay Later" : "Cash on Pickup";

    const paymentStatusRaw = String(
        merged?.paymentStatus ||
        searchParams.get("paymentStatus") ||
        searchParams.get("payment_state") ||
        "SUCCESS"
    )
        .trim()
        .toUpperCase();
    const isPaymentSuccess = paymentStatusRaw === "SUCCESS" || paymentStatusRaw === "PAID";
    const isPickupOrder = fulfillment === "pickup";
    const isDeliveryOrder = fulfillment === "delivery";
    const trackingSteps = isPickupOrder ? PICKUP_TRACKING_STEPS : isDeliveryOrder ? DELIVERY_TRACKING_STEPS : undefined;

    useEffect(() => {
        if (!slug) return;
        // Keep restaurant context aligned so the top-bar dropdown shows the right restaurant.
        setRestaurantContext({ slug });
    }, [setRestaurantContext, slug]);

    useEffect(() => {
        if (!slug || !isPaymentSuccess) return;
        const id = window.setTimeout(() => {
            navigate(buildRestaurantMenuPath(slug, restaurantContext?.tableNo), { replace: true });
        }, 60_000);
        return () => window.clearTimeout(id);
    }, [isPaymentSuccess, navigate, restaurantContext?.tableNo, slug]);

    const headline = useMemo(() => (isPaymentSuccess ? "Payment Successful" : "Payment Failed"), [isPaymentSuccess]);

    return (
        <div className="theme-page min-h-screen px-4 py-14">
            <div className="mx-auto max-w-3xl">
                <div className="theme-panel overflow-hidden rounded-[32px] p-10 text-center">
                    <div
                        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] ${
                            isPaymentSuccess ? "bg-emerald-500/15" : "bg-rose-500/15"
                        }`}
                    >
                        {isPaymentSuccess ? (
                            <CheckCircle2 size={44} className="text-emerald-300" />
                        ) : (
                            <XCircle size={44} className="text-rose-300" />
                        )}
                    </div>

                    <h1 className="mt-6 text-4xl font-bold">{headline}</h1>
                    <p className="theme-muted mt-3 text-base">
                        {isPaymentSuccess
                            ? `Thanks for ordering. ${slug ? "Returning to the menu in 60s." : "You can continue ordering anytime."}`
                            : "Payment was not completed. You can retry from the restaurant page."}
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order ID</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">
                                {orderNo ? `Order #${orderNo}` : orderId ? `Order #${orderId}` : "-"}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Amount</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">Rs {amount ? toInr(amount) : "0.00"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Payment Mode</p>
                            <p className="mt-2 text-sm font-bold text-amber-300 truncate">
                                {paymentModeLabel}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Payment Status</p>
                            <p className={`mt-2 text-sm font-bold flex items-center gap-1.5 ${isPaymentSuccess ? "text-emerald-400" : "text-rose-400"}`}>
                                <span className={`inline-block h-2 w-2 rounded-full ${isPaymentSuccess ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                                {isPaymentSuccess ? "SUCCESS (PAID)" : "FAILED"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order Tracking</p>
                        <p className="theme-muted mt-1 text-xs">
                            Live status: {orderStatus ? String(orderStatus).toUpperCase() : "PLACED"}
                            {isPickupOrder ? " • Pickup order" : isDeliveryOrder ? " • Delivery order" : ""}
                        </p>
                        <div className="mt-5">
                            <OrderTrackingTimeline
                                status={orderStatus}
                                steps={trackingSteps}
                            />
                        </div>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {slug ? (
                            <Link
                                to={buildRestaurantMenuPath(slug, restaurantContext?.tableNo)}
                                className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold"
                            >
                                <RotateCcw size={18} />
                                {isPaymentSuccess ? "Continue Ordering" : "Try Payment Again"}
                            </Link>
                        ) : (
                            <Link
                                to="/"
                                className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold"
                            >
                                <RotateCcw size={18} />
                                {isPaymentSuccess ? "Choose Restaurant" : "Back To Restaurants"}
                            </Link>
                        )}

                        <Link
                            to="/profile/orders"
                            className="theme-soft-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold"
                        >
                            <ClipboardList size={18} />
                            View Order History
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
