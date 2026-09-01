import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck, Store, ArrowRight, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import { api } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";

export default function SupplierLogin() {
    const navigate = useNavigate();
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [otpStep, setOtpStep] = useState(false);
    const [registeredPhone, setRegisteredPhone] = useState("");

    const [form, setForm] = useState({
        email: "",
        phone: "",
        password: "",
        businessName: "",
        otp: "",
    });

    const updateForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (otpStep) {
                const res = await api.post("/auth/supplier/verify-otp", {
                    phone: registeredPhone,
                    otp: form.otp,
                });
                showToast(res.data?.message || "Account verified successfully!");
                setOtpStep(false);
                setIsRegister(false);
            } else if (isRegister) {
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
                setOtpStep(true);
            } else {
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
            }
        } catch (err) {
            showToast(err?.response?.data?.error || err?.message || "Authentication failed", { type: "error" });
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
                        {otpStep
                            ? "Verify your phone OTP to activate supplier account"
                            : isRegister
                            ? "Join Tiffzy Supply Marketplace as a verified supplier"
                            : "Log in to manage raw material supply, stock & orders"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {otpStep ? (
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
                    ) : (
                        <>
                            {isRegister && (
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
                            )}

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

                            {isRegister && (
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
                            )}

                            <div>
                                <label className="text-xs font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                                    Password
                                </label>
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 font-bold text-black transition flex items-center justify-center gap-2"
                    >
                        {loading ? "Processing..." : otpStep ? "Verify OTP & Activate" : isRegister ? "Register Supplier Account" : "Log In to Supplier Portal"}
                        <ArrowRight size={18} />
                    </button>
                </form>

                {!otpStep && (
                    <div className="text-center pt-2 border-t border-white/10">
                        <button
                            type="button"
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-xs text-amber-400 hover:underline font-semibold"
                        >
                            {isRegister ? "Already registered? Log in here" : "Need a supplier account? Register here"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
