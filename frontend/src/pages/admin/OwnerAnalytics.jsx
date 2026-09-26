import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    BrainCircuit,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    FileText,
    Filter,
    HelpCircle,
    Info,
    Layers,
    LoaderCircle,
    PieChart as PieIcon,
    RefreshCcw,
    ShieldAlert,
    ShoppingBag,
    Sparkles,
    Table as TableIcon,
    TrendingUp,
    Users,
    UtensilsCrossed,
    Wallet,
} from "lucide-react";
import {
    Area,
    AreaChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { API } from "../../config";

const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "sales", label: "Sales" },
    { id: "orders", label: "Orders" },
    { id: "tables", label: "Tables" },
    { id: "customers", label: "Customers" },
    { id: "menu", label: "Menu" },
    { id: "kitchen", label: "Kitchen" },
    { id: "payments", label: "Payments" },
    { id: "inventory", label: "Inventory" },
    { id: "staff", label: "Staff" },
    { id: "reports", label: "Reports" },
];

const DATE_PRESETS = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "custom", label: "Custom" },
];

const REFRESH_MS = 15000;

const formatMoney = (value) => `\u20B9${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompactMoney = (value) => `\u20B9${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const formatPct = (value) => `${Number(value || 0).toFixed(1)}%`;

const PIE_COLORS = ["#ff6600", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#64748b"];

export default function OwnerAnalytics() {
    const [searchParams, setSearchParams] = useSearchParams();

    const activeSection = searchParams.get("section") || "overview";
    const range = searchParams.get("range") || "7d";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [error, setError] = useState("");
    const [chartMetric, setChartMetric] = useState("revenue"); // revenue | orders | customers

    const [customStartDate, setCustomStartDate] = useState(startDateParam);
    const [customEndDate, setCustomEndDate] = useState(endDateParam);

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
            setError("Restaurant ID missing for current owner.");
            return;
        }

        try {
            if (silent) setRefreshing(true);
            else setLoading(true);

            const params = { range };
            if (range === "custom" && customStartDate && customEndDate) {
                params.startDate = customStartDate;
                params.endDate = customEndDate;
            }

            const res = await axios.get(`${API}/owner/${restaurantId}/analytics`, { params });
            setData(res.data || null);
            setError("");
        } catch (err) {
            console.error("Analytics fetch error:", err);
            setError(err?.response?.data?.message || "Failed to load restaurant analytics.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [restaurantId, range, startDateParam, endDateParam]);

    useEffect(() => {
        if (!autoRefresh || !restaurantId) return undefined;
        const timer = setInterval(() => {
            fetchAnalytics({ silent: true });
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [autoRefresh, restaurantId, range, startDateParam, endDateParam]);

    const handleSectionChange = (secId) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("section", secId);
        setSearchParams(nextParams);
    };

    const handleRangeChange = (presetId) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("range", presetId);
        if (presetId !== "custom") {
            nextParams.delete("startDate");
            nextParams.delete("endDate");
        }
        setSearchParams(nextParams);
    };

    const handleApplyCustomDates = () => {
        if (!customStartDate || !customEndDate) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("range", "custom");
        nextParams.set("startDate", customStartDate);
        nextParams.set("endDate", customEndDate);
        setSearchParams(nextParams);
    };

    const handleExportCSV = (reportTitle, headers, rows) => {
        let csv = headers.join(",") + "\n";
        rows.forEach((row) => {
            csv += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
        });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${reportTitle.toLowerCase().replace(/ /g, "_")}_${data?.range || "7d"}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper for rendering percentage change indicators
    const renderChangeBadge = (pctVal) => {
        const num = Number(pctVal || 0);
        if (num > 0) {
            return (
                <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight size={13} className="mr-0.5" />
                    {num.toFixed(1)}%
                </span>
            );
        }
        if (num < 0) {
            return (
                <span className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <ArrowDownRight size={13} className="mr-0.5" />
                    {Math.abs(num).toFixed(1)}%
                </span>
            );
        }
        return <span className="text-xs font-medium theme-muted">0.0%</span>;
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-24 theme-muted">
                <LoaderCircle size={28} className="animate-spin text-[var(--app-primary)] mb-3" />
                <p className="text-sm font-medium">Loading Café King Intelligence Console...</p>
            </div>
        );
    }

    const timeseries = data?.charts?.timeseries || [];
    const peakDemand = data?.peakDemand || {};
    const overview = data?.overview || {};
    const realtime = data?.realtime || {};
    const tablesAndQr = data?.tablesAndQr || {};
    const kitchenFlow = data?.kitchenFlow || {};
    const paymentMethods = data?.paymentMethods || {};
    const customerStats = data?.customerStats || {};
    const inventoryStatus = data?.inventoryStatus || {};
    const topItems = data?.charts?.topItems || [];
    const categories = data?.charts?.categories || [];
    const alerts = data?.alerts || [];
    const notAvailable = data?.notAvailable || {};

    return (
        <section className="space-y-4 font-sans text-sm text-[color:var(--app-text)] pb-12">
            {/* HEADER CONSOLE BAR */}
            <header className="pb-3 border-b border-[color:var(--app-border)]/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                                {data?.restaurant?.name || "Café King"} Intelligence
                            </h2>
                            <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--app-primary)]">
                                ENTERPRISE CONSOLE
                            </span>
                        </div>
                        <p className="theme-muted text-xs mt-0.5">
                            Real-time restaurant performance, sales, orders, customers, kitchen and operational intelligence.
                        </p>
                    </div>

                    {/* TOP RIGHT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Preset Date Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50">
                            {DATE_PRESETS.map((preset) => {
                                const isActive = range === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleRangeChange(preset.id)}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                                            isActive
                                                ? "bg-[var(--app-primary)] text-white shadow-sm"
                                                : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Live Auto-refresh toggle */}
                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                                autoRefresh
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "border-[color:var(--app-border)] theme-muted"
                            }`}
                        >
                            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                            {autoRefresh ? "Live ON" : "Live OFF"}
                        </button>

                        {/* Manual Refresh button */}
                        <button
                            type="button"
                            onClick={() => fetchAnalytics({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCcw size={13} className={refreshing ? "animate-spin text-[var(--app-primary)]" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Sub-header displaying active date range string */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs theme-muted">
                    <div className="flex items-center gap-1.5 font-medium">
                        <Calendar size={13} className="text-[var(--app-primary)]" />
                        <span>Range: <strong className="text-[color:var(--app-text)]">{data?.dateDisplayLabel || "Selected Period"}</strong></span>
                        <span className="mx-1">•</span>
                        <span>Timezone: <strong className="text-[color:var(--app-text)]">{data?.restaurant?.timezone || "Asia/Kolkata"}</strong></span>
                    </div>

                    {/* Custom Date Inputs if 'Custom' preset selected */}
                    {range === "custom" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="rounded border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-2 py-0.5 text-xs text-[color:var(--app-text)]"
                            />
                            <span>to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="rounded border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-2 py-0.5 text-xs text-[color:var(--app-text)]"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCustomDates}
                                className="rounded bg-[var(--app-primary)] px-2.5 py-0.5 text-xs font-semibold text-white"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    {error}
                </div>
            )}

            {/* HORIZONTAL SECTION NAVIGATION TABS */}
            <nav className="border-b border-[color:var(--app-border)]/50 overflow-x-auto scrollbar-none">
                <div className="flex min-w-max gap-1">
                    {SECTIONS.map((sec) => {
                        const isActive = activeSection === sec.id;
                        return (
                            <button
                                key={sec.id}
                                type="button"
                                onClick={() => handleSectionChange(sec.id)}
                                className={`relative px-3.5 py-2 text-xs font-semibold transition-colors ${
                                    isActive
                                        ? "text-[var(--app-primary)] border-b-2 border-[var(--app-primary)]"
                                        : "theme-muted hover:text-[color:var(--app-text)]"
                                }`}
                            >
                                {sec.label}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* SECTION VIEWS */}
            {activeSection === "overview" && (
                <div className="space-y-6 pt-1">
                    {/* OVERVIEW - HIGH INFORMATION DENSITY KPI ROWS (NO FLOATING CARDS) */}
                    <div className="pb-4 border-b border-[color:var(--app-border)]/40">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)] mb-2">
                            PERIOD PERFORMANCE OVERVIEW · {data?.dateDisplayLabel?.toUpperCase() || "TODAY"}
                        </div>

                        {/* ROW 1: PRIMARY FINANCIAL & VOLUME METRICS */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-2">
                            <div>
                                <div className="theme-muted text-xs font-medium uppercase tracking-wide">Revenue</div>
                                <div className="text-2xl font-bold tracking-tight text-[color:var(--app-text)] mt-0.5">
                                    {formatMoney(overview.totalRevenue)}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                                    {renderChangeBadge(overview.revenuePctChange)}
                                    <span className="theme-muted">vs prev period</span>
                                </div>
                            </div>

                            <div>
                                <div className="theme-muted text-xs font-medium uppercase tracking-wide">Orders</div>
                                <div className="text-2xl font-bold tracking-tight text-[color:var(--app-text)] mt-0.5">
                                    {overview.totalOrders || 0}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                                    {renderChangeBadge(overview.ordersPctChange)}
                                    <span className="theme-muted">vs prev period</span>
                                </div>
                            </div>

                            <div>
                                <div className="theme-muted text-xs font-medium uppercase tracking-wide">Customers</div>
                                <div className="text-2xl font-bold tracking-tight text-[color:var(--app-text)] mt-0.5">
                                    {customerStats.totalCustomers || overview.totalCustomers || 0}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                                    {renderChangeBadge(overview.customersPctChange)}
                                    <span className="theme-muted">vs prev period</span>
                                </div>
                            </div>

                            <div>
                                <div className="theme-muted text-xs font-medium uppercase tracking-wide">Avg Order Value</div>
                                <div className="text-2xl font-bold tracking-tight text-[color:var(--app-text)] mt-0.5">
                                    {formatMoney(overview.avgOrderValue)}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                                    {renderChangeBadge(overview.aovPctChange)}
                                    <span className="theme-muted">vs prev period</span>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: OPERATIONAL QUICK METRICS */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 pt-3 border-t border-[color:var(--app-border)]/30 text-xs">
                            <div>
                                <span className="theme-muted">Kitchen Status: </span>
                                <strong className="text-[color:var(--app-text)] font-semibold">{realtime.activeQueue || 0} active</strong>
                                {realtime.delayedTickets > 0 ? (
                                    <span className="text-rose-500 ml-1.5 font-bold">• {realtime.delayedTickets} delayed</span>
                                ) : (
                                    <span className="text-emerald-500 ml-1.5">• 0 delayed</span>
                                )}
                            </div>

                            <div>
                                <span className="theme-muted">Table Occupancy: </span>
                                <strong className="text-[color:var(--app-text)] font-semibold">
                                    {tablesAndQr.occupiedTables}/{tablesAndQr.totalTables} ({tablesAndQr.occupancyRatePct?.toFixed(0)}%)
                                </strong>
                                <span className="theme-muted ml-1">• {tablesAndQr.availableTables} open</span>
                            </div>

                            <div>
                                <span className="theme-muted">Payments Success: </span>
                                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{paymentMethods.successfulCount || 0} success</strong>
                                <span className="theme-muted ml-1">({formatMoney(overview.paidOrderValue || overview.totalRevenue)})</span>
                            </div>

                            <div>
                                <span className="theme-muted">Operational Alerts: </span>
                                <strong className="text-[color:var(--app-text)] font-semibold">{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</strong>
                                {alerts.some((a) => a.severity === "high") && (
                                    <span className="text-rose-500 font-bold ml-1">• 1 Critical</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* REVENUE / ORDER TREND & DEMAND WAVEFORM */}
                    <div className="grid gap-6 lg:grid-cols-3 pb-4 border-b border-[color:var(--app-border)]/40">
                        {/* REVENUE TREND CHART (2/3 width) */}
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-[color:var(--app-text)] text-sm">Performance Trend</span>
                                    <span className="theme-muted text-xs">({range.toUpperCase()})</span>
                                </div>
                                <div className="inline-flex rounded border border-[color:var(--app-border)] p-0.5 text-xs bg-[color:var(--app-bg)]">
                                    {["revenue", "orders", "customers"].map((metric) => (
                                        <button
                                            key={metric}
                                            type="button"
                                            onClick={() => setChartMetric(metric)}
                                            className={`px-2 py-0.5 capitalize rounded ${
                                                chartMetric === metric
                                                    ? "bg-[var(--app-primary)] text-white font-semibold"
                                                    : "theme-muted hover:text-[color:var(--app-text)]"
                                            }`}
                                        >
                                            {metric}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-[170px] w-full">
                                {timeseries.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ff6600" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ff6600" stopOpacity={0.0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--app-muted-strong)" }} stroke="transparent" />
                                            <YAxis tick={{ fontSize: 11, fill: "var(--app-muted-strong)" }} stroke="transparent" />
                                            <Tooltip
                                                formatter={(val) => [
                                                    chartMetric === "revenue" ? formatMoney(val) : val,
                                                    chartMetric.toUpperCase(),
                                                ]}
                                                contentStyle={{
                                                    backgroundColor: "var(--app-bg)",
                                                    borderColor: "var(--app-border)",
                                                    fontSize: "12px",
                                                    borderRadius: "6px",
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey={chartMetric}
                                                stroke="#ff6600"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#chartColor)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center theme-muted text-xs">
                                        No trend series data available for selected range.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* DEMAND WAVEFORM & PEAK WINDOW (1/3 width) */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center justify-between">
                                <span>Demand Waveform</span>
                                <span className="theme-muted text-xs font-normal">Peak: {peakDemand.peakHourLabel || "8 PM"}</span>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2 py-2 border-y border-[color:var(--app-border)]/30 text-xs">
                                    <div>
                                        <div className="theme-muted">Peak Hour</div>
                                        <div className="font-bold text-[color:var(--app-text)] mt-0.5">{peakDemand.peakHourLabel || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="theme-muted">Peak Orders</div>
                                        <div className="font-bold text-[color:var(--app-text)] mt-0.5">{peakDemand.peakOrders || 0}</div>
                                    </div>
                                    <div>
                                        <div className="theme-muted">Peak Revenue</div>
                                        <div className="font-bold text-[color:var(--app-text)] mt-0.5">{formatCompactMoney(peakDemand.peakRevenue)}</div>
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                    <div className="theme-muted text-[11px] font-semibold uppercase">Demand Intensity</div>
                                    <div className="flex items-center gap-1.5">
                                        {(peakDemand.waveform || []).slice(10, 22).map((slot) => {
                                            const intensity = Math.min(100, Math.max(15, (slot.orders / Math.max(1, peakDemand.peakOrders || 1)) * 100));
                                            return (
                                                <div key={slot.hour} className="flex-1 text-center" title={`${slot.label}: ${slot.orders} orders`}>
                                                    <div className="h-10 w-full bg-[color:var(--app-border)]/40 rounded-sm relative flex items-end">
                                                        <div
                                                            className="w-full bg-[var(--app-primary)] rounded-sm transition-all"
                                                            style={{ height: `${intensity}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] theme-muted block mt-0.5">{slot.hour % 3 === 0 ? slot.label.split(" ")[0] : ""}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABLES & QR ANALYTICS + KITCHEN FLOW */}
                    <div className="grid gap-6 md:grid-cols-2 pb-4 border-b border-[color:var(--app-border)]/40">
                        {/* TABLES & QR */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center justify-between">
                                <span>TABLES & QR INTELLIGENCE</span>
                                <span className="theme-muted text-xs">Occupancy: {tablesAndQr.occupancyRatePct?.toFixed(1)}%</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-xs py-2 border-y border-[color:var(--app-border)]/30">
                                <div>
                                    <div className="theme-muted">Total Tables</div>
                                    <div className="font-bold text-[color:var(--app-text)] text-base mt-0.5">{tablesAndQr.totalTables}</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Occupied</div>
                                    <div className="font-bold text-amber-600 dark:text-amber-400 text-base mt-0.5">{tablesAndQr.occupiedTables}</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Available</div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-base mt-0.5">{tablesAndQr.availableTables}</div>
                                </div>
                                <div>
                                    <div className="theme-muted">QR Revenue</div>
                                    <div className="font-bold text-[color:var(--app-text)] text-base mt-0.5">{formatCompactMoney(tablesAndQr.qrRevenue)}</div>
                                </div>
                            </div>

                            <div className="mt-2 space-y-1 text-xs">
                                <div className="flex justify-between py-1 border-b border-[color:var(--app-border)]/20">
                                    <span className="theme-muted">QR Orders Processed:</span>
                                    <strong className="text-[color:var(--app-text)]">{tablesAndQr.qrOrdersCount} orders</strong>
                                </div>
                                <div className="flex justify-between py-1 border-b border-[color:var(--app-border)]/20">
                                    <span className="theme-muted">Avg QR Ticket Size:</span>
                                    <strong className="text-[color:var(--app-text)]">{formatMoney(tablesAndQr.avgQrOrderValue)}</strong>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="theme-muted">Pre-order QR Scan Funnel:</span>
                                    <span className="text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                                        {notAvailable.preOrderQrFunnel ? "Not currently available (Requires scan event DB)" : `${tablesAndQr.qrConversionRatePct?.toFixed(1)}%`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* KITCHEN FLOW */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center justify-between">
                                <span>KITCHEN FLOW</span>
                                <span className="theme-muted text-xs">Avg Prep: {kitchenFlow.avgPrepMinutes?.toFixed(0)} min</span>
                            </div>

                            {/* Status counts horizontal row */}
                            <div className="grid grid-cols-5 gap-1.5 text-center text-xs py-2 border-y border-[color:var(--app-border)]/30">
                                <div className="bg-sky-500/10 p-1.5 rounded">
                                    <div className="theme-muted text-[10px] font-bold">PLACED</div>
                                    <div className="font-bold text-sky-600 dark:text-sky-400 text-sm mt-0.5">{kitchenFlow.placed}</div>
                                </div>
                                <div className="bg-indigo-500/10 p-1.5 rounded">
                                    <div className="theme-muted text-[10px] font-bold">ACCEPTED</div>
                                    <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm mt-0.5">{kitchenFlow.accepted}</div>
                                </div>
                                <div className="bg-amber-500/10 p-1.5 rounded">
                                    <div className="theme-muted text-[10px] font-bold">PREPARING</div>
                                    <div className="font-bold text-amber-600 dark:text-amber-400 text-sm mt-0.5">{kitchenFlow.preparing}</div>
                                </div>
                                <div className="bg-emerald-500/10 p-1.5 rounded">
                                    <div className="theme-muted text-[10px] font-bold">READY</div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">{kitchenFlow.ready}</div>
                                </div>
                                <div className="bg-teal-500/10 p-1.5 rounded">
                                    <div className="theme-muted text-[10px] font-bold">DELIVERED</div>
                                    <div className="font-bold text-teal-600 dark:text-teal-400 text-sm mt-0.5">{kitchenFlow.delivered}</div>
                                </div>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                <div>
                                    <span className="theme-muted">Total KOTs: </span>
                                    <strong className="text-[color:var(--app-text)]">{kitchenFlow.totalKots}</strong>
                                </div>
                                <div>
                                    <span className="theme-muted">Delayed KOTs: </span>
                                    <strong className={kitchenFlow.delayedTickets > 0 ? "text-rose-500" : "text-emerald-500"}>{kitchenFlow.delayedTickets}</strong>
                                </div>
                                <div>
                                    <span className="theme-muted">Reprints: </span>
                                    <strong className="text-[color:var(--app-text)]">{kitchenFlow.reprintsCount || 0}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TOP MOVERS & PAYMENTS */}
                    <div className="grid gap-6 md:grid-cols-2 pb-4 border-b border-[color:var(--app-border)]/40">
                        {/* TOP MOVERS */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center justify-between">
                                <span>TOP MOVERS (POPULAR ITEMS)</span>
                                <span className="theme-muted text-xs">{topItems.length} items</span>
                            </div>

                            <div className="divide-y divide-[color:var(--app-border)]/20 text-xs">
                                {topItems.slice(0, 5).map((item, idx) => (
                                    <div key={item.name} className="flex items-center justify-between py-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-xs theme-muted w-4">{idx + 1}.</span>
                                            <span className="font-medium text-[color:var(--app-text)]">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="theme-muted">{item.qty} qty</span>
                                            <span className="font-bold text-[color:var(--app-text)]">{formatMoney(item.revenue)}</span>
                                        </div>
                                    </div>
                                ))}
                                {topItems.length === 0 && (
                                    <div className="py-2 theme-muted text-xs">No top items data available.</div>
                                )}
                            </div>
                        </div>

                        {/* PAYMENTS BREAKDOWN */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center justify-between">
                                <span>PAYMENTS SUMMARY</span>
                                <span className="theme-muted text-xs">Success Rate: {paymentMethods.successRatePct?.toFixed(1)}%</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-xs py-2 border-y border-[color:var(--app-border)]/30">
                                <div>
                                    <div className="theme-muted">UPI</div>
                                    <div className="font-bold text-[color:var(--app-text)] mt-0.5">{formatCompactMoney(paymentMethods.amounts?.UPI)}</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Cash</div>
                                    <div className="font-bold text-[color:var(--app-text)] mt-0.5">{formatCompactMoney(paymentMethods.amounts?.CASH)}</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Card</div>
                                    <div className="font-bold text-[color:var(--app-text)] mt-0.5">{formatCompactMoney(paymentMethods.amounts?.CARD)}</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Online</div>
                                    <div className="font-bold text-[color:var(--app-text)] mt-0.5">{formatCompactMoney(paymentMethods.amounts?.ONLINE)}</div>
                                </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-xs">
                                <div>
                                    <span className="theme-muted">Successful: </span>
                                    <strong className="text-emerald-600 dark:text-emerald-400">{paymentMethods.successfulCount}</strong>
                                </div>
                                <div>
                                    <span className="theme-muted">Failed: </span>
                                    <strong className={paymentMethods.failedCount > 0 ? "text-rose-500" : "theme-muted"}>{paymentMethods.failedCount}</strong>
                                </div>
                                <div>
                                    <span className="theme-muted">Pending: </span>
                                    <strong className={paymentMethods.pendingCount > 0 ? "text-amber-500" : "theme-muted"}>{paymentMethods.pendingCount}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI RADAR ALERTS & INVENTORY STATUS */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* AI RADAR */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center gap-1.5">
                                <BrainCircuit size={15} className="text-[var(--app-primary)]" />
                                <span>AI RADAR OPERATIONAL ALERTS</span>
                            </div>

                            <div className="space-y-1.5 text-xs">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className="flex items-start gap-2 py-1.5 border-b border-[color:var(--app-border)]/20">
                                        <span className={`h-2 w-2 rounded-full mt-1 ${alert.severity === "high" ? "bg-rose-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                        <div className="flex-1">
                                            <div className="font-semibold text-[color:var(--app-text)]">{alert.title}</div>
                                            <div className="theme-muted text-[11px]">{alert.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* INVENTORY STATUS */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2 flex items-center justify-between">
                                <span>INVENTORY STOCK STATUS</span>
                                <span className="theme-muted text-xs">Stock Health</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs py-2 border-y border-[color:var(--app-border)]/30">
                                <div>
                                    <div className="theme-muted">Healthy</div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-base mt-0.5">{inventoryStatus.healthyCount || 0} items</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Low Stock</div>
                                    <div className="font-bold text-amber-600 dark:text-amber-400 text-base mt-0.5">{inventoryStatus.lowStockCount || 0} items</div>
                                </div>
                                <div>
                                    <div className="theme-muted">Out of Stock</div>
                                    <div className="font-bold text-rose-600 dark:text-rose-400 text-base mt-0.5">{inventoryStatus.outOfStockCount || 0} items</div>
                                </div>
                            </div>

                            <div className="mt-2 text-xs theme-muted">
                                Wastage Value: <span className="text-[color:var(--app-text)] font-medium">Not currently available (Requires ingredient wastage logging)</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SALES TAB */}
            {activeSection === "sales" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        SALES & FINANCIAL BREAKDOWN
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Gross Sales</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{formatMoney(overview.grossSales)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Net Sales</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{formatMoney(overview.netSales)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Total Discounts</div>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{formatMoney(overview.totalDiscounts)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Taxes & GST Collected</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{formatMoney(overview.totalTaxes)}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-b border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Cancelled Order Value</div>
                            <div className="text-lg font-bold text-rose-500 mt-0.5">{formatMoney(overview.cancelledOrderValue)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Paid Orders Total</div>
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatMoney(overview.paidOrderValue)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Unpaid Orders Total</div>
                            <div className="text-lg font-bold text-amber-500 mt-0.5">{formatMoney(overview.unpaidOrderValue)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Average Order Value</div>
                            <div className="text-lg font-bold text-[color:var(--app-text)] mt-0.5">{formatMoney(overview.avgOrderValue)}</div>
                        </div>
                    </div>

                    {/* CATEGORY SALES TABLE */}
                    <div>
                        <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Revenue by Category</div>
                        <div className="overflow-x-auto border border-[color:var(--app-border)]/50 rounded-md">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-[color:var(--app-bg)]/80 theme-muted border-b border-[color:var(--app-border)]/40">
                                    <tr>
                                        <th className="p-2 font-semibold">Category Name</th>
                                        <th className="p-2 font-semibold text-right">Quantity Sold</th>
                                        <th className="p-2 font-semibold text-right">Total Revenue</th>
                                        <th className="p-2 font-semibold text-right">% Contribution</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--app-border)]/20">
                                    {categories.map((cat) => {
                                        const pct = overview.totalRevenue > 0 ? (cat.revenue / overview.totalRevenue) * 100 : 0;
                                        return (
                                            <tr key={cat.name} className="hover:bg-[color:var(--app-border)]/10">
                                                <td className="p-2 font-medium text-[color:var(--app-text)]">{cat.name}</td>
                                                <td className="p-2 text-right">{cat.qty}</td>
                                                <td className="p-2 text-right font-bold text-[color:var(--app-text)]">{formatMoney(cat.revenue)}</td>
                                                <td className="p-2 text-right theme-muted">{pct.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ORDERS TAB */}
            {activeSection === "orders" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        ORDERS ANALYSIS & CHANNEL SPLIT
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Total Orders</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{overview.totalOrders}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Completed Rate</div>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatPct(overview.completionRate)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Cancellation Rate</div>
                            <div className="text-xl font-bold text-rose-500 mt-0.5">{formatPct(overview.cancellationRate)}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Delayed KOT Tickets</div>
                            <div className="text-xl font-bold text-amber-500 mt-0.5">{kitchenFlow.delayedTickets}</div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* ORDER SOURCE */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Order Source Split</div>
                            <div className="space-y-2 text-xs">
                                {Object.entries(data?.orderSources || {}).map(([src, count]) => {
                                    const pct = overview.totalOrders > 0 ? (count / overview.totalOrders) * 100 : 0;
                                    return (
                                        <div key={src} className="flex items-center justify-between py-1 border-b border-[color:var(--app-border)]/20">
                                            <span className="font-medium text-[color:var(--app-text)]">{src}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="theme-muted">{pct.toFixed(1)}%</span>
                                                <strong className="text-[color:var(--app-text)]">{count} orders</strong>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ORDER TYPE */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Order Type Distribution</div>
                            <div className="space-y-2 text-xs">
                                {Object.entries(data?.orderTypes || {}).map(([type, count]) => {
                                    const pct = overview.totalOrders > 0 ? (count / overview.totalOrders) * 100 : 0;
                                    return (
                                        <div key={type} className="flex items-center justify-between py-1 border-b border-[color:var(--app-border)]/20">
                                            <span className="font-medium text-[color:var(--app-text)]">{type.replace("_", " ")}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="theme-muted">{pct.toFixed(1)}%</span>
                                                <strong className="text-[color:var(--app-text)]">{count} orders</strong>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TABLES TAB */}
            {activeSection === "tables" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        TABLE & QR OCCUPANCY INTELLIGENCE
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Total Dining Tables</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{tablesAndQr.totalTables}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Occupied Tables</div>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{tablesAndQr.occupiedTables}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Available Tables</div>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{tablesAndQr.availableTables}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Current Occupancy Rate</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{tablesAndQr.occupancyRatePct?.toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* TABLE HEATMAP / ORDER VOLUME LIST */}
                    <div>
                        <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Table Performance Breakdown</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                            {(data?.charts?.tableHeatmap || []).map((t) => (
                                <div key={t.tableNo} className="p-2 border border-[color:var(--app-border)]/50 rounded bg-[color:var(--app-bg)]">
                                    <div className="font-bold text-[color:var(--app-text)]">Table #{t.tableNo}</div>
                                    <div className="theme-muted mt-0.5">{t.orders} orders</div>
                                    <div className="font-semibold text-[var(--app-primary)] mt-1">{formatMoney(t.revenue)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMERS TAB */}
            {activeSection === "customers" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        CUSTOMER RETENTION & PATRON METRICS
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Total Unique Customers</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{customerStats.totalCustomers}</div>
                        </div>
                        <div>
                            <div className="theme-muted">New Patrons</div>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{customerStats.newCustomers}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Returning Patrons</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{customerStats.returningCustomers}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Repeat Patron Rate</div>
                            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{customerStats.repeatRatePct}%</div>
                        </div>
                    </div>

                    {/* TOP CUSTOMERS TABLE */}
                    <div>
                        <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Top Spending Customers</div>
                        <div className="overflow-x-auto border border-[color:var(--app-border)]/50 rounded-md">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-[color:var(--app-bg)]/80 theme-muted border-b border-[color:var(--app-border)]/40">
                                    <tr>
                                        <th className="p-2 font-semibold">Customer Name</th>
                                        <th className="p-2 font-semibold">Phone</th>
                                        <th className="p-2 font-semibold text-right">Orders Placed</th>
                                        <th className="p-2 font-semibold text-right">Total Spend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--app-border)]/20">
                                    {(customerStats.topCustomers || []).map((cust) => (
                                        <tr key={cust.id} className="hover:bg-[color:var(--app-border)]/10">
                                            <td className="p-2 font-medium text-[color:var(--app-text)]">{cust.name}</td>
                                            <td className="p-2 theme-muted">{cust.phone || "--"}</td>
                                            <td className="p-2 text-right">{cust.orders}</td>
                                            <td className="p-2 text-right font-bold text-[color:var(--app-text)]">{formatMoney(cust.spend)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MENU TAB */}
            {activeSection === "menu" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        MENU ITEM MOVEMENT & CATEGORY MATRIX
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* TOP SELLING ITEMS */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Top Selling Items</div>
                            <div className="divide-y divide-[color:var(--app-border)]/20 text-xs border border-[color:var(--app-border)]/50 rounded-md p-2">
                                {topItems.map((item, idx) => (
                                    <div key={item.name} className="flex items-center justify-between py-1.5">
                                        <span className="font-medium text-[color:var(--app-text)]">{idx + 1}. {item.name}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="theme-muted">{item.qty} qty</span>
                                            <strong className="text-[color:var(--app-text)]">{formatMoney(item.revenue)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* LOWEST SELLING ITEMS */}
                        <div>
                            <div className="font-bold text-[color:var(--app-text)] text-sm mb-2">Lowest Selling Items</div>
                            <div className="divide-y divide-[color:var(--app-border)]/20 text-xs border border-[color:var(--app-border)]/50 rounded-md p-2">
                                {(data?.charts?.bottomItems || []).map((item, idx) => (
                                    <div key={item.name} className="flex items-center justify-between py-1.5">
                                        <span className="font-medium text-[color:var(--app-text)]">{idx + 1}. {item.name}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="theme-muted">{item.qty} qty</span>
                                            <strong className="text-[color:var(--app-text)]">{formatMoney(item.revenue)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KITCHEN TAB */}
            {activeSection === "kitchen" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        KITCHEN & KOT PERFORMANCE
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Total KOTs Created</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{kitchenFlow.totalKots}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Avg Prep Duration</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{kitchenFlow.avgPrepMinutes?.toFixed(0)} min</div>
                        </div>
                        <div>
                            <div className="theme-muted">Delayed KOT Tickets</div>
                            <div className="text-xl font-bold text-rose-500 mt-0.5">{kitchenFlow.delayedTickets}</div>
                        </div>
                        <div>
                            <div className="theme-muted">KOT Reprints</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{kitchenFlow.reprintsCount || 0}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENTS TAB */}
            {activeSection === "payments" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        PAYMENTS & GATEWAY SETTLEMENT
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Successful Payments</div>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{paymentMethods.successfulCount}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Failed Payments</div>
                            <div className="text-xl font-bold text-rose-500 mt-0.5">{paymentMethods.failedCount}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Pending Payments</div>
                            <div className="text-xl font-bold text-amber-500 mt-0.5">{paymentMethods.pendingCount}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Payment Success Rate</div>
                            <div className="text-xl font-bold text-[color:var(--app-text)] mt-0.5">{paymentMethods.successRatePct?.toFixed(1)}%</div>
                        </div>
                    </div>

                    <div className="text-xs theme-muted p-3 border border-[color:var(--app-border)]/40 rounded-md">
                        <strong>Gateway Fees & Net Settlement: </strong>
                        <span>{notAvailable.gatewayFees}</span>
                    </div>
                </div>
            )}

            {/* INVENTORY TAB */}
            {activeSection === "inventory" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        INVENTORY STOCK & CONSUMPTION
                    </div>

                    <div className="grid grid-cols-3 gap-4 py-3 border-y border-[color:var(--app-border)]/40 text-xs">
                        <div>
                            <div className="theme-muted">Healthy Stock Items</div>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{inventoryStatus.healthyCount}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Low Stock Items</div>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{inventoryStatus.lowStockCount}</div>
                        </div>
                        <div>
                            <div className="theme-muted">Out of Stock Items</div>
                            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{inventoryStatus.outOfStockCount}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* STAFF TAB */}
            {activeSection === "staff" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        STAFF OPERATIONAL ACTIVITY
                    </div>

                    <div className="overflow-x-auto border border-[color:var(--app-border)]/50 rounded-md">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[color:var(--app-bg)]/80 theme-muted border-b border-[color:var(--app-border)]/40">
                                <tr>
                                    <th className="p-2 font-semibold">Staff Name</th>
                                    <th className="p-2 font-semibold text-right">Orders Handled</th>
                                    <th className="p-2 font-semibold text-right">Revenue Processed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[color:var(--app-border)]/20">
                                {(data?.staffPerformance || []).map((staff) => (
                                    <tr key={staff.staffId} className="hover:bg-[color:var(--app-border)]/10">
                                        <td className="p-2 font-medium text-[color:var(--app-text)]">{staff.name}</td>
                                        <td className="p-2 text-right">{staff.orders}</td>
                                        <td className="p-2 text-right font-bold text-[color:var(--app-text)]">{formatMoney(staff.revenue)}</td>
                                    </tr>
                                ))}
                                {(data?.staffPerformance || []).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-3 text-center theme-muted">No staff operational records for selected period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* REPORTS TAB */}
            {activeSection === "reports" && (
                <div className="space-y-6 pt-1">
                    <div className="font-bold text-[color:var(--app-text)] text-sm mb-1 uppercase tracking-wider text-[var(--app-primary)]">
                        EXECUTIVE REPORT DIRECTORY
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                        {[
                            { title: "Sales Report", desc: "Gross, net sales, taxes and discount summary", headers: ["Metric", "Value"], rows: [["Gross Sales", overview.grossSales], ["Net Sales", overview.netSales], ["Total Discounts", overview.totalDiscounts], ["Total Taxes", overview.totalTaxes]] },
                            { title: "Orders Report", desc: "Order volume breakdown by source and order type", headers: ["Source/Type", "Count"], rows: Object.entries({ ...(data?.orderSources || {}), ...(data?.orderTypes || {}) }) },
                            { title: "KOT Report", desc: "Kitchen order tickets prep time and delay status", headers: ["Stage", "Count"], rows: [["Placed", kitchenFlow.placed], ["Accepted", kitchenFlow.accepted], ["Preparing", kitchenFlow.preparing], ["Ready", kitchenFlow.ready], ["Delivered", kitchenFlow.delivered]] },
                            { title: "Table Report", desc: "Dining table occupancy and revenue breakdown", headers: ["Table", "Orders", "Revenue"], rows: (data?.charts?.tableHeatmap || []).map((t) => [t.tableNo, t.orders, t.revenue]) },
                            { title: "Customer Report", desc: "Customer acquisition and repeat patron statistics", headers: ["Metric", "Value"], rows: [["Total Customers", customerStats.totalCustomers], ["New Customers", customerStats.newCustomers], ["Returning Customers", customerStats.returningCustomers]] },
                            { title: "Menu Report", desc: "Item-level sales, quantities, and category matrix", headers: ["Item Name", "Quantity", "Revenue"], rows: topItems.map((i) => [i.name, i.qty, i.revenue]) },
                            { title: "Payment Report", desc: "Payment method distribution and success rates", headers: ["Method", "Count", "Amount"], rows: Object.keys(paymentMethods.counts || {}).map((m) => [m, paymentMethods.counts[m], paymentMethods.amounts[m]]) },
                            { title: "Tax/GST Report", desc: "Itemized tax totals and taxable revenue", headers: ["Tax Category", "Amount"], rows: [["Total Taxes Collected", overview.totalTaxes], ["Taxable Subtotal", overview.grossSales]] },
                            { title: "Inventory Report", desc: "Stock health status and item quantities", headers: ["Metric", "Count"], rows: [["Healthy Items", inventoryStatus.healthyCount], ["Low Stock Items", inventoryStatus.lowStockCount], ["Out of Stock Items", inventoryStatus.outOfStockCount]] },
                            { title: "Staff Report", desc: "Staff activity log and revenue contribution", headers: ["Staff Name", "Orders", "Revenue"], rows: (data?.staffPerformance || []).map((s) => [s.name, s.orders, s.revenue]) },
                        ].map((report) => (
                            <div key={report.title} className="p-3 border border-[color:var(--app-border)]/50 rounded-md bg-[color:var(--app-bg)] flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-[color:var(--app-text)]">{report.title}</div>
                                    <div className="theme-muted text-[11px]">{report.desc}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleExportCSV(report.title, report.headers, report.rows)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--app-primary)] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                                >
                                    <Download size={13} />
                                    Export CSV
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
