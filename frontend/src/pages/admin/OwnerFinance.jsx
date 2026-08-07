import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    AlertCircle,
    Banknote,
    Bot,
    CalendarRange,
    CircleDollarSign,
    CreditCard,
    Globe,
    IndianRupee,
    LoaderCircle,
    ReceiptText,
    RefreshCcw,
    Wallet,
    X,
} from "lucide-react";
import {
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { API } from "../../config";
import SettlementDashboard from "../owner/SettlementDashboard";

const RANGE_OPTIONS = ["24h", "7d", "30d"];
const PAYMENT_BUCKET_ORDER = ["Digital", "Cash", "Online", "Due"];
const PAYMENT_COLORS = {
    Digital: "#8b5cf6",
    Cash: "#10b981",
    Online: "#3b82f6",
    Due: "#f59e0b",
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOURS_PER_BUCKET = 4;

const toNumber = (value) => Number(value || 0);

const formatMoney = (value) =>
    `\u20B9${toNumber(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatCompactMoney = (value) =>
    toNumber(value).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

const formatCount = (value) =>
    toNumber(value).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

const formatPercent = (value) => `${toNumber(value).toFixed(1)}%`;

const formatGeneratedAt = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "just now";
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const isPaidStatus = (status) => {
    const normalized = String(status || "").toUpperCase();
    return normalized === "PAID" || normalized === "SUCCESS";
};

const resolvePaymentBucket = (paymentMode, paymentStatus) => {
    if (!isPaidStatus(paymentStatus)) return "Due";

    const mode = String(paymentMode || "UNKNOWN").toUpperCase();
    if (mode.includes("CASH")) return "Cash";

    if (
        mode.includes("ONLINE") ||
        mode.includes("SWIGGY") ||
        mode.includes("ZOMATO") ||
        mode.includes("PORTAL")
    ) {
        return "Online";
    }

    if (
        mode.includes("UPI") ||
        mode.includes("CARD") ||
        mode.includes("NET") ||
        mode.includes("BANK") ||
        mode.includes("WALLET") ||
        mode.includes("QR")
    ) {
        return "Digital";
    }

    return "Digital";
};

const statusBadgeClass = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PAID" || normalized === "SUCCESS") {
        return "border-emerald-300 bg-emerald-500/10 text-emerald-700";
    }
    if (normalized === "FAILED" || normalized === "CANCELLED") {
        return "border-red-300 bg-red-500/10 text-red-700";
    }
    return "border-amber-300 bg-amber-500/10 text-amber-700";
};

const modeBadgeClass = (mode) => {
    const bucket = resolvePaymentBucket(mode, "PAID");
    if (bucket === "Cash") return "border-emerald-300 bg-emerald-500/10 text-emerald-700";
    if (bucket === "Online") return "border-blue-300 bg-blue-500/10 text-blue-700";
    return "border-violet-300 bg-violet-500/10 text-violet-700";
};

const buildPaymentTrendData = (invoices, range) => {
    const list = Array.isArray(invoices) ? invoices : [];
    const now = new Date();

    if (range === "24h") {
        const bucketCount = 6;
        const rows = Array.from({ length: bucketCount }, (_, index) => {
            const bucketStart = new Date(
                now.getTime() - (bucketCount - index) * HOURS_PER_BUCKET * HOUR_MS
            );
            return {
                index,
                label: bucketStart.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                Digital: 0,
                Cash: 0,
                Online: 0,
                Due: 0,
            };
        });

        list.forEach((invoice) => {
            const timeMs = new Date(invoice?.createdAt).getTime();
            if (Number.isNaN(timeMs)) return;

            const hoursAgo = (now.getTime() - timeMs) / HOUR_MS;
            if (hoursAgo < 0 || hoursAgo > 24) return;

            const reverseIndex = Math.floor(hoursAgo / HOURS_PER_BUCKET);
            const rowIndex = Math.max(0, Math.min(rows.length - 1, rows.length - 1 - reverseIndex));
            const bucket = resolvePaymentBucket(invoice?.paymentMode, invoice?.paymentStatus);
            rows[rowIndex][bucket] += toNumber(invoice?.total);
        });

        return rows;
    }

    const dayCount = range === "30d" ? 30 : 7;
    const rows = Array.from({ length: dayCount }, (_, index) => {
        const day = new Date(now.getTime() - (dayCount - 1 - index) * DAY_MS);
        day.setHours(0, 0, 0, 0);
        return {
            key: day.toISOString().slice(0, 10),
            label: day.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
            Digital: 0,
            Cash: 0,
            Online: 0,
            Due: 0,
        };
    });

    const rowMap = rows.reduce((acc, row) => {
        acc[row.key] = row;
        return acc;
    }, {});

    list.forEach((invoice) => {
        const date = new Date(invoice?.createdAt);
        if (Number.isNaN(date.getTime())) return;
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().slice(0, 10);
        const row = rowMap[key];
        if (!row) return;
        const bucket = resolvePaymentBucket(invoice?.paymentMode, invoice?.paymentStatus);
        row[bucket] += toNumber(invoice?.total);
    });

    return rows;
};

export default function OwnerFinance() {
    const [activeTab, setActiveTab] = useState("overview"); // overview | settlement
    const [range, setRange] = useState("7d");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
    const summary = data?.summary || {};

    const filteredInvoices = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return invoices;
        return invoices.filter((invoice) =>
            [invoice.orderNo, invoice.invoiceNo, invoice.customerName, invoice.tableNo]
                .map((v) => String(v || "").toLowerCase())
                .some((v) => v.includes(q))
        );
    }, [invoices, search]);

    const paymentOverview = useMemo(() => {
        const totals = { Digital: 0, Cash: 0, Online: 0, Due: 0 };
        let dueInvoiceCount = 0;

        invoices.forEach((invoice) => {
            const bucket = resolvePaymentBucket(invoice?.paymentMode, invoice?.paymentStatus);
            totals[bucket] += toNumber(invoice?.total);
            if (bucket === "Due") dueInvoiceCount += 1;
        });

        const grandTotal = PAYMENT_BUCKET_ORDER.reduce(
            (sum, bucket) => sum + toNumber(totals[bucket]),
            0
        );

        return { totals, grandTotal, dueInvoiceCount };
    }, [invoices]);

    const paymentDistribution = useMemo(() => {
        return PAYMENT_BUCKET_ORDER.map((bucket) => {
            const amount = toNumber(paymentOverview.totals[bucket]);
            const share = paymentOverview.grandTotal
                ? (amount / paymentOverview.grandTotal) * 100
                : 0;
            return {
                name: bucket,
                amount,
                share,
                color: PAYMENT_COLORS[bucket],
            };
        });
    }, [paymentOverview]);

    const trendData = useMemo(() => buildPaymentTrendData(invoices, range), [invoices, range]);

    const topPaymentMode = paymentDistribution
        .filter((row) => row.name !== "Due")
        .sort((a, b) => b.amount - a.amount)[0];

    const cards = useMemo(() => {
        const grossSales = toNumber(summary.grossSales);
        const invoiceCount = toNumber(summary.invoiceCount);
        const makeShareText = (value) =>
            grossSales > 0
                ? `${formatPercent((toNumber(value) / grossSales) * 100)} of bills`
                : "No billed share";

        return [
            {
                key: "total",
                icon: IndianRupee,
                label: "Total Bill Amount",
                value: formatCompactMoney(grossSales),
                meta: `${formatCount(invoiceCount)} bills`,
                footer: `${formatPercent(summary.collectionEfficiency)} collected`,
                tone: "neutral",
            },
            {
                key: "digital",
                icon: CreditCard,
                label: "Digital",
                value: formatCompactMoney(paymentOverview.totals.Digital),
                meta: makeShareText(paymentOverview.totals.Digital),
                footer: `${formatCount(
                    invoices.filter(
                        (invoice) =>
                            resolvePaymentBucket(invoice.paymentMode, invoice.paymentStatus) ===
                            "Digital"
                    ).length
                )} invoices`,
                tone: "digital",
            },
            {
                key: "cash",
                icon: Banknote,
                label: "Cash",
                value: formatCompactMoney(paymentOverview.totals.Cash),
                meta: makeShareText(paymentOverview.totals.Cash),
                footer: `${formatCount(
                    invoices.filter(
                        (invoice) =>
                            resolvePaymentBucket(invoice.paymentMode, invoice.paymentStatus) ===
                            "Cash"
                    ).length
                )} invoices`,
                tone: "cash",
            },
            {
                key: "online",
                icon: Globe,
                label: "Online",
                value: formatCompactMoney(paymentOverview.totals.Online),
                meta: makeShareText(paymentOverview.totals.Online),
                footer: `${formatCount(
                    invoices.filter(
                        (invoice) =>
                            resolvePaymentBucket(invoice.paymentMode, invoice.paymentStatus) ===
                            "Online"
                    ).length
                )} invoices`,
                tone: "online",
            },
            {
                key: "due",
                icon: AlertCircle,
                label: "Due",
                value: formatCompactMoney(summary.unpaidAmount),
                meta:
                    paymentOverview.dueInvoiceCount > 0
                        ? `${formatCount(paymentOverview.dueInvoiceCount)} pending invoices`
                        : "No pending invoices",
                footer: `${formatPercent(100 - summary.collectionEfficiency)} pending`,
                tone: "due",
            },
        ];
    }, [invoices, paymentOverview, summary]);

    const deductionCards = [
        {
            key: "discount",
            label: "Discount",
            value: summary.discountGiven,
            hint: "Promotions and manual reductions",
        },
        {
            key: "tax",
            label: "Tax",
            value: summary.taxCollected,
            hint: "Collected from invoices",
        },
        {
            key: "service",
            label: "Service Charge",
            value: summary.serviceChargeCollected,
            hint: "Auto or manual service fees",
        },
        {
            key: "refund",
            label: "Refund",
            value: summary.refundAmount,
            hint: "Cancelled order reversals",
        },
    ];

    if (loading) {
        return (
            <div className="theme-card rounded-2xl p-6 text-sm">
                Loading finance dashboard...
            </div>
        );
    }

    return (
        <section className="space-y-5">
            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                        activeTab === "overview"
                            ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                            : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                >
                    Finance Overview
                </button>
                <button
                    onClick={() => setActiveTab("settlement")}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                        activeTab === "settlement"
                            ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                            : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                >
                    Settlement Dashboard
                </button>
            </div>

            {activeTab === "settlement" ? (
                <SettlementDashboard />
            ) : (
                <>
            <article className="theme-card rounded-3xl p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.22em]">
                            Dashboard
                        </p>
                        <h3 className="mt-1 text-3xl font-bold">
                            {data?.restaurant?.name || "Restaurant"} Finance Overview
                        </h3>
                        <p className="theme-muted mt-1 text-sm">
                            Track your business financial performance in real time.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 xl:items-end">
                        <p className="theme-muted text-xs sm:text-sm">
                            Latest data retrieved {formatGeneratedAt(data?.generatedAt)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {RANGE_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setRange(option)}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                                        range === option
                                            ? "theme-button"
                                            : "theme-soft-button"
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => loadFinance({ silent: true })}
                                className="theme-button inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                                disabled={refreshing}
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
                </div>
            </article>

            {error && (
                <div className="rounded-xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {cards.map((card) => (
                    <FinanceStatCard key={card.key} {...card} />
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <article className="theme-card rounded-2xl p-5">
                    <h4 className="text-2xl font-semibold">Payment Distribution</h4>
                    <p className="theme-muted mt-1 text-sm">Breakdown by payment channel and due amount.</p>

                    {paymentDistribution.every((row) => row.amount === 0) ? (
                        <div className="theme-muted mt-6 rounded-xl border border-dashed border-current/30 p-6 text-sm">
                            No payment data in selected range.
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="overflow-x-auto">
                                <div className="flex min-w-[360px] justify-center">
                                    <PieChart width={420} height={320}>
                                        <Pie
                                            data={paymentDistribution}
                                            dataKey="amount"
                                            nameKey="name"
                                            innerRadius={72}
                                            outerRadius={108}
                                            minAngle={3}
                                            paddingAngle={2}
                                        >
                                            {paymentDistribution.map((row) => (
                                                <Cell key={row.name} fill={row.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => formatMoney(value)}
                                            contentStyle={{ borderRadius: 10, borderColor: "#d6c5af" }}
                                        />
                                        <Legend verticalAlign="bottom" height={24} />
                                    </PieChart>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {paymentDistribution.map((row) => (
                                    <div
                                        key={row.name}
                                        className="rounded-xl border p-3"
                                        style={{ borderColor: `${row.color}55`, backgroundColor: `${row.color}10` }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ background: row.color }}
                                                />
                                                <p className="font-semibold">{row.name}</p>
                                            </div>
                                            <p className="text-sm font-semibold">{formatMoney(row.amount)}</p>
                                        </div>
                                        <p className="theme-muted mt-1 text-xs">
                                            {formatPercent(row.share)} of total collections
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <article className="theme-card rounded-2xl p-5">
                    <h4 className="text-2xl font-semibold">Month Wise Payment Trends</h4>
                    <p className="theme-muted mt-1 text-sm">See movement of Digital, Cash, Online and Due over time.</p>

                    <div className="mt-4 overflow-x-auto">
                        <LineChart
                            width={Math.max(680, trendData.length * 52)}
                            height={340}
                            data={trendData}
                            margin={{ top: 8, right: 16, left: 4, bottom: 6 }}
                        >
                            <CartesianGrid strokeDasharray="4 4" stroke="rgba(142, 120, 92, 0.25)" />
                            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={(value) => formatCompactMoney(value)} tick={{ fontSize: 12 }} />
                            <Tooltip
                                formatter={(value) => formatMoney(value)}
                                contentStyle={{ borderRadius: 10, borderColor: "#d6c5af" }}
                            />
                            <Legend />
                            {PAYMENT_BUCKET_ORDER.map((bucket) => (
                                <Line
                                    key={bucket}
                                    type="monotone"
                                    dataKey={bucket}
                                    stroke={PAYMENT_COLORS[bucket]}
                                    strokeWidth={2}
                                    dot={{ r: 2 }}
                                    activeDot={{ r: 5 }}
                                />
                            ))}
                        </LineChart>
                    </div>
                </article>
            </div>

            <article className="theme-card rounded-2xl p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h4 className="text-2xl font-semibold">Deductions and Tips</h4>
                        <p className="theme-muted mt-1 text-sm">
                            Understand where revenue is adjusted before final profit.
                        </p>
                    </div>
                    <span className="theme-muted text-xs sm:text-sm">
                        Net Sales: {formatMoney(summary.netSales)}
                    </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {deductionCards.map((card) => (
                        <div key={card.key} className="rounded-xl border p-3">
                            <p className="theme-muted text-xs uppercase tracking-[0.08em]">{card.label}</p>
                            <p className="mt-1 text-xl font-bold">{formatMoney(card.value)}</p>
                            <p className="theme-muted mt-1 text-xs">{card.hint}</p>
                        </div>
                    ))}
                </div>
            </article>

            <div className="grid gap-4 xl:grid-cols-3">
                <article className="theme-card rounded-2xl p-5 xl:col-span-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h4 className="text-xl font-semibold">Cashfree Automated Easy Split</h4>
                            <p className="theme-muted mt-1 text-sm">
                                All digital payments are processed through Cashfree Payment Gateway. 90% of vendor GMV is automatically routed directly to your linked bank account.
                            </p>
                        </div>
                        <span className="theme-pill rounded-full px-3 py-1 text-xs text-emerald-400 font-medium">
                            Active Engine: Cashfree PG
                        </span>
                    </div>
                </article>

                <article className="theme-card rounded-2xl p-5">
                    <h4 className="text-xl font-semibold">Quick Health</h4>
                    <div className="mt-3 space-y-2.5 text-sm">
                        <HealthRow
                            icon={<Wallet size={14} />}
                            label="Paid"
                            value={formatMoney(summary.paidAmount)}
                        />
                        <HealthRow
                            icon={<CreditCard size={14} />}
                            label="Outstanding"
                            value={formatMoney(summary.unpaidAmount)}
                        />
                        <HealthRow
                            icon={<CircleDollarSign size={14} />}
                            label="Operating Profit"
                            value={formatMoney(summary.operatingProfit)}
                        />
                        <HealthRow
                            icon={<Bot size={14} />}
                            label="Margin"
                            value={formatPercent(summary.marginPct)}
                        />
                        <HealthRow
                            icon={<CalendarRange size={14} />}
                            label="Top Payment Mode"
                            value={topPaymentMode?.name || "N/A"}
                        />
                    </div>
                </article>
            </div>

            <article className="theme-card rounded-2xl p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h4 className="text-xl font-semibold">Invoice Ledger</h4>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by order, invoice, customer, table..."
                        className="theme-input w-full rounded-lg px-3 py-2 md:w-96"
                    />
                </div>

                <div className="mt-4 overflow-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="theme-muted border-b text-left text-xs">
                                <th className="px-2 py-2">
                                    <ReceiptText size={14} className="mr-1 inline" /> Invoice
                                </th>
                                <th className="px-2 py-2">Order</th>
                                <th className="px-2 py-2">Customer</th>
                                <th className="px-2 py-2">Table</th>
                                <th className="px-2 py-2">Payment</th>
                                <th className="px-2 py-2">Status</th>
                                <th className="px-2 py-2">Total</th>
                                <th className="px-2 py-2">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="border-b border-black/5">
                                    <td className="px-2 py-2 font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedInvoice(invoice)}
                                            className="rounded px-1 py-0.5 text-left underline-offset-2 transition hover:text-[color:var(--app-primary)] hover:underline"
                                            title="Open receipt details"
                                        >
                                            {invoice.invoiceNo || `INV-${invoice.id}`}
                                        </button>
                                    </td>
                                    <td className="px-2 py-2">{invoice.orderNo || "-"}</td>
                                    <td className="px-2 py-2">{invoice.customerName || "-"}</td>
                                    <td className="px-2 py-2">{invoice.tableNo || "-"}</td>
                                    <td className="px-2 py-2">
                                        <span
                                            className={`inline-flex rounded-full border px-2 py-1 text-xs ${modeBadgeClass(
                                                invoice.paymentMode
                                            )}`}
                                        >
                                            {invoice.paymentMode || "UNKNOWN"}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2">
                                        <span
                                            className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusBadgeClass(
                                                invoice.paymentStatus
                                            )}`}
                                        >
                                            {invoice.paymentStatus || "PENDING"}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 font-semibold">
                                        <span className="inline-flex items-center gap-1">
                                            <CircleDollarSign size={13} />
                                            {formatMoney(invoice.total)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2">{new Date(invoice.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredInvoices.length === 0 && (
                        <div className="theme-muted mt-4 rounded-lg border border-dashed border-current/30 p-4 text-sm">
                            No invoices match your search.
                        </div>
                    )}
                </div>
            </article>

            {selectedInvoice && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-3 sm:p-5"
                    onClick={() => setSelectedInvoice(null)}
                >
                    <article
                        className="theme-card w-full max-w-3xl rounded-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="theme-muted text-xs uppercase tracking-[0.16em]">Receipt</p>
                                <h5 className="text-2xl font-bold">
                                    {selectedInvoice.invoiceNo || `INV-${selectedInvoice.id}`}
                                </h5>
                                <p className="theme-muted mt-1 text-sm">
                                    Created {new Date(selectedInvoice.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="theme-soft-button rounded-full p-2"
                                title="Close receipt"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <ReceiptMeta label="Order No" value={selectedInvoice.orderNo || "-"} />
                            <ReceiptMeta label="Status" value={selectedInvoice.status || "-"} />
                            <ReceiptMeta label="Customer" value={selectedInvoice.customerName || "-"} />
                            <ReceiptMeta label="Phone" value={selectedInvoice.phone || "-"} />
                            <ReceiptMeta label="Table" value={selectedInvoice.tableNo || "-"} />
                            <ReceiptMeta label="Order Source" value={selectedInvoice.orderSource || "-"} />
                            <ReceiptMeta label="Delivery Address" value={selectedInvoice.deliveryAddress || "-"} />
                            <ReceiptMeta label="Payment Mode" value={selectedInvoice.paymentMode || "UNKNOWN"} />
                            <ReceiptMeta label="Payment Status" value={selectedInvoice.paymentStatus || "PENDING"} />
                        </div>

                        <div className="mt-4 rounded-xl border p-3">
                            <p className="text-sm font-semibold">Items</p>
                            {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 ? (
                                <div className="mt-2 overflow-auto">
                                    <table className="w-full min-w-[420px] text-sm">
                                        <thead>
                                            <tr className="theme-muted border-b text-left text-xs">
                                                <th className="px-2 py-2">Item</th>
                                                <th className="px-2 py-2 text-right">Qty</th>
                                                <th className="px-2 py-2 text-right">Rate</th>
                                                <th className="px-2 py-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.items.map((item, index) => (
                                                <tr
                                                    key={`${selectedInvoice.id}-${item.id || item.itemName || index}`}
                                                    className="border-b border-black/5"
                                                >
                                                    <td className="px-2 py-2">{item.itemName || "Item"}</td>
                                                    <td className="px-2 py-2 text-right">{item.qty || 0}</td>
                                                    <td className="px-2 py-2 text-right">{formatMoney(item.price)}</td>
                                                    <td className="px-2 py-2 text-right font-semibold">
                                                        {formatMoney(item.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="theme-muted mt-2 text-sm">No line items found for this invoice.</p>
                            )}
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <ReceiptTotalRow
                                label="Subtotal"
                                value={formatMoney(toNumber(selectedInvoice.subtotal))}
                            />
                            <ReceiptTotalRow
                                label="Discount"
                                value={formatMoney(toNumber(selectedInvoice.discountAmount))}
                            />
                            <ReceiptTotalRow
                                label="Tax"
                                value={formatMoney(toNumber(selectedInvoice.taxAmount))}
                            />
                            <ReceiptTotalRow
                                label="Service Charge"
                                value={formatMoney(toNumber(selectedInvoice.serviceCharge))}
                            />
                            <ReceiptTotalRow
                                label="Grand Total"
                                value={formatMoney(toNumber(selectedInvoice.total))}
                                strong
                                className="sm:col-span-2"
                            />
                        </div>

                        {selectedInvoice.notes ? (
                            <div className="mt-4 rounded-xl border p-3">
                                <p className="theme-muted text-xs uppercase tracking-[0.08em]">Notes</p>
                                <p className="mt-1 text-sm">{selectedInvoice.notes}</p>
                            </div>
                        ) : null}

                        {selectedInvoice.invoiceS3Url ? (
                            <div className="mt-4 flex justify-end">
                                <a
                                    href={selectedInvoice.invoiceS3Url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="theme-button rounded-lg px-4 py-2 text-sm font-semibold"
                                >
                                    Open PDF Receipt
                                </a>
                            </div>
                        ) : null}
                    </article>
                </div>
            )}
        </>
      )}
        </section>
    );
}

function FinanceStatCard({ icon: Icon, label, value, meta, footer, tone = "neutral" }) {
    const toneClass =
        tone === "digital"
            ? "border-violet-300/50"
            : tone === "cash"
              ? "border-emerald-300/50"
              : tone === "online"
                ? "border-blue-300/50"
                : tone === "due"
                  ? "border-amber-300/60"
                  : "border-black/10";

    const iconClass =
        tone === "digital"
            ? "text-violet-600"
            : tone === "cash"
              ? "text-emerald-600"
              : tone === "online"
                ? "text-blue-600"
                : tone === "due"
                  ? "text-amber-600"
                  : "text-orange-700";

    return (
        <article className={`theme-card rounded-2xl border p-4 ${toneClass}`}>
            <div className="flex items-center gap-2">
                <span className={iconClass}>
                    <Icon size={18} />
                </span>
                <p className="text-sm font-semibold">{label}</p>
            </div>
            <p className="mt-3 text-4xl font-bold leading-none">{value}</p>
            <p className="theme-muted mt-2 text-xs">{meta}</p>
            <p className="mt-1 text-xs font-semibold">{footer}</p>
        </article>
    );
}

function HealthRow({ icon, label, value }) {
    return (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="inline-flex items-center gap-2 theme-muted">
                {icon}
                {label}
            </span>
            <span className="font-semibold">{value}</span>
        </div>
    );
}

function ReceiptMeta({ label, value }) {
    return (
        <div className="rounded-lg border px-3 py-2">
            <p className="theme-muted text-xs uppercase tracking-[0.08em]">{label}</p>
            <p className="mt-1 whitespace-pre-line text-sm font-semibold">{value}</p>
        </div>
    );
}

function ReceiptTotalRow({ label, value, strong = false, className = "" }) {
    return (
        <div className={`rounded-lg border px-3 py-2 ${className}`.trim()}>
            <div className="flex items-center justify-between text-sm">
                <span className="theme-muted">{label}</span>
                <span className={strong ? "text-lg font-bold" : "font-semibold"}>{value}</span>
            </div>
        </div>
    );
}
