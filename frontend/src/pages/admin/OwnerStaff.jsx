import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    MoreVertical,
    Pencil,
    KeyRound,
    LoaderCircle,
    Search,
    ShieldCheck,
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

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = Number(user?.restaurantId);
    const restaurantName = String(user?.restaurant?.name || user?.restaurantName || "your restaurant").trim() || "your restaurant";

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

    return (
        <section className="space-y-5">
            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {showAddStaffForm && (
                <article className="p-1">
                    <>
                        <h4 className="mb-3 mt-4 flex items-center gap-2 text-lg font-semibold">
                            <UserPlus size={18} className="text-orange-300" />
                            Add New Staff
                        </h4>
                        <form onSubmit={handleCreate} className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            <input
                                placeholder="Full name"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={form.email}
                                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                            />
                            <input
                                placeholder="Phone number"
                                value={form.phone}
                                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={form.password}
                                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                            />
                            <select
                                value={form.designationOption}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        designationOption: e.target.value,
                                    }))
                                }
                                className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
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
                                    className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                                />
                            )}
                            <label className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-gray-300">
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
                                className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-70"
                            >
                                {creating ? "Creating..." : "Create Staff User"}
                            </button>
                        </form>

                        <div className="mt-3 p-1">
                            <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                                Initial Access Template
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                                {Object.keys(form.access).map((key) => (
                                    <label key={key} className="flex items-center gap-2 text-xs text-gray-300">
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
                    </>
                </article>
            )}

            <article className="p-1">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h4 className="text-lg font-semibold">Staff Directory</h4>
                    <div className="flex w-full items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2">
                            <Search size={15} className="text-gray-400" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, email, phone, role, designation..."
                                className="w-full bg-transparent text-sm outline-none"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddStaffForm((prev) => !prev)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black"
                        >
                            <UserPlus size={16} />
                            {showAddStaffForm ? "Hide Add New Staff" : "Add New Staff"}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-1 text-sm text-gray-400">
                        Loading staff...
                    </div>
                ) : (
                    <div className="space-y-3">
                        {users.map((staffUser) => {
                            const open = selectedAccessUserId === staffUser.id;
                            const isEditing = editingStaffId === staffUser.id;
                            const staffLoginLink = getStaffLoginLink(staffUser);
                            return (
                                <div key={staffUser.id} className="relative p-4 pr-14">
                                    <div className="flex flex-col gap-3">
                                        <div>
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="grid gap-2 md:grid-cols-2">
                                                        <input
                                                            value={editDraft.name}
                                                            onChange={(e) =>
                                                                setEditDraft((prev) => ({
                                                                    ...prev,
                                                                    name: e.target.value,
                                                                }))
                                                            }
                                                            placeholder="Full name"
                                                            className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm outline-none"
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
                                                            className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm outline-none"
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
                                                            className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm outline-none"
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
                                                            className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => saveEditedRow(staffUser)}
                                                            disabled={savingEditFor === staffUser.id}
                                                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                                                        >
                                                            {savingEditFor === staffUser.id ? "Saving..." : "Save"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelEditRow}
                                                            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-base font-semibold">{staffUser.name}</p>
                                                        <span className="theme-staff-role-pill rounded-full px-2 py-0.5 text-xs font-semibold">
                                                            {resolveDesignation(staffUser)}
                                                        </span>
                                                        <span
                                                            className={`theme-staff-status-pill rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                                staffUser.isActive
                                                                    ? "is-active"
                                                                    : "is-disabled"
                                                            }`}
                                                        >
                                                            {staffUser.isActive ? "ACTIVE" : "DISABLED"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-gray-400">{staffUser.email}</p>
                                                    <p className="text-xs text-gray-400">{staffUser.phone || "-"}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Created {new Date(staffUser.createdAt).toLocaleString()}
                                                    </p>
                                                    <div className="mt-3 text-sm leading-7">
                                                        <a
                                                            href={staffLoginLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="break-all font-medium text-[color:var(--app-text)] underline decoration-dotted decoration-[color:var(--app-primary)] underline-offset-4 transition hover:text-[color:var(--app-primary)]"
                                                            title="Open one-click staff login"
                                                        >
                                                            {staffLoginLink}
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyStaffLoginLink(staffUser)}
                                                            className="ml-3 inline text-[color:var(--app-primary)] underline decoration-dotted underline-offset-4 transition hover:opacity-80"
                                                        >
                                                            Copy
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => shareStaffLoginOnWhatsApp(staffUser)}
                                                            className="ml-3 inline text-[color:var(--app-muted-strong)] underline decoration-dotted underline-offset-4 transition hover:text-[color:var(--app-text)]"
                                                        >
                                                            WhatsApp
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="absolute right-4 top-4" data-staff-actions-menu>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOpenActionMenuFor((prev) =>
                                                        prev === staffUser.id ? null : staffUser.id
                                                    )
                                                }
                                                className="inline-flex items-center justify-center rounded-lg bg-[#111827] p-2 text-gray-200 hover:bg-[#1b2438]"
                                                aria-label="Open staff actions"
                                            >
                                                <MoreVertical size={16} />
                                            </button>

                                            {openActionMenuFor === staffUser.id && (
                                                <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-white/10 bg-[#111827] p-1 shadow-xl">
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditRow(staffUser)}
                                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-500/10"
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
                                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
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
                                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-indigo-200 hover:bg-indigo-500/10"
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
                                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                                                    >
                                                        <Trash2 size={13} />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {open && !isEditing && (
                                        <div className="mt-4 p-3">
                                            <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                                                Module Access
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                                                {modules.map((moduleKey) => (
                                                    <label key={moduleKey} className="flex items-center gap-2 text-xs text-gray-300">
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
                                                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs"
                                                >
                                                    Close
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveAccess(staffUser.id)}
                                                    disabled={savingAccessFor === staffUser.id || staffUser.role === "OWNER"}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
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
                            <div className="p-1 text-sm text-gray-400">
                                No staff users found.
                            </div>
                        )}
                    </div>
                )}
            </article>
        </section>
    );
}
