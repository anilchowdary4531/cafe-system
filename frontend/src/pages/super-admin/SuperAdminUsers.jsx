import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    LayoutDashboard,
    Menu,
    Search,
    Settings,
    Store,
    Users,
    X,
    Coins,
    ShieldCheck,
    Calendar,
    Sparkles,
    Trash2,
    Image as ImageIcon,
    Utensils,
    UserCheck,
    Wallet,
    Globe,
    Filter,
    ArrowUpRight
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api, cachedGet } from "../../utils/apiClient";
import { showToast } from "../../utils/toast";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import SuperAdminSidebar from "../../components/super-admin/SuperAdminSidebar";

const formatPhone = (raw) => {
    const s = String(raw || "").trim();
    if (!s || s.includes("@") || s.startsWith("google_") || /[a-zA-Z]/.test(s)) {
        return "Not set";
    }
    const digits = s.replace(/[^\d]/g, "");
    if (digits.length < 7) return "Not set";
    return s;
};

export default function SuperAdminUsers() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    // Determine initial tab from pathname or query params
    const getInitialTab = () => {
        if (location.pathname.includes("/staff")) return "staff";
        if (location.pathname.includes("/customers")) return "customers";
        return "all";
    };

    const [activeTab, setActiveTab] = useState(getInitialTab());

    const [allUsers, setAllUsers] = useState([]);
    const [allUsersSummary, setAllUsersSummary] = useState(null);

    const [restaurants, setRestaurants] = useState([]);
    const [staffSummary, setStaffSummary] = useState(null);

    const [customers, setCustomers] = useState([]);
    const [customerSummary, setCustomerSummary] = useState(null);

    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeMenuKey, setActiveMenuKey] = useState("users");

    const [deleteModalCustomer, setDeleteModalCustomer] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const confirmDeleteCustomer = async () => {
        if (!deleteModalCustomer?.rawId && !deleteModalCustomer?.id) return;
        const targetId = deleteModalCustomer.rawId || deleteModalCustomer.id;
        try {
            setDeleting(true);
            await api.delete(`/super-admin/customers/${targetId}`);
            setCustomers((prev) => prev.filter((c) => c.id !== targetId));
            setAllUsers((prev) => prev.filter((u) => u.rawId !== targetId || u.userType !== "CUSTOMER"));
            showToast({
                title: "User Account Deleted",
                message: `Account '${deleteModalCustomer.name}' has been permanently deleted.`,
                variant: "success",
            });
            setDeleteModalCustomer(null);
        } catch (err) {
            showToast({
                title: "Delete Failed",
                message: err.response?.data?.message || "Failed to delete user account",
                variant: "error",
            });
        } finally {
            setDeleting(false);
        }
    };

    // Load All Users
    const loadAllUsers = async (search = query) => {
        try {
            setLoading(true);
            const data = await cachedGet("/super-admin/all-users", {
                params: search ? { q: search } : {},
                ttlMs: 5_000,
                staleMs: 30_000,
                scope: "auth",
            });
            setAllUsers(data?.users || []);
            setAllUsersSummary(data?.summary || null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load all platform users");
        } finally {
            setLoading(false);
        }
    };

    // Load Staff Data
    const loadStaff = async (search = query) => {
        try {
            setLoading(true);
            const data = await cachedGet("/super-admin/staff", {
                params: search ? { q: search } : {},
                ttlMs: 5_000,
                staleMs: 30_000,
                scope: "auth",
            });
            setRestaurants(data?.restaurants || []);
            setStaffSummary(data?.summary || null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load restaurant staff");
        } finally {
            setLoading(false);
        }
    };

    // Load Customers Data
    const loadCustomers = async (search = query) => {
        try {
            setLoading(true);
            const data = await cachedGet("/super-admin/customers", {
                params: search ? { q: search } : {},
                ttlMs: 5_000,
                staleMs: 30_000,
                scope: "auth",
            });
            setCustomers(data?.customers || []);
            setCustomerSummary(data?.summary || null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load registered customers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "all") {
            loadAllUsers("");
        } else if (activeTab === "staff") {
            loadStaff("");
        } else {
            loadCustomers("");
        }
    }, [activeTab]);

    useEffect(() => {
        if (!sidebarOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [sidebarOpen]);

    const handleMenuClick = (item) => {
        setActiveMenuKey(item.key);
        setSidebarOpen(false);
        navigate(item.to);
    };

    const handleTabSwitch = (tab) => {
        setActiveTab(tab);
        setQuery("");
        setRoleFilter("ALL");
        if (tab === "staff") {
            navigate("/super-admin/staff");
        } else if (tab === "customers") {
            navigate("/super-admin/customers");
        } else {
            navigate("/super-admin/users");
        }
    };

    const getRoleBadgeStyle = (role) => {
        switch (String(role || "").toUpperCase()) {
            case "SUPER_ADMIN":
                return "bg-amber-500/20 text-amber-300 border-amber-500/40 font-black";
            case "OWNER":
                return "bg-[#ff8a1f]/20 text-[#ff8a1f] border-[#ff8a1f]/40 font-bold";
            case "MANAGER":
                return "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold";
            case "CHEF":
                return "bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold";
            case "CASHIER":
                return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold";
            case "WAITER":
                return "bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold";
            case "CUSTOMER":
                return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold";
            default:
                return "bg-slate-500/20 text-slate-300 border-slate-500/40 font-bold";
        }
    };

    const filteredAllUsers = allUsers.filter((u) => {
        if (roleFilter === "ALL") return true;
        return String(u.role || "").toUpperCase() === roleFilter;
    });

    return (
        <div className="theme-page min-h-screen">
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey="users" />

            {/* HEADER */}
            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                            <Menu size={16} />
                            Tiffzy
                        </button>
                        <div className="flex h-12 w-12 -rotate-2 items-center justify-center overflow-hidden rounded-md border border-[#d9c8af] bg-transparent p-0.5 shadow-[0_3px_8px_rgba(88,61,36,0.14)]">
                            <img src={tiffzyLogo} alt="Tiffzy logo" className="h-full w-full object-contain mix-blend-multiply" />
                        </div>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.28em]">Super Admin</p>
                            <h1 className="text-2xl font-bold">
                                {activeTab === "all"
                                    ? "All Platform Users"
                                    : activeTab === "staff"
                                    ? "Restaurant Staff"
                                    : "Customer Accounts"}
                            </h1>
                            <p className="theme-muted text-sm">{user?.email || "admin@tiffzy.com"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 space-y-6">
                {error && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {/* TAB SWITCHER */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 max-w-2xl">
                    <button
                        type="button"
                        onClick={() => handleTabSwitch("all")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === "all" ? "bg-amber-500 text-black shadow-md" : "theme-muted hover:theme-text"}`}
                    >
                        <Globe size={16} />
                        All Users ({allUsersSummary?.totalUsers || allUsers.length || "..."})
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabSwitch("staff")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === "staff" ? "bg-amber-500 text-black shadow-md" : "theme-muted hover:theme-text"}`}
                    >
                        <UserCheck size={16} />
                        Staff Under Restaurants
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabSwitch("customers")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTab === "customers" ? "bg-amber-500 text-black shadow-md" : "theme-muted hover:theme-text"}`}
                    >
                        <Users size={16} />
                        Registered Customers
                    </button>
                </div>

                {/* TAB 1: ALL PLATFORM USERS */}
                {activeTab === "all" ? (
                    <section className="theme-panel rounded-3xl p-5 space-y-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Globe className="text-amber-500" size={24} />
                                    <h2 className="text-xl font-bold">All Platform Accounts & Users</h2>
                                </div>
                                <p className="theme-muted mt-1 text-sm">
                                    Comprehensive view of all {allUsersSummary?.totalUsers || allUsers.length} accounts across Super Admins, Owners, Staff, and Customers.
                                </p>
                            </div>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    loadAllUsers(query);
                                }}
                                className="theme-input flex items-center gap-2 rounded-2xl px-3 py-2 md:w-80"
                            >
                                <Search size={16} className="theme-muted" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search all users by name, email, phone, role..."
                                    className="w-full bg-transparent text-sm outline-none"
                                />
                            </form>
                        </div>

                        {/* METRICS ROW */}
                        {allUsersSummary ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="theme-card rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                    <p className="theme-muted text-xs uppercase tracking-wider font-bold">Total Users</p>
                                    <p className="mt-1 text-2xl font-black text-amber-500">{allUsersSummary.totalUsers}</p>
                                </div>
                                <div className="theme-card rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                    <p className="theme-muted text-xs uppercase tracking-wider font-bold">Restaurant Staff</p>
                                    <p className="mt-1 text-2xl font-black text-purple-400">{allUsersSummary.staffCount}</p>
                                </div>
                                <div className="theme-card rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                    <p className="theme-muted text-xs uppercase tracking-wider font-bold">Customers</p>
                                    <p className="mt-1 text-2xl font-black text-cyan-400">{allUsersSummary.customerCount}</p>
                                </div>
                                <div className="theme-card rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                    <p className="theme-muted text-xs uppercase tracking-wider font-bold">Restaurant Owners</p>
                                    <p className="mt-1 text-2xl font-black text-emerald-400">{allUsersSummary.ownersCount}</p>
                                </div>
                            </div>
                        ) : null}

                        {/* ROLE FILTER PILLS */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <span className="theme-muted flex items-center gap-1 text-xs font-bold mr-1">
                                <Filter size={13} /> Filter:
                            </span>
                            {["ALL", "SUPER_ADMIN", "OWNER", "MANAGER", "CHEF", "CASHIER", "WAITER", "CUSTOMER"].map((role) => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => setRoleFilter(role)}
                                    className={`rounded-full px-3 py-1 text-xs font-extrabold transition whitespace-nowrap border ${
                                        roleFilter === role
                                            ? "bg-amber-500 text-black border-amber-500 shadow-sm"
                                            : "theme-soft-button border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    {role === "ALL" ? "All Roles" : role}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center flex items-center justify-center gap-2">
                                <Sparkles className="animate-spin text-amber-500" size={20} />
                                Loading all platform users...
                            </div>
                        ) : filteredAllUsers.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[750px] text-sm">
                                    <thead>
                                        <tr className="theme-muted text-left border-b border-black/10 dark:border-white/10 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-3 font-bold">User / Name</th>
                                            <th className="px-4 py-3 font-bold">Role & Type</th>
                                            <th className="px-4 py-3 font-bold">Affiliation</th>
                                            <th className="px-4 py-3 font-bold">Phone Number</th>
                                            <th className="px-4 py-3 font-bold">Email Address</th>
                                            <th className="px-4 py-3 font-bold">Joined Date</th>
                                            <th className="px-4 py-3 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAllUsers.map((u) => (
                                            <tr key={u.id} className="border-t theme-border hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <td className="px-4 py-3 font-bold">
                                                    <div className="flex items-center gap-2.5">
                                                        {u.avatarUrl ? (
                                                            <img
                                                                src={u.avatarUrl}
                                                                alt={u.name}
                                                                className="h-8 w-8 rounded-full object-cover border border-amber-500/30 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-black text-xs shrink-0">
                                                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                                                            </div>
                                                        )}
                                                        <span>{u.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${getRoleBadgeStyle(u.role)}`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {u.restaurant ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/super-admin/restaurant-profiles?slug=${u.restaurant.slug}`)}
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:underline"
                                                        >
                                                            <span>{u.restaurant.name}</span>
                                                            <ArrowUpRight size={12} />
                                                        </button>
                                                    ) : (
                                                        <span className="theme-muted text-xs">Platform Customer</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">{formatPhone(u.phone)}</td>
                                                <td className="px-4 py-3">{u.email}</td>
                                                <td className="px-4 py-3 theme-muted text-xs">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {u.userType === "CUSTOMER" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteModalCustomer(u)}
                                                            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-extrabold text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95"
                                                            title="Delete Customer Account"
                                                        >
                                                            <Trash2 size={13} />
                                                            <span>Delete</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-emerald-400">Active</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                                No user accounts found matching your query or filter.
                            </div>
                        )}
                    </section>
                ) : activeTab === "staff" ? (
                    /* TAB 2: STAFF UNDER RESTAURANTS */
                    <section className="theme-panel rounded-3xl p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <UserCheck className="text-amber-500" size={22} />
                                    <h2 className="text-xl font-bold">Staff Under Restaurants</h2>
                                </div>
                                <p className="theme-muted mt-1 text-sm">
                                    Showing {staffSummary?.staffCount || 0} staff members across {staffSummary?.restaurants || 0} restaurants.
                                </p>
                            </div>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    loadStaff(query);
                                }}
                                className="theme-input flex items-center gap-2 rounded-2xl px-3 py-2 md:w-80"
                            >
                                <Search size={16} className="theme-muted" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search staff or restaurant"
                                    className="w-full bg-transparent text-sm outline-none"
                                />
                            </form>
                        </div>

                        {loading ? (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center flex items-center justify-center gap-2">
                                <Sparkles className="animate-spin text-amber-500" size={20} />
                                Loading staff records...
                            </div>
                        ) : restaurants.length ? (
                            <div className="mt-5 grid gap-4">
                                {restaurants.map((restaurant) => (
                                    <article key={restaurant.id} className="theme-card rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                        <div className="flex items-start gap-3">
                                            <div className="theme-pill flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                                                {restaurant.logoUrl ? (
                                                    <img
                                                        src={resolveImageUrl(restaurant.logoUrl)}
                                                        alt={`${restaurant.name} logo`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Store size={20} className="theme-muted" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-bold">{restaurant.name}</h3>
                                                    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${restaurant.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                                        {restaurant.isActive ? "Active" : "Disabled"}
                                                    </span>
                                                </div>
                                                <p className="theme-muted mt-0.5 text-sm">/{restaurant.slug} - {restaurant.city || "City not set"}</p>
                                            </div>
                                        </div>

                                        {restaurant.users?.length ? (
                                            <div className="mt-4 overflow-x-auto">
                                                <table className="w-full min-w-[600px] text-sm">
                                                    <thead>
                                                        <tr className="theme-muted text-left border-b border-black/10 dark:border-white/10 text-xs uppercase tracking-wider">
                                                            <th className="px-3 py-2.5 font-bold">Role</th>
                                                            <th className="px-3 py-2.5 font-bold">Staff Name</th>
                                                            <th className="px-3 py-2.5 font-bold">Phone Number</th>
                                                            <th className="px-3 py-2.5 font-bold">Email</th>
                                                            <th className="px-3 py-2.5 font-bold text-right">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {restaurant.users.map((item) => (
                                                            <tr key={item.id} className="border-t theme-border hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                                <td className="px-3 py-2.5">
                                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${getRoleBadgeStyle(item.role)}`}>
                                                                        {item.role || "STAFF"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2.5 font-bold">{item.name || "Not set"}</td>
                                                                <td className="px-3 py-2.5">{formatPhone(item.phone)}</td>
                                                                <td className="px-3 py-2.5">{item.email || "Not set"}</td>
                                                                <td className="px-3 py-2.5 text-right">
                                                                    <span className="text-xs font-semibold text-emerald-400">Active</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="theme-empty mt-4 rounded-xl p-4 text-sm">
                                                No staff members found under this restaurant.
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                                No staff members found matching your search.
                            </div>
                        )}
                    </section>
                ) : (
                    /* TAB 3: REGISTERED CUSTOMERS */
                    <section className="theme-panel rounded-3xl p-5 space-y-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Users className="text-amber-500" size={22} />
                                    <h2 className="text-xl font-bold">Registered Customer Accounts</h2>
                                </div>
                                <p className="theme-muted mt-1 text-sm">
                                    Showing {customers.length} customer accounts registered across the platform.
                                </p>
                            </div>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    loadCustomers(query);
                                }}
                                className="theme-input flex items-center gap-2 rounded-2xl px-3 py-2 md:w-80"
                            >
                                <Search size={16} className="theme-muted" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search customer by name, phone..."
                                    className="w-full bg-transparent text-sm outline-none"
                                />
                            </form>
                        </div>

                        {loading ? (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center flex items-center justify-center gap-2">
                                <Sparkles className="animate-spin text-amber-500" size={20} />
                                Loading customer accounts...
                            </div>
                        ) : customers.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px] text-sm">
                                    <thead>
                                        <tr className="theme-muted text-left border-b border-black/10 dark:border-white/10 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-3 font-bold">Full Name</th>
                                            <th className="px-4 py-3 font-bold">Username</th>
                                            <th className="px-4 py-3 font-bold">Phone Number</th>
                                            <th className="px-4 py-3 font-bold">Email Address</th>
                                            <th className="px-4 py-3 font-bold">Loyalty Balance</th>
                                            <th className="px-4 py-3 font-bold">Joined Date</th>
                                            <th className="px-4 py-3 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customers.map((c) => (
                                            <tr key={c.id} className="border-t theme-border hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                <td className="px-4 py-3 font-bold">
                                                    <div className="flex items-center gap-2">
                                                        {c.avatarUrl ? (
                                                            <img
                                                                src={c.avatarUrl}
                                                                alt={c.name || "User Avatar"}
                                                                className="h-8 w-8 rounded-full object-cover border border-amber-500/30 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-black text-xs shrink-0">
                                                                {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                                                            </div>
                                                        )}
                                                        <span>{c.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-amber-400 font-semibold">{c.username}</td>
                                                <td className="px-4 py-3">{formatPhone(c.phone)}</td>
                                                <td className="px-4 py-3">{c.email}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-400 border border-emerald-500/20">
                                                        <Coins size={14} />
                                                        {c.rewardPoints || 0} pts
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 theme-muted text-xs">
                                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteModalCustomer(c)}
                                                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-extrabold text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95"
                                                        title="Delete Customer Account"
                                                    >
                                                        <Trash2 size={13} />
                                                        <span>Delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                                No registered customer accounts found matching your search.
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* DELETE CUSTOMER CONFIRMATION MODAL */}
            {deleteModalCustomer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-black/10 dark:border-white/15 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 font-bold shrink-0">
                                <Trash2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete User Account</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Permanent database action
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 p-4 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 space-y-1">
                            <p className="font-bold text-sm">
                                Delete "{deleteModalCustomer.name}"?
                            </p>
                            <p>
                                Account details ({deleteModalCustomer.phone !== "Not set" ? deleteModalCustomer.phone : deleteModalCustomer.email}) will be permanently removed.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalCustomer(null)}
                                disabled={deleting}
                                className="w-1/2 rounded-xl border border-gray-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteCustomer}
                                disabled={deleting}
                                className="w-1/2 flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 text-sm shadow-md transition disabled:opacity-60"
                            >
                                {deleting ? (
                                    <>
                                        <Sparkles size={16} className="animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} />
                                        <span>Delete Account</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
