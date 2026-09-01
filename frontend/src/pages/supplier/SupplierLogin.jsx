import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, ArrowRight, KeyRound, UserPlus, LogIn } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function SupplierLogin() {
    const navigate = useNavigate();
    const [subMode, setSubMode] = useState("login"); // 'login' | 'register' | 'forgot' | 'verify-otp' | 'reset-password'
    const [loading, setLoading] = useState(false);
    const [registeredPhone, setRegisteredPhone] = useState("");
    const [resetOtp, setResetOtp] = useState("");

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
                showToast(res.data?.message || "Registration successful! Enter OTP.");
                setRegisteredPhone(form.phone);
                if (res.data?.otpDebug) {
                    showToast(`OTP Debug: ${res.data.otpDebug}`, { type: "info" });
                }
                setSubMode("verify-otp");
            } else if (subMode === "verify-otp") {
                const res = await api.post("/auth/supplier/verify-otp", {
                    phone: registeredPhone || form.phone,
                    otp: form.otp,
                });
                showToast(res.data?.message || "Account verified successfully! Please log in.");
                setSubMode("login");
            } else if (subMode === "forgot") {
                const res = await api.post("/auth/supplier/forgot-password", {
                    phone: form.phone,
                });
                showToast(res.data?.message || "OTP sent to your phone for password reset!");
                setRegisteredPhone(form.phone);
                if (res.data?.otpDebug) {
                    showToast(`OTP Debug: ${res.data.otpDebug}`, { type: "info" });
                }
                setSubMode("reset-password");
            } else if (subMode === "reset-password") {
                const res = await api.post("/auth/supplier/reset-password", {
                    phone: registeredPhone || form.phone,
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
        <div className="min-h-screen bg-[#07090d] text-[#fff8e7] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#15151a] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-2">
                        <Truck size={28} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Tiffzy Supplier Portal</h1>
                    <p className="text-xs text-amber-200/70">
                        {subMode === "login" && "Log in to manage raw material supply, stock & orders"}
                        {subMode === "register" && "Join Tiffzy Supply Marketplace as a verified supplier"}
                        {subMode === "verify-otp" && `Enter OTP sent to phone ${registeredPhone}`}
                        {subMode === "forgot" && "Reset your supplier password via OTP verification"}
                        {subMode === "reset-password" && "Set a new password for your supplier account"}
                    </p>
                </div>

                {/* Submode Switcher Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1.5 rounded-2xl text-xs font-bold border border-white/5">
                    <button
                        type="button"
                        onClick={() => setSubMode("login")}
                        className={`py-2 rounded-xl transition ${subMode === "login" ? "bg-amber-500 text-black shadow" : "text-amber-200/70 hover:text-white"}`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubMode("register")}
                        className={`py-2 rounded-xl transition ${subMode === "register" ? "bg-amber-500 text-black shadow" : "text-amber-200/70 hover:text-white"}`}
                    >
                        Register
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubMode("forgot")}
                        className={`py-2 rounded-xl transition ${subMode === "forgot" ? "bg-amber-500 text-black shadow" : "text-amber-200/70 hover:text-white"}`}
                    >
                        Forgot
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {subMode === "login" && (
                        <>
                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    Supplier Email Address
                                </label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    placeholder="supplier@abcfoods.com"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setSubMode("forgot")}
                                        className="text-xs text-amber-400 hover:underline font-semibold"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => updateForm("password", e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>
                        </>
                    )}

                    {subMode === "register" && (
                        <>
                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    Business / Supplier Name
                                </label>
                                <input
                                    type="text"
                                    value={form.businessName}
                                    onChange={(e) => updateForm("businessName", e.target.value)}
                                    placeholder="ABC Foods & Poultry Supplies"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    placeholder="supplier@abcfoods.com"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    Phone Number (For OTP Verification)
                                </label>
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => updateForm("phone", e.target.value)}
                                    placeholder="9876543210"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => updateForm("password", e.target.value)}
                                    placeholder="Min 6 characters"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>
                        </>
                    )}

                    {subMode === "verify-otp" && (
                        <div>
                            <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-1">
                                Enter 6-Digit OTP Sent to {registeredPhone}
                            </label>
                            <input
                                type="text"
                                value={form.otp}
                                onChange={(e) => updateForm("otp", e.target.value)}
                                placeholder="123456"
                                required
                                className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center text-xl font-bold tracking-widest text-white outline-none focus:border-amber-500"
                            />
                        </div>
                    )}

                    {subMode === "forgot" && (
                        <div>
                            <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                Registered Supplier Phone Number
                            </label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => updateForm("phone", e.target.value)}
                                placeholder="9876543210"
                                required
                                className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                            />
                        </div>
                    )}

                    {subMode === "reset-password" && (
                        <>
                            <div>
                                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-1">
                                    Enter 6-Digit Reset OTP Code
                                </label>
                                <input
                                    type="text"
                                    value={form.otp}
                                    onChange={(e) => updateForm("otp", e.target.value)}
                                    placeholder="123456"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center text-xl font-bold tracking-widest text-white outline-none focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={form.newPassword}
                                    onChange={(e) => updateForm("newPassword", e.target.value)}
                                    placeholder="New password (min 6 chars)"
                                    required
                                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 font-bold text-black transition flex items-center justify-center gap-2"
                    >
                        {loading
                            ? "Processing..."
                            : subMode === "login"
                            ? "Log In to Supplier Portal"
                            : subMode === "register"
                            ? "Register Supplier Account"
                            : subMode === "verify-otp"
                            ? "Verify OTP & Activate"
                            : subMode === "forgot"
                            ? "Send Password Reset OTP"
                            : "Reset Password & Save"}
                        <ArrowRight size={18} />
                    </button>
                </form>

                <div className="text-center pt-2 border-t border-white/10 text-xs">
                    {subMode === "login" ? (
                        <button
                            type="button"
                            onClick={() => setSubMode("register")}
                            className="text-amber-400 hover:underline font-semibold"
                        >
                            Need a supplier account? Register here
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setSubMode("login")}
                            className="text-amber-400 hover:underline font-semibold"
                        >
                            Back to Supplier Login
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
