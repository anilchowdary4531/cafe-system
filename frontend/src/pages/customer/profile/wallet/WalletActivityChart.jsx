import { useState, useMemo } from "react";
import { BarChart2, AlertCircle, RefreshCw } from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
    ReferenceLine,
    Label,
} from "recharts";

const PERIODS = [
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "3m", label: "3 Months" },
    { id: "6m", label: "6 Months" },
    { id: "1y", label: "1 Year" },
    { id: "all", label: "All" },
];

const METRICS = [
    { id: "balance", label: "Wallet Balance", color: "#ff6600", gradientId: "walletOrangeGradient" },
    { id: "credits", label: "Money Added", color: "#10b981", gradientId: "walletGreenGradient" },
    { id: "debits", label: "Money Spent", color: "#f43f5e", gradientId: "walletRoseGradient" },
];

const formatINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatCompactINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
    });
};

const formatDateTick = (dateStr) => {
    if (!dateStr) return "";
    try {
        const parts = dateStr.split("-");
        if (parts.length === 2) {
            const [y, m] = parts;
            const date = new Date(Number(y), Number(m) - 1, 1);
            return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        }
        if (parts.length === 3) {
            const [y, m, d] = parts;
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

const formatDateFull = (dateStr) => {
    if (!dateStr) return "";
    try {
        const parts = dateStr.split("-");
        if (parts.length === 2) {
            const [y, m] = parts;
            const date = new Date(Number(y), Number(m) - 1, 1);
            return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        }
        if (parts.length === 3) {
            const [y, m, d] = parts;
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

function CustomChartTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const balance = Number(data.balance || 0);
    const credits = Number(data.credits || 0);
    const debits = Number(data.debits || 0);

    return (
        <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-2.5 shadow-lg text-xs space-y-1.5 min-w-[170px]">
            <p className="font-semibold text-[color:var(--app-text)] pb-1 border-b border-[color:var(--app-border)]/40">
                {formatDateFull(data.date)}
            </p>
            <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                    <span className="theme-muted font-medium">Wallet Balance</span>
                    <span className="font-bold text-[var(--app-primary)]">₹{formatINR(balance)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Money Added</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {credits > 0 ? `+₹${formatINR(credits)}` : "₹0.00"}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-rose-600 dark:text-rose-400 font-medium">Money Spent</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                        {debits > 0 ? `-₹${formatINR(debits)}` : "₹0.00"}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function WalletActivityChart({
    trend = [],
    selectedPeriod = "30d",
    onPeriodChange,
    loading = false,
    error = "",
    onRetry,
}) {
    const [chartMetric, setChartMetric] = useState("balance");

    const hasData = Array.isArray(trend) && trend.length > 0;
    const isSinglePoint = Array.isArray(trend) && trend.length === 1;

    const { totalCredits, totalDebits, latestBalance } = useMemo(() => {
        if (!Array.isArray(trend) || trend.length === 0) {
            return { totalCredits: 0, totalDebits: 0, latestBalance: 0 };
        }
        let credits = 0;
        let debits = 0;
        for (const pt of trend) {
            credits += Number(pt.credits || 0);
            debits += Number(pt.debits || 0);
        }
        const last = trend[trend.length - 1];
        return {
            totalCredits: credits,
            totalDebits: debits,
            latestBalance: Number(last?.balance || 0),
        };
    }, [trend]);

    const activeMetricConfig = useMemo(() => {
        return METRICS.find((m) => m.id === chartMetric) || METRICS[0];
    }, [chartMetric]);

    const singleVal = isSinglePoint ? Number(trend[0]?.[chartMetric] || 0) : 0;

    return (
        <div className="pb-4 border-b border-[color:var(--app-border)]/30 space-y-2.5">
            {/* Header with Title and Period Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-primary)]">
                            Wallet Balance & Activity
                        </span>
                        <span className="theme-muted text-xs">
                            ({selectedPeriod.toUpperCase()})
                        </span>
                    </div>
                    <p className="theme-muted text-xs mt-0.5">
                        Balance progression & transaction volume
                    </p>
                </div>

                {/* Period Switcher Pills (Matching Owner Analytics DATE_PRESETS) */}
                <div className="inline-flex items-center rounded-lg border border-[color:var(--app-border)] p-0.5 bg-[color:var(--app-bg)]/50 self-start sm:self-auto overflow-x-auto max-w-full">
                    {PERIODS.map((period) => {
                        const isSelected = selectedPeriod === period.id;
                        return (
                            <button
                                key={period.id}
                                type="button"
                                onClick={() => onPeriodChange(period.id)}
                                disabled={loading}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                                    isSelected
                                        ? "bg-[var(--app-primary)] text-white shadow-sm font-bold"
                                        : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/30"
                                }`}
                            >
                                {period.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Quick Metrics Bar & Metric Switcher (Matching Owner Analytics Performance Trend) */}
            {hasData && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[color:var(--app-border)]/20 text-xs">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className="theme-muted">Wallet Balance:</span>
                            <strong className="text-[color:var(--app-text)] font-bold">
                                ₹{formatINR(latestBalance)}
                            </strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="theme-muted">Money Added:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {totalCredits > 0 ? `+₹${formatINR(totalCredits)}` : "₹0.00"}
                            </strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="theme-muted">Money Spent:</span>
                            <strong className="text-rose-600 dark:text-rose-400 font-semibold">
                                {totalDebits > 0 ? `-₹${formatINR(totalDebits)}` : "₹0.00"}
                            </strong>
                        </div>
                    </div>

                    {/* Metric Selector Pills */}
                    <div className="inline-flex rounded border border-[color:var(--app-border)] p-0.5 text-xs bg-[color:var(--app-bg)] self-start sm:self-auto">
                        {METRICS.map((metric) => (
                            <button
                                key={metric.id}
                                type="button"
                                onClick={() => setChartMetric(metric.id)}
                                className={`px-2 py-0.5 rounded text-xs transition-all cursor-pointer ${
                                    chartMetric === metric.id
                                        ? "bg-[var(--app-primary)] text-white font-semibold shadow-xs"
                                        : "theme-muted hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-border)]/20"
                                }`}
                            >
                                {metric.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Chart Canvas Area */}
            <div className="h-[250px] sm:h-[280px] w-full flex items-center justify-center">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="h-full w-full bg-[color:var(--app-border)]/15 rounded-lg animate-pulse flex items-center justify-center text-xs theme-muted">
                            Updating trend chart...
                        </div>
                    </div>
                ) : error ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-rose-500/30 bg-rose-500/5 rounded-lg space-y-2">
                        <AlertCircle size={28} className="text-rose-500" />
                        <div>
                            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                                Unable to load wallet activity.
                            </p>
                            <p className="text-xs theme-muted mt-0.5">
                                {error || "An error occurred while fetching your balance history."}
                            </p>
                        </div>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[var(--app-primary)] text-white shadow-sm hover:opacity-95 transition-all cursor-pointer"
                            >
                                <RefreshCw size={12} />
                                <span>Retry</span>
                            </button>
                        )}
                    </div>
                ) : !hasData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[color:var(--app-border)]/40 rounded-lg space-y-1">
                        <BarChart2 size={28} className="theme-muted mb-1" />
                        <p className="text-sm font-semibold text-[color:var(--app-text)]">
                            No wallet activity in this period.
                        </p>
                        <p className="text-xs theme-muted max-w-sm">
                            Not enough activity to display a trend. Add money to your wallet or place an order to see your balance movement over time.
                        </p>
                    </div>
                ) : (
                    <div className="w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={trend}
                                margin={{ top: 15, right: 15, left: -15, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="walletOrangeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff6600" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#ff6600" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="walletGreenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="walletRoseGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatDateTick}
                                    stroke="transparent"
                                    tick={{ fill: "var(--app-muted-strong)", fontSize: 11 }}
                                    tickLine={false}
                                    padding={isSinglePoint ? { left: 80, right: 80 } : { left: 10, right: 10 }}
                                />
                                <YAxis
                                    tickFormatter={(val) => `₹${formatCompactINR(val)}`}
                                    stroke="transparent"
                                    tick={{ fill: "var(--app-muted-strong)", fontSize: 11 }}
                                    tickLine={false}
                                    domain={[0, "auto"]}
                                />
                                <Tooltip content={<CustomChartTooltip />} />

                                {/* For single data point: subtle horizontal reference guideline and labeled dot */}
                                {isSinglePoint && (
                                    <>
                                        <ReferenceLine
                                            y={singleVal}
                                            stroke={activeMetricConfig.color}
                                            strokeDasharray="4 4"
                                            strokeOpacity={0.4}
                                        />
                                        <ReferenceDot
                                            x={trend[0].date}
                                            y={singleVal}
                                            r={6}
                                            fill={activeMetricConfig.color}
                                            stroke="#fff"
                                            strokeWidth={2}
                                        >
                                            <Label
                                                value={`₹${formatINR(singleVal)}`}
                                                position="top"
                                                offset={10}
                                                fill="var(--app-text)"
                                                fontSize={12}
                                                fontWeight="bold"
                                            />
                                        </ReferenceDot>
                                    </>
                                )}

                                <Area
                                    type="monotone"
                                    dataKey={chartMetric}
                                    stroke={activeMetricConfig.color}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill={`url(#${activeMetricConfig.gradientId})`}
                                    dot={{
                                        r: isSinglePoint ? 6 : trend.length <= 5 ? 4.5 : 3,
                                        fill: activeMetricConfig.color,
                                        stroke: "var(--app-bg)",
                                        strokeWidth: 2,
                                    }}
                                    activeDot={{
                                        r: isSinglePoint ? 8 : 6,
                                        fill: activeMetricConfig.color,
                                        stroke: "var(--app-bg)",
                                        strokeWidth: 2,
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Informational footer note for single data point */}
            {isSinglePoint && (
                <div className="flex items-center justify-between text-[11px] theme-muted pt-1 border-t border-[color:var(--app-border)]/20">
                    <span>Single transaction recorded in this period ({formatDateFull(trend[0].date)})</span>
                    <span>
                        Wallet Balance: <strong className="text-[color:var(--app-text)] font-semibold">₹{formatINR(trend[0].balance)}</strong>
                    </span>
                </div>
            )}
        </div>
    );
}
