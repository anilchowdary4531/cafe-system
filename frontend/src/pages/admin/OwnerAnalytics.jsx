import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Activity,
    AlarmClockCheck,
    Bot,
    BrainCircuit,
    ChartColumnIncreasing,
    LoaderCircle,
    RefreshCcw,
    Sparkles,
    TrendingUp,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { API } from "../../config";

const RANGE_OPTIONS = ["24h", "7d", "30d"];
const REFRESH_MS = 15000;

const formatMoney = (value) => `\u20B9${Number(value || 0).toFixed(2)}`;
const formatPct = (value) => `${Number(value || 0).toFixed(1)}%`;

const insightClasses = {
    warning: "border-amber-300/40 bg-amber-400/10",
    success: "border-emerald-300/40 bg-emerald-400/10",
    info: "border-cyan-300/40 bg-cyan-400/10",
};

const statusColors = {
    PLACED: "from-sky-400 to-blue-500",
    ACCEPTED: "from-indigo-400 to-indigo-500",
    PREPARING: "from-amber-400 to-orange-500",
    READY: "from-lime-400 to-emerald-500",
    DELIVERED: "from-emerald-400 to-teal-500",
    CANCELLED: "from-rose-400 to-rose-500",
};

const panelClass = "theme-card rounded-[20px] border p-4 sm:p-5";
const subPanelClass = "rounded-[14px] border p-3.5 sm:p-4";

const PIE_COLORS = [
    "var(--app-primary)",
    "var(--app-accent)",
    "var(--app-primary-hover)",
    "#60a5fa",
    "#a78bfa",
    "#f472b6",
];

const subPanelStyle = {
    borderColor: "var(--app-border)",
    background: "var(--app-surface-2)",
    color: "var(--app-text)",
};

const chartTrackStyle = {
    background: "var(--app-border)",
};

const controlRailStyle = {
    borderColor: "var(--app-border)",
    background: "color-mix(in srgb, var(--app-surface) 72%, transparent)",
    boxShadow: "0 8px 24px color-mix(in srgb, var(--app-bg) 28%, transparent)",
};

const getRangeButtonStyle = (active) =>
    active
        ? {
              background: "var(--app-primary)",
              color: "var(--app-primary-text)",
              boxShadow: "0 8px 18px color-mix(in srgb, var(--app-primary) 30%, transparent)",
          }
        : {
              background: "transparent",
              color: "var(--app-muted-strong)",
          };

const getLiveButtonStyle = (active) =>
    active
        ? {
              borderColor: "color-mix(in srgb, var(--app-primary) 70%, var(--app-border) 30%)",
              background: "color-mix(in srgb, var(--app-primary) 20%, transparent)",
              color: "var(--app-text)",
          }
        : {
              borderColor: "var(--app-border)",
              background: "color-mix(in srgb, var(--app-surface) 72%, transparent)",
              color: "var(--app-muted-strong)",
          };

const refreshButtonStyle = {
    borderColor: "color-mix(in srgb, var(--app-primary) 45%, var(--app-border) 55%)",
    background: "color-mix(in srgb, var(--app-primary) 12%, transparent)",
    color: "var(--app-text)",
};

export default function OwnerAnalytics() {
    const [data, setData] = useState(null);
    const [range, setRange] = useState("7d");
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
            setError("Restaurant id missing for current owner.");
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
            console.log(err);
            setError(err?.response?.data?.message || "Failed to load analytics.");
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

    const peakSlot = data?.charts?.peakWindows?.[0];
    const series = (data?.charts?.timeseries || []).slice(-12);
    const topItems = data?.charts?.topItems || [];
    const categories = (data?.charts?.categories || []).slice(0, 6);
    const tableHeatmap = data?.charts?.tableHeatmap || [];

    const categoryPieData = categories.map((cat, index) => ({
        name: cat.name,
        value: Number(cat.revenue || 0),
        color: PIE_COLORS[index % PIE_COLORS.length],
    }));

    const maxSeriesOrders = Math.max(
        1,
        ...series.map((point) => Number(point.orders || 0))
    );
    const maxTopQty = Math.max(
        1,
        ...topItems.map((item) => Number(item.qty || 0))
    );
    const maxCategoryRevenue = Math.max(
        1,
        ...categories.map((item) => Number(item.revenue || 0))
    );
    const maxTableOrders = Math.max(
        1,
        ...tableHeatmap.map((table) => Number(table.orders || 0))
    );
    const totalOrders = Math.max(1, Number(data?.overview?.totalOrders || 0));

    const totalCategoryRevenue = categoryPieData.reduce(
        (sum, item) => sum + Number(item.value || 0),
        0
    );
    const hasCategoryPieData = categoryPieData.some((item) => Number(item.value || 0) > 0);
    const renderedPieData = hasCategoryPieData
        ? categoryPieData
        : [{ name: "No Data", value: 1, color: "var(--app-border-strong)" }];

    if (loading) {
        return (
            <div className={panelClass}>
                <p className="text-sm theme-muted-strong">Loading analytics engine...</p>
            </div>
        );
    }

    return (
        <section className="space-y-4 text-[15px]" style={{ color: "var(--app-text)" }}>
            <article className="theme-hero-band relative overflow-hidden rounded-[28px] px-5 py-6 sm:px-7">
                <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-black/15 blur-3xl" />

                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="theme-price text-[11px] uppercase tracking-[0.26em]">
                            Neural Analytics Grid
                        </p>
                        <h3 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">
                            {data?.restaurant?.name || "Restaurant"} Intelligence
                        </h3>
                        <p className="theme-muted-strong mt-2 text-sm sm:text-base">
                            Real-time operations, demand prediction, and kitchen risk monitoring.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2.5">
                        <div
                            className="inline-flex items-center gap-1 rounded-2xl border p-1"
                            style={controlRailStyle}
                        >
                            {RANGE_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setRange(option)}
                                    className="min-w-[52px] whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                                    style={getRangeButtonStyle(range === option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200"
                            style={getLiveButtonStyle(autoRefresh)}
                        >
                            <span
                                className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-400" : "bg-slate-400"}`}
                            />
                            {autoRefresh ? "Live ON" : "Live OFF"}
                        </button>

                        <button
                            type="button"
                            onClick={() => fetchAnalytics({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200 disabled:opacity-60"
                            style={refreshButtonStyle}
                        >
                            {refreshing ? (
                                <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                                <RefreshCcw size={14} />
                            )}
                            Refresh
                        </button>
                    </div>
                </div>
            </article>

            {error && (
                <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className={panelClass}>
                    <p className="theme-muted-strong text-lg sm:text-xl">Total Revenue</p>
                    <p className="mt-2 text-[30px] font-black leading-none sm:text-[34px]">
                        {formatMoney(data?.overview?.totalRevenue)}
                    </p>
                    <p className="theme-price mt-3 text-sm">
                        <TrendingUp size={12} className="mr-1 inline" />
                        Avg ticket {formatMoney(data?.overview?.avgOrderValue)}
                    </p>
                </article>

                <article className={panelClass}>
                    <p className="theme-muted-strong text-lg sm:text-xl">Kitchen Queue</p>
                    <p className="mt-2 text-[30px] font-black leading-none sm:text-[34px]">
                        {data?.realtime?.activeQueue || 0}
                    </p>
                    <p className="theme-price mt-3 text-sm">
                        <AlarmClockCheck size={12} className="mr-1 inline" />
                        Delayed {data?.realtime?.delayedTickets || 0}
                    </p>
                </article>

                <article className={panelClass}>
                    <p className="theme-muted-strong text-lg sm:text-xl">Completion Rate</p>
                    <p className="mt-2 text-[30px] font-black leading-none sm:text-[34px]">
                        {formatPct(data?.overview?.completionRate)}
                    </p>
                    <p className="mt-3 text-sm text-rose-300">
                        Cancel {formatPct(data?.overview?.cancellationRate)}
                    </p>
                </article>

                <article className={panelClass}>
                    <p className="theme-muted-strong text-lg sm:text-xl">Forecast EOD</p>
                    <p className="mt-2 text-[30px] font-black leading-none sm:text-[34px]">
                        {formatMoney(data?.forecast?.projectedEodRevenue)}
                    </p>
                    <p className="mt-3 text-sm text-violet-300">
                        Confidence: {String(data?.forecast?.confidence || "low").toUpperCase()}
                    </p>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <article className={`${panelClass} xl:col-span-2`}>
                    <div className="flex items-center justify-between">
                        <h4 className="text-2xl font-extrabold sm:text-[28px]">Demand Waveform</h4>
                        <span className="theme-muted-strong text-sm">{range} window</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-3 gap-y-4">
                        {series.map((point) => {
                            const pct = Math.min(
                                100,
                                Math.max(
                                    18,
                                    Math.round((Number(point.orders || 0) / maxSeriesOrders) * 100)
                                )
                            );

                            return (
                                <div key={point.ts} className="w-[80px]">
                                    <div className="h-3 rounded-full p-[1px]" style={chartTrackStyle}>
                                        <div
                                            className="h-full rounded-full bg-[var(--app-primary)]"
                                            style={{ width: `${pct}%` }}
                                            title={`${point.label}: ${point.orders} order(s), ${formatMoney(point.revenue)}`}
                                        />
                                    </div>
                                    <p className="theme-muted mt-2 text-center text-xs">{point.label}</p>
                                </div>
                            );
                        })}
                        {series.length === 0 && (
                            <p className="theme-muted text-sm">No demand data in this window.</p>
                        )}
                    </div>
                </article>

                <article className={panelClass}>
                    <h4 className="flex items-center gap-2 text-2xl font-extrabold sm:text-[28px]">
                        <BrainCircuit size={18} className="theme-price" />
                        AI Radar
                    </h4>
                    <div className="mt-5 space-y-3">
                        <div className={subPanelClass} style={subPanelStyle}>
                            <p className="theme-muted-strong text-lg">Today Revenue</p>
                            <p className="mt-1.5 text-[28px] font-black leading-none sm:text-[32px]">
                                {formatMoney(data?.forecast?.todayRevenue)}
                            </p>
                            <p className="theme-muted mt-2 text-sm">
                                Run-rate {formatMoney(data?.forecast?.runRatePerHour)}/hr
                            </p>
                        </div>

                        <div className={subPanelClass} style={subPanelStyle}>
                            <p className="theme-muted-strong text-lg">Peak Demand Window</p>
                            <p className="theme-price mt-1.5 text-xl font-bold sm:text-2xl">
                                {peakSlot ? peakSlot.label : "No peak yet"}
                            </p>
                            <p className="theme-muted mt-2 text-sm">
                                {peakSlot ? `${peakSlot.orders} orders` : "Insufficient data"}
                            </p>
                        </div>
                    </div>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <article className={panelClass}>
                    <h4 className="flex items-center gap-2 text-2xl font-extrabold sm:text-[28px]">
                        <Activity size={18} className="theme-price" />
                        Kitchen Flow
                    </h4>
                    <div className="mt-5 space-y-3.5">
                        {(data?.statusFunnel || []).map((row) => {
                            const pct = (Number(row.count || 0) / totalOrders) * 100;
                            const gradient = statusColors[row.status] || "from-slate-400 to-slate-500";

                            return (
                                <div key={row.status}>
                                    <div className="mb-1.5 flex items-center justify-between text-sm sm:text-base">
                                        <span>{row.status}</span>
                                        <span>{row.count}</span>
                                    </div>
                                    <div className="h-2.5 rounded-full" style={chartTrackStyle}>
                                        <div
                                            className={`h-2.5 rounded-full bg-gradient-to-r ${gradient}`}
                                            style={{ width: `${Math.max(6, pct)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {(data?.statusFunnel || []).length === 0 && (
                            <p className="theme-muted text-sm">No order flow yet.</p>
                        )}
                    </div>
                </article>

                <article className={`${panelClass} xl:col-span-2`}>
                    <h4 className="flex items-center gap-2 text-2xl font-extrabold sm:text-[28px]">
                        <ChartColumnIncreasing size={18} className="theme-price" />
                        Top Movers
                    </h4>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {topItems.map((item, index) => {
                            const width = (Number(item.qty || 0) / maxTopQty) * 100;
                            return (
                                <div key={item.name} className={subPanelClass} style={subPanelStyle}>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold sm:text-base">
                                            {index + 1}. {item.name}
                                        </p>
                                        <p className="theme-price text-sm">{formatMoney(item.revenue)}</p>
                                    </div>
                                    <div className="mt-2.5 h-2.5 rounded-full" style={chartTrackStyle}>
                                        <div
                                            className="h-2.5 rounded-full bg-[var(--app-primary)]"
                                            style={{ width: `${Math.max(8, width)}%` }}
                                        />
                                    </div>
                                    <p className="theme-muted mt-2 text-sm">{item.qty} qty sold</p>
                                </div>
                            );
                        })}
                        {topItems.length === 0 && (
                        <p className="theme-muted text-sm">No item movement data yet.</p>
                        )}
                    </div>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <article className={panelClass}>
                    <h4 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
                        <Bot size={17} className="theme-price" />
                        Smart Alerts
                    </h4>
                    <div className="mt-4 space-y-3">
                        {(data?.insights || []).map((insight) => (
                            <div
                                key={`${insight.level}-${insight.title}`}
                                className={`rounded-xl border p-3 ${insightClasses[insight.level] || insightClasses.info}`}
                            >
                                <p className="text-sm font-semibold">{insight.title}</p>
                                <p className="theme-muted mt-1 text-xs">{insight.description}</p>
                            </div>
                        ))}
                        {(data?.insights || []).length === 0 && (
                            <div className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 p-3 text-sm">
                                No major risks detected right now.
                            </div>
                        )}
                    </div>
                </article>

                <article className={panelClass}>
                    <h4 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
                        <Sparkles size={17} className="theme-price" />
                        Category Intelligence
                    </h4>
                    <div className={`${subPanelClass} mt-4`} style={subPanelStyle}>
                        <div className="relative h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={renderedPieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={52}
                                        outerRadius={84}
                                        paddingAngle={hasCategoryPieData ? 2 : 0}
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
                                        formatter={(value, name) => {
                                            if (!hasCategoryPieData) return ["No revenue yet", name];
                                            return [formatMoney(value), name];
                                        }}
                                        contentStyle={{
                                            borderRadius: "10px",
                                            border: "1px solid var(--app-border)",
                                            background: "var(--app-surface)",
                                            color: "var(--app-text)",
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 grid place-items-center">
                                <div className="text-center">
                                    <p className="theme-muted text-[11px] uppercase tracking-[0.12em]">
                                        {hasCategoryPieData ? "Revenue Mix" : "Awaiting Data"}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {hasCategoryPieData ? formatMoney(totalCategoryRevenue) : "--"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 space-y-3">
                        {categories.map((cat) => {
                            const width = (Number(cat.revenue || 0) / maxCategoryRevenue) * 100;
                            return (
                                <div key={cat.name}>
                                    <div className="mb-1.5 flex items-center justify-between text-sm">
                                        <span>{cat.name}</span>
                                        <span className="theme-price">{formatMoney(cat.revenue)}</span>
                                    </div>
                                    <div className="h-2.5 rounded-full" style={chartTrackStyle}>
                                        <div
                                            className="h-2.5 rounded-full bg-[var(--app-primary)]"
                                            style={{ width: `${Math.max(8, width)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {categories.length === 0 && (
                            <p className="theme-muted text-sm">No category analytics yet.</p>
                        )}
                    </div>
                </article>
            </div>

            <article className={panelClass}>
                <h4 className="text-xl font-extrabold sm:text-2xl">Table Heatmap</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {tableHeatmap.map((table) => {
                        const glow = (Number(table.orders || 0) / maxTableOrders) * 100;
                        return (
                            <div
                                key={table.tableNo}
                                className={subPanelClass}
                                style={{
                                    ...subPanelStyle,
                                    boxShadow: `inset 0 0 ${Math.max(8, glow / 3)}px color-mix(in srgb, var(--app-primary) 24%, transparent)`,
                                }}
                            >
                                <p className="text-sm font-semibold sm:text-base">{table.tableNo}</p>
                                <p className="theme-muted mt-1 text-sm">{table.orders} orders</p>
                                <p className="theme-price text-sm">{formatMoney(table.revenue)} revenue</p>
                            </div>
                        );
                    })}
                    {tableHeatmap.length === 0 && (
                        <p className="theme-muted text-sm">No table usage data for selected range.</p>
                    )}
                </div>
            </article>
        </section>
    );
}
