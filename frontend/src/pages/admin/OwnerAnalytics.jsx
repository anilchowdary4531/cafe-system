import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Activity,
    AlarmClockCheck,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Bot,
    BrainCircuit,
    CheckCircle2,
    Clock,
    CreditCard,
    Flame,
    Layers,
    LoaderCircle,
    RefreshCcw,
    ShoppingBag,
    Sparkles,
    TrendingUp,
    Users,
    UtensilsCrossed,
    Wallet,
} from "lucide-react";
import {
    Area,
    AreaChart,
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
import { API } from "../../config";

const RANGE_CONFIG = [
    { key: "24h", label: "Today (24h)", sublabel: "Hourly breakdown" },
    { key: "7d", label: "Last 7 Days", sublabel: "Daily performance" },
    { key: "30d", label: "Last 30 Days", sublabel: "Monthly trajectory" },
];

const REFRESH_MS = 20000;

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const formatPct = (value) => `${Number(value || 0).toFixed(1)}%`;

const PIE_COLORS = [
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#06b6d4",
    "#f97316",
    "#6366f1",
];

const panelClass = "theme-card rounded-[24px] border p-5 sm:p-6 transition-all duration-300";
const subPanelClass = "rounded-[16px] border p-4 transition-all duration-200";

const subPanelStyle = {
    borderColor: "var(--app-border)",
    background: "var(--app-surface-2)",
    color: "var(--app-text)",
};

const chartTrackStyle = {
    background: "var(--app-border)",
};

const getRangeButtonStyle = (active) =>
    active
        ? {
              background: "var(--app-primary)",
              color: "var(--app-primary-text)",
              boxShadow: "0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)",
          }
        : {
              background: "transparent",
              color: "var(--app-muted-strong)",
          };

export default function OwnerAnalytics() {
    const [data, setData] = useState(null);
    const [range, setRange] = useState("7d");
    const [activeTab, setActiveTab] = useState("overview"); // overview, sales, operations, menu
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [error, setError] = useState("");

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const restaurantId = Number(user?.restaurantId);

    const fetchAnalytics = async ({ silent = false } = {}) => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant ID is missing for the current logged-in account.");
            return;
        }

        try {
            if (silent) setRefreshing(true);
            else setLoading(true);

            const res = await axios.get(`${API}/owner/${restaurantId}/analytics`, {
                params: { range },
            });
            setData(res.data || null);
            setError("");
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to load analytics engine.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [restaurantId, range]);

    useEffect(() => {
        if (!autoRefresh || !restaurantId) return undefined;
        const timer = setInterval(() => {
            fetchAnalytics({ silent: true });
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [autoRefresh, restaurantId, range]);

    const timeseries = data?.charts?.timeseries || [];
    const hourlyRush = data?.charts?.hourlyRush || [];
    const topItems = data?.charts?.topItems || [];
    const categories = data?.charts?.categories || [];
    const tableHeatmap = data?.charts?.tableHeatmap || [];
    const paymentModes = data?.charts?.paymentModes || [];
    const channels = data?.charts?.channels || [];
    const peakWindows = data?.charts?.peakWindows || [];
    const insights = data?.insights || [];
    const overview = data?.overview || {};
    const forecast = data?.forecast || {};
    const realtime = data?.realtime || {};

    const categoryPieData = useMemo(() => {
        return categories.map((cat, index) => ({
            name: cat.name,
            value: Number(cat.revenue || 0),
            color: PIE_COLORS[index % PIE_COLORS.length],
        }));
    }, [categories]);

    const totalCategoryRevenue = categoryPieData.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const hasCategoryPieData = categoryPieData.some((item) => Number(item.value || 0) > 0);
    const renderedPieData = hasCategoryPieData
        ? categoryPieData
        : [{ name: "No Data", value: 1, color: "var(--app-border)" }];

    const maxHourlyOrders = Math.max(1, ...hourlyRush.map((h) => Number(h.orders || 0)));
    const maxTopQty = Math.max(1, ...topItems.map((item) => Number(item.qty || 0)));
    const maxCategoryRevenue = Math.max(1, ...categories.map((c) => Number(c.revenue || 0)));
    const maxTableOrders = Math.max(1, ...tableHeatmap.map((t) => Number(t.orders || 0)));

    if (loading) {
        return (
            <div className={`${panelClass} flex min-h-[420px] flex-col items-center justify-center gap-4`}>
                <LoaderCircle size={36} className="animate-spin text-[var(--app-primary)]" />
                <p className="text-sm font-semibold tracking-wide text-[var(--app-muted-strong)]">
                    Synthesizing restaurant intelligence...
                </p>
            </div>
        );
    }

    return (
        <section className="space-y-6 text-[15px]" style={{ color: "var(--app-text)" }}>
            {/* Header Hero Banner */}
            <article className="theme-hero-band relative overflow-hidden rounded-[28px] border border-amber-500/20 px-6 py-7 shadow-lg">
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-orange-600/10 blur-3xl" />

                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                            </span>
                            <p className="theme-price text-xs font-bold uppercase tracking-[0.24em]">
                                Executive Operations Engine
                            </p>
                        </div>
                        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                            {data?.restaurant?.name || "Restaurant"} Business Intelligence
                        </h2>
                        <p className="theme-muted-strong mt-1.5 max-w-2xl text-xs sm:text-sm">
                            Real-time order throughput, peak rush forecasting, menu popularity, and operational metrics.
                        </p>
                    </div>

                    {/* Frame Selectors & Controls */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div
                            className="inline-flex items-center gap-1 rounded-2xl border p-1"
                            style={{
                                borderColor: "var(--app-border)",
                                background: "color-mix(in srgb, var(--app-surface) 80%, transparent)",
                            }}
                        >
                            {RANGE_CONFIG.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setRange(opt.key)}
                                    className="min-w-[64px] whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200"
                                    style={getRangeButtonStyle(range === opt.key)}
                                    title={opt.sublabel}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200"
                            style={{
                                borderColor: "var(--app-border)",
                                background: autoRefresh
                                    ? "color-mix(in srgb, var(--app-primary) 15%, transparent)"
                                    : "transparent",
                                color: autoRefresh ? "var(--app-primary-hover)" : "var(--app-muted)",
                            }}
                        >
                            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {autoRefresh ? "Live Sync ON" : "Live Sync OFF"}
                        </button>

                        <button
                            type="button"
                            onClick={() => fetchAnalytics({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200 disabled:opacity-60"
                            style={{
                                borderColor: "var(--app-border)",
                                background: "color-mix(in srgb, var(--app-primary) 10%, transparent)",
                                color: "var(--app-text)",
                            }}
                        >
                            {refreshing ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                            Refresh
                        </button>
                    </div>
                </div>
            </article>

            {error && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
                    {error}
                </div>
            )}

            {/* Core KPI Metrics Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <span className="theme-muted text-xs font-semibold uppercase tracking-wider">Revenue</span>
                        <Wallet size={18} className="theme-price" />
                    </div>
                    <p className="mt-2 text-2xl font-black sm:text-[28px]">{formatMoney(overview.totalRevenue)}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                        {overview.revenueGrowthPct >= 0 ? (
                            <span className="inline-flex items-center font-bold text-emerald-400">
                                <ArrowUpRight size={14} />+{overview.revenueGrowthPct}%
                            </span>
                        ) : (
                            <span className="inline-flex items-center font-bold text-rose-400">
                                <ArrowDownRight size={14} />{overview.revenueGrowthPct}%
                            </span>
                        )}
                        <span className="theme-muted">vs prev period</span>
                    </div>
                </article>

                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <span className="theme-muted text-xs font-semibold uppercase tracking-wider">Orders</span>
                        <ShoppingBag size={18} className="theme-price" />
                    </div>
                    <p className="mt-2 text-2xl font-black sm:text-[28px]">{overview.totalOrders || 0}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                        {overview.ordersGrowthPct >= 0 ? (
                            <span className="inline-flex items-center font-bold text-emerald-400">
                                <ArrowUpRight size={14} />+{overview.ordersGrowthPct}%
                            </span>
                        ) : (
                            <span className="inline-flex items-center font-bold text-rose-400">
                                <ArrowDownRight size={14} />{overview.ordersGrowthPct}%
                            </span>
                        )}
                        <span className="theme-muted">volume growth</span>
                    </div>
                </article>

                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <span className="theme-muted text-xs font-semibold uppercase tracking-wider">Avg Ticket</span>
                        <TrendingUp size={18} className="theme-price" />
                    </div>
                    <p className="mt-2 text-2xl font-black sm:text-[28px]">{formatMoney(overview.avgOrderValue)}</p>
                    <p className="theme-muted mt-2 text-xs">Average basket size</p>
                </article>

                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <span className="theme-muted text-xs font-semibold uppercase tracking-wider">Kitchen Queue</span>
                        <Clock size={18} className="theme-price" />
                    </div>
                    <p className="mt-2 text-2xl font-black sm:text-[28px]">{realtime.activeQueue || 0}</p>
                    <p className="theme-price mt-2 text-xs font-semibold">
                        Avg prep: {realtime.avgPrepMinutes || 16} mins
                    </p>
                </article>

                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <span className="theme-muted text-xs font-semibold uppercase tracking-wider">Completion</span>
                        <CheckCircle2 size={18} className="text-emerald-400" />
                    </div>
                    <p className="mt-2 text-2xl font-black sm:text-[28px]">{formatPct(overview.completionRate)}</p>
                    <p className="mt-2 text-xs text-rose-300">
                        Cancel: {formatPct(overview.cancellationRate)}
                    </p>
                </article>

                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <span className="theme-muted text-xs font-semibold uppercase tracking-wider">Customers</span>
                        <Users size={18} className="theme-price" />
                    </div>
                    <p className="mt-2 text-2xl font-black sm:text-[28px]">{overview.uniqueCustomers || 0}</p>
                    <p className="theme-muted mt-2 text-xs">
                        Repeat rate: <span className="font-bold text-amber-400">{overview.repeatCustomerPct}%</span>
                    </p>
                </article>
            </div>

            {/* Waveform Chart & Peak Rush Window */}
            <div className="grid gap-6 xl:grid-cols-3">
                {/* Demand & Revenue Trajectory Area Chart */}
                <article className={`${panelClass} xl:col-span-2`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                                Demand & Revenue Waveform
                            </h3>
                            <p className="theme-muted mt-1 text-xs">
                                Showing order velocity and gross revenue across the {range} window.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1.5 font-semibold text-amber-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Revenue
                            </span>
                            <span className="flex items-center gap-1.5 font-semibold text-sky-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Orders
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" opacity={0.6} />
                                <XAxis
                                    dataKey="label"
                                    stroke="var(--app-muted)"
                                    fontSize={11}
                                    tickLine={false}
                                    interval={range === "30d" ? 3 : range === "24h" ? 2 : 0}
                                />
                                <YAxis yAxisId="left" stroke="var(--app-muted)" fontSize={11} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="var(--app-muted)" fontSize={11} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "14px",
                                        border: "1px solid var(--app-border)",
                                        background: "var(--app-surface)",
                                        color: "var(--app-text)",
                                        boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                                    }}
                                    formatter={(value, name) => {
                                        if (name === "Revenue") return [formatMoney(value), "Revenue"];
                                        return [value, "Orders"];
                                    }}
                                />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="revenue"
                                    name="Revenue"
                                    stroke="#f59e0b"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#revenueGrad)"
                                />
                                <Area
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="orders"
                                    name="Orders"
                                    stroke="#38bdf8"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#orderGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                {/* AI Radar & Demand Forecast */}
                <article className={panelClass}>
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={20} className="theme-price" />
                        <h3 className="text-xl font-black tracking-tight">AI Demand Radar</h3>
                    </div>
                    <p className="theme-muted mt-1 text-xs">
                        Intelligent end-of-day projection and operational rush windows.
                    </p>

                    <div className="mt-5 space-y-3.5">
                        <div className={subPanelClass} style={subPanelStyle}>
                            <span className="theme-muted text-xs uppercase tracking-wider">Today Run-Rate</span>
                            <div className="mt-1 flex items-baseline justify-between">
                                <p className="text-2xl font-black">{formatMoney(forecast.todayRevenue)}</p>
                                <span className="theme-price text-xs font-bold">
                                    {formatMoney(forecast.runRatePerHour)}/hr
                                </span>
                            </div>
                            <div className="mt-2 text-xs theme-muted">
                                Today's orders so far: <span className="font-bold">{forecast.todayOrdersCount || 0}</span>
                            </div>
                        </div>

                        <div className={subPanelClass} style={subPanelStyle}>
                            <span className="theme-muted text-xs uppercase tracking-wider">EOD Projection</span>
                            <div className="mt-1 flex items-baseline justify-between">
                                <p className="text-2xl font-black text-amber-400">
                                    {formatMoney(forecast.projectedEodRevenue)}
                                </p>
                                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                                    {String(forecast.confidence || "MEDIUM").toUpperCase()} CONFIDENCE
                                </span>
                            </div>
                            <p className="theme-muted mt-2 text-xs">
                                Based on historic hourly velocity and remaining service hours.
                            </p>
                        </div>

                        {peakWindows.length > 0 && (
                            <div className={subPanelClass} style={subPanelStyle}>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                    <Flame size={14} /> Peak Rush Window
                                </div>
                                <p className="mt-1 text-lg font-bold">{peakWindows[0].label}</p>
                                <p className="theme-muted text-xs">
                                    {peakWindows[0].orders} orders concentrated ({formatMoney(peakWindows[0].revenue)})
                                </p>
                            </div>
                        )}
                    </div>
                </article>
            </div>

            {/* Peak Rush Hours Heatmap & Operations Schedule */}
            <article className={panelClass}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                            Peak Hours & Service Load Heatmap
                        </h3>
                        <p className="theme-muted mt-1 text-xs">
                            Order density across operational hours (08:00 to 23:00) to optimize kitchen staffing & stations.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {peakWindows.map((pw, i) => (
                            <span
                                key={pw.label}
                                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-bold text-amber-300"
                            >
                                #{i + 1} {pw.label} ({pw.orders} orders)
                            </span>
                        ))}
                    </div>
                </div>

                <div className="mt-6 h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyRush} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" opacity={0.5} />
                            <XAxis dataKey="label" stroke="var(--app-muted)" fontSize={11} tickLine={false} />
                            <YAxis stroke="var(--app-muted)" fontSize={11} tickLine={false} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: "14px",
                                    border: "1px solid var(--app-border)",
                                    background: "var(--app-surface)",
                                    color: "var(--app-text)",
                                }}
                                formatter={(value, name) => [
                                    name === "orders" ? `${value} orders` : formatMoney(value),
                                    name === "orders" ? "Volume" : "Revenue",
                                ]}
                            />
                            <Bar dataKey="orders" name="orders" radius={[6, 6, 0, 0]}>
                                {hourlyRush.map((entry, index) => {
                                    const isPeak = (Number(entry.orders || 0) / maxHourlyOrders) > 0.7;
                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={isPeak ? "var(--app-primary)" : "color-mix(in srgb, var(--app-primary) 35%, var(--app-border))"}
                                        />
                                    );
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </article>

            {/* Category Intelligence & Payment Breakdown */}
            <div className="grid gap-6 xl:grid-cols-2">
                {/* Category Donut & Breakdown */}
                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                                Category Revenue Mix
                            </h3>
                            <p className="theme-muted mt-1 text-xs">Gross sales contribution by food & beverage section.</p>
                        </div>
                        <Sparkles size={18} className="theme-price" />
                    </div>

                    <div className="mt-5 grid items-center gap-6 sm:grid-cols-2">
                        <div className="relative h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={renderedPieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        paddingAngle={hasCategoryPieData ? 3 : 0}
                                        stroke="var(--app-surface)"
                                        strokeWidth={3}
                                    >
                                        {renderedPieData.map((entry, index) => (
                                            <Cell
                                                key={`${entry.name}-${index}`}
                                                fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => [formatMoney(value), name]}
                                        contentStyle={{
                                            borderRadius: "12px",
                                            border: "1px solid var(--app-border)",
                                            background: "var(--app-surface)",
                                            color: "var(--app-text)",
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 grid place-items-center">
                                <div className="text-center">
                                    <p className="theme-muted text-[10px] font-bold uppercase tracking-widest">
                                        Total Sales
                                    </p>
                                    <p className="mt-1 text-base font-black">
                                        {hasCategoryPieData ? formatMoney(totalCategoryRevenue) : "--"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            {categories.slice(0, 6).map((cat, idx) => {
                                const width = (Number(cat.revenue || 0) / maxCategoryRevenue) * 100;
                                return (
                                    <div key={cat.name} className="text-xs">
                                        <div className="flex items-center justify-between font-semibold">
                                            <span className="flex items-center gap-1.5">
                                                <span
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                                                />
                                                {cat.name}
                                            </span>
                                            <span className="font-bold theme-price">{formatMoney(cat.revenue)}</span>
                                        </div>
                                        <div className="mt-1 h-1.5 w-full rounded-full" style={chartTrackStyle}>
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${Math.max(6, width)}%`,
                                                    background: PIE_COLORS[idx % PIE_COLORS.length],
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </article>

                {/* Payment Methods & Channels */}
                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                                Payments & Fulfillment Channels
                            </h3>
                            <p className="theme-muted mt-1 text-xs">Payment method preference and dining style split.</p>
                        </div>
                        <CreditCard size={18} className="theme-price" />
                    </div>

                    <div className="mt-5 space-y-4">
                        <div>
                            <p className="theme-muted text-xs font-bold uppercase tracking-wider">Payment Mode Share</p>
                            <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {paymentModes.map((pm) => (
                                    <div key={pm.mode} className={subPanelClass} style={subPanelStyle}>
                                        <span className="text-xs font-semibold">{pm.mode}</span>
                                        <p className="mt-1 text-lg font-black">{pm.pct}%</p>
                                        <p className="theme-muted text-[11px]">{pm.count} orders</p>
                                        <p className="theme-price mt-0.5 text-xs font-bold">{formatMoney(pm.revenue)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2">
                            <p className="theme-muted text-xs font-bold uppercase tracking-wider">Dining Channels</p>
                            <div className="mt-2.5 grid grid-cols-3 gap-3">
                                {channels.map((ch) => (
                                    <div key={ch.channel} className={subPanelClass} style={subPanelStyle}>
                                        <span className="text-xs font-semibold">{ch.channel}</span>
                                        <p className="mt-1 text-lg font-black">{ch.pct}%</p>
                                        <p className="theme-muted text-[11px]">{ch.count} orders</p>
                                        <p className="theme-price mt-0.5 text-xs font-bold">{formatMoney(ch.revenue)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </article>
            </div>

            {/* Top Items & Table Turn Heatmap */}
            <div className="grid gap-6 xl:grid-cols-3">
                {/* Top Moving Menu Items */}
                <article className={`${panelClass} xl:col-span-2`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                                Top Moving Menu Items
                            </h3>
                            <p className="theme-muted mt-1 text-xs">Ranked by unit velocity and revenue contribution.</p>
                        </div>
                        <UtensilsCrossed size={18} className="theme-price" />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {topItems.map((item, index) => {
                            const width = (Number(item.qty || 0) / maxTopQty) * 100;
                            return (
                                <div key={item.name} className={subPanelClass} style={subPanelStyle}>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold truncate">
                                            <span className="theme-price mr-1.5">#{index + 1}</span>
                                            {item.name}
                                        </p>
                                        <p className="theme-price text-sm font-black whitespace-nowrap">
                                            {formatMoney(item.revenue)}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 h-2 rounded-full" style={chartTrackStyle}>
                                        <div
                                            className="h-full rounded-full bg-[var(--app-primary)]"
                                            style={{ width: `${Math.max(8, width)}%` }}
                                        />
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-xs theme-muted">
                                        <span>{item.qty} units sold</span>
                                        <span>Avg: {formatMoney(item.revenue / Math.max(1, item.qty))}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </article>

                {/* Table Turn & Utilization Heatmap */}
                <article className={panelClass}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                                Table Turn Heatmap
                            </h3>
                            <p className="theme-muted mt-1 text-xs">Dining table seatings & gross yield.</p>
                        </div>
                        <Layers size={18} className="theme-price" />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        {tableHeatmap.map((tbl) => {
                            const glow = (Number(tbl.orders || 0) / maxTableOrders) * 100;
                            return (
                                <div
                                    key={tbl.tableNo}
                                    className={subPanelClass}
                                    style={{
                                        ...subPanelStyle,
                                        boxShadow: `inset 0 0 ${Math.max(6, glow / 4)}px color-mix(in srgb, var(--app-primary) 30%, transparent)`,
                                    }}
                                >
                                    <p className="text-sm font-black">{tbl.tableNo}</p>
                                    <p className="theme-muted mt-1 text-xs">{tbl.orders} turn(s)</p>
                                    <p className="theme-price mt-0.5 text-xs font-bold">{formatMoney(tbl.revenue)}</p>
                                </div>
                            );
                        })}
                        {tableHeatmap.length === 0 && (
                            <p className="col-span-2 text-center text-xs theme-muted py-6">
                                No dining table turns recorded for this period.
                            </p>
                        )}
                    </div>
                </article>
            </div>

            {/* Smart Alerts & Actionable Operational Guidance */}
            <article className={panelClass}>
                <div className="flex items-center gap-2">
                    <Bot size={20} className="theme-price" />
                    <h3 className="text-xl font-black tracking-tight">Smart Operational Intelligence Alerts</h3>
                </div>
                <p className="theme-muted mt-1 text-xs">
                    Automated anomaly detection and actionable suggestions based on customer ordering trends.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {insights.map((alert, i) => {
                        const isWarn = alert.level === "warning";
                        const isSuccess = alert.level === "success";
                        return (
                            <div
                                key={i}
                                className={`rounded-2xl border p-4 transition-all duration-200 ${
                                    isWarn
                                        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                                        : isSuccess
                                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                                        : "border-sky-400/40 bg-sky-400/10 text-sky-200"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    {isWarn ? (
                                        <AlertCircle size={16} className="text-amber-400" />
                                    ) : isSuccess ? (
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                    ) : (
                                        <Sparkles size={16} className="text-sky-400" />
                                    )}
                                    <h4 className="text-sm font-bold">{alert.title}</h4>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed opacity-90">{alert.description}</p>
                            </div>
                        );
                    })}
                </div>
            </article>
        </section>
    );
}
