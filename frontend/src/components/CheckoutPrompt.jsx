import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, QrCode, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";
import { api, invalidateGetCache } from "../utils/apiClient";

const UPI_PENDING_KEY = "cafe_system:customer_upi_pending:v1";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

export default function CheckoutPrompt({ open, onClose, cart, clearCart }) {
    const navigate = useNavigate();
    const { customer, customerToken, loginCustomer } = useAuth();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const [customerName, setCustomerName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [otpStep, setOtpStep] = useState("ready"); // phone -> otp -> ready
    const [otp, setOtp] = useState("");
    const [otpExpiresAt, setOtpExpiresAt] = useState(null);
    const [devOtp, setDevOtp] = useState("");
    const [showOptionalDetails, setShowOptionalDetails] = useState(false);
    const [tableChoice, setTableChoice] = useState("");
    const [notes, setNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("UPI"); // UPI | CASH
    const [placedOrder, setPlacedOrder] = useState(null);
    const [upiPendingOrder, setUpiPendingOrder] = useState(null);
    const [upiAttemptFailed, setUpiAttemptFailed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const onCloseRef = useRef(onClose);
    const clearCartRef = useRef(clearCart);

    const slug = String(restaurantContext?.slug || "").trim();
    const restaurantName = String(restaurantContext?.name || "CafeKing").trim() || "CafeKing";

    const { data: tablesData } = useCachedGet(slug ? `/r/${slug}/tables` : "/r/_/tables", {
        enabled: open && Boolean(slug),
        ttlMs: 30_000,
        staleMs: 10 * 60_000,
        scope: `restaurant:${slug}`,
    });

    const activeTables = Array.isArray(tablesData) ? tablesData.filter((t) => t && t.isActive !== false) : [];

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        clearCartRef.current = clearCart;
    }, [clearCart]);

    useEffect(() => {
        if (!open) return;
        setCustomerName(customer?.name || "");
        setEmail(customer?.email || "");
        setPhone(customer?.phone || "");
        setTableChoice(String(restaurantContext?.tableNo || ""));
        setOtpStep(customerToken ? "ready" : "phone");
        setOtp("");
        setOtpExpiresAt(null);
        setDevOtp("");
        setShowOptionalDetails(false);
        setNotes("");
        setPaymentMethod("UPI");
        setPlacedOrder(null);
        setUpiPendingOrder(null);
        setUpiAttemptFailed(false);
        setError("");
        setSuccess("");
    }, [open, customer, customerToken, restaurantContext?.tableNo, restaurantContext?.slug]);

    const cartSubtotal = useMemo(() => {
        const list = Array.isArray(cart) ? cart : [];
        return list.reduce((sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.quantity || 1)), 0);
    }, [cart]);
    const payableAmount = Number(placedOrder?.total || cartSubtotal || 0);

    const upiPa = String(restaurantContext?.upiId || import.meta.env.VITE_UPI_PA || "").trim().toLowerCase();
    const upiPn = String(import.meta.env.VITE_UPI_PN || restaurantName || "CafeKing").trim() || "CafeKing";

    const buildUpiLink = (orderId, amount) => {
        const params = new URLSearchParams();
        params.set("pa", upiPa);
        params.set("pn", upiPn);
        params.set("am", Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : "0.00");
        params.set("cu", "INR");
        params.set("tn", `Order-${String(orderId)}`);
        return `upi://pay?${params.toString()}`;
    };

    const getCustomerAuthConfig = () => {
        try {
            const token = customerToken || localStorage.getItem("customerToken") || "";
            return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
        } catch {
            return undefined;
        }
    };

    const readPendingUpiOrder = () => {
        let raw = "";
        try {
            raw = sessionStorage.getItem(UPI_PENDING_KEY) || "";
        } catch {
            raw = "";
        }
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            const orderId = Number(parsed?.orderId || 0);
            const amount = Number(parsed?.amount || 0);
            const pendingSlug = String(parsed?.slug || "").trim();
            const orderNo = String(parsed?.orderNo || "").trim();
            if (!orderId || !pendingSlug) return null;
            return {
                orderId,
                amount,
                slug: pendingSlug,
                orderNo: orderNo || String(orderId),
            };
        } catch {
            try {
                sessionStorage.removeItem(UPI_PENDING_KEY);
            } catch {
                // ignore
            }
            return null;
        }
    };

    useEffect(() => {
        if (!open) return undefined;

        const capturePendingUpi = () => {
            if (document.visibilityState !== "visible") return;
            const pending = readPendingUpiOrder();
            if (!pending) return;
            if (Number(upiPendingOrder?.orderId || 0) === pending.orderId) return;
            setPlacedOrder({ id: pending.orderId, orderNo: pending.orderNo, total: pending.amount });
            setUpiPendingOrder(pending);
            setError("");
            setSuccess("Returned from UPI app. Confirm payment status below.");
        };

        capturePendingUpi();
        window.addEventListener("focus", capturePendingUpi);
        document.addEventListener("visibilitychange", capturePendingUpi);
        return () => {
            window.removeEventListener("focus", capturePendingUpi);
            document.removeEventListener("visibilitychange", capturePendingUpi);
        };
    }, [open, upiPendingOrder?.orderId]);

    if (!open) return null;

    const handleClose = () => {
        if (submitting) return;
        setError("");
        setSuccess("");
        onClose();
    };

    const requestOtp = async (normalizedPhone) => {
        const otpRes = await api.post("/customer/send-otp", { phone: normalizedPhone, email: String(email || "").trim() });
        setOtpStep("otp");
        setOtp("");
        setOtpExpiresAt(otpRes.data?.expiresAt || null);
        setDevOtp(otpRes.data?.devOtp || "");
        setSuccess("OTP sent. Enter the code to confirm your order.");
    };

    const launchUpiApps = (orderMeta) => {
        const orderId = Number(orderMeta?.id || orderMeta?.orderId || 0);
        const amount = Number(orderMeta?.total || orderMeta?.amount || 0);
        const orderNo = String(orderMeta?.orderNo || orderId || "").trim();

        if (!orderId) {
            setError("Order is missing for UPI payment.");
            return;
        }
        if (!upiPa) {
            setError("UPI is not configured for this restaurant.");
            return;
        }

        const pendingPayload = {
            orderId,
            amount,
            slug,
            orderNo,
            createdAt: Date.now(),
        };

        try {
            sessionStorage.setItem(UPI_PENDING_KEY, JSON.stringify(pendingPayload));
        } catch {
            // ignore
        }

        setUpiPendingOrder({
            orderId,
            amount,
            slug,
            orderNo: orderNo || String(orderId),
        });
        setUpiAttemptFailed(false);
        setSuccess("Opening UPI app chooser...");
        window.location.assign(buildUpiLink(orderId, amount));
    };

    const finalizeUpiPayment = async (status) => {
        const normalizedStatus = String(status || "").toUpperCase() === "FAILED" ? "FAILED" : "SUCCESS";
        const pending = upiPendingOrder || readPendingUpiOrder();
        if (!pending?.orderId) {
            setError("No pending UPI transaction found.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");
            setSuccess(normalizedStatus === "SUCCESS" ? "Finalizing payment..." : "Marking payment as failed...");

            await api.post(
                "/payments/verify",
                { orderId: pending.orderId, status: normalizedStatus, paymentMode: "UPI" },
                getCustomerAuthConfig()
            );

            invalidateGetCache({ urlStartsWith: `/r/${pending.slug}/orders` });
            invalidateGetCache({ urlStartsWith: "/customer/orders" });

            try {
                sessionStorage.removeItem(UPI_PENDING_KEY);
            } catch {
                // ignore
            }

            if (normalizedStatus === "FAILED") {
                setUpiAttemptFailed(true);
                setError("Payment failed. Please try again.");
                setSuccess("");
                return;
            }

            setUpiAttemptFailed(false);
            clearCartRef.current?.();
            setUpiPendingOrder(null);
            onCloseRef.current?.();
            navigate(
                `/orders/thank-you?slug=${encodeURIComponent(pending.slug)}&orderNo=${encodeURIComponent(
                    pending.orderNo || String(pending.orderId)
                )}&orderId=${encodeURIComponent(String(pending.orderId))}&amount=${encodeURIComponent(
                    String(toInr(pending.amount))
                )}&paymentStatus=${encodeURIComponent(normalizedStatus)}`,
                {
                    replace: true,
                    state: {
                        slug: pending.slug,
                        orderNo: pending.orderNo || String(pending.orderId),
                        orderId: pending.orderId,
                        amount: pending.amount,
                        paymentStatus: normalizedStatus,
                    },
                }
            );
        } catch (err) {
            setError(err.response?.data?.message || "Payment verification failed");
            setSuccess("");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        const tableNo = String(tableChoice || restaurantContext?.tableNo || "").trim();
        const normalizedPhone = String(phone || customer?.phone || "").trim();
        const normalizedName = String(customerName || customer?.name || "").trim();
        const normalizedEmail = String(email || customer?.email || "").trim();
        const isUpiPayment = String(paymentMethod || "UPI").toUpperCase() === "UPI";

        if (isUpiPayment && placedOrder?.id) {
            launchUpiApps(placedOrder);
            return;
        }

        if (!normalizedPhone) {
            setError("Phone number is required to continue.");
            return;
        }

        if (!slug) {
            setError("Restaurant not selected. Choose a restaurant from the top bar (or open the home page) and try again.");
            return;
        }

        if (!cart.length) {
            setError("Your cart is empty.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");
            setSuccess("");

            // Enforce OTP login the first time, then keep the session for the next order.
            if (!customerToken) {
                if (otpStep === "phone") {
                    await requestOtp(normalizedPhone);
                    return;
                }

                if (otpStep === "otp") {
                    const normalizedOtp = String(otp || "").trim();
                    if (!normalizedOtp) {
                        setError("OTP is required to place the order.");
                        return;
                    }

                    const verifyRes = await api.post("/customer/verify-otp", {
                        phone: normalizedPhone,
                        otp: normalizedOtp,
                        name: normalizedName,
                        email: normalizedEmail,
                    });

                    const verifiedCustomer = verifyRes.data?.customer || {};
                    loginCustomer({
                        id: verifiedCustomer?.id || null,
                        name: verifiedCustomer?.name || normalizedName,
                        email: verifiedCustomer?.email || normalizedEmail,
                        phone: verifiedCustomer?.phone || normalizedPhone,
                        token: verifyRes.data?.token || "",
                        verified: true,
                    });
                    setOtpStep("ready");
                    setSuccess("Verified. Placing your order...");
                }
            }

            const payload = {
                customerName: normalizedName,
                phone: normalizedPhone,
                email: normalizedEmail,
                tableNumber: tableNo,
                notes: String(notes || "").trim(),
                items: cart.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    qty: item.quantity || 1,
                })),
            };

            const res = await api.post(`/r/${slug}/order`, payload);

            loginCustomer({
                name: normalizedName,
                email: normalizedEmail,
                phone: normalizedPhone,
                latestOrderId: res.data?.order?.id || null,
                verified: true,
            });

            setRestaurantContext({ tableNo: tableNo || null });
            invalidateGetCache({ urlStartsWith: `/r/${slug}/orders` });
            invalidateGetCache({ urlStartsWith: "/customer/orders" });
            const order = res.data?.order || null;
            const orderId = Number(order?.id || 0);
            const orderTotal = Number(order?.total || 0);
            const orderNo = String(order?.orderNo || orderId || "").trim();

            if (!orderId) {
                setError("Order created but missing id");
                return;
            }

            setPlacedOrder({ id: orderId, orderNo, total: orderTotal });

            // Cash: verify immediately and go to success page.
            if (!isUpiPayment) {
                await api.post("/payments/verify", { orderId, status: "SUCCESS", paymentMode: "CASH" }, getCustomerAuthConfig());
                clearCart();
                onClose();
                navigate(
                    `/orders/thank-you?slug=${encodeURIComponent(slug)}&orderNo=${encodeURIComponent(orderNo)}&orderId=${encodeURIComponent(
                        String(orderId)
                    )}&amount=${encodeURIComponent(String(toInr(orderTotal)))}`,
                    {
                        replace: true,
                        state: {
                            slug,
                            orderNo,
                            orderId,
                            amount: orderTotal,
                            paymentStatus: "SUCCESS",
                        },
                    }
                );
                return;
            }

            // UPI: create order first, then let customer tap and choose any installed UPI app.
            if (!upiPa) {
                setError("UPI is not configured for this restaurant.");
                return;
            }

            setUpiPendingOrder({ orderId, amount: orderTotal, slug, orderNo });
            setUpiAttemptFailed(false);
            try {
                sessionStorage.setItem(
                    UPI_PENDING_KEY,
                    JSON.stringify({ orderId, amount: orderTotal, slug, orderNo, createdAt: Date.now() })
                );
            } catch {
                // ignore
            }

            clearCart();
            setSuccess("Order created. Tap 'Open UPI Apps' below to choose Google Pay, PhonePe, Paytm, etc.");
            return;

        } catch (err) {
            setError(err.response?.data?.message || "Checkout failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] theme-page">
            <header className="theme-nav border-b px-4 py-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="theme-accent-text text-xs font-extrabold uppercase tracking-[0.28em]">Checkout</p>
                        <h3 className="mt-1 flex items-center gap-2 text-xl font-bold">
                            <ShieldCheck size={18} className="theme-accent-text" />
                            Secure Payment
                        </h3>
                        <p className="theme-muted mt-1 text-xs sm:text-sm truncate">
                            {slug ? restaurantName : "Select a restaurant first"} • ₹{toInr(payableAmount)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="theme-panel inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/10 p-2 hover:bg-black/20"
                            aria-label="Close"
                        >
                            <X size={18} className="theme-muted" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 pb-28 lg:grid-cols-3">
                <section className="theme-panel rounded-3xl border border-white/10 bg-black/10 p-5 lg:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order Summary</p>
                            <p className="mt-1 text-xl font-semibold tracking-tight">Review items before you pay</p>
                            <p className="theme-muted mt-1 text-sm">Tap back to edit cart. Payment is secured.</p>
                        </div>
                        <div className="text-right">
                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Total</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums">₹{toInr(payableAmount)}</p>
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/10">
                        {(!cart || cart.length === 0) ? (
                            <div className="px-6 py-10 text-center">
                                <p className="text-sm font-semibold">Your cart is empty</p>
                                <p className="theme-muted mt-1 text-xs">Add items to continue.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {(cart || []).map((item) => {
                                    const qty = Math.max(1, Number(item.quantity || 1));
                                    const price = Number(item.price || 0);
                                    return (
                                        <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{item.name}</p>
                                                <div className="theme-muted mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                    <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5">
                                                        Qty {qty}
                                                    </span>
                                                    <span className="tabular-nums">₹{toInr(price)} each</span>
                                                </div>
                                            </div>
                                            <p className="shrink-0 text-sm font-semibold tabular-nums">₹{toInr(price * qty)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <aside className="theme-panel self-start max-h-[calc(100vh-220px)] overflow-y-auto rounded-3xl border border-white/10 bg-black/10 p-5 pr-4 lg:sticky lg:top-4">
                    <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Payment</p>
                    <p className="mt-1 text-lg font-semibold">Choose a method</p>
                    <p className="theme-muted mt-2 inline-flex items-center gap-2 text-xs">
                        <ShieldCheck size={14} className="theme-accent-text" />
                        Secure payment
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod("UPI")}
                            className={[
                                "group rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30",
                                paymentMethod === "UPI"
                                    ? "border-amber-400/40 bg-amber-400/10 ring-1 ring-amber-400/10"
                                    : "border-white/10 bg-black/10 hover:bg-black/20",
                            ].join(" ")}
                            aria-pressed={paymentMethod === "UPI"}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className={[
                                        "flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                                        paymentMethod === "UPI" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-white/10 bg-black/10 theme-muted",
                                    ].join(" ")}
                                >
                                    <QrCode size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold">UPI</p>
                                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.24em] text-emerald-200">
                                            Recommended
                                        </span>
                                    </div>
                                    <p className="theme-muted mt-1 text-xs">Pay with any UPI app</p>
                                </div>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentMethod("CASH")}
                            className={[
                                "group rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30",
                                paymentMethod === "CASH"
                                    ? "border-amber-400/40 bg-amber-400/10 ring-1 ring-amber-400/10"
                                    : "border-white/10 bg-black/10 hover:bg-black/20",
                            ].join(" ")}
                            aria-pressed={paymentMethod === "CASH"}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className={[
                                        "flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                                        paymentMethod === "CASH" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-white/10 bg-black/10 theme-muted",
                                    ].join(" ")}
                                >
                                    <Banknote size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">Cash</p>
                                    <p className="theme-muted mt-1 text-xs">Pay at the counter</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    {paymentMethod === "UPI" && (
                        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-200">Pay Via UPI ID</p>
                            {upiPa ? (
                                <p className="mt-1 text-sm font-semibold">{upiPa}</p>
                            ) : (
                                <p className="mt-1 text-sm text-red-300">Owner has not added a UPI ID yet.</p>
                            )}
                            <p className="theme-muted mt-2 text-xs">
                                On mobile, this opens available apps like Google Pay, PhonePe, Paytm and others.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {["Google Pay", "PhonePe", "Paytm", "BHIM"].map((appName) => (
                                    <span
                                        key={appName}
                                        className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-gray-200"
                                    >
                                        {appName}
                                    </span>
                                ))}
                            </div>

                            {placedOrder?.id ? (
                                <div className="mt-3 space-y-2">
                                    <div
                                        className={`rounded-2xl border px-3 py-2 text-xs ${
                                            upiAttemptFailed
                                                ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
                                                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                                        }`}
                                    >
                                        <p className="font-semibold">Order {placedOrder.orderNo || placedOrder.id} • Rs {toInr(placedOrder.total)}</p>
                                        <p className="mt-1">
                                            {upiAttemptFailed
                                                ? "Last UPI attempt failed. Tap Open UPI Apps to retry."
                                                : "Complete payment in UPI app, then confirm status below."}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => launchUpiApps(placedOrder)}
                                        disabled={!upiPa || submitting}
                                        className="theme-button w-full rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                                    >
                                        Open UPI Apps
                                    </button>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => finalizeUpiPayment("SUCCESS")}
                                            disabled={submitting}
                                            className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-60"
                                        >
                                            Payment Successful
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => finalizeUpiPayment("FAILED")}
                                            disabled={submitting}
                                            className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-60"
                                        >
                                            Payment Failed
                                        </button>
                                    </div>
                                    <p className="theme-muted text-xs">
                                        After payment in UPI app, come back here and pick the status.
                                    </p>
                                </div>
                            ) : (
                                <p className="theme-muted mt-3 text-xs">
                                    Place order first, then use the button above to open UPI apps.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-5 space-y-4">
                    {!customerToken && (
                        <div>
                            <label className="theme-muted mb-2 block text-sm">Phone Number</label>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter your phone number"
                                className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                            />
                        </div>
                    )}

                    {!customerToken && (
                        <div>
                            <label className="theme-muted mb-2 block text-sm">Email (optional)</label>
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={customer?.email || "you@example.com"}
                                className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                            />
                            <p className="theme-muted mt-2 text-xs">If provided, we'll send the OTP to email too.</p>
                        </div>
                    )}

                    {otpStep === "otp" && !customerToken && (
                        <div className="theme-card rounded-2xl p-4">
                            <label className="theme-muted mb-2 block text-sm">OTP</label>
                            <input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Enter 6-digit OTP"
                                className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                            />
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOtpStep("phone");
                                        setOtp("");
                                        setOtpExpiresAt(null);
                                        setDevOtp("");
                                        setSuccess("");
                                        setError("");
                                    }}
                                    className="theme-muted underline decoration-dotted underline-offset-4 hover:opacity-80"
                                >
                                    Change number
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            setSubmitting(true);
                                            setError("");
                                            await requestOtp(String(phone || customer?.phone || "").trim());
                                        } catch (err) {
                                            setError(err.response?.data?.message || err.message || "Failed to resend OTP");
                                        } finally {
                                            setSubmitting(false);
                                        }
                                    }}
                                    disabled={submitting}
                                    className="theme-muted underline decoration-dotted underline-offset-4 hover:opacity-80 disabled:opacity-60"
                                >
                                    Resend OTP
                                </button>
                            </div>
                            {import.meta.env.DEV && devOtp && <p className="theme-muted mt-2 text-xs">Dev OTP: {devOtp}</p>}
                            {otpExpiresAt && (
                                <p className="theme-muted mt-1 text-xs">
                                    Expires at {new Date(otpExpiresAt).toLocaleTimeString()}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="theme-muted mb-2 block text-sm">Table (optional)</label>
                        <select
                            value={tableChoice}
                            onChange={(e) => setTableChoice(e.target.value)}
                            className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                            disabled={!slug}
                        >
                            <option value="">Takeaway / No table</option>
                            {activeTables.map((table) => (
                                <option key={table.id} value={table.tableNo}>
                                    {table.tableNo} ({Number(table.seats || 0) || 4} seats)
                                </option>
                            ))}
                        </select>
                        {slug && activeTables.length === 0 && (
                            <p className="theme-muted mt-2 text-xs">No active tables found for this restaurant.</p>
                        )}
                    </div>

                    <div className="theme-card rounded-2xl p-4">
                        <button
                            type="button"
                            onClick={() => setShowOptionalDetails((v) => !v)}
                            className="flex w-full items-center justify-between text-left"
                        >
                            <span className="text-sm font-semibold">Customer details (optional)</span>
                            <span className="theme-muted text-sm">{showOptionalDetails ? "Hide" : "Add / Edit"}</span>
                        </button>

                        {showOptionalDetails && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Name</label>
                                    <input
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder={customer?.name || "Customer name"}
                                        className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="theme-muted mb-2 block text-sm">Notes (optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any special instructions?"
                            rows={3}
                            className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                        />
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                            {success}
                        </div>
                    )}

                    </div>
                </aside>
            </main>

            <footer className="fixed inset-x-0 bottom-0 z-[75] border-t border-white/10 bg-black/60 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                        <p className="theme-muted text-[10px] font-extrabold uppercase tracking-[0.32em]">Total Payable</p>
                        <p className="mt-1 truncate text-lg font-bold tabular-nums">Rs {toInr(payableAmount)}</p>
                        <p className="theme-muted mt-0.5 text-xs">Secure payment - UPI recommended</p>
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="theme-button inline-flex min-w-[200px] items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {submitting
                            ? "Working..."
                            : String(paymentMethod || "UPI").toUpperCase() === "UPI" && placedOrder?.id
                                ? "Open UPI Apps"
                                : String(paymentMethod || "UPI").toUpperCase() === "UPI" && customerToken
                                    ? `Create Order & Continue`
                                : customerToken
                                    ? `Pay Rs ${toInr(payableAmount)}`
                                    : otpStep === "otp"
                                        ? `Verify & Pay Rs ${toInr(payableAmount)}`
                                        : `Send OTP to Pay Rs ${toInr(payableAmount)}`}
                    </button>
                </div>
            </footer>
        </div>
    );
}
