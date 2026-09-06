import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, Lock, Mail, MapPin, Phone, Save, Trash2, UserCircle2, X } from "lucide-react";
import ThemeSelector from "../../../components/ThemeSelector";
import LanguageSelector from "../../../components/LanguageSelector";
import NotificationSoundPicker from "../../../components/NotificationSoundPicker";
import { useLanguage } from "../../../context/LanguageContext";
import { clearAllCache } from "../../../utils/localCache";
import { getCustomerSettings, setCustomerSettings } from "../../../utils/customerSettings";
import { showToast } from "../../../utils/toast";
import { api, invalidateGetCache } from "../../../utils/apiClient";
import useCachedGet from "../../../hooks/useCachedGet";
import { useAuth } from "../../../context/AuthContext";

const emptyAddress = (profile) => ({
    label: "Home",
    name: String(profile?.name || "").trim(),
    phone: String(profile?.phone || "").trim(),
    line1: "",
    line2: "",
    city: "",
    mandal: "",
    postalCode: "",
    latitude: null,
    longitude: null,
    notes: "",
    isDefault: false,
});

const normalizeCoordinate = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export default function SettingsSection({ profile, customerToken, loading, saving, error, updateProfile, setError }) {
    const { logoutCustomer } = useAuth();
    const { t } = useLanguage();
    const [settings, setSettingsState] = useState(() => getCustomerSettings());
    const [name, setName] = useState(() => String(profile?.name || "").trim());
    const [email, setEmail] = useState(() => String(profile?.email || "").trim());
    const [addressDraft, setAddressDraft] = useState(() => emptyAddress(profile));
    const [addressSaving, setAddressSaving] = useState(false);

    // Delete Account State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteStep, setDeleteStep] = useState("confirm"); // "confirm" | "otp"
    const [deleteOtp, setDeleteOtp] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [deleteDevOtp, setDeleteDevOtp] = useState("");

    const handleRequestDeleteOtp = async () => {
        try {
            setDeleteLoading(true);
            setDeleteError("");
            const res = await api.post("/customer/delete-account/request-otp");
            if (res.data?.devOtp) {
                setDeleteDevOtp(res.data.devOtp);
            }
            setDeleteStep("otp");
            showToast({ title: "OTP Sent", message: "OTP sent to your registered phone/email.", variant: "info" });
        } catch (err) {
            setDeleteError(err.response?.data?.message || err.message || "Failed to send OTP");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleConfirmDeleteAccount = async () => {
        if (!deleteOtp.trim()) {
            setDeleteError("Please enter the OTP.");
            return;
        }
        try {
            setDeleteLoading(true);
            setDeleteError("");
            await api.post("/customer/delete-account/verify", { otp: deleteOtp.trim() });
            showToast({ title: "Account Deleted", message: "Your account has been deleted.", variant: "success" });
            logoutCustomer();
        } catch (err) {
            setDeleteError(err.response?.data?.message || err.message || "Failed to delete account");
        } finally {
            setDeleteLoading(false);
        }
    };

    useEffect(() => {
        setName(String(profile?.name || "").trim());
        setEmail(String(profile?.email || "").trim());
        setAddressDraft((prev) => ({
            ...prev,
            name: prev.name ? prev.name : String(profile?.name || "").trim(),
            phone: prev.phone ? prev.phone : String(profile?.phone || "").trim(),
        }));
    }, [profile?.email, profile?.name, profile?.phone]);

    const updateSettings = useCallback((patch) => {
        const next = setCustomerSettings(patch);
        setSettingsState(next);
        return next;
    }, []);

    const canUseProfileApi = Boolean(customerToken);
    const phone = String(profile?.phone || "").trim();

    const { data: addressData, loading: addressLoading, error: addressError, refresh: refreshAddresses } = useCachedGet("/customer/address", {
        enabled: canUseProfileApi,
        ttlMs: 12_000,
        staleMs: 5 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    const addresses = useMemo(() => (Array.isArray(addressData?.addresses) ? addressData.addresses : []), [addressData?.addresses]);

    const saveProfile = useCallback(async () => {
        try {
            await updateProfile({ name, email });
            showToast({ title: "Saved", message: "Profile updated.", variant: "success" });
        } catch {
            // error is set by hook
        }
    }, [email, name, updateProfile]);

    const createAddress = useCallback(async () => {
        if (!canUseProfileApi) return;
        if (!String(addressDraft.line1 || "").trim()) {
            showToast({ title: "Address required", message: "Please enter address line 1.", variant: "error" });
            return;
        }
        if (!String(addressDraft.city || "").trim()) {
            showToast({ title: "City required", message: "Please enter the city.", variant: "error" });
            return;
        }
        if (!String(addressDraft.mandal || "").trim()) {
            showToast({ title: "Mandal required", message: "Please enter the mandal or area.", variant: "error" });
            return;
        }
        setAddressSaving(true);
        try {
            await api.post("/customer/address", addressDraft);
            invalidateGetCache({ urlStartsWith: "/customer/address" });
            await refreshAddresses({ force: true });
            setAddressDraft(emptyAddress(profile));
            showToast({ title: "Saved", message: "Address added.", variant: "success" });
        } catch (err) {
            showToast({ title: "Failed", message: err.response?.data?.message || "Failed to save address", variant: "error" });
        } finally {
            setAddressSaving(false);
        }
    }, [addressDraft, canUseProfileApi, profile, refreshAddresses]);

    const deleteAddress = useCallback(
        async (id) => {
            if (!canUseProfileApi) return;
            try {
                await api.delete(`/customer/address/${id}`);
                invalidateGetCache({ urlStartsWith: "/customer/address" });
                await refreshAddresses({ force: true });
                showToast({ title: "Deleted", message: "Address removed.", variant: "success" });
            } catch (err) {
                showToast({ title: "Failed", message: err.response?.data?.message || "Failed to delete address", variant: "error" });
            }
        },
        [canUseProfileApi, refreshAddresses]
    );

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Settings</h1>
                <p className="theme-muted text-sm">Account details, app preferences, and security settings.</p>
            </div>

            {(error || addressError) && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                    {error || addressError}
                </div>
            )}

            {/* Profile Details Card */}
            <section className="rounded-3xl border border-black/5 bg-white/40 p-5 sm:p-6 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold">Profile Details</h2>
                        <p className="theme-muted text-xs">Phone is locked to your active session.</p>
                    </div>
                    <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving || loading}
                        className="theme-button inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold shadow-sm transition hover:scale-[1.02] disabled:opacity-60"
                    >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>

                <div className="space-y-3.5">
                    <div>
                        <label className="theme-muted mb-1 block text-xs font-semibold">Name</label>
                        <div className="relative">
                            <UserCircle2 size={18} className="theme-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                value={name}
                                onChange={(e) => {
                                    setError("");
                                    setName(e.target.value);
                                }}
                                className="w-full rounded-2xl border border-black/5 bg-black/5 px-10 py-3 text-sm font-medium outline-none transition focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                placeholder="Your name"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2">
                        <div>
                            <label className="theme-muted mb-1 block text-xs font-semibold">Email (optional)</label>
                            <div className="relative">
                                <Mail size={18} className="theme-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setError("");
                                        setEmail(e.target.value);
                                    }}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-10 py-3 text-sm font-medium outline-none transition focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="theme-muted mb-1 block text-xs font-semibold">Phone</label>
                            <div className="relative">
                                <Phone size={18} className="theme-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    value={phone}
                                    readOnly
                                    className="w-full cursor-not-allowed rounded-2xl border border-transparent bg-black/5 px-10 py-3 text-sm font-medium outline-none opacity-60 dark:bg-white/5"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Appearance & Sound Card */}
            <section className="rounded-3xl border border-black/5 bg-white/40 p-5 sm:p-6 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/40 space-y-4">
                <div>
                    <h2 className="text-lg font-bold">Appearance & Audio</h2>
                    <p className="theme-muted text-xs">Customize app theme, audio tones, and language.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="theme-muted mb-2 block text-xs font-semibold uppercase tracking-wider">UI Theme</label>
                        <ThemeSelector />
                    </div>

                    <div>
                        <label className="theme-muted mb-2 block text-xs font-semibold uppercase tracking-wider">Notification Tone</label>
                        <NotificationSoundPicker />
                    </div>

                    <div>
                        <label className="theme-muted mb-2 block text-xs font-semibold uppercase tracking-wider">App Language</label>
                        <div className="rounded-2xl border border-black/5 bg-black/5 overflow-hidden dark:border-white/5 dark:bg-white/5">
                            <LanguageSelector variant="menu-item" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Privacy & Device Settings Card */}
            <section className="rounded-3xl border border-black/5 bg-white/40 p-5 sm:p-6 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/40 space-y-3">
                <div>
                    <h2 className="text-lg font-bold">Privacy & Device Controls</h2>
                    <p className="theme-muted text-xs">Manage device permissions and session preferences.</p>
                </div>

                <div className="divide-y divide-black/5 dark:divide-white/5">
                    <SettingToggle
                        icon={<Lock size={18} />}
                        title="Remember session on this device"
                        description="Keeps you logged in for faster checkout."
                        checked={settings.rememberSession !== false}
                        onChange={(nextValue) => {
                            updateSettings({ rememberSession: nextValue });
                            if (!nextValue) {
                                showToast({ title: "Disabled", message: "You'll be logged out on this device.", variant: "info", durationMs: 2500 });
                                logoutCustomer();
                            } else {
                                showToast({ title: "Enabled", message: "Your session will stay logged in.", variant: "success" });
                            }
                        }}
                    />

                    <SettingToggle
                        icon={<MapPin size={18} />}
                        title="Auto-detect nearest restaurant"
                        description="Uses device location on home screen to pick nearest restaurant."
                        checked={settings.autoDetectNearestRestaurant !== false}
                        onChange={(nextValue) => updateSettings({ autoDetectNearestRestaurant: nextValue })}
                    />

                    <SettingToggle
                        icon={<Bell size={18} />}
                        title="Order update notifications"
                        description="Show live order status updates on this device."
                        checked={settings.orderUpdateNotifications !== false}
                        onChange={(nextValue) => updateSettings({ orderUpdateNotifications: nextValue })}
                    />
                </div>
            </section>

            {/* Delivery Addresses Card */}
            <section id="addresses" className="scroll-mt-24 rounded-3xl border border-black/5 bg-white/40 p-5 sm:p-6 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/40 space-y-4">
                <div>
                    <h2 className="text-lg font-bold">Delivery Addresses</h2>
                    <p className="theme-muted text-xs">Manage saved locations for fast delivery checkout.</p>
                </div>

                {!canUseProfileApi ? (
                    <div className="rounded-2xl bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
                        <p className="font-bold">Login session required</p>
                        <p className="mt-0.5">Please log in to save and manage delivery addresses.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3.5 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <input
                                    value={addressDraft.line1}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line1: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="Flat / Building / House No. *"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <input
                                    value={addressDraft.line2}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line2: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="Street / Area / Locality"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <textarea
                                    value={addressDraft.notes}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, notes: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    rows={2}
                                    placeholder="Delivery instructions / Landmark (e.g. Near HDFC Bank)"
                                />
                            </div>
                            <div>
                                <input
                                    value={addressDraft.city}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="City *"
                                />
                            </div>
                            <div>
                                <input
                                    value={addressDraft.mandal}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, mandal: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="Mandal / Area *"
                                />
                            </div>
                            <div>
                                <input
                                    type="number"
                                    step="any"
                                    value={addressDraft.latitude ?? ""}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, latitude: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="Latitude (GPS optional)"
                                />
                            </div>
                            <div>
                                <input
                                    type="number"
                                    step="any"
                                    value={addressDraft.longitude ?? ""}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, longitude: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="Longitude (GPS optional)"
                                />
                            </div>
                            <div>
                                <input
                                    value={addressDraft.postalCode}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, postalCode: e.target.value }))}
                                    className="w-full rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 dark:border-white/5 dark:bg-white/5"
                                    placeholder="Postal Code"
                                />
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-xs font-medium dark:border-white/5 dark:bg-white/5">
                                <input
                                    id="defaultAddr"
                                    type="checkbox"
                                    checked={Boolean(addressDraft.isDefault)}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 accent-amber-500"
                                />
                                <label htmlFor="defaultAddr" className="cursor-pointer font-semibold">
                                    Set as default address
                                </label>
                            </div>
                            <div className="sm:col-span-2 pt-1">
                                <button
                                    type="button"
                                    onClick={createAddress}
                                    disabled={addressSaving}
                                    className="theme-button w-full rounded-2xl py-3 text-xs font-bold uppercase tracking-wider shadow-sm transition hover:scale-[1.01] disabled:opacity-60"
                                >
                                    {addressSaving ? "Saving Address..." : "Add New Address"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            {addressLoading ? (
                                <div className="theme-muted py-2 text-xs">Loading addresses...</div>
                            ) : addresses.length ? (
                                addresses.map((addr) => (
                                    <div key={addr.id} className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-white/5">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold">{addr.label}</p>
                                                {addr.isDefault ? (
                                                    <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                        Default
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="theme-muted mt-1 text-xs">{[addr.line1, addr.line2].filter(Boolean).join(", ")}</p>
                                            {(addr.city || addr.mandal || addr.postalCode) && (
                                                <p className="theme-muted mt-0.5 text-[11px]">
                                                    {[addr.city, addr.mandal, addr.postalCode].filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => deleteAddress(addr.id)}
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition"
                                            aria-label="Delete Address"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="theme-muted py-2 text-xs">No saved addresses yet.</div>
                            )}
                        </div>
                    </>
                )}
            </section>

            {/* System & Account Actions Card */}
            <section className="rounded-3xl border border-black/5 bg-white/40 p-5 sm:p-6 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/40 space-y-4">
                <div>
                    <h2 className="text-lg font-bold">System & Account</h2>
                    <p className="theme-muted text-xs">Manage system cache and account session.</p>
                </div>

                <div className="space-y-3">
                    <SettingAction
                        icon={<Trash2 size={18} />}
                        title="Clear cached data"
                        description="Fixes stale screens and reloads fresh data on this device."
                        actionLabel="Clear Cache"
                        onAction={() => {
                            clearAllCache();
                            invalidateGetCache({ urlStartsWith: "/customer" });
                            showToast({ title: "Cache cleared", message: "Fresh data will load next time.", variant: "success" });
                        }}
                    />

                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => logoutCustomer()}
                            className="flex-1 rounded-2xl bg-red-500/10 border border-red-500/20 py-3 text-xs font-bold text-red-500 hover:bg-red-500/20 transition"
                        >
                            Log Out
                        </button>
                        <Link
                            to="/profile/delete-account"
                            className="flex-1 text-center rounded-2xl bg-red-500/5 border border-red-500/15 py-3 text-xs font-bold text-red-400 hover:bg-red-500/10 transition"
                        >
                            {t("deleteAccount")}
                        </Link>
                    </div>
                </div>
            </section>

            {/* DELETE ACCOUNT MODAL */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-red-500">
                                <AlertTriangle size={22} />
                                <h3 className="text-lg font-bold">{t("deleteAccountTitle")}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                className="rounded-full p-1 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {deleteError && (
                            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-xs text-red-400">
                                {deleteError}
                            </div>
                        )}

                        {deleteStep === "confirm" ? (
                            <div className="mt-4 space-y-4">
                                <p className="text-sm theme-muted leading-relaxed">
                                    {t("deleteAccountDesc")}
                                </p>
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteModal(false)}
                                        className="theme-soft-button rounded-xl px-4 py-2 text-xs font-semibold"
                                    >
                                        {t("cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRequestDeleteOtp}
                                        disabled={deleteLoading}
                                        className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
                                    >
                                        {deleteLoading ? "Sending OTP..." : t("requestDeleteOtp")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <p className="text-sm theme-muted">
                                    {t("enterDeleteOtp")}
                                </p>
                                <div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder={t("placeholderOtp")}
                                        value={deleteOtp}
                                        onChange={(e) => setDeleteOtp(e.target.value)}
                                        className="theme-input w-full rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest outline-none"
                                    />
                                    {deleteDevOtp && (
                                        <p className="mt-1 text-xs theme-muted">Dev OTP: {deleteDevOtp}</p>
                                    )}
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={handleRequestDeleteOtp}
                                        disabled={deleteLoading}
                                        className="text-xs theme-muted underline decoration-dotted"
                                    >
                                        {t("resendOtp")}
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowDeleteModal(false)}
                                            className="theme-soft-button rounded-xl px-4 py-2 text-xs font-semibold"
                                        >
                                            {t("cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmDeleteAccount}
                                            disabled={deleteLoading}
                                            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                                        >
                                            {deleteLoading ? t("deletingAccount") : t("confirmDeleteAccount")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function SettingToggle({ icon, title, description, checked, onChange }) {
    return (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] py-2.5 last:border-b-0">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="theme-accent-text">{icon}</span>
                    <p className="text-sm font-semibold">{title}</p>
                </div>
                {description && <p className="theme-muted mt-0.5 text-xs">{description}</p>}
            </div>

            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={Boolean(checked)}
                    onChange={(e) => onChange && onChange(e.target.checked)}
                />
                <span
                    className="h-5 w-10 rounded-full border transition"
                    style={{
                        borderColor: "var(--app-border)",
                        background: Boolean(checked)
                            ? "var(--app-primary)"
                            : "color-mix(in srgb, var(--app-surface-2) 70%, transparent)",
                    }}
                />
                <span
                    className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition"
                    style={{
                        background: "var(--app-text)",
                        transform: Boolean(checked) ? "translateX(20px)" : "translateX(0px)",
                    }}
                />
            </label>
        </div>
    );
}

function SettingAction({ icon, title, description, actionLabel, onAction }) {
    return (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] py-2.5 last:border-b-0">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="theme-accent-text">{icon}</span>
                    <p className="text-sm font-semibold">{title}</p>
                </div>
                {description && <p className="theme-muted mt-0.5 text-xs">{description}</p>}
            </div>

            <button
                type="button"
                onClick={onAction}
                className="theme-soft-button shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
                {actionLabel}
            </button>
        </div>
    );
}
