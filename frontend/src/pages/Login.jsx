import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Phone, UserCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useRestaurantContext } from "../context/RestaurantContext";
import { api } from "../utils/apiClient";
import BrandLogo from "../components/BrandLogo";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

export default function Login() {
    const { login, loginSession, loginCustomer } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();

    const initialMode = useMemo(() => {
        const mode = String(searchParams.get("mode") || "").trim().toLowerCase();
        return mode === "staff" ? "staff" : "customer";
    }, [searchParams]);

    const [mode, setMode] = useState(initialMode);

    const [email, setEmail] = useState(() => {
        const mode = String(searchParams.get("mode") || "").trim().toLowerCase();
        const prefilledEmail = String(searchParams.get("email") || "").trim();
        return mode === "staff" ? prefilledEmail : "";
    }); // staff email
    const [password, setPassword] = useState(""); // staff password
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false); // staff loading
    const [error, setError] = useState(""); // staff error

    const [customerPhone, setCustomerPhone] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerStep, setCustomerStep] = useState("phone"); // phone -> otp
    const [customerOtp, setCustomerOtp] = useState("");
    const [customerOtpExpiresAt, setCustomerOtpExpiresAt] = useState(null);
    const [customerDevOtp, setCustomerDevOtp] = useState("");
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState("");
    const autoLoginTokenRef = useRef("");
    const staffLink = String(searchParams.get("staffLink") || "").trim();

    const customerMenuPath = useMemo(() => {
        const slug = String(restaurantContext?.slug || "").trim();
        return buildRestaurantMenuPath(slug, restaurantContext?.tableNo);
    }, [restaurantContext?.slug, restaurantContext?.tableNo]);

    const handleSuccessfulStaffLogin = (data, { session = false } = {}) => {
        if (session) {
            loginSession(data);
        } else {
            login(data);
        }

        setRestaurantContext({
            id: data?.user?.restaurant?.id || data?.user?.restaurantId || null,
            name: data?.user?.restaurant?.name || null,
            slug: data?.user?.restaurant?.slug || null,
        });

        const from = location.state?.from;
        const fromPathname = String(from?.pathname || "");
        const fromPath = fromPathname ? `${fromPathname}${from.search || ""}${from.hash || ""}` : "";
        const effectiveRole = resolveEffectiveStaffRole(data?.user?.role, data?.user?.designation);
        const isSeniorChef = /SENIOR/i.test(String(data?.user?.designation || ""));
        const shouldIgnoreFromPath =
            (effectiveRole === "WAITER" &&
                fromPathname &&
                (fromPathname === "/owner" ||
                    fromPathname.startsWith("/owner/") ||
                    fromPathname === "/admin" ||
                    fromPathname.startsWith("/admin/") ||
                    fromPathname.startsWith("/super-admin"))) ||
            (effectiveRole === "CHEF" &&
                fromPathname &&
                (fromPathname === "/owner/kitchen" ||
                    fromPathname === "/kitchen" ||
                    fromPathname.startsWith("/kitchen/")) &&
                !isSeniorChef);
        const redirectTarget =
            fromPath && fromPathname !== "/login" && !shouldIgnoreFromPath
                ? fromPath
                : getRedirectPath(effectiveRole, data?.user?.designation, data?.user?.id);
        navigate(redirectTarget, { replace: true });
    };

    const getRedirectPath = (role, designation, userId) => {
        const normalizedRole = resolveEffectiveStaffRole(role, designation);
        const isSeniorChef = /SENIOR/i.test(String(designation || ""));

        if (normalizedRole === "SUPER_ADMIN") {
            return "/super-admin";
        }
        if (normalizedRole === "ADMIN") {
            return "/admin";
        }
        if (normalizedRole === "OWNER") {
            return "/owner";
        }
        if (normalizedRole === "CHEF") {
            if (isSeniorChef) return "/kitchen";
            const chefId = String(userId || "").trim();
            return chefId ? `/kitchen/chef/${chefId}` : "/kitchen";
        }
        if (normalizedRole === "WAITER") {
            return "/server";
        }
        if (normalizedRole === "CASHIER") {
            return "/owner/orders";
        }
        if (normalizedRole === "MANAGER") {
            return "/owner";
        }

        return "/";
    };

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    useEffect(() => {
        if (mode !== "customer") return;
        setCustomerStep("phone");
        setCustomerOtp("");
        setCustomerOtpExpiresAt(null);
        setCustomerDevOtp("");
        setCustomerError("");
    }, [mode]);

    useEffect(() => {
        if (mode !== "staff") return;
        if (!staffLink) return;
        if (autoLoginTokenRef.current === staffLink) return;
        autoLoginTokenRef.current = staffLink;

        let cancelled = false;

        const consumeStaffLink = async () => {
            try {
                setLoading(true);
                setError("");

                const res = await api.post("/auth/staff-link/consume", { token: staffLink });
                if (cancelled) return;
                handleSuccessfulStaffLogin(res.data, { session: true });
            } catch (err) {
                if (cancelled) return;
                setError(
                    err.response?.data?.message ||
                    (err.message === "Network Error"
                        ? "Backend is unreachable. Check your API URL configuration (VITE_API_URL)."
                        : err.message || "Failed to open staff login link")
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        consumeStaffLink();

        return () => {
            cancelled = true;
        };
    }, [mode, staffLink]);

    const setModeAndUrl = (nextMode) => {
        const value = nextMode === "staff" ? "staff" : "customer";
        setMode(value);
        setSearchParams(
            (prev) => {
                prev.set("mode", value);
                return prev;
            },
            { replace: true }
        );
    };

    const handleLogin = async () => {
        try {
            setLoading(true);
            setError("");

            const res = await api.post("/login", {
                email: String(email || "").trim().toLowerCase(),
                password,
            });

            handleSuccessfulStaffLogin(res.data);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                (err.message === "Network Error"
                    ? "Backend is unreachable. Check your API URL configuration (VITE_API_URL)."
                    : err.message || "Login failed")
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCustomerRequestOtp = async () => {
        const phone = String(customerPhone || "").trim();
        if (!phone) {
            setCustomerError("Phone number is required.");
            return;
        }

        try {
            setCustomerLoading(true);
            setCustomerError("");
            const res = await api.post("/customer/send-otp", { phone, email: String(customerEmail || "").trim() });
            setCustomerStep("otp");
            setCustomerOtp("");
            setCustomerOtpExpiresAt(res.data?.expiresAt || null);
            setCustomerDevOtp(res.data?.devOtp || "");
        } catch (err) {
            setCustomerError(err.response?.data?.message || err.message || "Failed to send OTP");
        } finally {
            setCustomerLoading(false);
        }
    };

    const handleCustomerVerifyOtp = async () => {
        const phone = String(customerPhone || "").trim();
        const otp = String(customerOtp || "").trim();

        if (!phone) {
            setCustomerError("Phone number is required.");
            return;
        }
        if (!otp) {
            setCustomerError("OTP is required.");
            return;
        }

        try {
            setCustomerLoading(true);
            setCustomerError("");
            const res = await api.post("/customer/verify-otp", {
                phone,
                otp,
                name: String(customerName || "").trim(),
                email: String(customerEmail || "").trim(),
            });

            const customer = res.data?.customer || {};

            loginCustomer({
                id: customer?.id || null,
                name: customer?.name || customerName || "",
                email: customer?.email || customerEmail || "",
                phone: customer?.phone || phone,
                token: res.data?.token || "",
                verified: true,
            });

            navigate(customerMenuPath, { replace: true });
        } catch (err) {
            setCustomerError(err.response?.data?.message || err.message || "Invalid OTP");
        } finally {
            setCustomerLoading(false);
        }
    };

    const handleCustomerLogin = async () => {
        if (customerStep === "phone") return handleCustomerRequestOtp();
        return handleCustomerVerifyOtp();
    };

    return (
        <div className="theme-page grid min-h-screen md:grid-cols-2">

            {/* LEFT SIDE BRANDING */}
            <div className="theme-login-brand hidden flex-col justify-center px-16 md:flex">

                <div className="flex items-center gap-3 mb-6">
                    <div className="theme-card flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl">
                        <BrandLogo className="h-10 w-10" title="Brand logo" />
                    </div>

                    <h1 className="text-5xl font-bold tracking-tight">
                        Tiffzy
                    </h1>
                </div>

                <p className="text-xl font-medium max-w-md leading-relaxed">
                    Smart restaurant operating system for modern cafes, dining, billing and live orders.
                </p>

                <div className="mt-10 space-y-4 text-lg font-medium">
                    <p>⚡ QR Table Ordering</p>
                    <p>📦 Live Kitchen Orders</p>
                    <p>📈 Analytics Dashboard</p>
                    <p>💳 Billing & Payments</p>
                </div>

                <div className="theme-muted-strong mt-12 text-sm font-semibold">
                    Built for growth • Built for speed
                </div>
            </div>

            {/* RIGHT SIDE LOGIN */}
            <div className="flex items-center justify-center px-6 py-10">

                <div className="theme-panel w-full max-w-md rounded-3xl p-8 backdrop-blur-2xl">
                    <div className="mb-6 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setModeAndUrl("customer")}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${mode === "customer" ? "theme-button" : "theme-soft-button"}`}
                        >
                            Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => setModeAndUrl("staff")}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${mode === "staff" ? "theme-button" : "theme-soft-button"}`}
                        >
                            Staff
                        </button>
                    </div>

                    {/* MOBILE LOGO */}
                    <div className="md:hidden flex items-center justify-center gap-2 mb-6">
                        <BrandLogo className="h-7 w-7" title="Brand logo" />
                        <h1 className="text-3xl font-bold">Tiffzy</h1>
                    </div>

                    {mode === "staff" ? (
                        <>
                            <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
                            <p className="theme-muted mb-8">Login to manage your restaurant</p>

                            {error && (
                                <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="admin@cafe.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="theme-input w-full rounded-xl px-4 py-3 pr-12 outline-none transition"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="theme-muted absolute right-4 top-3.5 hover:opacity-80"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogin}
                                    disabled={loading}
                                    className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {loading ? "Logging in..." : "Login"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="text-3xl font-bold mb-2">Customer Login</h2>
                            <p className="theme-muted mb-8">Secure OTP login to view your orders and reorder faster.</p>

                            {customerError && (
                                <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                                    {customerError}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Phone Number</label>
                                    <div className="relative">
                                        <Phone size={18} className="theme-muted absolute left-4 top-3.5" />
                                        <input
                                            type="tel"
                                            placeholder="Enter phone number"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Email (optional)</label>
                                    <input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                    <p className="theme-muted mt-2 text-xs">If provided, we’ll send the OTP to email too.</p>
                                </div>

                                {customerStep === "otp" && (
                                    <>
                                        <div>
                                            <label className="theme-muted mb-2 block text-sm">OTP</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                placeholder="Enter 6-digit OTP"
                                                value={customerOtp}
                                                onChange={(e) => setCustomerOtp(e.target.value)}
                                                className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                            />
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCustomerRequestOtp()}
                                                    disabled={customerLoading}
                                                    className="theme-muted underline decoration-dotted underline-offset-4 hover:opacity-80 disabled:opacity-60"
                                                >
                                                    Resend OTP
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomerStep("phone");
                                                        setCustomerOtp("");
                                                        setCustomerOtpExpiresAt(null);
                                                        setCustomerDevOtp("");
                                                    }}
                                                    className="theme-muted underline decoration-dotted underline-offset-4 hover:opacity-80"
                                                >
                                                    Change number
                                                </button>
                                            </div>
                                            {import.meta.env.DEV && customerDevOtp && (
                                                <p className="theme-muted mt-2 text-xs">Dev OTP: {customerDevOtp}</p>
                                            )}
                                            {customerOtpExpiresAt && (
                                                <p className="theme-muted mt-1 text-xs">
                                                    Expires at {new Date(customerOtpExpiresAt).toLocaleTimeString()}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-2 block text-sm">Name (optional)</label>
                                            <div className="relative">
                                                <UserCircle2 size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder="Your name"
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button
                                    onClick={handleCustomerLogin}
                                    disabled={customerLoading}
                                    className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {customerStep === "phone"
                                        ? customerLoading
                                            ? "Sending OTP..."
                                            : "Send OTP"
                                        : customerLoading
                                            ? "Verifying..."
                                            : "Verify & Continue"}
                                </button>
                            </div>
                        </>
                    )}

                    {/* FOOTER */}
                    <p className="theme-muted mt-8 text-center text-sm">
                        Powered by Tiffzy OS
                    </p>
                </div>
            </div>
        </div>
    );
}
