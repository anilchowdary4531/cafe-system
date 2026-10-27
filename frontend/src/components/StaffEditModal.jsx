import { useEffect, useState } from "react";
import axios from "axios";
import {
    Pencil,
    X,
    Eye,
    EyeOff,
    LoaderCircle,
} from "lucide-react";
import { API } from "../config";
import { showToast } from "../utils/toast";
import { mapDesignationToSystemRole } from "../utils/staffRole";

export const DESIGNATION_OPTIONS = [
    "Chef",
    "Senior Chef",
    "Server",
    "Swiper",
    "Manager",
    "Cashier",
    "Steward",
    "Cleaner",
    "Other / Custom",
];

export const ACCESS_LABELS = {
    dashboard: "Dashboard",
    billing: "Billing Desk",
    orders: "Live Orders",
    menu: "Menu Studio",
    inventory: "Inventory & BOM",
    tables: "Tables & QR",
    kitchen: "Kitchen Operations",
    printers: "Printers",
    analytics: "Analytics",
    reports: "Reports & Insights",
    paylater: "Pay Later",
    shifts: "Shift & Day Close",
    supply: "Supply Marketplace",
    delivery: "Delivery Studio",
    delivery_partners: "Delivery Partners",
    customers: "Customers",
    discounts: "Discounts & Offers",
    loyalty: "Loyalty & Rewards",
    staff: "Staff",
    settings: "Settings",
    notifications: "Notifications",
};

export const DEFAULT_DESIGNATION_BY_ROLE = {
    MANAGER: "Manager",
    WAITER: "Server",
    CHEF: "Chef",
    CASHIER: "Cashier",
    STEWARD: "Steward",
    CLEANER: "Cleaner",
    SWIPER: "Swiper",
    STAFF: "Staff",
    OWNER: "Owner",
};

export const defaultAccessByRole = (role) => {
    const normalizedRole = String(role || "STAFF").toUpperCase();
    if (normalizedRole === "OWNER") {
        return Object.keys(ACCESS_LABELS).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    }
    if (normalizedRole === "MANAGER") {
        return {
            dashboard: true, billing: true, orders: true, menu: true, inventory: true, tables: true,
            kitchen: true, printers: true, analytics: true, reports: true, paylater: true, shifts: true,
            supply: true, delivery: true, delivery_partners: true, customers: true, discounts: true,
            loyalty: true, staff: false, settings: false, notifications: true,
        };
    }
    if (normalizedRole === "CHEF") {
        return {
            dashboard: true, billing: false, orders: true, menu: false, inventory: true, tables: false,
            kitchen: true, printers: true, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true,
        };
    }
    if (normalizedRole === "WAITER" || normalizedRole === "SERVER") {
        return {
            dashboard: true, billing: true, orders: true, menu: true, inventory: false, tables: true,
            kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true,
        };
    }
    if (normalizedRole === "CASHIER") {
        return {
            dashboard: true, billing: true, orders: true, menu: false, inventory: false, tables: true,
            kitchen: false, printers: true, analytics: true, reports: true, paylater: true, shifts: true,
            supply: false, delivery: false, delivery_partners: false, customers: true, discounts: false,
            loyalty: true, staff: false, settings: false, notifications: true,
        };
    }
    if (normalizedRole === "STEWARD") {
        return {
            dashboard: true, billing: false, orders: false, menu: false, inventory: false, tables: true,
            kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true,
        };
    }
    if (normalizedRole === "CLEANER") {
        return {
            dashboard: true, billing: false, orders: false, menu: false, inventory: false, tables: true,
            kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true,
        };
    }
    if (normalizedRole === "SWIPER") {
        return {
            dashboard: true, billing: true, orders: false, menu: false, inventory: false, tables: true,
            kitchen: false, printers: true, analytics: false, reports: false, paylater: false, shifts: false,
            supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
            loyalty: false, staff: false, settings: false, notifications: true,
        };
    }
    return {
        dashboard: true, billing: false, orders: false, menu: false, inventory: false, tables: false,
        kitchen: false, printers: false, analytics: false, reports: false, paylater: false, shifts: false,
        supply: false, delivery: false, delivery_partners: false, customers: false, discounts: false,
        loyalty: false, staff: false, settings: false, notifications: true,
    };
};

export const getRoleDesignationFallback = (role) =>
    DEFAULT_DESIGNATION_BY_ROLE[String(role || "STAFF").toUpperCase()] || "Staff";

export const resolveDesignation = (staffUser) => {
    const custom = String(staffUser?.designation || "").trim();
    if (custom) return custom;
    return getRoleDesignationFallback(staffUser?.role);
};

export default function StaffEditModal({
    isOpen,
    onClose,
    staffUser,
    restaurantId,
    onSaved,
}) {
    if (!isOpen || !staffUser) return null;

    const currentDesig = resolveDesignation(staffUser);
    const isStandard = DESIGNATION_OPTIONS.includes(currentDesig);

    const [draft, setDraft] = useState({
        name: String(staffUser?.name || ""),
        email: String(staffUser?.email || ""),
        phone: String(staffUser?.phone || ""),
        role: String(staffUser?.role || "STAFF").toUpperCase(),
        designationOption: isStandard ? currentDesig : "OTHER",
        customDesignation: isStandard ? "" : currentDesig,
        password: "",
        isActive: staffUser?.isActive !== false,
        access: staffUser?.access ? { ...staffUser.access } : defaultAccessByRole(staffUser?.role),
    });

    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const cur = resolveDesignation(staffUser);
        const std = DESIGNATION_OPTIONS.includes(cur);
        setDraft({
            name: String(staffUser?.name || ""),
            email: String(staffUser?.email || ""),
            phone: String(staffUser?.phone || ""),
            role: String(staffUser?.role || "STAFF").toUpperCase(),
            designationOption: std ? cur : "OTHER",
            customDesignation: std ? "" : cur,
            password: "",
            isActive: staffUser?.isActive !== false,
            access: staffUser?.access ? { ...staffUser.access } : defaultAccessByRole(staffUser?.role),
        });
        setShowPassword(false);
        setError("");
    }, [staffUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const name = String(draft.name || "").trim();
        const email = String(draft.email || "").trim().toLowerCase();
        const phone = String(draft.phone || "").trim();
        const designation =
            draft.designationOption === "OTHER"
                ? String(draft.customDesignation || "").trim()
                : String(draft.designationOption || "").trim();

        if (!name || !email) {
            setError("Name and email are required to update staff.");
            return;
        }

        const effectiveRid = restaurantId || staffUser?.restaurantId;
        if (!effectiveRid) {
            setError("Restaurant ID is missing.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const inferredRole = mapDesignationToSystemRole(designation);
            const roleToSend = staffUser?.role === "OWNER"
                ? "OWNER"
                : (inferredRole || String(draft.role || "STAFF").toUpperCase());

            const payload = {
                name,
                email,
                phone,
                designation,
                role: roleToSend,
                isActive: Boolean(draft.isActive),
            };
            if (draft.password) {
                payload.password = draft.password;
            }

            // 1. Authoritative staff ID update
            await axios.put(`${API}/owner/${effectiveRid}/staff/${staffUser.id}`, payload);

            // 2. Access permissions update if applicable
            if (draft.access && staffUser.role !== "OWNER") {
                await axios.put(`${API}/owner/${effectiveRid}/staff/${staffUser.id}/access`, {
                    access: draft.access,
                });
            }

            showToast({
                title: "Staff user updated",
                message: `Successfully saved updates for ${name}.`,
                variant: "success",
            });

            if (onSaved) {
                await onSaved({ ...staffUser, ...payload, access: draft.access });
            }
            onClose();
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || "Failed to update staff user.";
            setError(msg);
            showToast(msg, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            data-testid="staff-edit-modal"
        >
            <div className="w-full max-w-lg md:max-w-xl max-h-[90vh] rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl overflow-hidden flex flex-col animation-scale-up">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-orange-500/10 p-2 text-orange-600 border border-orange-500/20">
                            <Pencil className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                                <span>Editing Staff Profile: {staffUser.name}</span>
                                <span className="text-xs font-mono font-semibold text-neutral-500 bg-neutral-200/70 px-2 py-0.5 rounded">
                                    ID: #{staffUser.id}
                                </span>
                            </h3>
                            <p className="text-[11px] text-neutral-500">
                                Update profile details, designation, role, and permissions
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl transition-colors cursor-pointer"
                        aria-label="Close edit modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)] text-xs">
                        {error && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                required
                                aria-label="Full Name"
                                value={draft.name}
                                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Full name"
                                className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    required
                                    aria-label="Email Address"
                                    value={draft.email}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                                    placeholder="Email address"
                                    className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    aria-label="Phone Number"
                                    value={draft.phone}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                                    placeholder="Phone number"
                                    className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    Role *
                                </label>
                                <select
                                    aria-label="Role"
                                    value={draft.role}
                                    disabled={staffUser?.role === "OWNER"}
                                    onChange={(e) => {
                                        const r = e.target.value;
                                        setDraft((prev) => ({
                                            ...prev,
                                            role: r,
                                            designationOption: getRoleDesignationFallback(r),
                                        }));
                                    }}
                                    className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-60"
                                >
                                    {staffUser?.role === "OWNER" && <option value="OWNER">Owner</option>}
                                    <option value="MANAGER">Manager</option>
                                    <option value="WAITER">Server / Waiter</option>
                                    <option value="CHEF">Chef</option>
                                    <option value="CASHIER">Cashier</option>
                                    <option value="STAFF">General Staff</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    Designation
                                </label>
                                <select
                                    aria-label="Designation"
                                    value={draft.designationOption}
                                    onChange={(e) => {
                                        const desig = e.target.value;
                                        const inferredRole = mapDesignationToSystemRole(desig);
                                        setDraft((prev) => ({
                                            ...prev,
                                            designationOption: desig,
                                            role: staffUser?.role === "OWNER" ? "OWNER" : (inferredRole || prev.role),
                                        }));
                                    }}
                                    className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    {DESIGNATION_OPTIONS.map((desig) => (
                                        <option key={desig} value={desig}>
                                            {desig}
                                        </option>
                                    ))}
                                    <option value="OTHER">Other (Custom)</option>
                                </select>
                            </div>
                        </div>

                        {draft.designationOption === "OTHER" && (
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    Custom Designation
                                </label>
                                <input
                                    type="text"
                                    aria-label="Custom Designation"
                                    value={draft.customDesignation}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const inferredRole = mapDesignationToSystemRole(val);
                                        setDraft((prev) => ({
                                            ...prev,
                                            customDesignation: val,
                                            role: staffUser?.role === "OWNER" ? "OWNER" : (inferredRole || prev.role),
                                        }));
                                    }}
                                    placeholder="Custom designation"
                                    className="w-full p-2.5 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    New Password (Optional)
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={draft.password}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, password: e.target.value }))
                                        }
                                        placeholder="Leave blank to keep current"
                                        className="w-full p-2.5 pr-9 bg-white rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-xl border border-neutral-300 text-xs text-neutral-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(draft.isActive)}
                                        disabled={staffUser?.role === "OWNER"}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, isActive: e.target.checked }))
                                        }
                                        className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="font-semibold">Active Account</span>
                                </label>
                            </div>
                        </div>

                        {staffUser?.role !== "OWNER" && (
                            <div className="pt-3 border-t border-neutral-200">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                                    Module Access Permissions
                                </p>
                                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                                    {Object.keys(ACCESS_LABELS).map((key) => (
                                        <label
                                            key={key}
                                            className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={Boolean(draft.access?.[key])}
                                                onChange={(e) =>
                                                    setDraft((prev) => ({
                                                        ...prev,
                                                        access: {
                                                            ...prev.access,
                                                            [key]: e.target.checked,
                                                        },
                                                    }))
                                                }
                                                className="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500"
                                            />
                                            <span>{ACCESS_LABELS[key] || key}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-neutral-200 flex items-center justify-end gap-2 bg-neutral-50/80">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-neutral-600 bg-neutral-200/80 hover:bg-neutral-300 rounded-xl font-semibold transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-1.5 text-white bg-orange-600 hover:bg-orange-700 rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Save Staff Updates</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
