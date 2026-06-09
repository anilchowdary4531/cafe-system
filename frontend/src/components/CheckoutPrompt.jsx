import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, MapPin, Plus, QrCode, ShieldCheck, X } from "lucide-react";
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

const normalizePaymentMethod = (value) =>
    String(value || "UPI").trim().toUpperCase() === "CASH" ? "CASH" : "UPI";

const normalizeFulfillment = (value) => {
    const fulfillment = String(value || "").trim().toLowerCase();
    if (["pickup", "takeaway", "take_away", "counter"].includes(fulfillment)) return "pickup";
    if (["dinein", "dine_in", "table", "table_service"].includes(fulfillment)) return "dinein";
    if (["delivery", "online", "home_delivery", "door_delivery"].includes(fulfillment)) return "delivery";
    return "delivery";
};

const getPaymentMethodTitle = (value, fulfillment = "delivery") =>
    normalizePaymentMethod(value) === "CASH"
        ? fulfillment === "pickup"
            ? "Cash on Pickup"
            : fulfillment === "dinein"
                ? "Cash on Table"
            : "Cash on Delivery"
        : "UPI";

const getPaymentMethodSubtitle = (value, fulfillment = "delivery") =>
    normalizePaymentMethod(value) === "CASH"
        ? fulfillment === "pickup"
            ? "Pay when you collect your order"
            : fulfillment === "dinein"
                ? "Pay when your order is served"
            : "Pay when your order arrives"
        : "Pay with any UPI app";

const getPaymentFooterHint = (value, isOnlineOrder = false, fulfillment = "delivery") =>
    isOnlineOrder
        ? fulfillment === "pickup"
            ? normalizePaymentMethod(value) === "CASH"
                ? "Online order - cash on pickup"
                : "Online order - pickup"
            : fulfillment === "dinein"
                ? normalizePaymentMethod(value) === "CASH"
                    ? "Table order - cash on table"
                    : "Table order"
            : normalizePaymentMethod(value) === "CASH"
                ? "Online order - cash on delivery"
                : "Online order - delivery"
        : normalizePaymentMethod(value) === "CASH"
            ? "Cash on table - pay when your order is served"
            : "Secure payment - UPI recommended";

const getPaymentTone = (value) =>
    normalizePaymentMethod(value) === "CASH" ? "var(--app-accent)" : "var(--app-primary)";

const getPaymentTileStyle = (value, active) => {
    const tone = getPaymentTone(value);
    return {
        borderColor: active
            ? `color-mix(in srgb, ${tone} 42%, var(--app-border) 58%)`
            : "var(--app-border)",
        background: active
            ? `linear-gradient(135deg, color-mix(in srgb, ${tone} 12%, var(--app-surface) 88%) 0%, color-mix(in srgb, var(--app-surface-2) 48%, var(--app-surface) 52%) 100%)`
            : "var(--app-surface)",
        boxShadow: active ? `0 14px 30px color-mix(in srgb, ${tone} 12%, transparent)` : "none",
    };
};

const getPaymentBadgeStyle = (value, active) => {
    const tone = getPaymentTone(value);
    return {
        borderColor: `color-mix(in srgb, ${tone} 34%, var(--app-border) 66%)`,
        background: active
            ? `color-mix(in srgb, ${tone} 16%, var(--app-surface) 84%)`
            : "color-mix(in srgb, var(--app-surface-2) 72%, transparent)",
        color: active ? "var(--app-text)" : "var(--app-muted-strong)",
    };
};

const getPaymentInfoStyle = () => ({
    borderColor: "color-mix(in srgb, var(--app-border-strong) 55%, var(--app-border) 45%)",
    background:
        "linear-gradient(180deg, color-mix(in srgb, var(--app-primary) 8%, var(--app-surface) 92%) 0%, color-mix(in srgb, var(--app-surface) 96%, transparent) 100%)",
});

const formatSavedAddress = (address) => {
    if (!address) return "";

    const label = String(address?.label || "").trim();
    const name = String(address?.name || "").trim();
    const line1 = String(address?.line1 || "").trim();
    const line2 = String(address?.line2 || "").trim();
    const notes = String(address?.notes || "").trim();
    const locality = [address?.city, address?.mandal || address?.state, address?.postalCode]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ");

    return [label ? `${label}` : "", name, line1, line2, locality, notes].filter(Boolean).join("\n");
};

const normalizeDeliveryAddressText = (value) => String(value || "").trim().replace(/\n{3,}/g, "\n\n");

const normalizeCoordinate = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getCheckoutActionLabel = ({
    paymentMethod,
    placedOrder,
    customerToken,
    otpStep,
    payableAmount,
    isOnlineOrder,
    fulfillment,
} = {}) => {
    const method = normalizePaymentMethod(paymentMethod);
    const normalizedFulfillment = normalizeFulfillment(fulfillment);
    const orderMode = isOnlineOrder
        ? normalizedFulfillment === "pickup"
            ? "Pickup"
            : normalizedFulfillment === "dinein"
                ? "Table"
                : "Delivery"
        : "Order";

    if (method === "UPI") {
        if (placedOrder?.id) return "Open UPI Apps";
        if (customerToken) return isOnlineOrder ? `Place ${orderMode} Order & Continue` : "Place Order & Continue";
        return otpStep === "otp"
            ? `Verify & Pay Rs ${toInr(payableAmount)}`
            : isOnlineOrder
                ? `Send OTP to Place ${orderMode} Order`
                : "Send OTP to Place Order";
    }

    if (customerToken) return isOnlineOrder ? `Place ${orderMode} Order` : "Place Order";
    return otpStep === "otp"
        ? isOnlineOrder
            ? `Verify & Place ${orderMode} Order`
            : "Verify & Place Order"
        : isOnlineOrder
            ? `Send OTP to Place ${orderMode} Order`
            : "Send OTP to Place Order";
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
    const [addressMode, setAddressMode] = useState("manual");
    const [fulfillment, setFulfillment] = useState("delivery");
    const [selectedAddressId, setSelectedAddressId] = useState("");
    const [manualAddress, setManualAddress] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("UPI"); // UPI | CASH
    const [checkoutStep, setCheckoutStep] = useState("summary"); // summary | payment
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
    const { data: addressData, loading: addressLoading } = useCachedGet("/customer/address", {
        enabled: open && Boolean(customerToken),
        ttlMs: 15_000,
        staleMs: 5 * 60_000,
        scope: customer?.phone ? `customer:${customer.phone}` : "customer:session",
    });

    const activeTables = Array.isArray(tablesData) ? tablesData.filter((t) => t && t.isActive !== false) : [];
    const savedAddresses = useMemo(
        () => (Array.isArray(addressData?.addresses) ? addressData.addresses : []),
        [addressData?.addresses]
    );

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
        setAddressMode(customerToken ? "saved" : "manual");
        setFulfillment(String(restaurantContext?.tableNo || "").trim() ? "dinein" : "pickup");
        setSelectedAddressId("");
        setManualAddress("");
        setPaymentMethod("UPI");
        setCheckoutStep("summary");
        setPlacedOrder(null);
        setUpiPendingOrder(null);
        setUpiAttemptFailed(false);
        setError("");
        setSuccess("");
    }, [open, restaurantContext?.tableNo, restaurantContext?.slug]);

    useEffect(() => {
        if (!open || !customerToken || addressMode !== "saved" || !savedAddresses.length) return;
        setSelectedAddressId((current) => {
            const currentId = String(current || "").trim();
            if (currentId && savedAddresses.some((address) => String(address?.id || "") === currentId)) {
                return currentId;
            }

            const preferred = savedAddresses.find((address) => address?.isDefault) || savedAddresses[0];
            return String(preferred?.id || "");
        });
    }, [addressMode, customerToken, open, savedAddresses]);

    const cartSubtotal = useMemo(() => {
        const list = Array.isArray(cart) ? cart : [];
        return list.reduce((sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.quantity || 1)), 0);
    }, [cart]);
    const payableAmount = Number(placedOrder?.total || cartSubtotal || 0);
    const isOnlineOrder = !String(tableChoice || restaurantContext?.tableNo || "").trim();
    const selectedFulfillment = isOnlineOrder ? normalizeFulfillment(fulfillment) : "dinein";
    const selectedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const selectedSavedAddress = useMemo(
        () => savedAddresses.find((address) => String(address?.id || "") === String(selectedAddressId || "")) || null,
        [savedAddresses, selectedAddressId]
    );
    const selectedDeliveryCoordinates = useMemo(() => {
        if (!isOnlineOrder || selectedFulfillment === "pickup" || addressMode !== "saved" || !selectedSavedAddress) {
            return { latitude: null, longitude: null };
        }
        const latitude = normalizeCoordinate(selectedSavedAddress.latitude);
        const longitude = normalizeCoordinate(selectedSavedAddress.longitude);
        return {
            latitude,
            longitude,
        };
    }, [addressMode, isOnlineOrder, selectedFulfillment, selectedSavedAddress]);
    const deliveryAddressText = useMemo(() => {
        if (!isOnlineOrder || selectedFulfillment === "pickup") return "";
        if (addressMode === "saved") return normalizeDeliveryAddressText(formatSavedAddress(selectedSavedAddress));
        return normalizeDeliveryAddressText(manualAddress);
    }, [addressMode, isOnlineOrder, manualAddress, selectedFulfillment, selectedSavedAddress]);

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
            const fulfillment = normalizeFulfillment(parsed?.fulfillment || "delivery");
            if (!orderId || !pendingSlug) return null;
            return {
                orderId,
                amount,
                slug: pendingSlug,
                orderNo: orderNo || String(orderId),
                fulfillment,
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
            setPlacedOrder({
                id: pending.orderId,
                orderNo: pending.orderNo,
                total: pending.amount,
                fulfillment: normalizeFulfillment(pending.fulfillment || "delivery"),
            });
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

    const handlePrimaryAction = async () => {
        if (checkoutStep === "summary") {
            if (!cart?.length) {
                setError("Your cart is empty.");
                return;
            }
            setError("");
            setSuccess("");
            setCheckoutStep("payment");
            return;
        }

        await handleSubmit();
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
        const fulfillment = normalizeFulfillment(orderMeta?.fulfillment || "delivery");

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
            fulfillment,
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
            fulfillment,
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
                )}&paymentStatus=${encodeURIComponent(normalizedStatus)}&fulfillment=${encodeURIComponent(
                    String(pending.fulfillment || "delivery")
                )}`,
                {
                    replace: true,
                    state: {
                        slug: pending.slug,
                        orderNo: pending.orderNo || String(pending.orderId),
                        orderId: pending.orderId,
                        amount: pending.amount,
                        paymentStatus: normalizedStatus,
                        fulfillment: String(pending.fulfillment || "delivery"),
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
        const isUpiPayment = selectedPaymentMethod === "UPI";

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

        if (isOnlineOrder && selectedFulfillment === "delivery" && !deliveryAddressText) {
            setError("Delivery address is required for online orders.");
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
                fulfillment: isOnlineOrder ? selectedFulfillment : "dinein",
                deliveryAddress: deliveryAddressText,
                deliveryLatitude: selectedDeliveryCoordinates.latitude,
                deliveryLongitude: selectedDeliveryCoordinates.longitude,
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

            setPlacedOrder({ id: orderId, orderNo, total: orderTotal, fulfillment: isOnlineOrder ? selectedFulfillment : "dinein" });

            // Cash on delivery: verify immediately and go to success page.
            if (!isUpiPayment) {
                await api.post("/payments/verify", { orderId, status: "SUCCESS", paymentMode: "CASH" }, getCustomerAuthConfig());
                clearCart();
                onClose();
                navigate(
                    `/orders/thank-you?slug=${encodeURIComponent(slug)}&orderNo=${encodeURIComponent(orderNo)}&orderId=${encodeURIComponent(
                        String(orderId)
                    )}&amount=${encodeURIComponent(String(toInr(orderTotal)))}&fulfillment=${encodeURIComponent(
                        isOnlineOrder ? selectedFulfillment : "dinein"
                    )}`,
                    {
                        replace: true,
                        state: {
                            slug,
                            orderNo,
                            orderId,
                            amount: orderTotal,
                            paymentStatus: "SUCCESS",
                            fulfillment: isOnlineOrder ? selectedFulfillment : "dinein",
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

            setUpiPendingOrder({ orderId, amount: orderTotal, slug, orderNo, fulfillment: selectedFulfillment });
            setUpiAttemptFailed(false);
            try {
                sessionStorage.setItem(
                    UPI_PENDING_KEY,
                    JSON.stringify({
                        orderId,
                        amount: orderTotal,
                        slug,
                        orderNo,
                        fulfillment: isOnlineOrder ? selectedFulfillment : "dinein",
                        createdAt: Date.now(),
                    })
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
        <div className="fixed inset-0 z-[70] flex h-[100dvh] flex-col overflow-hidden theme-page">
            <header className="theme-nav border-b px-4 py-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="theme-accent-text text-xs font-extrabold uppercase tracking-[0.28em]">Checkout</p>
                        <h3 className="mt-1 flex items-center gap-2 text-xl font-bold">
                            <ShieldCheck size={18} className="theme-accent-text" />
                            {checkoutStep === "summary" ? "Order Summary" : "Secure Payment"}
                        </h3>
                        <p className="theme-muted mt-1 text-xs sm:text-sm truncate">
                            {slug ? restaurantName : "Select a restaurant first"} • ₹{toInr(payableAmount)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={checkoutStep === "payment" ? () => setCheckoutStep("summary") : handleClose}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
                        >
                            <ArrowLeft size={16} />
                            {checkoutStep === "payment" ? "Back" : "Close"}
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

            <main className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-y-auto px-4 py-5 pb-8">
                <div className="mb-4 flex items-center gap-3 rounded-full border border-white/10 bg-black/10 px-3 py-2">
                    <button
                        type="button"
                        onClick={() => setCheckoutStep("summary")}
                        className={[
                            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] transition",
                            checkoutStep === "summary"
                                ? "bg-[color:color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface)_88%)] text-[color:var(--app-text)]"
                                : "theme-muted hover:text-[color:var(--app-text)]",
                        ].join(" ")}
                    >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-[10px]">
                            1
                        </span>
                        Order Summary
                    </button>
                    <div className="h-px flex-1 bg-[var(--app-border)]" />
                    <button
                        type="button"
                        onClick={() => {
                            if (!cart?.length) {
                                setError("Your cart is empty.");
                                return;
                            }
                            setError("");
                            setSuccess("");
                            setCheckoutStep("payment");
                        }}
                        className={[
                            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] transition",
                            checkoutStep === "payment"
                                ? "bg-[color:color-mix(in_srgb,var(--app-accent)_12%,var(--app-surface)_88%)] text-[color:var(--app-text)]"
                                : "theme-muted hover:text-[color:var(--app-text)]",
                        ].join(" ")}
                    >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-[10px]">
                            2
                        </span>
                        Payment
                    </button>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    {checkoutStep === "summary" ? (
                        <motion.section
                            key="summary"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.22 }}
                            className="rounded-[32px] border border-white/10 bg-black/10 p-5 md:p-6"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Order Summary</p>
                                    <p className="mt-1 text-2xl font-semibold tracking-tight">Review items before you pay</p>
                                    <p className="theme-muted mt-1 text-sm">Check your cart here, then continue to payment.</p>
                                </div>
                                <div className="text-right">
                                    <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Total</p>
                                    <p className="mt-1 text-3xl font-bold tabular-nums">₹{toInr(payableAmount)}</p>
                                </div>
                            </div>

                            <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-black/10">
                                {(!cart || cart.length === 0) ? (
                                    <div className="px-6 py-12 text-center">
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

                            <p className="theme-muted mt-4 text-xs">
                                The next page will handle payment details and your delivery or pickup choice.
                            </p>
                        </motion.section>
                    ) : (
                        <motion.section
                            key="payment"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.22 }}
                            className="rounded-[32px] border border-white/10 bg-black/10 p-5 md:p-6"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Payment</p>
                                    <p className="mt-1 text-2xl font-semibold tracking-tight">Choose a method</p>
                                    <p className="theme-muted mt-1 text-sm">
                                        {isOnlineOrder
                                            ? selectedFulfillment === "pickup"
                                                ? "Choose pickup, then place the order."
                                                : "Add the delivery address, then place the order."
                                            : "Choose how you want to pay."}
                                    </p>
                                </div>
                                <div
                                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.24em]"
                                    style={{
                                        borderColor: isOnlineOrder
                                            ? "color-mix(in srgb, var(--app-accent) 34%, var(--app-border) 66%)"
                                            : "color-mix(in srgb, var(--app-primary) 30%, var(--app-border) 70%)",
                                        background: isOnlineOrder
                                            ? "color-mix(in srgb, var(--app-accent) 12%, var(--app-surface) 88%)"
                                            : "color-mix(in srgb, var(--app-primary) 10%, var(--app-surface) 90%)",
                                        color: "var(--app-text)",
                                    }}
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: isOnlineOrder ? "var(--app-accent)" : "var(--app-primary)" }}
                                    />
                                    {isOnlineOrder
                                        ? `${selectedFulfillment === "pickup" ? "Pickup" : "Delivery"} Order`
                                        : "Table Order"}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-6">
                                {isOnlineOrder && (
                                    <div className="order-2 space-y-4">
                                        <div className="inline-flex rounded-full border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_84%,var(--app-surface-2)_16%)] p-1">
                                            <button
                                                type="button"
                                                onClick={() => setFulfillment("delivery")}
                                                className={[
                                                    "rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] transition",
                                                    selectedFulfillment === "delivery"
                                                        ? "bg-[color:color-mix(in_srgb,var(--app-accent)_16%,var(--app-surface)_84%)] text-[color:var(--app-text)]"
                                                        : "theme-muted hover:text-[color:var(--app-text)]",
                                                ].join(" ")}
                                            >
                                                Delivery
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFulfillment("pickup")}
                                                className={[
                                                    "rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] transition",
                                                    selectedFulfillment === "pickup"
                                                        ? "bg-[color:color-mix(in_srgb,var(--app-primary)_16%,var(--app-surface)_84%)] text-[color:var(--app-text)]"
                                                        : "theme-muted hover:text-[color:var(--app-text)]",
                                                ].join(" ")}
                                            >
                                                Pickup
                                            </button>
                                        </div>

                                        {selectedFulfillment === "pickup" ? (
                                            <div className="rounded-[28px] border border-white/10 bg-black/10 p-4">
                                                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--app-primary)]">
                                                    Pickup Details
                                                </p>
                                                <p className="mt-2 text-sm leading-relaxed">
                                                    Pickup orders do not need a delivery address. We will prepare your order for counter collection.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--app-accent)]">
                                                            Delivery Address
                                                        </p>
                                                    </div>
                                                    <span
                                                        className="rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em]"
                                                        style={{
                                                            borderColor: "color-mix(in srgb, var(--app-accent) 30%, var(--app-border) 70%)",
                                                            background: "color-mix(in srgb, var(--app-accent) 14%, var(--app-surface) 86%)",
                                                            color: "var(--app-text)",
                                                        }}
                                                    >
                                                        Required
                                                    </span>
                                                </div>

                                                {customerToken && savedAddresses.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-sm font-semibold">Saved addresses</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setAddressMode("manual")}
                                                                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] transition hover:bg-black/5"
                                                            >
                                                                <Plus size={12} />
                                                                Use new address
                                                            </button>
                                                        </div>

                                                        <div className="space-y-2">
                                                            {savedAddresses.map((address) => {
                                                                const active =
                                                                    addressMode === "saved" &&
                                                                    String(selectedAddressId || "") === String(address?.id || "");
                                                                return (
                                                                    <button
                                                                        key={address.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setAddressMode("saved");
                                                                            setSelectedAddressId(String(address.id || ""));
                                                                        }}
                                                                        className="flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5"
                                                                        style={{
                                                                            borderColor: active
                                                                                ? "color-mix(in srgb, var(--app-accent) 40%, var(--app-border) 60%)"
                                                                                : "color-mix(in srgb, var(--app-border-strong) 40%, var(--app-border) 60%)",
                                                                            background: active
                                                                                ? "color-mix(in srgb, var(--app-accent) 15%, var(--app-surface) 85%)"
                                                                                : "color-mix(in srgb, var(--app-surface-2) 60%, var(--app-surface) 40%)",
                                                                        }}
                                                                    >
                                                                        <div className="flex min-w-0 items-start gap-3">
                                                                            <div
                                                                                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
                                                                                style={{
                                                                                    borderColor:
                                                                                        "color-mix(in srgb, var(--app-accent) 30%, var(--app-border) 70%)",
                                                                                    background: "color-mix(in srgb, var(--app-accent) 12%, transparent)",
                                                                                    color: "var(--app-accent)",
                                                                                }}
                                                                            >
                                                                                <MapPin size={15} />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <p className="text-sm font-semibold leading-tight">
                                                                                        {String(address.label || "Address").trim()}
                                                                                    </p>
                                                                                    {address.isDefault && (
                                                                                        <span className="rounded-full border border-[color:var(--app-accent)]/30 bg-[color:color-mix(in_srgb,var(--app-accent)_16%,var(--app-surface)_84%)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                                                                            Default
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="theme-muted mt-1 whitespace-pre-line text-xs leading-relaxed">
                                                                                    {formatSavedAddress(address)}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <span
                                                                            className="ml-2 shrink-0 rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em]"
                                                                            style={{
                                                                                borderColor: active
                                                                                    ? "color-mix(in srgb, var(--app-accent) 34%, var(--app-border) 66%)"
                                                                                    : "color-mix(in srgb, var(--app-border-strong) 40%, var(--app-border) 60%)",
                                                                                background: active
                                                                                    ? "color-mix(in srgb, var(--app-accent) 16%, var(--app-surface) 84%)"
                                                                                    : "color-mix(in srgb, var(--app-surface) 92%, transparent)",
                                                                                color: active ? "var(--app-text)" : "var(--app-muted-strong)",
                                                                            }}
                                                                        >
                                                                            {active ? "Selected" : "Select"}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {(addressMode === "manual" || !customerToken || savedAddresses.length === 0) && (
                                                    <div className="space-y-3">
                                                        {customerToken && savedAddresses.length > 0 && (
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-sm font-semibold">New address</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAddressMode("saved")}
                                                                    className="text-[11px] font-semibold text-[color:var(--app-accent)] underline decoration-dotted underline-offset-4 hover:opacity-80"
                                                                >
                                                                    Back to saved
                                                                </button>
                                                            </div>
                                                        )}
                                                        <label className="theme-muted mb-2 block text-sm">Delivery address</label>
                                                        <textarea
                                                            value={manualAddress}
                                                            onChange={(e) => setManualAddress(e.target.value)}
                                                            placeholder="House / Flat no, street, area, landmark, city, pincode"
                                                            rows={4}
                                                            className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                                        />
                                                    </div>
                                                )}

                                                {addressLoading && customerToken && (
                                                    <p className="theme-muted text-xs">Loading saved addresses...</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="order-1 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">Payment Methods</p>
                                            <h3 className="mt-1 text-lg font-semibold">Pick one</h3>
                                        </div>
                                        <p className="theme-muted inline-flex items-center gap-2 text-xs">
                                            <ShieldCheck size={14} className="theme-accent-text" />
                                            Secure payment
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod("UPI")}
                                            className={[
                                                "group relative flex min-h-[72px] items-center justify-between gap-2 overflow-hidden rounded-[20px] border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] hover:-translate-y-0.5",
                                                selectedPaymentMethod === "UPI" ? "ring-1 ring-[color:var(--app-primary)]" : "",
                                            ].join(" ")}
                                            aria-pressed={selectedPaymentMethod === "UPI"}
                                            style={getPaymentTileStyle("UPI", selectedPaymentMethod === "UPI")}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
                                                    style={{
                                                        borderColor: "color-mix(in srgb, var(--app-primary) 26%, var(--app-border) 74%)",
                                                        background: "color-mix(in srgb, var(--app-primary) 11%, transparent)",
                                                        color: "var(--app-primary)",
                                                    }}
                                                >
                                                    <QrCode size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold leading-tight tracking-tight">{getPaymentMethodTitle("UPI")}</p>
                                                    <p className="theme-muted mt-0.5 text-[10px] leading-tight">{getPaymentMethodSubtitle("UPI")}</p>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod("CASH")}
                                            className={[
                                                "group relative flex min-h-[72px] items-center justify-between gap-2 overflow-hidden rounded-[20px] border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] hover:-translate-y-0.5",
                                                selectedPaymentMethod === "CASH" ? "ring-1 ring-[color:var(--app-accent)]" : "",
                                            ].join(" ")}
                                            aria-pressed={selectedPaymentMethod === "CASH"}
                                            style={getPaymentTileStyle("CASH", selectedPaymentMethod === "CASH")}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
                                                    style={{
                                                        borderColor: "color-mix(in srgb, var(--app-accent) 30%, var(--app-border) 70%)",
                                                        background: "color-mix(in srgb, var(--app-accent) 12%, transparent)",
                                                        color: "var(--app-accent)",
                                                    }}
                                                >
                                                    <Banknote size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold leading-tight tracking-tight">
                                                        {getPaymentMethodTitle("CASH", selectedFulfillment)}
                                                    </p>
                                                    <p className="theme-muted mt-0.5 text-[10px] leading-tight">
                                                        {getPaymentMethodSubtitle("CASH", selectedFulfillment)}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em]"
                                                style={getPaymentBadgeStyle("CASH", selectedPaymentMethod === "CASH")}
                                            >
                                                COD
                                            </span>
                                        </button>
                                    </div>

                                    {paymentMethod === "UPI" && (
                                        <div className="space-y-3">
                                            <div className="rounded-2xl border p-3.5" style={getPaymentInfoStyle()}>
                                                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--app-primary)]">
                                                    Pay Via UPI ID
                                                </p>
                                                {upiPa ? (
                                                    <p className="mt-1 text-sm font-semibold tracking-tight">{upiPa}</p>
                                                ) : (
                                                    <p className="mt-1 text-sm font-medium text-red-400">Owner has not added a UPI ID yet.</p>
                                                )}
                                                <p className="theme-muted mt-2 text-xs leading-relaxed">
                                                    On mobile, this opens available apps like Google Pay, PhonePe, Paytm and others.
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {["Google Pay", "PhonePe", "Paytm", "BHIM"].map((appName) => (
                                                        <span
                                                            key={appName}
                                                            className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                                            style={{
                                                                borderColor: "color-mix(in srgb, var(--app-border-strong) 44%, var(--app-border) 56%)",
                                                                background: "color-mix(in srgb, var(--app-surface-2) 58%, var(--app-surface) 42%)",
                                                                color: "var(--app-muted-strong)",
                                                            }}
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
                                                                    : "border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface)_90%)] text-[color:var(--app-muted-strong)]"
                                                            }`}
                                                        >
                                                            <p className="font-semibold">
                                                                Order {placedOrder.orderNo || placedOrder.id} • Rs {toInr(placedOrder.total)}
                                                            </p>
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
                                                                className="rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface)_88%)] px-3 py-2 text-xs font-semibold text-[color:var(--app-text)] disabled:opacity-60"
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
                                                        <p className="theme-muted text-xs leading-relaxed">
                                                            After payment in UPI app, come back here and pick the status.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="theme-muted mt-3 text-xs leading-relaxed">
                                                        Place order first, then use the button above to open UPI apps.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="order-3 space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
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
                                            <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/10 p-4">
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

                                    </div>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setShowOptionalDetails((v) => !v)}
                                            className="flex w-full items-center justify-between text-left"
                                        >
                                            <span className="text-sm font-semibold">Customer details (optional)</span>
                                            <span className="theme-muted text-sm">{showOptionalDetails ? "Hide" : "Add / Edit"}</span>
                                        </button>

                                        {showOptionalDetails && (
                                            <div className="mt-4">
                                                <label className="theme-muted mb-2 block text-sm">Name</label>
                                                <input
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    placeholder={customer?.name || "Customer name"}
                                                    className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                                />
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
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </main>

            <footer className="shrink-0 border-t border-white/10 bg-black/60 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                        <p className="theme-muted text-[10px] font-extrabold uppercase tracking-[0.32em]">Total Payable</p>
                        <p className="mt-1 truncate text-lg font-bold tabular-nums">Rs {toInr(payableAmount)}</p>
                        {checkoutStep === "payment" && (
                            <p className="theme-muted mt-0.5 text-xs">
                                {getPaymentFooterHint(selectedPaymentMethod, isOnlineOrder, selectedFulfillment)}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {checkoutStep === "payment" && (
                            <button
                                type="button"
                                onClick={() => setCheckoutStep("summary")}
                                className="theme-soft-button inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold"
                            >
                                Back to Summary
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handlePrimaryAction}
                            disabled={submitting || (checkoutStep === "summary" && !cart?.length)}
                            className="theme-button inline-flex min-w-[200px] items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {submitting
                                ? "Working..."
                                : checkoutStep === "summary"
                                    ? "Continue to Payment"
                                    : getCheckoutActionLabel({
                                        paymentMethod: selectedPaymentMethod,
                                        placedOrder,
                                        customerToken,
                                        otpStep,
                                        payableAmount,
                                        isOnlineOrder,
                                        fulfillment: selectedFulfillment,
                                    })}
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
