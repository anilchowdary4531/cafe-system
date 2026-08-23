import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Activity, IndianRupee, ReceiptText, RefreshCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRestaurantContext } from "../context/RestaurantContext";
import useCachedGet from "../hooks/useCachedGet";
import { useCart } from "../context/CartContext";
import { showToast } from "../utils/toast";
import BrandLogo from "../components/BrandLogo";
import { buildRestaurantMenuPath } from "../utils/restaurantMenuNavigation";
import Footer from "../components/Footer";
import {
    Cell,
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    ReferenceLine,
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

const getOrderFlowLabel = (order) => {
    const source = String(order?.orderSource || "").trim().toUpperCase();
    const tableNo = String(order?.tableNo || "").trim();
    const fulfillment = String(order?.fulfillment || "").trim().toUpperCase();

    if (fulfillment === "PICKUP") return "Pickup";
    if (fulfillment === "DELIVERY") return "Delivery";
    if (fulfillment === "DINEIN") return tableNo ? `Table ${tableNo}` : "Dine In";
    if (tableNo) return `Table ${tableNo}`;
    if (source === "ONLINE") return order?.deliveryAddress ? "Delivery" : "Pickup";
    if (["DELIVERY", "HOME_DELIVERY", "DOOR_DELIVERY"].includes(source)) return "Delivery";
    if (["POS", "PICKUP", "TAKEAWAY", "TAKE_AWAY", "COUNTER"].includes(source)) return "Pickup";
    return "Takeaway";
};

export function reorderOrderToCart({ restaurantSlug, order, addToCart, setRestaurantContext, navigate, tableNo = "" }) {
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
    navigate(buildRestaurantMenuPath(slug, tableNo));
    return addedCount;
}

export default function OrderHistory({ embedded = false } = {}) {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { customer, customerToken } = useAuth();
    const { restaurantContext, setRestaurantContext } = useRestaurantContext();
    const { addToCart } = useCart();
    const highlightOrderIdFromState = location?.state?.highlightOrderId || null;
    const isCustomerScope = searchParams.get("scope") === "customer";
    const buildProfilePath = (path) => (isCustomerScope ? `${path}?scope=customer` : path);

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
    const [dateFilter, setDateFilter] = useState("");
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
        const datedOrders = filteredOrders
            .map((order) => new Date(order?.createdAt))
            .filter((date) => !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());
        const anchorDate = datedOrders.length ? datedOrders[datedOrders.length - 1] : new Date();
        const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - (days - 1));
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

    const restaurantBreakdownAverage = useMemo(() => {
        if (!restaurantBreakdown.length) return 0;
        return restaurantBreakdown.reduce((sum, row) => sum + Number(row?.spend || 0), 0) / restaurantBreakdown.length;
    }, [restaurantBreakdown]);

    const topRestaurantBreakdown = restaurantBreakdown[0] || null;

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
        const currentTableNo =
            String(restaurantContext?.slug || "") === String(restaurantSlug || "")
                ? String(restaurantContext?.tableNo || "").trim()
                : "";
        const addedCount = reorderOrderToCart({
            restaurantSlug,
            order,
            addToCart,
            setRestaurantContext,
            navigate,
            tableNo: currentTableNo,
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
                                        to={buildProfilePath("/profile/overview")}
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

                            <div className={embedded ? "mt-5" : "mt-6 grid gap-4 lg:grid-cols-2"}>
                                    <div className="theme-card rounded-2xl p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.22em]">Order insights</p>
                                            <p className="mt-2 text-lg font-semibold">Orders vs spend</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="theme-soft-button rounded-xl px-3 py-1.5 font-semibold">{derivedStats.totalOrders} orders</span>
                                            <span className="theme-soft-button rounded-xl px-3 py-1.5 font-semibold">{formatMoney(derivedStats.totalSpend)}</span>
                                        </div>
                                    </div>

                                    {spendTrendData.length === 0 ? (
                                        <div className="theme-empty mt-4 rounded-2xl p-6">No data yet.</div>
                                    ) : (
                                        <div className="mt-4 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,250,238,0.06),rgba(255,248,232,0.035)),repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_44px),repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_64px)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                                <span className="rounded-full border border-[#dfc07b]/30 bg-[#dfc07b]/10 px-3 py-1 text-[11px] font-semibold text-[#f3d78d]">
                                                    Avg {formatMoney(derivedStats.averageOrderValue)}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80">
                                                    Peak {formatMoney(Math.max(...spendTrendData.map((item) => Number(item.spend || 0)), 0))}
                                                </span>
                                            </div>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={spendTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="historySpendGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#dfc07b" stopOpacity={0.42} />
                                                            <stop offset="50%" stopColor="#dfc07b" stopOpacity={0.16} />
                                                            <stop offset="100%" stopColor="#dfc07b" stopOpacity={0.02} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid stroke="rgba(255,248,232,0.08)" vertical={false} strokeDasharray="2 8" />
                                                    <XAxis dataKey="day" tick={{ fill: "var(--app-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                                    <YAxis
                                                        yAxisId="left"
                                                        tick={{ fill: "var(--app-muted)", fontSize: 12 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        width={40}
                                                        tickFormatter={(v) => String(Math.round(Number(v || 0)))}
                                                    />
                                                    <YAxis
                                                        yAxisId="right"
                                                        orientation="right"
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
                                                        formatter={(value, name) => {
                                                            if (name === "Orders") return [String(value), "Orders"];
                                                            return [formatMoney(value), "Spend"];
                                                        }}
                                                    />
                                                    <Area
                                                        yAxisId="right"
                                                        type="monotone"
                                                        dataKey="spend"
                                                        stroke="#dfc07b"
                                                        strokeWidth={3}
                                                        fill="url(#historySpendGradient)"
                                                        fillOpacity={1}
                                                        name="Spend"
                                                        activeDot={{ r: 6, fill: "#dfc07b", stroke: "#1b1b20", strokeWidth: 2 }}
                                                    />
                                                    <Line
                                                        yAxisId="left"
                                                        type="monotone"
                                                        dataKey="orders"
                                                        name="Orders"
                                                        stroke="rgba(255,255,255,0.88)"
                                                        strokeWidth={2}
                                                        dot={{ r: 3, fill: "#ffffff", stroke: "#1b1b20", strokeWidth: 1.5 }}
                                                        activeDot={{ r: 5, fill: "#ffffff", stroke: "#1b1b20", strokeWidth: 2 }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!embedded && restaurantBreakdown.length > 0 && (
                                <div className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(245,185,78,0.16),transparent_34%),linear-gradient(180deg,rgba(255,248,232,0.05),rgba(255,248,232,0.02))] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.28em]">Restaurant-wise Spend</p>
                                            <p className="mt-2 text-lg font-semibold sm:text-xl">Spend by restaurant</p>
                                            <p className="theme-muted mt-1 max-w-2xl text-sm">
                                                A ranked view of where your spend is concentrated across restaurants.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full border border-[#dfc07b]/25 bg-[#dfc07b]/10 px-3 py-1.5 text-[11px] font-semibold text-[#f7df9d]">
                                                {restaurantBreakdown.length} restaurants
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80">
                                                Avg {formatMoney(restaurantBreakdownAverage)}
                                            </span>
                                            {topRestaurantBreakdown ? (
                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80">
                                                    Top {topRestaurantBreakdown.name}: {formatMoney(topRestaurantBreakdown.spend)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
                                        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,248,232,0.03)),repeating-linear-gradient(0deg,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_42px),repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_56px)] p-3 sm:p-4">
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={restaurantBreakdown}
                                                        layout="vertical"
                                                        margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
                                                        barCategoryGap={18}
                                                    >
                                                        <defs>
                                                            <linearGradient id="restaurantSpendGradient" x1="0" y1="0" x2="1" y2="0">
                                                                <stop offset="0%" stopColor="#f8d98a" stopOpacity={1} />
                                                                <stop offset="55%" stopColor="#f5b94e" stopOpacity={1} />
                                                                <stop offset="100%" stopColor="#ef9f2e" stopOpacity={1} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid stroke="rgba(255,248,232,0.08)" vertical={false} strokeDasharray="2 8" />
                                                        <XAxis
                                                            type="number"
                                                            tick={{ fill: "var(--app-muted)", fontSize: 12 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tickFormatter={(v) => formatMoney(v)}
                                                            tickMargin={10}
                                                        />
                                                        <YAxis
                                                            type="category"
                                                            dataKey="name"
                                                            tick={{ fill: "var(--app-muted-strong)", fontSize: 12, fontWeight: 600 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                            width={128}
                                                            tickMargin={10}
                                                        />
                                                        <ReferenceLine
                                                            x={restaurantBreakdownAverage}
                                                            stroke="rgba(245,185,78,0.35)"
                                                            strokeDasharray="6 6"
                                                            ifOverflow="extendDomain"
                                                        />
                                                        <Tooltip
                                                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                                            contentStyle={{
                                                                background: "rgba(13, 14, 20, 0.96)",
                                                                border: "1px solid rgba(255,255,255,0.12)",
                                                                borderRadius: 18,
                                                                boxShadow: "0 22px 50px rgba(0,0,0,0.35)",
                                                                color: "var(--app-text)",
                                                            }}
                                                            labelStyle={{ color: "var(--app-text)", fontWeight: 700 }}
                                                            formatter={(value, name, props) => {
                                                                if (name === "spend") {
                                                                    return [formatMoney(value), "Spend"];
                                                                }
                                                                return [String(props?.payload?.orders || 0), "Orders"];
                                                            }}
                                                        />
                                                    <Bar dataKey="spend" radius={[0, 7, 7, 0]} maxBarSize={14}>
                                                            {restaurantBreakdown.map((entry, index) => (
                                                                <Cell
                                                                    key={entry.slug}
                                                                    fill={index === 0 ? "url(#restaurantSpendGradient)" : "rgba(245, 185, 78, 0.82)"}
                                                                />
                                                            ))}
                                                            <LabelList
                                                                dataKey="spend"
                                                                position="right"
                                                                offset={10}
                                                                formatter={(value) => formatMoney(value)}
                                                                fill="var(--app-muted-strong)"
                                                                style={{ fontSize: 12, fontWeight: 700 }}
                                                            />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {restaurantBreakdown.map((row, index) => {
                                                const topShare = restaurantBreakdownAverage ? Math.min(100, Math.round((Number(row.spend || 0) / restaurantBreakdownAverage) * 50)) : 0;
                                                return (
                                                    <div
                                                        key={row.slug}
                                                        className="rounded-[22px] border border-white/10 bg-black/10 p-4"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/85">
                                                                        {index + 1}
                                                                    </span>
                                                                    <p className="truncate text-sm font-semibold">{row.name}</p>
                                                                </div>
                                                                <p className="theme-muted mt-1 text-xs">
                                                                    {row.orders} order{row.orders === 1 ? "" : "s"}
                                                                </p>
                                                            </div>
                                                            <p className="shrink-0 text-sm font-semibold tabular-nums text-[#f7df9d]">
                                                                {formatMoney(row.spend)}
                                                            </p>
                                                        </div>

                                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                                                            <div
                                                                className="h-full rounded-full bg-[linear-gradient(90deg,#f8d98a,#f5b94e,#ef9f2e)]"
                                                                style={{ width: `${Math.max(12, topShare)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
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
                            profilePath={buildProfilePath}
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

function RestaurantOrders({ group, highlightOrderId, onReorder, embedded = false, profilePath }) {
    const { restaurantContext } = useRestaurantContext();
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
                    <Link
                        to={buildRestaurantMenuPath(
                            restaurant.slug,
                            String(restaurantContext?.slug || "") === String(restaurant.slug || "") ? restaurantContext?.tableNo || "" : ""
                        )}
                        className={embedded ? "theme-button inline-flex justify-center rounded-xl px-3 py-2 text-xs font-semibold" : "theme-button inline-flex justify-center rounded-2xl px-5 py-3 text-sm font-semibold"}
                    >
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
                            profilePath={profilePath}
                        />
                    ))}
                </div>
            )}
            {!embedded && <Footer />}
        </section>
    );
}

function OrderCard({ order, restaurantName, restaurantSlug, onReorder, profilePath, highlight = false, embedded = false }) {
    const createdAt = useMemo(() => new Date(order?.createdAt), [order?.createdAt]);
    const status = String(order?.status || "PLACED").toUpperCase();
    const flowLabel = getOrderFlowLabel(order);

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
                        <span className={embedded ? "theme-pill rounded-full px-2 py-1" : "theme-pill rounded-full px-3 py-1"}>Type: {flowLabel}</span>
                        <span className={embedded ? "theme-pill rounded-full px-2 py-1" : "theme-pill rounded-full px-3 py-1"}>Total: {formatMoney(order?.total)}</span>
                    </div>
                </div>

                <div className={embedded ? "flex gap-2 md:w-[220px]" : "flex flex-col gap-3 md:w-[280px]"}>
                    <Link
                        to={profilePath ? profilePath(`/profile/orders/${encodeURIComponent(String(order?.id || ""))}`) : `/profile/orders/${encodeURIComponent(String(order?.id || ""))}`}
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
