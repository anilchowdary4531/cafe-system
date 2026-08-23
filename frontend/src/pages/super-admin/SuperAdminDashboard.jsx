import { useEffect, useMemo, useState } from "react";
import {
    BarChart3,
    Building2,
    LayoutDashboard,
    Menu,
    Power,
    Search,
    Settings,
    Store,
    UserRound,
    Users,
    UserCheck,
    X,
    Image as ImageIcon,
    Receipt,
    DollarSign,
    RotateCcw,
    Tag,
    Download,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api, cachedGet, invalidateGetCache } from "../../utils/apiClient";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import tiffzyLogo from "../../assets/tiffzy-logo.png";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const formatMoney = (value) =>
    `\u20B9${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const CHART_COLORS = ["#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7"];

const shortName = (value) => {
    const text = String(value || "").trim();
    if (!text) return "Unknown";
    if (text.length <= 12) return text;
    return `${text.slice(0, 11)}...`;
};

const SUPER_ADMIN_MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, to: "/super-admin" },
    { key: "profile", label: "Profile", icon: UserRound, to: "/super-admin#profile-section" },
    { key: "restaurants", label: "Restaurant Management", icon: Building2, to: "/super-admin#restaurants-section" },
    { key: "categories", label: "Home Categories", icon: Menu, to: "/super-admin/categories" },
    { key: "banners", label: "Promotion Banners", icon: ImageIcon, to: "/super-admin/banners" },
    { key: "users", label: "Customer Management", icon: Users, to: "/super-admin/users" },
    { key: "orders", label: "Orders Ledger", icon: Receipt, to: "/super-admin/settlements" },
    { key: "revenue", label: "Revenue & Commission", icon: DollarSign, to: "/super-admin/settlements" },
    { key: "settlements", label: "Cashfree Easy Split", icon: BarChart3, to: "/super-admin/settlements" },
    { key: "refunds", label: "Refunds Ledger", icon: RotateCcw, to: "/super-admin/settlements" },
    { key: "coupons", label: "Coupons & Offers", icon: Tag, to: "/super-admin/settings" },
    { key: "reports", label: "Reports & Analytics", icon: Download, to: "/super-admin/settlements" },
    { key: "staff", label: "Staff Management", icon: UserCheck, to: "/super-admin/staff" },
    { key: "create-restaurant", label: "Create Restaurant", icon: Store, to: "/super-admin/create-restaurant" },
    { key: "settings", label: "System Settings", icon: Settings, to: "/super-admin/settings" },
];

const HASH_TO_MENU_KEY = {
    "profile-section": "profile",
    "restaurants-section": "restaurants",
};

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [restaurants, setRestaurants] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeMenuKey, setActiveMenuKey] = useState("dashboard");

    const analytics = useMemo(() => {
        const normalized = (restaurants || []).map((item, index) => ({
            id: item.id || index,
            name: item.name || `Restaurant ${index + 1}`,
            users: Number(item.counts?.users || 0),
            revenue: Number(item.revenue || 0),
            isActive: Boolean(item.isActive),
        }));

        const totalRestaurants = normalized.length;
        const activeRestaurants = normalized.filter((item) => item.isActive).length;
        const totalUsers = normalized.reduce((sum, item) => sum + item.users, 0);
        const totalRevenue = normalized.reduce((sum, item) => sum + item.revenue, 0);

        const usersBarData = normalized.map((item) => ({
            id: item.id,
            name: shortName(item.name),
            fullName: item.name,
            users: item.users,
        }));

        const revenueBarData = normalized.map((item) => ({
            id: item.id,
            name: shortName(item.name),
            fullName: item.name,
            revenue: Math.round(item.revenue),
        }));

        const usersPieData = normalized
            .filter((item) => item.users > 0)
            .map((item) => ({ name: item.name, value: item.users }));

        const revenuePieData = normalized
            .filter((item) => item.revenue > 0)
            .map((item) => ({ name: item.name, value: Math.round(item.revenue) }));

        const restaurantStatusData = [
            { name: "Active", value: activeRestaurants, color: "#22c55e" },
            { name: "Disabled", value: Math.max(0, totalRestaurants - activeRestaurants), color: "#ef4444" },
        ].filter((item) => item.value > 0);

        return {
            totalRestaurants,
            totalUsers,
            totalRevenue,
            usersBarData,
            revenueBarData,
            usersPieData,
            revenuePieData,
            restaurantStatusData,
        };
    }, [restaurants]);

    const loadRestaurants = async (search = query) => {
        try {
            setLoading(true);
            const data = await cachedGet("/super-admin/restaurants", {
                params: search ? { q: search } : {},
                ttlMs: 10_000,
                staleMs: 60_000,
                scope: "auth",
            });
            setRestaurants(data?.restaurants || []);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load restaurants");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRestaurants("");
    }, []);

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

    useEffect(() => {
        if (location.pathname !== "/super-admin") return;

        const hashId = location.hash.replace("#", "");
        if (hashId) {
            setActiveMenuKey(HASH_TO_MENU_KEY[hashId] || "dashboard");
            requestAnimationFrame(() => {
                const target = document.getElementById(hashId);
                if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
            return;
        }

        setActiveMenuKey("dashboard");
    }, [location.pathname, location.hash]);

    const toggleRestaurant = async (restaurant) => {
        try {
            setError("");
            await api.patch(`/super-admin/restaurants/${restaurant.id}/status`, { isActive: !restaurant.isActive });
            invalidateGetCache({ urlStartsWith: "/super-admin/restaurants" });
            await loadRestaurants(query);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update restaurant status");
        }
    };

    const handleMenuClick = (item) => {
        setActiveMenuKey(item.key);
        setSidebarOpen(false);
        navigate(item.to);
    };

    return (
        <div className="theme-page min-h-screen" id="super-admin-top">
            <div className={`fixed inset-0 z-50 transition ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
                <button
                    type="button"
                    aria-label="Close Tiffzy menu"
                    onClick={() => setSidebarOpen(false)}
                    className={`absolute inset-0 bg-black/45 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
                />
                <aside
                    className={`theme-panel theme-border absolute left-0 top-0 h-full w-72 max-w-[84vw] border-r p-5 shadow-2xl transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.2em]">Menu</p>
                            <h2 className="text-xl font-bold">Tiffzy</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="theme-soft-button inline-flex h-9 w-9 items-center justify-center rounded-xl"
                            aria-label="Close sidebar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <nav className="mt-5 grid gap-2">
                        {SUPER_ADMIN_MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.key === activeMenuKey;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleMenuClick(item)}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${isActive ? "theme-button" : "theme-soft-button"}`}
                                >
                                    <Icon size={17} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
            </div>

            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3" id="profile-section">
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
                            <h1 className="text-2xl font-bold">Tiffzy</h1>
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

            <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
                {error && (
                    <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {!loading && restaurants.length > 0 && (
                    <section className="mb-6 grid gap-4 xl:grid-cols-2">
                        <article className="theme-panel rounded-3xl p-5">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-lg font-bold">Users by Restaurant</h3>
                                <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">
                                    Total Users: {analytics.totalUsers}
                                </span>
                            </div>
                            <p className="theme-muted mt-1 text-sm">Bar graph showing how users are distributed.</p>
                            <div className="mt-4 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.usersBarData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 120, 92, 0.25)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value) => [Number(value || 0), "Users"]} />
                                        <Bar dataKey="users" radius={[8, 8, 0, 0]} fill="#f97316" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="theme-panel rounded-3xl p-5">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-lg font-bold">Revenue by Restaurant</h3>
                                <span className="theme-pill rounded-full px-3 py-1 text-xs font-semibold">
                                    Total Revenue: {formatMoney(analytics.totalRevenue)}
                                </span>
                            </div>
                            <p className="theme-muted mt-1 text-sm">Bar graph showing revenue contribution.</p>
                            <div className="mt-4 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.revenueBarData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 120, 92, 0.25)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value) => [formatMoney(value), "Revenue"]} />
                                        <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="#22c55e" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="theme-panel rounded-3xl p-5">
                            <h3 className="text-lg font-bold">Restaurants Status</h3>
                            <p className="theme-muted mt-1 text-sm">Pie chart of active vs disabled restaurants.</p>
                            <div className="mt-4 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.restaurantStatusData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={56}
                                            outerRadius={90}
                                            paddingAngle={4}
                                        >
                                            {analytics.restaurantStatusData.map((entry, index) => (
                                                <Cell key={`${entry.name}-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [Number(value || 0), "Restaurants"]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="theme-panel rounded-3xl p-5">
                            <h3 className="text-lg font-bold">Users & Revenue Share</h3>
                            <p className="theme-muted mt-1 text-sm">Pie charts for relative user and revenue split by restaurant.</p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-sm font-semibold">Users Share</p>
                                    <div className="h-56">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={analytics.usersPieData} dataKey="value" nameKey="name" outerRadius={85}>
                                                    {analytics.usersPieData.map((entry, index) => (
                                                        <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => [Number(value || 0), "Users"]} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-2 text-sm font-semibold">Revenue Share</p>
                                    <div className="h-56">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={analytics.revenuePieData} dataKey="value" nameKey="name" outerRadius={85}>
                                                    {analytics.revenuePieData.map((entry, index) => (
                                                        <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => [formatMoney(value), "Revenue"]} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </section>
                )}

                <section id="restaurants-section" className="theme-panel mt-2 rounded-3xl p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="theme-accent-text" size={20} />
                                <h2 className="text-xl font-bold">Restaurants Under Super Admin</h2>
                            </div>
                            <p className="theme-muted mt-2 text-sm">Application-wide restaurant list with owner login details.</p>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                loadRestaurants(query);
                            }}
                            className="theme-input flex items-center gap-2 rounded-2xl px-3 py-2 md:w-80"
                        >
                            <Search size={16} className="theme-muted" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search restaurants"
                                className="w-full bg-transparent text-sm outline-none"
                            />
                        </form>
                    </div>

                    {loading ? (
                        <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                            Loading restaurants...
                        </div>
                    ) : restaurants.length ? (
                        <div className="mt-5 grid gap-4">
                            {restaurants.map((restaurant) => (
                                <article key={restaurant.id} className="theme-card rounded-2xl p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="flex gap-3">
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
                                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${restaurant.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                                        {restaurant.isActive ? "Active" : "Disabled"}
                                                    </span>
                                                </div>
                                                <p className="theme-muted mt-1 text-sm">/{restaurant.slug} - {restaurant.city || "City not set"}</p>
                                                <div className="theme-muted-strong mt-3 grid gap-1 text-sm md:grid-cols-2">
                                                    <span>Owner: {restaurant.owner?.name || restaurant.ownerName || "Not set"}</span>
                                                    <span>Email: {restaurant.owner?.email || restaurant.email || "Not set"}</span>
                                                    <span>Phone: {restaurant.owner?.phone || restaurant.phone || "Not set"}</span>
                                                    <span>Revenue: {formatMoney(restaurant.revenue)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[320px]">
                                            <MiniMetric label="Users" value={restaurant.counts?.users || 0} />
                                            <MiniMetric label="Menu" value={restaurant.counts?.menuItems || 0} />
                                            <MiniMetric label="Orders" value={restaurant.counts?.orders || 0} />
                                            <MiniMetric label="Tables" value={restaurant.counts?.tables || 0} />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 theme-border">
                                        <div className="flex items-center gap-2 text-sm">
                                            <UserRound className="theme-accent-text" size={16} />
                                            <span className="theme-muted">Owner can log in and manage this restaurant.</span>
                                        </div>
                                        <button
                                            onClick={() => toggleRestaurant(restaurant)}
                                            className="theme-soft-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
                                        >
                                            <Power size={15} />
                                            {restaurant.isActive ? "Disable" : "Activate"}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="theme-empty mt-5 rounded-2xl p-8 text-center">
                            No restaurants found.
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="theme-pill rounded-xl px-3 py-2">
            <p className="text-xs">{label}</p>
            <p className="mt-1 text-lg font-bold">{value}</p>
        </div>
    );
}
