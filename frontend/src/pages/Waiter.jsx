import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import useCachedGet from "../hooks/useCachedGet";
import { showToast } from "../utils/toast";

const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);

const normalizeStatus = (status) => String(status || "PLACED").toUpperCase();

const mergeOrder = (prev, nextOrder) => {
    const list = Array.isArray(prev) ? prev : [];
    const order = nextOrder || null;
    const id = Number(order?.id || 0);
    if (!id) return list;

    const idx = list.findIndex((o) => Number(o?.id || 0) === id);
    if (idx === -1) return [order, ...list];
    const copy = list.slice();
    copy[idx] = order;
    return copy;
};

export default function Waiter() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(user?.restaurantId || 0);

    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState("");
    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    const selectedTableNo = String(searchParams.get("table") || "").trim();

    const { data: tablesData, loading: tablesLoading } = useCachedGet("/tables", {
        enabled: Boolean(restaurantId),
        params: restaurantId ? { restaurantId } : undefined,
        ttlMs: 60_000,
        staleMs: 10 * 60_000,
        scope: `tables:${restaurantId || "none"}`,
    });

    const tables = useMemo(() => {
        const list = Array.isArray(tablesData) ? tablesData : [];
        return list
            .filter((t) => t && t.isActive !== false)
            .map((t) => ({ id: t.id, tableNo: String(t.tableNo || "").trim(), seats: Number(t.seats || 0) }))
            .filter((t) => t.tableNo)
            .sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));
    }, [tablesData]);

    const loadOrders = useCallback(async () => {
        try {
            setOrdersLoading(true);
            setOrdersError("");
            const res = await api.get("/orders/live");
            setOrders(Array.isArray(res?.data?.orders) ? res.data.orders : []);
        } catch (err) {
            setOrdersError(err?.response?.data?.message || "Failed to load orders");
        } finally {
            setOrdersLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (order) => {
            setOrders((prev) => mergeOrder(prev, order));
            const tableNo = String(order?.tableNo || "").trim();
            showToast({
                title: "New order",
                message: tableNo ? `Table ${tableNo}` : "Takeaway",
                variant: "info",
                durationMs: 1800,
            });
        };
        const onUpdated = (order) => setOrders((prev) => mergeOrder(prev, order));

        socket.on("order:created", onCreated);
        socket.on("order:updated", onUpdated);
        return () => {
            socket.off("order:created", onCreated);
            socket.off("order:updated", onUpdated);
        };
    }, [socket]);

    const activeOrders = useMemo(() => {
        return (orders || []).filter((o) => {
            const status = normalizeStatus(o?.status);
            return ACTIVE_STATUSES.has(status);
        });
    }, [orders]);

    const ordersForSelectedTable = useMemo(() => {
        if (!selectedTableNo) return activeOrders;
        return activeOrders.filter((o) => String(o?.tableNo || "").trim() === selectedTableNo);
    }, [activeOrders, selectedTableNo]);

    const activeByTableNo = useMemo(() => {
        const map = new Map();
        for (const o of activeOrders) {
            const key = String(o?.tableNo || "").trim() || "__takeaway__";
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    }, [activeOrders]);

    const setTableFilter = (tableNo) => {
        const value = String(tableNo || "").trim();
        setSearchParams(
            (prev) => {
                if (value) prev.set("table", value);
                else prev.delete("table");
                return prev;
            },
            { replace: true }
        );
    };

    const emitStatus = useCallback(
        (orderId, status) => {
            if (!socket) return;
            const id = Number(orderId || 0);
            if (!id) return;

            setUpdatingOrderId(id);
            socket.emit("order:updateStatus", { orderId: id, status }, (ack) => {
                try {
                    if (ack?.ok && ack.order) {
                        setOrders((prev) => mergeOrder(prev, ack.order));
                        return;
                    }
                    showToast({
                        title: "Update failed",
                        message: String(ack?.message || "Unable to update order"),
                        variant: "error",
                    });
                } finally {
                    setUpdatingOrderId(null);
                }
            });
        },
        [socket]
    );

    return (
        <div className="theme-page min-h-screen">
            <header className="theme-nav border-b px-4 py-4">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold">Waiter Console</h1>
                        <p className="theme-muted text-xs sm:text-sm truncate">
                            {user?.restaurant?.name || "Restaurant"} •{" "}
                            {connected ? "Live" : "Offline"}
                            {socketError ? ` (${socketError})` : ""}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate("/admin/new-order")}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
                        >
                            <Plus size={16} />
                            New Order
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-2xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-3">
                <section className="theme-panel rounded-3xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.24em]">Tables</p>
                            <p className="mt-1 text-lg font-semibold">Quick Select</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTableFilter("")}
                            className="theme-soft-button rounded-2xl px-3 py-2 text-xs font-semibold"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                        {tablesLoading ? (
                            <div className="col-span-full theme-muted text-sm">Loading tables…</div>
                        ) : (
                            tables.map((t) => {
                                const key = t.tableNo;
                                const count = activeByTableNo.get(key) || 0;
                                const active = selectedTableNo === key;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setTableFilter(key)}
                                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                                            active
                                                ? "border-amber-400/40 bg-amber-400/10"
                                                : "border-white/10 bg-black/10 hover:bg-black/20"
                                        }`}
                                    >
                                        <p className="text-sm font-semibold">{key}</p>
                                        <p className="theme-muted mt-0.5 text-xs">
                                            {count ? `${count} active` : "Free"}
                                        </p>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3">
                        <p className="theme-muted text-xs uppercase tracking-[0.24em]">Takeaway</p>
                        <p className="mt-1 text-sm">
                            Active: <span className="font-semibold">{activeByTableNo.get("__takeaway__") || 0}</span>
                        </p>
                    </div>
                </section>

                <section className="theme-panel rounded-3xl border border-white/10 bg-black/10 p-4 lg:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.24em]">Orders</p>
                            <p className="mt-1 text-lg font-semibold">Active Tickets</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadOrders}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold"
                            disabled={ordersLoading}
                        >
                            {ordersLoading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Refresh
                        </button>
                    </div>

                    {ordersError && (
                        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                            {ordersError}
                        </div>
                    )}

                    <div className="mt-4 space-y-3">
                        {ordersLoading && ordersForSelectedTable.length === 0 ? (
                            <div className="theme-muted text-sm">Loading orders…</div>
                        ) : ordersForSelectedTable.length === 0 ? (
                            <div className="theme-muted text-sm">No active orders.</div>
                        ) : (
                            ordersForSelectedTable.map((order) => {
                                const status = normalizeStatus(order?.status);
                                const tableNo = String(order?.tableNo || "").trim();
                                const canServe = status === "READY";
                                const canAccept = status === "PLACED";

                                return (
                                    <article
                                        key={order.id}
                                        className="rounded-3xl border border-white/10 bg-black/15 p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {order.orderNo || `Order #${order.id}`}
                                                </p>
                                                <p className="theme-muted mt-0.5 text-xs">
                                                    {tableNo ? `Table ${tableNo}` : "Takeaway"} • {status}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {canAccept && (
                                                    <button
                                                        type="button"
                                                        onClick={() => emitStatus(order.id, "ACCEPTED")}
                                                        className="theme-button rounded-2xl px-4 py-2 text-xs font-semibold"
                                                        disabled={!connected || updatingOrderId === order.id}
                                                    >
                                                        Accept
                                                    </button>
                                                )}
                                                {canServe && (
                                                    <button
                                                        type="button"
                                                        onClick={() => emitStatus(order.id, "DELIVERED")}
                                                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                                                        disabled={!connected || updatingOrderId === order.id}
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Served
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="theme-muted mt-3 text-xs">
                                            {(order.items || [])
                                                .map((item) => `${item.itemName} x${item.qty}`)
                                                .slice(0, 6)
                                                .join(", ")}
                                            {(order.items || []).length > 6 ? "…" : ""}
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

