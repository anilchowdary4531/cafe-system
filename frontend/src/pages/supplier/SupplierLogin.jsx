import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, ArrowRight, Eye, EyeOff, ShieldCheck, Package, Building2, Mail } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function SupplierLogin() {
    const navigate = useNavigate();
    const [subMode, setSubMode] = useState("login"); // 'login' | 'register' | 'forgot' | 'verify-otp' | 'reset-password'
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState("");

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
            showToast(err?.response?.data?.error || err?.message || "Operation failed", { type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid min-h-screen md:grid-cols-2 bg-[#08090d] text-white">
            {/* LEFT SIDE BRANDING */}
            <div className="hidden flex-col justify-center px-12 lg:px-16 md:flex border-r border-white/10 bg-gradient-to-br from-[#0c0e17] via-[#08090d] to-[#14120c]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-xl shadow-amber-500/10">
                        <Truck size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white">Tiffzy Supply</h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Supplier Marketplace Portal</p>
                    </div>
                </div>

                <p className="text-xl font-semibold max-w-md text-slate-200 leading-relaxed mb-8">
                    Direct B2B procurement network connecting raw ingredient suppliers with active restaurants.
                </p>

                <div className="space-y-4 text-sm font-medium text-slate-300">
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                            <Package size={18} />
                        </div>
                        <span>Manage Product Catalog, Pricing & Stock Availability</span>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                            <Building2 size={18} />
                        </div>
                        <span>Receive Direct Bulk Orders from Verified Restaurants</span>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                            <ShieldCheck size={18} />
                        </div>
                        <span>Instant Email OTP Verification & Secure Password Reset</span>
                    </div>
                </div>

                <div className="mt-12 text-xs font-bold uppercase tracking-widest text-amber-400/80">
                    Built for growth • Built for speed
                </div>
            </div>

            {/* RIGHT SIDE FORM CARD */}
            <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
                <div className="w-full max-w-md bg-[#12141c] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="md:hidden inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-1">
                            <Truck size={24} />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">Supplier Account Access</h2>
                        <p className="text-xs font-medium text-slate-300">
                            {subMode === "login" && "Log in to manage raw material supply, stock & orders"}
                            {subMode === "register" && "Register your business on Tiffzy Supply Marketplace"}
                            {subMode === "verify-otp" && `Enter OTP verification code sent to ${registeredEmail || form.email}`}
                            {subMode === "forgot" && "Reset your password via Email OTP verification"}
                            {subMode === "reset-password" && "Enter OTP code and set your new password"}
                        </p>
                    </div>

                    {/* Submode Switcher Tabs */}
                    <div className="grid grid-cols-3 gap-1 bg-[#090a0f] p-1.5 rounded-2xl text-xs font-bold border border-white/10">
                        <button
                            type="button"
                            onClick={() => setSubMode("login")}
                            className={`py-2 rounded-xl transition ${subMode === "login" ? "bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20" : "text-slate-300 hover:text-white"}`}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubMode("register")}
                            className={`py-2 rounded-xl transition ${subMode === "register" ? "bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20" : "text-slate-300 hover:text-white"}`}
                        >
                            Register
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubMode("forgot")}
                            className={`py-2 rounded-xl transition ${subMode === "forgot" ? "bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20" : "text-slate-300 hover:text-white"}`}
                        >
                            Forgot
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {subMode === "login" && (
                            <>
                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                        Supplier Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => updateForm("email", e.target.value)}
                                        placeholder="supplier@abcfoods.com"
                                        required
                                        className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                            Password
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setSubMode("forgot")}
                                            className="text-xs text-amber-400 hover:underline font-bold"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={form.password}
                                            onChange={(e) => updateForm("password", e.target.value)}
                                            placeholder="Enter password"
                                            required
                                            className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 pr-11 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
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
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                        Business / Supplier Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.businessName}
                                        onChange={(e) => updateForm("businessName", e.target.value)}
                                        placeholder="ABC Foods & Poultry Supplies"
                                        required
                                        className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                        Email Address (For Email OTP Verification)
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => updateForm("email", e.target.value)}
                                        placeholder="rameshnanda485@gmail.com"
                                        required
                                        className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => updateForm("phone", e.target.value)}
                                        placeholder="9133222614"
                                        required
                                        className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={form.password}
                                            onChange={(e) => updateForm("password", e.target.value)}
                                            placeholder="Min 6 characters"
                                            required
                                            className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 pr-11 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {subMode === "verify-otp" && (
                            <div>
                                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2 text-center">
                                    Enter 6-Digit OTP Sent to Email {registeredEmail || form.email}
                                </label>
                                <input
                                    type="text"
                                    value={form.otp}
                                    onChange={(e) => updateForm("otp", e.target.value)}
                                    placeholder="123456"
                                    required
                                    className="w-full rounded-xl bg-[#1a1d28] border border-amber-500/50 px-4 py-3 text-center text-2xl font-black tracking-widest text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                                />
                            </div>
                        )}

                        {subMode === "forgot" && (
                            <div>
                                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                    Registered Email Address
                                </label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    placeholder="rameshnanda485@gmail.com"
                                    required
                                    className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                                />
                            </div>
                        )}

                        {subMode === "reset-password" && (
                            <>
                                <div>
                                    <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1.5 text-center">
                                        Enter 6-Digit Reset OTP Sent to Email
                                    </label>
                                    <input
                                        type="text"
                                        value={form.otp}
                                        onChange={(e) => updateForm("otp", e.target.value)}
                                        placeholder="123456"
                                        required
                                        className="w-full rounded-xl bg-[#1a1d28] border border-amber-500/50 px-4 py-3 text-center text-2xl font-black tracking-widest text-white outline-none focus:border-amber-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={form.newPassword}
                                        onChange={(e) => updateForm("newPassword", e.target.value)}
                                        placeholder="New password (min 6 chars)"
                                        required
                                        className="w-full rounded-xl bg-[#1a1d28] border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 transition"
                                    />
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3.5 font-bold text-black transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 mt-2"
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
                            <ArrowRight size={18} />
                        </button>
                    </form>

                    <div className="text-center pt-3 border-t border-white/10 text-xs">
                        {subMode === "login" ? (
                            <button
                                type="button"
                                onClick={() => setSubMode("register")}
                                className="text-amber-400 hover:underline font-bold"
                            >
                                Need a supplier account? Register here
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setSubMode("login")}
                                className="text-amber-400 hover:underline font-bold"
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
