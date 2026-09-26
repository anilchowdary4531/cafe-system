import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { LoaderCircle, RefreshCw, Search, X, ShoppingBag, ArrowLeft } from "lucide-react";
import { API } from "../../config";
import OwnerMenuButton from "../../components/OwnerMenuButton";

const STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"];
const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);
const ORDER_TABS = [
    { key: "ALL", label: "All Orders" },
    { key: "DINE_IN", label: "Dine In" },
    { key: "ONLINE", label: "Online" },
];

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const formatTimeAgo = (isoDate) => {
    const time = new Date(isoDate).getTime();
    if (Number.isNaN(time)) return "";
    const mins = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} day ago`;
};

const statusClass = (status) => {
    if (status === "READY") return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
    if (status === "PREPARING") return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
    if (status === "DELIVERED") return "bg-slate-500/10 text-slate-600 border border-slate-500/20";
    if (status === "CANCELLED") return "bg-red-500/10 text-red-600 border border-red-500/20";
    if (status === "ACCEPTED") return "bg-sky-500/10 text-sky-600 border border-sky-500/20";
    return "bg-blue-500/10 text-blue-600 border border-blue-500/20";
};

const sortOrdersForDisplay = (list) =>
    [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const aCancelled = String(a?.status || "").toUpperCase() === "CANCELLED";
        const bCancelled = String(b?.status || "").toUpperCase() === "CANCELLED";
        if (aCancelled === bCancelled) return 0;
        return aCancelled ? 1 : -1;
    });

const readStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
        return {};
    }
};

const isDineInOrder = (order) => {
    const tableNo = String(order?.tableNo || "").trim();
    const fulfillment = String(order?.fulfillment || "").trim().toUpperCase();
    return Boolean(tableNo) || fulfillment === "DINEIN";
};

const getOrderTabKey = (order) => {
    return isDineInOrder(order) ? "DINE_IN" : "ONLINE";
};

const getOrderFulfillmentLabel = (order) => {
    const tableNo = String(order?.tableNo || "").trim();
    if (isDineInOrder(order)) return tableNo ? `Table ${tableNo}` : "Dine in order";
    return "Online order";
};

const formatOrderType = (order) => {
    return isDineInOrder(order) ? "Dine In" : "Online";
};

const formatCustomerSummary = (order) => {
    const customerName = String(order?.customerName || "").trim();
    if (customerName) return customerName;
    return "Guest";
};

const getItemCount = (order) =>
    (Array.isArray(order?.items) ? order.items : []).reduce(
        (sum, item) => sum + Number(item?.qty || 0),
        0
    );

export default function OwnerOrders({ sourceFilter = "" } = {}) {
    const [orders, setOrders] = useState([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    const [sourceTab, setSourceTab] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [error, setError] = useState("");
    const [itemsModalOrder, setItemsModalOrder] = useState(null);

    const [user] = useState(readStoredUser);

    const restaurantId = Number(user?.restaurantId);
    const normalizedSourceFilter = String(sourceFilter || "").trim().toUpperCase();
    const isOnlineOrders = normalizedSourceFilter === "ONLINE";
    const selectedTab = ORDER_TABS.find((tab) => tab.key === sourceTab) || ORDER_TABS[0];

    const loadOrders = async ({ silent = false } = {}) => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant not linked to current user.");
            return;
        }

        try {
            if (silent) setRefreshing(true);
            else setLoading(true);
            const res = await axios.get(`${API}/owner/${restaurantId}/orders`, {
                params: {
                    ...(query.trim() ? { q: query.trim() } : {}),
                    ...(status ? { status } : {}),
                    ...(normalizedSourceFilter ? { source: normalizedSourceFilter } : {}),
                },
            });
            setOrders(Array.isArray(res.data?.orders) ? res.data.orders : []);
            setError("");
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Unable to load orders.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, [restaurantId, status, normalizedSourceFilter]);

    useEffect(() => {
        if (isOnlineOrders) {
            setSourceTab("ALL");
        }
    }, [isOnlineOrders]);

    useEffect(() => {
        const timer = setTimeout(() => loadOrders({ silent: true }), 300);
        return () => clearTimeout(timer);
    }, [query, normalizedSourceFilter]);

    useEffect(() => {
        if (!itemsModalOrder) return undefined;
        const onKeyDown = (event) => {
            if (event.key === "Escape") setItemsModalOrder(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [itemsModalOrder]);

    const updateStatus = async (order, nextStatus) => {
        try {
            setUpdatingId(order.id);
            const res = await axios.put(`${API}/owner/${restaurantId}/orders/${order.id}/status`, {
                status: nextStatus,
                changedByName: user?.name || "Staff",
            });
            const updated = res.data?.order;
            setOrders((prev) => prev.map((row) => (row.id === updated?.id ? updated : row)));
            setItemsModalOrder((prev) => (prev?.id === updated?.id ? updated : prev));
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to update order.");
        } finally {
            setUpdatingId(null);
        }
    };

    const sortedOrders = sortOrdersForDisplay(orders);
    const tabCounts = useMemo(
        () =>
            orders.reduce(
                (acc, order) => {
                    const tabKey = getOrderTabKey(order);
                    acc.ALL += 1;
                    if (acc[tabKey] === undefined) acc[tabKey] = 0;
                    acc[tabKey] += 1;
                    return acc;
                },
                { ALL: 0, DINE_IN: 0, ONLINE: 0 }
            ),
        [orders]
    );
    const visibleOrders = useMemo(() => {
        if (isOnlineOrders || sourceTab === "ALL") return sortedOrders;
        return sortedOrders.filter((order) => getOrderTabKey(order) === sourceTab);
    }, [isOnlineOrders, sortedOrders, sourceTab]);
    const activeCount = visibleOrders.filter((order) =>
        ACTIVE_STATUSES.has(String(order.status || "").toUpperCase())
    ).length;
    const pageTitle = isOnlineOrders ? "Online Orders" : "Live Orders";
    const activeLabel = isOnlineOrders
        ? "active online orders"
        : sourceTab === "ALL"
            ? "active orders"
            : `active ${selectedTab.label.toLowerCase()} orders`;
    const emptyMessage = isOnlineOrders
        ? "No online orders found."
        : sourceTab === "ALL"
            ? "No orders found."
            : `No ${selectedTab.label.toLowerCase()} orders found.`;

    if (loading) {
        return (
            <div className="flex h-36 items-center justify-center text-xs font-medium text-[color:var(--app-muted)]">
                Loading orders...
            </div>
        );
    }

    return (
        <div className="px-1 py-1 w-full space-y-3 text-[color:var(--app-text)] font-sans">
            {/* Header Tabs (if applicable) */}
            {!isOnlineOrders && (
                <div className="flex items-center gap-4 overflow-x-auto border-b border-[color:var(--app-border)]/40 pb-1">
                    {ORDER_TABS.map((tab) => {
                        const isActive = sourceTab === tab.key;
                        const count = tabCounts[tab.key] || 0;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSourceTab(tab.key)}
                                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-1.5 text-xs font-semibold transition ${
                                    isActive
                                        ? "border-amber-500 text-amber-600"
                                        : "border-transparent text-[color:var(--app-muted)] hover:text-[color:var(--app-text)]"
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.key !== "ALL" && count > 0 && (
                                    <span
                                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                                            isActive
                                                ? "bg-amber-500 text-white"
                                                : "bg-rose-500 text-white"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Header Title & Subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[color:var(--app-border)]/40 pb-3 gap-2">
                <div>
                    <div className="flex items-center gap-3">
                        <OwnerMenuButton />
                        <h1 className="text-xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-2xl">
                            {pageTitle}
                        </h1>
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--app-muted)]">
                        {activeCount} {activeLabel}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[color:var(--app-muted)]">Order Control:</span>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="bg-transparent border-b border-[color:var(--app-border)]/60 text-xs font-medium text-[color:var(--app-text)] py-1 outline-none cursor-pointer"
                    >
                        <option value="" className="bg-[color:var(--app-bg)]">All statuses</option>
                        {STATUSES.map((value) => (
                            <option key={value} value={value} className="bg-[color:var(--app-bg)]">
                                {value}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="border-b border-[color:var(--app-border)]/40 pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--app-muted)]" size={15} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search order, table, customer, phone..."
                            className="w-full bg-transparent border-b border-[color:var(--app-border)]/60 pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] outline-none focus:border-amber-500"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => loadOrders({ silent: true })}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 shadow-sm disabled:opacity-50 shrink-0"
                    >
                        {refreshing ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg bg-red-500/10 p-2.5 text-xs font-medium text-red-500 border border-red-500/20">
                    {error}
                </div>
            )}

            {/* Orders Table - Clean Paper Design */}
            <div className="space-y-2">
                {visibleOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <ShoppingBag className="h-10 w-10 text-[color:var(--app-muted)] opacity-40" />
                        <h3 className="mt-2 text-sm font-semibold text-[color:var(--app-text)]">{emptyMessage}</h3>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-[color:var(--app-border)]/40 text-[color:var(--app-muted)] uppercase tracking-wider font-semibold text-[10px]">
                                <tr>
                                    <th className="py-2 px-3">Order ID</th>
                                    <th className="py-2 px-3">Type</th>
                                    <th className="py-2 px-3">Customer</th>
                                    <th className="py-2 px-3">Items</th>
                                    <th className="py-2 px-3 text-right">Amount</th>
                                    <th className="py-2 px-3">Status</th>
                                    <th className="py-2 px-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[color:var(--app-border)]/20">
                                {visibleOrders.map((order) => {
                                    const normalizedStatus = String(order.status || "PLACED").toUpperCase();
                                    const itemCount = getItemCount(order);
                                    return (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-[color:var(--app-surface)]/20 transition"
                                        >
                                            <td className="py-2 px-3 font-medium text-[color:var(--app-text)]">
                                                <button
                                                    type="button"
                                                    onClick={() => setItemsModalOrder(order)}
                                                    className="font-semibold text-xs text-[color:var(--app-text)] hover:text-amber-600 transition underline-offset-2 hover:underline"
                                                >
                                                    {order.orderNo || `#${order.id}`}
                                                </button>
                                                <p className="text-[10px] text-[color:var(--app-muted)]">
                                                    {order.invoiceNo || "-"}
                                                </p>
                                            </td>
                                            <td className="py-2 px-3 font-medium text-[color:var(--app-text)]">
                                                {formatOrderType(order)}
                                            </td>
                                            <td className="py-2 px-3 font-medium text-[color:var(--app-text)]">
                                                {formatCustomerSummary(order)}
                                            </td>
                                            <td className="py-2 px-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setItemsModalOrder(order)}
                                                    className="font-semibold text-xs text-amber-600 hover:underline"
                                                >
                                                    {itemCount} item{itemCount === 1 ? "" : "s"}
                                                </button>
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                                {formatMoney(order.total)}
                                            </td>
                                            <td className="py-2 px-3">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusClass(normalizedStatus)}`}
                                                >
                                                    {normalizedStatus}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right text-[color:var(--app-muted)]">
                                                {formatTimeAgo(order.createdAt)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ORDER ITEMS MODAL */}
            {itemsModalOrder && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
                    onClick={() => setItemsModalOrder(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-md rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-1)] p-5 shadow-xl text-[color:var(--app-text)] text-xs"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between border-b border-[color:var(--app-border)] pb-3">
                            <div>
                                <p className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Order Items</p>
                                <h4 className="mt-0.5 text-base font-bold text-[color:var(--app-text)]">
                                    {itemsModalOrder.orderNo || `#${itemsModalOrder.id}`}
                                </h4>
                                <p className="mt-0.5 text-xs text-[color:var(--app-muted)]">
                                    {getOrderFulfillmentLabel(itemsModalOrder)}
                                    {itemsModalOrder.customerName ? ` • ${itemsModalOrder.customerName}` : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setItemsModalOrder(null)}
                                className="rounded-lg p-1 text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)]"
                                aria-label="Close items popup"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                            {(itemsModalOrder.items || []).length === 0 ? (
                                <p className="py-4 text-center text-xs text-[color:var(--app-muted)]">
                                    No items found for this order.
                                </p>
                            ) : (
                                (itemsModalOrder.items || []).map((item, index) => {
                                    const qty = Math.max(1, Number(item?.qty || 1));
                                    const label = String(item?.itemName || item?.name || `Item ${index + 1}`);
                                    const lineTotal = Number(item?.total || Number(item?.price || 0) * qty || 0);
                                    return (
                                        <div
                                            key={item?.id || `${label}-${index}`}
                                            className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)]/20 py-2 last:border-b-0"
                                        >
                                            <div className="min-w-0">
                                                <span className="font-bold text-amber-600">{qty}x</span>{" "}
                                                <span className="font-semibold text-[color:var(--app-text)]">{label}</span>
                                            </div>
                                            <p className="shrink-0 font-semibold tabular-nums text-[color:var(--app-text)]">
                                                {formatMoney(lineTotal)}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--app-border)]/30 pt-3">
                            <span className="text-xs text-[color:var(--app-muted)]">
                                Total Items: {(itemsModalOrder.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0)}
                            </span>
                            <span className="text-sm font-bold text-emerald-600">
                                Total: {formatMoney(itemsModalOrder.total)}
                            </span>
                        </div>

                        {itemsModalOrder.deliveryAddress && (
                            <div className="mt-3 rounded-lg bg-[color:var(--app-surface-2)] p-2.5 text-xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--app-muted)]">Delivery Address</p>
                                <p className="mt-0.5 whitespace-pre-line text-[color:var(--app-text)]">
                                    {itemsModalOrder.deliveryAddress}
                                </p>
                            </div>
                        )}

                        <div className="mt-3 flex items-center justify-between pt-1">
                            <span className="text-xs text-[color:var(--app-muted)]">Current Status:</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusClass(String(itemsModalOrder.status || "PLACED").toUpperCase())}`}>
                                {String(itemsModalOrder.status || "PLACED").toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
