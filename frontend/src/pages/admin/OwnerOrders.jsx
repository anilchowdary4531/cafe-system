import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { LoaderCircle, RefreshCcw, Search, X } from "lucide-react";
import { API } from "../../config";

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
    if (status === "READY") return "border border-emerald-200 bg-emerald-100 text-emerald-700";
    if (status === "PREPARING") return "border border-amber-200 bg-amber-100 text-amber-700";
    if (status === "DELIVERED") return "border border-slate-200 bg-slate-100 text-slate-700";
    if (status === "CANCELLED") return "border border-rose-200 bg-rose-100 text-rose-700";
    if (status === "ACCEPTED") return "border border-sky-200 bg-sky-100 text-sky-700";
    return "border border-indigo-200 bg-indigo-100 text-indigo-700";
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
            <div
                className={`rounded-2xl p-6 ${
                    isOnlineOrders
                        ? "border border-orange-200 bg-[#fffaf2] text-amber-900"
                        : "border border-white/10 bg-[#111827] text-gray-300"
                }`}
            >
                Loading orders...
            </div>
        );
    }

    return (
        <section className="space-y-5">
            {!isOnlineOrders && (
                <div className="flex items-center gap-6 overflow-x-auto border-b border-orange-200/60 pb-1">
                    {ORDER_TABS.map((tab) => {
                        const isActive = sourceTab === tab.key;
                        const count = tabCounts[tab.key] || 0;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSourceTab(tab.key)}
                                className={`inline-flex shrink-0 items-center gap-2 border-b-2 pb-2 text-sm font-semibold transition ${
                                    isActive
                                        ? "border-orange-500 text-orange-600"
                                        : "border-transparent text-stone-500 hover:text-stone-700"
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.key !== "ALL" && count > 0 && (
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                                            isActive
                                                ? "bg-orange-500 text-white"
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

            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-3xl font-bold">{pageTitle}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        {activeCount} {activeLabel}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-sm text-gray-400">Order Control</p>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-40 rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm outline-none"
                    >
                        <option value="">All statuses</option>
                        {STATUSES.map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                    <Search size={16} className="text-gray-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search order, table, customer, phone..."
                        className="w-full bg-transparent py-1 text-sm outline-none"
                    />
                </label>
                <button
                    type="button"
                    onClick={() => loadOrders({ silent: true })}
                    disabled={refreshing}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-70"
                >
                    {refreshing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    Refresh
                </button>
            </div>

            {error && (
                <div
                    className={`rounded-xl p-3 text-sm ${
                        isOnlineOrders
                            ? "border border-rose-200 bg-rose-50 text-rose-800"
                            : "border border-red-500/30 bg-red-500/10 text-red-300"
                    }`}
                >
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-orange-200/70 bg-[#fffaf2] shadow-[0_12px_30px_rgba(120,53,15,0.08)]">
                <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full border-collapse">
                        <thead className="bg-[#fff3e4]">
                            <tr className="border-b border-orange-200/80 text-[11px] uppercase tracking-[0.18em] text-amber-800">
                                <th className="px-4 py-3 text-left font-semibold">Order ID</th>
                                <th className="px-4 py-3 text-left font-semibold">Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                                <th className="px-4 py-3 text-left font-semibold">Items</th>
                                <th className="px-4 py-3 text-left font-semibold">Amount</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-left font-semibold">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleOrders.map((order) => {
                                const normalizedStatus = String(order.status || "PLACED").toUpperCase();
                                const itemCount = getItemCount(order);
                                return (
                                    <tr
                                        key={order.id}
                                        className="border-b border-orange-100/80 transition hover:bg-orange-50/70 last:border-b-0"
                                    >
                                        <td className="px-4 py-4 align-top">
                                            <button
                                                type="button"
                                                onClick={() => setItemsModalOrder(order)}
                                                className="text-left font-semibold tracking-tight text-amber-950 underline decoration-transparent underline-offset-4 transition hover:decoration-orange-500"
                                            >
                                                {order.orderNo || `#${order.id}`}
                                            </button>
                                            <p className="mt-1 text-[11px] text-amber-800/70">
                                                {order.invoiceNo || "-"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 align-top text-sm text-amber-900">
                                            {formatOrderType(order)}
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <p className="font-medium text-amber-950">
                                                {formatCustomerSummary(order)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <button
                                                type="button"
                                                onClick={() => setItemsModalOrder(order)}
                                                className="font-medium text-amber-900 underline decoration-dotted underline-offset-4 transition hover:text-orange-600"
                                            >
                                                {itemCount} item{itemCount === 1 ? "" : "s"}
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 align-top font-semibold text-amber-950">
                                            {formatMoney(order.total)}
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <span
                                                className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${statusClass(normalizedStatus)}`}
                                            >
                                                {normalizedStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 align-top text-sm text-amber-900">
                                            {formatTimeAgo(order.createdAt)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {visibleOrders.length === 0 && (
                <div
                    className={`rounded-2xl border border-dashed p-8 text-center ${
                        isOnlineOrders
                            ? "border-orange-200 bg-[#fffaf2] text-amber-800"
                            : "border-white/10 bg-[#111827] text-gray-400"
                    }`}
                >
                    {emptyMessage}
                </div>
            )}

            {itemsModalOrder && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setItemsModalOrder(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="theme-panel w-full max-w-xl overflow-hidden rounded-[28px] p-4 text-black sm:p-5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-black">Order Items</p>
                                <h4 className="mt-1 text-lg font-semibold text-black">
                                    {itemsModalOrder.orderNo || `#${itemsModalOrder.id}`}
                                </h4>
                                <p className="mt-1 text-sm text-black">
                        {getOrderFulfillmentLabel(itemsModalOrder)}
                                    {itemsModalOrder.customerName ? ` - ${itemsModalOrder.customerName}` : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setItemsModalOrder(null)}
                                className="rounded-xl border border-gray-300 bg-white p-2 text-black transition hover:bg-gray-100"
                                aria-label="Close items popup"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-4 max-h-[52vh] space-y-0 overflow-y-auto pr-1">
                            {(itemsModalOrder.items || []).length === 0 ? (
                                <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-4 text-sm text-black">
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
                                            className="flex items-start justify-between gap-3 rounded-none border-b border-dashed border-gray-200 py-3 last:border-b-0"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black">
                                                    {qty}x item
                                                </p>
                                                <p className="mt-1 truncate text-sm font-semibold text-black">
                                                    {label}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-sm font-semibold tabular-nums text-black">
                                                {formatMoney(lineTotal)}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-black">
                                <span className="h-2 w-2 rounded-full bg-black" />
                                {(itemsModalOrder.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0)} items
                            </p>
                            <p className="text-sm font-semibold text-black">
                                Total: {formatMoney(itemsModalOrder.total)}
                            </p>
                        </div>

                        {itemsModalOrder.deliveryAddress && (
                            <div className="mt-4 rounded-[24px] bg-white p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-black">Delivery Address</p>
                                <p className="mt-1 whitespace-pre-line text-sm text-black">
                                    {itemsModalOrder.deliveryAddress}
                                </p>
                            </div>
                        )}

                        {!isDineInOrder(itemsModalOrder) && (
                            <div className="mt-4 rounded-[24px] bg-white p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-black">Online Order</p>
                                <p className="mt-1 text-sm text-black">
                                    Online order. Check the customer notes or address above if available.
                                </p>
                            </div>
                        )}

                        <div className="mt-4 inline-flex w-fit flex-col items-start rounded-[24px] bg-white p-4">
                            <p className="text-xs uppercase tracking-[0.22em] text-black">Current State</p>
                            <p
                                className={`mt-2 inline-flex rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-semibold tracking-wide text-black`}
                            >
                                {String(itemsModalOrder.status || "PLACED").toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
