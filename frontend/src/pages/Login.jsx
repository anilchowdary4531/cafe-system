import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Phone, User, UserCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useRestaurantContext } from "../context/RestaurantContext";
import { api } from "../utils/apiClient";
import BrandLogo from "../components/BrandLogo";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../context/LanguageContext";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import { resolveEffectiveStaffRole } from "../utils/staffRole";

export default function Login() {
    const { login, loginSession, loginCustomer } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();

    const initialMode = useMemo(() => {
        const mode = String(searchParams.get("mode") || "").trim().toLowerCase();
        return mode === "staff" ? "staff" : mode === "register" ? "register" : "customer";
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
    const [customerSubMode, setCustomerSubMode] = useState(() => {
        const sub = String(searchParams.get("submode") || searchParams.get("tab") || "").trim().toLowerCase();
        if (sub === "register" || sub === "signup") return "register";
        if (sub === "otp") return "otp";
        return "password";
    });
    const [customerUsername, setCustomerUsername] = useState("");
    const [customerPassword, setCustomerPassword] = useState("");
    const [showCustomerPassword, setShowCustomerPassword] = useState(false);
    const autoLoginTokenRef = useRef("");
    const staffLink = String(searchParams.get("staffLink") || "").trim();

    // Registration states
    const [registerRestaurantName, setRegisterRestaurantName] = useState("");
    const [registerOwnerName, setRegisterOwnerName] = useState("");
    const [registerOwnerEmail, setRegisterOwnerEmail] = useState("");
    const [registerOwnerPhone, setRegisterOwnerPhone] = useState("");
    const [registerOwnerPassword, setRegisterOwnerPassword] = useState("");
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState("");

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

    const getCustomerRedirectTarget = () => {
        const from = location.state?.from;
        if (typeof from === "string" && from.trim()) {
            return from.trim();
        }
        if (from && typeof from === "object") {
            const pathname = String(from.pathname || "").trim();
            if (pathname) {
                return `${pathname}${from.search || ""}${from.hash || ""}`;
            }
        }
        return customerMenuPath;
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
        const value = nextMode === "staff" ? "staff" : nextMode === "register" ? "register" : "customer";
        setMode(value);
        setSearchParams(
            (prev) => {
                prev.set("mode", value);
                return prev;
            },
            { replace: true }
        );
    };

    const handleRegister = async () => {
        const restaurantName = String(registerRestaurantName || "").trim();
        const ownerName = String(registerOwnerName || "").trim();
        const ownerEmail = String(registerOwnerEmail || "").trim().toLowerCase();
        const ownerPhone = String(registerOwnerPhone || "").trim();
        const ownerPassword = String(registerOwnerPassword || "").trim();

        if (!restaurantName || !ownerName || !ownerEmail || !ownerPassword) {
            setRegisterError("Restaurant name, owner name, owner email, and password are required.");
            return;
        }

        if (ownerPassword.length < 6) {
            setRegisterError("Password must be at least 6 characters.");
            return;
        }

        try {
            setRegisterLoading(true);
            setRegisterError("");

            const res = await api.post("/register-restaurant", {
                restaurantName,
                ownerName,
                ownerEmail,
                ownerPhone,
                ownerPassword,
            });

            handleSuccessfulStaffLogin(res.data);
        } catch (err) {
            setRegisterError(
                err.response?.data?.message ||
                err.message ||
                "Failed to register restaurant"
            );
        } finally {
            setRegisterLoading(false);
        }
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

            navigate(getCustomerRedirectTarget(), { replace: true });
        } catch (err) {
            setCustomerError(err.response?.data?.message || err.message || "Invalid OTP");
        } finally {
            setCustomerLoading(false);
        }
    };

    const handleCustomerLogin = async () => {
        if (customerSubMode === "password") return handleCustomerPasswordLogin();
        if (customerSubMode === "register") return handleCustomerRegister();
        if (customerStep === "phone") return handleCustomerRequestOtp();
        return handleCustomerVerifyOtp();
    };

    const handleCustomerPasswordLogin = async () => {
        const identifier = String(customerUsername || "").trim();
        const pwd = String(customerPassword || "").trim();

        if (!identifier || !pwd) {
            setCustomerError("Username/phone/email and password are required.");
            return;
        }

        try {
            setCustomerLoading(true);
            setCustomerError("");
            const res = await api.post("/customer/password-login", { username: identifier, password: pwd });

            const customer = res.data?.customer || {};

            loginCustomer({
                id: customer?.id || null,
                username: customer?.username || "",
                name: customer?.name || "",
                email: customer?.email || "",
                phone: customer?.phone || "",
                token: res.data?.token || "",
                verified: true,
            });

            navigate(getCustomerRedirectTarget(), { replace: true });
        } catch (err) {
            setCustomerError(err.response?.data?.message || err.message || "Invalid username or password");
        } finally {
            setCustomerLoading(false);
        }
    };

    const handleCustomerRegister = async () => {
        const username = String(customerUsername || "").trim().toLowerCase();
        const pwd = String(customerPassword || "").trim();
        const phone = String(customerPhone || "").trim();
        const name = String(customerName || "").trim();
        const email = String(customerEmail || "").trim().toLowerCase();

        if (!username || !phone || !pwd) {
            setCustomerError("Username, phone number, and password are required.");
            return;
        }

        if (pwd.length < 6) {
            setCustomerError("Password must be at least 6 characters.");
            return;
        }

        try {
            setCustomerLoading(true);
            setCustomerError("");
            const res = await api.post("/customer/register", {
                username,
                password: pwd,
                phone,
                name,
                email,
            });

            const customer = res.data?.customer || {};

            loginCustomer({
                id: customer?.id || null,
                username: customer?.username || username,
                name: customer?.name || name,
                email: customer?.email || email,
                phone: customer?.phone || phone,
                token: res.data?.token || "",
                verified: true,
            });

            navigate(getCustomerRedirectTarget(), { replace: true });
        } catch (err) {
            setCustomerError(err.response?.data?.message || err.message || "Failed to create account");
        } finally {
            setCustomerLoading(false);
        }
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
                    {t("smartOS")}
                </p>

                <div className="mt-10 space-y-4 text-lg font-medium">
                    <p>{t("qrOrdering")}</p>
                    <p>{t("liveKitchen")}</p>
                    <p>{t("analyticsDash")}</p>
                    <p>{t("billingPayments")}</p>
                </div>

                <div className="theme-muted-strong mt-12 text-sm font-semibold">
                    {t("builtForGrowth")}
                </div>
            </div>

            {/* RIGHT SIDE LOGIN */}
            <div className="login-shell flex items-center justify-center px-2 py-3 sm:px-4 sm:py-6 md:px-6 md:py-10">

                <div className="login-card theme-panel relative w-[99%] max-w-[99vw] rounded-3xl p-5 backdrop-blur-2xl sm:w-full sm:max-w-md sm:p-8">
                    
                    {/* TOP RIGHT LANGUAGE SELECTOR */}
                    <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
                        <LanguageSelector />
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-2 pr-20 sm:pr-24">
                        <button
                            type="button"
                            onClick={() => setModeAndUrl("customer")}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${mode === "customer" ? "theme-button" : "theme-soft-button"}`}
                        >
                            {t("customer")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setModeAndUrl("staff")}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${mode === "staff" || mode === "register" ? "theme-button" : "theme-soft-button"}`}
                        >
                            {t("staff")}
                        </button>
                    </div>

                    {/* MOBILE LOGO */}
                    <div className="login-mobile-brand md:hidden flex items-center justify-center gap-2 mb-6">
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

                                <div className="mt-4 text-center">
                                    <span className="theme-muted text-sm">Don't have a restaurant? </span>
                                    <button
                                        type="button"
                                        onClick={() => setModeAndUrl("register")}
                                        className="text-sm font-semibold theme-accent-text hover:underline"
                                    >
                                        Register here
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : mode === "register" ? (
                        <>
                            <h2 className="text-3xl font-bold mb-2">Register Restaurant</h2>
                            <p className="theme-muted mb-8">Set up your restaurant operating system.</p>

                            {registerError && (
                                <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                                    {registerError}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="theme-muted mb-1 block text-sm">Restaurant Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Bean House"
                                        value={registerRestaurantName}
                                        onChange={(e) => setRegisterRestaurantName(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-2.5 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-1 block text-sm">Owner Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Your full name"
                                        value={registerOwnerName}
                                        onChange={(e) => setRegisterOwnerName(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-2.5 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-1 block text-sm">Owner Email *</label>
                                    <input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={registerOwnerEmail}
                                        onChange={(e) => setRegisterOwnerEmail(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-2.5 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-1 block text-sm">Owner Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="Enter phone number"
                                        value={registerOwnerPhone}
                                        onChange={(e) => setRegisterOwnerPhone(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-2.5 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-1 block text-sm">Password *</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min 6 characters"
                                            value={registerOwnerPassword}
                                            onChange={(e) => setRegisterOwnerPassword(e.target.value)}
                                            className="theme-input w-full rounded-xl px-4 py-2.5 pr-12 outline-none transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="theme-muted absolute right-4 top-3 hover:opacity-80"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleRegister}
                                    disabled={registerLoading}
                                    className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 mt-2"
                                >
                                    {registerLoading ? "Registering..." : "Register & Login"}
                                </button>

                                <div className="mt-4 text-center">
                                    <span className="theme-muted text-sm">Already have a restaurant? </span>
                                    <button
                                        type="button"
                                        onClick={() => setModeAndUrl("staff")}
                                        className="text-sm font-semibold theme-accent-text hover:underline"
                                    >
                                        Login here
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>

                            {customerSubMode === "password" ? (
                                <>
                                    <h2 className="text-3xl font-bold mb-2">{t("customerLogin")}</h2>
                                    <p className="theme-muted mb-6">{t("loginSubtitle")}</p>
                                </>
                            ) : customerSubMode === "register" ? (
                                <>
                                    <h2 className="text-3xl font-bold mb-2">{t("createAccount")}</h2>
                                    <p className="theme-muted mb-6">{t("createAccountSubtitle")}</p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-3xl font-bold mb-2">{t("otpLogin")}</h2>
                                    <p className="theme-muted mb-6">{t("otpSubtitle")}</p>
                                </>
                            )}

                            {customerError && (
                                <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                                    {customerError}
                                </div>
                            )}

                            <div className="space-y-4">
                                {customerSubMode === "password" && (
                                    <>
                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("usernamePhoneEmail")}</label>
                                            <div className="relative">
                                                <User size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder={t("placeholderUsernamePhoneEmail")}
                                                    value={customerUsername}
                                                    onChange={(e) => setCustomerUsername(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("password")}</label>
                                            <div className="relative">
                                                <Lock size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type={showCustomerPassword ? "text" : "password"}
                                                    placeholder={t("placeholderPassword")}
                                                    value={customerPassword}
                                                    onChange={(e) => setCustomerPassword(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 pr-12 outline-none transition"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCustomerPassword(!showCustomerPassword)}
                                                    className="theme-muted absolute right-4 top-3.5 hover:opacity-80"
                                                >
                                                    {showCustomerPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleCustomerLogin}
                                            disabled={customerLoading}
                                            className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 mt-2"
                                        >
                                            {customerLoading ? t("loggingIn") : t("loginBtn")}
                                        </button>

                                        <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm">
                                            <div>
                                                <span className="theme-muted">{t("dontHaveAccount")}{" "}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCustomerSubMode("register"); setCustomerError(""); }}
                                                    className="font-semibold theme-accent-text hover:underline"
                                                >
                                                    {t("createAccount")}
                                                </button>
                                            </div>
                                            <div>
                                                <span className="theme-muted">{t("orPreferOtp")}{" "}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCustomerSubMode("otp"); setCustomerError(""); }}
                                                    className="font-semibold theme-accent-text hover:underline"
                                                >
                                                    {t("useOtpLogin")}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {customerSubMode === "register" && (
                                    <>
                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("username")} *</label>
                                            <div className="relative">
                                                <User size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder={t("placeholderUsername")}
                                                    value={customerUsername}
                                                    onChange={(e) => setCustomerUsername(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("phoneNumber")} *</label>
                                            <div className="relative">
                                                <Phone size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="tel"
                                                    placeholder={t("placeholderPhone")}
                                                    value={customerPhone}
                                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("fullName")}</label>
                                            <div className="relative">
                                                <UserCircle2 size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder={t("placeholderFullName")}
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("emailAddress")}</label>
                                            <div className="relative">
                                                <Mail size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="email"
                                                    placeholder={t("placeholderEmail")}
                                                    value={customerEmail}
                                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-1.5 block text-sm font-medium">{t("password")} *</label>
                                            <div className="relative">
                                                <Lock size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type={showCustomerPassword ? "text" : "password"}
                                                    placeholder={t("placeholderPasswordMin")}
                                                    value={customerPassword}
                                                    onChange={(e) => setCustomerPassword(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 pr-12 outline-none transition"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCustomerPassword(!showCustomerPassword)}
                                                    className="theme-muted absolute right-4 top-3.5 hover:opacity-80"
                                                >
                                                    {showCustomerPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleCustomerLogin}
                                            disabled={customerLoading}
                                            className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 mt-2"
                                        >
                                            {customerLoading ? t("creatingAccount") : t("createAccountBtn")}
                                        </button>

                                        <div className="mt-4 text-center">
                                            <span className="theme-muted text-sm">{t("alreadyHaveAccount")}{" "}</span>
                                            <button
                                                type="button"
                                                onClick={() => { setCustomerSubMode("password"); setCustomerError(""); }}
                                                className="text-sm font-semibold theme-accent-text hover:underline"
                                            >
                                                {t("loginHere")}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {customerSubMode === "otp" && (
                                    <>
                                        <div>
                                            <label className="theme-muted mb-2 block text-sm font-medium">{t("phoneNumber")}</label>
                                            <div className="relative">
                                                <Phone size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="tel"
                                                    placeholder={t("placeholderPhone")}
                                                    value={customerPhone}
                                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="theme-muted mb-2 block text-sm font-medium">{t("emailAddress")}</label>
                                            <div className="relative">
                                                <Mail size={18} className="theme-muted absolute left-4 top-3.5" />
                                                <input
                                                    type="email"
                                                    placeholder={t("placeholderEmail")}
                                                    value={customerEmail}
                                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                                    className="theme-input w-full rounded-xl px-11 py-3 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        {customerStep === "otp" && (
                                            <>
                                                <div>
                                                    <label className="theme-muted mb-2 block text-sm font-medium">{t("otp")}</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        placeholder={t("placeholderOtp")}
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
                                                            {t("resendOtp")}
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
                                                            {t("changeNumber")}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="theme-muted mb-2 block text-sm font-medium">{t("fullName")}</label>
                                                    <div className="relative">
                                                        <UserCircle2 size={18} className="theme-muted absolute left-4 top-3.5" />
                                                        <input
                                                            type="text"
                                                            placeholder={t("placeholderFullName")}
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
                                            className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 mt-2"
                                        >
                                            {customerStep === "phone"
                                                ? customerLoading
                                                    ? t("sendingOtp")
                                                    : t("sendOtp")
                                                : customerLoading
                                                    ? t("verifying")
                                                    : t("verifyContinue")}
                                        </button>

                                        <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm">
                                            <div>
                                                <span className="theme-muted">{t("havePassword")}{" "}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCustomerSubMode("password"); setCustomerError(""); }}
                                                    className="font-semibold theme-accent-text hover:underline"
                                                >
                                                    {t("passwordLogin")}
                                                </button>
                                            </div>
                                            <div>
                                                <span className="theme-muted">{t("dontHaveAccount")}{" "}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCustomerSubMode("register"); setCustomerError(""); }}
                                                    className="font-semibold theme-accent-text hover:underline"
                                                >
                                                    {t("createAccount")}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
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
