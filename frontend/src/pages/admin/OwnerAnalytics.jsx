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
import { API } from "../../config";

const RANGE_OPTIONS = ["24h", "7d", "30d"];
const REFRESH_MS = 15000;

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;
const formatPct = (value) => `${Number(value || 0).toFixed(1)}%`;

const insightClasses = {
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
};

const statusColors = {
    PLACED: "from-blue-400 to-blue-600",
    ACCEPTED: "from-indigo-400 to-indigo-600",
    PREPARING: "from-amber-400 to-amber-600",
    READY: "from-lime-400 to-lime-600",
    DELIVERED: "from-emerald-400 to-emerald-600",
    CANCELLED: "from-rose-400 to-rose-600",
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
    const maxSeriesOrders = Math.max(
        1,
        ...(data?.charts?.timeseries || []).map((point) => Number(point.orders || 0))
    );
    const maxTopQty = Math.max(
        1,
        ...(data?.charts?.topItems || []).map((item) => Number(item.qty || 0))
    );
    const maxCategoryRevenue = Math.max(
        1,
        ...(data?.charts?.categories || []).map((item) => Number(item.revenue || 0))
    );
    const maxTableOrders = Math.max(
        1,
        ...(data?.charts?.tableHeatmap || []).map((table) => Number(table.orders || 0))
    );

    if (loading) {
        return (
            <div className="rounded-3xl border border-white/10 bg-[#111827] p-7 text-gray-300">
                Loading analytics engine...
            </div>
        );
    }

    return (
        <section className="space-y-5">
            <article className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#0f172a] via-[#071a2d] to-[#10233c] p-6">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-orange-400/20 blur-3xl" />

                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">
                            Neural Analytics Grid
                        </p>
                        <h3 className="mt-1 text-3xl font-bold text-white">
                            {data?.restaurant?.name || "Restaurant"} Intelligence
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                            Real-time operations, demand prediction, and kitchen risk monitoring.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setRange(option)}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                                    range === option
                                        ? "border-cyan-300 bg-cyan-300/20 text-cyan-200"
                                        : "border-white/15 bg-white/5 text-slate-300"
                                }`}
                            >
                                {option}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className={`rounded-lg border px-3 py-1.5 text-sm ${
                                autoRefresh
                                    ? "border-emerald-300 bg-emerald-300/20 text-emerald-200"
                                    : "border-white/15 bg-white/5 text-slate-300"
                            }`}
                        >
                            {autoRefresh ? "Live ON" : "Live OFF"}
                        </button>

                        <button
                            type="button"
                            onClick={() => fetchAnalytics({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-lg border border-orange-300/40 bg-orange-300/10 px-3 py-1.5 text-sm text-orange-200 disabled:opacity-60"
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
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Total Revenue</p>
                    <p className="mt-2 text-2xl font-bold">{formatMoney(data?.overview?.totalRevenue)}</p>
                    <p className="mt-1 text-xs text-cyan-300">
                        <TrendingUp size={12} className="mr-1 inline" />
                        Avg ticket {formatMoney(data?.overview?.avgOrderValue)}
                    </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Kitchen Queue</p>
                    <p className="mt-2 text-2xl font-bold">{data?.realtime?.activeQueue || 0}</p>
                    <p className="mt-1 text-xs text-amber-300">
                        <AlarmClockCheck size={12} className="mr-1 inline" />
                        Delayed {data?.realtime?.delayedTickets || 0}
                    </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Completion Rate</p>
                    <p className="mt-2 text-2xl font-bold">
                        {formatPct(data?.overview?.completionRate)}
                    </p>
                    <p className="mt-1 text-xs text-rose-300">
                        Cancel {formatPct(data?.overview?.cancellationRate)}
                    </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-4">
                    <p className="text-xs text-gray-400">Forecast EOD</p>
                    <p className="mt-2 text-2xl font-bold">
                        {formatMoney(data?.forecast?.projectedEodRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-violet-300">
                        Confidence: {String(data?.forecast?.confidence || "low").toUpperCase()}
                    </p>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5 xl:col-span-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold">Demand Waveform</h4>
                        <span className="text-xs text-gray-400">{range} window</span>
                    </div>
                    <div className="mt-4 grid grid-cols-12 gap-2">
                        {(data?.charts?.timeseries || []).slice(-12).map((point) => {
                            const h = Math.max(
                                10,
                                Math.round((Number(point.orders || 0) / maxSeriesOrders) * 110)
                            );
                            return (
                                <div key={point.ts} className="flex flex-col items-center gap-1">
                                    <div
                                        className="w-full rounded-md bg-gradient-to-t from-cyan-500/40 to-blue-500/80"
                                        style={{ height: `${h}px` }}
                                        title={`${point.label}: ${point.orders} order(s), ${formatMoney(
                                            point.revenue
                                        )}`}
                                    />
                                    <span className="text-[10px] text-gray-500">{point.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="flex items-center gap-2 text-lg font-semibold">
                        <BrainCircuit size={17} className="text-cyan-300" />
                        AI Radar
                    </h4>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
                            <p className="text-xs text-gray-400">Today Revenue</p>
                            <p className="mt-1 text-xl font-semibold">
                                {formatMoney(data?.forecast?.todayRevenue)}
                            </p>
                            <p className="text-xs text-gray-500">
                                Run-rate {formatMoney(data?.forecast?.runRatePerHour)}/hr
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
                            <p className="text-xs text-gray-400">Peak Demand Window</p>
                            <p className="mt-1 font-semibold text-cyan-300">
                                {peakSlot ? peakSlot.label : "No peak yet"}
                            </p>
                            <p className="text-xs text-gray-500">
                                {peakSlot ? `${peakSlot.orders} orders` : "Insufficient data"}
                            </p>
                        </div>
                    </div>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="flex items-center gap-2 text-lg font-semibold">
                        <Activity size={17} className="text-orange-300" />
                        Kitchen Flow
                    </h4>
                    <div className="mt-4 space-y-3">
                        {(data?.statusFunnel || []).map((row) => {
                            const max = Math.max(1, data?.overview?.totalOrders || 1);
                            const pct = (Number(row.count || 0) / max) * 100;
                            const gradient = statusColors[row.status] || "from-slate-400 to-slate-600";

                            return (
                                <div key={row.status}>
                                    <div className="mb-1 flex items-center justify-between text-xs text-gray-300">
                                        <span>{row.status}</span>
                                        <span>{row.count}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-white/10">
                                        <div
                                            className={`h-2 rounded-full bg-gradient-to-r ${gradient}`}
                                            style={{ width: `${Math.max(5, pct)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5 xl:col-span-2">
                    <h4 className="flex items-center gap-2 text-lg font-semibold">
                        <ChartColumnIncreasing size={17} className="text-emerald-300" />
                        Top Movers
                    </h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {(data?.charts?.topItems || []).map((item, index) => {
                            const width = (Number(item.qty || 0) / maxTopQty) * 100;
                            return (
                                <div key={item.name} className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">
                                            {index + 1}. {item.name}
                                        </p>
                                        <p className="text-xs text-orange-300">{formatMoney(item.revenue)}</p>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-white/10">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
                                            style={{ width: `${Math.max(8, width)}%` }}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-400">{item.qty} qty sold</p>
                                </div>
                            );
                        })}
                        {(data?.charts?.topItems || []).length === 0 && (
                            <p className="text-sm text-gray-400">No item movement data yet.</p>
                        )}
                    </div>
                </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="flex items-center gap-2 text-lg font-semibold">
                        <Bot size={17} className="text-fuchsia-300" />
                        Smart Alerts
                    </h4>
                    <div className="mt-4 space-y-3">
                        {(data?.insights || []).map((insight) => (
                            <div
                                key={`${insight.level}-${insight.title}`}
                                className={`rounded-xl border p-3 ${insightClasses[insight.level] || insightClasses.info}`}
                            >
                                <p className="text-sm font-semibold">{insight.title}</p>
                                <p className="mt-1 text-xs opacity-90">{insight.description}</p>
                            </div>
                        ))}
                        {(data?.insights || []).length === 0 && (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                                No major risks detected right now.
                            </div>
                        )}
                    </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                    <h4 className="flex items-center gap-2 text-lg font-semibold">
                        <Sparkles size={17} className="text-cyan-300" />
                        Category Intelligence
                    </h4>
                    <div className="mt-4 space-y-3">
                        {(data?.charts?.categories || []).slice(0, 6).map((cat) => {
                            const width =
                                (Number(cat.revenue || 0) / maxCategoryRevenue) * 100;
                            return (
                                <div key={cat.name}>
                                    <div className="mb-1 flex items-center justify-between text-xs text-gray-300">
                                        <span>{cat.name}</span>
                                        <span>{formatMoney(cat.revenue)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-white/10">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500"
                                            style={{ width: `${Math.max(6, width)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {(data?.charts?.categories || []).length === 0 && (
                            <p className="text-sm text-gray-400">No category analytics yet.</p>
                        )}
                    </div>
                </article>
            </div>

            <article className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <h4 className="text-lg font-semibold">Table Heatmap</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(data?.charts?.tableHeatmap || []).map((table) => {
                        const glow = (Number(table.orders || 0) / maxTableOrders) * 100;
                        return (
                            <div
                                key={table.tableNo}
                                className="rounded-xl border border-white/10 bg-[#0f172a] p-3"
                                style={{
                                    boxShadow: `inset 0 0 ${Math.max(8, glow / 3)}px rgba(34,211,238,0.12)`,
                                }}
                            >
                                <p className="text-sm font-semibold">{table.tableNo}</p>
                                <p className="mt-1 text-xs text-gray-400">{table.orders} orders</p>
                                <p className="text-xs text-cyan-300">{formatMoney(table.revenue)} revenue</p>
                            </div>
                        );
                    })}
                    {(data?.charts?.tableHeatmap || []).length === 0 && (
                        <p className="text-sm text-gray-400">No table usage data for selected range.</p>
                    )}
                </div>
            </article>
        </section>
    );
}
