import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Lock, Mail, MapPin, Phone, Save, Trash2, UserCircle2, X } from "lucide-react";
import ThemeSelector from "../../../components/ThemeSelector";
import LanguageSelector from "../../../components/LanguageSelector";
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
        <div className="space-y-4">
            <div className="space-y-2 px-1">
                <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">Settings</p>
                <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">Preferences & security</h1>
                <p className="theme-muted text-xs md:text-sm">Manage profile, privacy, and device settings.</p>
            </div>

            {(error || addressError) && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error || addressError}
                </div>
            )}

            <section className="space-y-3 px-1 py-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Profile</p>
                        <h2 className="mt-1 text-lg font-semibold">Customer details</h2>
                        <p className="theme-muted mt-1 text-xs">Phone is mandatory and locked. Email is optional.</p>
                    </div>
                    <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving || loading}
                        className="theme-button inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label className="theme-muted mb-1 block text-xs">Name</label>
                        <div className="relative">
                            <UserCircle2 size={16} className="theme-muted absolute left-3 top-2.5" />
                            <input
                                value={name}
                                onChange={(e) => {
                                    setError("");
                                    setName(e.target.value);
                                }}
                                className="theme-input w-full rounded-xl px-9 py-2.5 text-sm outline-none"
                                placeholder="Your name"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="theme-muted mb-1 block text-xs">Email (optional)</label>
                        <div className="relative">
                            <Mail size={16} className="theme-muted absolute left-3 top-2.5" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setError("");
                                    setEmail(e.target.value);
                                }}
                                className="theme-input w-full rounded-xl px-9 py-2.5 text-sm outline-none"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="theme-muted mb-1 block text-xs">Phone</label>
                        <div className="relative">
                            <Phone size={16} className="theme-muted absolute left-3 top-2.5" />
                            <input
                                value={phone}
                                readOnly
                                className="theme-input w-full cursor-not-allowed rounded-xl px-9 py-2.5 text-sm outline-none opacity-80"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">UI</p>
                <h2 className="text-lg font-semibold">Theme</h2>
                <p className="theme-muted text-xs">Your theme selection applies across pages.</p>
                <div className="pt-1">
                    <ThemeSelector />
                </div>
            </section>

            <section className="space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Privacy</p>
                <h2 className="text-lg font-semibold">Device settings</h2>
                <div className="pt-1">
                    <SettingToggle
                        icon={<Lock size={16} />}
                        title="Remember my login on this device"
                        description="Keeps you logged in for faster checkout next time."
                        checked={settings.rememberSession !== false}
                        onChange={(nextValue) => {
                            updateSettings({ rememberSession: nextValue });
                            if (!nextValue) {
                                showToast({ title: "Disabled", message: "You'll be logged out on this device.", variant: "info", durationMs: 2500 });
                                logoutCustomer();
                            } else {
                                showToast({ title: "Enabled", message: "Your next OTP login will stay logged in.", variant: "success" });
                            }
                        }}
                    />

                    <SettingToggle
                        icon={<MapPin size={16} />}
                        title="Auto-select nearest restaurant"
                        description="Uses device location on home page to pick the closest restaurant."
                        checked={settings.autoDetectNearestRestaurant !== false}
                        onChange={(nextValue) => updateSettings({ autoDetectNearestRestaurant: nextValue })}
                    />

                    <SettingToggle
                        icon={<Bell size={16} />}
                        title="Order update notifications"
                        description="Show order status updates on this device (coming soon)."
                        checked={settings.orderUpdateNotifications !== false}
                        onChange={(nextValue) => updateSettings({ orderUpdateNotifications: nextValue })}
                    />
                </div>
            </section>

            <section id="addresses" className="scroll-mt-24 space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Address</p>
                <h2 className="text-lg font-semibold">Saved address</h2>
                <p className="theme-muted text-xs">Stored in your account (requires OTP session token). Add the exact house / flat and landmark details for delivery.</p>

                {!canUseProfileApi ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs">
                        <p className="font-semibold">Login required</p>
                        <p className="theme-muted mt-1">Enable "Remember login" and login again to save addresses.</p>
                    </div>
                ) : (
                    <>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-1 block text-xs">House / Flat / Building</label>
                                <input
                                    value={addressDraft.line1}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line1: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="House no / Flat no / Building name"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-1 block text-xs">Street / Area (optional)</label>
                                <input
                                    value={addressDraft.line2}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line2: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Street, society, locality"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-1 block text-xs">Landmark / delivery instructions (optional)</label>
                                <textarea
                                    value={addressDraft.notes}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, notes: e.target.value }))}
                                    className="theme-input w-full rounded-2xl px-3 py-2.5 text-sm outline-none"
                                    rows={3}
                                    placeholder="Gate code, nearby shop, floor number, delivery directions..."
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">City</label>
                                <input
                                    value={addressDraft.city}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Mandal / Area</label>
                                <input
                                    value={addressDraft.mandal}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, mandal: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={addressDraft.latitude ?? ""}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, latitude: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="GPS latitude"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={addressDraft.longitude ?? ""}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, longitude: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="GPS longitude"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Postal code</label>
                                <input
                                    value={addressDraft.postalCode}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, postalCode: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs">
                                <input
                                    id="defaultAddr"
                                    type="checkbox"
                                    checked={Boolean(addressDraft.isDefault)}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                                />
                                <label htmlFor="defaultAddr" className="font-semibold">
                                    Make default
                                </label>
                            </div>
                            <div className="md:col-span-2">
                                <button
                                    type="button"
                                    onClick={createAddress}
                                    disabled={addressSaving}
                                    className="theme-button w-full rounded-xl py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {addressSaving ? "Saving..." : "Add Address"}
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 space-y-0">
                            {addressLoading ? (
                                <div className="theme-muted py-2 text-xs">Loading addresses...</div>
                            ) : addresses.length ? (
                                addresses.map((addr) => (
                                    <div key={addr.id} className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] py-3 last:border-b-0">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold">
                                                    {addr.label}
                                                    {addr.isDefault ? " (Default)" : ""}
                                                </p>
                                            </div>
                                            <p className="theme-muted mt-0.5 whitespace-pre-line text-xs">{[addr.line1, addr.line2].filter(Boolean).join("\n")}</p>
                                            {addr.notes && <p className="theme-muted mt-0.5 text-[11px]">{addr.notes}</p>}
                                            {(addr.city || addr.mandal || addr.state || addr.postalCode) && (
                                                <p className="theme-muted mt-0.5 text-[11px]">
                                                    {[addr.city, addr.mandal || addr.state, addr.postalCode].filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                            {(normalizeCoordinate(addr.latitude) != null || normalizeCoordinate(addr.longitude) != null) && (
                                                <p className="theme-muted mt-0.5 text-[11px]">
                                                    Lat, Lng:{" "}
                                                    {[normalizeCoordinate(addr.latitude), normalizeCoordinate(addr.longitude)]
                                                        .map((value) => (value == null ? "" : value.toFixed(5)))
                                                        .filter(Boolean)
                                                        .join(", ")}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => deleteAddress(addr.id)}
                                            className="theme-soft-button inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                            aria-label="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="theme-muted py-2 text-xs">No addresses saved.</div>
                            )}
                        </div>
                    </>
                )}
            </section>

            <section className="space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Preferences</p>
                <h2 className="text-lg font-semibold">App Language</h2>
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-1)] overflow-hidden">
                    <LanguageSelector variant="menu-item" />
                </div>
            </section>

            <section className="space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Maintenance</p>
                <h2 className="text-lg font-semibold">Cache</h2>
                <div className="pt-1">
                    <SettingAction
                        icon={<Trash2 size={16} />}
                        title="Clear cached data"
                        description="Fixes stale screens and reload issues on this device."
                        actionLabel="Clear"
                        onAction={() => {
                            clearAllCache();
                            invalidateGetCache({ urlStartsWith: "/customer" });
                            showToast({ title: "Cache cleared", message: "Fresh data will load next time.", variant: "success" });
                        }}
                    />
                </div>
            </section>

            <section className="space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Security</p>
                <h2 className="text-lg font-semibold">Logout</h2>
                <p className="theme-muted text-xs">Signs you out on this device and clears cached data.</p>
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => logoutCustomer()}
                        className="w-full rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold"
                    >
                        Logout
                    </button>
                </div>
            </section>

            <section className="space-y-2 px-1 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-500">Danger Zone</p>
                <h2 className="text-lg font-semibold text-red-500">{t("deleteAccount")}</h2>
                <p className="theme-muted text-xs">{t("deleteAccountDesc")}</p>
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => {
                            setShowDeleteModal(true);
                            setDeleteStep("confirm");
                            setDeleteOtp("");
                            setDeleteError("");
                        }}
                        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500/20"
                    >
                        {t("deleteAccount")}
                    </button>
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
