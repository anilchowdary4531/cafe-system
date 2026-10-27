import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    CreditCard,
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
    if (m === "WALLET") return "Tiffzy Wallet";
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
    if (m === "WALLET") return "Instant checkout from prepaid balance";
    return "Secure by Cashfree • UPI, Cards, Net Banking & Wallets";
};

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

    if (method === "WALLET") {
        return `Pay Rs ${toInr(payableAmount)} with Wallet`;
    }

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

    if (customerToken) return isOnlineOrder ? `Place ${orderMode} Order (Cash)` : "Place Table Order (Cash)";
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
    const [fulfillment, setFulfillment] = useState(() => (String(restaurantContext?.tableNo || "").trim() ? "dinein" : "pickup"));
    const [selectedAddressId, setSelectedAddressId] = useState("");
    const [manualAddress, setManualAddress] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("UPI"); // UPI | WALLET | CASH | PAY_LATER
    const [payLaterEligible, setPayLaterEligible] = useState(false);
    const [payLaterAccountId, setPayLaterAccountId] = useState(null);
    const [payLaterBalance, setPayLaterBalance] = useState(0);
    // checkoutStep kept internally for compatibility; UI renders unified page directly
    const [checkoutStep, setCheckoutStep] = useState("unified");
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
    const [previewError, setPreviewError] = useState(null);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const previewRequestIdRef = useRef(0);

    let routeSlug = "";
    try {
        const routeParams = useParams();
        routeSlug = routeParams?.slug || "";
    } catch {
        // no router context
    }

    const slug = String(
        routeSlug ||
        restaurantContext?.slug ||
        cart?.[0]?.restaurantSlug ||
        cart?.[0]?.restaurant?.slug ||
        ""
    ).trim();

    const restaurantName = String(
        restaurantContext?.name ||
        cart?.[0]?.restaurantName ||
        cart?.[0]?.restaurant?.name ||
        (slug ? slug : "CafeKing")
    ).trim() || "CafeKing";

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

    const isTableOrder = Boolean(String(tableChoice || restaurantContext?.tableNo || "").trim());
    const isOnlineOrder = !isTableOrder;
    const selectedFulfillment = isOnlineOrder ? normalizeFulfillment(fulfillment) : "dinein";

    // Authoritative Bill Preview from Backend
    useEffect(() => {
        if (!open || !slug || !cart || cart.length === 0) {
            setPreviewBilling(null);
            setPreviewError(null);
            return;
        }

        const requestId = ++previewRequestIdRef.current;
        const abortController = new AbortController();

        const fetchPreview = async () => {
            setPreviewLoading(true);
            try {
                const rawRestId = restaurantContext?.id || cart?.[0]?.restaurantId;
                const parsedRestId = Number(rawRestId);
                const validRestId = Number.isInteger(parsedRestId) && parsedRestId > 0 ? parsedRestId : undefined;

                const res = await api.post(
                    "/customer/checkout/preview",
                    {
                        slug,
                        restaurantId: validRestId,
                        items: cart.map((i) => ({
                            id: i.id || i.menuItemId,
                            menuItemId: i.menuItemId || i.id,
                            name: i.name || i.itemName,
                            price: i.price !== undefined ? Number(i.price) : undefined,
                            quantity: Math.max(1, Number(i.quantity || i.qty || 1)),
                            qty: Math.max(1, Number(i.quantity || i.qty || 1)),
                            variantId: i.variantId || i.variant?.id,
                            selectedModifiers: i.selectedModifiers,
                        })),
                        couponCode: appliedCouponCode || undefined,
                        pointsToRedeem: redeemedLoyaltyPoints || undefined,
                        fulfillment: isTableOrder ? "dinein" : selectedFulfillment,
                        tableNumber: String(tableChoice || restaurantContext?.tableNo || "").trim() || undefined,
                    },
                    {
                        ...(getCustomerAuthConfig() || {}),
                        signal: abortController.signal,
                    }
                );

                if (requestId === previewRequestIdRef.current && res.data?.billing) {
                    setPreviewBilling(res.data.billing);
                    setPreviewError(null);
                    if (res.data?.couponError) setCouponError(res.data.couponError);
                    if (res.data?.loyaltyError) setLoyaltyError(res.data.loyaltyError);
                }
            } catch (err) {
                if (err.name === "CanceledError" || err.name === "AbortError" || err.code === "ERR_CANCELED") {
                    return;
                }
                if (requestId === previewRequestIdRef.current) {
                    const msg = err.response?.data?.message || "Failed to calculate order preview";
                    setPreviewError(msg);
                }
            } finally {
                if (requestId === previewRequestIdRef.current) {
                    setPreviewLoading(false);
                }
            }
        };

        fetchPreview();

        return () => {
            abortController.abort();
        };
    }, [open, slug, cart, appliedCouponCode, redeemedLoyaltyPoints, customerToken, selectedFulfillment, tableChoice, restaurantContext?.tableNo, retryTrigger]);

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
            } catch {
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
        setCheckoutStep("unified");
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

    // Reset placedOrder if cart or checkout details change to ensure clean recalculation
    useEffect(() => {
        setPlacedOrder(null);
    }, [cart, appliedCouponCode, redeemedLoyaltyPoints, selectedFulfillment]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const cartSubtotal = useMemo(() => {
        const list = Array.isArray(cart) ? cart : [];
        return list.reduce((sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.quantity || it.qty || 1)), 0);
    }, [cart]);

    const payableAmount = Number(placedOrder?.total ?? previewBilling?.total ?? cartSubtotal ?? 0);

    const handleApplyCoupon = async () => {
        if (!couponInput.trim()) return;
        setCouponError("");
        setCouponSuccess("");
        try {
            const res = await api.post(
                "/customer/promotions/validate",
                {
                    restaurantId: previewBilling?.restaurantId || undefined,
                    slug,
                    couponCode: couponInput.trim(),
                    subtotal: cartSubtotal,
                },
                getCustomerAuthConfig()
            );

            if (res.data?.ok) {
                setAppliedCouponCode(res.data.code);
                setCouponSuccess(`Coupon "${res.data.code}" applied! Save ₹${toInr(res.data.discountAmount)}`);
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
        return { latitude, longitude };
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

    const requestOtp = async (normalizedPhone) => {
        const otpRes = await api.post("/customer/send-otp", {
            phone: normalizedPhone,
            email: String(email || "").trim(),
        });
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

        if (previewLoading) {
            setError("Calculating bill. Please wait a moment...");
            return;
        }

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
                    id: item.id || item.menuItemId,
                    menuItemId: item.menuItemId || item.id,
                    name: item.name || item.itemName,
                    price: item.price !== undefined ? Number(item.price) : undefined,
                    qty: Math.max(1, Number(item.quantity || item.qty || 1)),
                    variantId: item.variantId || item.variant?.id,
                    selectedModifiers: item.selectedModifiers,
                })),
            };

            // Reuse placed order if already created in database to prevent duplicate orders upon gateway retry
            let orderId = Number(placedOrder?.id || 0);
            let orderTotal = Number(placedOrder?.total || 0);
            let orderNo = String(placedOrder?.orderNo || orderId || "").trim();

            if (!orderId) {
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
                orderId = Number(order?.id || 0);
                orderTotal = Number(order?.total || 0);
                orderNo = String(order?.orderNo || orderId || "").trim();

                if (!orderId) {
                    setError("Order created but missing id");
                    return;
                }

                setPlacedOrder({
                    id: orderId,
                    orderNo,
                    total: orderTotal,
                    fulfillment: isOnlineOrder ? selectedFulfillment : "dinein",
                });
            }

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
                await api.post(
                    "/api/wallet/pay-order",
                    {
                        orderId,
                        amount: orderTotal,
                        idempotencyKey: `PAY_ORD_${orderId}_${Date.now()}`,
                    },
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
            }

            // Cash on delivery / pickup / table flow
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
                    const isProdSession =
                        cashfreeRes?.data?.is_production !== undefined
                            ? Boolean(cashfreeRes.data.is_production)
                            : String(cashfreeRes?.data?.cf_env || "").toUpperCase() === "PRODUCTION";

                    const envSetting = (import.meta.env.VITE_CASHFREE_ENV || "").toUpperCase();
                    const isProdHostname = typeof window !== "undefined" && window.location.hostname.includes("tiffzy.com");
                    const mode = isProdSession || envSetting === "PRODUCTION" || (isProdHostname && envSetting !== "TEST") ? "production" : "sandbox";
                    const cashfree = CashfreeSdk({ mode });

                    cashfree
                        .checkout({
                            paymentSessionId: sessionId,
                        })
                        .then(async (cfResult) => {
                            if (cfResult?.error) {
                                setError(cfResult.error.message || "Payment cancelled or failed. Please try again.");
                                setSubmitting(false);
                                return;
                            }

                            if (cfResult?.redirect) {
                                return;
                            }

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
                        })
                        .catch((sdkErr) => {
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

    const handlePrimaryAction = async () => {
        if (!cart?.length) {
            setError("Your cart is empty.");
            return;
        }
        await handleSubmit();
    };

    const actionButtonLabel = getCheckoutActionLabel({
        paymentMethod: selectedPaymentMethod,
        placedOrder,
        customerToken,
        otpStep,
        payableAmount,
        isOnlineOrder,
        fulfillment: selectedFulfillment,
    });

    return (
        <div className="fixed inset-0 z-[70] flex h-[100dvh] flex-col overflow-hidden theme-page checkout-paper-mobile">
            {/* UNIFIED HEADER */}
            <header className="theme-nav shrink-0 border-b px-3 py-3 sm:px-6 sm:py-4">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
                            <ShieldCheck size={18} className="theme-accent-text" />
                            Order Checkout
                        </h3>
                        <p className="theme-muted mt-0.5 truncate text-xs sm:text-sm">
                            {slug ? restaurantName : "Select a restaurant first"} • ₹{toInr(payableAmount)}
                            {isTableOrder && ` • Table ${tableChoice || restaurantContext?.tableNo}`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="theme-soft-button inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="theme-panel inline-flex items-center justify-center rounded-2xl border border-[var(--app-border)] bg-black/5 p-1.5 hover:bg-black/10 sm:p-2"
                            aria-label="Close"
                        >
                            <X size={16} className="theme-muted sm:size-[18px]" />
                        </button>
                    </div>
                </div>
            </header>

            {/* UNIFIED MAIN BODY */}
            <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-6 sm:py-5 sm:pb-28">
                <div className="grid grid-cols-1 gap-8 items-start lg:grid-cols-12">
                    {/* LEFT COLUMN: Fulfillment, Customer Info, Items Review, Cooking Notes */}
                    <div className="space-y-5 lg:col-span-7 lg:border-r lg:border-[var(--app-border)] lg:pr-8">
                        {/* 1. Fulfillment Mode */}
                        <div className="space-y-2.5 pb-5 border-b border-[var(--app-border)]">
                            {isTableOrder ? (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-400">
                                        <QrCode size={18} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold sm:text-base text-orange-300">
                                                Table {tableChoice || restaurantContext?.tableNo} • Dine-In
                                            </span>
                                            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400 border border-orange-500/30">
                                                Active Session
                                            </span>
                                        </div>
                                        <p className="theme-muted text-xs mt-0.5">
                                            Order will be prepared and served directly to your table.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                            Fulfillment Mode
                                        </h4>
                                        <div className="inline-flex rounded-full border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_84%,var(--app-surface-2)_16%)] p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setFulfillment("delivery")}
                                                className={[
                                                    "rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] transition sm:px-4 sm:py-2 sm:text-[11px]",
                                                    selectedFulfillment === "delivery"
                                                        ? "bg-[color:color-mix(in_srgb,var(--app-accent)_16%,var(--app-surface)_84%)] text-[color:var(--app-text)] shadow-sm"
                                                        : "theme-muted hover:text-[color:var(--app-text)]",
                                                ].join(" ")}
                                            >
                                                Delivery
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFulfillment("pickup")}
                                                className={[
                                                    "rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] transition sm:px-4 sm:py-2 sm:text-[11px]",
                                                    selectedFulfillment === "pickup"
                                                        ? "bg-[color:color-mix(in_srgb,var(--app-primary)_16%,var(--app-surface)_84%)] text-[color:var(--app-text)] shadow-sm"
                                                        : "theme-muted hover:text-[color:var(--app-text)]",
                                                ].join(" ")}
                                            >
                                                Pickup
                                            </button>
                                        </div>
                                    </div>

                                    {selectedFulfillment === "pickup" ? (
                                        <p className="theme-muted text-xs leading-relaxed pt-0.5">
                                            Pickup orders do not need a delivery address. We will prepare your order for counter collection at {restaurantName}.
                                        </p>
                                    ) : (
                                        <div className="space-y-2.5 pt-1">
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
                                                                    className="flex w-full items-start justify-between gap-3 rounded-xl border p-2.5 text-left transition"
                                                                    style={{
                                                                        borderColor: active
                                                                            ? "color-mix(in srgb, var(--app-accent) 40%, var(--app-border) 60%)"
                                                                            : "color-mix(in srgb, var(--app-border-strong) 40%, var(--app-border) 60%)",
                                                                        background: active
                                                                            ? "color-mix(in srgb, var(--app-accent) 15%, var(--app-surface) 85%)"
                                                                            : "color-mix(in srgb, var(--app-surface-2) 60%, var(--app-surface) 40%)",
                                                                    }}
                                                                >
                                                                    <div className="flex min-w-0 items-start gap-2.5">
                                                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--app-accent)]/10 text-[color:var(--app-accent)]">
                                                                            <MapPin size={14} />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-xs font-semibold leading-tight sm:text-[13px]">
                                                                                    {String(address.label || "Address").trim()}
                                                                                </p>
                                                                                {address.isDefault && (
                                                                                    <span className="rounded-full bg-[color:var(--app-accent)]/20 px-1.5 py-0.2 text-[9px] font-bold text-[color:var(--app-accent)]">
                                                                                        Default
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="theme-muted mt-0.5 whitespace-pre-line text-[11px] leading-relaxed">
                                                                                {formatSavedAddress(address)}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <span
                                                                        className="ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold"
                                                                        style={{
                                                                            borderColor: active ? "var(--app-accent)" : "var(--app-border)",
                                                                            color: active ? "var(--app-text)" : "var(--app-muted)",
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
                                                <div className="space-y-2">
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
                                                    <label className="theme-muted block text-xs font-medium">Delivery Address *</label>
                                                    <textarea
                                                        value={manualAddress}
                                                        onChange={(e) => setManualAddress(e.target.value)}
                                                        placeholder="House/flat number, building, street, area, landmark, pincode"
                                                        rows={2}
                                                        className="theme-input w-full rounded-xl px-3 py-2 text-xs outline-none sm:text-sm"
                                                    />
                                                </div>
                                            )}

                                            {addressLoading && customerToken && (
                                                <p className="theme-muted text-[11px]">Loading saved addresses...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. Customer Identification (for Guests) */}
                        {!customerToken && !isTableOrder && (
                            <div className="space-y-2.5 pb-5 border-b border-[var(--app-border)]">
                                <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                    Customer Contact *
                                </h4>
                                <div>
                                    <label className="theme-muted mb-1 block text-xs">Mobile Phone or WhatsApp *</label>
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
                                        placeholder="Enter 10-digit mobile number"
                                        className="theme-input w-full rounded-xl px-3 py-2 text-xs outline-none sm:text-sm"
                                    />
                                </div>

                                {otpStep === "otp" && (
                                    <div className="space-y-2.5 rounded-xl border border-[var(--app-primary)]/25 bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] p-3 text-xs mt-2">
                                        <div className="flex items-center gap-1.5 text-[color:var(--app-primary)] font-semibold">
                                            <span>✓</span> {getOtpDeliveryMessage(deliveryInfo)}
                                        </div>
                                        {(resolvedPhone || phone) && (
                                            <div className="font-mono text-[11px] theme-muted">
                                                WhatsApp: {maskPhone(resolvedPhone || phone)}
                                            </div>
                                        )}
                                        <div>
                                            <label className="theme-muted mb-1 block text-xs">Enter 6-Digit OTP</label>
                                            <input
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                inputMode="numeric"
                                                maxLength={6}
                                                autoComplete="one-time-code"
                                                placeholder="6-digit OTP"
                                                className="theme-input w-full rounded-xl px-3 py-2 text-center text-lg tracking-widest font-mono outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOtpStep("phone");
                                                    setOtp("");
                                                    setOtpExpiresAt(null);
                                                }}
                                                className="theme-muted underline decoration-dotted"
                                            >
                                                Change number
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => requestOtp(String(phone || customer?.phone || "").trim())}
                                                disabled={submitting || resendTimer > 0}
                                                className="theme-accent-text font-semibold disabled:opacity-50"
                                            >
                                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                                            </button>
                                        </div>
                                        {import.meta.env.DEV && devOtp && <p className="theme-muted text-[10px]">Dev OTP: {devOtp}</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. Order Items Review */}
                        <div className="space-y-2.5 pb-5 border-b border-[var(--app-border)]">
                            <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                        Order Items Review
                                    </h4>
                                    <p className="theme-muted text-xs mt-0.5">
                                        {cart?.length || 0} {cart?.length === 1 ? "item" : "items"} in cart
                                    </p>
                                </div>
                                <span className="text-xs sm:text-sm font-bold tabular-nums">
                                    Subtotal: ₹{toInr(cartSubtotal)}
                                </span>
                            </div>

                            <div>
                                {!cart || cart.length === 0 ? (
                                    <div className="py-4 text-center">
                                        <p className="text-sm font-semibold">Your cart is empty</p>
                                        <p className="theme-muted mt-1 text-xs">Add items to continue.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[var(--app-border)] max-h-64 overflow-y-auto pr-1">
                                        {cart.map((item) => {
                                            const qty = Math.max(1, Number(item.quantity || item.qty || 1));
                                            const price = Number(item.price || 0);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-[var(--app-text)]">{item.name}</p>
                                                        <div className="theme-muted mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                                                            <span className="rounded border border-[var(--app-border)] bg-[var(--app-surface-2)] px-1.5 py-0.2 font-bold">
                                                                Qty {qty}
                                                            </span>
                                                            <span className="tabular-nums">₹{toInr(price)} each</span>
                                                        </div>
                                                    </div>
                                                    <p className="shrink-0 font-bold tabular-nums">
                                                        ₹{toInr(price * qty)}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Special Cooking Instructions */}
                        <div className="space-y-2 pb-5 border-b border-[var(--app-border)]">
                            <label className="theme-muted mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                Special Cooking Instructions (optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. Less spicy, extra sauce, allergy notes"
                                rows={2}
                                className="theme-input w-full rounded-xl px-3 py-2 text-xs outline-none sm:text-sm"
                            />
                        </div>

                        {/* 4. Offers & Coupons */}
                        <div className="space-y-2 pb-5 border-b border-[var(--app-border)]">
                            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                Offers & Coupons
                            </h4>
                            {appliedCouponCode ? (
                                <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--app-primary)]/30 bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] px-3 py-2 text-xs">
                                    <div>
                                        <p className="font-bold text-[color:var(--app-primary)]">Coupon "{appliedCouponCode}" Applied</p>
                                        <p className="theme-muted text-[11px]">Saving ₹{toInr(previewBilling?.couponDiscount || 0)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveCoupon}
                                        className="font-bold text-red-500 underline decoration-dotted hover:opacity-80"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={couponInput}
                                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                        placeholder="Enter code (e.g. WELCOME50)"
                                        className="theme-input flex-1 rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyCoupon}
                                        className="theme-button shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold"
                                    >
                                        Apply
                                    </button>
                                </div>
                            )}
                            {couponError && <p className="mt-1 text-xs text-red-500">{couponError}</p>}
                            {couponSuccess && <p className="mt-1 text-xs text-[color:var(--app-primary)] font-semibold">{couponSuccess}</p>}
                        </div>

                        {/* 5. Loyalty Rewards */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                    Loyalty Rewards
                                </h4>
                                {customerToken && (
                                    <span className="text-xs font-semibold theme-muted">
                                        Balance: <strong className="text-[color:var(--app-primary)]">{loyaltyData?.currentBalance || 0} pts</strong> (₹{toInr(loyaltyData?.equivalentValue || 0)})
                                    </span>
                                )}
                            </div>

                            {!customerToken ? (
                                <p className="theme-muted text-xs">
                                    Log in with your phone to redeem your accumulated reward points.
                                </p>
                            ) : (
                                <>
                                    {redeemedLoyaltyPoints > 0 ? (
                                        <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--app-primary)]/30 bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] px-3 py-2 text-xs">
                                            <div>
                                                <p className="font-bold text-[color:var(--app-primary)]">Redeeming {redeemedLoyaltyPoints} Points</p>
                                                <p className="theme-muted text-[11px]">Saving ₹{toInr(previewBilling?.loyaltyDiscount || 0)}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveLoyaltyPoints}
                                                className="font-bold text-red-500 underline decoration-dotted hover:opacity-80"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                type="number"
                                                value={pointsToRedeemInput}
                                                onChange={(e) => setPointsToRedeemInput(e.target.value)}
                                                placeholder={`Max ${loyaltyData?.currentBalance || 0} pts`}
                                                min={1}
                                                max={loyaltyData?.currentBalance || 0}
                                                className="theme-input flex-1 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleApplyLoyaltyPoints}
                                                className="theme-button shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold"
                                            >
                                                Redeem
                                            </button>
                                        </div>
                                    )}
                                    {loyaltyError && <p className="mt-1 text-xs text-red-500">{loyaltyError}</p>}
                                    {loyaltySuccess && <p className="mt-1 text-xs text-[color:var(--app-primary)] font-semibold">{loyaltySuccess}</p>}
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Payment Method, Bill Summary */}
                    <div className="space-y-5 lg:col-span-5">
                        {/* 1. Payment Method Selection */}
                        <div className="space-y-2.5 pb-5 border-b border-[var(--app-border)]">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                    Select Payment Method
                                </h4>
                                <div className="flex items-center gap-1 text-[11px] font-semibold theme-muted">
                                    <ShieldCheck size={13} className="text-[var(--app-primary)]" />
                                    <span>256-Bit</span>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                {/* Option A: Pay Online (Cashfree) */}
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("UPI")}
                                    className={`flex items-start justify-between gap-3 rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                                        selectedPaymentMethod === "UPI"
                                            ? "border-[var(--app-primary)] bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] ring-1 ring-[var(--app-primary)]/40 shadow-sm"
                                            : "border-[var(--app-border)] hover:border-[var(--app-primary)]/40 bg-[var(--app-surface)]"
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className={`mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border ${
                                            selectedPaymentMethod === "UPI" ? "border-[var(--app-primary)]/30 bg-[color:color-mix(in_srgb,var(--app-primary)_15%,transparent)] text-[var(--app-primary)]" : "border-[var(--app-border)] bg-[var(--app-surface)] theme-muted"
                                        }`}>
                                            <CreditCard size={15} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold sm:text-sm text-[var(--app-text)]">Pay Online</span>
                                                <span className="rounded-full bg-[var(--app-primary)]/15 px-1.5 py-0.2 text-[9px] font-bold text-[var(--app-primary)] border border-[var(--app-primary)]/30">
                                                    Recommended
                                                </span>
                                            </div>
                                            <p className="theme-muted text-[11px] mt-0.5">UPI, Cards, Net Banking & Wallets</p>
                                        </div>
                                    </div>
                                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border mt-0.5 ${
                                        selectedPaymentMethod === "UPI" ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white" : "border-[var(--app-border)]"
                                    }`}>
                                        {selectedPaymentMethod === "UPI" && <CheckCircle2 size={12} className="fill-current text-white" />}
                                    </div>
                                </button>

                                {/* Option B: Tiffzy Wallet */}
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("WALLET")}
                                    className={`flex items-start justify-between gap-3 rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                                        selectedPaymentMethod === "WALLET"
                                            ? "border-[var(--app-primary)] bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] ring-1 ring-[var(--app-primary)]/40 shadow-sm"
                                            : "border-[var(--app-border)] hover:border-[var(--app-primary)]/40 bg-[var(--app-surface)]"
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className={`mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border ${
                                            selectedPaymentMethod === "WALLET" ? "border-[var(--app-primary)]/30 bg-[color:color-mix(in_srgb,var(--app-primary)_15%,transparent)] text-[var(--app-primary)]" : "border-[var(--app-border)] bg-[var(--app-surface)] theme-muted"
                                        }`}>
                                            <Wallet size={15} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold sm:text-sm text-[var(--app-text)]">Tiffzy Wallet</span>
                                                <span className="rounded-full bg-[var(--app-primary)]/15 px-1.5 py-0.2 text-[9px] font-bold text-[var(--app-primary)] border border-[var(--app-primary)]/30">
                                                    1-Click
                                                </span>
                                            </div>
                                            <p className="theme-muted text-[11px] mt-0.5">Instant checkout from prepaid balance</p>
                                        </div>
                                    </div>
                                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border mt-0.5 ${
                                        selectedPaymentMethod === "WALLET" ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white" : "border-[var(--app-border)]"
                                    }`}>
                                        {selectedPaymentMethod === "WALLET" && <CheckCircle2 size={12} className="fill-current text-white" />}
                                    </div>
                                </button>

                                {/* Option C: Cash on Delivery / Pickup / Table */}
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("CASH")}
                                    className={`flex items-start justify-between gap-3 rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                                        selectedPaymentMethod === "CASH"
                                            ? "border-[var(--app-primary)] bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] ring-1 ring-[var(--app-primary)]/40 shadow-sm"
                                            : "border-[var(--app-border)] hover:border-[var(--app-primary)]/40 bg-[var(--app-surface)]"
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className={`mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border ${
                                            selectedPaymentMethod === "CASH" ? "border-[var(--app-primary)]/30 bg-[color:color-mix(in_srgb,var(--app-primary)_15%,transparent)] text-[var(--app-primary)]" : "border-[var(--app-border)] bg-[var(--app-surface)] theme-muted"
                                        }`}>
                                            <Banknote size={15} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold sm:text-sm text-[var(--app-text)]">{getPaymentMethodTitle("CASH", selectedFulfillment)}</span>
                                                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-1.5 py-0.2 text-[9px] font-bold theme-muted">
                                                    COD
                                                </span>
                                            </div>
                                            <p className="theme-muted text-[11px] mt-0.5">{getPaymentMethodSubtitle("CASH", selectedFulfillment)}</p>
                                        </div>
                                    </div>
                                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border mt-0.5 ${
                                        selectedPaymentMethod === "CASH" ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white" : "border-[var(--app-border)]"
                                    }`}>
                                        {selectedPaymentMethod === "CASH" && <CheckCircle2 size={12} className="fill-current text-white" />}
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* 4. Authoritative Server Bill Breakdown */}
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between pb-2 border-b border-[var(--app-border)] font-bold text-xs uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                <span>Bill Summary</span>
                                {previewLoading && <span className="text-[11px] theme-muted flex items-center gap-1"><RefreshCw size={11} className="animate-spin" /> Calculating</span>}
                            </div>

                            <div className="flex justify-between theme-muted py-0.5">
                                <span>Subtotal</span>
                                <span className="tabular-nums">₹{toInr(previewBilling?.subtotal ?? cartSubtotal)}</span>
                            </div>

                            {Number(previewBilling?.couponDiscount || previewBilling?.promoDiscountAmount || 0) > 0 && (
                                <div className="flex justify-between text-[var(--app-primary)] font-semibold py-0.5">
                                    <span>Coupon Discount ({appliedCouponCode})</span>
                                    <span className="tabular-nums">-₹{toInr(previewBilling.couponDiscount || previewBilling.promoDiscountAmount)}</span>
                                </div>
                            )}

                            {Number(previewBilling?.loyaltyDiscount || previewBilling?.loyaltyDiscountAmount || 0) > 0 && (
                                <div className="flex justify-between text-[var(--app-primary)] font-semibold py-0.5">
                                    <span>Loyalty Discount ({redeemedLoyaltyPoints} pts)</span>
                                    <span className="tabular-nums">-₹{toInr(previewBilling.loyaltyDiscount || previewBilling.loyaltyDiscountAmount)}</span>
                                </div>
                            )}

                            {Array.isArray(previewBilling?.taxes) && previewBilling.taxes.length > 0 ? (
                                previewBilling.taxes.map((t, idx) => (
                                    <div key={idx} className="flex justify-between theme-muted py-0.5">
                                        <span>{t.name || "Tax"}{t.rate ? ` (${t.rate}%)` : ""}</span>
                                        <span className="tabular-nums">₹{toInr(t.amount)}</span>
                                    </div>
                                ))
                            ) : Number(previewBilling?.tax || previewBilling?.taxAmount || 0) > 0 ? (
                                <div className="flex justify-between theme-muted py-0.5">
                                    <span>Taxes</span>
                                    <span className="tabular-nums">₹{toInr(previewBilling.tax || previewBilling.taxAmount)}</span>
                                </div>
                            ) : null}

                            {Array.isArray(previewBilling?.charges) && previewBilling.charges.length > 0 ? (
                                previewBilling.charges.map((c, idx) => (
                                    <div key={idx} className="flex justify-between theme-muted py-0.5">
                                        <span>{c.name || "Charge"}</span>
                                        <span className="tabular-nums">₹{toInr(c.amount)}</span>
                                    </div>
                                ))
                            ) : Number(previewBilling?.serviceCharge || previewBilling?.serviceChargeAmount || 0) > 0 ? (
                                <div className="flex justify-between theme-muted py-0.5">
                                    <span>Service Charge</span>
                                    <span className="tabular-nums">₹{toInr(previewBilling.serviceCharge || previewBilling.serviceChargeAmount)}</span>
                                </div>
                            ) : null}

                            {Number(previewBilling?.deliveryFee || previewBilling?.deliveryCharge || 0) > 0 && (
                                <div className="flex justify-between theme-muted py-0.5">
                                    <span>Delivery Fee</span>
                                    <span className="tabular-nums">₹{toInr(previewBilling.deliveryFee || previewBilling.deliveryCharge)}</span>
                                </div>
                            )}

                            {Number(previewBilling?.tip || 0) > 0 && (
                                <div className="flex justify-between theme-muted py-0.5">
                                    <span>Tip</span>
                                    <span className="tabular-nums">₹{toInr(previewBilling.tip)}</span>
                                </div>
                            )}

                            {Number(previewBilling?.roundOff || 0) !== 0 && (
                                <div className="flex justify-between theme-muted py-0.5">
                                    <span>Round Off</span>
                                    <span className="tabular-nums">{Number(previewBilling.roundOff) > 0 ? "+" : ""}₹{toInr(previewBilling.roundOff)}</span>
                                </div>
                            )}

                            <div className="border-t border-[var(--app-border)] pt-2.5 mt-2 flex justify-between items-center text-sm font-bold">
                                <span className="uppercase tracking-wider">Final Total</span>
                                <span className="theme-price tabular-nums text-lg font-black text-[var(--app-primary)]">₹{toInr(payableAmount)}</span>
                            </div>
                        </div>

                        {/* Error & Warning Banners */}
                        {error && (
                            <div className="rounded-xl border border-red-500/25 bg-[color:color-mix(in_srgb,#ef4444_8%,var(--app-surface))] px-3.5 py-2.5 text-xs text-[var(--app-text)] flex items-start gap-2">
                                <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {previewError && (
                            <div className="rounded-xl border border-red-500/25 bg-[color:color-mix(in_srgb,#ef4444_8%,var(--app-surface))] px-3.5 py-2 text-xs text-[var(--app-text)] flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <AlertCircle size={15} className="shrink-0 text-red-500" />
                                    <span className="truncate">{previewError}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRetryTrigger((c) => c + 1)}
                                    className="theme-button shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {success && (
                            <div className="rounded-xl border border-[var(--app-primary)]/30 bg-[color:color-mix(in_srgb,var(--app-primary)_8%,var(--app-surface))] px-3.5 py-2.5 text-xs text-[var(--app-primary)] font-semibold">
                                {success}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* STICKY FOOTER (Accessible on all screens and mobile devices) */}
            <footer className="checkout-paper-divider shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
                    <div className="min-w-0">
                        <p className="theme-muted text-[11px] font-medium leading-none">Total Payable</p>
                        <p className="mt-1 truncate text-base font-bold tabular-nums sm:text-lg text-[var(--app-primary)]">Rs {toInr(payableAmount)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrimaryAction}
                            disabled={submitting || !cart?.length}
                            className="theme-button inline-flex min-w-[170px] items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[220px] sm:px-6"
                        >
                            {submitting && <LoaderCircle size={15} className="animate-spin" />}
                            {submitting ? "Working..." : actionButtonLabel}
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
