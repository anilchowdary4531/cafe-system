import { useMemo } from "react";
import { TrendingUp, BarChart2 } from "lucide-react";
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
    { id: "6m", label: "6 Months" },
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
        // format YYYY-MM or YYYY-MM-DD
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

function CustomChartTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
        <div className="rounded-xl border border-white/15 bg-stone-900/95 p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[150px]">
            <p className="font-semibold text-stone-300 pb-1 border-b border-white/10">
                {formatDateTick(data.date)}
            </p>
            <div className="flex items-center justify-between gap-4">
                <span className="text-stone-400">Balance:</span>
                <span className="font-bold text-amber-400">₹{formatINR(data.balance)}</span>
            </div>
            {data.credits > 0 && (
                <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400">Credits:</span>
                    <span className="font-bold text-emerald-400">+₹{formatINR(data.credits)}</span>
                </div>
            )}
            {data.debits > 0 && (
                <div className="flex items-center justify-between gap-4">
                    <span className="text-rose-400">Debits:</span>
                    <span className="font-bold text-rose-400">-₹{formatINR(data.debits)}</span>
                </div>
            )}
        </div>
    );
}

export default function WalletActivityChart({
    trend = [],
    selectedPeriod = "30d",
    onPeriodChange,
    loading = false,
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
                            Wallet Activity
                        </h3>
                        <p className="text-[11px] text-stone-400">
                            Balance progression & transaction volume
                        </p>
                    </div>
                </div>

                {/* Period Switcher */}
                <div className="inline-flex items-center p-1 rounded-xl bg-white/5 border border-white/10 self-start sm:self-auto">
                    {PERIODS.map((period) => {
                        const isSelected = selectedPeriod === period.id;
                        return (
                            <button
                                key={period.id}
                                type="button"
                                onClick={() => onPeriodChange(period.id)}
                                disabled={loading}
                                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
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
            <div className="min-h-[260px] flex items-center justify-center">
                {loading ? (
                    <div className="w-full h-[260px] flex items-center justify-center">
                        <div className="h-48 w-full bg-white/5 rounded-2xl animate-pulse flex items-center justify-center text-xs text-stone-400">
                            Updating trend chart...
                        </div>
                    </div>
                ) : !hasData ? (
                    <div className="w-full h-[260px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-2xl">
                        <BarChart2 size={32} className="text-stone-500 mb-2" />
                        <p className="text-sm font-semibold text-stone-300">
                            Not enough activity to display a trend
                        </p>
                        <p className="text-xs text-stone-500 mt-1 max-w-sm">
                            Add money to your wallet or place an order to see your balance movement over time.
                        </p>
                    </div>
                ) : (
                    <div className="w-full h-[260px]">
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
