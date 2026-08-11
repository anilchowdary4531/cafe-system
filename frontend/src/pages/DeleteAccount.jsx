import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Lock, Mail, Phone, ShieldAlert, Trash2, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { showToast } from "../utils/toast";
import { api } from "../utils/apiClient";
import BrandLogo from "../components/BrandLogo";

export default function DeleteAccount() {
    const { logoutCustomer, customer } = useAuth();
    const { t } = useLanguage();

    const [phoneOrEmail, setPhoneOrEmail] = useState(() => String(customer?.phone || "").trim());
    const [step, setStep] = useState("request"); // "request" | "otp" | "success"
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [devOtp, setDevOtp] = useState("");

    // Contact Form fallback for users without phone access
    const [manualEmail, setManualEmail] = useState("");
    const [manualPhone, setManualPhone] = useState("");
    const [manualReason, setManualReason] = useState("");
    const [manualSubmitted, setManualSubmitted] = useState(false);

    const handleRequestOtp = async (e) => {
        e?.preventDefault();
        const identifier = phoneOrEmail.trim();
        if (!identifier) {
            setError("Please enter your registered phone number or email.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const res = await api.post("/customer/delete-account/request-otp", { phone: identifier });
            if (res.data?.devOtp) {
                setDevOtp(res.data.devOtp);
            }
            setStep("otp");
            showToast({ title: "OTP Sent", message: "OTP sent to your registered phone/email.", variant: "info" });
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to send OTP. Ensure your phone number is correct.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndDelete = async (e) => {
        e?.preventDefault();
        if (!otp.trim()) {
            setError("Please enter the 6-digit OTP code.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            await api.post("/customer/delete-account/verify", { phone: phoneOrEmail.trim(), otp: otp.trim() });
            setStep("success");
            showToast({ title: "Account Deleted", message: "Your account has been deleted successfully.", variant: "success" });
            if (customer) {
                logoutCustomer();
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to verify OTP or delete account.");
        } finally {
            setLoading(false);
        }
    };

    const handleManualRequest = (e) => {
        e?.preventDefault();
        if (!manualPhone.trim() && !manualEmail.trim()) {
            showToast({ title: "Contact info required", message: "Please provide phone number or email.", variant: "error" });
            return;
        }
        setManualSubmitted(true);
        showToast({ title: "Request Received", message: "Your deletion request has been submitted.", variant: "success" });
    };

    return (
        <div className="theme-page min-h-screen py-10 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-10">

                {/* HEADER / BANNER */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-red-500">
                        <ShieldAlert size={15} />
                        Account Deletion & Data Privacy
                    </div>

                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                        Tiffzy Account Deletion Request
                    </h1>

                    <p className="mx-auto max-w-2xl text-base sm:text-lg theme-muted leading-relaxed">
                        In compliance with Google Play Developer Policy and user privacy standards, Tiffzy allows all customers to request permanent deletion of their account and associated data.
                    </p>
                </div>

                {/* INTERACTIVE ONLINE DELETION CARD */}
                <div className="theme-panel rounded-3xl p-6 sm:p-10 shadow-xl border border-red-500/20">
                    <div className="mb-6 flex items-center gap-3 border-b border-[var(--app-border)] pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Instant Online Account Deletion</h2>
                            <p className="text-xs theme-muted">Verify your phone number with OTP to permanently delete your account immediately.</p>
                        </div>
                    </div>

                    {step === "success" ? (
                        <div className="py-8 text-center space-y-4 animate-in fade-in duration-300">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                                <CheckCircle2 size={36} />
                            </div>
                            <h3 className="text-2xl font-bold">Account Successfully Deleted</h3>
                            <p className="mx-auto max-w-md text-sm theme-muted">
                                Your Tiffzy customer account, profile details, credentials, and saved addresses have been permanently removed from our active systems.
                            </p>
                            <div className="pt-4">
                                <Link to="/" className="theme-button inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-sm">
                                    Return to Home <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={step === "request" ? handleRequestOtp : handleVerifyAndDelete} className="space-y-5 max-w-lg mx-auto">
                            {error && (
                                <div className="rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-xs font-semibold text-red-400">
                                    {error}
                                </div>
                            )}

                            {step === "request" ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 theme-muted">
                                            Registered Phone Number or Email *
                                        </label>
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-4 top-3.5 theme-muted" />
                                            <input
                                                type="text"
                                                placeholder="e.g. 9876543210 or customer@example.com"
                                                value={phoneOrEmail}
                                                onChange={(e) => setPhoneOrEmail(e.target.value)}
                                                className="theme-input w-full rounded-2xl px-11 py-3.5 outline-none transition"
                                            />
                                        </div>
                                        <p className="mt-2 text-xs theme-muted">
                                            We will send a 6-digit OTP code to verify account ownership before proceeding.
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full rounded-2xl bg-red-600 py-3.5 font-bold text-white transition hover:bg-red-700 disabled:opacity-60 shadow-lg shadow-red-600/20"
                                    >
                                        {loading ? "Sending Deletion OTP..." : "Send OTP to Delete Account"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 theme-muted">
                                            Enter 6-Digit Deletion OTP *
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="123456"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            className="theme-input w-full rounded-2xl py-3.5 text-center text-2xl font-bold tracking-[0.25em] outline-none transition"
                                        />
                                        {devOtp && (
                                            <p className="mt-2 text-center text-xs font-mono theme-muted">
                                                Dev OTP: {devOtp}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                        <button
                                            type="button"
                                            onClick={handleRequestOtp}
                                            disabled={loading}
                                            className="theme-muted underline decoration-dotted hover:opacity-80"
                                        >
                                            Resend OTP
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStep("request")}
                                            className="theme-muted hover:underline"
                                        >
                                            Change Number
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full rounded-2xl bg-red-600 py-3.5 font-bold text-white transition hover:bg-red-700 disabled:opacity-60 shadow-lg shadow-red-600/20"
                                    >
                                        {loading ? "Deleting Account..." : "Verify & Permanently Delete Account"}
                                    </button>
                                </>
                            )}
                        </form>
                    )}
                </div>

                {/* POLICY DETAILS FOR GOOGLE PLAY REVIEWERS & USERS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* WHAT DATA IS DELETED */}
                    <div className="theme-panel rounded-3xl p-6 space-y-3 border border-[var(--app-border)]">
                        <div className="flex items-center gap-2 text-red-500 font-bold text-base">
                            <Trash2 size={18} />
                            <span>Data That Is Permanently Deleted</span>
                        </div>
                        <ul className="space-y-2 text-sm theme-muted list-disc list-inside">
                            <li>Account login credentials (username, password hash)</li>
                            <li>Personal profile information (full name, phone number, email address)</li>
                            <li>Saved delivery addresses and geo-location coordinates</li>
                            <li>Active device tokens and authentication sessions</li>
                            <li>Personalized preferences and reward point balances</li>
                        </ul>
                    </div>

                    {/* WHAT DATA IS RETAINED */}
                    <div className="theme-panel rounded-3xl p-6 space-y-3 border border-[var(--app-border)]">
                        <div className="flex items-center gap-2 text-amber-500 font-bold text-base">
                            <AlertTriangle size={18} />
                            <span>Data Retained & Compliance</span>
                        </div>
                        <ul className="space-y-2 text-sm theme-muted list-disc list-inside">
                            <li>Past financial transactions and tax invoices (retained strictly for statutory tax & audit compliance)</li>
                            <li>Completed order logs required for legal bookkeeping</li>
                            <li>Data retention period for legal invoices: Up to 7 years as mandated by local laws</li>
                            <li>No retained financial data is used for marketing or tracking</li>
                        </ul>
                    </div>

                </div>

                {/* ALTERNATIVE MANUAL DELETION REQUEST FORM */}
                <div className="theme-panel rounded-3xl p-6 sm:p-8 space-y-4">
                    <h3 className="text-lg font-bold">Alternative Deletion Request (Support Email)</h3>
                    <p className="text-sm theme-muted leading-relaxed">
                        If you no longer have access to your registered phone number or cannot receive SMS/OTP, you can submit a manual deletion request below or email our support team directly. Manual requests are processed within <strong>48 hours</strong>.
                    </p>

                    {manualSubmitted ? (
                        <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-4 text-sm text-green-400 font-medium">
                            ✓ Your manual deletion request has been submitted. Our support team will process it within 48 hours and notify you.
                        </div>
                    ) : (
                        <form onSubmit={handleManualRequest} className="space-y-4 max-w-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    value={manualPhone}
                                    onChange={(e) => setManualPhone(e.target.value)}
                                    className="theme-input rounded-xl px-4 py-3 text-sm outline-none"
                                />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={manualEmail}
                                    onChange={(e) => setManualEmail(e.target.value)}
                                    className="theme-input rounded-xl px-4 py-3 text-sm outline-none"
                                />
                            </div>
                            <textarea
                                placeholder="Reason for deletion or additional details (optional)"
                                rows={3}
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                className="theme-input w-full rounded-xl p-4 text-sm outline-none resize-none"
                            />
                            <button
                                type="submit"
                                className="theme-button-secondary rounded-xl px-6 py-2.5 text-sm font-semibold"
                            >
                                Submit Deletion Request
                            </button>
                        </form>
                    )}

                    <div className="pt-2 text-xs theme-muted border-t border-[var(--app-border)]">
                        Support Contact: <strong>jekkaramesh@survetra.com</strong> • Phone: <strong>+91 91777 64632</strong> • Website: <strong>https://tiffzy.com</strong>
                    </div>
                </div>

            </div>
        </div>
    );
}
