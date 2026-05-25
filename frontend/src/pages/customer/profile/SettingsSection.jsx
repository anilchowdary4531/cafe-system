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

            <section className="space-y-2 px-1 py-2">
                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Addresses</p>
                <h2 className="text-lg font-semibold">Saved addresses</h2>
                <p className="theme-muted text-xs">Stored in your account (requires OTP session token).</p>

                {!canUseProfileApi ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs">
                        <p className="font-semibold">Login required</p>
                        <p className="theme-muted mt-1">Enable "Remember login" and login again to save addresses.</p>
                    </div>
                ) : (
                    <>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-1 block text-xs">Address line 1</label>
                                <input
                                    value={addressDraft.line1}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line1: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Flat / Street / Building"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-1 block text-xs">Address line 2 (optional)</label>
                                <input
                                    value={addressDraft.line2}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, line2: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Landmark / Area"
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
                                <label className="theme-muted mb-1 block text-xs">State</label>
                                <input
                                    value={addressDraft.state}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, state: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
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
                                            <p className="text-sm font-semibold">
                                                {addr.label}
                                                {addr.isDefault ? " (Default)" : ""}
                                            </p>
                                            <p className="theme-muted mt-0.5 text-xs">{addr.line1}</p>
                                            {(addr.city || addr.state || addr.postalCode) && (
                                                <p className="theme-muted mt-0.5 text-[11px]">
                                                    {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
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
