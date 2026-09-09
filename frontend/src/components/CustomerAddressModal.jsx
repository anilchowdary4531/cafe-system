import { useCallback, useEffect, useState } from "react";
import {
    Building2,
    Check,
    ChevronDown,
    Home,
    LoaderCircle,
    LocateFixed,
    MapPin,
    Plus,
    Pencil,
    Trash2,
    X,
} from "lucide-react";
import { api, invalidateGetCache } from "../utils/apiClient";
import useCachedGet from "../hooks/useCachedGet";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../utils/toast";

const STORAGE_KEY = "tiffzy_selected_address_v1";

export function getStoredActiveAddress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return null;
}

export function setStoredActiveAddress(address) {
    try {
        if (address) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(address));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // ignore
    }
}

export function formatAddressLine(addr) {
    if (!addr) return "";
    const parts = [
        addr.line1 || addr.houseNo || addr.flatNo,
        addr.mandal || addr.area || addr.street,
        addr.city,
        addr.postalCode,
    ].filter(Boolean);
    return parts.join(", ");
}

const emptyForm = (profile) => ({
    id: null,
    label: "Home",
    name: String(profile?.name || "").trim(),
    phone: String(profile?.phone || "").trim(),
    line1: "",
    line2: "",
    mandal: "",
    city: "",
    postalCode: "",
    latitude: null,
    longitude: null,
    isDefault: false,
});

export default function CustomerAddressModal({
    isOpen,
    onClose,
    activeAddress,
    onSelectAddress,
}) {
    const { customer } = useAuth();
    const [formOpen, setFormOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [formData, setFormData] = useState(() => emptyForm(customer));
    const [saving, setSaving] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const isCustomerLoggedIn = Boolean(customer);

    const { data: addressData, loading: addressLoading, refresh: refreshAddresses } = useCachedGet("/customer/address", {
        enabled: isCustomerLoggedIn,
        ttlMs: 10_000,
        staleMs: 60_000,
    });

    const savedAddresses = Array.isArray(addressData?.addresses) ? addressData.addresses : [];

    useEffect(() => {
        if (isOpen && !activeAddress && savedAddresses.length > 0) {
            const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
            onSelectAddress?.(defaultAddr);
        }
    }, [isOpen, activeAddress, savedAddresses, onSelectAddress]);

    const handleUseCurrentLocation = async () => {
        if (!("geolocation" in navigator)) {
            showToast({
                title: "GPS Unavailable",
                message: "Geolocation is not supported by your browser.",
                variant: "error",
            });
            return;
        }

        setGpsLoading(true);
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10_000,
                    maximumAge: 60_000,
                });
            });

            const lat = Number(pos?.coords?.latitude);
            const lon = Number(pos?.coords?.longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                throw new Error("Could not fetch GPS coordinates.");
            }

            // Reverse Geocode via OpenStreetMap Nominatim
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            const payload = await res.json();
            const addrDetails = payload?.address || {};

            const city = addrDetails.city || addrDetails.town || addrDetails.village || addrDetails.county || "";
            const mandal = [addrDetails.suburb, addrDetails.neighbourhood, addrDetails.road, addrDetails.city_district]
                .filter(Boolean)
                .join(", ") || city;

            const gpsAddress = {
                id: `gps_${Date.now()}`,
                label: "Current Location",
                line1: [addrDetails.house_number, addrDetails.building, addrDetails.road].filter(Boolean).join(", ") || "Current GPS Location",
                mandal,
                city,
                postalCode: addrDetails.postcode || "",
                latitude: lat,
                longitude: lon,
                isGps: true,
            };

            onSelectAddress?.(gpsAddress);
            setStoredActiveAddress(gpsAddress);
            showToast({
                title: "Location Detected 📍",
                message: `${mandal ? `${mandal}, ` : ""}${city}`,
                variant: "success",
            });
            onClose?.();
        } catch (err) {
            showToast({
                title: "Location Error",
                message: err.message || "Failed to detect location from GPS.",
                variant: "error",
            });
        } finally {
            setGpsLoading(false);
        }
    };

    const handleOpenAddForm = () => {
        setEditingAddress(null);
        setFormData(emptyForm(customer));
        setFormOpen(true);
    };

    const handleOpenEditForm = (addr, e) => {
        e.stopPropagation();
        setEditingAddress(addr);
        setFormData({
            id: addr.id,
            label: addr.label || "Home",
            name: addr.name || String(customer?.name || "").trim(),
            phone: addr.phone || String(customer?.phone || "").trim(),
            line1: addr.line1 || "",
            line2: addr.line2 || "",
            mandal: addr.mandal || "",
            city: addr.city || "",
            postalCode: addr.postalCode || "",
            latitude: addr.latitude || null,
            longitude: addr.longitude || null,
            isDefault: Boolean(addr.isDefault),
        });
        setFormOpen(true);
    };

    const handleDeleteAddress = async (addrId, e) => {
        e.stopPropagation();
        if (!isCustomerLoggedIn) return;

        setDeletingId(addrId);
        try {
            await api.delete(`/customer/address/${addrId}`);
            invalidateGetCache({ urlStartsWith: "/customer/address" });
            await refreshAddresses({ force: true });

            if (activeAddress?.id === addrId) {
                const remaining = savedAddresses.filter((a) => a.id !== addrId);
                const next = remaining[0] || null;
                onSelectAddress?.(next);
                setStoredActiveAddress(next);
            }

            showToast({ title: "Deleted", message: "Address removed.", variant: "success" });
        } catch (err) {
            showToast({
                title: "Delete Failed",
                message: err.response?.data?.message || "Failed to delete address",
                variant: "error",
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleSaveForm = async (e) => {
        e.preventDefault();
        if (!formData.line1.trim()) {
            showToast({ title: "Required", message: "Please enter House / Flat / Building No.", variant: "error" });
            return;
        }
        if (!formData.mandal.trim()) {
            showToast({ title: "Required", message: "Please enter Area / Street / Mandal.", variant: "error" });
            return;
        }
        if (!formData.city.trim()) {
            showToast({ title: "Required", message: "Please enter City.", variant: "error" });
            return;
        }

        setSaving(true);
        try {
            let savedObj = null;
            if (isCustomerLoggedIn) {
                if (editingAddress?.id) {
                    const res = await api.put(`/customer/address/${editingAddress.id}`, formData).catch(() =>
                        api.post("/customer/address", { ...formData, id: editingAddress.id })
                    );
                    savedObj = res.data?.address || { ...formData, id: editingAddress.id };
                } else {
                    const res = await api.post("/customer/address", formData);
                    savedObj = res.data?.address || formData;
                }
                invalidateGetCache({ urlStartsWith: "/customer/address" });
                await refreshAddresses({ force: true });
            } else {
                savedObj = { ...formData, id: `local_${Date.now()}` };
            }

            onSelectAddress?.(savedObj);
            setStoredActiveAddress(savedObj);
            setFormOpen(false);
            showToast({
                title: "Address Saved",
                message: `Selected ${savedObj.label || "Address"} as delivery location.`,
                variant: "success",
            });
            onClose?.();
        } catch (err) {
            showToast({
                title: "Save Failed",
                message: err.response?.data?.message || "Failed to save address",
                variant: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity sm:items-center sm:p-4">
            <div className="relative flex max-h-[90vh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[28px] border border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] text-[color:var(--app-text)] shadow-2xl animate-in slide-in-from-bottom-5 duration-200 sm:rounded-[28px]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fe5102]/10 text-[#fe5102]">
                            <MapPin size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight">Select Delivery Location</h2>
                            <p className="theme-muted text-[11px]">Choose saved address or detect location via GPS</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-black/5 text-[color:var(--app-text)] transition hover:bg-black/10"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* GPS Button */}
                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={gpsLoading}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#fe5102]/30 bg-[#fe5102]/5 p-4 text-left transition hover:bg-[#fe5102]/10 active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fe5102] text-white shadow-md">
                                {gpsLoading ? <LoaderCircle size={20} className="animate-spin" /> : <LocateFixed size={20} />}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[#fe5102]">Use Current Location</h3>
                                <p className="theme-muted text-xs">Detect coordinates & address automatically via GPS</p>
                            </div>
                        </div>
                        <span className="rounded-full bg-[#fe5102] px-3 py-1 text-xs font-bold text-white shadow-sm">
                            {gpsLoading ? "Locating..." : "GPS"}
                        </span>
                    </button>

                    {/* Form Section */}
                    {formOpen ? (
                        <form onSubmit={handleSaveForm} className="rounded-2xl border border-[var(--app-border)] bg-black/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--app-text)]">
                                    {editingAddress ? "Edit Address" : "Add New Address"}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
                                    className="text-xs font-bold text-[color:var(--app-accent)] hover:underline"
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* Label Selection */}
                            <div className="flex items-center gap-2">
                                {["Home", "Work", "Other"].map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, label: tag }))}
                                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition ${
                                            formData.label === tag
                                                ? "bg-[#fe5102] text-white shadow-sm"
                                                : "border border-[var(--app-border)] bg-white/50 text-[color:var(--app-text)] hover:bg-white"
                                        }`}
                                    >
                                        {tag === "Home" ? <Home size={12} /> : tag === "Work" ? <Building2 size={12} /> : <MapPin size={12} />}
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                placeholder="House / Flat / Building No. *"
                                value={formData.line1}
                                onChange={(e) => setFormData((prev) => ({ ...prev, line1: e.target.value }))}
                                className="w-full rounded-xl border border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] p-2.5 text-xs outline-none focus:border-[#fe5102]"
                            />

                            <input
                                type="text"
                                placeholder="Street / Area / Mandal *"
                                value={formData.mandal}
                                onChange={(e) => setFormData((prev) => ({ ...prev, mandal: e.target.value }))}
                                className="w-full rounded-xl border border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] p-2.5 text-xs outline-none focus:border-[#fe5102]"
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="City *"
                                    value={formData.city}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                                    className="w-full rounded-xl border border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] p-2.5 text-xs outline-none focus:border-[#fe5102]"
                                />
                                <input
                                    type="text"
                                    placeholder="Postal Code / Pincode"
                                    value={formData.postalCode}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                                    className="w-full rounded-xl border border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] p-2.5 text-xs outline-none focus:border-[#fe5102]"
                                />
                            </div>

                            <label className="flex items-center gap-2 pt-1 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, isDefault: e.target.checked }))}
                                    className="rounded accent-[#fe5102]"
                                />
                                <span>Set as default address</span>
                            </label>

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#fe5102] p-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#e04700] disabled:opacity-70"
                            >
                                {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                                {saving ? "Saving..." : editingAddress ? "Update Address" : "Save & Use Address"}
                            </button>
                        </form>
                    ) : (
                        <button
                            type="button"
                            onClick={handleOpenAddForm}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--app-border)] bg-black/5 p-3 text-xs font-bold text-[color:var(--app-text)] transition hover:bg-black/10"
                        >
                            <Plus size={16} className="text-[#fe5102]" />
                            Add New Delivery Address
                        </button>
                    )}

                    {/* Saved Addresses List */}
                    <div className="space-y-2 pt-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--app-muted)]">
                            Saved Addresses ({savedAddresses.length})
                        </h3>

                        {addressLoading && savedAddresses.length === 0 ? (
                            <div className="py-6 text-center text-xs theme-muted">Loading saved addresses...</div>
                        ) : savedAddresses.length === 0 ? (
                            <div className="py-6 text-center text-xs theme-muted">
                                No saved addresses yet. Add a new address or use current GPS location above.
                            </div>
                        ) : (
                            savedAddresses.map((addr) => {
                                const isSelected = activeAddress?.id === addr.id;
                                const isDeleting = deletingId === addr.id;

                                return (
                                    <div
                                        key={addr.id}
                                        onClick={() => {
                                            onSelectAddress?.(addr);
                                            setStoredActiveAddress(addr);
                                            showToast({
                                                title: "Location Selected",
                                                message: `Delivering to ${addr.label || "Address"}`,
                                                variant: "success",
                                            });
                                            onClose?.();
                                        }}
                                        className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition ${
                                            isSelected
                                                ? "border-[#fe5102] bg-[#fe5102]/10 shadow-sm"
                                                : "border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] hover:border-[#fe5102]/40"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div
                                                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                                                    isSelected
                                                        ? "border-[#fe5102] bg-[#fe5102] text-white"
                                                        : "border-[var(--app-border)] bg-black/5 text-[color:var(--app-muted)]"
                                                }`}
                                            >
                                                {isSelected ? <Check size={14} /> : <MapPin size={14} />}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-xs text-[color:var(--app-text)]">
                                                        {addr.label || "Home"}
                                                    </span>
                                                    {addr.isDefault && (
                                                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                                                            DEFAULT
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-[color:var(--app-text)] opacity-85 leading-relaxed truncate">
                                                    {formatAddressLine(addr)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => handleOpenEditForm(addr, e)}
                                                className="p-1.5 text-[color:var(--app-muted)] hover:text-[#fe5102] transition"
                                                title="Edit Address"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            {isCustomerLoggedIn && (
                                                <button
                                                    type="button"
                                                    disabled={isDeleting}
                                                    onClick={(e) => handleDeleteAddress(addr.id, e)}
                                                    className="p-1.5 text-[color:var(--app-muted)] hover:text-red-500 transition disabled:opacity-50"
                                                    title="Delete Address"
                                                >
                                                    {isDeleting ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
