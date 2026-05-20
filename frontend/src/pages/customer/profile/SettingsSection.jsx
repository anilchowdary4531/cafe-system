import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Lock, Mail, MapPin, Phone, Save, Trash2, UserCircle2 } from "lucide-react";
import ThemeSelector from "../../../components/ThemeSelector";
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
    state: "",
    postalCode: "",
    notes: "",
    isDefault: false,
});

export default function SettingsSection({ profile, customerToken, loading, saving, error, updateProfile, setError }) {
    const { logoutCustomer } = useAuth();
    const [settings, setSettingsState] = useState(() => getCustomerSettings());
    const [name, setName] = useState(() => String(profile?.name || "").trim());
    const [email, setEmail] = useState(() => String(profile?.email || "").trim());
    const [addressDraft, setAddressDraft] = useState(() => emptyAddress(profile));
    const [addressSaving, setAddressSaving] = useState(false);

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
        <div className="space-y-6">
            <div className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Settings</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Preferences & security</h1>
                <p className="theme-muted mt-3 text-sm md:text-base">Manage profile, privacy, and device settings.</p>
            </div>

            {(error || addressError) && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error || addressError}
                </div>
            )}

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Profile</p>
                        <h2 className="mt-2 text-2xl font-semibold">Customer details</h2>
                        <p className="theme-muted mt-2 text-sm">Phone is mandatory and locked. Email is optional.</p>
                    </div>
                    <button
                        type="button"
                        onClick={saveProfile}
                        disabled={saving || loading}
                        className="theme-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <Save size={16} />
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label className="theme-muted mb-2 block text-sm">Name</label>
                        <div className="relative">
                            <UserCircle2 size={18} className="theme-muted absolute left-4 top-3.5" />
                            <input
                                value={name}
                                onChange={(e) => {
                                    setError("");
                                    setName(e.target.value);
                                }}
                                className="theme-input w-full rounded-2xl px-11 py-3 outline-none"
                                placeholder="Your name"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="theme-muted mb-2 block text-sm">Email (optional)</label>
                        <div className="relative">
                            <Mail size={18} className="theme-muted absolute left-4 top-3.5" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setError("");
                                    setEmail(e.target.value);
                                }}
                                className="theme-input w-full rounded-2xl px-11 py-3 outline-none"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="theme-muted mb-2 block text-sm">Phone</label>
                        <div className="relative">
                            <Phone size={18} className="theme-muted absolute left-4 top-3.5" />
                            <input
                                value={phone}
                                readOnly
                                className="theme-input w-full cursor-not-allowed rounded-2xl px-11 py-3 outline-none opacity-80"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">UI</p>
                <h2 className="mt-2 text-2xl font-semibold">Theme</h2>
                <p className="theme-muted mt-2 text-sm">Your theme selection applies across pages.</p>
                <div className="mt-5">
                    <ThemeSelector />
                </div>
            </section>

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Privacy</p>
                <h2 className="mt-2 text-2xl font-semibold">Device settings</h2>
                <div className="mt-6 space-y-3">
                    <SettingToggle
                        icon={<Lock size={18} />}
                        title="Remember my login on this device"
                        description="Keeps you logged in for faster checkout next time."
                        checked={settings.rememberSession !== false}
                        onChange={(nextValue) => {
                            updateSettings({ rememberSession: nextValue });
                            if (!nextValue) {
                                showToast({ title: "Disabled", message: "You’ll be logged out on this device.", variant: "info", durationMs: 2500 });
                                logoutCustomer();
                            } else {
                                showToast({ title: "Enabled", message: "Your next OTP login will stay logged in.", variant: "success" });
                            }
                        }}
                    />

                    <SettingToggle
                        icon={<MapPin size={18} />}
                        title="Auto-select nearest restaurant"
                        description="Uses device location on home page to pick the closest restaurant."
                        checked={settings.autoDetectNearestRestaurant !== false}
                        onChange={(nextValue) => updateSettings({ autoDetectNearestRestaurant: nextValue })}
                    />

                    <SettingToggle
                        icon={<Bell size={18} />}
                        title="Order update notifications"
                        description="Show order status updates on this device (coming soon)."
                        checked={settings.orderUpdateNotifications !== false}
                        onChange={(nextValue) => updateSettings({ orderUpdateNotifications: nextValue })}
                    />
                </div>
            </section>

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Addresses</p>
                <h2 className="mt-2 text-2xl font-semibold">Saved addresses</h2>
                <p className="theme-muted mt-2 text-sm">Stored in your account (requires OTP session token).</p>

                {!canUseProfileApi ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                        <p className="font-semibold">Login required</p>
                        <p className="theme-muted mt-1">Enable “Remember login” and login again to save addresses.</p>
                    </div>
                ) : (
                    <>
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-2 block text-sm">Address line 1</label>
                                <input
                                    value={addressDraft.line1}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line1: e.target.value }))}
                                    className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                    placeholder="Flat / Street / Building"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-2 block text-sm">Address line 2 (optional)</label>
                                <input
                                    value={addressDraft.line2}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line2: e.target.value }))}
                                    className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                    placeholder="Landmark / Area"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-2 block text-sm">City</label>
                                <input
                                    value={addressDraft.city}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                                    className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-2 block text-sm">State</label>
                                <input
                                    value={addressDraft.state}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, state: e.target.value }))}
                                    className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-2 block text-sm">Postal code</label>
                                <input
                                    value={addressDraft.postalCode}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, postalCode: e.target.value }))}
                                    className="theme-input w-full rounded-2xl px-4 py-3 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                                <input
                                    id="defaultAddr"
                                    type="checkbox"
                                    checked={Boolean(addressDraft.isDefault)}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                                />
                                <label htmlFor="defaultAddr" className="text-sm font-semibold">
                                    Make default
                                </label>
                            </div>
                            <div className="md:col-span-2">
                                <button
                                    type="button"
                                    onClick={createAddress}
                                    disabled={addressSaving}
                                    className="theme-button w-full rounded-2xl py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {addressSaving ? "Saving..." : "Add Address"}
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            {addressLoading ? (
                                <div className="theme-card rounded-2xl p-4">
                                    <p className="theme-muted text-sm">Loading addresses...</p>
                                </div>
                            ) : addresses.length ? (
                                addresses.map((addr) => (
                                    <div key={addr.id} className="theme-card rounded-2xl p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold">
                                                    {addr.label}
                                                    {addr.isDefault ? " (Default)" : ""}
                                                </p>
                                                <p className="theme-muted mt-1 text-sm">{addr.line1}</p>
                                                {(addr.city || addr.state || addr.postalCode) && (
                                                    <p className="theme-muted mt-1 text-xs">
                                                        {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => deleteAddress(addr.id)}
                                                className="theme-soft-button inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                                                aria-label="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="theme-card rounded-2xl p-4">
                                    <p className="theme-muted text-sm">No addresses saved.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Maintenance</p>
                <h2 className="mt-2 text-2xl font-semibold">Cache</h2>
                <div className="mt-6 space-y-3">
                    <SettingAction
                        icon={<Trash2 size={18} />}
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

            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Security</p>
                <h2 className="mt-2 text-2xl font-semibold">Logout</h2>
                <p className="theme-muted mt-2 text-sm">Signs you out on this device and clears cached data.</p>
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={() => logoutCustomer()}
                        className="w-full rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold"
                    >
                        Logout
                    </button>
                </div>
            </section>
        </div>
    );
}

function SettingToggle({ icon, title, description, checked, onChange }) {
    return (
        <div className="theme-card rounded-3xl p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="theme-accent-text">{icon}</span>
                        <p className="font-semibold">{title}</p>
                    </div>
                    {description && <p className="theme-muted mt-1 text-sm">{description}</p>}
                </div>

                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={Boolean(checked)}
                        onChange={(e) => onChange && onChange(e.target.checked)}
                    />
                    <span
                        className="h-6 w-11 rounded-full border transition"
                        style={{
                            borderColor: "var(--app-border)",
                            background: Boolean(checked)
                                ? "var(--app-primary)"
                                : "color-mix(in srgb, var(--app-surface-2) 70%, transparent)",
                        }}
                    />
                    <span
                        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition"
                        style={{
                            background: "var(--app-text)",
                            transform: Boolean(checked) ? "translateX(20px)" : "translateX(0px)",
                        }}
                    />
                </label>
            </div>
        </div>
    );
}

function SettingAction({ icon, title, description, actionLabel, onAction }) {
    return (
        <div className="theme-card rounded-3xl p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="theme-accent-text">{icon}</span>
                        <p className="font-semibold">{title}</p>
                    </div>
                    {description && <p className="theme-muted mt-1 text-sm">{description}</p>}
                </div>

                <button
                    type="button"
                    onClick={onAction}
                    className="theme-soft-button shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold"
                >
                    {actionLabel}
                </button>
            </div>
        </div>
    );
}

