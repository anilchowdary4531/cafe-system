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
    AlertOctagon,
    Bug,
    Calendar,
    ChevronRight,
    Eye,
    Filter,
    FileText,
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

    // ERROR MONITORING STATE
    const [errorLogsData, setErrorLogsData] = useState(null);
    const [logsLoading, setLogsLoading] = useState(true);
    const [logsError, setLogsError] = useState("");
    const [refreshingLogs, setRefreshingLogs] = useState(false);

    // Filters
    const [errorSearchTerm, setErrorSearchTerm] = useState("");
    const [errorStartTime, setErrorStartTime] = useState("");
    const [errorEndTime, setErrorEndTime] = useState("");

    // Detail Modal State
    const [selectedGroup, setSelectedGroup] = useState(null);

    const fetchErrorLogs = useCallback(async (isManual = false) => {
        try {
            if (isManual) setRefreshingLogs(true);
            const params = {};
            if (errorSearchTerm.trim()) params.searchTerm = errorSearchTerm.trim();
            if (errorStartTime) params.startTime = errorStartTime;
            if (errorEndTime) params.endTime = errorEndTime;

            const res = await api.get("/super-admin/error-logs", { params });
            const data = res.data?.data || res.data;
            if (data) {
                setErrorLogsData(data);
                setLogsError("");
            } else {
                setLogsError("Failed to parse error logs");
            }
        } catch (err) {
            console.error("Error logs fetch error:", err);
            setLogsError(err.response?.data?.message || "Failed to load error logs from CloudWatch");
        } finally {
            setLogsLoading(false);
            setRefreshingLogs(false);
        }
    }, [errorSearchTerm, errorStartTime, errorEndTime]);

    useEffect(() => {
        fetchErrorLogs(false);
    }, [fetchErrorLogs]);

    // Derived groups: Prefer backend groups, or compute fallback from raw logs/events if backend hasn't provided them
    const allGroups = useMemo(() => {
        if (!errorLogsData) return [];
        if (Array.isArray(errorLogsData.groups) && errorLogsData.groups.length > 0) {
            return errorLogsData.groups;
        }
        const rawLogs = errorLogsData.logs || errorLogsData.events || [];
        if (!Array.isArray(rawLogs) || rawLogs.length === 0) return [];

        const groupsMap = new Map();
        for (const event of rawLogs) {
            const method = String(event.method || event.httpMethod || "UNKNOWN").toUpperCase();
            const rawPath = String(event.url || event.path || "/");
            let normPath = rawPath.split("?")[0].trim();
            normPath = normPath.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g, "/:uuid");
            normPath = normPath.replace(/\/\d{10,}(?=\/|$)/g, "/:id");
            normPath = normPath.replace(/\/\d+(?=\/|$)/g, "/:id");
            normPath = normPath || "/";

            const statusCode = Number(event.statusCode || event.status || 500);
            const message = (event.message || "Unknown Error").trim();

            const fingerprint = `${method}|${normPath}|${statusCode}|${message}`;
            const eventTs = event.timestamp || new Date().toISOString();

            if (!groupsMap.has(fingerprint)) {
                groupsMap.set(fingerprint, {
                    fingerprint,
                    status: event.status || "OPEN",
                    occurrences: 1,
                    firstSeen: eventTs,
                    lastSeen: eventTs,
                    method,
                    path: normPath,
                    statusCode,
                    message,
                    events: [event],
                });
            } else {
                const group = groupsMap.get(fingerprint);
                group.occurrences += 1;
                group.events.push(event);

                const groupFirst = new Date(group.firstSeen).getTime();
                const groupLast = new Date(group.lastSeen).getTime();
                const currentTs = new Date(eventTs).getTime();

                if (currentTs < groupFirst) group.firstSeen = eventTs;
                if (currentTs > groupLast) group.lastSeen = eventTs;
            }
        }

        return Array.from(groupsMap.values()).sort(
            (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
        );
    }, [errorLogsData]);

    // Client-side search filter over grouped errors
    const filteredGroups = useMemo(() => {
        if (!allGroups || allGroups.length === 0) return [];
        if (!errorSearchTerm.trim()) return allGroups;

        const term = errorSearchTerm.toLowerCase().trim();
        return allGroups.filter((group) => {
            const methodMatch = (group.method || "").toLowerCase().includes(term);
            const pathMatch = (group.path || "").toLowerCase().includes(term);
            const statusMatch = String(group.statusCode || "").includes(term);
            const messageMatch = (group.message || "").toLowerCase().includes(term);
            const eventsMatch = Array.isArray(group.events) && group.events.some(
                (evt) => (evt.logStream || "").toLowerCase().includes(term) || (evt.message || "").toLowerCase().includes(term)
            );
            return methodMatch || pathMatch || statusMatch || messageMatch || eventsMatch;
        });
    }, [allGroups, errorSearchTerm]);

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

            <header className="theme-nav border-b px-2 py-2 md:px-3">
                <div className="w-full flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2.5" id="profile-section">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="theme-soft-button inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                        >
                            <Menu size={15} />
                            Tiffzy
                        </button>
                        <div className="flex h-10 w-10 -rotate-2 items-center justify-center overflow-hidden rounded-md border border-[#d9c8af] bg-transparent p-0.5 shadow-[0_3px_8px_rgba(88,61,36,0.14)]">
                            <img src={tiffzyLogo} alt="Tiffzy logo" className="h-full w-full object-contain mix-blend-multiply" />
                        </div>
                        <div>
                            <p className="theme-muted text-[10px] uppercase tracking-[0.25em]">Super Admin</p>
                            <h1 className="text-xl font-bold leading-tight">Tiffzy</h1>
                            <p className="theme-muted text-xs">{user?.email || "admin@tiffzy.com"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="w-full px-2 py-2 md:px-3 space-y-4">
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

                {/* ERROR MONITORING SECTION */}
                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <AlertOctagon className="text-red-500" size={20} />
                                <h2 className="text-xl font-bold tracking-tight">Error Monitoring</h2>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20">
                                    AWS CloudWatch Logs
                                </span>
                            </div>
                            <p className="theme-muted text-xs mt-0.5">
                                Real-time AWS EC2 CloudWatch error logs, API exceptions, and status code failures.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 self-start sm:self-auto">
                            {errorLogsData?.latestTimestamp && (
                                <div className="text-xs theme-muted flex items-center gap-1.5">
                                    <Clock size={13} />
                                    <span>Latest {new Date(errorLogsData.latestTimestamp).toLocaleTimeString()}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fetchErrorLogs(true)}
                                disabled={refreshingLogs}
                                className="theme-soft-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition active:scale-95"
                            >
                                <RefreshCw size={13} className={refreshingLogs ? "animate-spin text-orange-500" : ""} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* OVERVIEW METRICS - CLEAN STRIP */}
                    <div className="grid gap-4 sm:grid-cols-3 py-2 border-b theme-border">
                        <div className="flex flex-col justify-between">
                            <p className="text-xs font-bold theme-muted uppercase tracking-wider">OPEN ERRORS</p>
                            <p className="text-3xl font-black text-red-500 mt-1">{errorLogsData?.openErrorsCount ?? 0}</p>
                            <p className="text-[11px] font-semibold text-red-500/80 mt-0.5">ACTIVE ERROR GROUPS</p>
                        </div>

                        <div className="flex flex-col justify-between">
                            <p className="text-xs font-bold theme-muted uppercase tracking-wider">TOTAL ERROR EVENTS</p>
                            <p className="text-3xl font-black text-orange-500 mt-1">{errorLogsData?.totalEvents ?? 0}</p>
                            <p className="text-[11px] font-semibold text-orange-500/80 mt-0.5">CLOUDWATCH EVENTS</p>
                        </div>

                        <div className="flex flex-col justify-between">
                            <p className="text-xs font-bold theme-muted uppercase tracking-wider">LATEST TIMESTAMP</p>
                            <p className="text-xl font-bold font-mono theme-text mt-1">
                                {errorLogsData?.latestTimestamp ? new Date(errorLogsData.latestTimestamp).toLocaleString() : "N/A"}
                            </p>
                            <p className="text-[11px] font-semibold theme-muted mt-0.5">MOST RECENT</p>
                        </div>
                    </div>

                    {/* SEARCH & FILTER CONTROLS */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between py-2 border-b theme-border">
                        <div className="flex-1 flex items-center gap-2 theme-input rounded-lg px-3 py-1.5">
                            <Search size={15} className="theme-muted" />
                            <input
                                value={errorSearchTerm}
                                onChange={(e) => setErrorSearchTerm(e.target.value)}
                                placeholder="Search error logs (message, URL, method, status code, log stream...)"
                                className="w-full bg-transparent text-xs outline-none"
                            />
                            {errorSearchTerm && (
                                <button type="button" onClick={() => setErrorSearchTerm("")} className="theme-muted hover:text-orange-500">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs theme-muted">
                                <Calendar size={13} />
                                <span className="font-medium">Start:</span>
                                <input
                                    type="datetime-local"
                                    value={errorStartTime}
                                    onChange={(e) => setErrorStartTime(e.target.value)}
                                    className="theme-input rounded-lg px-2 py-1 text-xs bg-transparent outline-none border theme-border"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 text-xs theme-muted">
                                <Calendar size={13} />
                                <span className="font-medium">End:</span>
                                <input
                                    type="datetime-local"
                                    value={errorEndTime}
                                    onChange={(e) => setErrorEndTime(e.target.value)}
                                    className="theme-input rounded-lg px-2 py-1 text-xs bg-transparent outline-none border theme-border"
                                />
                            </div>

                            {(errorSearchTerm || errorStartTime || errorEndTime) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setErrorSearchTerm("");
                                        setErrorStartTime("");
                                        setErrorEndTime("");
                                    }}
                                    className="px-2 py-1 text-xs font-semibold theme-muted hover:text-orange-500 transition"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* LOGS TABLE / STATES */}
                    {logsLoading ? (
                        <div className="py-10 text-center text-sm theme-muted space-y-2">
                            <RefreshCw size={22} className="animate-spin text-orange-500 mx-auto" />
                            <p>Loading CloudWatch error logs...</p>
                        </div>
                    ) : logsError && (!errorLogsData || (!errorLogsData.groups && !errorLogsData.logs)) ? (
                        <div className="my-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-500 dark:text-red-300 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} />
                                <span>{logsError}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchErrorLogs(true)}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-white rounded-lg text-xs font-bold cursor-pointer transition"
                            >
                                Retry
                            </button>
                        </div>
                    ) : !filteredGroups || filteredGroups.length === 0 ? (
                        <div className="py-10 text-center text-sm theme-muted">
                            No error groups found
                        </div>
                    ) : (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b theme-border bg-orange-500/5 theme-text uppercase tracking-wider text-[10px] font-bold">
                                    <tr>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Occurrences</th>
                                        <th className="py-2.5 px-3">Method & URL</th>
                                        <th className="py-2.5 px-3">Error Message</th>
                                        <th className="py-2.5 px-3">First Seen</th>
                                        <th className="py-2.5 px-3">Last Seen</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y theme-border">
                                    {filteredGroups.map((group) => {
                                        return (
                                            <tr
                                                key={group.fingerprint}
                                                onClick={() => setSelectedGroup(group)}
                                                className="hover:bg-orange-500/5 transition cursor-pointer"
                                            >
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className="font-bold px-2 py-0.5 rounded text-[10px] border bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30">
                                                        {group.status || "OPEN"}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                                                    <span className="font-bold px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 text-xs inline-flex items-center gap-1">
                                                        ×{group.occurrences}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                                                    <span className="font-bold text-orange-500 mr-1.5">{group.method || "N/A"}</span>
                                                    <span className="theme-text">{group.path || "-"}</span>
                                                    {group.statusCode && (
                                                        <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 theme-muted">
                                                            [{group.statusCode}]
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 max-w-xs truncate font-medium theme-text" title={group.message}>
                                                    {group.message}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono theme-muted whitespace-nowrap">
                                                    {group.firstSeen ? new Date(group.firstSeen).toLocaleString() : "N/A"}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono theme-muted whitespace-nowrap">
                                                    {group.lastSeen ? new Date(group.lastSeen).toLocaleString() : "N/A"}
                                                </td>
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedGroup(group);
                                                        }}
                                                        className="px-2.5 py-1 rounded border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 text-[11px] font-semibold transition"
                                                    >
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* ERROR DETAIL MODAL */}
                {selectedGroup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="theme-panel w-full max-w-3xl rounded-2xl border theme-border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b theme-border pb-3">
                                <div className="flex items-center gap-2">
                                    <AlertOctagon className="text-red-500" size={22} />
                                    <h3 className="text-lg font-bold tracking-tight theme-text">Error Group Details</h3>
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold border border-red-500/20 dark:bg-red-500/20 dark:text-red-400">
                                        Status: {selectedGroup.status || "OPEN"}
                                    </span>
                                    <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-bold border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400">
                                        Occurrences: {selectedGroup.occurrences}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedGroup(null)}
                                    className="p-1 rounded-lg hover:bg-orange-500/10 theme-muted hover:text-orange-500 transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                                <div>
                                    <p className="theme-muted font-semibold">HTTP Method</p>
                                    <p className="font-mono text-orange-500 font-bold mt-0.5">{selectedGroup.method || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="theme-muted font-semibold">URL Path</p>
                                    <p className="font-mono theme-text mt-0.5">{selectedGroup.path || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="theme-muted font-semibold">Status Code</p>
                                    <p className="font-mono theme-text mt-0.5">{selectedGroup.statusCode || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="theme-muted font-semibold">Status</p>
                                    <p className="font-mono text-red-500 font-bold mt-0.5">{selectedGroup.status || "OPEN"}</p>
                                </div>
                                <div>
                                    <p className="theme-muted font-semibold">First Seen</p>
                                    <p className="font-mono theme-text mt-0.5">
                                        {selectedGroup.firstSeen ? new Date(selectedGroup.firstSeen).toLocaleString() : "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="theme-muted font-semibold">Last Seen</p>
                                    <p className="font-mono theme-text mt-0.5">
                                        {selectedGroup.lastSeen ? new Date(selectedGroup.lastSeen).toLocaleString() : "N/A"}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="theme-muted font-semibold text-xs mb-1">Error Message</p>
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs font-mono font-medium leading-relaxed">
                                    {selectedGroup.message}
                                </div>
                            </div>

                            {/* RAW EVENTS SECTION */}
                            <div className="pt-2 border-t theme-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold tracking-tight theme-text flex items-center gap-2">
                                        <FileText size={16} className="text-orange-500" />
                                        Raw Events ({selectedGroup.events?.length || 0})
                                    </h4>
                                </div>

                                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                    {selectedGroup.events && selectedGroup.events.length > 0 ? (
                                        selectedGroup.events.map((evt, idx) => (
                                            <div key={evt.id || idx} className="p-3 rounded-xl bg-black/40 border theme-border space-y-2 text-xs">
                                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono theme-muted border-b theme-border pb-1.5">
                                                    <span className="theme-text font-semibold">{new Date(evt.timestamp).toLocaleString()}</span>
                                                    <span className="text-orange-500/90 font-mono">{evt.logStream || "default-stream"}</span>
                                                </div>
                                                <p className="theme-text font-mono text-[11px] leading-relaxed">{evt.message}</p>
                                                {evt.details && (
                                                    <pre className="mt-1 p-2 rounded bg-black/60 border border-orange-500/20 text-slate-300 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
                                                        {evt.details}
                                                    </pre>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs theme-muted italic">No raw events available for this group.</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t theme-border">
                                <button
                                    type="button"
                                    onClick={() => setSelectedGroup(null)}
                                    className="theme-soft-button rounded-lg px-4 py-2 text-xs font-semibold transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && restaurants.length > 0 && (
                    <section className="space-y-4 grid gap-6 xl:grid-cols-2">
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

                <section id="restaurants-section" className="space-y-4">
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
        <div className="border theme-border rounded-lg p-2.5 flex flex-col justify-between bg-transparent transition">
            <div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {icon}
                        <h4 className="font-bold text-xs tracking-tight">{title}</h4>
                    </div>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${status.bg}`}>
                        {status.label}
                    </span>
                </div>

                <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-2xl font-black tracking-tight" style={{ color }}>
                        {currentValue.toFixed(1)}
                    </span>
                    <span className="text-[11px] font-bold theme-muted">{unit}</span>
                </div>
            </div>

            {/* Historical Line Chart */}
            <div className="mt-2 h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 2, right: 2, left: -25, bottom: 0 }}>
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
                            strokeWidth={2}
                            dot={{ r: 2, fill: color }}
                            activeDot={{ r: 3.5 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Recent History Snippet */}
            <div className="mt-2 pt-1.5 border-t theme-border">
                <p className="text-[9px] font-bold theme-muted uppercase tracking-wider mb-1">Recent Values</p>
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {chartData.slice(-5).map((pt, idx) => (
                        <div key={idx} className="border theme-border px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap text-center flex-1 bg-slate-500/5">
                            <span className="theme-muted block text-[8px]">{pt.time}</span>
                            <span className="font-bold">{pt.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
