import { useEffect, useMemo, useState, useCallback } from "react";
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
    ExternalLink,
    Utensils,
    Wallet,
    Server,
    Cpu,
    HardDrive,
    Activity,
    Clock,
    RefreshCw,
    AlertTriangle,
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
    Line,
    LineChart,
} from "recharts";

import SuperAdminSidebar, { SUPER_ADMIN_MENU_ITEMS } from "../../components/super-admin/SuperAdminSidebar";

const formatMoney = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const CHART_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#eab308"];

const shortName = (value) => {
    const text = String(value || "").trim();
    if (!text) return "Unknown";
    if (text.length <= 12) return text;
    return `${text.slice(0, 11)}...`;
};

const HASH_TO_MENU_KEY = {
    "restaurants-section": "restaurants",
};

const formatTimeLabel = (ts) => {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return String(ts);
    }
};

const getLatestValue = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return Number(arr[arr.length - 1]?.value || 0);
};

const getStatusBadge = (value) => {
    const val = Number(value || 0);
    if (val > 85) return { label: "CRITICAL", bg: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (val > 65) return { label: "ELEVATED", bg: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    return { label: "HEALTHY", bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
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

    // SERVER MONITORING STATE
    const [serverMetrics, setServerMetrics] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [metricsError, setMetricsError] = useState("");
    const [refreshingMetrics, setRefreshingMetrics] = useState(false);

    const fetchServerMetrics = useCallback(async (isManual = false) => {
        try {
            if (isManual) setRefreshingMetrics(true);
            const res = await api.get("/super-admin/server-metrics");
            const data = res.data?.data || res.data;
            if (data && (data.cpu || data.instanceId)) {
                setServerMetrics(data);
                setMetricsError("");
            } else {
                setMetricsError("Failed to parse server metrics");
            }
        } catch (err) {
            console.error("Server metrics fetch error:", err);
            setMetricsError(err.response?.data?.message || "Failed to load server metrics");
        } finally {
            setMetricsLoading(false);
            setRefreshingMetrics(false);
        }
    }, []);

    useEffect(() => {
        fetchServerMetrics(false);
        const interval = setInterval(() => {
            fetchServerMetrics(false);
        }, 60_000);
        return () => clearInterval(interval);
    }, [fetchServerMetrics]);

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

    return (
        <div className="theme-page min-h-screen" id="super-admin-top">
            <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} currentKey={activeMenuKey} />

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

            <main className="mx-auto max-w-7xl px-4 py-4 md:px-8">
                {error && (
                    <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {/* SERVER MONITORING SECTION - Seamless / Borderless Style */}
                <section className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <Server className="theme-accent-text" size={20} />
                                <h2 className="text-xl font-bold tracking-tight">Server Monitoring</h2>
                                {serverMetrics?.instanceId && (
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold">
                                        EC2: {serverMetrics.instanceId}
                                    </span>
                                )}
                            </div>
                            <p className="theme-muted text-xs mt-0.5">
                                Real-time AWS EC2 CloudWatch server metrics for CPU, Memory, and Disk utilization.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 self-start sm:self-auto">
                            {serverMetrics?.lastUpdated && (
                                <div className="text-xs theme-muted flex items-center gap-1.5">
                                    <Clock size={13} />
                                    <span>Updated {new Date(serverMetrics.lastUpdated).toLocaleTimeString()}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fetchServerMetrics(true)}
                                disabled={refreshingMetrics}
                                className="theme-soft-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition active:scale-95"
                            >
                                <RefreshCw size={13} className={refreshingMetrics ? "animate-spin text-orange-500" : ""} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {metricsLoading ? (
                        <div className="py-8 text-center text-sm theme-muted space-y-2">
                            <RefreshCw size={22} className="animate-spin text-orange-500 mx-auto" />
                            <p>Loading server metrics...</p>
                        </div>
                    ) : metricsError && !serverMetrics ? (
                        <div className="my-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} />
                                <span>{metricsError}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchServerMetrics(true)}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-6 md:grid-cols-3">
                            {/* CPU CARD */}
                            <MetricCard
                                title="CPU Usage"
                                icon={<Cpu className="text-orange-500" size={17} />}
                                currentValue={getLatestValue(serverMetrics?.cpu)}
                                unit="%"
                                color="#f97316"
                                data={serverMetrics?.cpu || []}
                            />

                            {/* RAM CARD */}
                            <MetricCard
                                title="RAM Usage"
                                icon={<Activity className="text-blue-500" size={17} />}
                                currentValue={getLatestValue(serverMetrics?.memory)}
                                unit="%"
                                color="#3b82f6"
                                data={serverMetrics?.memory || []}
                            />

                            {/* STORAGE CARD */}
                            <MetricCard
                                title="Storage Usage"
                                icon={<HardDrive className="text-emerald-500" size={17} />}
                                currentValue={getLatestValue(serverMetrics?.disk)}
                                unit="%"
                                color="#22c55e"
                                data={serverMetrics?.disk || []}
                            />
                        </div>
                    )}
                </section>

                {!loading && restaurants.length > 0 && (
                    <section className="mb-8 border-t theme-border pt-6 grid gap-6 xl:grid-cols-2">
                        <article className="py-2">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-base font-bold">Users by Restaurant</h3>
                                <span className="theme-pill rounded-full px-3 py-0.5 text-xs font-semibold">
                                    Total Users: {analytics.totalUsers}
                                </span>
                            </div>
                            <p className="theme-muted mt-0.5 text-xs">Bar graph showing how users are distributed.</p>
                            <div className="mt-3 h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.usersBarData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 120, 92, 0.15)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(value) => [Number(value || 0), "Users"]} />
                                        <Bar dataKey="users" radius={[6, 6, 0, 0]} fill="#f97316" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="py-2">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-base font-bold">Revenue by Restaurant</h3>
                                <span className="theme-pill rounded-full px-3 py-0.5 text-xs font-semibold">
                                    Total Revenue: {formatMoney(analytics.totalRevenue)}
                                </span>
                            </div>
                            <p className="theme-muted mt-0.5 text-xs">Bar graph showing revenue contribution.</p>
                            <div className="mt-3 h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.revenueBarData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 120, 92, 0.15)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(value) => [formatMoney(value), "Revenue"]} />
                                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#22c55e" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="py-2">
                            <h3 className="text-base font-bold">Restaurants Status</h3>
                            <p className="theme-muted mt-0.5 text-xs">Pie chart of active vs disabled restaurants.</p>
                            <div className="mt-3 h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.restaurantStatusData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={50}
                                            outerRadius={80}
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

                        <article className="py-2">
                            <h3 className="text-base font-bold">Users & Revenue Share</h3>
                            <p className="theme-muted mt-0.5 text-xs">Pie charts for relative user and revenue split by restaurant.</p>
                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="mb-1 text-xs font-semibold">Users Share</p>
                                    <div className="h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={analytics.usersPieData} dataKey="value" nameKey="name" outerRadius={75}>
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
                                    <p className="mb-1 text-xs font-semibold">Revenue Share</p>
                                    <div className="h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={analytics.revenuePieData} dataKey="value" nameKey="name" outerRadius={75}>
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

                <section id="restaurants-section" className="border-t theme-border pt-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="theme-accent-text" size={18} />
                                <h2 className="text-xl font-bold tracking-tight">Restaurants Under Super Admin</h2>
                            </div>
                            <p className="theme-muted mt-0.5 text-xs">Application-wide restaurant list with owner login details.</p>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                loadRestaurants(query);
                            }}
                            className="theme-input flex items-center gap-2 rounded-xl px-3 py-1.5 md:w-80"
                        >
                            <Search size={15} className="theme-muted" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search restaurants"
                                className="w-full bg-transparent text-sm outline-none"
                            />
                        </form>
                    </div>

                    {loading ? (
                        <div className="py-8 text-center text-sm theme-muted">
                            Loading restaurants...
                        </div>
                    ) : restaurants.length ? (
                        <div className="mt-3 grid gap-3">
                            {restaurants.map((restaurant) => (
                                <article key={restaurant.id} className="border theme-border rounded-xl p-3.5 bg-transparent hover:bg-slate-500/5 transition">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="flex gap-3">
                                            <div className="theme-pill flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                                                {restaurant.logoUrl ? (
                                                    <img
                                                        src={resolveImageUrl(restaurant.logoUrl)}
                                                        alt={`${restaurant.name} logo`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Store size={18} className="theme-muted" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 
                                                        onClick={() => navigate(`/super-admin/restaurant-profiles?q=${encodeURIComponent(restaurant.name)}`)}
                                                        className="text-base font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer flex items-center gap-1.5 transition-colors"
                                                        title={`Click to view ${restaurant.name} profile details in Super Admin`}
                                                    >
                                                        {restaurant.name}
                                                        <ExternalLink size={14} className="opacity-70" />
                                                    </h3>
                                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${restaurant.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                                        {restaurant.isActive ? "Active" : "Disabled"}
                                                    </span>
                                                </div>
                                                <p 
                                                    onClick={() => navigate(`/super-admin/restaurant-profiles?q=${encodeURIComponent(restaurant.name)}`)}
                                                    className="theme-muted mt-0.5 text-xs cursor-pointer hover:text-amber-300 hover:underline"
                                                    title={`Click to view ${restaurant.name} profile details in Super Admin`}
                                                >
                                                    /{restaurant.slug} - {restaurant.city || "City not set"}
                                                </p>
                                                <div className="theme-muted-strong mt-2 grid gap-x-4 gap-y-0.5 text-xs md:grid-cols-2">
                                                    <span>Owner: {restaurant.owner?.name || restaurant.ownerName || "Not set"}</span>
                                                    <span>Email: {restaurant.owner?.email || restaurant.email || "Not set"}</span>
                                                    <span>Phone: {restaurant.owner?.phone || restaurant.phone || "Not set"}</span>
                                                    <span>Revenue: {formatMoney(restaurant.revenue)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[300px]">
                                            <MiniMetric label="Users" value={restaurant.counts?.users || 0} />
                                            <MiniMetric label="Menu" value={restaurant.counts?.menuItems || 0} />
                                            <MiniMetric label="Orders" value={restaurant.counts?.orders || 0} />
                                            <MiniMetric label="Tables" value={restaurant.counts?.tables || 0} />
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 theme-border">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <UserRound className="theme-accent-text" size={14} />
                                            <span className="theme-muted">Owner can log in and manage this restaurant.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/super-admin/restaurant-profiles?q=${encodeURIComponent(restaurant.name)}`)}
                                                className="theme-button inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm active:scale-95 transition-all"
                                            >
                                                <Utensils size={14} />
                                                View Profile
                                            </button>
                                            <button
                                                onClick={() => toggleRestaurant(restaurant)}
                                                className="theme-soft-button inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                                            >
                                                <Power size={14} />
                                                {restaurant.isActive ? "Disable" : "Activate"}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-sm theme-muted border-t theme-border mt-3">
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
        <div className="rounded-lg p-2 border theme-border bg-slate-500/5">
            <p className="text-[10px] theme-muted font-medium">{label}</p>
            <p className="mt-0.5 text-base font-bold tracking-tight">{value}</p>
        </div>
    );
}

function MetricCard({ title, icon, currentValue, unit, color, data }) {
    const status = getStatusBadge(currentValue);
    const chartData = useMemo(() => {
        return (data || []).map((item) => ({
            time: formatTimeLabel(item.timestamp),
            value: Number(Number(item.value || 0).toFixed(1)),
        }));
    }, [data]);

    return (
        <div className="border theme-border rounded-xl p-4 flex flex-col justify-between bg-transparent transition">
            <div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h4 className="font-bold text-sm tracking-tight">{title}</h4>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${status.bg}`}>
                        {status.label}
                    </span>
                </div>

                <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tracking-tight" style={{ color }}>
                        {currentValue.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold theme-muted">{unit}</span>
                </div>
            </div>

            {/* Historical Line Chart */}
            <div className="mt-3 h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 120, 92, 0.12)" />
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94a3b8" }} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <Tooltip
                            formatter={(val) => [`${val}${unit}`, title]}
                            contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "0.5rem", fontSize: "11px", color: "#f8fafc" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2.5}
                            dot={{ r: 2.5, fill: color }}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Recent History Snippet */}
            <div className="mt-3 pt-2.5 border-t theme-border">
                <p className="text-[10px] font-bold theme-muted uppercase tracking-wider mb-1.5">Recent Values</p>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {chartData.slice(-5).map((pt, idx) => (
                        <div key={idx} className="border theme-border px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap text-center flex-1 bg-slate-500/5">
                            <span className="theme-muted block text-[9px]">{pt.time}</span>
                            <span className="font-bold">{pt.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
