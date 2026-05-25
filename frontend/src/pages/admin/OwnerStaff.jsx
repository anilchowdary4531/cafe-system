import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    KeyRound,
    LoaderCircle,
    RefreshCcw,
    Search,
    ShieldCheck,
    Trash2,
    UserPlus,
    UserRoundCheck,
    UserRoundX,
} from "lucide-react";
import { API } from "../../config";

const STAFF_ROLES = ["MANAGER", "WAITER", "CHEF", "CASHIER", "STAFF"];
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

export default function OwnerStaff() {
    const [users, setUsers] = useState([]);
    const [modules, setModules] = useState(Object.keys(ACCESS_LABELS));
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [savingAccessFor, setSavingAccessFor] = useState(null);
    const [updatingStatusFor, setUpdatingStatusFor] = useState(null);
    const [deletingFor, setDeletingFor] = useState(null);
    const [error, setError] = useState("");
    const [selectedAccessUserId, setSelectedAccessUserId] = useState(null);
    const [accessDraft, setAccessDraft] = useState({});

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "STAFF",
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

    const loadStaff = async ({ silent = false } = {}) => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to owner account.");
            return;
        }

        try {
            if (silent) setRefreshing(true);
            else setLoading(true);

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
            setRefreshing(false);
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

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.phone || !form.password) {
            setError("Name, email, phone, and password are required.");
            return;
        }

        try {
            setCreating(true);
            setError("");

            await axios.post(`${API}/owner/${restaurantId}/staff`, {
                ...form,
                role: String(form.role).toUpperCase(),
            });

            setForm({
                name: "",
                email: "",
                phone: "",
                password: "",
                role: "STAFF",
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

    return (
        <section className="space-y-5">
            <article className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#121426] via-[#1a1d33] to-[#10253a] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-violet-300">
                            Staff Control Center
                        </p>
                        <h3 className="mt-1 text-3xl font-bold">Staff & Access</h3>
                        <p className="mt-1 text-sm text-slate-300">
                            Create staff, manage active state, delegate module-level access, and monitor all users.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadStaff({ silent: true })}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-sm text-cyan-200"
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                            <RefreshCcw size={14} />
                        )}
                        Refresh
                    </button>
                </div>
            </article>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <h4 className="mb-3 flex items-center gap-2 text-lg font-semibold">
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
                        value={form.role}
                        onChange={(e) => {
                            const role = e.target.value;
                            setForm((prev) => ({
                                ...prev,
                                role,
                                access: defaultAccessByRole(role),
                            }));
                        }}
                        className="rounded-lg bg-[#0f172a] px-3 py-2 outline-none"
                    >
                        {STAFF_ROLES.map((role) => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
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

                <div className="mt-3 rounded-lg border border-white/10 bg-[#0f172a] p-3">
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
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h4 className="text-lg font-semibold">Staff Directory</h4>
                    <div className="flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 md:w-96">
                        <Search size={15} className="text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, email, phone, role..."
                            className="w-full bg-transparent text-sm outline-none"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4 text-sm text-gray-400">
                        Loading staff...
                    </div>
                ) : (
                    <div className="space-y-3">
                        {users.map((staffUser) => {
                            const open = selectedAccessUserId === staffUser.id;
                            return (
                                <div key={staffUser.id} className="rounded-xl border border-white/10 bg-[#0f172a] p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-base font-semibold">{staffUser.name}</p>
                                                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs text-violet-200">
                                                    {staffUser.role}
                                                </span>
                                                <span
                                                    className={`rounded px-2 py-0.5 text-xs ${
                                                        staffUser.isActive
                                                            ? "bg-emerald-500/20 text-emerald-200"
                                                            : "bg-gray-500/20 text-gray-300"
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
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleStaffStatus(staffUser)}
                                                disabled={
                                                    updatingStatusFor === staffUser.id ||
                                                    staffUser.role === "OWNER"
                                                }
                                                className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-60"
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
                                                onClick={() => openAccessPanel(staffUser)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs text-indigo-200"
                                            >
                                                <ShieldCheck size={13} />
                                                Delegate Access
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteStaff(staffUser)}
                                                disabled={deletingFor === staffUser.id || staffUser.role === "OWNER"}
                                                className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-200 disabled:opacity-60"
                                            >
                                                <Trash2 size={13} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    {open && (
                                        <div className="mt-4 rounded-lg border border-white/10 bg-[#111827] p-3">
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
                            <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4 text-sm text-gray-400">
                                No staff users found.
                            </div>
                        )}
                    </div>
                )}
            </article>
        </section>
    );
}
