import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3 } from "lucide-react";
import OrderTrackingTimeline from "./OrderTrackingTimeline";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

export default function PaymentSuccessScreen({
    orderId = "",
    total = 0,
    orderStatus = "PLACED",
    redirectTo = "/",
    redirectAfterMs = 5000,
    showTracking = true,
}) {
    const navigate = useNavigate();

    const data = useMemo(() => {
        return {
            orderId: String(orderId || "").trim(),
            total: toInr(total),
            orderStatus: String(orderStatus || "PLACED").trim().toUpperCase(),
        };
    }, [orderId, orderStatus, total]);

    useEffect(() => {
        if (!redirectTo) return;
        const id = window.setTimeout(() => {
            navigate(redirectTo, { replace: true });
        }, redirectAfterMs);
        return () => window.clearTimeout(id);
    }, [navigate, redirectAfterMs, redirectTo]);

    return (
        <div className="theme-page min-h-screen px-4 py-14">
            <div className="mx-auto w-full max-w-3xl">
                <div className="theme-panel overflow-hidden rounded-[32px] border border-white/10 bg-black/10 p-10 text-center shadow-2xl backdrop-blur">
                    <div className="mx-auto relative flex h-20 w-20 items-center justify-center">
                        <div className="absolute inset-0 rounded-[28px] bg-emerald-500/10 blur-xl" aria-hidden="true" />
                        <div
                            className="absolute inset-0 rounded-[28px] bg-emerald-500/15 animate-ping [animation-duration:1.4s]"
                            aria-hidden="true"
                        />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-500/25 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.06)]">
                            <CheckCircle2 size={44} className="text-emerald-300" />
                        </div>
                    </div>

                    <h1 className="mt-6 text-4xl font-bold">Payment Successful</h1>
                    <p className="theme-muted mt-3 text-base">Thanks for ordering. Redirecting in 5s.</p>

                    <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order ID</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">{data.orderId || "—"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Total</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">₹{data.total}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Status</p>
                            <p className="mt-2 text-lg font-bold text-emerald-200">SUCCESS</p>
                        </div>
                    </div>

                    {showTracking && (
                        <div className="mt-8 rounded-3xl border border-white/10 bg-black/10 p-6 text-left">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order Tracking</p>
                                    <p className="theme-muted mt-1 text-xs">Live status: {data.orderStatus}</p>
                                </div>
                                <div className="theme-panel inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm font-semibold">
                                    <Clock3 size={16} className="theme-muted" />
                                    <span className="theme-muted">Auto redirect</span>
                                    <span className="tabular-nums">5s</span>
                                </div>
                            </div>

                            <div className="mt-5">
                                <OrderTrackingTimeline status={data.orderStatus} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

