import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    ChefHat,
    LoaderCircle,
    Minus,
    Plus,
    RefreshCw,
    Search,
    Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import useCachedGet from "../hooks/useCachedGet";
import { api } from "../utils/apiClient";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import { showToast } from "../utils/toast";

const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
const TABLE_STAFF_ASSIGNMENTS_PREFIX = "owner_table_staff_assignments_v1";

const getTableStaffStorageKey = (restaurantId) =>
    `${TABLE_STAFF_ASSIGNMENTS_PREFIX}_${restaurantId}`;

const readTableStaffAssignments = (restaurantId) => {
    if (typeof window === "undefined" || !restaurantId) return {};

    try {
        const raw = window.localStorage.getItem(getTableStaffStorageKey(restaurantId));
        if (!raw) return {};

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

        return Object.entries(parsed).reduce((acc, [tableKey, staffId]) => {
            if (!tableKey) return acc;
            acc[String(tableKey)] = String(staffId || "");
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const writeTableStaffAssignments = (restaurantId, assignments) => {
    if (typeof window === "undefined" || !restaurantId) return;

    try {
        window.localStorage.setItem(
            getTableStaffStorageKey(restaurantId),
            JSON.stringify(assignments || {})
        );
    } catch {
        // Ignore localStorage write failures.
    }
};

const formatMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "₹0.00";
    return `₹${amount.toFixed(2)}`;
};

const normalizeStatus = (status) => {
    const raw = String(status || "PLACED").trim().toUpperCase();
    return raw === "SERVED" ? "DELIVERED" : raw;
};

const getMinutesSince = (isoDate) => {
    if (!isoDate) return null;
    const time = new Date(isoDate).getTime();
    if (Number.isNaN(time)) return null;
    return Math.max(0, Math.floor((Date.now() - time) / 60000));
};

const categoryIconFor = (category) => {
    const value = String(category || "").toLowerCase();
    if (value.includes("coffee") || value.includes("latte") || value.includes("espresso") || value.includes("cappuccino")) {
        return "☕";
    }
    if (value.includes("pizza")) return "🍕";
    if (value.includes("burger") || value.includes("sandwich") || value.includes("wrap")) return "🥪";
    if (value.includes("salad")) return "🥗";
    if (value.includes("soup")) return "🥣";
    if (value.includes("dessert") || value.includes("sweet") || value.includes("ice")) return "🍨";
    return "•";
};

const mergeQty = (prev, menuItem, delta, defaultChefName = "") => {
    const next = { ...(prev || {}) };
    const id = Number(menuItem?.id || 0);
    if (!id) return next;

    const existing = next[id] || null;
    const qty = Math.max(0, Number(existing?.qty || 0) + Number(delta || 0));

    if (qty <= 0) {
        delete next[id];
        return next;
    }

    next[id] = {
        id,
        menuItemId: id,
        name: String(menuItem?.name || "").trim(),
        category: String(menuItem?.category || "").trim() || "General",
        price: Number(menuItem?.price || 0),
        qty,
        chefName: String(existing?.chefName || menuItem?.chefName || defaultChefName || "").trim(),
        image: String(menuItem?.image || "").trim(),
    };
    return next;
};

const formatOrderTypeLabel = (order) => {
    const source = String(order?.orderSource || "").trim().toUpperCase();
    const tableNo = String(order?.tableNo || "").trim();
    const fulfillment = String(order?.fulfillment || "").trim().toUpperCase();

    if (fulfillment === "PICKUP") return "Pickup";
    if (fulfillment === "DELIVERY") return "Delivery";
    if (fulfillment === "DINEIN" || tableNo) return "Dine In";
    if (source === "ONLINE") return "Online";
    if (source === "POS") return "Pickup";
    return "Order";
};

function MenuCard({ item, qty, disabled, onAdd }) {
    const imageSrc = resolveImageUrl(item.image) || FALLBACK_IMAGE;
    const icon = categoryIconFor(item.category);

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onAdd(item)}
            className="group relative w-full max-w-[220px] overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-left transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-[200px] sm:max-w-[200px] sm:flex-none"
        >
            <img
                src={imageSrc}
                alt={item.name}
                loading="lazy"
                className="mb-2 h-24 w-full rounded-2xl object-cover transition duration-300 group-hover:scale-[1.02] sm:h-28"
                onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                }}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold sm:text-base">{item.name}</p>
                    <p className="theme-muted mt-1 truncate text-xs">
                        <span className="mr-1">{icon}</span>
                        {item.category || "General"} - {formatMoney(item.price)}
                    </p>
                </div>
                {qty > 0 ? (
                    <span className="theme-pos-qty-badge inline-flex h-8 min-w-8 items-center justify-center rounded-2xl px-2 text-sm font-bold tabular-nums">
                        {qty}
                    </span>
                ) : null}
            </div>
        </button>
    );
}

function CartRow({ item, chefOptions, onAdd, onSub, onRemove, onSetChef }) {
    const qty = Math.max(0, Number(item?.qty || 0));

    return (
        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_58%,transparent)] px-3 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight">{item?.name || "Item"}</p>
                            <p className="theme-muted mt-0.5 text-[11px]">
                                {item?.category || "General"} - {formatMoney(item?.price)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemove?.(item)}
                            className="theme-soft-button inline-flex h-7 w-7 items-center justify-center rounded-full"
                            aria-label={`Remove ${item?.name || "item"}`}
                            title="Remove item"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>

                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <label className="block min-w-0 w-full sm:w-[220px]">
                            <span className="theme-muted mb-1 block text-[9px] uppercase tracking-[0.16em]">
                                Chef
                            </span>
                            <select
                                value={item?.chefName || ""}
                                onChange={(event) => onSetChef?.(item, event.target.value)}
                                className="theme-input w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                            >
                                <option value="">Unassigned</option>
                                {chefOptions.map((chef) => (
                                    <option key={chef.key} value={chef.value}>
                                        {chef.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="min-w-0 w-full rounded-lg border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2)_70%,transparent)] px-2 py-1.5 sm:w-[220px]">
                            <p className="theme-muted text-[9px] uppercase tracking-[0.16em]">Assigned</p>
                            <p className="mt-0.5 truncate text-xs font-semibold">
                                {String(item?.chefName || "").trim() || "Unassigned"}
                            </p>
                        </div>
                    </div>
                </div>

                    <div className="flex flex-col items-end gap-2 sm:items-end">
                    <div className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2)_70%,transparent)] p-0.5">
                        <button
                            type="button"
                            onClick={() => onSub?.(item)}
                            className="theme-soft-button rounded-lg px-2.5 py-1 text-sm font-bold leading-none"
                            aria-label={`Decrease quantity of ${item?.name || "item"}`}
                        >
                            <Minus size={13} />
                        </button>
                        <span className="min-w-10 px-2 text-center text-sm font-bold tabular-nums">{qty}</span>
                        <button
                            type="button"
                            onClick={() => onAdd?.(item)}
                            className="theme-button rounded-lg px-2.5 py-1 text-sm font-bold leading-none"
                            aria-label={`Increase quantity of ${item?.name || "item"}`}
                        >
                            <Plus size={13} />
                        </button>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
                        {formatMoney(Number(item?.price || 0) * qty)}
                    </p>
                </div>
            </div>
        </div>
    );
}

function LiveOrderCard({ order }) {
    const tableNo = String(order?.tableNo || "").trim();
    const status = normalizeStatus(order?.status);
    const prepMins = getMinutesSince(order?.createdAt);

    return (
        <article className="px-1 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold">{order.orderNo || `Order #${order.id}`}</p>
                    <p className="theme-muted mt-0.5 text-xs">
                        {formatOrderTypeLabel(order)}
                        {tableNo ? ` • Table ${tableNo}` : ""}
                    </p>
                </div>
                <span className="theme-pill rounded-full px-2 py-1 text-[10px] font-semibold">{status}</span>
            </div>

            <div className="mt-3 space-y-1">
                {(order.items || []).map((item) => (
                    <div
                        key={`${order.id}-${item.id || item.itemName}`}
                        className="flex items-start justify-between gap-3 py-1 text-xs"
                    >
                        <div className="min-w-0">
                            <p className="truncate font-medium">
                                {item.qty}x {item.itemName}
                            </p>
                            <p className="theme-muted mt-0.5">
                                Chef: {String(item.preparedByName || "").trim() || "Unassigned"}
                            </p>
                        </div>
                        <span className="theme-muted-strong whitespace-nowrap font-semibold">
                            {formatMoney(item.total)}
                        </span>
                    </div>
                ))}
            </div>

            <div className="theme-muted-strong mt-3 flex items-center justify-between border-t border-dashed border-[color:var(--app-border)] pt-2 text-xs">
                <span>Total: {formatMoney(order.total)}</span>
                <span className="theme-muted inline-flex items-center gap-1">
                    <ChefHat size={13} />
                    {prepMins === null ? "--" : `${prepMins} min`}
                </span>
            </div>
        </article>
    );
}

export default function Server() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(user?.restaurantId || 0);
    const restaurantName = String(user?.restaurant?.name || "Restaurant").trim() || "Restaurant";

    const [cart, setCart] = useState({});
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("ALL");
    const [notes, setNotes] = useState("");
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [refreshingOrders, setRefreshingOrders] = useState(false);
    const [ordersError, setOrdersError] = useState("");
    const [placing, setPlacing] = useState(false);
    const [settlingBill, setSettlingBill] = useState(false);
    const [sendMode, setSendMode] = useState("NORMAL");
    const [billPaymentMethod, setBillPaymentMethod] = useState("CASH");
    const [showBillPanel, setShowBillPanel] = useState(false);
    const [tableAssignments, setTableAssignments] = useState({});

    const selectedTableNo = String(searchParams.get("table") || "").trim();

    const {
        data: tablesData,
        loading: tablesLoading,
        error: tablesError,
        refresh: refreshTables,
    } = useCachedGet(restaurantId ? `/owner/${restaurantId}/tables` : "/owner/_/tables", {
        enabled: Boolean(restaurantId),
        ttlMs: 30_000,
        staleMs: 5 * 60_000,
        scope: `server-tables:${restaurantId || "none"}`,
    });

    const {
        data: menuData,
        loading: menuLoading,
        error: menuError,
        refresh: refreshMenu,
    } = useCachedGet(restaurantId ? `/owner/${restaurantId}/menu` : "/owner/_/menu", {
        enabled: Boolean(restaurantId),
        ttlMs: 30_000,
        staleMs: 5 * 60_000,
        scope: `server-menu:${restaurantId || "none"}`,
    });

    const { data: staffData, refresh: refreshStaff } = useCachedGet(
        restaurantId ? `/owner/${restaurantId}/staff` : "/owner/_/staff",
        {
        enabled: Boolean(restaurantId),
        ttlMs: 30_000,
        staleMs: 5 * 60_000,
        scope: `server-staff:${restaurantId || "none"}`,
        }
    );

    const syncTableAssignments = useCallback(() => {
        setTableAssignments(readTableStaffAssignments(restaurantId));
    }, [restaurantId]);

    const clearTableAssignment = useCallback(
        (tableKey) => {
            const key = String(tableKey || "").trim();
            if (!restaurantId || !key) return;

            const nextAssignments = readTableStaffAssignments(restaurantId);
            if (!nextAssignments[key]) return;

            delete nextAssignments[key];
            writeTableStaffAssignments(restaurantId, nextAssignments);
            setTableAssignments(nextAssignments);
        },
        [restaurantId]
    );

    useEffect(() => {
        syncTableAssignments();
    }, [syncTableAssignments]);

    useEffect(() => {
        if (!restaurantId) return;
        refreshTables({ force: true }).catch(() => {
            // Ignore refresh errors here; the UI can still use cached data temporarily.
        });
    }, [refreshTables, restaurantId]);

    useEffect(() => {
        if (!restaurantId || typeof window === "undefined") return;

        const list = Array.isArray(tablesData) ? tablesData : [];
        if (!list.length) return;

        const currentAssignments = readTableStaffAssignments(restaurantId);
        let changed = false;

        list.forEach((table) => {
            const tableNo = String(table?.tableNo || "").trim();
            const assignmentKey = table?.id ? `table-${table.id}` : `table-${tableNo.toLowerCase()}`;
            if (!assignmentKey) return;
            if (table?.isOccupied) return;
            if (!currentAssignments[assignmentKey]) return;
            delete currentAssignments[assignmentKey];
            changed = true;
        });

        if (changed) {
            writeTableStaffAssignments(restaurantId, currentAssignments);
            setTableAssignments(currentAssignments);
        }
    }, [restaurantId, tablesData]);

    useEffect(() => {
        if (typeof window === "undefined" || !restaurantId) return undefined;

        const handleStorage = (event) => {
            if (event.key === getTableStaffStorageKey(restaurantId)) {
                syncTableAssignments();
                refreshTables({ force: true }).catch(() => {
                    // Ignore refresh errors here; the next manual refresh can recover.
                });
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [refreshTables, restaurantId, syncTableAssignments]);

    const allTables = useMemo(() => {
        const list = Array.isArray(tablesData) ? tablesData : [];
        return list
            .filter((table) => table && table.isActive !== false)
            .map((table) => {
                const tableNo = String(table.tableNo || "").trim();
                const assignmentKey = table.id
                    ? `table-${table.id}`
                    : `table-${tableNo.toLowerCase()}`;
                const assignedStaffId = String(tableAssignments[assignmentKey] || "").trim();

                return {
                    id: table.id,
                    assignmentKey,
                    tableNo,
                    seats: Number(table.seats || 0),
                    isOccupied: Boolean(table.isOccupied),
                    activeOrderCount: Number(table.activeOrderCount || 0),
                    activeOrders: Array.isArray(table.activeOrders) ? table.activeOrders : [],
                    assignedStaffId,
                };
            })
            .filter((table) => table.tableNo)
            .sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));
    }, [tableAssignments, tablesData]);

    const selectedTable = useMemo(
        () => allTables.find((table) => table.tableNo === selectedTableNo) || null,
        [allTables, selectedTableNo]
    );

    const chefs = useMemo(() => {
        const list = Array.isArray(staffData?.users) ? staffData.users : [];
        return list
            .filter((staff) => String(staff?.role || "").toUpperCase() === "CHEF" && staff?.isActive !== false)
            .map((staff) => ({
                key: staff.id,
                value: String(staff?.name || "").trim(),
                label: `${String(staff?.name || "").trim()}${String(staff?.designation || "").trim() ? ` • ${String(staff.designation).trim()}` : ""}`,
            }))
            .filter((chef) => chef.value)
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    }, [staffData]);

    const defaultChefName = chefs[0]?.value || "";

    const menu = useMemo(() => {
        const list = Array.isArray(menuData) ? menuData : Array.isArray(menuData?.menu) ? menuData.menu : [];
        return list
            .filter((item) => item && item.isAvailable !== false)
            .map((item) => ({
                id: Number(item.id),
                name: String(item.name || "").trim(),
                category: String(item.category || "").trim() || "General",
                price: Number(item.price || 0),
                image: item.image || "",
            }))
            .filter((item) => item.id)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }, [menuData]);

    const categories = useMemo(() => {
        const counts = new Map();
        for (const item of menu) {
            const key = String(item.category || "").trim() || "General";
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        const list = [...counts.entries()]
            .map(([label, count]) => ({
                key: label.toUpperCase(),
                label,
                count,
                icon: categoryIconFor(label),
            }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

        return [{ key: "ALL", label: "All Items", count: menu.length, icon: "•" }, ...list];
    }, [menu]);

    const filteredMenu = useMemo(() => {
        const q = query.trim().toLowerCase();
        const activeKey = String(activeCategory || "ALL").toUpperCase();
        return menu.filter((item) => {
            if (activeKey !== "ALL" && String(item.category || "").trim().toUpperCase() !== activeKey) {
                return false;
            }
            if (!q) return true;
            return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
        });
    }, [activeCategory, menu, query]);

    const cartItems = useMemo(() => Object.values(cart || {}), [cart]);

    const subtotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.qty || 1)), 0),
        [cartItems]
    );

    const totalItems = useMemo(
        () => cartItems.reduce((sum, item) => sum + Math.max(1, Number(item.qty || 1)), 0),
        [cartItems]
    );

    const selectedTableOrders = useMemo(() => {
        if (!selectedTableNo) return [];
        return orders.filter((order) => {
            if (!ACTIVE_STATUSES.has(normalizeStatus(order?.status))) return false;
            return String(order?.tableNo || "").trim() === selectedTableNo;
        });
    }, [orders, selectedTableNo]);

    const selectedTableBillTotal = useMemo(
        () => selectedTableOrders.reduce((sum, order) => sum + Number(order?.total || 0), 0),
        [selectedTableOrders]
    );

    const billPanelVisible = Boolean(selectedTableNo) && showBillPanel;

    const setTable = useCallback(
        (tableNo) => {
            const value = String(tableNo || "").trim();
            setSearchParams(
                (prev) => {
                    if (value) prev.set("table", value);
                    else prev.delete("table");
                    return prev;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const addItem = useCallback(
        (item) => {
            if (!selectedTableNo) {
                showToast({
                    title: "Pick a table",
                    message: "Select a table first before adding items.",
                    variant: "error",
                });
                return;
            }

            setCart((prev) => mergeQty(prev, item, +1, defaultChefName));
        },
        [defaultChefName, selectedTableNo]
    );

    const subItem = useCallback((item) => {
        setCart((prev) => mergeQty(prev, item, -1));
    }, []);

    const removeItem = useCallback((item) => {
        setCart((prev) => {
            const id = Number(item?.id || 0);
            if (!id) return prev || {};
            const next = { ...(prev || {}) };
            delete next[id];
            return next;
        });
    }, []);

    const setItemChef = useCallback((item, chefName) => {
        setCart((prev) => {
            const id = Number(item?.id || 0);
            if (!id) return prev || {};
            const next = { ...(prev || {}) };
            if (!next[id]) return next;
            next[id] = {
                ...next[id],
                chefName: String(chefName || "").trim(),
            };
            return next;
        });
    }, []);

    const clearDraft = useCallback(() => {
        setCart({});
        setNotes("");
    }, []);

    const loadOrders = useCallback(
        async ({ silent = false } = {}) => {
            if (!restaurantId) {
                setOrdersLoading(false);
                setOrdersError("Restaurant not linked to current user.");
                return;
            }

            try {
                if (silent) {
                    setRefreshingOrders(true);
                } else {
                    setOrdersLoading(true);
                }

                const res = await api.get("/orders/live");
                setOrders(Array.isArray(res?.data?.orders) ? res.data.orders : []);
                setOrdersError("");
            } catch (err) {
                console.log(err);
                setOrdersError(err?.response?.data?.message || "Failed to load live orders.");
            } finally {
                setOrdersLoading(false);
                setRefreshingOrders(false);
            }
        },
        [restaurantId]
    );

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        if (!selectedTableNo) {
            setShowBillPanel(false);
            return;
        }
        setCart({});
        setNotes("");
        setBillPaymentMethod("CASH");
        setShowBillPanel(false);
    }, [selectedTableNo]);

    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((row) => Number(row?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                const copy = list.slice();
                copy[idx] = order;
                return copy;
            });
        };

        const onUpdated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((row) => Number(row?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                const copy = list.slice();
                copy[idx] = order;
                return copy;
            });
        };

        socket.on("order:created", onCreated);
        socket.on("order:updated", onUpdated);
        return () => {
            socket.off("order:created", onCreated);
            socket.off("order:updated", onUpdated);
        };
    }, [socket]);

    const refreshAll = useCallback(async () => {
        syncTableAssignments();
        await Promise.all([
            refreshTables({ force: true }),
            refreshMenu({ force: true }),
            refreshStaff({ force: true }),
            loadOrders({ silent: true }),
        ]);
    }, [loadOrders, refreshMenu, refreshStaff, refreshTables, syncTableAssignments]);

    const settleTableBill = useCallback(async () => {
        if (!selectedTableNo || !restaurantId) return;

        const activeOrders = Array.isArray(selectedTable?.activeOrders) ? selectedTable.activeOrders : [];
        const tableKey = selectedTable?.assignmentKey || `table-${selectedTableNo.toLowerCase()}`;
        const paymentMode = billPaymentMethod === "UPI" ? "UPI" : "CASH";

        if (!activeOrders.length) {
            showToast({
                title: "Table already free",
                message: `Table ${selectedTableNo} has no active bill to settle.`,
                variant: "success",
            });
            return;
        }

        setSettlingBill(true);
        try {
            await api.post(`/owner/${restaurantId}/tables/${encodeURIComponent(selectedTableNo)}/settle-bill`, {
                paymentMode,
                changedByName: user?.name || "Server",
            });

            clearTableAssignment(tableKey);
            await refreshAll();
            setShowBillPanel(false);
            showToast({
                title: "Bill settled",
                message: `Table ${selectedTableNo} paid via ${paymentMode} and cleared automatically.`,
                variant: "success",
            });
        } catch (err) {
            console.log(err);
            showToast({
                title: "Unable to settle bill",
                message: err?.response?.data?.message || "Failed to mark the bill as paid.",
                variant: "error",
            });
        } finally {
            setSettlingBill(false);
        }
    }, [
        billPaymentMethod,
        clearTableAssignment,
        refreshAll,
        restaurantId,
        selectedTable,
        selectedTableNo,
        user?.name,
    ]);

    const createOrder = useCallback(() => {
        if (!socket || !connected) {
            showToast({ title: "Offline", message: "Server socket is not connected.", variant: "error" });
            return;
        }
        if (!selectedTableNo) {
            showToast({ title: "Pick a table", message: "Select a table first.", variant: "error" });
            return;
        }
        if (!cartItems.length) {
            showToast({ title: "Empty order", message: "Add at least one item.", variant: "error" });
            return;
        }

        setPlacing(true);
        socket.emit(
            "order:create",
            {
                orderType: "DINE_IN",
                tableNo: selectedTableNo,
                notes: notes ? String(notes).trim() : null,
                items: cartItems.map((item) => ({
                    menuItemId: item.menuItemId,
                    qty: item.qty,
                    preparedByName: item.chefName || null,
                })),
            },
            async (ack) => {
                try {
                    if (ack?.ok) {
                        showToast({
                            title: "Order created",
                            message:
                                sendMode === "ROK"
                                    ? ack?.order?.orderNo
                                        ? `${ack.order.orderNo} sent. Draft kept for resend.`
                                        : "The order has been sent. Draft kept for resend."
                                    : ack?.order?.orderNo || "The order has been sent to the kitchen.",
                            variant: "success",
                        });
                        if (sendMode !== "ROK") {
                            clearDraft();
                        }
                        await refreshTables({ force: true });
                        await loadOrders({ silent: true });
                        return;
                    }

                    showToast({
                        title: "Order failed",
                        message: String(ack?.message || "Unable to create order"),
                        variant: "error",
                    });
                } finally {
                    setPlacing(false);
                }
            }
        );
    }, [
        cartItems,
        clearDraft,
        connected,
        loadOrders,
        notes,
        refreshTables,
        selectedTableNo,
        socket,
        sendMode,
    ]);

    return (
        <div className="theme-page min-h-screen">
            <header className="theme-nav border-b px-3 py-3 sm:px-4 sm:py-4">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold sm:text-2xl">Server Console</h1>
                            <p className="theme-muted truncate text-xs sm:text-sm">
                                {restaurantName} • {connected ? "Live" : "Offline"}
                                {socketError ? ` (${socketError})` : ""}
                            </p>
                        </div>
                        <span className="theme-pill w-fit rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap">
                            {selectedTableNo ? `Table ${selectedTableNo}` : "No table selected"}
                        </span>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap md:items-center md:justify-end">
                        <button
                            type="button"
                            onClick={refreshAll}
                            className="theme-soft-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold md:w-auto md:flex-none"
                        >
                            {refreshingOrders || tablesLoading || menuLoading ? (
                                <LoaderCircle size={16} className="animate-spin" />
                            ) : (
                                <RefreshCw size={16} />
                            )}
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            className="w-full rounded-2xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 md:w-auto md:flex-none"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-2 py-3 sm:px-4 sm:py-5">
                <section className="space-y-3 sm:space-y-4">
                    <article className="theme-panel rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_58%,transparent)] p-3 sm:p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <div>
                                    <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                                        {selectedTableNo ? "Table no" : "Table selector"}
                                    </p>
                                    <h2 className="mt-1 text-xl font-bold">
                                        {selectedTableNo ? `Table ${selectedTableNo}` : "Choose a table"}
                                    </h2>
                                </div>
                                {selectedTableNo ? (
                                    <span className="theme-pill rounded-full px-2 py-1 text-[10px] font-semibold">
                                        {selectedTableOrders.length} active
                                    </span>
                                ) : null}
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                <label className="sr-only" htmlFor="table-selector">
                                    Select table
                                </label>
                                <select
                                    id="table-selector"
                                    value={selectedTableNo}
                                    onChange={(event) => setTable(event.target.value)}
                                    disabled={tablesLoading || allTables.length === 0}
                                    className="theme-input w-full rounded-2xl px-3 py-2 text-sm outline-none sm:min-w-[200px] sm:w-auto"
                                >
                                    <option value="">
                                        {tablesLoading
                                            ? "Loading tables..."
                                            : allTables.length === 0
                                                ? "No tables available"
                                                : "Select a table"}
                                    </option>
                                    {allTables.map((table) => (
                                        <option key={table.id} value={table.tableNo}>
                                            Table {table.tableNo} {table.isOccupied ? "• Occupied" : "• Free"}
                                            {table.seats ? ` • ${table.seats} seats` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {tablesError ? (
                            <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                                {tablesError}
                            </div>
                        ) : null}

                        {selectedTableNo ? (
                            <div
                                className={
                                    billPanelVisible
                                        ? "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
                                        : "mt-4"
                                }
                            >
                                <div className="space-y-3">
                                    <div className="rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2)_58%,transparent)] p-3 sm:p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                            <div>
                                                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                                                    Order details
                                                </p>
                                                <p className="mt-1 text-base font-semibold">Live tickets</p>
                                            </div>
                                            <span className="theme-pill rounded-full px-2 py-1 text-[10px] font-semibold">
                                                {selectedTableOrders.length} active
                                            </span>
                                        </div>

                                        <div className="mt-3 space-y-3">
                                            {ordersError ? (
                                                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                                                    {ordersError}
                                                </div>
                                            ) : null}

                                            {ordersLoading && selectedTableOrders.length === 0 ? (
                                                <div className="theme-muted text-sm">Loading live orders...</div>
                                            ) : selectedTableOrders.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_54%,transparent)] p-4 text-sm theme-muted">
                                                    No active order is linked to this table yet. Use the menu below to create one manually.
                                                </div>
                                            ) : (
                                                selectedTableOrders.map((order) => (
                                                    <LiveOrderCard key={order.id} order={order} />
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {selectedTableNo ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowBillPanel((prev) => !prev)}
                                            className={`inline-flex w-[88px] items-center justify-center whitespace-nowrap rounded-2xl px-2 py-1.5 text-[11px] font-semibold ${
                                                showBillPanel ? "theme-button" : "theme-soft-button"
                                            }`}
                                        >
                                            {showBillPanel ? "Hide Bill" : "Bill"}
                                        </button>
                                    ) : null}
                                </div>

                                {billPanelVisible ? (
                                    <div className="space-y-4">
                                        <article className="theme-panel rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_58%,transparent)] p-3 sm:p-4">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                                                        Bill total
                                                    </p>
                                                    <p className="mt-1 text-lg font-semibold">Settle payment</p>
                                                </div>
                                                <span className="theme-pill rounded-full px-2 py-1 text-[10px] font-semibold">
                                                    {selectedTableOrders.length} orders
                                                </span>
                                            </div>

                                            <div className="mt-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setBillPaymentMethod("CASH")}
                                                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                                                            billPaymentMethod === "CASH"
                                                                ? "theme-button"
                                                                : "theme-soft-button"
                                                        }`}
                                                    >
                                                        Cash
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setBillPaymentMethod("UPI")}
                                                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                                                            billPaymentMethod === "UPI"
                                                                ? "theme-button"
                                                                : "theme-soft-button"
                                                        }`}
                                                    >
                                                        UPI
                                                    </button>
                                                </div>

                                                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_54%,transparent)] p-3">
                                                    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                                        <span className="theme-muted">Table bill</span>
                                                        <span className="font-semibold tabular-nums">
                                                            {selectedTableOrders.length} active
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex flex-col gap-1 text-base sm:flex-row sm:items-center sm:justify-between">
                                                        <span className="font-semibold">Amount due</span>
                                                        <span className="font-bold tabular-nums">
                                                            {formatMoney(selectedTableBillTotal)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={settleTableBill}
                                                    disabled={!selectedTableOrders.length || settlingBill}
                                                    className="theme-button w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                                >
                                                    {settlingBill ? (
                                                        <span className="inline-flex items-center gap-2">
                                                            <LoaderCircle size={16} className="animate-spin" />
                                                            Settling...
                                                        </span>
                                                    ) : (
                                                        "Paid & Clear Table"
                                                    )}
                                                </button>

                                                <p className="theme-muted text-xs leading-5">
                                                    Choose Cash or UPI, then tap paid. The active bill will be marked
                                                    successful and the table will clear automatically.
                                                </p>
                                            </div>
                                        </article>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2)_58%,transparent)] p-6 text-sm theme-muted">
                                Select a table to start taking an order.
                            </div>
                        )}
                    </article>

                    {selectedTableNo ? (
                        <>
                            <article className="theme-panel rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_58%,transparent)] p-3 sm:p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="theme-muted text-xs uppercase tracking-[0.24em]">Menu</p>
                                        <p className="mt-1 text-lg font-semibold">Select items to prepare</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="relative w-full lg:max-w-xl">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={16} />
                                        <input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Search by name or category..."
                                            className="theme-input w-full rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none"
                                        />
                                    </div>

                                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {categories.map((category) => (
                                            <button
                                                key={category.key}
                                                type="button"
                                                onClick={() => setActiveCategory(category.key)}
                                                className={`theme-chip inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                    activeCategory === category.key ? "theme-chip-active" : ""
                                                }`}
                                            >
                                                <span>{category.icon}</span>
                                                <span>{category.label}</span>
                                                <span className="theme-pill rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                                                    {category.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {menuError ? (
                                    <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                                        {menuError}
                                    </div>
                                ) : null}

                                <div className="mt-4">
                                    {menuLoading ? (
                                        <div className="theme-muted text-sm">Loading menu...</div>
                                    ) : filteredMenu.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_54%,transparent)] p-4 text-sm theme-muted">
                                            No items match your search.
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-start justify-center gap-3 md:justify-start">
                                            {filteredMenu.map((item) => (
                                                <MenuCard
                                                    key={item.id}
                                                    item={item}
                                                    qty={cart[item.id]?.qty || 0}
                                                    disabled={!selectedTableNo}
                                                    onAdd={addItem}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </article>

                            <article className="theme-panel rounded-3xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_58%,transparent)] p-3 sm:p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="theme-muted text-xs uppercase tracking-[0.24em]">Draft order</p>
                                        <p className="mt-1 text-lg font-semibold">Manual items selected</p>
                                    </div>
                                    <span className="theme-pill rounded-full px-2 py-1 text-[10px] font-semibold">
                                        {cartItems.length} items
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="inline-flex w-fit rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2)_60%,transparent)] p-1">
                                        <button
                                            type="button"
                                            onClick={() => setSendMode("NORMAL")}
                                            className={`flex-none w-[2cm] rounded-xl px-2 py-1.5 text-xs font-semibold transition ${
                                                sendMode === "NORMAL"
                                                    ? "theme-button"
                                                    : "theme-soft-button"
                                            }`}
                                        >
                                            Fresh
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSendMode("ROK")}
                                            className={`flex-none w-[2cm] rounded-xl px-2 py-1.5 text-xs font-semibold transition ${
                                                sendMode === "ROK"
                                                    ? "theme-button"
                                                    : "theme-soft-button"
                                            }`}
                                        >
                                            ROK
                                        </button>
                                    </div>
                                    <p className="theme-muted text-xs">
                                        ROK keeps the current items after sending so you can send them again.
                                    </p>
                                </div>

                                <div className="mt-4 space-y-2">
                                    {cartItems.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_54%,transparent)] p-4 text-sm theme-muted">
                                            No items selected yet. Tap menu items to add them here.
                                        </div>
                                    ) : (
                                        cartItems.map((item) => (
                                            <CartRow
                                                key={item.id}
                                                item={item}
                                                chefOptions={chefs}
                                                onAdd={addItem}
                                                onSub={subItem}
                                                onRemove={removeItem}
                                                onSetChef={setItemChef}
                                            />
                                        ))
                                    )}
                                </div>

                                <div className="mt-4 border-t border-[color:var(--app-border)] pt-4">
                                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-2)_58%,transparent)] px-3 py-3">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="theme-muted">Items</span>
                                                <span className="font-semibold tabular-nums">{totalItems}</span>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-sm">
                                                <span className="font-semibold">Estimated Total</span>
                                                <span className="font-bold tabular-nums">{formatMoney(subtotal)}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={clearDraft}
                                                className="theme-soft-button inline-flex w-[2cm] items-center justify-center whitespace-nowrap rounded-2xl px-2 py-1.5 text-xs font-semibold"
                                                disabled={placing}
                                            >
                                                Clear
                                            </button>
                                            <button
                                                type="button"
                                                onClick={createOrder}
                                                disabled={!connected || placing || !selectedTableNo}
                                                className="theme-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {placing ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <LoaderCircle size={16} className="animate-spin" />
                                                        Sending...
                                                    </span>
                                                ) : (
                                                    sendMode === "ROK" ? "Send Again" : "Send to Kitchen"
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        </>
                    ) : null}
                </section>
            </main>
        </div>
    );
}
