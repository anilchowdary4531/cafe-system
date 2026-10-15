import { useMemo } from "react";
import { TrendingUp, BarChart2, AlertCircle, RefreshCw } from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

const PERIODS = [
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "3m", label: "3 Months" },
    { id: "6m", label: "6 Months" },
    { id: "1y", label: "1 Year" },
    { id: "all", label: "All" },
];

const formatINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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

    const credits = Number(data.credits || 0);
    const debits = Number(data.debits || 0);

    return (
        <div className="rounded-xl border border-stone-200 dark:border-white/15 bg-white dark:bg-stone-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[170px]">
            <p className="font-semibold text-stone-700 dark:text-stone-300 pb-1.5 border-b border-stone-200 dark:border-white/10">
                {formatDateFull(data.date)}
            </p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-stone-500 dark:text-stone-400 font-medium">Wallet Balance</span>
                    <span className="font-bold text-amber-500 dark:text-amber-400">₹{formatINR(data.balance)}</span>
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
    const hasData = Array.isArray(trend) && trend.length > 0;

    return (
        <div className="theme-panel rounded-3xl p-5 sm:p-6 border border-[var(--app-border)] shadow-md space-y-5">
            {/* Header with Title and Period Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white tracking-tight">
                            Wallet Balance & Activity
                        </h3>
                        <p className="text-[11px] text-stone-400">
                            Balance progression & transaction volume
                        </p>
                    </div>
                </div>

                {/* Period Switcher */}
                <div className="inline-flex items-center p-1 rounded-xl bg-white/5 border border-white/10 self-start sm:self-auto overflow-x-auto max-w-full">
                    {PERIODS.map((period) => {
                        const isSelected = selectedPeriod === period.id;
                        return (
                            <button
                                key={period.id}
                                type="button"
                                onClick={() => onPeriodChange(period.id)}
                                disabled={loading}
                                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                    isSelected
                                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                                        : "text-stone-300 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                {period.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chart Canvas Area */}
            <div className="min-h-[280px] sm:min-h-[300px] flex items-center justify-center">
                {loading ? (
                    <div className="w-full h-[300px] flex items-center justify-center">
                        <div className="h-56 w-full bg-white/5 rounded-2xl animate-pulse flex items-center justify-center text-xs text-stone-400">
                            Updating trend chart...
                        </div>
                    </div>
                ) : error ? (
                    <div className="w-full h-[300px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-rose-500/20 bg-rose-500/5 rounded-2xl space-y-3">
                        <AlertCircle size={32} className="text-rose-400" />
                        <div>
                            <p className="text-sm font-semibold text-rose-300">
                                Unable to load wallet activity.
                            </p>
                            <p className="text-xs text-stone-400 mt-1">
                                {error || "An error occurred while fetching your balance history."}
                            </p>
                        </div>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all shadow-sm"
                            >
                                <RefreshCw size={13} />
                                <span>Retry</span>
                            </button>
                        )}
                    </div>
                ) : !hasData ? (
                    <div className="w-full h-[300px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-2xl space-y-1">
                        <BarChart2 size={32} className="text-stone-500 mb-1" />
                        <p className="text-sm font-semibold text-stone-300">
                            No wallet activity in this period.
                        </p>
                        <p className="text-xs text-stone-500 max-w-sm">
                            Not enough activity to display a trend. Add money to your wallet or place an order to see your balance movement over time.
                        </p>
                    </div>
                ) : (
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={trend}
                                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="walletOrangeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.45} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatDateTick}
                                    stroke="rgba(255, 255, 255, 0.3)"
                                    tick={{ fill: "#a8a29e", fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                                />
                                <YAxis
                                    tickFormatter={(val) => `₹${val}`}
                                    stroke="rgba(255, 255, 255, 0.3)"
                                    tick={{ fill: "#a8a29e", fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                                />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="balance"
                                    stroke="#f97316"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#walletOrangeGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
