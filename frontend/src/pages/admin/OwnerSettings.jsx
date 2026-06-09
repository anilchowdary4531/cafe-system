import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Building2,
    LoaderCircle,
    MapPin,
    Palette,
    ReceiptText,
    Save,
    Settings2,
    ShieldCheck,
    Upload,
    UserCircle2,
} from "lucide-react";
import { API } from "../../config";
import ThemeSelector from "../../components/ThemeSelector";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { uploadToS3Presigned } from "../../utils/s3Upload";

const emptyForm = {
    name: "",
    legalName: "",
    ownerName: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    gstNumber: "",
    logo: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxEnabled: false,
    taxType: "EXCLUSIVE",
    defaultTaxPercent: 0,
    serviceChargeEnabled: false,
    serviceChargePercent: 0,
    invoicePrefix: "",
    nextInvoiceNumber: 1001,
    isActive: true,
};

const sectionClass =
    "theme-panel overflow-hidden rounded-[28px] border border-white/10 bg-black/10 p-5 sm:p-6";
const fieldLabelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] theme-muted";
const inputClass = "theme-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none";

const buildLogoPreviewSources = (rawLogo) => {
    const value = String(rawLogo || "").trim();
    if (!value) return [];

    const sources = [];
    const pushUnique = (src) => {
        const normalized = String(src || "").trim();
        if (!normalized || sources.includes(normalized)) return;
        sources.push(normalized);
    };

    pushUnique(resolveImageUrl(value));

    if (/^https?:\/\//i.test(value)) {
        try {
            const parsed = new URL(value);
            if (parsed.pathname.startsWith("/uploads/")) {
                const localLikePath = `${parsed.pathname}${parsed.search || ""}${parsed.hash || ""}`;
                pushUnique(resolveImageUrl(localLikePath));
                pushUnique(localLikePath);
            }
        } catch {
            // Keep default source only.
        }
    }

    return sources;
};

function SectionHeader({ icon, title, subtitle, logoSrc = "" }) {
    const Icon = icon;

    return (
        <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/15">
                {logoSrc ? (
                    <img
                        src={logoSrc}
                        alt="Restaurant logo"
                        className="h-full w-full rounded-2xl object-cover"
                    />
                ) : (
                    <Icon size={18} className="theme-accent-text" />
                )}
            </span>
            <div>
                <h3 className="text-lg font-semibold leading-tight sm:text-xl">{title}</h3>
                <p className="theme-muted mt-1 text-xs sm:text-sm">{subtitle}</p>
            </div>
        </div>
    );
}

function Field({ label, hint, className = "", children }) {
    return (
        <label className={`block ${className}`}>
            <span className={fieldLabelClass}>{label}</span>
            {children}
            {hint ? <span className="theme-muted mt-1 block text-xs">{hint}</span> : null}
        </label>
    );
}

export default function OwnerSettings() {
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [logoPreviewIndex, setLogoPreviewIndex] = useState(0);

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = Number(user?.restaurantId);
    const setField =
        (key) =>
        (event) => {
            setForm((prev) => ({ ...prev, [key]: event.target.value }));
        };
    const setChecked =
        (key) =>
        (event) => {
            setForm((prev) => ({ ...prev, [key]: event.target.checked }));
        };

    const completionPercent = useMemo(() => {
        const checks = [
            form.name,
            form.legalName,
            form.ownerName,
            form.email,
            form.phone,
            form.addressLine1,
            form.city,
            form.state,
            form.country,
            form.pincode,
            form.gstNumber,
            form.timezone,
            form.currency,
        ];
        const filled = checks.filter((value) => String(value || "").trim().length > 0).length;
        return Math.round((filled / checks.length) * 100);
    }, [form]);

    const taxStatusText = Boolean(form.taxEnabled)
        ? `${String(form.taxType || "EXCLUSIVE").toUpperCase()} tax`
        : "Tax disabled";
    const serviceChargeText = Boolean(form.serviceChargeEnabled)
        ? `${Number(form.serviceChargePercent || 0)}% service charge`
        : "No service charge";
    const logoPreviewSources = useMemo(() => buildLogoPreviewSources(form.logo), [form.logo]);
    const logoPreviewSrc = logoPreviewSources[logoPreviewIndex] || "";
    const logoPreviewFailed = Boolean(String(form.logo || "").trim()) && !logoPreviewSrc;

    const uploadLogo = async (file) => {
        if (!file || !restaurantId) return;
        try {
            setLogoUploading(true);
            setError("");
            const upload = await uploadToS3Presigned({
                restaurantId,
                kind: "logo",
                file,
            });
            if (upload?.publicUrl) {
                setForm((prev) => ({ ...prev, logo: upload.publicUrl }));
                setSuccess("Logo uploaded. Save settings to apply.");
            }
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || err?.message || "Logo upload failed.");
        } finally {
            setLogoUploading(false);
        }
    };

    const loadSettings = async () => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to owner account.");
            return;
        }

        try {
            setLoading(true);
            const res = await axios.get(`${API}/owner/${restaurantId}/settings`);
            setForm({ ...emptyForm, ...(res.data?.restaurant || {}) });
            setError("");
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to load settings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, [restaurantId]);

    useEffect(() => {
        setLogoPreviewIndex(0);
    }, [logoPreviewSources]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setSuccess("");
            setError("");

            const payload = {
                ...form,
                defaultTaxPercent: Number(form.defaultTaxPercent || 0),
                serviceChargePercent: Number(form.serviceChargePercent || 0),
                nextInvoiceNumber: Number(form.nextInvoiceNumber || 1001),
            };

            const res = await axios.put(`${API}/owner/${restaurantId}/settings`, payload);
            setForm({ ...emptyForm, ...(res.data?.restaurant || payload) });
            setSuccess("Settings updated successfully.");
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="theme-panel rounded-[28px] border border-white/10 bg-black/10 p-6">
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <LoaderCircle size={16} className="animate-spin" />
                    Loading settings...
                </div>
            </div>
        );
    }

    return (
        <section className="space-y-5 pb-5">
            {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    {success}
                </div>
            )}

            <div className="theme-panel relative overflow-hidden rounded-[30px] border border-white/10 bg-black/10 p-5 sm:p-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_52%)]" />
                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="theme-muted text-xs font-extrabold uppercase tracking-[0.24em]">
                            Owner Profile
                        </p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                            Restaurant Settings
                        </h2>
                        <p className="theme-muted mt-2 max-w-2xl text-sm">
                            Keep business details, tax setup, and billing preferences up to date.
                        </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 sm:justify-end">
                        <div className="rounded-2xl border border-white/10 bg-black/15 px-2.5 py-1.5 text-xs sm:min-w-[138px] sm:max-w-[138px]">
                            <p className="theme-muted text-[10px] uppercase tracking-[0.14em]">Profile</p>
                            <p className="mt-1 font-semibold leading-tight">{completionPercent}% complete</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/15 px-2.5 py-1.5 text-xs sm:min-w-[138px] sm:max-w-[138px]">
                            <p className="theme-muted text-[10px] uppercase tracking-[0.14em]">Status</p>
                            <p className="mt-1 font-semibold leading-tight">
                                {Boolean(form.isActive) ? "Active restaurant" : "Inactive restaurant"}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-black/25">
                    <div
                        className="h-full rounded-full bg-[var(--app-primary)] transition-all"
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <article className={sectionClass}>
                    <SectionHeader
                        icon={Building2}
                        title="Business Profile"
                        subtitle="Public profile information shown on receipts and in owner tools."
                        logoSrc={logoPreviewSrc}
                    />
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Restaurant Name">
                            <input
                                className={inputClass}
                                placeholder="Cafe King"
                                value={form.name || ""}
                                onChange={setField("name")}
                            />
                        </Field>
                        <Field label="Legal Name">
                            <input
                                className={inputClass}
                                placeholder="Cafe King Pvt Ltd"
                                value={form.legalName || ""}
                                onChange={setField("legalName")}
                            />
                        </Field>
                        <Field label="Owner Name">
                            <input
                                className={inputClass}
                                placeholder="Owner full name"
                                value={form.ownerName || ""}
                                onChange={setField("ownerName")}
                            />
                        </Field>
                        <Field label="Business Email">
                            <input
                                type="email"
                                className={inputClass}
                                placeholder="owner@cafeking.com"
                                value={form.email || ""}
                                onChange={setField("email")}
                            />
                        </Field>
                        <Field label="Business Phone" className="md:col-span-2">
                            <input
                                className={inputClass}
                                placeholder="+91 9999999999"
                                value={form.phone || ""}
                                onChange={setField("phone")}
                            />
                        </Field>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/15 bg-black/15">
                                    {logoPreviewSrc ? (
                                        <img
                                            src={logoPreviewSrc}
                                            alt="Restaurant logo"
                                            className="h-full w-full object-cover"
                                            onError={() => setLogoPreviewIndex((prev) => prev + 1)}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Upload size={20} className="theme-muted" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Restaurant Logo</p>
                                    <p className="theme-muted text-xs">
                                        Recommended: square PNG/JPG/WebP/SVG
                                    </p>
                                    {logoPreviewFailed ? (
                                        <p className="mt-1 text-xs text-amber-600">
                                            Logo URL is unreachable. Re-upload or use a working URL.
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <label className="theme-soft-button inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold">
                                <Upload size={14} />
                                {logoUploading ? "Uploading..." : "Upload New Logo"}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                    disabled={logoUploading}
                                    onChange={(event) => uploadLogo(event.target.files?.[0])}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        <Field label="Logo URL" className="mt-3">
                            <input
                                className={inputClass}
                                placeholder="https://example.com/logo.png"
                                value={form.logo || ""}
                                onChange={setField("logo")}
                            />
                        </Field>
                    </div>
                </article>

                <div className="grid gap-4 xl:grid-cols-2">
                    <article className={`${sectionClass} h-full`}>
                        <SectionHeader
                            icon={MapPin}
                            title="Address & Identity"
                            subtitle="Used for invoices, legal records, and compliance."
                        />
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field label="Address Line" className="md:col-span-2">
                                <input
                                    className={inputClass}
                                    placeholder="Street, area, landmark"
                                    value={form.addressLine1 || ""}
                                    onChange={setField("addressLine1")}
                                />
                            </Field>
                            <Field label="City">
                                <input
                                    className={inputClass}
                                    placeholder="City"
                                    value={form.city || ""}
                                    onChange={setField("city")}
                                />
                            </Field>
                            <Field label="State">
                                <input
                                    className={inputClass}
                                    placeholder="State"
                                    value={form.state || ""}
                                    onChange={setField("state")}
                                />
                            </Field>
                            <Field label="Country">
                                <input
                                    className={inputClass}
                                    placeholder="Country"
                                    value={form.country || ""}
                                    onChange={setField("country")}
                                />
                            </Field>
                            <Field label="Pincode">
                                <input
                                    className={inputClass}
                                    placeholder="560001"
                                    value={form.pincode || ""}
                                    onChange={setField("pincode")}
                                />
                            </Field>
                            <Field label="GST Number" className="md:col-span-2">
                                <input
                                    className={inputClass}
                                    placeholder="29ABCDE1234F1Z5"
                                    value={form.gstNumber || ""}
                                    onChange={setField("gstNumber")}
                                />
                            </Field>
                        </div>
                    </article>

                    <article className={`${sectionClass} h-full`}>
                        <SectionHeader
                            icon={ReceiptText}
                            title="Tax & Billing"
                            subtitle="Control tax mode, service charge, and invoice numbering."
                        />

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="theme-soft-button flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold">Tax Enabled</p>
                                    <p className="theme-muted text-xs">{taxStatusText}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.taxEnabled)}
                                    onChange={setChecked("taxEnabled")}
                                    className="h-4 w-4 accent-[var(--app-primary)]"
                                />
                            </label>

                            <label className="theme-soft-button flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold">Service Charge</p>
                                    <p className="theme-muted text-xs">{serviceChargeText}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.serviceChargeEnabled)}
                                    onChange={setChecked("serviceChargeEnabled")}
                                    className="h-4 w-4 accent-[var(--app-primary)]"
                                />
                            </label>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field label="Tax Type">
                                <select
                                    className={inputClass}
                                    value={form.taxType || "EXCLUSIVE"}
                                    onChange={setField("taxType")}
                                >
                                    <option value="EXCLUSIVE">EXCLUSIVE</option>
                                    <option value="INCLUSIVE">INCLUSIVE</option>
                                </select>
                            </Field>
                            <Field label="Default Tax Percent">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={inputClass}
                                    placeholder="5"
                                    value={form.defaultTaxPercent ?? 0}
                                    onChange={setField("defaultTaxPercent")}
                                />
                            </Field>
                            <Field label="Service Charge Percent">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={inputClass}
                                    placeholder="10"
                                    value={form.serviceChargePercent ?? 0}
                                    onChange={setField("serviceChargePercent")}
                                />
                            </Field>
                            <Field label="Invoice Prefix" hint="Example: CK-2026-">
                                <input
                                    className={inputClass}
                                    placeholder="INV-"
                                    value={form.invoicePrefix || ""}
                                    onChange={setField("invoicePrefix")}
                                />
                            </Field>
                            <Field label="Next Invoice Number" className="md:col-span-2">
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className={inputClass}
                                    placeholder="1001"
                                    value={form.nextInvoiceNumber ?? 1001}
                                    onChange={setField("nextInvoiceNumber")}
                                />
                            </Field>
                        </div>
                    </article>
                </div>

                <article className={sectionClass}>
                    <SectionHeader
                        icon={Settings2}
                        title="Operations"
                        subtitle="Core running preferences for timezone, currency, and availability."
                    />
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Timezone">
                            <input
                                className={inputClass}
                                placeholder="Asia/Kolkata"
                                value={form.timezone || ""}
                                onChange={setField("timezone")}
                            />
                        </Field>
                        <Field label="Currency">
                            <input
                                className={inputClass}
                                placeholder="INR"
                                value={form.currency || ""}
                                onChange={setField("currency")}
                            />
                        </Field>
                        <label className="theme-soft-button flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 md:col-span-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={16} className="theme-accent-text" />
                                <div>
                                    <p className="text-sm font-semibold">Restaurant Visibility</p>
                                    <p className="theme-muted text-xs">
                                        Make this restaurant available for orders
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={Boolean(form.isActive)}
                                onChange={setChecked("isActive")}
                                className="h-4 w-4 accent-[var(--app-primary)]"
                            />
                        </label>
                    </div>
                </article>

                <article className="theme-panel rounded-[28px] border border-white/10 bg-black/10 p-5 sm:p-6">
                    <SectionHeader
                        icon={Palette}
                        title="Appearance"
                        subtitle="Choose the restaurant theme shown across staff and customer screens."
                    />
                    <div className="relative mt-4 max-w-xl overflow-visible">
                        <p className="theme-muted mb-2 text-sm font-semibold">UI Theme</p>
                        <ThemeSelector variant="compact" />
                    </div>
                </article>

                <div className="theme-panel rounded-2xl border border-white/10 bg-black/10 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <UserCircle2 size={16} className="theme-accent-text" />
                            <p className="theme-muted text-xs sm:text-sm">
                                Review changes before saving to keep data consistent.
                            </p>
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="theme-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-70"
                        >
                            {saving ? (
                                <LoaderCircle size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            Save Settings
                        </button>
                    </div>
                </div>
            </form>
        </section>
    );
}
