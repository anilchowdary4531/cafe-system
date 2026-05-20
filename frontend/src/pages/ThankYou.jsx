import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, RotateCcw, XCircle } from "lucide-react";
import { useRestaurantContext } from "../context/RestaurantContext";
import OrderTrackingTimeline from "../components/OrderTrackingTimeline";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

export default function ThankYou() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { setRestaurantContext } = useRestaurantContext();

    const state = location.state || {};
    const slug = String(state?.slug || searchParams.get("slug") || "").trim();
    const orderNo = String(state?.orderNo || searchParams.get("orderNo") || "").trim();
    const orderId = String(state?.orderId || searchParams.get("orderId") || "").trim();
    const amount = String(state?.amount || searchParams.get("amount") || "").trim();
    const orderStatus = String(state?.orderStatus || state?.status || searchParams.get("orderStatus") || searchParams.get("status") || "PLACED").trim();
    const paymentStatusRaw = String(
        state?.paymentStatus ||
        searchParams.get("paymentStatus") ||
        searchParams.get("payment_state") ||
        "SUCCESS"
    )
        .trim()
        .toUpperCase();
    const isPaymentSuccess = paymentStatusRaw === "SUCCESS" || paymentStatusRaw === "PAID";

    useEffect(() => {
        if (!slug) return;
        // Keep restaurant context aligned so the top-bar dropdown shows the right restaurant.
        setRestaurantContext({ slug });
    }, [setRestaurantContext, slug]);

    useEffect(() => {
        if (!slug || !isPaymentSuccess) return;
        const id = window.setTimeout(() => {
            navigate(`/r/${slug}`, { replace: true });
        }, 5000);
        return () => window.clearTimeout(id);
    }, [isPaymentSuccess, navigate, slug]);

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
                            ? `Thanks for ordering. ${slug ? "Returning to the menu in 5s." : "You can continue ordering anytime."}`
                            : "Payment was not completed. You can retry from the restaurant page."}
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order ID</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">{orderId || orderNo || "-"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Amount</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">Rs {amount ? toInr(amount) : "0.00"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-left">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Status</p>
                            <p className={`mt-2 text-lg font-bold ${isPaymentSuccess ? "text-emerald-200" : "text-rose-200"}`}>{isPaymentSuccess ? "SUCCESS" : "FAILED"}</p>
                        </div>
                    </div>

                    <div className="mt-8 rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
                        <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order Tracking</p>
                        <p className="theme-muted mt-1 text-xs">Live status: {orderStatus ? String(orderStatus).toUpperCase() : "PLACED"}</p>
                        <div className="mt-5">
                            <OrderTrackingTimeline status={orderStatus} />
                        </div>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {slug ? (
                            <Link
                                to={`/r/${slug}`}
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
