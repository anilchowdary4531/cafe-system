import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    History,
    LayoutDashboard,
    LoaderCircle,
    MapPin,
    Pencil,
    Plus,
    ReceiptText,
    RotateCcw,
    Save,
    Settings2,
    ShieldCheck,
    Trash2,
    Upload,
    Volume2,
    X,
} from "lucide-react";
import { API } from "../../config";
import ThemeSelector from "../../components/ThemeSelector";
import NotificationSoundPicker from "../../components/NotificationSoundPicker";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { uploadToS3Presigned } from "../../utils/s3Upload";
import MapLocationPicker from "../../components/MapLocationPicker";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import OwnerAuditLogs from "./OwnerAuditLogs";

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
    billingConfig: {
        taxes: [],
        charges: [],
        roundOff: false,
        allowTips: true,
    },
};

const NAV_SECTIONS = [
    {
        id: "overview",
        label: "Profile Overview",
        description: "Summary & status",
        icon: LayoutDashboard,
    },
    {
        id: "business",
        label: "Business Profile",
        description: "Name, contact & logo",
        icon: Building2,
    },
    {
        id: "address",
        label: "Address & Identity",
        description: "Location, GST & map",
        icon: MapPin,
    },
    {
        id: "tax-billing",
        label: "Tax & Billing",
        description: "Taxes, charges & invoices",
        icon: ReceiptText,
    },
    {
        id: "preferences",
        label: "Operations & Preferences",
        description: "Timezone, theme & alerts",
        icon: Settings2,
    },
    {
        id: "audit-logs",
        label: "Audit Logs",
        description: "Security & activity history",
        icon: History,
    },
];

const COMPLETION_FIELDS = [
    { key: "name", label: "Restaurant Name" },
    { key: "legalName", label: "Legal Name" },
    { key: "ownerName", label: "Owner Name" },
    { key: "email", label: "Business Email" },
    { key: "phone", label: "Business Phone" },
    { key: "addressLine1", label: "Address Line" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "country", label: "Country" },
    { key: "pincode", label: "Pincode" },
    { key: "gstNumber", label: "GST Number" },
    { key: "timezone", label: "Timezone" },
    { key: "currency", label: "Currency" },
];

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

const normalizeFormState = (rest = {}) => {
    const billingConfig = rest.billingConfig || {
        taxes:
            rest.defaultTaxPercent > 0
                ? [
                      {
                          name: "GST",
                          rate: Number(rest.defaultTaxPercent),
                          type: "PERCENTAGE",
                          isInclusive: rest.taxType === "INCLUSIVE",
                          isEnabled: Boolean(rest.taxEnabled),
                          appliesTo: ["ALL"],
                      },
                  ]
                : [],
        charges:
            rest.serviceChargePercent > 0
                ? [
                      {
                          name: "Service Charge",
                          amount: Number(rest.serviceChargePercent),
                          type: "PERCENTAGE",
                          isEnabled: Boolean(rest.serviceChargeEnabled),
                          appliesTo: ["ALL"],
                      },
                  ]
                : [],
        roundOff: false,
        allowTips: true,
    };

    return {
        ...emptyForm,
        ...rest,
        billingConfig: {
            taxes: Array.isArray(billingConfig.taxes) ? billingConfig.taxes : [],
            charges: Array.isArray(billingConfig.charges) ? billingConfig.charges : [],
            roundOff: Boolean(billingConfig.roundOff),
            allowTips: billingConfig.allowTips !== false,
        },
    };
};

const validateSettingsForm = (form) => {
    const errors = {};

    if (!String(form.name || "").trim()) {
        errors.name = "Restaurant name is required.";
    }

    const email = String(form.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = "Enter a valid business email address.";
    }

    const phone = String(form.phone || "").trim();
    if (phone) {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) {
            errors.phone = "Enter a valid phone number (7 to 15 digits).";
        }
    }

    const nextInv = Number(form.nextInvoiceNumber);
    if (!Number.isInteger(nextInv) || nextInv < 1) {
        errors.nextInvoiceNumber = "Next invoice number must be a whole number of at least 1.";
    }

    if (form.latitude !== null && form.latitude !== undefined && form.latitude !== "") {
        const lat = Number(form.latitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            errors.location = "Latitude must be between -90 and +90.";
        }
    }

    if (form.longitude !== null && form.longitude !== undefined && form.longitude !== "") {
        const lng = Number(form.longitude);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            errors.location = "Longitude must be between -180 and +180.";
        }
    }

    const taxes = Array.isArray(form.billingConfig?.taxes) ? form.billingConfig.taxes : [];
    const invalidTaxIdx = taxes.findIndex(
        (t) => !String(t.name || "").trim() || !Number.isFinite(Number(t.rate)) || Number(t.rate) < 0
    );
    if (invalidTaxIdx !== -1) {
        errors.taxes = `Tax #${invalidTaxIdx + 1} requires a name and a non-negative rate.`;
    }

    const charges = Array.isArray(form.billingConfig?.charges) ? form.billingConfig.charges : [];
    const invalidChargeIdx = charges.findIndex(
        (c) => !String(c.name || "").trim() || !Number.isFinite(Number(c.amount)) || Number(c.amount) < 0
    );
    if (invalidChargeIdx !== -1) {
        errors.charges = `Charge #${invalidChargeIdx + 1} requires a name and a non-negative amount.`;
    }

    return errors;
};

const getInputClass = (isEditing, hasError = false) =>
    [
        "w-full rounded-lg border px-3 py-2 text-sm font-medium transition outline-none",
        isEditing
            ? hasError
                ? "border-rose-400 bg-white text-stone-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "border-stone-300 bg-white text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            : "border-stone-200 bg-stone-50/80 text-stone-700 cursor-default",
    ].join(" ");

function FormField({ label, htmlFor, hint, error, readOnlyNote, className = "", children }) {
    return (
        <div className={className}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor={htmlFor} className="block text-xs font-semibold text-stone-700">
                    {label}
                </label>
                {readOnlyNote ? (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                        {readOnlyNote}
                    </span>
                ) : null}
            </div>
            {children}
            {error ? (
                <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
                    {error}
                </p>
            ) : hint ? (
                <p className="mt-1 text-[11px] text-stone-500">{hint}</p>
            ) : null}
        </div>
    );
}

function SectionCardHeader({
    icon: Icon,
    title,
    subtitle,
    isEditing,
    onEdit,
    onCancel,
    saving,
    showEditControls = true,
}) {
    return (
        <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                    <Icon size={18} />
                </span>
                <div>
                    <h2 className="text-base font-bold text-stone-900">{title}</h2>
                    <p className="text-xs text-stone-500">{subtitle}</p>
                </div>
            </div>
            {showEditControls ? (
                <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition focus:outline-none focus:ring-2 focus:ring-stone-400/30 disabled:opacity-50"
                            >
                                <RotateCcw size={13} />
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-60"
                            >
                                {saving ? (
                                    <LoaderCircle size={13} className="animate-spin" />
                                ) : (
                                    <Save size={13} />
                                )}
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-700 transition focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        >
                            <Pencil size={13} />
                            Edit
                        </button>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default function OwnerSettings() {
    const baseId = useId();
    const [form, setForm] = useState(emptyForm);
    const [savedForm, setSavedForm] = useState(emptyForm);
    const [activeSection, setActiveSection] = useState("overview");
    const [isEditing, setIsEditing] = useState(false);
    const [pendingSection, setPendingSection] = useState(null);
    const [showMap, setShowMap] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [logoPreviewIndex, setLogoPreviewIndex] = useState(0);

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = Number(user?.restaurantId);

    const isDirty = useMemo(
        () => JSON.stringify(form) !== JSON.stringify(savedForm),
        [form, savedForm]
    );

    const setField = (key) => (event) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [key]: value }));
        if (fieldErrors[key]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const setChecked = (key) => (event) => {
        const checked = event.target.checked;
        setForm((prev) => ({ ...prev, [key]: checked }));
    };

    const { completionPercent, missingFields } = useMemo(() => {
        const missing = COMPLETION_FIELDS.filter(
            (item) => String(form[item.key] || "").trim().length === 0
        ).map((item) => item.label);
        const filled = COMPLETION_FIELDS.length - missing.length;
        return {
            completionPercent: Math.round((filled / COMPLETION_FIELDS.length) * 100),
            missingFields: missing,
        };
    }, [form]);

    const taxStatusText = useMemo(() => {
        const activeTaxes = (form.billingConfig?.taxes || []).filter((t) => t.isEnabled);
        if (activeTaxes.length > 0) {
            return `${activeTaxes.length} active tax${activeTaxes.length > 1 ? "es" : ""}`;
        }
        return Boolean(form.taxEnabled)
            ? `${String(form.taxType || "EXCLUSIVE").toUpperCase()} tax`
            : "Tax disabled";
    }, [form]);

    const serviceChargeText = useMemo(() => {
        const activeCharges = (form.billingConfig?.charges || []).filter((c) => c.isEnabled);
        if (activeCharges.length > 0) {
            return `${activeCharges.length} active charge${activeCharges.length > 1 ? "s" : ""}`;
        }
        return Boolean(form.serviceChargeEnabled)
            ? `${Number(form.serviceChargePercent || 0)}% service charge`
            : "No extra charges";
    }, [form]);

    const logoPreviewSources = useMemo(() => buildLogoPreviewSources(form.logo), [form.logo]);
    const logoPreviewSrc = logoPreviewSources[logoPreviewIndex] || "";
    const logoPreviewFailed = Boolean(String(form.logo || "").trim()) && !logoPreviewSrc;

    const loadSettings = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to owner account.");
            return;
        }

        try {
            setLoading(true);
            const res = await axios.get(`${API}/owner/${restaurantId}/settings`);
            const rest = res.data?.restaurant || {};
            const normalized = normalizeFormState(rest);
            setForm(normalized);
            setSavedForm(normalized);
            setFieldErrors({});
            setError("");
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to load settings.");
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        setLogoPreviewIndex(0);
    }, [logoPreviewSources]);

    useEffect(() => {
        if (!isDirty) return undefined;
        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

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
                setIsEditing(true);
                setForm((prev) => ({ ...prev, logo: upload.publicUrl }));
                setSuccess("Logo uploaded. Save changes to apply.");
            }
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Logo upload failed.");
        } finally {
            setLogoUploading(false);
        }
    };

    const handleAddTax = () => {
        setIsEditing(true);
        setForm((prev) => {
            const currentTaxes = Array.isArray(prev.billingConfig?.taxes)
                ? prev.billingConfig.taxes
                : [];
            return {
                ...prev,
                billingConfig: {
                    ...prev.billingConfig,
                    taxes: [
                        ...currentTaxes,
                        {
                            name: `Tax ${currentTaxes.length + 1}`,
                            rate: 2.5,
                            type: "PERCENTAGE",
                            isInclusive: false,
                            isEnabled: true,
                            appliesTo: ["ALL"],
                        },
                    ],
                },
            };
        });
    };

    const handleUpdateTax = (index, field, value) => {
        setForm((prev) => {
            const currentTaxes = [...(prev.billingConfig?.taxes || [])];
            currentTaxes[index] = { ...currentTaxes[index], [field]: value };
            return {
                ...prev,
                billingConfig: { ...prev.billingConfig, taxes: currentTaxes },
            };
        });
        if (fieldErrors.taxes) {
            setFieldErrors((prev) => ({ ...prev, taxes: undefined }));
        }
    };

    const handleRemoveTax = (index) => {
        setIsEditing(true);
        setForm((prev) => {
            const currentTaxes = [...(prev.billingConfig?.taxes || [])];
            currentTaxes.splice(index, 1);
            return {
                ...prev,
                billingConfig: { ...prev.billingConfig, taxes: currentTaxes },
            };
        });
    };

    const handleAddCharge = () => {
        setIsEditing(true);
        setForm((prev) => {
            const currentCharges = Array.isArray(prev.billingConfig?.charges)
                ? prev.billingConfig.charges
                : [];
            return {
                ...prev,
                billingConfig: {
                    ...prev.billingConfig,
                    charges: [
                        ...currentCharges,
                        {
                            name: "Packaging Charge",
                            amount: 10,
                            type: "FIXED",
                            isEnabled: true,
                            appliesTo: ["ALL"],
                            isTaxable: false,
                        },
                    ],
                },
            };
        });
    };

    const handleUpdateCharge = (index, field, value) => {
        setForm((prev) => {
            const currentCharges = [...(prev.billingConfig?.charges || [])];
            currentCharges[index] = { ...currentCharges[index], [field]: value };
            return {
                ...prev,
                billingConfig: { ...prev.billingConfig, charges: currentCharges },
            };
        });
        if (fieldErrors.charges) {
            setFieldErrors((prev) => ({ ...prev, charges: undefined }));
        }
    };

    const handleRemoveCharge = (index) => {
        setIsEditing(true);
        setForm((prev) => {
            const currentCharges = [...(prev.billingConfig?.charges || [])];
            currentCharges.splice(index, 1);
            return {
                ...prev,
                billingConfig: { ...prev.billingConfig, charges: currentCharges },
            };
        });
    };

    const handleToggleBillingOption = (key) => (e) => {
        const checked = e.target.checked;
        setForm((prev) => ({
            ...prev,
            billingConfig: {
                ...prev.billingConfig,
                [key]: checked,
            },
        }));
    };

    const saveSettings = async () => {
        const validationErrors = validateSettingsForm(form);
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            setError("Please fix the highlighted validation errors before saving.");
            return false;
        }

        try {
            setSaving(true);
            setSuccess("");
            setError("");
            setFieldErrors({});

            const taxes = Array.isArray(form.billingConfig?.taxes) ? form.billingConfig.taxes : [];
            const charges = Array.isArray(form.billingConfig?.charges)
                ? form.billingConfig.charges
                : [];
            const activePercentTaxes = taxes.filter((t) => t.isEnabled && t.type !== "FIXED");
            const sumTaxRate = activePercentTaxes.reduce((sum, t) => sum + Number(t.rate || 0), 0);
            const hasInclusive = activePercentTaxes.some((t) => Boolean(t.isInclusive));
            const activePercentCharges = charges.filter(
                (c) => c.isEnabled && c.type === "PERCENTAGE"
            );
            const sumChargeRate = activePercentCharges.reduce(
                (sum, c) => sum + Number(c.amount || 0),
                0
            );

            const payload = {
                ...form,
                billingConfig: form.billingConfig,
                taxEnabled: taxes.length > 0 ? taxes.some((t) => t.isEnabled) : Boolean(form.taxEnabled),
                taxType: hasInclusive ? "INCLUSIVE" : form.taxType || "EXCLUSIVE",
                defaultTaxPercent:
                    taxes.length > 0 ? sumTaxRate : Number(form.defaultTaxPercent || 0),
                serviceChargeEnabled:
                    charges.length > 0
                        ? charges.some((c) => c.isEnabled)
                        : Boolean(form.serviceChargeEnabled),
                serviceChargePercent:
                    charges.length > 0 ? sumChargeRate : Number(form.serviceChargePercent || 0),
                nextInvoiceNumber: Number(form.nextInvoiceNumber || 1001),
            };

            const res = await axios.put(`${API}/owner/${restaurantId}/settings`, payload);
            const savedRest = res.data?.restaurant || payload;
            const normalized = normalizeFormState({
                ...savedRest,
                billingConfig: savedRest.billingConfig || form.billingConfig,
            });
            setForm(normalized);
            setSavedForm(normalized);
            setIsEditing(false);
            setSuccess("Settings updated successfully.");
            return true;
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to save settings.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await saveSettings();
    };

    const handleCancelEdit = () => {
        setForm(savedForm);
        setFieldErrors({});
        setError("");
        setIsEditing(false);
    };

    const handleSelectSection = (nextSectionId) => {
        if (nextSectionId === activeSection) return;
        if (isDirty) {
            setPendingSection(nextSectionId);
            return;
        }
        setActiveSection(nextSectionId);
        setIsEditing(false);
        setSuccess("");
        setError("");
    };

    const handleDiscardAndSwitch = () => {
        if (!pendingSection) return;
        setForm(savedForm);
        setFieldErrors({});
        setError("");
        setSuccess("");
        setIsEditing(false);
        setActiveSection(pendingSection);
        setPendingSection(null);
    };

    const handleSaveAndSwitch = async () => {
        if (!pendingSection) return;
        const ok = await saveSettings();
        if (ok) {
            setActiveSection(pendingSection);
            setPendingSection(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-stone-200 bg-white p-8">
                <div className="inline-flex items-center gap-2.5 text-sm font-semibold text-stone-600">
                    <LoaderCircle size={18} className="animate-spin text-orange-600" />
                    <span>Loading restaurant settings...</span>
                </div>
            </div>
        );
    }

    const activeSectionMeta =
        NAV_SECTIONS.find((s) => s.id === activeSection) || NAV_SECTIONS[0];

    return (
        <section className="mx-auto max-w-6xl space-y-5 pb-8">
            {/* Top Header */}
            <header className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <OwnerMenuButton />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                                Owner Panel / Settings
                            </p>
                            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
                                Restaurant Settings
                            </h1>
                            <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">
                                Manage your restaurant profile, address, tax rules, and billing preferences.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {isDirty ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                <AlertTriangle size={13} />
                                Unsaved changes
                            </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700">
                            Profile {completionPercent}%
                        </span>
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                Boolean(form.isActive)
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-stone-200 bg-stone-100 text-stone-600"
                            }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                    Boolean(form.isActive) ? "bg-emerald-500" : "bg-stone-400"
                                }`}
                            />
                            {Boolean(form.isActive) ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>
            </header>

            {/* Feedback Banners */}
            {error ? (
                <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 sm:text-sm"
                >
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error message"
                        className="rounded p-1 text-rose-600 hover:bg-rose-100"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : null}

            {success ? (
                <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 sm:text-sm"
                >
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <span>{success}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        aria-label="Dismiss success message"
                        className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : null}

            {/* Unsaved Changes Warning Dialog */}
            {pendingSection ? (
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby={`${baseId}-unsaved-title`}
                    aria-describedby={`${baseId}-unsaved-desc`}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-[1px]"
                >
                    <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
                        <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                                <AlertTriangle size={20} />
                            </span>
                            <div>
                                <h3
                                    id={`${baseId}-unsaved-title`}
                                    className="text-base font-bold text-stone-900"
                                >
                                    Unsaved changes
                                </h3>
                                <p
                                    id={`${baseId}-unsaved-desc`}
                                    className="mt-1 text-xs text-stone-600 sm:text-sm"
                                >
                                    You have unsaved changes in{" "}
                                    <span className="font-semibold text-stone-800">
                                        {activeSectionMeta.label}
                                    </span>
                                    . Save them before switching or discard them?
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingSection(null)}
                                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                            >
                                Stay Here
                            </button>
                            <button
                                type="button"
                                onClick={handleDiscardAndSwitch}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                                Discard Changes
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAndSwitch}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                            >
                                {saving ? <LoaderCircle size={13} className="animate-spin" /> : null}
                                Save & Switch
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Main SaaS Layout: Sidebar Nav + Content Area */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                {/* Settings Navigation */}
                <aside className="w-full shrink-0 lg:w-64">
                    <nav
                        aria-label="Settings sections"
                        className="flex gap-1.5 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xs lg:flex-col"
                    >
                        {NAV_SECTIONS.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => handleSelectSection(section.id)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                                        isActive
                                            ? "bg-orange-50 text-orange-700 border border-orange-200/80 shadow-2xs"
                                            : "border border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                                    }`}
                                >
                                    <span
                                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                            isActive
                                                ? "bg-orange-600 text-white"
                                                : "bg-stone-100 text-stone-500"
                                        }`}
                                    >
                                        <Icon size={16} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-xs font-bold sm:text-sm">
                                            {section.label}
                                        </span>
                                        <span className="hidden truncate text-[11px] text-stone-500 lg:block">
                                            {section.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Active Section Content */}
                <div className="min-w-0 flex-1 space-y-5">
                    {activeSection === "audit-logs" ? (
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                            <OwnerAuditLogs embedded />
                        </div>
                    ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {/* 1. PROFILE OVERVIEW */}
                    {activeSection === "overview" ? (
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-stone-200 bg-white shadow-xs">
                                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                                            {logoPreviewSrc ? (
                                                <img
                                                    src={logoPreviewSrc}
                                                    alt="Restaurant logo"
                                                    className="h-full w-full object-cover"
                                                    onError={() =>
                                                        setLogoPreviewIndex((prev) => prev + 1)
                                                    }
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-stone-400">
                                                    <Building2 size={24} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-bold text-stone-900">
                                                    {form.name || "Unnamed Restaurant"}
                                                </h2>
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                        Boolean(form.isActive)
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : "bg-stone-100 text-stone-600 border border-stone-200"
                                                    }`}
                                                >
                                                    {Boolean(form.isActive) ? "Active" : "Inactive"}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-stone-500">
                                                Owner:{" "}
                                                <span className="font-semibold text-stone-700">
                                                    {form.ownerName || "Not specified"}
                                                </span>
                                            </p>
                                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                                                <span>{form.email || "No email set"}</span>
                                                <span>{form.phone || "No phone set"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleSelectSection("business");
                                            setIsEditing(true);
                                        }}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 transition focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                                    >
                                        <Pencil size={13} />
                                        Edit Business Profile
                                    </button>
                                </div>

                                <div className="border-t border-stone-200 bg-stone-50/60 px-5 py-4">
                                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                                        <span>Profile Completion</span>
                                        <span className="text-orange-700">{completionPercent}%</span>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
                                        <div
                                            className="h-full rounded-full bg-orange-500 transition-all"
                                            style={{ width: `${completionPercent}%` }}
                                        />
                                    </div>
                                    {missingFields.length > 0 ? (
                                        <p className="mt-2 text-[11px] text-stone-500">
                                            Missing: {missingFields.slice(0, 4).join(", ")}
                                            {missingFields.length > 4
                                                ? ` (+${missingFields.length - 4} more)`
                                                : ""}
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-[11px] font-medium text-emerald-700">
                                            All profile fields are complete.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Quick Section Summaries */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                                            Address & GST
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectSection("address")}
                                            className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                                        >
                                            Manage
                                        </button>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-stone-900">
                                        {[form.city, form.state, form.country]
                                            .filter(Boolean)
                                            .join(", ") || "Address not configured"}
                                    </p>
                                    <p className="mt-1 text-xs text-stone-500">
                                        GST: {form.gstNumber || "Not provided"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                                            Tax & Billing
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectSection("tax-billing")}
                                            className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                                        >
                                            Configure
                                        </button>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-stone-900">
                                        {taxStatusText} • {serviceChargeText}
                                    </p>
                                    <p className="mt-1 text-xs text-stone-500">
                                        Invoice: {form.invoicePrefix || "No prefix"} #
                                        {form.nextInvoiceNumber ?? 1001}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* 2. BUSINESS PROFILE */}
                    {activeSection === "business" ? (
                        <div className="rounded-2xl border border-stone-200 bg-white shadow-xs">
                            <SectionCardHeader
                                icon={Building2}
                                title="Business Profile"
                                subtitle="Public profile information shown on receipts and owner tools."
                                isEditing={isEditing}
                                onEdit={() => setIsEditing(true)}
                                onCancel={handleCancelEdit}
                                saving={saving}
                            />

                            <div className="space-y-5 p-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        label="Restaurant Name"
                                        htmlFor={`${baseId}-name`}
                                        error={fieldErrors.name}
                                    >
                                        <input
                                            id={`${baseId}-name`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing, Boolean(fieldErrors.name))}
                                            placeholder="Cafe King"
                                            value={form.name || ""}
                                            onChange={setField("name")}
                                        />
                                    </FormField>

                                    <FormField label="Legal Name" htmlFor={`${baseId}-legalName`}>
                                        <input
                                            id={`${baseId}-legalName`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="Cafe King Pvt Ltd"
                                            value={form.legalName || ""}
                                            onChange={setField("legalName")}
                                        />
                                    </FormField>

                                    <FormField label="Owner Name" htmlFor={`${baseId}-ownerName`}>
                                        <input
                                            id={`${baseId}-ownerName`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="Owner full name"
                                            value={form.ownerName || ""}
                                            onChange={setField("ownerName")}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Business Email"
                                        htmlFor={`${baseId}-email`}
                                        error={fieldErrors.email}
                                    >
                                        <input
                                            id={`${baseId}-email`}
                                            type="email"
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing, Boolean(fieldErrors.email))}
                                            placeholder="owner@cafeking.com"
                                            value={form.email || ""}
                                            onChange={setField("email")}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Business Phone"
                                        htmlFor={`${baseId}-phone`}
                                        error={fieldErrors.phone}
                                    >
                                        <input
                                            id={`${baseId}-phone`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing, Boolean(fieldErrors.phone))}
                                            placeholder="+91 9999999999"
                                            value={form.phone || ""}
                                            onChange={setField("phone")}
                                        />
                                    </FormField>
                                </div>

                                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
                                                {logoPreviewSrc ? (
                                                    <img
                                                        src={logoPreviewSrc}
                                                        alt="Restaurant logo preview"
                                                        className="h-full w-full object-cover"
                                                        onError={() =>
                                                            setLogoPreviewIndex((prev) => prev + 1)
                                                        }
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-stone-400">
                                                        <Upload size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-stone-900">
                                                    Restaurant Logo
                                                </p>
                                                <p className="text-[11px] text-stone-500">
                                                    Recommended: square PNG, JPG, WebP, or SVG
                                                </p>
                                                {logoPreviewFailed ? (
                                                    <p className="mt-0.5 text-xs font-medium text-amber-700">
                                                        Logo URL is unreachable. Re-upload or use a working URL.
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <label
                                            className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition ${
                                                logoUploading ? "opacity-60 pointer-events-none" : ""
                                            }`}
                                        >
                                            <Upload size={13} />
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

                                    <FormField
                                        label="Logo URL"
                                        htmlFor={`${baseId}-logo`}
                                        className="mt-3"
                                    >
                                        <input
                                            id={`${baseId}-logo`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="https://example.com/logo.png"
                                            value={form.logo || ""}
                                            onChange={setField("logo")}
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* 3. ADDRESS & IDENTITY */}
                    {activeSection === "address" ? (
                        <div className="rounded-2xl border border-stone-200 bg-white shadow-xs">
                            <SectionCardHeader
                                icon={MapPin}
                                title="Address & Identity"
                                subtitle="Used for invoices, legal records, and delivery location."
                                isEditing={isEditing}
                                onEdit={() => setIsEditing(true)}
                                onCancel={handleCancelEdit}
                                saving={saving}
                            />

                            <div className="space-y-5 p-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        label="Address Line"
                                        htmlFor={`${baseId}-addressLine1`}
                                        className="sm:col-span-2"
                                    >
                                        <input
                                            id={`${baseId}-addressLine1`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="Street, area, landmark"
                                            value={form.addressLine1 || ""}
                                            onChange={setField("addressLine1")}
                                        />
                                    </FormField>

                                    <FormField label="City" htmlFor={`${baseId}-city`}>
                                        <input
                                            id={`${baseId}-city`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="City"
                                            value={form.city || ""}
                                            onChange={setField("city")}
                                        />
                                    </FormField>

                                    <FormField label="State" htmlFor={`${baseId}-state`}>
                                        <input
                                            id={`${baseId}-state`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="State"
                                            value={form.state || ""}
                                            onChange={setField("state")}
                                        />
                                    </FormField>

                                    <FormField label="Country" htmlFor={`${baseId}-country`}>
                                        <input
                                            id={`${baseId}-country`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="Country"
                                            value={form.country || ""}
                                            onChange={setField("country")}
                                        />
                                    </FormField>

                                    <FormField label="Pincode" htmlFor={`${baseId}-pincode`}>
                                        <input
                                            id={`${baseId}-pincode`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="560001"
                                            value={form.pincode || ""}
                                            onChange={setField("pincode")}
                                        />
                                    </FormField>

                                    <FormField
                                        label="GST Number"
                                        htmlFor={`${baseId}-gstNumber`}
                                        className="sm:col-span-2"
                                    >
                                        <input
                                            id={`${baseId}-gstNumber`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="29ABCDE1234F1Z5"
                                            value={form.gstNumber || ""}
                                            onChange={setField("gstNumber")}
                                        />
                                    </FormField>
                                </div>

                                {/* Compact Map Location Area */}
                                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-stone-900">
                                                Map Coordinates
                                            </p>
                                            <p className="text-xs text-stone-500">
                                                {form.latitude != null && form.longitude != null
                                                    ? `Pinned at ${Number(form.latitude).toFixed(5)}, ${Number(
                                                          form.longitude
                                                      ).toFixed(5)}`
                                                    : "No coordinates pinned yet."}
                                            </p>
                                            {fieldErrors.location ? (
                                                <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
                                                    {fieldErrors.location}
                                                </p>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowMap((prev) => !prev)}
                                            aria-expanded={showMap}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                                        >
                                            <MapPin size={13} className="text-orange-600" />
                                            {showMap ? "Hide Map" : "Select on Map"}
                                            {showMap ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </button>
                                    </div>

                                    {showMap ? (
                                        <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white">
                                            <MapLocationPicker
                                                height="240px"
                                                latitude={form.latitude}
                                                longitude={form.longitude}
                                                ownerPhone={form.phone || form.ownerPhone}
                                                ownerName={form.name || form.legalName}
                                                onSelectLocation={({ lat, lng }) => {
                                                    setIsEditing(true);
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        latitude: lat,
                                                        longitude: lng,
                                                    }));
                                                }}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* 4. TAX & BILLING */}
                    {activeSection === "tax-billing" ? (
                        <div className="rounded-2xl border border-stone-200 bg-white shadow-xs">
                            <SectionCardHeader
                                icon={ReceiptText}
                                title="Tax & Billing Configuration"
                                subtitle="Configure custom taxes (CGST, SGST, VAT), extra charges, round-off, and invoice settings."
                                isEditing={isEditing}
                                onEdit={() => setIsEditing(true)}
                                onCancel={handleCancelEdit}
                                saving={saving}
                            />

                            <div className="space-y-5 p-5">
                                {/* Custom Taxes */}
                                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <h3 className="text-sm font-bold text-stone-900">
                                                Custom Taxes
                                            </h3>
                                            <p className="text-xs text-stone-500">
                                                Configure restaurant-specific taxes (e.g. CGST 2.5%, SGST 2.5%, VAT).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddTax}
                                            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 transition"
                                        >
                                            <Plus size={13} /> Add Tax
                                        </button>
                                    </div>

                                    {fieldErrors.taxes ? (
                                        <p role="alert" className="mb-2 text-xs font-medium text-rose-600">
                                            {fieldErrors.taxes}
                                        </p>
                                    ) : null}

                                    {(form.billingConfig?.taxes || []).length === 0 ? (
                                        <p className="py-2 text-xs italic text-stone-400">
                                            No taxes configured. Orders will be tax-free unless a tax is added.
                                        </p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {(form.billingConfig?.taxes || []).map((tax, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 text-xs"
                                                >
                                                    <input
                                                        type="text"
                                                        aria-label={`Tax ${idx + 1} name`}
                                                        disabled={!isEditing}
                                                        placeholder="Tax Name (e.g. CGST)"
                                                        value={tax.name || ""}
                                                        onChange={(e) =>
                                                            handleUpdateTax(idx, "name", e.target.value)
                                                        }
                                                        className="w-32 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            aria-label={`Tax ${idx + 1} rate`}
                                                            disabled={!isEditing}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="Rate"
                                                            value={tax.rate ?? 0}
                                                            onChange={(e) =>
                                                                handleUpdateTax(
                                                                    idx,
                                                                    "rate",
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                            className="w-20 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                        />
                                                        <select
                                                            aria-label={`Tax ${idx + 1} type`}
                                                            disabled={!isEditing}
                                                            value={tax.type || "PERCENTAGE"}
                                                            onChange={(e) =>
                                                                handleUpdateTax(idx, "type", e.target.value)
                                                            }
                                                            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                        >
                                                            <option value="PERCENTAGE">%</option>
                                                            <option value="FIXED">₹</option>
                                                        </select>
                                                    </div>

                                                    <select
                                                        aria-label={`Tax ${idx + 1} applies to`}
                                                        disabled={!isEditing}
                                                        value={
                                                            Array.isArray(tax.appliesTo)
                                                                ? tax.appliesTo[0] || "ALL"
                                                                : tax.appliesTo || "ALL"
                                                        }
                                                        onChange={(e) =>
                                                            handleUpdateTax(idx, "appliesTo", [
                                                                e.target.value,
                                                            ])
                                                        }
                                                        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                    >
                                                        <option value="ALL">All Orders</option>
                                                        <option value="DINE_IN">Dine-In Only</option>
                                                        <option value="TAKEAWAY">Takeaway Only</option>
                                                        <option value="DELIVERY">Delivery Only</option>
                                                        <option value="PICKUP">Pickup Only</option>
                                                    </select>

                                                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-700">
                                                        <input
                                                            type="checkbox"
                                                            disabled={!isEditing}
                                                            checked={Boolean(tax.isInclusive)}
                                                            onChange={(e) =>
                                                                handleUpdateTax(
                                                                    idx,
                                                                    "isInclusive",
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="h-3.5 w-3.5 accent-orange-600"
                                                        />
                                                        Inclusive in price
                                                    </label>

                                                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-700">
                                                        <input
                                                            type="checkbox"
                                                            disabled={!isEditing}
                                                            checked={Boolean(tax.isEnabled)}
                                                            onChange={(e) =>
                                                                handleUpdateTax(
                                                                    idx,
                                                                    "isEnabled",
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="h-3.5 w-3.5 accent-orange-600"
                                                        />
                                                        Active
                                                    </label>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTax(idx)}
                                                        className="ml-auto rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                                        title="Delete Tax"
                                                        aria-label={`Delete ${tax.name || `Tax ${idx + 1}`}`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Extra Charges & Surcharges */}
                                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <h3 className="text-sm font-bold text-stone-900">
                                                Extra Charges & Surcharges
                                            </h3>
                                            <p className="text-xs text-stone-500">
                                                Configure packaging fees, delivery charges, service charge, or custom surcharges.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddCharge}
                                            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 transition"
                                        >
                                            <Plus size={13} /> Add Charge
                                        </button>
                                    </div>

                                    {fieldErrors.charges ? (
                                        <p role="alert" className="mb-2 text-xs font-medium text-rose-600">
                                            {fieldErrors.charges}
                                        </p>
                                    ) : null}

                                    {(form.billingConfig?.charges || []).length === 0 ? (
                                        <p className="py-2 text-xs italic text-stone-400">
                                            No extra charges configured.
                                        </p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {(form.billingConfig?.charges || []).map((charge, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 text-xs"
                                                >
                                                    <input
                                                        type="text"
                                                        aria-label={`Charge ${idx + 1} name`}
                                                        disabled={!isEditing}
                                                        placeholder="Charge Name (e.g. Packaging)"
                                                        value={charge.name || ""}
                                                        onChange={(e) =>
                                                            handleUpdateCharge(
                                                                idx,
                                                                "name",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-36 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            aria-label={`Charge ${idx + 1} amount`}
                                                            disabled={!isEditing}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="Amount"
                                                            value={charge.amount ?? 0}
                                                            onChange={(e) =>
                                                                handleUpdateCharge(
                                                                    idx,
                                                                    "amount",
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                            className="w-20 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                        />
                                                        <select
                                                            aria-label={`Charge ${idx + 1} type`}
                                                            disabled={!isEditing}
                                                            value={charge.type || "FIXED"}
                                                            onChange={(e) =>
                                                                handleUpdateCharge(
                                                                    idx,
                                                                    "type",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                        >
                                                            <option value="FIXED">₹ (Flat)</option>
                                                            <option value="PERCENTAGE">%</option>
                                                        </select>
                                                    </div>

                                                    <select
                                                        aria-label={`Charge ${idx + 1} applies to`}
                                                        disabled={!isEditing}
                                                        value={
                                                            Array.isArray(charge.appliesTo)
                                                                ? charge.appliesTo[0] || "ALL"
                                                                : charge.appliesTo || "ALL"
                                                        }
                                                        onChange={(e) =>
                                                            handleUpdateCharge(idx, "appliesTo", [
                                                                e.target.value,
                                                            ])
                                                        }
                                                        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-semibold text-stone-900 outline-none focus:border-orange-500 disabled:bg-stone-50"
                                                    >
                                                        <option value="ALL">All Orders</option>
                                                        <option value="DINE_IN">Dine-In Only</option>
                                                        <option value="TAKEAWAY">Takeaway Only</option>
                                                        <option value="DELIVERY">Delivery Only</option>
                                                        <option value="PICKUP">Pickup Only</option>
                                                    </select>

                                                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-700">
                                                        <input
                                                            type="checkbox"
                                                            disabled={!isEditing}
                                                            checked={Boolean(charge.isEnabled)}
                                                            onChange={(e) =>
                                                                handleUpdateCharge(
                                                                    idx,
                                                                    "isEnabled",
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="h-3.5 w-3.5 accent-orange-600"
                                                        />
                                                        Active
                                                    </label>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCharge(idx)}
                                                        className="ml-auto rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                                        title="Delete Charge"
                                                        aria-label={`Delete ${charge.name || `Charge ${idx + 1}`}`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Customer Tips & Grand-Total Round-Off */}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3.5">
                                        <div>
                                            <p className="text-xs font-bold text-stone-900">
                                                Allow Customer Tips
                                            </p>
                                            <p className="text-[11px] text-stone-500">
                                                Enable optional tip selection during checkout.
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            disabled={!isEditing}
                                            checked={form.billingConfig?.allowTips !== false}
                                            onChange={handleToggleBillingOption("allowTips")}
                                            className="h-4 w-4 accent-orange-600"
                                        />
                                    </label>

                                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3.5">
                                        <div>
                                            <p className="text-xs font-bold text-stone-900">
                                                Round-Off Grand Total
                                            </p>
                                            <p className="text-[11px] text-stone-500">
                                                Automatically round the final payable amount to the nearest whole rupee.
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            disabled={!isEditing}
                                            checked={Boolean(form.billingConfig?.roundOff)}
                                            onChange={handleToggleBillingOption("roundOff")}
                                            className="h-4 w-4 accent-orange-600"
                                        />
                                    </label>
                                </div>

                                {/* Invoice Numbering */}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        label="Invoice Prefix"
                                        htmlFor={`${baseId}-invoicePrefix`}
                                        hint="Example: CK-2026-"
                                    >
                                        <input
                                            id={`${baseId}-invoicePrefix`}
                                            readOnly={!isEditing}
                                            className={getInputClass(isEditing)}
                                            placeholder="INV-"
                                            value={form.invoicePrefix || ""}
                                            onChange={setField("invoicePrefix")}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Next Invoice Number"
                                        htmlFor={`${baseId}-nextInvoiceNumber`}
                                        error={fieldErrors.nextInvoiceNumber}
                                    >
                                        <input
                                            id={`${baseId}-nextInvoiceNumber`}
                                            type="number"
                                            min="1"
                                            step="1"
                                            readOnly={!isEditing}
                                            className={getInputClass(
                                                isEditing,
                                                Boolean(fieldErrors.nextInvoiceNumber)
                                            )}
                                            placeholder="1001"
                                            value={form.nextInvoiceNumber ?? 1001}
                                            onChange={setField("nextInvoiceNumber")}
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* 5. OPERATIONS & PREFERENCES */}
                    {activeSection === "preferences" ? (
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-stone-200 bg-white shadow-xs">
                                <SectionCardHeader
                                    icon={Settings2}
                                    title="Operations"
                                    subtitle="Core running preferences for timezone, currency, and availability."
                                    isEditing={isEditing}
                                    onEdit={() => setIsEditing(true)}
                                    onCancel={handleCancelEdit}
                                    saving={saving}
                                />

                                <div className="space-y-4 p-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField label="Timezone" htmlFor={`${baseId}-timezone`}>
                                            <input
                                                id={`${baseId}-timezone`}
                                                readOnly={!isEditing}
                                                className={getInputClass(isEditing)}
                                                placeholder="Asia/Kolkata"
                                                value={form.timezone || ""}
                                                onChange={setField("timezone")}
                                            />
                                        </FormField>

                                        <FormField label="Currency" htmlFor={`${baseId}-currency`}>
                                            <input
                                                id={`${baseId}-currency`}
                                                readOnly={!isEditing}
                                                className={getInputClass(isEditing)}
                                                placeholder="INR"
                                                value={form.currency || ""}
                                                onChange={setField("currency")}
                                            />
                                        </FormField>
                                    </div>

                                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 p-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <ShieldCheck size={17} className="text-orange-600" />
                                            <div>
                                                <p className="text-xs font-bold text-stone-900">
                                                    Restaurant Visibility
                                                </p>
                                                <p className="text-[11px] text-stone-500">
                                                    Make this restaurant available for orders
                                                </p>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            disabled={!isEditing}
                                            checked={Boolean(form.isActive)}
                                            onChange={setChecked("isActive")}
                                            className="h-4 w-4 accent-orange-600"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                                <h3 className="text-sm font-bold text-stone-900">Appearance</h3>
                                <p className="mt-0.5 text-xs text-stone-500">
                                    Choose the restaurant theme shown across staff and customer screens.
                                </p>
                                <div className="mt-3 max-w-xl">
                                    <ThemeSelector variant="compact" />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                                <div className="flex items-center gap-2">
                                    <Volume2 size={16} className="text-orange-600" />
                                    <h3 className="text-sm font-bold text-stone-900">
                                        Sound & Vibration
                                    </h3>
                                </div>
                                <p className="mt-0.5 text-xs text-stone-500">
                                    Configure sound alerts and vibration feedback for notifications.
                                </p>
                                <div className="mt-3">
                                    <NotificationSoundPicker defaultExpanded={false} />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                                            Danger Zone
                                        </p>
                                        <h3 className="mt-0.5 text-sm font-bold text-rose-900">
                                            Delete Account
                                        </h3>
                                        <p className="mt-0.5 text-xs text-stone-600">
                                            Permanently delete your account, restaurant data, and access.
                                        </p>
                                    </div>
                                    <Link
                                        to="/delete-account"
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shrink-0"
                                    >
                                        <Trash2 size={13} />
                                        Delete Account
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    </form>
                    )}
                </div>
            </div>
        </section>
    );
}
