import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeft,
    Banknote,
    CheckCircle2,
    CreditCard,
    IndianRupee,
    Landmark,
    LoaderCircle,
    MapPin,
    Plus,
    QrCode,
    RefreshCw,
    ShieldCheck,
    Wallet,
    X,
} from "lucide-react";
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
    if (s === "WALLET") return "WALLET";
    return "UPI";
};

const normalizeFulfillment = (value) => {
    const fulfillment = String(value || "").trim().toLowerCase();
    if (["pickup", "takeaway", "take_away", "counter"].includes(fulfillment)) return "pickup";
    if (["dinein", "dine_in", "table", "table_service"].includes(fulfillment)) return "dinein";
    if (["delivery", "online", "home_delivery", "door_delivery"].includes(fulfillment)) return "delivery";
    return "delivery";
};

const loadCashfreeSdk = () => {
    return new Promise((resolve) => {
        if (typeof window.Cashfree === "function") {
            resolve(window.Cashfree);
            return;
        }
        const existingScript = document.getElementById("cashfree-js-sdk");
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.Cashfree));
            return;
        }
        const script = document.createElement("script");
        script.id = "cashfree-js-sdk";
        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        script.onload = () => resolve(window.Cashfree);
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
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
    if (m === "PAY_LATER") return "Khata Pay Later";
    return "Pay Online (Recommended)";
};

const getPaymentMethodSubtitle = (value, fulfillment = "delivery") => {
    const m = normalizePaymentMethod(value);
    if (m === "CASH") {
        return fulfillment === "pickup"
            ? "Pay cash when you collect your order"
            : fulfillment === "dinein"
                ? "Pay cash when your order is served"
            : "Pay cash when your order arrives";
    }
    if (m === "PAY_LATER") return "Charge to Khata Credit";
    return "Secure by Cashfree • UPI, Cards, Net Banking & Wallets";
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
        if (placedOrder?.id) return "Open Cashfree Gateway";
        if (customerToken) return `Pay Rs ${toInr(payableAmount)} Online (Cashfree)`;
        if (!isOnlineOrder) return `Pay Rs ${toInr(payableAmount)} via Cashfree`;
        return otpStep === "otp"
            ? `Verify & Pay Rs ${toInr(payableAmount)} via Cashfree`
            : `Send OTP & Pay Rs ${toInr(payableAmount)} Online`;
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
    const [hasExistingName, setHasExistingName] = useState(false);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [otpStep, setOtpStep] = useState("ready"); // phone -> otp -> ready
    const [otp, setOtp] = useState("");
    const [otpExpiresAt, setOtpExpiresAt] = useState(null);
    const [devOtp, setDevOtp] = useState("");
    const [deliveryInfo, setDeliveryInfo] = useState(null);
    const [resolvedPhone, setResolvedPhone] = useState("");
    const [resolvedEmail, setResolvedEmail] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    const maskPhone = (phoneStr) => {
        const str = String(phoneStr || "").trim();
        if (!str) return "";
        const digits = str.replace(/[^\d]/g, "");
        if (!digits) return "";
        return `******${digits.slice(-4)}`;
    };

    const maskEmail = (emailStr) => {
        const str = String(emailStr || "").trim().toLowerCase();
        if (!str || !str.includes("@")) return "";
        const [name, domain] = str.split("@");
        if (!name) return "";
        const maskedName = name.length <= 2 ? `${name[0]}***` : `${name[0]}***${name[name.length - 1]}`;
        return `${maskedName}@${domain}`;
    };

    const getOtpDeliveryMessage = (deliveryObj) => {
        if (!deliveryObj) return "OTP sent to your WhatsApp.";
        const waOk = deliveryObj.whatsApp?.ok !== false && !deliveryObj.whatsApp?.skipped;
        if (waOk) return "OTP sent to your WhatsApp.";
        return "OTP sent to your mobile phone.";
    };

    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);
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

    const [couponInput, setCouponInput] = useState("");
    const [appliedCouponCode, setAppliedCouponCode] = useState("");
    const [couponError, setCouponError] = useState("");
    const [couponSuccess, setCouponSuccess] = useState("");

    const [pointsToRedeemInput, setPointsToRedeemInput] = useState("");
    const [redeemedLoyaltyPoints, setRedeemedLoyaltyPoints] = useState(0);
    const [loyaltyError, setLoyaltyError] = useState("");
    const [loyaltySuccess, setLoyaltySuccess] = useState("");

    const [previewBilling, setPreviewBilling] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const slug = String(restaurantContext?.slug || "").trim();
    const restaurantName = String(restaurantContext?.name || "CafeKing").trim() || "CafeKing";

    const { data: addressData, loading: addressLoading } = useCachedGet("/customer/address", {
        enabled: open && Boolean(customerToken),
        ttlMs: 15_000,
        staleMs: 5 * 60_000,
        scope: customer?.phone ? `customer:${customer.phone}` : "customer:session",
    });

    const { data: loyaltyData } = useCachedGet(slug ? `/customer/loyalty` : null, {
        enabled: open && Boolean(customerToken),
        ttlMs: 10_000,
    });

    const savedAddresses = useMemo(
        () => (Array.isArray(addressData?.addresses) ? addressData.addresses : []),
        [addressData]
    );

    // Re-calculate Authoritative Bill Preview from Backend
    useEffect(() => {
        if (!open || !slug || !cart || cart.length === 0) {
            setPreviewBilling(null);
            return;
        }

        let isCancelled = false;
        const fetchPreview = async () => {
            setPreviewLoading(true);
            try {
                const res = await api.post("/customer/checkout/preview", {
                    slug,
                    items: cart.map((i) => ({ id: i.id, quantity: i.quantity || 1 })),
                    couponCode: appliedCouponCode || undefined,
                    pointsToRedeem: redeemedLoyaltyPoints || undefined,
                }, getCustomerAuthConfig());

                if (!isCancelled && res.data?.billing) {
                    setPreviewBilling(res.data.billing);
                    if (res.data?.couponError) setCouponError(res.data.couponError);
                    if (res.data?.loyaltyError) setLoyaltyError(res.data.loyaltyError);
                }
            } catch (err) {
                // Ignore preview error fallback
            } finally {
                if (!isCancelled) setPreviewLoading(false);
            }
        };

        fetchPreview();

        return () => {
            isCancelled = true;
        };
    }, [open, slug, cart, appliedCouponCode, redeemedLoyaltyPoints, customerToken]);


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
        setHasExistingName(Boolean(customer?.name));
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
    const payableAmount = Number(placedOrder?.total || previewBilling?.total || cartSubtotal || 0);

    const handleApplyCoupon = async () => {
        if (!couponInput.trim()) return;
        setCouponError("");
        setCouponSuccess("");
        try {
            const res = await api.post("/customer/promotions/validate", {
                restaurantId: previewBilling?.restaurantId || undefined,
                slug,
                couponCode: couponInput.trim(),
                subtotal: cartSubtotal,
            }, getCustomerAuthConfig());

            if (res.data?.ok) {
                setAppliedCouponCode(res.data.code);
                setCouponSuccess(`Coupon "${res.data.code}" applied! Save ₹${res.data.discountAmount}`);
                setCouponInput("");
            } else {
                setCouponError(res.data?.message || "Invalid coupon code");
            }
        } catch (err) {
            setCouponError(err.response?.data?.message || "Failed to validate coupon");
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCouponCode("");
        setCouponSuccess("");
        setCouponError("");
    };

    const handleApplyLoyaltyPoints = () => {
        const pts = Math.max(0, Math.floor(Number(pointsToRedeemInput || 0)));
        setLoyaltyError("");
        setLoyaltySuccess("");
        if (pts <= 0) {
            setRedeemedLoyaltyPoints(0);
            return;
        }

        const available = Number(loyaltyData?.currentBalance || 0);
        if (pts > available) {
            setLoyaltyError(`Insufficient points. You have ${available} points.`);
            return;
        }

        setRedeemedLoyaltyPoints(pts);
        setLoyaltySuccess(`Applied ${pts} loyalty points.`);
    };

    const handleRemoveLoyaltyPoints = () => {
        setRedeemedLoyaltyPoints(0);
        setPointsToRedeemInput("");
        setLoyaltySuccess("");
        setLoyaltyError("");
    };

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
        setDeliveryInfo(otpRes.data?.delivery || null);
        setResolvedPhone(otpRes.data?.phone || normalizedPhone);
        setResolvedEmail(otpRes.data?.email || String(email || "").trim());
        setResendTimer(60);
        setSuccess("");

        const nameFromBackend = String(otpRes.data?.existingName || "").trim();
        const hasNameFromBackend = Boolean(otpRes.data?.hasName || nameFromBackend);
        if (hasNameFromBackend) {
            setHasExistingName(true);
            setCustomerName(nameFromBackend);
        } else if (customer?.name) {
            setHasExistingName(true);
            setCustomerName(customer.name);
        } else {
            setHasExistingName(false);
        }
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
                couponCode: appliedCouponCode || undefined,
                pointsToRedeem: redeemedLoyaltyPoints || undefined,
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

            // Tiffzy Wallet checkout flow
            if (selectedPaymentMethod === "WALLET") {
                await api.post("/api/wallet/pay-order", {
                    orderId,
                    amount: orderTotal,
                    idempotencyKey: `PAY_ORD_${orderId}_${Date.now()}`
                }, getCustomerAuthConfig());

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

                const sessionId = cashfreeRes?.data?.payment_session_id || cashfreeRes?.data?.paymentSessionId;

                if (!sessionId) {
                    throw new Error(cashfreeRes?.data?.message || "Cashfree payment session could not be created. Please verify Cashfree API credentials.");
                }

                const CashfreeSdk = await loadCashfreeSdk();
                if (CashfreeSdk) {
                    const isProdSession = cashfreeRes?.data?.is_production !== undefined
                        ? Boolean(cashfreeRes.data.is_production)
                        : String(cashfreeRes?.data?.cf_env || "").toUpperCase() === "PRODUCTION";

                    const envSetting = (import.meta.env.VITE_CASHFREE_ENV || "").toUpperCase();
                    const isProdHostname = typeof window !== "undefined" && (window.location.hostname.includes("tiffzy.com"));
                    const mode = isProdSession || envSetting === "PRODUCTION" || (isProdHostname && envSetting !== "TEST") ? "production" : "sandbox";
                    const cashfree = CashfreeSdk({ mode });

                    cashfree.checkout({
                        paymentSessionId: sessionId,
                    }).then(async (cfResult) => {
                        if (cfResult?.error) {
                            setError(cfResult.error.message || "Payment cancelled or failed. Please try again.");
                            setSubmitting(false);
                            return;
                        }

                        if (cfResult?.redirect) {
                            return;
                        }

                        // Query backend server-side verification after Cashfree modal interaction
                        const verifyRes = await api.get(`/api/payments/cashfree/status/${orderId}`, getCustomerAuthConfig());
                        const verifiedData = verifyRes?.data || {};

                        clearCart();
                        onClose();

                        const verifiedStatus = verifiedData.status || "UNKNOWN";
                        const queryStatus = verifiedStatus === "SUCCESS" ? "SUCCESS" : verifiedStatus;

                        navigate(
                            `/orders/thank-you?slug=${encodeURIComponent(slug)}&orderNo=${encodeURIComponent(orderNo)}&orderId=${encodeURIComponent(
                                String(orderId)
                            )}&paymentStatus=${encodeURIComponent(queryStatus)}`,
                            { replace: true, state: verifiedData }
                        );
                    }).catch((sdkErr) => {
                        console.error("Cashfree SDK Checkout Error:", sdkErr);
                        setError("Unable to open Cashfree Payment window. Please try again.");
                        setSubmitting(false);
                    });
                    return;
                }

                setError("Cashfree Payment SDK could not be loaded. Please refresh and try again.");
                setSubmitting(false);
                return;
            } catch (pgErr) {
                console.error("Cashfree PG Order Creation Error:", pgErr?.response?.data || pgErr);
                setError(
                    pgErr?.response?.data?.message ||
                    pgErr?.message ||
                    "Cashfree Gateway Unavailable. Please check API credentials or try Cash on Pickup."
                );
                setSubmitting(false);
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

                            {/* Feature 15: Coupons & Promotions Section */}
                            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">Offers & Coupons</p>
                                {appliedCouponCode ? (
                                    <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                                        <div>
                                            <p className="font-bold text-emerald-400">Coupon "{appliedCouponCode}" Applied</p>
                                            <p className="theme-muted text-[11px]">Saving ₹{toInr(previewBilling?.couponDiscount || 0)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveCoupon}
                                            className="font-bold text-red-400 underline decoration-dotted hover:opacity-80"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-2.5 flex gap-2">
                                        <input
                                            type="text"
                                            value={couponInput}
                                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                            placeholder="Enter Coupon Code (e.g. WELCOME100)"
                                            className="theme-input flex-1 rounded-xl px-3 py-2 text-xs font-bold outline-none uppercase"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleApplyCoupon}
                                            className="theme-button rounded-xl px-4 py-2 text-xs font-bold shrink-0"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                                {couponError && <p className="mt-1.5 text-xs text-red-400">{couponError}</p>}
                                {couponSuccess && <p className="mt-1.5 text-xs text-emerald-400">{couponSuccess}</p>}
                            </div>

                            {/* Feature 15: Loyalty & Rewards Redemption Section */}
                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Loyalty Rewards</p>
                                    {customerToken && (
                                        <span className="text-xs font-semibold theme-muted">
                                            Balance: <strong className="text-amber-300">{loyaltyData?.currentBalance || 0} pts</strong> (₹{toInr(loyaltyData?.equivalentValue || 0)})
                                        </span>
                                    )}
                                </div>

                                {!customerToken ? (
                                    <p className="theme-muted mt-2 text-xs">Log in with phone / OTP to redeem your accumulated loyalty points.</p>
                                ) : (
                                    <>
                                        {redeemedLoyaltyPoints > 0 ? (
                                            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                                                <div>
                                                    <p className="font-bold text-amber-300">Redeeming {redeemedLoyaltyPoints} Points</p>
                                                    <p className="theme-muted text-[11px]">Saving ₹{toInr(previewBilling?.loyaltyDiscount || 0)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveLoyaltyPoints}
                                                    className="font-bold text-red-400 underline decoration-dotted hover:opacity-80"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mt-2.5 flex gap-2">
                                                <input
                                                    type="number"
                                                    value={pointsToRedeemInput}
                                                    onChange={(e) => setPointsToRedeemInput(e.target.value)}
                                                    placeholder={`Max ${loyaltyData?.currentBalance || 0} points`}
                                                    min={1}
                                                    max={loyaltyData?.currentBalance || 0}
                                                    className="theme-input flex-1 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleApplyLoyaltyPoints}
                                                    className="theme-button rounded-xl px-4 py-2 text-xs font-bold shrink-0"
                                                >
                                                    Redeem Points
                                                </button>
                                            </div>
                                        )}
                                        {loyaltyError && <p className="mt-1.5 text-xs text-red-400">{loyaltyError}</p>}
                                        {loyaltySuccess && <p className="mt-1.5 text-xs text-amber-400">{loyaltySuccess}</p>}
                                    </>
                                )}
                            </div>

                            {/* Authoritative Server-Calculated Bill Breakdown */}
                            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2 text-xs">
                                <div className="flex justify-between theme-muted">
                                    <span>Subtotal</span>
                                    <span className="tabular-nums">₹{toInr(previewBilling?.subtotal || cartSubtotal)}</span>
                                </div>
                                {Number(previewBilling?.couponDiscount || 0) > 0 && (
                                    <div className="flex justify-between text-emerald-400 font-semibold">
                                        <span>Coupon Discount ({appliedCouponCode})</span>
                                        <span className="tabular-nums">-₹{toInr(previewBilling.couponDiscount)}</span>
                                    </div>
                                )}
                                {Number(previewBilling?.loyaltyDiscount || 0) > 0 && (
                                    <div className="flex justify-between text-amber-400 font-semibold">
                                        <span>Loyalty Discount ({redeemedLoyaltyPoints} pts)</span>
                                        <span className="tabular-nums">-₹{toInr(previewBilling.loyaltyDiscount)}</span>
                                    </div>
                                )}
                                {Number(previewBilling?.tax || 0) > 0 && (
                                    <div className="flex justify-between theme-muted">
                                        <span>Taxes</span>
                                        <span className="tabular-nums">₹{toInr(previewBilling.tax)}</span>
                                    </div>
                                )}
                                <div className="border-t border-white/10 pt-2 flex justify-between text-base font-bold">
                                    <span>Final Total</span>
                                    <span className="theme-price tabular-nums">₹{toInr(payableAmount)}</span>
                                </div>
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

                                <div className="order-1 space-y-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-bold sm:text-lg">Select Payment Method</h3>
                                                <p className="theme-muted text-xs">Choose how you would like to pay for this order.</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                                                <ShieldCheck size={14} />
                                                <span>Encrypted 256-bit</span>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {/* Tiffzy Wallet Option */}
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod("WALLET")}
                                                className={`group relative flex flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                                                    selectedPaymentMethod === "WALLET"
                                                        ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/5"
                                                        : "border-white/10 hover:border-white/20 bg-white/5"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                            selectedPaymentMethod === "WALLET" ? "border-amber-500/40 bg-amber-500/20 text-amber-400" : "border-white/10 bg-white/5 text-amber-400"
                                                        }`}>
                                                            <Wallet size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold sm:text-base">Tiffzy Wallet</span>
                                                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                                                                    1-Click Pay
                                                                </span>
                                                            </div>
                                                            <p className="theme-muted text-xs mt-0.5">Instant checkout from prepaid balance</p>
                                                        </div>
                                                    </div>
                                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                        selectedPaymentMethod === "WALLET" ? "border-amber-500 bg-amber-500 text-black" : "border-white/30"
                                                    }`}>
                                                        {selectedPaymentMethod === "WALLET" && <CheckCircle2 size={14} className="fill-current text-black" />}
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod("UPI")}
                                                className={`group relative flex flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                                                    selectedPaymentMethod === "UPI"
                                                        ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/5"
                                                        : "border-white/10 hover:border-white/20 bg-white/5"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                            selectedPaymentMethod === "UPI" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : "border-white/10 bg-white/5 text-amber-400"
                                                        }`}>
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold sm:text-base">Pay Online</span>
                                                                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                                                                    Recommended
                                                                </span>
                                                            </div>
                                                            <p className="theme-muted text-xs mt-0.5">Secure by Cashfree</p>
                                                        </div>
                                                    </div>
                                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                        selectedPaymentMethod === "UPI" ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/30"
                                                    }`}>
                                                        {selectedPaymentMethod === "UPI" && <CheckCircle2 size={14} className="fill-current text-white" />}
                                                    </div>
                                                </div>

                                                <div className="mt-1 flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                                                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">UPI</span>
                                                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold">Cards</span>
                                                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold">Net Banking</span>
                                                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold">Wallets</span>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod("CASH")}
                                                className={`group relative flex flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                                                    selectedPaymentMethod === "CASH"
                                                        ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/5"
                                                        : "border-white/10 hover:border-white/20 bg-white/5"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                            selectedPaymentMethod === "CASH" ? "border-amber-500/40 bg-amber-500/15 text-amber-400" : "border-white/10 bg-white/5 text-amber-400"
                                                        }`}>
                                                            <Banknote size={20} />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold sm:text-base">{getPaymentMethodTitle("CASH", selectedFulfillment)}</span>
                                                            <p className="theme-muted text-xs mt-0.5">{getPaymentMethodSubtitle("CASH", selectedFulfillment)}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                        selectedPaymentMethod === "CASH" ? "border-amber-500 bg-amber-500 text-black" : "border-white/30"
                                                    }`}>
                                                        {selectedPaymentMethod === "CASH" && <CheckCircle2 size={14} className="fill-current text-white" />}
                                                    </div>
                                                </div>

                                                <div className="mt-1 flex items-center justify-between pt-2 border-t border-white/10">
                                                    <span className="theme-muted text-[11px]">Pay when receiving order</span>
                                                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-400">
                                                        COD
                                                    </span>
                                                </div>
                                            </button>
                                        </div>

                                        {selectedPaymentMethod === "UPI" && (
                                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2.5">
                                                <ShieldCheck size={18} className="shrink-0 text-emerald-400" />
                                                <span>
                                                    You will be redirected to Cashfree Secure Checkout modal to complete payment via UPI, Cards, or Net Banking.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="order-3 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {!customerToken && (
                                            <div className="md:col-span-2">
                                                <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Phone Number or Email Address *</label>
                                                <input
                                                    value={phone || email}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val.includes("@")) {
                                                            setEmail(val);
                                                            setPhone("");
                                                        } else {
                                                            setPhone(val);
                                                            setEmail("");
                                                        }
                                                    }}
                                                    placeholder="Enter phone number or email address"
                                                    className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                />
                                            </div>
                                        )}

                                        {otpStep === "otp" && !customerToken && (
                                            <div className="checkout-paper-flat md:col-span-2 py-1 space-y-3">
                                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs space-y-1.5">
                                                    <div className="font-semibold flex items-center gap-1.5">
                                                        <span>✓</span> {getOtpDeliveryMessage(deliveryInfo)}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                                                        {(resolvedPhone || phone) && (
                                                            <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10">
                                                                WhatsApp: {maskPhone(resolvedPhone || phone)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="theme-muted mb-2 block text-[13px] sm:text-sm">Enter 6-Digit OTP</label>
                                                    <input
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        inputMode="numeric"
                                                        maxLength={6}
                                                        autoComplete="one-time-code"
                                                        placeholder="Enter 6-digit OTP"
                                                        className="theme-input w-full rounded-2xl px-4 py-3 text-center text-lg tracking-widest font-mono outline-none sm:text-xl"
                                                    />
                                                </div>

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
                                                        Change phone / email
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
                                                        disabled={submitting || resendTimer > 0}
                                                        className="theme-accent-text font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
                                                    >
                                                        {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
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

                                    {!hasExistingName && (
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
                                                    <label className="theme-muted mb-2 block text-[13px] sm:text-sm font-medium">Full Name (Optional)</label>
                                                    <input
                                                        value={customerName}
                                                        onChange={(e) => setCustomerName(e.target.value)}
                                                        placeholder={customer?.name || "Customer name"}
                                                        className="theme-input w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none sm:px-4 sm:py-3 sm:text-sm"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

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
