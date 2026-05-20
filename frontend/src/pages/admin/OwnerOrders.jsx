import { useEffect, useState } from "react";
import axios from "axios";
import { Clock3, LoaderCircle, RefreshCcw, Search, ShoppingBag } from "lucide-react";
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
    if (status === "READY") return "bg-emerald-500/20 text-emerald-300";
    if (status === "PREPARING") return "bg-amber-500/20 text-amber-300";
    if (status === "DELIVERED") return "bg-slate-500/30 text-slate-300";
    if (status === "CANCELLED") return "bg-red-500/20 text-red-300";
    return "bg-blue-500/20 text-blue-300";
};

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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-sm text-gray-400">Order Control</p>
                    <h3 className="text-3xl font-bold">Live Orders</h3>
                    <p className="mt-1 text-sm text-gray-400">{activeCount} active orders</p>
                </div>
                <button
                    type="button"
                    onClick={() => loadOrders({ silent: true })}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-70"
                >
                    {refreshing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    Refresh
                </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                    <Search size={16} className="text-gray-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search order, table, customer, phone..."
                        className="w-full bg-transparent py-1 text-sm outline-none"
                    />
                </label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm outline-none"
                >
                    <option value="">All statuses</option>
                    {STATUSES.map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {orders.map((order) => {
                    const normalizedStatus = String(order.status || "PLACED").toUpperCase();
                    return (
                        <article key={order.id} className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="text-lg font-semibold">{order.orderNo || `#${order.id}`}</p>
                                    <p className="mt-1 text-sm text-gray-400">
                                        Table {order.tableNo || "--"} {order.customerName ? `• ${order.customerName}` : ""}
                                    </p>
                                </div>
                                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(normalizedStatus)}`}>
                                    {normalizedStatus}
                                </span>
                            </div>

                            <div className="mt-4 grid gap-3 text-sm text-gray-300 md:grid-cols-3">
                                <p className="flex items-center gap-2">
                                    <ShoppingBag size={16} />
                                    {formatMoney(order.total)}
                                </p>
                                <p className="flex items-center gap-2 text-gray-400">
                                    <Clock3 size={16} />
                                    {formatTimeAgo(order.createdAt)}
                                </p>
                                <p className="text-gray-400">
                                    {(order.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0)} items
                                </p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {STATUSES.map((nextStatus) => (
                                    <button
                                        key={nextStatus}
                                        type="button"
                                        onClick={() => updateStatus(order, nextStatus)}
                                        disabled={updatingId === order.id || normalizedStatus === nextStatus}
                                        className="rounded-lg border border-white/10 bg-[#0f172a] px-3 py-1 text-xs text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {nextStatus}
                                    </button>
                                ))}
                            </div>
                        </article>
                    );
                })}
            </div>

            {orders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827] p-8 text-center text-gray-400">
                    No orders found.
                </div>
            )}
        </section>
    );
}
