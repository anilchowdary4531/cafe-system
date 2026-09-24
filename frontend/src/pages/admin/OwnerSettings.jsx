import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
    Trash2,
    Upload,
    UserCircle2,
} from "lucide-react";
import { API } from "../../config";
import ThemeSelector from "../../components/ThemeSelector";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { uploadToS3Presigned } from "../../utils/s3Upload";
import MapLocationPicker from "../../components/MapLocationPicker";

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
    latitude: null,
    longitude: null,
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

const sectionClass = "space-y-4 pb-6 border-b border-orange-200/60";
const fieldLabelClass =
    "mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-stone-500";
const inputClass =
    "w-full bg-transparent border-b border-stone-300 py-1.5 text-sm font-bold text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-800 transition";

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
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100/70 text-orange-600">
                {logoSrc ? (
                    <img
                        src={logoSrc}
                        alt="Restaurant logo"
                        className="h-full w-full rounded-xl object-cover"
                    />
                ) : (
                    <Icon size={18} />
                )}
            </span>
            <div>
                <h3 className="text-lg font-bold leading-tight text-stone-900">{title}</h3>
                <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

function Field({ label, hint, className = "", children }) {
    return (
        <label className={`block ${className}`}>
            <span className={fieldLabelClass}>{label}</span>
            {children}
            {hint ? <span className="mt-1 block text-[11px] text-stone-400">{hint}</span> : null}
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
            <div className="py-10 text-center text-sm font-semibold text-stone-500">
                <div className="inline-flex items-center gap-2">
                    <LoaderCircle size={16} className="animate-spin text-orange-600" />
                    Loading settings...
                </div>
            </div>
        );
    }

    return (
        <section className="space-y-6 pb-6">
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                    {success}
                </div>
            )}

            {/* Header Section - Words on Paper (No Container Box) */}
            <div className="pb-4 border-b border-orange-200/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-stone-500">
                            Owner Profile
                        </p>
                        <h2 className="mt-1 text-3xl font-black text-stone-900 tracking-tight">
                            Restaurant Settings
                        </h2>
                        <p className="mt-1 max-w-2xl text-xs text-stone-500 font-medium">
                            Keep business details, tax setup, and billing preferences up to date.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200/60 px-3 py-1 text-xs font-bold text-orange-800">
                            Profile: {completionPercent}%
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 px-3 py-1 text-xs font-bold text-emerald-800">
                            {Boolean(form.isActive) ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <article className={sectionClass}>
                    <SectionHeader
                        icon={Building2}
                        title="Business Profile"
                        subtitle="Public profile information shown on receipts and in owner tools."
                        logoSrc={logoPreviewSrc}
                    />
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
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

                    <div className="mt-4 pt-4 border-t border-stone-200/60">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shrink-0">
                                    {logoPreviewSrc ? (
                                        <img
                                            src={logoPreviewSrc}
                                            alt="Restaurant logo"
                                            className="h-full w-full object-cover"
                                            onError={() => setLogoPreviewIndex((prev) => prev + 1)}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Upload size={18} className="text-stone-400" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-900">Restaurant Logo</p>
                                    <p className="text-[11px] text-stone-500">
                                        Recommended: square PNG/JPG/WebP/SVG
                                    </p>
                                    {logoPreviewFailed ? (
                                        <p className="mt-0.5 text-xs text-amber-700">
                                            Logo URL is unreachable. Re-upload or use a working URL.
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 px-3 py-1.5 text-xs font-bold text-stone-800 transition">
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

                <div className="grid gap-6 lg:grid-cols-2">
                    <article className={sectionClass}>
                        <SectionHeader
                            icon={MapPin}
                            title="Address & Identity"
                            subtitle="Used for invoices, legal records, and compliance."
                        />
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
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

                        <div className="mt-4 pt-4 border-t border-stone-200/60">
                            <MapLocationPicker
                                latitude={form.latitude}
                                longitude={form.longitude}
                                ownerPhone={form.phone || form.ownerPhone}
                                ownerName={form.name || form.legalName}
                                onSelectLocation={({ lat, lng }) => {
                                    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                                }}
                            />
                        </div>
                    </article>

                    <article className={sectionClass}>
                        <SectionHeader
                            icon={ReceiptText}
                            title="Tax & Billing"
                            subtitle="Control tax mode, service charge, and invoice numbering."
                        />

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-stone-200/60 py-2">
                                <div>
                                    <p className="text-xs font-bold text-stone-900">Tax Enabled</p>
                                    <p className="text-[11px] text-stone-500">{taxStatusText}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.taxEnabled)}
                                    onChange={setChecked("taxEnabled")}
                                    className="h-4 w-4 accent-orange-600"
                                />
                            </label>

                            <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-stone-200/60 py-2">
                                <div>
                                    <p className="text-xs font-bold text-stone-900">Service Charge</p>
                                    <p className="text-[11px] text-stone-500">{serviceChargeText}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.serviceChargeEnabled)}
                                    onChange={setChecked("serviceChargeEnabled")}
                                    className="h-4 w-4 accent-orange-600"
                                />
                            </label>
                        </div>

                        <div className="mt-3 grid gap-4 md:grid-cols-2">
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
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
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
                        <label className="flex cursor-pointer items-center justify-between border-t border-stone-200/60 pt-3 md:col-span-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={16} className="text-orange-600" />
                                <div>
                                    <p className="text-xs font-bold text-stone-900">Restaurant Visibility</p>
                                    <p className="text-[11px] text-stone-500">
                                        Make this restaurant available for orders
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={Boolean(form.isActive)}
                                onChange={setChecked("isActive")}
                                className="h-4 w-4 accent-orange-600"
                            />
                        </label>
                    </div>
                </article>

                <article className={sectionClass}>
                    <SectionHeader
                        icon={Palette}
                        title="Appearance"
                        subtitle="Choose the restaurant theme shown across staff and customer screens."
                    />
                    <div className="mt-3 max-w-xl">
                        <p className="text-xs font-bold text-stone-700 mb-2">UI Theme</p>
                        <ThemeSelector variant="compact" />
                    </div>
                </article>

                <article className="pb-6 border-b border-rose-200/60">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                                <Trash2 size={16} />
                            </span>
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Danger Zone</p>
                                <h3 className="text-base font-bold text-rose-800">Delete Account</h3>
                                <p className="text-xs text-stone-500">
                                    Permanently delete your account, restaurant data, and access.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3">
                        <Link
                            to="/delete-account"
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-800 transition"
                        >
                            <Trash2 size={14} />
                            Delete Account
                        </Link>
                    </div>
                </article>

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                        <UserCircle2 size={16} className="text-orange-600" />
                        <span>Review changes before saving.</span>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition disabled:opacity-70"
                    >
                        {saving ? (
                            <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        Save Settings
                    </button>
                </div>
            </form>
        </section>
    );
}
