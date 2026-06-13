import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    ChevronDown,
    ChevronUp,
    Copy,
    Link2,
    MoreVertical,
    Pencil,
    KeyRound,
    LoaderCircle,
    Search,
    ShieldCheck,
    Share2,
    Trash2,
    UserPlus,
    UserRoundCheck,
    UserRoundX,
} from "lucide-react";
import { API } from "../../config";
import { showToast } from "../../utils/toast";

const DESIGNATION_OPTIONS = [
    "Chef",
    "Senior Chef",
    "Server",
    "Swiper",
    "Manager",
    "Cashier",
    "Steward",
    "Cleaner",
];
const DEFAULT_DESIGNATION_BY_ROLE = {
    MANAGER: "Manager",
    WAITER: "Server",
    CHEF: "Chef",
    CASHIER: "Cashier",
    STAFF: "Staff",
};
const ACCESS_LABELS = {
    dashboard: "Dashboard",
    orders: "Orders",
    menu: "Menu",
    tables: "Tables",
    kitchen: "Kitchen",
    analytics: "Analytics",
    finance: "Finance",
    staff: "Staff",
    settings: "Settings",
    notifications: "Notifications",
};
const INPUT_CLASS = "theme-input w-full rounded-xl px-3 py-3 text-sm outline-none transition";
const COMPACT_INPUT_CLASS = "theme-input w-full rounded-xl px-3 py-2 text-sm outline-none transition";
const ACTION_MENU_ITEM_CLASS =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-[color:color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface)_90%)]";
const readStoredUser = () => {
    if (typeof window === "undefined") return {};
    try {
        return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
        return {};
    }
};

const defaultAccessByRole = (role) => {
    const normalizedRole = String(role || "STAFF").toUpperCase();
    if (normalizedRole === "MANAGER") {
        return {
            dashboard: true,
            orders: true,
            menu: true,
            tables: true,
            kitchen: true,
            analytics: true,
            finance: false,
            staff: false,
            settings: false,
            notifications: true,
        };
    }
    if (normalizedRole === "CHEF") {
        return {
            dashboard: true,
            orders: true,
            menu: false,
            tables: false,
            kitchen: true,
            analytics: false,
            finance: false,
            staff: false,
            settings: false,
            notifications: true,
        };
    }
    if (normalizedRole === "WAITER") {
        return {
            dashboard: true,
            orders: true,
            menu: true,
            tables: true,
            kitchen: false,
            analytics: false,
            finance: false,
            staff: false,
            settings: false,
            notifications: true,
        };
    }
    if (normalizedRole === "CASHIER") {
        return {
            dashboard: true,
            orders: true,
            menu: false,
            tables: false,
            kitchen: false,
            analytics: true,
            finance: true,
            staff: false,
            settings: false,
            notifications: true,
        };
    }
    return {
        dashboard: true,
        orders: false,
        menu: false,
        tables: false,
        kitchen: false,
        analytics: false,
        finance: false,
        staff: false,
        settings: false,
        notifications: true,
    };
};

const getRoleDesignationFallback = (role) =>
    DEFAULT_DESIGNATION_BY_ROLE[String(role || "STAFF").toUpperCase()] || "Staff";

const resolveDesignation = (staffUser) => {
    const customDesignation = String(staffUser?.designation || "").trim();
    if (customDesignation) return customDesignation;
    return getRoleDesignationFallback(staffUser?.role);
};

const buildFallbackStaffLoginLink = (staffUser) => {
    const email = String(staffUser?.email || "").trim().toLowerCase();
    const params = new URLSearchParams({ mode: "staff" });
    if (email) params.set("email", email);

    const base = typeof window !== "undefined" ? window.location.origin : "";
    const path = `/login?${params.toString()}`;
    return base ? `${base}${path}` : path;
};

const getStaffLoginLink = (staffUser) => {
    const link = String(staffUser?.loginLink || "").trim();
    if (link) return link;
    return buildFallbackStaffLoginLink(staffUser);
};

const buildStaffLoginShareText = (staffUser, restaurantName, loginLink) => {
    const name = String(staffUser?.name || "there").trim() || "there";
    const restaurant = String(restaurantName || "your restaurant").trim() || "your restaurant";
    return `Hi ${name}, use this one-click staff login link for ${restaurant}: ${loginLink}`;
};

export default function OwnerStaff() {
    const [users, setUsers] = useState([]);
    const [modules, setModules] = useState(Object.keys(ACCESS_LABELS));
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [savingAccessFor, setSavingAccessFor] = useState(null);
    const [updatingStatusFor, setUpdatingStatusFor] = useState(null);
    const [deletingFor, setDeletingFor] = useState(null);
    const [error, setError] = useState("");
    const [selectedAccessUserId, setSelectedAccessUserId] = useState(null);
    const [accessDraft, setAccessDraft] = useState({});
    const [showAddStaffForm, setShowAddStaffForm] = useState(false);
    const [openActionMenuFor, setOpenActionMenuFor] = useState(null);
    const [expandedLinkIds, setExpandedLinkIds] = useState({});
    const [editingStaffId, setEditingStaffId] = useState(null);
    const [savingEditFor, setSavingEditFor] = useState(null);
    const [editDraft, setEditDraft] = useState({
        name: "",
        email: "",
        phone: "",
        designation: "",
    });

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "STAFF",
        designationOption: getRoleDesignationFallback("STAFF"),
        customDesignation: "",
        isActive: true,
        access: defaultAccessByRole("STAFF"),
    });

    const user = readStoredUser();

    const restaurantId = Number(user?.restaurantId);
    const restaurantName = String(user?.restaurant?.name || user?.restaurantName || "your restaurant").trim() || "your restaurant";
    const activeUsersCount = useMemo(() => users.filter((staffUser) => staffUser.isActive).length, [users]);

    const loadStaff = async ({ silent = false } = {}) => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to owner account.");
            return;
        }

        try {
            setLoading((prev) => (silent ? prev : true));

            const res = await axios.get(`${API}/owner/${restaurantId}/staff`, {
                params: query ? { q: query } : {},
            });
            setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
            setModules(Array.isArray(res.data?.modules) ? res.data.modules : Object.keys(ACCESS_LABELS));
            setError("");
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to load staff users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStaff();
    }, [restaurantId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadStaff({ silent: true });
        }, 350);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!openActionMenuFor) return undefined;
        const handleOutsideClick = (event) => {
            if (event.target.closest("[data-staff-actions-menu]")) return;
            setOpenActionMenuFor(null);
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [openActionMenuFor]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.phone || !form.password) {
            setError("Name, email, phone, and password are required.");
            return;
        }
        const designation =
            form.designationOption === "OTHER"
                ? String(form.customDesignation || "").trim()
                : String(form.designationOption || "").trim();
        if (!designation) {
            setError("Designation is required.");
            return;
        }

        try {
            setCreating(true);
            setError("");

            await axios.post(`${API}/owner/${restaurantId}/staff`, {
                ...form,
                role: String(form.role).toUpperCase(),
                designation,
            });

            setForm({
                name: "",
                email: "",
                phone: "",
                password: "",
                role: "STAFF",
                designationOption: getRoleDesignationFallback("STAFF"),
                customDesignation: "",
                isActive: true,
                access: defaultAccessByRole("STAFF"),
            });
            await loadStaff({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to create staff user.");
        } finally {
            setCreating(false);
        }
    };

    const toggleStaffStatus = async (staffUser) => {
        try {
            setUpdatingStatusFor(staffUser.id);
            await axios.patch(`${API}/owner/${restaurantId}/staff/${staffUser.id}/status`, {
                isActive: !staffUser.isActive,
            });
            await loadStaff({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to update status.");
        } finally {
            setUpdatingStatusFor(null);
        }
    };

    const deleteStaff = async (staffUser) => {
        try {
            setDeletingFor(staffUser.id);
            await axios.delete(`${API}/owner/${restaurantId}/staff/${staffUser.id}`);
            if (selectedAccessUserId === staffUser.id) {
                setSelectedAccessUserId(null);
                setAccessDraft({});
            }
            await loadStaff({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to delete staff.");
        } finally {
            setDeletingFor(null);
        }
    };

    const openAccessPanel = (staffUser) => {
        setSelectedAccessUserId(staffUser.id);
        setAccessDraft(staffUser.access || defaultAccessByRole(staffUser.role));
    };

    const startEditRow = (staffUser) => {
        setOpenActionMenuFor(null);
        setSelectedAccessUserId(null);
        setEditingStaffId(staffUser.id);
        setEditDraft({
            name: String(staffUser?.name || ""),
            email: String(staffUser?.email || ""),
            phone: String(staffUser?.phone || ""),
            designation: String(resolveDesignation(staffUser) || ""),
        });
    };

    const cancelEditRow = () => {
        setEditingStaffId(null);
        setEditDraft({
            name: "",
            email: "",
            phone: "",
            designation: "",
        });
    };

    const saveEditedRow = async (staffUser) => {
        const name = String(editDraft.name || "").trim();
        const email = String(editDraft.email || "").trim().toLowerCase();
        const phone = String(editDraft.phone || "").trim();
        const designation = String(editDraft.designation || "").trim();

        if (!name || !email) {
            setError("Name and email are required to update staff.");
            return;
        }

        try {
            setSavingEditFor(staffUser.id);
            setError("");
            await axios.put(`${API}/owner/${restaurantId}/staff/${staffUser.id}`, {
                name,
                email,
                phone,
                designation,
            });
            cancelEditRow();
            await loadStaff({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to update staff user.");
        } finally {
            setSavingEditFor(null);
        }
    };

    const saveAccess = async (staffUserId) => {
        try {
            setSavingAccessFor(staffUserId);
            await axios.put(`${API}/owner/${restaurantId}/staff/${staffUserId}/access`, {
                access: accessDraft,
            });
            await loadStaff({ silent: true });
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to save access.");
        } finally {
            setSavingAccessFor(null);
        }
    };

    const copyStaffLoginLink = async (staffUser) => {
        const loginLink = getStaffLoginLink(staffUser);
        try {
            await navigator.clipboard.writeText(loginLink);
            showToast({
                title: "Login link copied",
                message: `${staffUser?.name || "Staff"} can be shared on WhatsApp now.`,
                variant: "success",
            });
        } catch {
            showToast({
                title: "Copy failed",
                message: "Your browser blocked clipboard access.",
                variant: "error",
            });
        }
    };

    const shareStaffLoginOnWhatsApp = (staffUser) => {
        const loginLink = getStaffLoginLink(staffUser);
        const message = buildStaffLoginShareText(staffUser, restaurantName, loginLink);
        const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        const popup = window.open(shareUrl, "_blank", "noopener,noreferrer");

        if (!popup) {
            showToast({
                title: "WhatsApp blocked",
                message: "Allow pop-ups to open WhatsApp sharing.",
                variant: "error",
            });
            return;
        }

        showToast({
            title: "WhatsApp ready",
            message: `Prepared a share message for ${staffUser?.name || "staff"}.`,
            variant: "success",
        });
    };

    const toggleStaffLoginLink = (staffUserId) => {
        setExpandedLinkIds((prev) => ({
            ...prev,
            [staffUserId]: !prev[staffUserId],
        }));
    };

    return (
        <section className="space-y-6">
            {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <article className="border-b border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] pb-5 sm:pb-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.95fr)] lg:items-end">
                    <div className="max-w-2xl space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted-strong)]">
                            Team control center
                        </p>
                        <div>
                            <h4 className="text-2xl font-bold sm:text-3xl">Staff Directory</h4>
                            <p className="mt-2 max-w-2xl text-sm text-[color:var(--app-muted-strong)]">
                                Manage staff accounts, update access, and share login links without exposing the
                                full URL by default.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[color:var(--app-muted-strong)]">
                            <span>Total {users.length}</span>
                            <span>Active {activeUsersCount}</span>
                            <span>Hidden links by default</span>
                        </div>
                    </div>

                    <div className="flex w-full flex-col gap-3">
                        <div className="flex items-center gap-2 border-b border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] px-1 pb-2">
                            <Search size={16} className="shrink-0 text-[color:var(--app-muted)]" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, email, phone, role, designation..."
                                className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--app-muted)]"
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-[color:var(--app-muted-strong)]">
                                Search by name, email, phone, role, or designation.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowAddStaffForm((prev) => !prev)}
                                className="inline-flex items-center gap-2 self-start text-sm font-semibold text-[color:var(--app-primary)] transition hover:text-[color:var(--app-primary-hover)]"
                            >
                                <UserPlus size={16} />
                                {showAddStaffForm ? "Hide Add New Staff" : "Add New Staff"}
                            </button>
                        </div>
                    </div>
                </div>
            </article>

            {showAddStaffForm && (
                <article className="theme-card rounded-[28px] border p-5 sm:p-6">
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--app-primary)_18%,transparent)] text-[color:var(--app-primary)]">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold">Add New Staff</h4>
                            <p className="text-sm text-[color:var(--app-muted-strong)]">
                                Create a new account and assign the first access template.
                            </p>
                        </div>
                    </div>
                    <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <input
                            placeholder="Full name"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={form.email}
                            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <input
                            placeholder="Phone number"
                            value={form.phone}
                            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                            className={INPUT_CLASS}
                        />
                        <select
                            value={form.designationOption}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    designationOption: e.target.value,
                                }))
                            }
                            className={INPUT_CLASS}
                        >
                            {DESIGNATION_OPTIONS.map((designation) => (
                                <option key={designation} value={designation}>
                                    {designation}
                                </option>
                            ))}
                            <option value="OTHER">Other (Custom)</option>
                        </select>
                        {form.designationOption === "OTHER" && (
                            <input
                                placeholder="Custom designation"
                                value={form.customDesignation}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        customDesignation: e.target.value,
                                    }))
                                }
                                className={INPUT_CLASS}
                            />
                        )}
                        <label className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-input)] px-3 py-3 text-sm text-[color:var(--app-muted-strong)]">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                            />
                            Active account
                        </label>
                        <button
                            type="submit"
                            disabled={creating}
                            className="theme-button rounded-xl px-4 py-3 font-semibold disabled:opacity-70"
                        >
                            {creating ? "Creating..." : "Create Staff User"}
                        </button>
                    </form>

                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_92%,transparent)] p-4">
                        <p className="mb-2 text-xs uppercase tracking-wide text-[color:var(--app-muted-strong)]">
                            Initial Access Template
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                            {Object.keys(form.access).map((key) => (
                                <label key={key} className="flex items-center gap-2 text-xs text-[color:var(--app-muted-strong)]">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(form.access[key])}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                access: { ...prev.access, [key]: e.target.checked },
                                            }))
                                        }
                                    />
                                    {ACCESS_LABELS[key] || key}
                                </label>
                            ))}
                        </div>
                    </div>
                </article>
            )}

            <article className="theme-card rounded-[28px] border p-5 sm:p-6">
                {loading ? (
                    <div className="p-1 text-sm text-[color:var(--app-muted-strong)]">
                        Loading staff...
                    </div>
                ) : (
                    <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
                        {users.map((staffUser) => {
                            const open = selectedAccessUserId === staffUser.id;
                            const isEditing = editingStaffId === staffUser.id;
                            const isLinkExpanded = Boolean(expandedLinkIds[staffUser.id]);
                            const staffLoginLink = getStaffLoginLink(staffUser);
                            return (
                                <div
                                    key={staffUser.id}
                                    className="relative h-full border-b border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] py-4"
                                >
                                    <div className="relative pr-14 sm:pr-44">
                                        <div className="min-w-0">
                                            <div className="min-w-0 flex-1">
                                                {isEditing ? (
                                                    <div className="space-y-3">
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <input
                                                                value={editDraft.name}
                                                                onChange={(e) =>
                                                                    setEditDraft((prev) => ({
                                                                        ...prev,
                                                                        name: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Full name"
                                                                className={COMPACT_INPUT_CLASS}
                                                            />
                                                            <input
                                                                value={editDraft.designation}
                                                                onChange={(e) =>
                                                                    setEditDraft((prev) => ({
                                                                        ...prev,
                                                                        designation: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Designation"
                                                                className={COMPACT_INPUT_CLASS}
                                                            />
                                                            <input
                                                                type="email"
                                                                value={editDraft.email}
                                                                onChange={(e) =>
                                                                    setEditDraft((prev) => ({
                                                                        ...prev,
                                                                        email: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Email"
                                                                className={COMPACT_INPUT_CLASS}
                                                            />
                                                            <input
                                                                value={editDraft.phone}
                                                                onChange={(e) =>
                                                                    setEditDraft((prev) => ({
                                                                        ...prev,
                                                                        phone: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Phone"
                                                                className={COMPACT_INPUT_CLASS}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => saveEditedRow(staffUser)}
                                                                disabled={savingEditFor === staffUser.id}
                                                                className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
                                                            >
                                                                {savingEditFor === staffUser.id ? "Saving..." : "Save"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditRow}
                                                                className="rounded-full border border-[var(--app-border)] px-3 py-2 text-xs"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-lg font-semibold leading-tight">{staffUser.name}</p>
                                                            <span className="theme-staff-role-pill rounded-full px-2.5 py-1 text-xs font-semibold">
                                                                {resolveDesignation(staffUser)}
                                                            </span>
                                                            <span
                                                                className={`theme-staff-status-pill rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                    staffUser.isActive
                                                                        ? "is-active"
                                                                        : "is-disabled"
                                                                }`}
                                                            >
                                                                {staffUser.isActive ? "ACTIVE" : "DISABLED"}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[color:var(--app-muted-strong)]">
                                                            <p className="truncate">{staffUser.email}</p>
                                                            <p>{staffUser.phone || "-"}</p>
                                                            <p>
                                                                Created {new Date(staffUser.createdAt).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="absolute right-0 top-0 flex items-start gap-2" data-staff-actions-menu>
                                                {!isEditing && (
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleStaffLoginLink(staffUser.id)}
                                                            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--app-muted-strong)] transition hover:text-[color:var(--app-primary)]"
                                                            aria-expanded={isLinkExpanded}
                                                        >
                                                            <Link2 size={14} />
                                                            {isLinkExpanded ? "Hide link" : "Reveal link"}
                                                            {isLinkExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>

                                                        <div
                                                            className={`absolute right-0 top-full z-20 overflow-hidden transition-all duration-300 ${
                                                                isLinkExpanded ? "mt-2 max-h-[420px] w-[280px] opacity-100 sm:w-[320px]" : "max-h-0 w-0 opacity-0"
                                                            }`}
                                                        >
                                                            <div className="rounded-2xl border border-[var(--app-border)] bg-[color:var(--app-surface)] p-3 shadow-2xl backdrop-blur">
                                                                <a
                                                                    href={staffLoginLink}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="block break-all font-mono text-[13px] text-[color:var(--app-text)] underline decoration-dotted decoration-[color:var(--app-primary)] underline-offset-4 transition hover:text-[color:var(--app-primary)]"
                                                                    title="Open one-click staff login"
                                                                >
                                                                    {staffLoginLink}
                                                                </a>
                                                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => copyStaffLoginLink(staffUser)}
                                                                        className="inline-flex items-center gap-1 text-sm text-[color:var(--app-muted-strong)] transition hover:text-[color:var(--app-primary)]"
                                                                    >
                                                                        <Copy size={13} />
                                                                        Copy
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => shareStaffLoginOnWhatsApp(staffUser)}
                                                                        className="inline-flex items-center gap-1 text-sm text-[color:var(--app-muted-strong)] transition hover:text-[color:var(--app-primary)]"
                                                                    >
                                                                        <Share2 size={13} />
                                                                        WhatsApp
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setOpenActionMenuFor((prev) =>
                                                                prev === staffUser.id ? null : staffUser.id
                                                            )
                                                        }
                                                        className="theme-icon-button inline-flex items-center justify-center rounded-xl p-2 shadow-sm"
                                                        aria-label="Open staff actions"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>

                                                    {openActionMenuFor === staffUser.id && (
                                                        <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-[var(--app-border)] bg-[color:var(--app-surface)] p-2 shadow-2xl backdrop-blur">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditRow(staffUser)}
                                                                className={ACTION_MENU_ITEM_CLASS}
                                                            >
                                                                <Pencil size={13} />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionMenuFor(null);
                                                                    toggleStaffStatus(staffUser);
                                                                }}
                                                                disabled={
                                                                    updatingStatusFor === staffUser.id ||
                                                                    staffUser.role === "OWNER"
                                                                }
                                                                className={`${ACTION_MENU_ITEM_CLASS} disabled:opacity-60`}
                                                            >
                                                                {staffUser.isActive ? (
                                                                    <UserRoundX size={13} />
                                                                ) : (
                                                                    <UserRoundCheck size={13} />
                                                                )}
                                                                {staffUser.isActive ? "Disable" : "Enable"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionMenuFor(null);
                                                                    openAccessPanel(staffUser);
                                                                }}
                                                                className={ACTION_MENU_ITEM_CLASS}
                                                            >
                                                                <ShieldCheck size={13} />
                                                                Delegate Access
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionMenuFor(null);
                                                                    deleteStaff(staffUser);
                                                                }}
                                                                disabled={deletingFor === staffUser.id || staffUser.role === "OWNER"}
                                                                className={`${ACTION_MENU_ITEM_CLASS} disabled:opacity-60`}
                                                            >
                                                                <Trash2 size={13} />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {open && !isEditing && (
                                        <div className="mt-3 border-t border-dashed border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] pt-3">
                                            <p className="mb-3 text-xs uppercase tracking-wide text-[color:var(--app-muted-strong)]">
                                                Module Access
                                            </p>
                                            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                                                {modules.map((moduleKey) => (
                                                    <label
                                                        key={moduleKey}
                                                        className="flex items-center gap-2 text-xs text-[color:var(--app-muted-strong)]"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(accessDraft[moduleKey])}
                                                            disabled={staffUser.role === "OWNER"}
                                                            onChange={(e) =>
                                                                setAccessDraft((prev) => ({
                                                                    ...prev,
                                                                    [moduleKey]: e.target.checked,
                                                                }))
                                                            }
                                                        />
                                                        {ACCESS_LABELS[moduleKey] || moduleKey}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="mt-3 flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAccessUserId(null)}
                                                    className="text-xs text-[color:var(--app-muted-strong)] transition hover:text-[color:var(--app-text)]"
                                                >
                                                    Close
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveAccess(staffUser.id)}
                                                    disabled={savingAccessFor === staffUser.id || staffUser.role === "OWNER"}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--app-primary)] disabled:opacity-60"
                                                >
                                                    {savingAccessFor === staffUser.id ? (
                                                        <LoaderCircle size={13} className="animate-spin" />
                                                    ) : (
                                                        <KeyRound size={13} />
                                                    )}
                                                    Save Access
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {users.length === 0 && (
                            <div className="p-1 text-sm text-[color:var(--app-muted-strong)]">
                                No staff users found.
                            </div>
                        )}
                    </div>
                )}
            </article>
        </section>
    );
}
