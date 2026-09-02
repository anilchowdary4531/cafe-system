import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Truck, ArrowRight, Package, Building2, ShieldCheck } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import BrandLogo from "../../components/BrandLogo";
import LanguageSelector from "../../components/LanguageSelector";

export default function SupplierLogin() {
    const navigate = useNavigate();
    const [subMode, setSubMode] = useState("login"); // 'login' | 'register' | 'forgot' | 'verify-otp' | 'reset-password'
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState("");
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        email: "",
        phone: "",
        password: "",
        businessName: "",
        otp: "",
        newPassword: "",
    });

    const updateForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (subMode === "login") {
                const res = await api.post("/auth/supplier/login", {
                    email: form.email,
                    password: form.password,
                });
                localStorage.setItem("token", res.data.token);
                if (res.data.refreshToken) {
                    localStorage.setItem("supplier_refresh_token", res.data.refreshToken);
                }
                showToast("Supplier login successful!");
                navigate("/supplier");
            } else if (subMode === "register") {
                const res = await api.post("/auth/supplier/register", {
                    email: form.email,
                    phone: form.phone,
                    password: form.password,
                    businessName: form.businessName,
                });
                setRegisteredEmail(form.email);
                showToast(res.data?.message || `Registration successful! OTP sent to ${form.email}`);
                if (res.data?.otpDebug) {
                    showToast(`OTP Debug Code: ${res.data.otpDebug}`, { type: "info" });
                }
                setSubMode("verify-otp");
            } else if (subMode === "verify-otp") {
                const res = await api.post("/auth/supplier/verify-otp", {
                    email: registeredEmail || form.email,
                    phone: form.phone,
                    otp: form.otp,
                });
                showToast(res.data?.message || "Account verified successfully! Please log in.");
                setSubMode("login");
            } else if (subMode === "forgot") {
                const res = await api.post("/auth/supplier/forgot-password", {
                    email: form.email,
                    phone: form.phone,
                });
                setRegisteredEmail(form.email);
                showToast(res.data?.message || `Password reset OTP sent to ${form.email}!`);
                if (res.data?.otpDebug) {
                    showToast(`OTP Debug Code: ${res.data.otpDebug}`, { type: "info" });
                }
                setSubMode("reset-password");
            } else if (subMode === "reset-password") {
                const res = await api.post("/auth/supplier/reset-password", {
                    email: registeredEmail || form.email,
                    phone: form.phone,
                    otp: form.otp,
                    newPassword: form.newPassword,
                });
                showToast(res.data?.message || "Password reset successfully! Please log in.");
                setSubMode("login");
            }
        } catch (err) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Operation failed";
            setError(msg);
            showToast(msg, { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="theme-page grid min-h-screen md:grid-cols-2">
            {/* LEFT SIDE BRANDING - MATCHING CUSTOMER PAGE */}
            <div className="theme-login-brand hidden flex-col justify-center px-16 md:flex">
                <div className="flex items-center gap-3 mb-6">
                    <div className="theme-card flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl">
                        <BrandLogo className="h-10 w-10" title="Brand logo" />
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight">Tiffzy</h1>
                </div>

                <p className="text-xl font-medium max-w-md leading-relaxed">
                    Direct B2B Raw Ingredient Supply Marketplace & Procurement Operating System
                </p>

                <div className="mt-10 space-y-4 text-lg font-medium">
                    <p>• Manage Product Catalog & Stock Availability</p>
                    <p>• Direct Bulk Orders from Verified Restaurants</p>
                    <p>• Instant Email OTP Verification & Secure Reset</p>
                    <p>• Automated Payment Settlements & KYC Compliance</p>
                </div>

                <div className="theme-muted-strong mt-12 text-sm font-semibold">
                    Built for growth • Built for speed
                </div>
            </div>

            {/* RIGHT SIDE LOGIN - MATCHING CUSTOMER PAGE */}
            <div className="login-shell flex items-center justify-center px-2 py-3 sm:px-4 sm:py-6 md:px-6 md:py-10">
                <div className="login-card theme-panel relative w-[99%] max-w-[99vw] rounded-3xl p-5 backdrop-blur-2xl sm:w-full sm:max-w-md sm:p-8">
                    {/* TOP RIGHT LANGUAGE SELECTOR */}
                    <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
                        <LanguageSelector />
                    </div>

                    {/* TOP MODE TOGGLE SWITCHER */}
                    <div className="mb-6 grid grid-cols-3 gap-1.5 pr-20 sm:pr-24">
                        <button
                            type="button"
                            onClick={() => navigate("/login?mode=customer")}
                            className="rounded-2xl px-2.5 py-2 text-xs sm:text-sm font-semibold theme-soft-button"
                        >
                            Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/login?mode=staff")}
                            className="rounded-2xl px-2.5 py-2 text-xs sm:text-sm font-semibold theme-soft-button"
                        >
                            Staff
                        </button>
                        <button
                            type="button"
                            className="rounded-2xl px-2.5 py-2 text-xs sm:text-sm font-semibold theme-button"
                        >
                            Supplier
                        </button>
                    </div>

                    {/* MOBILE LOGO */}
                    <div className="login-mobile-brand md:hidden flex items-center justify-center gap-2 mb-6">
                        <BrandLogo className="h-7 w-7" title="Brand logo" />
                        <h1 className="text-3xl font-bold">Tiffzy</h1>
                    </div>

                    {/* SUPPLIER FORM HEADERS */}
                    <h2 className="text-3xl font-bold mb-2">Supplier Portal</h2>
                    <p className="theme-muted mb-6">
                        {subMode === "login" && "Log in to manage raw material supply, stock & orders"}
                        {subMode === "register" && "Register your business on Tiffzy Supply Marketplace"}
                        {subMode === "verify-otp" && `Enter 6-digit OTP sent to ${registeredEmail || form.email}`}
                        {subMode === "forgot" && "Reset your password via Email OTP verification"}
                        {subMode === "reset-password" && "Enter OTP code and set your new password"}
                    </p>

                    {/* SUB-MODE PILLS */}
                    <div className="mb-6 grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => { setSubMode("login"); setError(""); }}
                            className={`rounded-2xl px-3 py-2 text-xs font-semibold ${subMode === "login" ? "theme-button" : "theme-soft-button"}`}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSubMode("register"); setError(""); }}
                            className={`rounded-2xl px-3 py-2 text-xs font-semibold ${subMode === "register" ? "theme-button" : "theme-soft-button"}`}
                        >
                            Register
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSubMode("forgot"); setError(""); }}
                            className={`rounded-2xl px-3 py-2 text-xs font-semibold ${subMode === "forgot" || subMode === "reset-password" ? "theme-button" : "theme-soft-button"}`}
                        >
                            Forgot
                        </button>
                    </div>

                    {error && (
                        <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {subMode === "login" && (
                            <>
                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Supplier Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="supplier@abcfoods.com"
                                        value={form.email}
                                        onChange={(e) => updateForm("email", e.target.value)}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="theme-muted block text-sm">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => { setSubMode("forgot"); setError(""); }}
                                            className="text-sm font-semibold theme-accent-text hover:underline"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            value={form.password}
                                            onChange={(e) => updateForm("password", e.target.value)}
                                            required
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
                            </>
                        )}

                        {subMode === "register" && (
                            <>
                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Business / Supplier Name *</label>
                                    <input
                                        type="text"
                                        placeholder="ABC Foods & Poultry Supplies"
                                        value={form.businessName}
                                        onChange={(e) => updateForm("businessName", e.target.value)}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Email Address (For Email OTP) *</label>
                                    <input
                                        type="email"
                                        placeholder="rameshnanda485@gmail.com"
                                        value={form.email}
                                        onChange={(e) => updateForm("email", e.target.value)}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Phone Number *</label>
                                    <input
                                        type="tel"
                                        placeholder="9133222614"
                                        value={form.phone}
                                        onChange={(e) => updateForm("phone", e.target.value)}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-2 block text-sm">Password *</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min 6 characters"
                                            value={form.password}
                                            onChange={(e) => updateForm("password", e.target.value)}
                                            required
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
                            </>
                        )}

                        {subMode === "verify-otp" && (
                            <div>
                                <label className="theme-muted mb-2 block text-sm font-medium text-center">
                                    Enter 6-Digit OTP Sent to Email {registeredEmail || form.email}
                                </label>
                                <input
                                    type="text"
                                    placeholder="123456"
                                    value={form.otp}
                                    onChange={(e) => updateForm("otp", e.target.value)}
                                    required
                                    className="theme-input w-full rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none transition"
                                />
                            </div>
                        )}

                        {subMode === "forgot" && (
                            <div>
                                <label className="theme-muted mb-2 block text-sm font-medium">Registered Email Address *</label>
                                <input
                                    type="email"
                                    placeholder="rameshnanda485@gmail.com"
                                    value={form.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    required
                                    className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                />
                            </div>
                        )}

                        {subMode === "reset-password" && (
                            <>
                                <div>
                                    <label className="theme-muted mb-2 block text-sm font-medium text-center">Enter 6-Digit Reset OTP Code</label>
                                    <input
                                        type="text"
                                        placeholder="123456"
                                        value={form.otp}
                                        onChange={(e) => updateForm("otp", e.target.value)}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="theme-muted mb-2 block text-sm font-medium">New Password *</label>
                                    <input
                                        type="password"
                                        placeholder="New password (min 6 chars)"
                                        value={form.newPassword}
                                        onChange={(e) => updateForm("newPassword", e.target.value)}
                                        required
                                        className="theme-input w-full rounded-xl px-4 py-3 outline-none transition"
                                    />
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="theme-button w-full rounded-xl py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 mt-2"
                        >
                            {loading
                                ? "Processing..."
                                : subMode === "login"
                                ? "Log In to Supplier Portal"
                                : subMode === "register"
                                ? "Send Email OTP & Register"
                                : subMode === "verify-otp"
                                ? "Verify Email OTP & Activate"
                                : subMode === "forgot"
                                ? "Send Reset OTP to Email"
                                : "Reset Password & Save"}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        {subMode === "login" ? (
                            <div>
                                <span className="theme-muted text-sm">Need a supplier account? </span>
                                <button
                                    type="button"
                                    onClick={() => { setSubMode("register"); setError(""); }}
                                    className="text-sm font-semibold theme-accent-text hover:underline"
                                >
                                    Register here
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => { setSubMode("login"); setError(""); }}
                                className="text-sm font-semibold theme-accent-text hover:underline"
                            >
                                Back to Supplier Login
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
