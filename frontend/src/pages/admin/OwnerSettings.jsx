import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { LoaderCircle, Save } from "lucide-react";
import { API } from "../../config";
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

export default function OwnerSettings() {
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = Number(user?.restaurantId);

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
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 text-gray-300">
                Loading settings...
            </div>
        );
    }

    return (
        <section className="space-y-5">
            <article className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#131a2b] via-[#1a2740] to-[#15293b] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Configuration</p>
                <h3 className="mt-1 text-3xl font-bold">Restaurant Settings</h3>
                <p className="mt-1 text-sm text-slate-300">
                    Manage brand profile, tax/service charge, billing controls, and operations.
                </p>
            </article>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="mb-3 text-lg font-semibold">Business Profile</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Restaurant Name" value={form.name || ""} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Legal Name" value={form.legalName || ""} onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Owner Name" value={form.ownerName || ""} onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))} />
                        <div className="rounded-lg bg-[#0f172a] px-3 py-2 md:col-span-2">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                        {form.logo ? (
                                            <img src={form.logo} alt="Logo" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full bg-gradient-to-br from-white/10 to-transparent" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Restaurant Logo</p>
                                        <p className="text-xs text-slate-500">PNG/JPG/WebP/SVG</p>
                                    </div>
                                </div>
                                <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-end">
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                        disabled={logoUploading}
                                        onChange={(e) => uploadLogo(e.target.files?.[0])}
                                        className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100 hover:file:bg-white/15 disabled:opacity-70 md:w-auto"
                                    />
                                    <input
                                        className="w-full rounded-lg bg-black/20 px-3 py-2 text-sm outline-none md:max-w-[420px]"
                                        placeholder="Or paste Logo URL"
                                        value={form.logo || ""}
                                        onChange={(e) => setForm((prev) => ({ ...prev, logo: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <input type="email" className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Business Email" value={form.email || ""} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Phone" value={form.phone || ""} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="mb-3 text-lg font-semibold">Address & Identity</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none md:col-span-2" placeholder="Address line" value={form.addressLine1 || ""} onChange={(e) => setForm((prev) => ({ ...prev, addressLine1: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="City" value={form.city || ""} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="State" value={form.state || ""} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Country" value={form.country || ""} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Pincode" value={form.pincode || ""} onChange={(e) => setForm((prev) => ({ ...prev, pincode: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none md:col-span-2" placeholder="GST Number" value={form.gstNumber || ""} onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value }))} />
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="mb-3 text-lg font-semibold">Tax & Billing</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-gray-300">
                            <input type="checkbox" checked={Boolean(form.taxEnabled)} onChange={(e) => setForm((prev) => ({ ...prev, taxEnabled: e.target.checked }))} />
                            Tax Enabled
                        </label>
                        <select className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" value={form.taxType || "EXCLUSIVE"} onChange={(e) => setForm((prev) => ({ ...prev, taxType: e.target.value }))}>
                            <option value="EXCLUSIVE">EXCLUSIVE</option>
                            <option value="INCLUSIVE">INCLUSIVE</option>
                        </select>
                        <input type="number" min="0" step="0.01" className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Default Tax %" value={form.defaultTaxPercent ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, defaultTaxPercent: e.target.value }))} />
                        <label className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-gray-300">
                            <input type="checkbox" checked={Boolean(form.serviceChargeEnabled)} onChange={(e) => setForm((prev) => ({ ...prev, serviceChargeEnabled: e.target.checked }))} />
                            Service Charge Enabled
                        </label>
                        <input type="number" min="0" step="0.01" className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Service Charge %" value={form.serviceChargePercent ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, serviceChargePercent: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Invoice Prefix" value={form.invoicePrefix || ""} onChange={(e) => setForm((prev) => ({ ...prev, invoicePrefix: e.target.value }))} />
                        <input type="number" min="1" step="1" className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Next Invoice Number" value={form.nextInvoiceNumber ?? 1001} onChange={(e) => setForm((prev) => ({ ...prev, nextInvoiceNumber: e.target.value }))} />
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="mb-3 text-lg font-semibold">Operations</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Timezone" value={form.timezone || ""} onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))} />
                        <input className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none" placeholder="Currency (INR, USD...)" value={form.currency || ""} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))} />
                        <label className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-gray-300 md:col-span-2">
                            <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                            Restaurant is active
                        </label>
                    </div>
                </article>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 font-semibold text-black disabled:opacity-70"
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
