import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import { showToast } from "../../../utils/toast";
import { api } from "../../../utils/apiClient";

export default function DeleteAccountSection() {
    const { logoutCustomer, customer } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [deleteStep, setDeleteStep] = useState("confirm"); // "confirm" | "otp"
    const [deleteOtp, setDeleteOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [devOtp, setDevOtp] = useState("");

    const phone = String(customer?.phone || "").trim();
    const maskedPhone = phone ? phone.replace(/(\d{2})(\d+)(\d{4})/, "$1******$3") : "";

    const handleRequestDeleteOtp = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await api.post("/customer/delete-account/request-otp");
            if (res.data?.devOtp) {
                setDevOtp(res.data.devOtp);
            }
            setDeleteStep("otp");
            showToast({ title: "OTP Sent", message: "OTP sent to your registered contact.", variant: "info" });
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDeleteAccount = async () => {
        if (!deleteOtp.trim()) {
            setError("Please enter the 6-digit OTP.");
            return;
        }
        try {
            setLoading(true);
            setError("");
            await api.post("/customer/delete-account/verify", { otp: deleteOtp.trim() });
            showToast({ title: "Account Deleted", message: "Your account has been deleted successfully.", variant: "success" });
            logoutCustomer();
            navigate("/login?mode=customer", { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to delete account");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-2xl space-y-6">
            {/* BACK BUTTON */}
            <div className="flex items-center gap-3">
                <Link
                    to="/profile/settings"
                    className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    title="Back to Settings"
                >
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-red-500">{t("deleteAccount")}</h1>
                    <p className="theme-muted text-xs">Dedicated Page • OTP Security Verification</p>
                </div>
            </div>

            {/* DANGER HERO BANNER */}
            <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 text-red-500">
                        <ShieldAlert size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-500">{t("deleteAccountTitle")}</h2>
                        <p className="theme-muted mt-2 text-sm leading-relaxed">
                            {t("deleteAccountDesc")}
                        </p>
                    </div>
                </div>
            </div>

            {/* WHAT GETS DELETED CARD */}
            <div className="theme-panel rounded-3xl p-6">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    What happens when you delete your account:
                </h3>
                <ul className="space-y-3 text-sm theme-muted">
                    <li className="flex items-start gap-3">
                        <span className="mt-0.5 text-red-500 font-bold">•</span>
                        <span>Your login credentials, username, name, email, and phone number will be permanently removed.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="mt-0.5 text-red-500 font-bold">•</span>
                        <span>All your saved delivery addresses will be deleted.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="mt-0.5 text-red-500 font-bold">•</span>
                        <span>This action is final and cannot be restored or undone.</span>
                    </li>
                </ul>
            </div>

            {/* OTP VERIFICATION WORKFLOW CARD */}
            <div className="theme-panel rounded-3xl p-6 sm:p-8">
                {error && (
                    <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-xs font-semibold text-red-400">
                        {error}
                    </div>
                )}

                {deleteStep === "confirm" ? (
                    <div className="space-y-5 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                            <Trash2 size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Step 1: Request Deletion OTP</h3>
                            <p className="theme-muted mt-1 text-sm">
                                We will send a 6-digit security OTP to {maskedPhone ? <strong className="theme-accent-text">{maskedPhone}</strong> : "your registered phone/email"} to verify your identity.
                            </p>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                to="/profile/settings"
                                className="theme-soft-button w-full sm:w-auto rounded-xl px-6 py-3 text-sm font-semibold"
                            >
                                {t("cancel")}
                            </Link>
                            <button
                                type="button"
                                onClick={handleRequestDeleteOtp}
                                disabled={loading}
                                className="w-full sm:w-auto rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                                {loading ? "Sending OTP..." : t("requestDeleteOtp")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <h3 className="text-lg font-bold">{t("enterDeleteOtp")}</h3>
                            <p className="theme-muted mt-1 text-sm">
                                Enter the 6-digit code sent to {maskedPhone ? <strong>{maskedPhone}</strong> : "your phone"}.
                            </p>
                        </div>

                        <div>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder={t("placeholderOtp")}
                                value={deleteOtp}
                                onChange={(e) => setDeleteOtp(e.target.value)}
                                className="theme-input w-full rounded-2xl py-4 text-center text-2xl font-bold tracking-[0.25em] outline-none transition focus:ring-2 focus:ring-red-500/50"
                            />
                            {devOtp && (
                                <p className="theme-muted mt-2 text-center text-xs font-mono">
                                    Dev OTP: {devOtp}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <button
                                type="button"
                                onClick={handleRequestDeleteOtp}
                                disabled={loading}
                                className="theme-muted underline decoration-dotted hover:opacity-80 disabled:opacity-60"
                            >
                                {t("resendOtp")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeleteStep("confirm")}
                                className="theme-muted hover:underline"
                            >
                                Back
                            </button>
                        </div>

                        <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate("/profile/settings")}
                                className="theme-soft-button w-full sm:w-1/2 rounded-xl py-3 text-sm font-semibold"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteAccount}
                                disabled={loading}
                                className="w-full sm:w-1/2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60 shadow-lg shadow-red-600/20"
                            >
                                {loading ? t("deletingAccount") : t("confirmDeleteAccount")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
