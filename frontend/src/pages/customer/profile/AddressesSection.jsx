import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, LocateFixed, MapPin, Save, Trash2 } from "lucide-react";
import useCachedGet from "../../../hooks/useCachedGet";
import { api, invalidateGetCache } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";

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

const normalizeText = (value) => String(value || "").trim();

const normalizeCoordinate = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getCurrentPosition = () =>
    new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("Geolocation is not supported on this device."));
            return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12_000,
            maximumAge: 60_000,
        });
    });

const mapReverseGeocodeToAddress = (payload, profile, latitude, longitude) => {
    const address = payload?.address || {};
    const city = address.city || address.town || address.village || address.county || "";
    const mandal = [address.suburb, address.neighbourhood, address.city_district, address.municipality, address.county]
        .filter(Boolean)
        .join(", ")
        .trim();

    return {
        label: "Home",
        name: String(profile?.name || "").trim(),
        phone: String(profile?.phone || "").trim(),
        line1: "",
        line2: "",
        city,
        mandal,
        postalCode: address.postcode || "",
        latitude: normalizeCoordinate(latitude ?? payload?.lat),
        longitude: normalizeCoordinate(longitude ?? payload?.lon),
        notes: "",
        isDefault: false,
    };
};

export default function AddressesSection({ profile, customerToken }) {
    const [addressDraft, setAddressDraft] = useState(() => emptyAddress(profile));
    const [addressSaving, setAddressSaving] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoStatus, setGeoStatus] = useState("");
    const [geoError, setGeoError] = useState("");

    const canUseProfileApi = Boolean(customerToken);
    const phone = String(profile?.phone || "").trim();

    const { data: addressData, loading: addressLoading, error: addressError, refresh: refreshAddresses } = useCachedGet("/customer/address", {
        enabled: canUseProfileApi,
        ttlMs: 12_000,
        staleMs: 5 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    const addresses = useMemo(() => (Array.isArray(addressData?.addresses) ? addressData.addresses : []), [addressData?.addresses]);

    useEffect(() => {
        setAddressDraft((prev) => ({
            ...prev,
            name: prev.name ? prev.name : String(profile?.name || "").trim(),
            phone: prev.phone ? prev.phone : String(profile?.phone || "").trim(),
        }));
    }, [profile?.name, profile?.phone]);

    const updateAddressFromCoordinates = useCallback(
        async (lat, lon, { notify = false, statusLabel = "Updating location..." } = {}) => {
            if (!canUseProfileApi) return;

            const latitude = normalizeCoordinate(lat);
            const longitude = normalizeCoordinate(lon);
            if (latitude == null || longitude == null) {
                throw new Error("Could not read your GPS coordinates.");
            }

            setGeoLoading(true);
            setGeoError("");
            setGeoStatus(statusLabel);

            try {
                const url = new URL("https://nominatim.openstreetmap.org/reverse");
                url.searchParams.set("format", "jsonv2");
                url.searchParams.set("lat", String(latitude));
                url.searchParams.set("lon", String(longitude));
                url.searchParams.set("zoom", "18");
                url.searchParams.set("addressdetails", "1");
                url.searchParams.set("accept-language", "en");

                const res = await fetch(url.toString(), {
                    headers: {
                        Accept: "application/json",
                    },
                });
                if (!res.ok) {
                    throw new Error("Reverse geocoding failed.");
                }

                const payload = await res.json();
                const nextDraft = mapReverseGeocodeToAddress(payload, profile, latitude, longitude);
                setAddressDraft((draft) => ({
                    ...draft,
                    ...nextDraft,
                    latitude,
                    longitude,
                    name: draft.name || nextDraft.name,
                    phone: draft.phone || nextDraft.phone,
                    label: draft.label || "Home",
                    city: draft.city || nextDraft.city,
                    mandal: draft.mandal || nextDraft.mandal,
                    isDefault: draft.isDefault || false,
                }));
                setGeoStatus("GPS captured your coordinates, city, and mandal. Please complete the remaining address details manually.");
                if (notify) {
                    showToast({
                        title: "Location captured",
                        message: "Coordinates, city, and mandal were filled from GPS.",
                        variant: "success",
                    });
                }
                return nextDraft;
            } catch (err) {
                const message = err?.message || "Failed to capture location.";
                setGeoError(message);
                setGeoStatus("");
                if (notify) {
                    showToast({ title: "GPS capture failed", message, variant: "error" });
                }
                throw err;
            } finally {
                setGeoLoading(false);
            }
        },
        [canUseProfileApi, profile]
    );

    const captureCurrentLocation = useCallback(async () => {
        if (!canUseProfileApi) return;

        setGeoLoading(true);
        setGeoError("");
        setGeoStatus("Getting your current location...");

        try {
            const pos = await getCurrentPosition();
            const lat = Number(pos?.coords?.latitude);
            const lon = Number(pos?.coords?.longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                throw new Error("Could not read your GPS coordinates.");
            }

            await updateAddressFromCoordinates(lat, lon, {
                notify: true,
                statusLabel: "Looking up your address...",
            });
        } catch (err) {
            const message = err?.message || "Failed to capture location.";
            setGeoError(message);
            setGeoStatus("");
            showToast({ title: "GPS capture failed", message, variant: "error" });
        } finally {
            setGeoLoading(false);
        }
    }, [canUseProfileApi, updateAddressFromCoordinates]);

    const createAddress = useCallback(async () => {
        if (!canUseProfileApi) return;
        if (!normalizeText(addressDraft.line1)) {
            showToast({ title: "Address required", message: "Please enter address line 1.", variant: "error" });
            return;
        }
        if (!normalizeText(addressDraft.city)) {
            showToast({ title: "City required", message: "Please enter the city.", variant: "error" });
            return;
        }
        if (!normalizeText(addressDraft.mandal)) {
            showToast({ title: "Mandal required", message: "Please enter the mandal or area.", variant: "error" });
            return;
        }

        setAddressSaving(true);
        try {
            await api.post("/customer/address", addressDraft);
            invalidateGetCache({ urlStartsWith: "/customer/address" });
            await refreshAddresses({ force: true });
            setAddressDraft(emptyAddress(profile));
            setGeoStatus("");
            setGeoError("");
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
            <section className="theme-panel rounded-[32px] p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="theme-accent-text text-[11px] font-semibold uppercase tracking-[0.28em]">Address</p>
                        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Delivery address</h1>
                        <p className="theme-muted mt-2 max-w-2xl text-sm">
                            Use GPS to fill latitude, longitude, city, and mandal, then type the rest of the delivery details manually.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={captureCurrentLocation}
                        disabled={!canUseProfileApi || geoLoading}
                        className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {geoLoading ? <LoaderCircle size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                        {geoLoading ? "Capturing..." : "Use current location"}
                    </button>

                </div>

                {geoStatus && (
                    <div className="theme-address-banner mt-4 rounded-2xl px-4 py-3 text-sm">
                        {geoStatus}
                    </div>
                )}

                {geoError && (
                    <div className="theme-address-banner theme-address-banner-error mt-4 rounded-2xl px-4 py-3 text-sm">
                        {geoError}
                    </div>
                )}

                {!canUseProfileApi && (
                    <div className="theme-address-note mt-4 rounded-2xl px-4 py-3 text-sm">
                        <p className="font-semibold">Login required</p>
                        <p className="theme-muted mt-1">Enable "Remember login" and sign in again to save addresses.</p>
                    </div>
                )}
            </section>

            {canUseProfileApi ? (
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <section className="theme-panel rounded-[32px] p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">New address</p>
                                <h2 className="mt-1 text-2xl font-semibold">Type it here</h2>
                            </div>
                            <span className="theme-soft-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold">
                                <MapPin size={14} />
                                Manual or GPS
                            </span>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Label</label>
                                <input
                                    value={addressDraft.label}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, label: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Home / Work / Other"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Name</label>
                                <input
                                    value={addressDraft.name}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, name: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Phone</label>
                                <input
                                    value={addressDraft.phone}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, phone: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Mobile number"
                                />
                            </div>
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
                            <div>
                                <label className="theme-muted mb-1 block text-xs">City</label>
                                <input
                                    value={addressDraft.city}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="City"
                                />
                            </div>
                            <div>
                                <label className="theme-muted mb-1 block text-xs">Mandal / Area</label>
                                <input
                                    value={addressDraft.mandal}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, mandal: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="Mandal / Area"
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
                            <div className="md:col-span-2">
                                <label className="theme-muted mb-1 block text-xs">Postal code</label>
                                <input
                                    value={addressDraft.postalCode}
                                    onChange={(e) => setAddressDraft((d) => ({ ...d, postalCode: e.target.value }))}
                                    className="theme-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                                    placeholder="PIN code"
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
                            <div className="theme-address-note flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs md:col-span-2">
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
                                    className="theme-button inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {addressSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                                    {addressSaving ? "Saving..." : "Save address"}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="theme-panel rounded-[32px] p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="theme-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Saved address</p>
                                <h2 className="mt-1 text-2xl font-semibold">Your list</h2>
                            </div>
                            <span className="theme-soft-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold">
                                {addresses.length}
                                <span>saved</span>
                            </span>
                        </div>

                        <div className="mt-5 space-y-3">
                            {addressLoading ? (
                                <div className="theme-muted py-2 text-xs">Loading addresses...</div>
                            ) : addressError ? (
                                <div className="theme-address-banner theme-address-banner-error rounded-2xl px-3 py-2 text-xs">
                                    {addressError}
                                </div>
                            ) : addresses.length ? (
                                addresses.map((addr) => (
                                    <div
                                        key={addr.id}
                                        className="rounded-2xl border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_92%,var(--app-surface-2)_8%)] p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold">
                                                        {addr.label}
                                                        {addr.isDefault ? " (Default)" : ""}
                                                    </p>
                                                </div>
                                                <p className="theme-muted mt-1 whitespace-pre-line text-xs leading-relaxed">
                                                    {[addr.line1, addr.line2].filter(Boolean).join("\n")}
                                                </p>
                                                {addr.notes && <p className="theme-muted mt-1 text-[11px]">{addr.notes}</p>}
                                                {(addr.city || addr.mandal || addr.state || addr.postalCode) && (
                                                    <p className="theme-muted mt-1 text-[11px]">
                                                        {[addr.city, addr.mandal || addr.state, addr.postalCode].filter(Boolean).join(", ")}
                                                    </p>
                                                )}
                                            {(normalizeCoordinate(addr.latitude) != null || normalizeCoordinate(addr.longitude) != null) && (
                                                <p className="theme-muted mt-1 text-[11px]">
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
                                    </div>
                                ))
                            ) : (
                                <div className="theme-address-empty-state rounded-2xl px-4 py-6 text-sm">
                                    <p className="font-semibold">No saved addresses yet.</p>
                                    <p className="theme-muted mt-1 text-xs">Create one manually or use GPS to autofill the fields.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
