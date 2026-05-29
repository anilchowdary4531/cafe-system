import { useEffect, useState } from "react";
import axios from "axios";
import { Clock3, LoaderCircle, RefreshCcw, Search, ShoppingBag, X } from "lucide-react";
import { API } from "../../config";

const STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"];
const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);

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

export default function OwnerOrders() {
    const [orders, setOrders] = useState([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [error, setError] = useState("");
    const [itemsModalOrder, setItemsModalOrder] = useState(null);

    const [user] = useState(readStoredUser);

    const restaurantId = Number(user?.restaurantId);

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
    }, [restaurantId, status]);

    useEffect(() => {
        const timer = setTimeout(() => loadOrders({ silent: true }), 300);
        return () => clearTimeout(timer);
    }, [query]);

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
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Failed to update order.");
        } finally {
            setUpdatingId(null);
        }
    };

    const sortedOrders = sortOrdersForDisplay(orders);
    const activeCount = orders.filter((order) => ACTIVE_STATUSES.has(String(order.status || "").toUpperCase())).length;

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 text-gray-300">
                Loading orders...
            </div>
        );
    }

    return (
        <section className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-3xl font-bold">Live Orders</h3>
                    <p className="mt-1 text-sm text-gray-400">{activeCount} active orders</p>
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
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {sortedOrders.map((order) => {
                    const normalizedStatus = String(order.status || "PLACED").toUpperCase();
                    return (
                        <article
                            key={order.id}
                            className="group relative overflow-hidden rounded-2xl border border-orange-200/70 bg-[linear-gradient(145deg,#fff7ed_0%,#fffbeb_62%,#fef3c7_100%)] p-4 shadow-[0_8px_22px_rgba(120,53,15,0.12)] transition-all hover:border-orange-300 hover:shadow-[0_12px_28px_rgba(120,53,15,0.2)]"
                        >
                            <span
                                className={`absolute right-4 top-4 z-10 w-fit rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${statusClass(normalizedStatus)}`}
                            >
                                {normalizedStatus}
                            </span>

                            <div className="pr-24">
                                <div>
                                    <p className="text-[15px] font-semibold tracking-tight text-amber-950 sm:text-base">
                                        {order.orderNo || `#${order.id}`}
                                    </p>
                                    <p className="mt-1 text-sm text-amber-800/70">
                                        Table {order.tableNo || "--"} {order.customerName ? ` - ${order.customerName}` : ""}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 sm:text-sm">
                                <p className="flex min-w-0 items-center gap-2 rounded-lg border border-orange-200/70 bg-white/70 px-2.5 py-2 text-amber-900 sm:px-3">
                                    <ShoppingBag size={16} />
                                    {formatMoney(order.total)}
                                </p>
                                <p className="flex min-w-0 items-center gap-2 rounded-lg border border-orange-200/70 bg-white/70 px-2.5 py-2 text-amber-800 sm:px-3">
                                    <Clock3 size={16} />
                                    {formatTimeAgo(order.createdAt)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setItemsModalOrder(order)}
                                    className="rounded-lg border border-orange-200/70 bg-white/70 px-2.5 py-2 text-left text-amber-800 transition hover:border-orange-300 hover:bg-orange-100 sm:px-3"
                                >
                                    {(order.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)} items
                                </button>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {STATUSES.map((nextStatus) => (
                                    <button
                                        key={nextStatus}
                                        type="button"
                                        onClick={() => updateStatus(order, nextStatus)}
                                        disabled={updatingId === order.id || normalizedStatus === nextStatus}
                                        className={`rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            normalizedStatus === nextStatus
                                                ? "border-orange-300 bg-orange-200 text-orange-900"
                                                : "border-orange-200 bg-white/75 text-amber-900 hover:border-orange-300 hover:bg-orange-100"
                                        }`}
                                    >
                                        {nextStatus}
                                    </button>
                                ))}
                            </div>
                        </article>
                    );
                })}
            </div>

            {sortedOrders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827] p-8 text-center text-gray-400">
                    No orders found.
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
                        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d1324] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:p-5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Order Items</p>
                                <h4 className="mt-1 text-lg font-semibold text-white">
                                    {itemsModalOrder.orderNo || `#${itemsModalOrder.id}`}
                                </h4>
                                <p className="mt-1 text-sm text-gray-400">
                                    Table {itemsModalOrder.tableNo || "--"}{" "}
                                    {itemsModalOrder.customerName ? `- ${itemsModalOrder.customerName}` : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setItemsModalOrder(null)}
                                className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
                                aria-label="Close items popup"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                            {(itemsModalOrder.items || []).length === 0 ? (
                                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-gray-400">
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
                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-medium text-white/95">
                                                    {qty}x {label}
                                                </p>
                                                <p className="text-sm font-semibold text-cyan-100">{formatMoney(lineTotal)}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                            <p className="text-sm text-gray-400">
                                {(itemsModalOrder.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0)} items
                            </p>
                            <p className="text-sm font-semibold text-white">Total: {formatMoney(itemsModalOrder.total)}</p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
