import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, IndianRupee, ReceiptText, RefreshCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";
import { useCart } from "../context/CartContext";
import { showToast } from "../utils/toast";
import BrandLogo from "../components/BrandLogo";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);

const formatMoney = (value) => `₹${Math.round(Number(value || 0))}`;
const formatStatus = (status) => {
    const value = String(status || "PLACED").toUpperCase();
    return value.charAt(0) + value.slice(1).toLowerCase();
};

const toDayKey = (raw) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const getTodayKey = () => toDayKey(new Date());

const formatDayLabel = (dayKey) => {
    // dayKey is YYYY-MM-DD, safe for new Date().
    const d = new Date(`${dayKey}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dayKey;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

export function reorderOrderToCart({ restaurantSlug, order, addToCart, setRestaurantContext, navigate }) {
    const slug = String(restaurantSlug || "").trim();
    if (!slug) return 0;

    const items = Array.isArray(order?.items) ? order.items : [];
    let addedCount = 0;

    items.forEach((item) => {
        const qty = Math.max(1, Number(item?.qty || 1));
        const idCandidate = Number(item?.menuItemId || 0) || -Math.abs(Number(item?.id || 0) || 0);
        const base = {
            id: idCandidate || -Date.now(),
            name: String(item?.itemName || "Item"),
            price: Number(item?.price || 0),
            image: FALLBACK_IMAGE,
        };
        for (let i = 0; i < qty; i += 1) {
            addToCart(base, { silent: true });
            addedCount += 1;
        }
    });

    setRestaurantContext({ slug });
    navigate(`/r/${slug}`);
    return addedCount;
}

export default function OrderHistory({ embedded = false } = {}) {
    const location = useLocation();
    const navigate = useNavigate();
    const { customer, customerToken } = useAuth();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const { addToCart } = useCart();
    const highlightOrderIdFromState = location?.state?.highlightOrderId || null;

    const phone = String(customer?.phone || "").trim();
    const enabled = Boolean(phone || customerToken);
    const params = useMemo(() => (phone ? { phone } : undefined), [phone]);

    const { data, loading, error, refresh } = useCachedGet("/customer/orders", {
        enabled,
        params,
        ttlMs: 10_000,
        staleMs: 5 * 60_000,
        scope: phone ? `customer:${phone}` : "customer:session",
    });

    const groups = useMemo(() => (Array.isArray(data?.groups) ? data.groups : []), [data?.groups]);
    const [selectedSlug, setSelectedSlug] = useState(() => String(restaurantContext?.slug || ""));
    const [dateFilter, setDateFilter] = useState(() => getTodayKey());
    const [statusFilter, setStatusFilter] = useState("");
    const [tableFilter, setTableFilter] = useState("");

    useEffect(() => {
        // Keep the default selection aligned with whatever restaurant the user is browsing.
        const ctxSlug = String(restaurantContext?.slug || "");
        if (!ctxSlug) return;
        setSelectedSlug((prev) => (prev ? prev : ctxSlug));
    }, [restaurantContext?.slug]);

    useEffect(() => {
        // Reset filters when switching restaurant selection.
        setStatusFilter("");
        setTableFilter("");
    }, [selectedSlug]);

    const groupOptions = useMemo(() => {
        return groups
            .map((g) => g?.restaurant)
            .filter(Boolean)
            .map((r) => ({
                slug: String(r.slug || ""),
                name: String(r.name || r.slug || "Restaurant"),
                id: Number(r.id || 0) || null,
                city: r.city || "",
                state: r.state || "",
            }))
            .filter((r) => r.slug);
    }, [groups]);

    const visibleGroups = useMemo(() => {
        if (!selectedSlug) return groups;
        const match = groups.find((g) => String(g?.restaurant?.slug || "") === selectedSlug);
        return match ? [match] : groups;
    }, [groups, selectedSlug]);

    const overallStats = useMemo(() => {
        const allOrders = visibleGroups.flatMap((g) => g?.orders || []);
        const totalOrders = allOrders.length;
        const totalSpend = allOrders.reduce((sum, o) => sum + Number(o?.total || 0), 0);
        const activeOrders = allOrders.reduce((sum, o) => sum + (ACTIVE_STATUSES.has(String(o?.status || "").toUpperCase()) ? 1 : 0), 0);
        return { totalOrders, totalSpend, activeOrders };
    }, [visibleGroups]);

    const filteredVisibleGroups = useMemo(() => {
        return visibleGroups.map((g) => {
            const orders = Array.isArray(g?.orders) ? g.orders : [];
            const filtered = orders.filter((o) => {
                const status = String(o?.status || "").toUpperCase();
                const tableNo = String(o?.tableNo || "").trim();
                const orderDay = toDayKey(o?.createdAt);

                if (dateFilter && orderDay !== dateFilter) return false;
                if (statusFilter && status !== statusFilter) return false;
                if (tableFilter) {
                    if (tableFilter === "__none__") {
                        if (tableNo) return false;
                    } else if (tableNo !== tableFilter) {
                        return false;
                    }
                }
                return true;
            });

            return {
                ...g,
                orders: filtered,
            };
        });
    }, [dateFilter, statusFilter, tableFilter, visibleGroups]);

    const filteredOrders = useMemo(() => {
        return filteredVisibleGroups.flatMap((g) => g?.orders || []);
    }, [filteredVisibleGroups]);

    const derivedStats = useMemo(() => {
        const totalOrders = filteredOrders.length;
        const totalSpend = filteredOrders.reduce((sum, o) => sum + Number(o?.total || 0), 0);
        const averageOrderValue = totalOrders ? totalSpend / totalOrders : 0;
        const activeOrders = filteredOrders.reduce(
            (sum, o) => sum + (ACTIVE_STATUSES.has(String(o?.status || "").toUpperCase()) ? 1 : 0),
            0
        );
        return { totalOrders, totalSpend, averageOrderValue, activeOrders };
    }, [filteredOrders]);

    const spendTrendData = useMemo(() => {
        const days = 14;
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
        const buckets = new Map();

        for (let i = 0; i < days; i += 1) {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            const key = toDayKey(d);
            buckets.set(key, { key, day: formatDayLabel(key), spend: 0, orders: 0 });
        }

        filteredOrders.forEach((o) => {
            const key = toDayKey(o?.createdAt);
            const bucket = buckets.get(key);
            if (!bucket) return;
            bucket.spend += Number(o?.total || 0);
            bucket.orders += 1;
        });

        return [...buckets.values()];
    }, [filteredOrders]);

    const restaurantBreakdown = useMemo(() => {
        return filteredVisibleGroups
            .map((g) => {
                const restaurant = g?.restaurant || null;
                const name = String(restaurant?.name || restaurant?.slug || "Restaurant");
                const slug = String(restaurant?.slug || "");
                const orders = Array.isArray(g?.orders) ? g.orders : [];
                const spend = orders.reduce((sum, o) => sum + Number(o?.total || 0), 0);
                return { name, slug, spend, orders: orders.length };
            })
            .filter((r) => r.slug && (r.orders > 0 || r.spend > 0))
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 6);
    }, [filteredVisibleGroups]);

    const selectedGroup = useMemo(() => {
        if (!selectedSlug) return null;
        return filteredVisibleGroups.find((g) => String(g?.restaurant?.slug || "") === selectedSlug) || null;
    }, [filteredVisibleGroups, selectedSlug]);

    const selectedRestaurantName = useMemo(() => {
        if (!selectedGroup) return "";
        const r = selectedGroup?.restaurant || null;
        return String(r?.name || r?.slug || "").trim();
    }, [selectedGroup]);

    const restaurantItemInsights = useMemo(() => {
        if (!selectedGroup) return [];
        const orders = Array.isArray(selectedGroup?.orders) ? selectedGroup.orders : [];
        const map = new Map();

        orders.forEach((o) => {
            const items = Array.isArray(o?.items) ? o.items : [];
            items.forEach((item) => {
                const name = String(item?.itemName || "Item").trim() || "Item";
                const key = String(item?.menuItemId || "") ? `m:${String(item.menuItemId)}` : `n:${name.toLowerCase()}`;
                const prev = map.get(key) || { key, name, qty: 0, total: 0 };
                prev.qty += Math.max(0, Number(item?.qty || 0));
                prev.total += Number(item?.total || 0);
                map.set(key, prev);
            });
        });

        return [...map.values()]
            .filter((row) => row.qty > 0 || row.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 12);
    }, [selectedGroup]);

    const tableOptions = useMemo(() => {
        const set = new Set();
        filteredVisibleGroups.forEach((g) => {
            (g?.orders || []).forEach((o) => {
                const t = String(o?.tableNo || "").trim();
                if (t) set.add(t);
            });
        });
        return [...set.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    }, [filteredVisibleGroups]);

    const statusOptions = useMemo(() => {
        const set = new Set();
        visibleGroups.forEach((g) => {
            (g?.orders || []).forEach((o) => {
                const s = String(o?.status || "").trim().toUpperCase();
                if (s) set.add(s);
            });
        });
        return [...set.values()].sort((a, b) => a.localeCompare(b));
    }, [visibleGroups]);

    const handleRestaurantChange = (slug) => {
        setSelectedSlug(slug);
        const next = groupOptions.find((r) => r.slug === slug);
        if (next) {
            setRestaurantContext({ id: next.id || null, name: next.name || null, slug: next.slug || null });
        }
    };

    const handleReorder = (restaurantSlug, order) => {
        const addedCount = reorderOrderToCart({
            restaurantSlug,
            order,
            addToCart,
            setRestaurantContext,
            navigate,
        });
        if (addedCount > 0) {
            showToast({
                title: "Cart updated",
                message: `Added ${addedCount} item${addedCount === 1 ? "" : "s"} from your previous order.`,
                variant: "success",
            });
        }
    };

    return (
        <div className={embedded ? "space-y-4" : "theme-page min-h-screen px-4 py-10 md:px-8"}>
            <div className={embedded ? "space-y-4" : "mx-auto w-full max-w-6xl space-y-6"}>
                <header className={embedded ? "space-y-4" : "theme-panel rounded-[32px] p-6 md:p-8"}>
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Orders</p>
                            <h1 className={embedded ? "mt-2 text-2xl font-bold tracking-tight md:text-[2rem]" : "mt-3 text-3xl font-bold tracking-tight md:text-4xl"}>
                                Order history by restaurant
                            </h1>
                            <p className={embedded ? "theme-muted mt-2 max-w-2xl text-xs md:text-sm" : "theme-muted mt-3 max-w-2xl text-sm md:text-base"}>
                                Logged in as <span className="font-semibold">{phone || "customer"}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => refresh({ force: true })}
                                className={embedded
                                    ? "theme-soft-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                                    : "theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"}
                                disabled={!enabled}
                            >
                                <RefreshCcw size={16} />
                                Refresh
                            </button>
                            {!embedded && (
                                <>
                                    <Link
                                        to="/profile"
                                        className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                                    >
                                        Back to Profile
                                    </Link>
                                    <button
                                        onClick={() => navigate("/")}
                                        className="theme-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                                    >
                                        Back Home
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {!enabled && (
                        <div className="theme-empty mt-6 rounded-3xl p-6">
                            <p className="font-semibold">No customer session found.</p>
                            <p className="theme-muted mt-2 text-sm">
                                Place an order from a restaurant menu first. We use your phone number to load your history.
                            </p>
                            <div className="mt-4">
                                <Link to="/" className="theme-button inline-flex rounded-2xl px-5 py-3 font-semibold">
                                    Choose Restaurant
                                </Link>
                            </div>
                        </div>
                    )}

                    {enabled && loading && <p className="theme-muted mt-6">Loading orders...</p>}
                    {enabled && error && (
                        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {enabled && !loading && !error && (
                        <>
                            {embedded ? (
                                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                                    <p><span className="theme-muted">Orders:</span> <span className="font-semibold">{derivedStats.totalOrders}</span></p>
                                    <p><span className="theme-muted">Spend:</span> <span className="font-semibold">{formatMoney(derivedStats.totalSpend)}</span></p>
                                    <p><span className="theme-muted">Avg:</span> <span className="font-semibold">{formatMoney(derivedStats.averageOrderValue)}</span></p>
                                    <p><span className="theme-muted">Active:</span> <span className="font-semibold">{derivedStats.activeOrders}</span></p>
                                </div>
                            ) : (
                                <div className="mt-6 grid gap-4 md:grid-cols-4">
                                    <HistoryStat icon={<ReceiptText size={18} />} label="Orders" value={String(derivedStats.totalOrders)} />
                                    <HistoryStat icon={<IndianRupee size={18} />} label="Spend" value={formatMoney(derivedStats.totalSpend)} />
                                    <HistoryStat icon={<IndianRupee size={18} />} label="Avg Order" value={formatMoney(derivedStats.averageOrderValue)} />
                                    <HistoryStat icon={<Activity size={18} />} label="Active" value={String(derivedStats.activeOrders)} />
                                </div>
                            )}

                            <div className={embedded ? "mt-4 grid gap-2 sm:grid-cols-4" : "mt-6 grid gap-3 md:grid-cols-4"}>
                                <label className={embedded ? "space-y-1" : "theme-card rounded-2xl p-4 md:col-span-1"}>
                                    <span className={embedded ? "theme-muted text-[11px] font-semibold uppercase tracking-[0.2em]" : "theme-muted text-xs font-semibold uppercase tracking-[0.22em]"}>Date</span>
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                        className={embedded ? "theme-input mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none" : "theme-input mt-3 w-full rounded-2xl px-4 py-3 outline-none"}
                                    />
                                </label>

                                <label className={embedded ? "space-y-1" : "theme-card rounded-2xl p-4 md:col-span-1"}>
                                    <span className={embedded ? "theme-muted text-[11px] font-semibold uppercase tracking-[0.2em]" : "theme-muted text-xs font-semibold uppercase tracking-[0.22em]"}>Restaurant</span>
                                    <select
                                        value={selectedSlug}
                                        onChange={(e) => handleRestaurantChange(e.target.value)}
                                        className={embedded ? "theme-input mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none" : "theme-input mt-3 w-full rounded-2xl px-4 py-3 outline-none"}
                                    >
                                        <option value="">All restaurants</option>
                                        {groupOptions.map((r) => (
                                            <option key={r.slug} value={r.slug}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className={embedded ? "space-y-1" : "theme-card rounded-2xl p-4 md:col-span-1"}>
                                    <span className={embedded ? "theme-muted text-[11px] font-semibold uppercase tracking-[0.2em]" : "theme-muted text-xs font-semibold uppercase tracking-[0.22em]"}>Status</span>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className={embedded ? "theme-input mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none" : "theme-input mt-3 w-full rounded-2xl px-4 py-3 outline-none"}
                                    >
                                        <option value="">All statuses</option>
                                        {statusOptions.map((s) => (
                                            <option key={s} value={s}>
                                                {formatStatus(s)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className={embedded ? "space-y-1" : "theme-card rounded-2xl p-4 md:col-span-1"}>
                                    <span className={embedded ? "theme-muted text-[11px] font-semibold uppercase tracking-[0.2em]" : "theme-muted text-xs font-semibold uppercase tracking-[0.22em]"}>Table</span>
                                    <select
                                        value={tableFilter}
                                        onChange={(e) => setTableFilter(e.target.value)}
                                        className={embedded ? "theme-input mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none" : "theme-input mt-3 w-full rounded-2xl px-4 py-3 outline-none"}
                                    >
                                        <option value="">All tables</option>
                                        <option value="__none__">Takeaway / No table</option>
                                        {tableOptions.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {!embedded && selectedSlug && (
                                <div className="mt-6 theme-card rounded-2xl p-5">
                                    <p className="theme-muted text-xs font-semibold uppercase tracking-[0.22em]">Insights</p>
                                    <p className="mt-2 text-lg font-semibold">
                                        Items bought at {selectedRestaurantName || selectedSlug}
                                    </p>

                                    {!restaurantItemInsights.length ? (
                                        <div className="theme-empty mt-4 rounded-2xl p-6">No item data available.</div>
                                    ) : (
                                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                                            <div className="divide-y divide-white/10">
                                                {restaurantItemInsights.map((row) => (
                                                    <div key={row.key} className="flex items-start justify-between gap-4 px-5 py-4">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">{row.name}</p>
                                                            <p className="theme-muted mt-1 text-xs">
                                                                Qty <span className="font-semibold tabular-nums">{row.qty}</span>
                                                            </p>
                                                        </div>
                                                        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(row.total)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!embedded && <div className="mt-6 grid gap-4 lg:grid-cols-2">
                                <div className="theme-card rounded-2xl p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.22em]">Orders Over Time</p>
                                            <p className="mt-2 text-lg font-semibold">Last 14 days</p>
                                        </div>
                                        <div className="theme-muted text-sm">
                                            Total: <span className="font-semibold">{String(derivedStats.totalOrders)}</span>
                                        </div>
                                    </div>

                                    {spendTrendData.length === 0 ? (
                                        <div className="theme-empty mt-4 rounded-2xl p-6">No data yet.</div>
                                    ) : (
                                        <div className="mt-4 h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={spendTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="var(--app-primary)" stopOpacity={0.45} />
                                                            <stop offset="95%" stopColor="var(--app-primary)" stopOpacity={0.05} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid stroke="var(--app-border)" opacity={0.35} vertical={false} />
                                                    <XAxis dataKey="day" tick={{ fill: "var(--app-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                                    <YAxis
                                                        tick={{ fill: "var(--app-muted)", fontSize: 12 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        width={40}
                                                        tickFormatter={(v) => String(Math.round(Number(v || 0)))}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{
                                                            background: "var(--app-surface)",
                                                            border: "1px solid var(--app-border)",
                                                            borderRadius: 16,
                                                            boxShadow: "var(--app-shadow)",
                                                        }}
                                                        labelStyle={{ color: "var(--app-text)", fontWeight: 700 }}
                                                        formatter={(value, name, props) => {
                                                            if (name === "orders") return [String(value), "Orders"];
                                                            return [String(value), String(name)];
                                                        }}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="orders"
                                                        stroke="var(--app-primary)"
                                                        strokeWidth={2}
                                                        fill="url(#ordersGradient)"
                                                        fillOpacity={1}
                                                        name="orders"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </div>}

                            {!embedded && restaurantBreakdown.length > 0 && (
                                <div className="mt-4 theme-card rounded-2xl p-5">
                                    <p className="theme-muted text-xs font-semibold uppercase tracking-[0.22em]">Restaurant-wise Spend</p>
                                    <p className="mt-2 text-lg font-semibold">Spend by restaurant</p>
                                    <div className="mt-4 h-44">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={restaurantBreakdown} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                                <CartesianGrid stroke="var(--app-border)" opacity={0.25} vertical={false} />
                                                <XAxis
                                                    dataKey="name"
                                                    tick={{ fill: "var(--app-muted)", fontSize: 11 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    interval={0}
                                                    height={56}
                                                />
                                                <YAxis
                                                    tick={{ fill: "var(--app-muted)", fontSize: 12 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={40}
                                                    tickFormatter={(v) => Math.round(Number(v || 0))}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: "var(--app-surface)",
                                                        border: "1px solid var(--app-border)",
                                                        borderRadius: 16,
                                                        boxShadow: "var(--app-shadow)",
                                                    }}
                                                    labelStyle={{ color: "var(--app-text)", fontWeight: 700 }}
                                                    formatter={(value) => [formatMoney(value), "Spend"]}
                                                />
                                                <Bar dataKey="spend" fill="var(--app-primary)" radius={[14, 14, 6, 6]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </header>

                {enabled && !loading && !error && (
                    <div className="space-y-6">
                        {filteredVisibleGroups.length === 0 && (
                            <div className={embedded ? "theme-muted rounded-2xl px-1 py-3 text-sm" : "theme-empty rounded-[32px] p-8"}>No orders found.</div>
                        )}

                        {filteredVisibleGroups.map((group) => (
                            <RestaurantOrders
                                key={String(group?.restaurant?.slug || "unknown")}
                                group={group}
                                highlightOrderId={highlightOrderIdFromState || customer?.latestOrderId || null}
                                onReorder={handleReorder}
                                embedded={embedded}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function HistoryStat({ icon, label, value }) {
    return (
        <div className="theme-card rounded-2xl p-5">
            <div className="theme-muted flex items-center gap-2 text-sm uppercase tracking-[0.2em]">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{value}</p>
        </div>
    );
}

function RestaurantOrders({ group, highlightOrderId, onReorder, embedded = false }) {
    const restaurant = group?.restaurant || null;
    const orders = Array.isArray(group?.orders) ? group.orders : [];
    const visibleSpend = useMemo(() => orders.reduce((sum, o) => sum + Number(o?.total || 0), 0), [orders]);
    const lastOrderAtMs = useMemo(() => {
        return orders.reduce((max, o) => {
            const t = new Date(o?.createdAt).getTime();
            return Number.isFinite(t) ? Math.max(max, t) : max;
        }, 0);
    }, [orders]);

    const restaurantName = String(restaurant?.name || restaurant?.slug || "Restaurant");
    const addressBits = [restaurant?.city, restaurant?.state].filter(Boolean).join(", ");

    return (
        <section className={embedded ? "rounded-2xl px-1 py-2" : "theme-panel rounded-[32px] p-6"}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div className={embedded ? "flex h-10 w-10 items-center justify-center rounded-xl bg-black/10" : "theme-card flex h-12 w-12 items-center justify-center rounded-2xl"}>
                        <BrandLogo className="h-5 w-5" title="Restaurant logo" />
                    </div>
                    <div>
                        <h2 className={embedded ? "text-lg font-semibold" : "text-xl font-semibold"}>{restaurantName}</h2>
                        {addressBits && <p className={embedded ? "theme-muted mt-1 text-xs" : "theme-muted mt-1 text-sm"}>{addressBits}</p>}
                        <p className={embedded ? "theme-muted mt-1 text-[11px] uppercase tracking-[0.18em]" : "theme-muted mt-2 text-xs uppercase tracking-[0.22em]"}>
                            {orders.length} order{orders.length === 1 ? "" : "s"}
                            {orders.length ? ` | ${formatMoney(visibleSpend)}` : ""}
                            {lastOrderAtMs ? ` | Last: ${new Date(lastOrderAtMs).toLocaleDateString()}` : ""}
                        </p>
                    </div>
                </div>

                {restaurant?.slug && (
                    <Link to={`/r/${restaurant.slug}`} className={embedded ? "theme-button inline-flex justify-center rounded-xl px-3 py-2 text-xs font-semibold" : "theme-button inline-flex justify-center rounded-2xl px-5 py-3 text-sm font-semibold"}>
                        Continue Ordering
                    </Link>
                )}
            </div>

            {!orders.length ? (
                <div className={embedded ? "theme-muted mt-4 text-sm" : "theme-empty mt-6 rounded-3xl p-6"}>No orders for this restaurant.</div>
            ) : (
                <div className={embedded ? "mt-4 space-y-0" : "mt-6 space-y-4"}>
                    {orders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            restaurantName={restaurantName}
                            restaurantSlug={restaurant?.slug || ""}
                            highlight={highlightOrderId === order.id}
                            onReorder={onReorder}
                            embedded={embedded}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function OrderCard({ order, restaurantName, restaurantSlug, onReorder, highlight = false, embedded = false }) {
    const createdAt = useMemo(() => new Date(order?.createdAt), [order?.createdAt]);
    const status = String(order?.status || "PLACED").toUpperCase();
    const tableNoRaw = String(order?.tableNo || "").trim();

    const highlightStyle = !embedded && highlight ? { boxShadow: "0 0 0 2px var(--app-primary)" } : undefined;

    return (
        <article className={embedded ? "border-b border-[var(--app-border)] py-3 last:border-b-0" : "theme-card rounded-3xl p-5"} style={highlightStyle}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className={embedded ? "theme-muted text-[11px] uppercase tracking-[0.16em]" : "theme-muted text-xs uppercase tracking-[0.2em]"}>{restaurantName}</p>
                    <h3 className={embedded ? "mt-1 text-base font-semibold" : "mt-2 text-lg font-semibold"}>Order #{order?.orderNo || order?.id}</h3>
                    <p className={embedded ? "theme-muted mt-1 text-xs" : "theme-muted mt-1 text-sm"}>
                        {Number.isNaN(createdAt.getTime()) ? "Unknown time" : createdAt.toLocaleString()}
                    </p>
                    <div className={embedded ? "mt-2 flex flex-wrap gap-1.5 text-[11px]" : "mt-3 flex flex-wrap gap-2 text-xs"}>
                        <span className={embedded ? "theme-pill rounded-full px-2 py-1" : "theme-pill rounded-full px-3 py-1"}>Status: {formatStatus(status)}</span>
                        <span className={embedded ? "theme-pill rounded-full px-2 py-1" : "theme-pill rounded-full px-3 py-1"}>Table: {tableNoRaw ? tableNoRaw : "Takeaway"}</span>
                        <span className={embedded ? "theme-pill rounded-full px-2 py-1" : "theme-pill rounded-full px-3 py-1"}>Total: {formatMoney(order?.total)}</span>
                    </div>
                </div>

                <div className={embedded ? "flex gap-2 md:w-[220px]" : "flex flex-col gap-3 md:w-[280px]"}>
                    <Link
                        to={`/profile/orders/${encodeURIComponent(String(order?.id || ""))}`}
                        state={{ order, restaurant: { name: restaurantName, slug: restaurantSlug } }}
                        className={embedded
                            ? "theme-soft-button inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold"
                            : "theme-soft-button inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold"}
                    >
                        View Details
                    </Link>

                    {restaurantSlug && (
                        <button
                            type="button"
                            onClick={() => onReorder && onReorder(restaurantSlug, order)}
                            className={embedded ? "theme-button rounded-xl px-3 py-2 text-xs font-semibold" : "theme-button rounded-2xl px-4 py-3 text-sm font-semibold"}
                        >
                            Reorder
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

// (intentionally no shared Row helper here; order detail view has its own billing summary)
