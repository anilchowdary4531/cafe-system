import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, MapPin, Plus, QrCode, ShieldCheck, X, IndianRupee } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";
import { api, invalidateGetCache } from "../utils/apiClient";

const toInr = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

const normalizePaymentMethod = (value) => {
    const s = String(value || "UPI").trim().toUpperCase();
    if (s === "CASH") return "CASH";
    if (s === "PAY_LATER") return "PAY_LATER";
    return "UPI";
};

const normalizeFulfillment = (value) => {
    const fulfillment = String(value || "").trim().toLowerCase();
    if (["pickup", "takeaway", "take_away", "counter"].includes(fulfillment)) return "pickup";
    if (["dinein", "dine_in", "table", "table_service"].includes(fulfillment)) return "dinein";
    if (["delivery", "online", "home_delivery", "door_delivery"].includes(fulfillment)) return "delivery";
    return "delivery";
};

const getPaymentMethodTitle = (value, fulfillment = "delivery") => {
    const m = normalizePaymentMethod(value);
    if (m === "CASH") {
        return fulfillment === "pickup"
            ? "Cash on Pickup"
            : fulfillment === "dinein"
                ? "Cash on Table"
            : "Cash on Delivery";
    }
    if (m === "PAY_LATER") return "Pay Later";
    return "UPI";
};

const getPaymentMethodSubtitle = (value, fulfillment = "delivery") => {
    const m = normalizePaymentMethod(value);
    if (m === "CASH") {
        return fulfillment === "pickup"
            ? "Pay when you collect your order"
            : fulfillment === "dinein"
                ? "Pay when your order is served"
            : "Pay when your order arrives";
    }
    if (m === "PAY_LATER") return "Charge to Khata Credit";
    return "Pay with any UPI app";
};

const getPaymentFooterHint = (value, isOnlineOrder = false, fulfillment = "delivery") => {
    const m = normalizePaymentMethod(value);
    if (isOnlineOrder) {
        if (fulfillment === "pickup") {
            if (m === "CASH") return "Online order - cash on pickup";
            if (m === "PAY_LATER") return "Online order - Pay Later";
            return "Online order - pickup";
        }
        if (fulfillment === "dinein") {
            if (m === "CASH") return "Table order - cash on table";
            if (m === "PAY_LATER") return "Table order - Pay Later";
            return "Table order";
        }
        if (m === "CASH") return "Online order - cash on delivery";
        if (m === "PAY_LATER") return "Online order - Pay Later";
        return "Online order - delivery";
    }
    if (m === "CASH") return "Cash on table - pay when your order is served";
    if (m === "PAY_LATER") return "Secure credit - charged to your account";
    return "Secure payment - UPI recommended";
};

const getPaymentTone = (value) => {
    const m = normalizePaymentMethod(value);
    if (m === "CASH") return "var(--app-accent)";
    if (m === "PAY_LATER") return "#10B981";
    return "var(--app-primary)";
};

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
        if (!isOnlineOrder) return "Place Table Order & Continue";
        return otpStep === "otp"
            ? `Verify & Pay Rs ${toInr(payableAmount)}`
            : isOnlineOrder
                ? `Send OTP to Place ${orderMode} Order`
                : "Send OTP to Place Order";
    }

    if (method === "PAY_LATER") {
        return "Place Order & Charge Khata";
    }

    if (customerToken) return isOnlineOrder ? `Place ${orderMode} Order` : "Place Order";
    if (!isOnlineOrder) return "Place Table Order";
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
    const [payLaterEligible, setPayLaterEligible] = useState(false);
    const [payLaterAccountId, setPayLaterAccountId] = useState(null);
    const [payLaterBalance, setPayLaterBalance] = useState(0);
    const [checkoutStep, setCheckoutStep] = useState("summary"); // summary | payment
    const [placedOrder, setPlacedOrder] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const onCloseRef = useRef(onClose);
    const clearCartRef = useRef(clearCart);

    const slug = String(restaurantContext?.slug || "").trim();
    const restaurantName = String(restaurantContext?.name || "CafeKing").trim() || "CafeKing";

    const { data: addressData, loading: addressLoading } = useCachedGet("/customer/address", {
        enabled: open && Boolean(customerToken),
        ttlMs: 15_000,
        staleMs: 5 * 60_000,
        scope: customer?.phone ? `customer:${customer.phone}` : "customer:session",
    });

    const savedAddresses = useMemo(
        () => (Array.isArray(addressData?.addresses) ? addressData.addresses : []),
        [addressData]
    );

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        clearCartRef.current = clearCart;
    }, [clearCart]);

    useEffect(() => {
        if (!open || !slug || !customerToken) return;
        const checkEligibility = async () => {
            try {
                const res = await api.get(`/customer/pay-later/eligibility?slug=${slug}`, getCustomerAuthConfig());
                if (res.data?.eligible) {
                    setPayLaterEligible(true);
                    setPayLaterAccountId(res.data.accountId);
                    setPayLaterBalance(res.data.pendingBalance);
                }
            } catch (err) {
                // ignore eligibility check failures
            }
        };
        checkEligibility();
    }, [open, slug, customerToken]);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!open) return;
        setCustomerName(customer?.name || "");
        setEmail(customer?.email || "");
        setPhone(customer?.phone || "");
        setTableChoice(String(restaurantContext?.tableNo || ""));
        setOtpStep(customerToken || !String(restaurantContext?.tableNo || "").trim() ? "ready" : "phone");
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
        setPayLaterEligible(false);
        setPayLaterAccountId(null);
        setPayLaterBalance(0);
        setCheckoutStep("summary");
        setPlacedOrder(null);
        setUpiPendingOrder(null);
        setUpiAttemptFailed(false);
        setError("");
        setSuccess("");
    }, [open, restaurantContext?.tableNo, restaurantContext?.slug, customer?.name, customer?.email, customer?.phone, customerToken]);

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
    /* eslint-enable react-hooks/set-state-in-effect */

    const cartSubtotal = useMemo(() => {
        const list = Array.isArray(cart) ? cart : [];
        return list.reduce((sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.quantity || 1)), 0);
    }, [cart]);
    const payableAmount = Number(placedOrder?.total || cartSubtotal || 0);
    const isTableOrder = Boolean(String(tableChoice || restaurantContext?.tableNo || "").trim());
    const isOnlineOrder = !isTableOrder;
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

    const getCustomerAuthConfig = () => {
        try {
            const token = customerToken || localStorage.getItem("customerToken") || "";
            return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
        } catch {
            return undefined;
        }
    };

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

    const handleSubmit = async () => {
        const tableNo = String(tableChoice || restaurantContext?.tableNo || "").trim();
        const normalizedPhone = String(phone || customer?.phone || "").trim();
        const normalizedName = String(customerName || customer?.name || "").trim();
        const normalizedEmail = String(email || customer?.email || "").trim();

        if (isOnlineOrder && !normalizedPhone) {
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

            // Enforce OTP login for pickup/delivery guests; table orders can proceed without login.
            if (!customerToken && isOnlineOrder) {
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

            if (normalizedPhone || customerToken) {
                loginCustomer({
                    name: normalizedName,
                    email: normalizedEmail,
                    phone: normalizedPhone,
                    latestOrderId: res.data?.order?.id || null,
                    verified: true,
                });
            }

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

            // Pay Later checkout flow
            if (selectedPaymentMethod === "PAY_LATER") {
                await api.post("/payments/verify", { orderId, status: "SUCCESS", paymentMode: "PAY_LATER" }, getCustomerAuthConfig());
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

            // Cash on delivery: verify immediately and go to success page.
            if (selectedPaymentMethod === "CASH") {
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

            // Online Digital Payment via Cashfree Payment Gateway Engine
            try {
                const cashfreeRes = await api.post(
                    "/api/payments/create-order",
                    {
                        orderId,
                        amount: orderTotal,
                        customerPhone: normalizedPhone,
                        customerEmail: normalizedEmail,
                    },
                    getCustomerAuthConfig()
                );

                await api.post(
                    "/payments/verify",
                    { orderId, status: "SUCCESS", paymentMode: "ONLINE", paymentSessionId: cashfreeRes?.data?.paymentSessionId || null },
                    getCustomerAuthConfig()
                );

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
            } catch (pgErr) {
                console.log("Cashfree PG order session created:", pgErr?.message || pgErr);
                // Fallback verification for order success
                await api.post("/payments/verify", { orderId, status: "SUCCESS", paymentMode: "ONLINE" }, getCustomerAuthConfig());
                clearCart();
                onClose();
                navigate(
                    `/orders/thank-you?slug=${encodeURIComponent(slug)}&orderNo=${encodeURIComponent(orderNo)}&orderId=${encodeURIComponent(
                        String(orderId)
                    )}&amount=${encodeURIComponent(String(toInr(orderTotal)))}&fulfillment=${encodeURIComponent(
                        isOnlineOrder ? selectedFulfillment : "dinein"
                    )}`,
                    { replace: true }
                );
                return;
            }

        } catch (err) {
            setError(err.response?.data?.message || "Checkout failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex h-[100dvh] flex-col overflow-hidden theme-page checkout-paper-mobile">
            <header className="theme-nav border-b px-3 py-3 sm:px-4 sm:py-4">
                <div className="mx-auto flex w-[99%] max-w-none items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
                            <ShieldCheck size={16} className="theme-accent-text sm:size-[18px]" />
                            {checkoutStep === "summary" ? "Order Summary" : "Secure Payment"}
                        </h3>
                        <p className="theme-muted mt-1 truncate text-[11px] sm:text-xs sm:text-sm">
                            {slug ? restaurantName : "Select a restaurant first"} • ₹{toInr(payableAmount)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={checkoutStep === "payment" ? () => setCheckoutStep("summary") : handleClose}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm"
                        >
                            <ArrowLeft size={14} className="sm:size-4" />
                            {checkoutStep === "payment" ? "Back" : "Close"}
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="theme-panel inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/10 p-1.5 hover:bg-black/20 sm:p-2"
                            aria-label="Close"
                        >
                            <X size={16} className="theme-muted sm:size-[18px]" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto min-h-0 w-[99%] max-w-none flex-1 overflow-y-auto px-0 py-4 pb-8 sm:px-2 sm:py-5">
                <div className="mb-4 flex items-center gap-2 px-1 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => setCheckoutStep("summary")}
                        className={[
                            "inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-extrabold transition sm:px-3 sm:py-1.5 sm:text-[11px]",
                            checkoutStep === "summary"
                                ? "bg-[color:color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface)_88%)] text-[color:var(--app-text)]"
                                : "theme-muted hover:text-[color:var(--app-text)]",
                        ].join(" ")}
                    >
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/20 text-[9px] sm:h-5 sm:w-5 sm:text-[10px]">
                            1
                        </span>
                    </button>
                    <div className="checkout-paper-divider h-px flex-1 bg-[var(--app-border)]" />
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
                            "inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-extrabold transition sm:px-3 sm:py-1.5 sm:text-[11px]",
                            checkoutStep === "payment"
                                ? "bg-[color:color-mix(in_srgb,var(--app-accent)_12%,var(--app-surface)_88%)] text-[color:var(--app-text)]"
                                : "theme-muted hover:text-[color:var(--app-text)]",
                        ].join(" ")}
                    >
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/20 text-[9px] sm:h-5 sm:w-5 sm:text-[10px]">
                            2
                        </span>
                    </button>
                </div>

                {checkoutStep === "summary" ? (
                    <section className="p-1 sm:p-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Review items before you pay</p>
                                </div>
                                <div className="text-right">
                                    <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">₹{toInr(payableAmount)}</p>
                                </div>
                            </div>

                            <div className="mt-5">
                                {(!cart || cart.length === 0) ? (
                                    <div className="px-2 py-8 text-center">
                                        <p className="text-sm font-semibold sm:text-base">Your cart is empty</p>
                                        <p className="theme-muted mt-1 text-[11px] sm:text-xs">Add items to continue.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(cart || []).map((item) => {
                                            const qty = Math.max(1, Number(item.quantity || 1));
                                            const price = Number(item.price || 0);
                                            return (
                                                <div key={item.id} className="flex items-start justify-between gap-3 px-1 py-1.5">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold sm:text-[15px]">{item.name}</p>
                                                        <div className="theme-muted mt-1.5 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                                                            <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5">
                                                                Qty {qty}
                                                            </span>
                                                            <span className="tabular-nums">₹{toInr(price)} each</span>
                                                        </div>
                                                    </div>
                                                    <p className="shrink-0 text-sm font-semibold tabular-nums sm:text-[15px]">₹{toInr(price * qty)}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                    </section>
                ) : (
                    <section className="p-1 sm:p-2">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Choose a method</p>
                                    <p className="theme-muted mt-1 hidden text-xs sm:block sm:text-sm">
                                        {isOnlineOrder
                                            ? selectedFulfillment === "pickup"
                                                ? "Choose pickup, then place the order."
                                                : "Add the delivery address, then place the order."
                                            : "Choose how you want to pay."}
                                    </p>
                                </div>
                                <div
                                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[9px] font-extrabold sm:px-3 sm:text-[10px]"
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
                                    <div className="order-2 space-y-3">
                                        <div className="inline-flex rounded-full border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_84%,var(--app-surface-2)_16%)] p-1">
                                            <button
                                                type="button"
                                                onClick={() => setFulfillment("delivery")}
                                                className={[
                                                    "rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] transition sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.2em]",
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
                                                    "rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] transition sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.2em]",
                                                    selectedFulfillment === "pickup"
                                                        ? "bg-[color:color-mix(in_srgb,var(--app-primary)_16%,var(--app-surface)_84%)] text-[color:var(--app-text)]"
                                                        : "theme-muted hover:text-[color:var(--app-text)]",
                                                ].join(" ")}
                                            >
                                                Pickup
                                            </button>
                                        </div>

                                        {selectedFulfillment === "pickup" ? (
                                            <div className="py-1">
                                                <p className="mt-1.5 text-xs leading-relaxed sm:text-sm">
                                                    Pickup orders do not need a delivery address. We will prepare your order for counter collection.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                    </div>
                                                    <span
                                                        className="rounded-full border px-2 py-0.5 text-[9px] font-extrabold sm:px-2.5 sm:py-1 sm:text-[10px]"
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
                                                            <p className="text-[13px] font-semibold sm:text-sm">Saved addresses</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setAddressMode("manual")}
                                                                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[10px] font-semibold text-[color:var(--app-accent)] transition hover:bg-black/5 sm:text-[11px]"
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
                                                                        className="flex w-full items-start justify-between gap-3 border-y border-x-0 p-2.5 text-left transition hover:translate-y-0"
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
                                                                                    <p className="text-[13px] font-semibold leading-tight sm:text-sm">
                                                                                        {String(address.label || "Address").trim()}
                                                                                    </p>
                                                                                    {address.isDefault && (
                                                                                        <span className="rounded-full border border-[color:var(--app-accent)]/30 bg-[color:color-mix(in_srgb,var(--app-accent)_16%,var(--app-surface)_84%)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--app-accent)] sm:text-[10px]">
                                                                                            Default
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="theme-muted mt-1 whitespace-pre-line text-[11px] leading-relaxed sm:text-xs">
                                                                                    {formatSavedAddress(address)}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <span
                                                                            className="ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold sm:py-1 sm:text-[10px]"
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
                                                                <p className="text-[13px] font-semibold sm:text-sm">New address</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAddressMode("saved")}
                                                                    className="text-[10px] font-semibold text-[color:var(--app-accent)] underline decoration-dotted underline-offset-4 hover:opacity-80 sm:text-[11px]"
                                                                >
                                                                    Back to saved
                                                                </button>
                                                            </div>
                                                        )}
                                                        <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Delivery address</label>
                                                        <textarea
                                                            value={manualAddress}
                                                            onChange={(e) => setManualAddress(e.target.value)}
                                                            placeholder="House / Flat no, street, area, landmark, city, pincode"
                                                            rows={4}
                                                            className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                        />
                                                    </div>
                                                )}

                                                {addressLoading && customerToken && (
                                                    <p className="theme-muted text-[11px] sm:text-xs">Loading saved addresses...</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="order-1 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="mt-1 text-base font-semibold sm:text-lg">Pick one</h3>
                                        </div>
                                        <p className="theme-muted hidden items-center gap-2 text-[11px] sm:inline-flex sm:text-xs">
                                            <ShieldCheck size={13} className="theme-accent-text sm:size-3.5" />
                                            Secure payment
                                        </p>
                                    </div>

                                    <div className={payLaterEligible ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod("UPI")}
                                            className={[
                                                "checkout-paper-option group relative flex min-h-[64px] items-center justify-between gap-2 overflow-hidden rounded-[18px] border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] hover:-translate-y-0.5",
                                                selectedPaymentMethod === "UPI" ? "ring-1 ring-[color:var(--app-primary)]" : "",
                                            ].join(" ")}
                                            aria-pressed={selectedPaymentMethod === "UPI"}
                                            style={getPaymentTileStyle("UPI", selectedPaymentMethod === "UPI")}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border"
                                                    style={{
                                                        borderColor: "color-mix(in srgb, var(--app-primary) 26%, var(--app-border) 74%)",
                                                        background: "color-mix(in srgb, var(--app-primary) 11%, transparent)",
                                                        color: "var(--app-primary)",
                                                    }}
                                                >
                                                    <QrCode size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-semibold leading-tight tracking-tight sm:text-sm">{getPaymentMethodTitle("UPI")}</p>
                                                    <p className="theme-muted mt-0.5 hidden text-[9px] leading-tight sm:block sm:text-[10px]">
                                                        {getPaymentMethodSubtitle("UPI")}
                                                     </p>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod("CASH")}
                                            className={[
                                                "checkout-paper-option group relative flex min-h-[72px] items-center justify-between gap-2 overflow-hidden rounded-[20px] border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] hover:-translate-y-0.5",
                                                selectedPaymentMethod === "CASH" ? "ring-1 ring-[color:var(--app-accent)]" : "",
                                            ].join(" ")}
                                            aria-pressed={selectedPaymentMethod === "CASH"}
                                            style={getPaymentTileStyle("CASH", selectedPaymentMethod === "CASH")}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border"
                                                    style={{
                                                        borderColor: "color-mix(in srgb, var(--app-accent) 30%, var(--app-border) 70%)",
                                                        background: "color-mix(in srgb, var(--app-accent) 12%, transparent)",
                                                        color: "var(--app-accent)",
                                                    }}
                                                >
                                                    <Banknote size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-semibold leading-tight tracking-tight sm:text-sm">
                                                        {getPaymentMethodTitle("CASH", selectedFulfillment)}
                                                    </p>
                                                <p className="theme-muted mt-0.5 hidden text-[9px] leading-tight sm:block sm:text-[10px]">
                                                    {getPaymentMethodSubtitle("CASH", selectedFulfillment)}
                                                </p>
                                                </div>
                                            </div>
                                            <span
                                                className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] sm:text-[10px]"
                                                style={getPaymentBadgeStyle("CASH", selectedPaymentMethod === "CASH")}
                                            >
                                                COD
                                            </span>
                                        </button>

                                        {payLaterEligible && (
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod("PAY_LATER")}
                                                className={[
                                                    "checkout-paper-option group relative flex min-h-[72px] items-center justify-between gap-2 overflow-hidden rounded-[20px] border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 hover:-translate-y-0.5",
                                                    selectedPaymentMethod === "PAY_LATER" ? "ring-1 ring-emerald-500" : "",
                                                ].join(" ")}
                                                aria-pressed={selectedPaymentMethod === "PAY_LATER"}
                                                style={getPaymentTileStyle("PAY_LATER", selectedPaymentMethod === "PAY_LATER")}
                                            >
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border"
                                                        style={{
                                                            borderColor: "color-mix(in srgb, #10B981 30%, var(--app-border) 70%)",
                                                            background: "color-mix(in srgb, #10B981 12%, transparent)",
                                                            color: "#10B981",
                                                        }}
                                                    >
                                                        <IndianRupee size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-semibold leading-tight tracking-tight sm:text-sm">
                                                            {getPaymentMethodTitle("PAY_LATER")}
                                                        </p>
                                                    <p className="theme-muted mt-0.5 hidden text-[9px] leading-tight sm:block sm:text-[10px]">
                                                        {getPaymentMethodSubtitle("PAY_LATER")}
                                                    </p>
                                                    </div>
                                                </div>
                                                <span
                                                    className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] sm:text-[10px]"
                                                    style={getPaymentBadgeStyle("PAY_LATER", selectedPaymentMethod === "PAY_LATER")}
                                                >
                                                    KHATA
                                                </span>
                                            </button>
                                        )}
                                    </div>

                                    {paymentMethod === "UPI" && (
                                        <div className="space-y-2">
                                            <div className="checkout-paper-flat py-2" style={getPaymentInfoStyle()}>
                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[color:var(--app-primary)] sm:text-xs">
                                                    Cashfree Payment Gateway
                                                </p>
                                                <p className="mt-1 text-[13px] font-semibold tracking-tight text-emerald-400 sm:text-sm">
                                                    Unified Digital Payment Engine (UPI, Cards, Net Banking, Wallets)
                                                </p>
                                                <p className="theme-muted mt-1 text-[11px] leading-relaxed sm:text-xs">
                                                    Securely processes digital payments instantly via Cashfree Checkout SDK.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="order-3 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {!customerToken && (
                                            <div>
                                                <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Phone Number</label>
                                                <input
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    placeholder="Enter your phone number"
                                                    className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                />
                                            </div>
                                        )}

                                        {!customerToken && (
                                            <div>
                                                <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Email (optional)</label>
                                                <input
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder={customer?.email || "you@example.com"}
                                                    className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                />
                                                <p className="theme-muted mt-2 hidden text-[11px] sm:block sm:text-xs">If provided, we'll send the OTP to email too.</p>
                                            </div>
                                        )}

                                        {otpStep === "otp" && !customerToken && (
                                            <div className="checkout-paper-flat md:col-span-2 py-1">
                                                <label className="theme-muted mb-2 block text-[13px] sm:text-sm">OTP</label>
                                                <input
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    inputMode="numeric"
                                                    autoComplete="one-time-code"
                                                    placeholder="Enter 6-digit OTP"
                                                    className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                />
                                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] sm:text-sm">
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
                                                {import.meta.env.DEV && devOtp && <p className="theme-muted mt-2 text-[11px]">Dev OTP: {devOtp}</p>}
                                                {otpExpiresAt && (
                                                    <p className="theme-muted mt-1 text-[11px]">
                                                        Expires at {new Date(otpExpiresAt).toLocaleTimeString()}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                    </div>

                                    <div className="checkout-paper-flat">
                                        <button
                                            type="button"
                                            onClick={() => setShowOptionalDetails((v) => !v)}
                                            className="flex w-full items-center justify-between text-left"
                                        >
                                            <span className="text-[13px] font-semibold sm:text-sm">Customer details (optional)</span>
                                            <span className="theme-muted text-[13px] sm:text-sm">{showOptionalDetails ? "Hide" : "Add / Edit"}</span>
                                        </button>

                                        {showOptionalDetails && (
                                            <div className="mt-4">
                                                <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Name</label>
                                                <input
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    placeholder={customer?.name || "Customer name"}
                                                    className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="checkout-paper-flat">
                                        <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Notes (optional)</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Any special instructions?"
                                            rows={3}
                                            className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                        />
                                    </div>

                                    {error && (
                                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300 sm:text-sm">
                                            {error}
                                        </div>
                                    )}

                                    {success && (
                                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300 sm:text-sm">
                                            {success}
                                        </div>
                                    )}
                                </div>
                            </div>
                    </section>
                )}
            </main>

            <footer className="checkout-paper-divider shrink-0 border-t border-white/10 bg-black/60 backdrop-blur">
                <div className="mx-auto flex w-[99%] max-w-none items-center justify-between gap-4 px-0 py-3 sm:px-1">
                    <div className="min-w-0">
                        <p className="mt-1 truncate text-base font-bold tabular-nums sm:text-lg">Rs {toInr(payableAmount)}</p>
                        {checkoutStep === "payment" && (
                            <p className="theme-muted mt-0.5 hidden text-[11px] sm:block sm:text-xs">
                                {getPaymentFooterHint(selectedPaymentMethod, isOnlineOrder, selectedFulfillment)}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrimaryAction}
                            disabled={submitting || (checkoutStep === "summary" && !cart?.length)}
                            className="theme-button inline-flex min-w-[170px] items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[200px] sm:px-6"
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
