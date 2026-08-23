import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, Clock, HelpCircle, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { useRestaurantContext } from "../context/RestaurantContext";
import OrderTrackingTimeline from "../components/OrderTrackingTimeline";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import Footer from "../components/Footer";
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

export default function ThankYou({ orderFromStatus = null, onRefreshStatus = null }) {
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

    const statusRaw = String(
        merged?.status ||
        merged?.paymentStatus ||
        searchParams.get("paymentStatus") ||
        searchParams.get("status") ||
        "UNKNOWN"
    )
        .trim()
        .toUpperCase();

    const isSuccess = statusRaw === "SUCCESS" || statusRaw === "PAID";
    const isFailed = statusRaw === "FAILED";
    const isCancelled = statusRaw === "CANCELLED";
    const isPending = statusRaw === "PENDING";
    const isUnknown = !isSuccess && !isFailed && !isCancelled && !isPending;

    const failureReason = merged?.reason || merged?.failureReason || (isCancelled ? "User cancelled payment" : isFailed ? "Payment could not be completed" : null);

    const isPickupOrder = fulfillment === "pickup";
    const isDeliveryOrder = fulfillment === "delivery";
    const trackingSteps = isPickupOrder ? PICKUP_TRACKING_STEPS : isDeliveryOrder ? DELIVERY_TRACKING_STEPS : undefined;

    useEffect(() => {
        if (!slug) return;
        setRestaurantContext({ slug });
    }, [setRestaurantContext, slug]);

    useEffect(() => {
        if (!slug || !isSuccess) return;
        const id = window.setTimeout(() => {
            navigate(buildRestaurantMenuPath(slug, restaurantContext?.tableNo), { replace: true });
        }, 60_000);
        return () => window.clearTimeout(id);
    }, [isSuccess, navigate, restaurantContext?.tableNo, slug]);

    return (
        <div className="theme-page min-h-screen px-4 py-14">
            <div className="mx-auto max-w-3xl">
                <div className="theme-panel overflow-hidden rounded-[32px] p-10 text-center shadow-xl">
                    {/* Header Icon */}
                    <div
                        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] ${
                            isSuccess
                                ? "bg-emerald-500/15 text-emerald-400"
                                : isFailed
                                ? "bg-rose-500/15 text-rose-400"
                                : isCancelled
                                ? "bg-orange-500/15 text-orange-400"
                                : isPending
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-slate-500/15 text-amber-300"
                        }`}
                    >
                        {isSuccess && <CheckCircle2 size={44} />}
                        {isFailed && <XCircle size={44} />}
                        {isCancelled && <AlertTriangle size={44} />}
                        {isPending && <Clock size={44} className="animate-spin" />}
                        {isUnknown && <HelpCircle size={44} />}
                    </div>

                    {/* Headline */}
                    <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                        {isSuccess && "Payment Successful"}
                        {isFailed && "Payment Failed"}
                        {isCancelled && "Payment Cancelled"}
                        {isPending && "Payment Pending"}
                        {isUnknown && "Payment Status Could Not Be Verified"}
                    </h1>

                    {/* Subtitle Description */}
                    <p className="theme-muted mt-3 text-base max-w-xl mx-auto leading-relaxed">
                        {isSuccess && `Thanks for ordering. ${slug ? "Returning to the menu in 60s." : "You can continue ordering anytime."}`}
                        {isFailed && "Your payment could not be completed. If any amount was deducted, it will be refunded within 3-5 business days."}
                        {isCancelled && "You cancelled the payment checkout session. You can try again whenever you are ready."}
                        {isPending && "Your payment is still being processed by Cashfree. Please wait for gateway confirmation."}
                        {isUnknown && "We could not confirm the payment status right now. Please do not make another payment until you check your order status."}
                    </p>

                    {/* Safe Failure Reason Badge */}
                    {failureReason && !isSuccess && (
                        <div className="mt-5 mx-auto max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-center justify-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span><strong>Reason:</strong> {failureReason}</span>
                        </div>
                    )}

                    {/* Order & Payment Summary Grid */}
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
                            <p className={`mt-2 text-sm font-bold flex items-center gap-1.5 ${
                                isSuccess
                                    ? "text-emerald-400"
                                    : isFailed
                                    ? "text-rose-400"
                                    : isCancelled
                                    ? "text-orange-400"
                                    : "text-amber-400"
                            }`}>
                                <span className={`inline-block h-2 w-2 rounded-full ${
                                    isSuccess ? "bg-emerald-400 animate-pulse" : isFailed ? "bg-rose-400" : isCancelled ? "bg-orange-400" : "bg-amber-400 animate-ping"
                                }`} />
                                {isSuccess ? "SUCCESS (PAID)" : isFailed ? "FAILED" : isCancelled ? "CANCELLED" : isPending ? "PENDING" : "UNKNOWN"}
                            </p>
                        </div>
                    </div>

                    {/* Order Tracking (Only show if payment succeeded or order confirmed) */}
                    {isSuccess && (
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
                    )}

                    {/* Action Buttons */}
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {onRefreshStatus && (isPending || isUnknown) ? (
                            <button
                                type="button"
                                onClick={onRefreshStatus}
                                className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold"
                            >
                                <RefreshCw size={18} />
                                Refresh Status
                            </button>
                        ) : slug ? (
                            <Link
                                to={buildRestaurantMenuPath(slug, restaurantContext?.tableNo)}
                                className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold"
                            >
                                <RotateCcw size={18} />
                                {isSuccess ? "Continue Ordering" : "Try Payment Again"}
                            </Link>
                        ) : (
                            <Link
                                to="/"
                                className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold"
                            >
                                <RotateCcw size={18} />
                                {isSuccess ? "Choose Restaurant" : "Back To Restaurants"}
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
            <Footer />
        </div>
    );
}
