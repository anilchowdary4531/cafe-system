import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { api } from "../../utils/apiClient";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { showToast } from "../../utils/toast";

const STATUS_COLUMNS = ["PLACED", "PREPARING", "READY", "DELIVERED"];

const formatCurrency = (value) => {
    const number = Number(value || 0);
    if (Number.isNaN(number)) return "0";
    return number.toFixed(2);
};

const getMinutesSince = (isoDate) => {
    if (!isoDate) return null;
    const t = new Date(isoDate).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
};

const normalizeStatus = (status) => {
    const raw = String(status || "PLACED").toUpperCase();
    const value = raw === "ACCEPTED" ? "PLACED" : raw;
    return STATUS_COLUMNS.includes(value) ? value : "PLACED";
};

const statusPillClass = (status) => {
    switch (status) {
        case "READY":
            return "bg-emerald-500/20 text-emerald-300";
        case "PREPARING":
            return "bg-amber-500/20 text-amber-300";
        case "DELIVERED":
            return "bg-slate-500/30 text-slate-300";
        default:
            return "bg-blue-500/20 text-blue-300";
    }
};

const nextActionByStatus = (status) => {
    if (status === "PLACED") return { label: "Start Preparing", nextStatus: "PREPARING" };
    if (status === "PREPARING") return { label: "Mark Ready", nextStatus: "READY" };
    if (status === "READY") return { label: "Mark Delivered", nextStatus: "DELIVERED" };
    return null;
};

export default function OwnerKitchenLive() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    const { socket, connected } = useStaffSocket();

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    }, []);

    const loadOrders = async ({ silent = false } = {}) => {
        try {
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const res = await api.get("/orders/live");
            const list = Array.isArray(res?.data?.orders) ? res.data.orders : [];
            setOrders(list);
            setError("");
            setLastSyncAt(new Date());
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || "Unable to load kitchen orders.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((o) => Number(o?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                const copy = list.slice();
                copy[idx] = order;
                return copy;
            });
            setLastSyncAt(new Date());
            const tableNo = String(order?.tableNo || "").trim();
            showToast({
                title: "New order",
                message: tableNo ? `Table ${tableNo}` : "Takeaway",
                variant: "info",
                durationMs: 1800,
            });
        };

        const onUpdated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((o) => Number(o?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                const copy = list.slice();
                copy[idx] = order;
                return copy;
            });
            setLastSyncAt(new Date());
        };

        socket.on("order:created", onCreated);
        socket.on("order:updated", onUpdated);
        return () => {
            socket.off("order:created", onCreated);
            socket.off("order:updated", onUpdated);
        };
    }, [socket]);

    const filteredOrders = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter((order) => {
            const orderNo = String(order.orderNo || "").toLowerCase();
            const tableNo = String(order.tableNo || "").toLowerCase();
            const customer = String(order.customerName || "").toLowerCase();
            return (
                orderNo.includes(q) ||
                tableNo.includes(q) ||
                customer.includes(q)
            );
        });
    }, [orders, query]);

    const groupedOrders = useMemo(() => {
        const grouped = {
            PLACED: [],
            PREPARING: [],
            READY: [],
            DELIVERED: [],
        };

        filteredOrders.forEach((order) => {
            const status = normalizeStatus(order.status);
            grouped[status].push(order);
        });

        return grouped;
    }, [filteredOrders]);

    const counts = useMemo(
        () =>
            STATUS_COLUMNS.reduce(
                (acc, key) => ({ ...acc, [key]: groupedOrders[key].length }),
                {}
            ),
        [groupedOrders]
    );

    const updateOrderStatus = async (order, status) => {
        const orderId = Number(order?.id || 0);
        if (!socket || !connected || !orderId || !status) return;

        setUpdatingOrderId(orderId);
        socket.emit("order:updateStatus", { orderId, status }, (ack) => {
            try {
                if (ack?.ok && ack.order) {
                    setOrders((prev) => {
                        const list = Array.isArray(prev) ? prev : [];
                        const idx = list.findIndex((o) => Number(o?.id || 0) === orderId);
                        if (idx === -1) return [ack.order, ...list];
                        const copy = list.slice();
                        copy[idx] = ack.order;
                        return copy;
                    });
                    setError("");
                    setLastSyncAt(new Date());
                    return;
                }
                setError(String(ack?.message || "Failed to update order status."));
            } finally {
                setUpdatingOrderId(null);
            }
        });
    };

    return (
        <section>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm text-gray-400">Kitchen Control</p>
                    <h3 className="text-3xl font-bold">Kitchen Live</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        Real-time updates via WebSockets.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => loadOrders({ silent: true })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black disabled:opacity-70"
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                        <RefreshCw size={16} />
                    )}
                    Refresh now
                </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {STATUS_COLUMNS.map((status) => (
                    <article
                        key={status}
                        className="rounded-2xl border border-white/10 bg-[#111827] p-4"
                    >
                        <p className="text-xs text-gray-400">{status}</p>
                        <p className="mt-1 text-3xl font-bold">{counts[status] || 0}</p>
                    </article>
                ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by order no, table, or customer..."
                    className="w-full bg-transparent py-1 text-sm outline-none"
                />
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <div className="mt-6 grid gap-4 xl:grid-cols-4">
                {STATUS_COLUMNS.map((status) => (
                    <div
                        key={status}
                        className="rounded-2xl border border-white/10 bg-[#111827] p-4"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-200">{status}</h4>
                            <span className="text-xs text-gray-400">{counts[status] || 0}</span>
                        </div>

                        <div className="space-y-3">
                            {groupedOrders[status].map((order) => {
                                const prepMins = getMinutesSince(order.createdAt);
                                const action = nextActionByStatus(normalizeStatus(order.status));

                                return (
                                    <article
                                        key={order.id}
                                        className="rounded-xl border border-white/10 bg-[#0f172a] p-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {order.orderNo || `Order #${order.id}`}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    Table {order.tableNo || "-"}
                                                    {order.customerName ? ` • ${order.customerName}` : ""}
                                                </p>
                                            </div>
                                            <span
                                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusPillClass(
                                                    normalizeStatus(order.status)
                                                )}`}
                                            >
                                                {normalizeStatus(order.status)}
                                            </span>
                                        </div>

                                        <div className="mt-3 space-y-1">
                                            {(order.items || []).map((item) => (
                                                <div
                                                    key={`${order.id}-${item.id || item.itemName}`}
                                                    className="flex items-center justify-between text-xs"
                                                >
                                                    <span className="text-gray-200">
                                                        {item.qty}x {item.itemName}
                                                    </span>
                                                    <span className="text-gray-400">
                                                        {formatCurrency(item.total)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-xs text-gray-300">
                                            <span>Total: {formatCurrency(order.total)}</span>
                                            <span className="inline-flex items-center gap-1 text-gray-400">
                                                <Clock3 size={13} />
                                                {prepMins === null ? "--" : `${prepMins} min`}
                                            </span>
                                        </div>

                                        {action && (
                                            <button
                                                type="button"
                                                onClick={() => updateOrderStatus(order, action.nextStatus)}
                                                disabled={updatingOrderId === order.id}
                                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-300 disabled:opacity-60"
                                            >
                                                {updatingOrderId === order.id ? (
                                                    <LoaderCircle size={14} className="animate-spin" />
                                                ) : (
                                                    <CheckCircle2 size={14} />
                                                )}
                                                {action.label}
                                            </button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>

                        {!loading && groupedOrders[status].length === 0 && (
                            <div className="rounded-xl border border-dashed border-white/10 bg-[#0f172a] p-3 text-xs text-gray-400">
                                No orders in {status.toLowerCase()} queue.
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {loading && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] p-5 text-gray-300">
                    Loading kitchen queue...
                </div>
            )}

            {lastSyncAt && (
                <p className="mt-4 text-xs text-gray-500">
                    Last synced at {lastSyncAt.toLocaleTimeString()}.
                </p>
            )}
        </section>
    );
}
