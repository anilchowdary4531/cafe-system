import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
    Bell,
    BellOff,
    ChefHat,
    GripVertical,
    LoaderCircle,
    LogOut,
    RefreshCw,
    Sparkles,
    UtensilsCrossed,
    Users,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import { playNotificationSound } from "../utils/soundPlayer";
import {
    appendKitchenAssignmentHistory,
    createKitchenAssignmentHistoryEntry,
    getKitchenAssignmentsStorageKey,
    readKitchenAssignments,
    writeKitchenAssignments,
} from "../utils/kitchenBoardStorage";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import { showToast } from "../utils/toast";

const ACTIVE_STATUSES = new Set(["PLACED", "ACCEPTED", "PREPARING", "READY"]);

const CHEF_PALETTES = [
    { avatar: "#f4d3a8", avatarInk: "#6f3e17", chipBg: "rgba(201, 108, 29, 0.14)", chipInk: "#7a4115", ring: "rgba(201, 108, 29, 0.34)" },
    { avatar: "#edd6b8", avatarInk: "#6b4020", chipBg: "rgba(176, 112, 62, 0.14)", chipInk: "#74431d", ring: "rgba(176, 112, 62, 0.34)" },
    { avatar: "#f0c6a1", avatarInk: "#7a4118", chipBg: "rgba(194, 85, 24, 0.14)", chipInk: "#803d12", ring: "rgba(194, 85, 24, 0.34)" },
    { avatar: "#f7dfb8", avatarInk: "#6d4518", chipBg: "rgba(141, 102, 42, 0.14)", chipInk: "#744b1d", ring: "rgba(141, 102, 42, 0.34)" },
    { avatar: "#ebd0a0", avatarInk: "#6a3f11", chipBg: "rgba(169, 113, 48, 0.14)", chipInk: "#744315", ring: "rgba(169, 113, 48, 0.34)" },
    { avatar: "#f3dcbc", avatarInk: "#69421b", chipBg: "rgba(214, 164, 55, 0.16)", chipInk: "#795514", ring: "rgba(214, 164, 55, 0.34)" },
];

const normalizeStatus = (status) => {
    const raw = String(status || "PLACED").trim().toUpperCase();
    return raw === "SERVED" ? "DELIVERED" : raw;
};

const isLiveKitchenStatus = (status) => ACTIVE_STATUSES.has(normalizeStatus(status));

const formatMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "Rs 0.00";
    return `Rs ${amount.toFixed(2)}`;
};

const formatStatusLabel = (status) => normalizeStatus(status).replace(/_/g, " ");

const getMinutesSince = (isoDate) => {
    if (!isoDate) return null;
    const time = new Date(isoDate).getTime();
    if (Number.isNaN(time)) return null;
    return Math.max(0, Math.floor((Date.now() - time) / 60000));
};

const formatAge = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const getInitials = (value) => {
    const parts = String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return "CH";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
};

const getStatusStyle = (status) => {
    const raw = normalizeStatus(status);
    if (raw === "READY") {
        return {
            backgroundColor: "rgba(34, 197, 94, 0.14)",
            borderColor: "rgba(34, 197, 94, 0.26)",
            color: "#27623c",
        };
    }
    if (raw === "PREPARING") {
        return {
            backgroundColor: "rgba(249, 115, 22, 0.14)",
            borderColor: "rgba(249, 115, 22, 0.26)",
            color: "#7d4212",
        };
    }
    if (raw === "ACCEPTED") {
        return {
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            borderColor: "rgba(59, 130, 246, 0.24)",
            color: "#275083",
        };
    }
    return {
        backgroundColor: "rgba(234, 179, 8, 0.14)",
        borderColor: "rgba(234, 179, 8, 0.26)",
        color: "#7d5b12",
    };
};

const areAssignmentsEqual = (left, right) => {
    const leftEntries = Object.entries(left || {});
    const rightEntries = Object.entries(right || {});
    if (leftEntries.length !== rightEntries.length) return false;

    return leftEntries.every(([key, value]) => String(right?.[key] || "") === String(value || ""));
};

const getEmptyOrderLabel = (order) => {
    const tableNo = String(order?.tableNo || "").trim();
    if (tableNo) return `Table ${tableNo}`;

    const source = String(order?.orderSource || "").trim().toUpperCase();
    if (source === "ONLINE") return "Online ticket";
    if (source === "POS") return "POS ticket";
    return "Kitchen ticket";
};

function Metric({ label, value, hint }) {
    return (
        <div className="min-w-0 w-full">
            <dt className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kitchen-muted)]">
                {label}
            </dt>
            <dd className="mt-0.5 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                {value}
            </dd>
            {hint ? <p className="mt-0.5 text-xs text-[var(--kitchen-muted)]">{hint}</p> : null}
        </div>
    );
}

function ChefStation({
    chef,
    palette,
    tickets,
    currentUserId,
    isDropTarget,
    detailHref,
    onDragOver,
    onDragLeave,
    onDrop,
}) {
    const uniqueOrders = new Set(tickets.map((ticket) => String(ticket.orderId || ""))).size;
    const isCurrentUser = String(chef?.id || "") === String(currentUserId || "");
    const designation = String(chef?.designation || "Chef").trim() || "Chef";
    const isSenior = /SENIOR/i.test(designation);
    const [showMoreItems, setShowMoreItems] = useState(false);
    const hiddenCount = Math.max(0, tickets.length - 2);
    const visibleTickets = showMoreItems ? tickets : tickets.slice(0, 2);
    const hasMoreItems = tickets.length > 2;

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`kitchen-paper-chef-row w-full text-left ${isDropTarget ? "is-drop-target" : ""}`}
        >
            <div className="flex items-start gap-2">
                <span
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-center shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                    style={{
                        backgroundColor: palette.avatar,
                        color: palette.avatarInk,
                        borderColor: palette.ring,
                    }}
                >
                    <span className="font-serif text-[15px] font-bold leading-none">{getInitials(chef?.name)}</span>
                    <ChefHat size={10} className="absolute bottom-1.5 right-1.5" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-serif text-base font-bold text-[var(--kitchen-ink)]">
                            {String(chef?.name || "Chef").trim() || "Chef"}
                        </p>
                        {isSenior ? (
                            <span
                                className="kitchen-paper-chip"
                                style={{
                                    backgroundColor: palette.chipBg,
                                    borderColor: palette.ring,
                                    color: palette.chipInk,
                                }}
                            >
                                Senior
                            </span>
                        ) : null}
                        {isCurrentUser ? (
                            <span
                                className="kitchen-paper-chip"
                                style={{
                                    backgroundColor: "rgba(255,255,255,0.58)",
                                    borderColor: "rgba(95, 61, 31, 0.18)",
                                    color: "var(--kitchen-ink)",
                                }}
                            >
                                You
                            </span>
                        ) : null}
                    </div>

                    <p className="mt-0.5 text-[11px] text-[var(--kitchen-muted)]">{designation}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                        {tickets.length} item{tickets.length === 1 ? "" : "s"} - {uniqueOrders} order
                        {uniqueOrders === 1 ? "" : "s"}
                    </p>
                </div>
            </div>

            <div className="mt-2 space-y-0.5 pl-[56px] text-[11px] text-[var(--kitchen-muted)]">
                {visibleTickets.length > 0 ? (
                    visibleTickets.map((ticket) => (
                        <p key={`${chef.id}-${ticket.itemKey}`} className="truncate">
                            {ticket.itemName} - {ticket.orderRef}
                        </p>
                    ))
                ) : (
                    <p className="italic">Waiting for a ticket to land.</p>
                )}
                {hasMoreItems ? (
                    <button
                        type="button"
                        onClick={() => setShowMoreItems((prev) => !prev)}
                        className="kitchen-paper-chip mt-1 cursor-pointer px-2 py-1 text-[10px] transition hover:opacity-80"
                        aria-expanded={showMoreItems}
                        aria-label={showMoreItems ? "Show fewer items" : `Show ${hiddenCount} more items`}
                    >
                        {showMoreItems ? "Show less" : `+${hiddenCount} more`}
                    </button>
                ) : null}
            </div>
            {detailHref ? (
                <div className="mt-2 flex justify-end">
                    <Link to={detailHref} className="kitchen-paper-action px-2.5 py-1 text-[10px]">
                        Open chef page
                    </Link>
                </div>
            ) : null}
        </div>
    );
}

function TicketRow({
    ticket,
    assignedChef,
    palette,
    draggingItemKey,
    onDragStart,
    onDragEnd,
    onUnassign,
}) {
    const isDragging = draggingItemKey === ticket.itemKey;
    const assignedStyle = assignedChef
        ? {
              backgroundColor: palette?.chipBg || "rgba(255,255,255,0.5)",
              borderColor: palette?.ring || "rgba(95, 61, 31, 0.18)",
              color: palette?.chipInk || "var(--kitchen-ink)",
          }
        : {
              backgroundColor: "rgba(255,255,255,0.5)",
              borderColor: "rgba(95, 61, 31, 0.16)",
              color: "var(--kitchen-muted)",
          };

    return (
        <div
            draggable
            onDragStart={(event) => onDragStart(event, ticket)}
            onDragEnd={onDragEnd}
            className={`kitchen-paper-item-row group ${isDragging ? "is-dragging" : ""}`}
        >
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(95,61,31,0.16)] bg-[rgba(255,255,255,0.54)] text-[var(--kitchen-muted)]">
                <GripVertical size={12} />
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold leading-tight text-[var(--kitchen-ink)]">
                            {ticket.itemName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--kitchen-muted)]">
                            {ticket.qty} plate{ticket.qty === 1 ? "" : "s"} - {ticket.orderRef} - {ticket.ageText}
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <span className="kitchen-paper-chip" style={assignedStyle}>
                            {assignedChef ? assignedChef.name : "Unassigned"}
                        </span>
                        {assignedChef ? (
                            <button
                                type="button"
                                onClick={() => onUnassign(ticket.itemKey)}
                                className="kitchen-paper-action px-2 py-1 text-[10px]"
                                title="Remove assignment"
                                aria-label={`Unassign ${ticket.itemName}`}
                            >
                                <X size={10} />
                            </button>
                        ) : null}
                    </div>
                </div>

                {ticket.notes ? (
                    <p className="mt-1 text-[11px] italic text-[var(--kitchen-muted)]">{ticket.notes}</p>
                ) : null}
            </div>
        </div>
    );
}

function OrderBlock({
    order,
    tickets,
    assignments,
    chefById,
    draggingItemKey,
    onDragStart,
    onDragEnd,
    onUnassign,
}) {
    const minutesSince = getMinutesSince(order?.createdAt);
    const statusStyle = getStatusStyle(order?.status);
    const ticketCount = tickets.reduce((sum, ticket) => sum + Number(ticket.qty || 0), 0);

    return (
        <section className="kitchen-paper-rule pb-3 pt-3 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-serif text-[1.35rem] font-bold leading-tight text-[var(--kitchen-ink)]">
                        {order?.orderNo || `#${order?.id || "-"}`}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.24em] text-[var(--kitchen-muted)]">
                        {getEmptyOrderLabel(order)} - {ticketCount} plate{ticketCount === 1 ? "" : "s"} -{" "}
                        {formatAge(minutesSince)} old
                    </p>
                </div>

                <div className="text-right">
                    <span className="kitchen-paper-chip" style={statusStyle}>
                        {formatStatusLabel(order?.status)}
                    </span>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--kitchen-ink)]">
                        {formatMoney(order?.total)}
                    </p>
                </div>
            </div>

            {String(order?.notes || "").trim() ? (
                <p className="mt-2 max-w-3xl text-[11px] italic text-[var(--kitchen-muted)]">
                    "{String(order.notes).trim()}"
                </p>
            ) : null}

            <div className="mt-2">
                {tickets.map((ticket) => {
                    const assignedChefId = String(assignments?.[ticket.itemKey] || "").trim();
                    const assignedChef = assignedChefId ? chefById.get(assignedChefId) : null;
                    const palette =
                        assignedChef && assignedChef.palette ? assignedChef.palette : null;

                    return (
                        <TicketRow
                            key={ticket.itemKey}
                            ticket={ticket}
                            assignedChef={assignedChef}
                            palette={palette}
                            draggingItemKey={draggingItemKey}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onUnassign={onUnassign}
                        />
                    );
                })}
            </div>
        </section>
    );
}

export default function Kitchen() {
    const { user, logout } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(user?.restaurantId || 0);
    const restaurantName = String(user?.restaurant?.name || "Restaurant").trim() || "Restaurant";
    const currentUserId = String(user?.id || "");
    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation);
    const isSeniorChef = /SENIOR/i.test(String(user?.designation || ""));
    const titleLabel = isSeniorChef ? "Senior Chef Dispatch" : "Kitchen Dispatch";
    const shouldRedirectToChefDetail = effectiveRole === "CHEF" && !isSeniorChef && Boolean(currentUserId);

    const [orders, setOrders] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [ordersError, setOrdersError] = useState("");
    const [staffError, setStaffError] = useState("");
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [assignments, setAssignments] = useState({});
    const [assignmentsReady, setAssignmentsReady] = useState(false);
    const [draggingItemKey, setDraggingItemKey] = useState("");
    const [dropChefId, setDropChefId] = useState("");
    const [soundModalOpen, setSoundModalOpen] = useState(false);
    const [soundMuted, setSoundMuted] = useState(() => {
        try {
            return localStorage.getItem("tiffzy_kitchen_sound_muted") === "true";
        } catch {
            return false;
        }
    });

    const toggleSoundMute = () => {
        setSoundMuted((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("tiffzy_kitchen_sound_muted", String(next));
                if (!next) {
                    playNotificationSound();
                }
            } catch {
                // ignore
            }
            return next;
        });
    };

    const loadOrders = useCallback(
        async ({ initial = false } = {}) => {
            if (!restaurantId) return;

            if (initial) setOrdersLoading(true);

            try {
                const res = await api.get("/orders/live");
                const list = Array.isArray(res?.data?.orders) ? res.data.orders : [];
                setOrders(list);
                setOrdersError("");
                setLastSyncAt(new Date());
            } catch (err) {
                setOrdersError(err?.response?.data?.message || "Unable to load live kitchen orders.");
            } finally {
                if (initial) setOrdersLoading(false);
            }
        },
        [restaurantId]
    );

    const loadStaff = useCallback(
        async ({ initial = false } = {}) => {
            if (!restaurantId) return;

            if (initial) setStaffLoading(true);

            try {
                const res = await api.get(`/owner/${restaurantId}/staff`);
                const list = Array.isArray(res?.data?.users) ? res.data.users : [];
                setStaffUsers(list);
                setStaffError("");
                setLastSyncAt(new Date());
            } catch (err) {
                setStaffError(err?.response?.data?.message || "Unable to load chefs.");
            } finally {
                if (initial) setStaffLoading(false);
            }
        },
        [restaurantId]
    );

    const refreshBoard = useCallback(async () => {
        if (!restaurantId) return;
        setRefreshing(true);
        try {
            await Promise.all([loadOrders(), loadStaff()]);
            setLastSyncAt(new Date());
        } finally {
            setRefreshing(false);
        }
    }, [loadOrders, loadStaff, restaurantId]);

    useEffect(() => {
        if (!restaurantId) {
            setOrders([]);
            setStaffUsers([]);
            setAssignments({});
            setAssignmentsReady(false);
            setOrdersLoading(false);
            setStaffLoading(false);
            return undefined;
        }

        loadOrders({ initial: true });
        loadStaff({ initial: true });
        return undefined;
    }, [loadOrders, loadStaff, restaurantId]);

    useEffect(() => {
        if (!restaurantId) return;
        setAssignments(readKitchenAssignments(restaurantId));
        setAssignmentsReady(true);
    }, [restaurantId]);

    useEffect(() => {
        if (!assignmentsReady || !restaurantId) return;
        writeKitchenAssignments(restaurantId, assignments);
    }, [assignments, assignmentsReady, restaurantId]);

    useEffect(() => {
        if (typeof window === "undefined" || !restaurantId) return undefined;

        const onStorage = (event) => {
            if (event.key === getKitchenAssignmentsStorageKey(restaurantId)) {
                setAssignments(readKitchenAssignments(restaurantId));
            }
        };

        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [restaurantId]);

    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev.slice() : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((item) => Number(item?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                list[idx] = order;
                return list;
            });
            setLastSyncAt(new Date());
            const tableNo = String(order?.tableNo || "").trim();
            showToast({
                title: "New ticket arrived",
                message: tableNo ? `Table ${tableNo}` : "Kitchen ticket is live now.",
                variant: "info",
                durationMs: 1800,
            });
        };

        const onUpdated = (order) => {
            setOrders((prev) => {
                const list = Array.isArray(prev) ? prev.slice() : [];
                const id = Number(order?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((item) => Number(item?.id || 0) === id);
                if (idx === -1) return [order, ...list];
                list[idx] = order;
                return list;
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

    const activeOrders = useMemo(() => {
        const list = Array.isArray(orders) ? orders.filter((order) => isLiveKitchenStatus(order?.status)) : [];
        return list.sort(
            (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
        );
    }, [orders]);

    const chefs = useMemo(() => {
        const paletteByIndex = (index) => CHEF_PALETTES[index % CHEF_PALETTES.length];

        return (Array.isArray(staffUsers) ? staffUsers : [])
            .filter((staffUser) => String(staffUser?.role || "").toUpperCase() === "CHEF" && staffUser?.isActive !== false)
            .map((staffUser, index) => ({
                ...staffUser,
                id: String(staffUser?.id || ""),
                palette: paletteByIndex(index),
            }))
            .sort((a, b) => {
                const aSenior = /SENIOR/i.test(String(a?.designation || ""));
                const bSenior = /SENIOR/i.test(String(b?.designation || ""));
                if (aSenior !== bSenior) return aSenior ? -1 : 1;
                return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
                    sensitivity: "base",
                });
            });
    }, [staffUsers]);

    const chefById = useMemo(() => {
        const map = new Map();
        chefs.forEach((chef) => {
            map.set(String(chef.id || ""), chef);
        });
        return map;
    }, [chefs]);

    const ticketRows = useMemo(() => {
        const rows = [];

        activeOrders.forEach((order) => {
            const items = Array.isArray(order?.items) ? order.items : [];
            items.forEach((item, index) => {
                const itemKey = String(item?.id || `${order?.id || "order"}:${index}`);
                const qty = Math.max(1, Number(item?.qty || 1));
                const lineTotal = Number(item?.total || Number(item?.price || 0) * qty);
                const orderRef = String(order?.orderNo || `#${order?.id || "-"}`).trim();
                const ageText = formatAge(getMinutesSince(order?.createdAt));

                rows.push({
                    itemKey,
                    orderId: Number(order?.id || 0),
                    orderRef,
                    orderStatus: normalizeStatus(order?.status),
                    orderLabel: getEmptyOrderLabel(order),
                    itemName: String(item?.itemName || "Item").trim() || "Item",
                    qty,
                    lineTotal,
                    notes: String(order?.notes || "").trim(),
                    ageText,
                });
            });
        });

        return rows;
    }, [activeOrders]);

    const assignmentsPruned = useMemo(() => {
        const next = {};
        ticketRows.forEach((ticket) => {
            const chefId = String(assignments?.[ticket.itemKey] || "").trim();
            if (chefId && chefById.has(chefId)) {
                next[ticket.itemKey] = chefId;
            }
        });
        return next;
    }, [assignments, chefById, ticketRows]);

    useEffect(() => {
        if (!assignmentsReady || ordersLoading || staffLoading) return;
        if (areAssignmentsEqual(assignments, assignmentsPruned)) return;
        setAssignments(assignmentsPruned);
    }, [assignments, assignmentsPruned, assignmentsReady, ordersLoading, staffLoading]);

    const ticketsByChef = useMemo(() => {
        const map = new Map();
        chefs.forEach((chef) => {
            map.set(String(chef.id || ""), []);
        });

        ticketRows.forEach((ticket) => {
            const chefId = String(assignmentsPruned?.[ticket.itemKey] || "").trim();
            if (!chefId || !map.has(chefId)) return;
            map.get(chefId).push(ticket);
        });

        return map;
    }, [assignmentsPruned, chefs, ticketRows]);

    const metrics = useMemo(() => {
        const itemQty = ticketRows.reduce((sum, ticket) => sum + Number(ticket.qty || 0), 0);
        const assignedQty = ticketRows.reduce((sum, ticket) => {
            const chefId = String(assignmentsPruned?.[ticket.itemKey] || "").trim();
            return chefId ? sum + Number(ticket.qty || 0) : sum;
        }, 0);
        const unassignedQty = Math.max(0, itemQty - assignedQty);
        const totalValue = ticketRows.reduce((sum, ticket) => sum + Number(ticket.lineTotal || 0), 0);
        const uniqueTables = new Set(
            activeOrders
                .map((order) => String(order?.tableNo || "").trim())
                .filter(Boolean)
        ).size;
        const oldestMinutes = activeOrders.reduce((max, order) => {
            const minutes = getMinutesSince(order?.createdAt);
            if (minutes === null) return max;
            return Math.max(max, minutes);
        }, 0);

        return {
            orderCount: activeOrders.length,
            itemQty,
            assignedQty,
            unassignedQty,
            totalValue,
            chefCount: chefs.length,
            uniqueTables,
            oldestMinutes,
        };
    }, [activeOrders, assignmentsPruned, chefs.length, ticketRows]);

    const handleDragStart = useCallback((event, ticket) => {
        const itemKey = String(ticket?.itemKey || "").trim();
        if (!itemKey) return;

        setDraggingItemKey(itemKey);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", itemKey);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggingItemKey("");
        setDropChefId("");
    }, []);

    const assignTicketToChef = useCallback(
        (ticketKey, chefId) => {
            const normalizedTicketKey = String(ticketKey || "").trim();
            const normalizedChefId = String(chefId || "").trim();
            if (!normalizedTicketKey || !normalizedChefId) return;
            if (!chefById.has(normalizedChefId)) return;
            if (!ticketRows.some((ticket) => ticket.itemKey === normalizedTicketKey)) return;

            const previousChefId = String(assignmentsPruned?.[normalizedTicketKey] || "").trim();
            if (previousChefId === normalizedChefId) return;

            setAssignments((prev) => ({
                ...(prev || {}),
                [normalizedTicketKey]: normalizedChefId,
            }));

            const chef = chefById.get(normalizedChefId);
            const ticket = ticketRows.find((row) => row.itemKey === normalizedTicketKey);
            const previousChef = previousChefId ? chefById.get(previousChefId) : null;
            appendKitchenAssignmentHistory(
                restaurantId,
                createKitchenAssignmentHistoryEntry({
                    action: previousChefId ? "REASSIGNED" : "ASSIGNED",
                    item: ticket,
                    chef,
                    previousChef,
                })
            );

            showToast({
                title: `Assigned to ${chef?.name || "chef"}`,
                message: ticket
                    ? `${ticket.itemName} from ${ticket.orderRef}`
                    : "Kitchen ticket updated.",
                variant: "success",
                durationMs: 2000,
            });
        },
        [assignmentsPruned, chefById, restaurantId, ticketRows]
    );

    const handleChefDrop = useCallback(
        (event, chefId) => {
            event.preventDefault();
            const droppedKey = String(event.dataTransfer.getData("text/plain") || draggingItemKey || "").trim();
            if (!droppedKey) return;

            assignTicketToChef(droppedKey, chefId);
            setDraggingItemKey("");
            setDropChefId("");
        },
        [assignTicketToChef, draggingItemKey]
    );

    const handleUnassign = useCallback(
        (ticketKey) => {
            const normalizedTicketKey = String(ticketKey || "").trim();
            if (!normalizedTicketKey) return;

            const previousChefId = String(assignmentsPruned?.[normalizedTicketKey] || "").trim();
            if (!previousChefId) return;

            const ticket = ticketRows.find((row) => row.itemKey === normalizedTicketKey);
            const previousChef = chefById.get(previousChefId);

            setAssignments((prev) => {
                const next = { ...(prev || {}) };
                delete next[normalizedTicketKey];
                return next;
            });

            appendKitchenAssignmentHistory(
                restaurantId,
                createKitchenAssignmentHistoryEntry({
                    action: "UNASSIGNED",
                    item: ticket,
                    chef: previousChef,
                    note: "Removed from the board",
                })
            );
        },
        [assignmentsPruned, chefById, restaurantId, ticketRows]
    );

    const clearBoard = useCallback(() => {
        Object.entries(assignmentsPruned || {}).forEach(([itemKey, chefId]) => {
            const ticket = ticketRows.find((row) => row.itemKey === itemKey);
            const chef = chefById.get(String(chefId || "").trim());
            if (!ticket || !chef) return;
            appendKitchenAssignmentHistory(
                restaurantId,
                createKitchenAssignmentHistoryEntry({
                    action: "UNASSIGNED",
                    item: ticket,
                    chef,
                    note: "Board cleared",
                })
            );
        });

        setAssignments({});
        setDraggingItemKey("");
        setDropChefId("");
        showToast({
            title: "Board cleared",
            message: "All chef assignments were removed from this device.",
            variant: "success",
            durationMs: 1800,
        });
    }, [assignmentsPruned, chefById, restaurantId, ticketRows]);

    const boardSubtitle = useMemo(() => {
        const name = String(user?.name || "Kitchen team").trim() || "Kitchen team";
        const role =
            String(user?.designation || "").trim() ||
            String(effectiveRole || "Chef")
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());
        return `${name} - ${role}`;
    }, [effectiveRole, user?.designation, user?.name]);

    if (shouldRedirectToChefDetail) {
        return <Navigate to={`/kitchen/chef/${currentUserId}`} replace />;
    }

    return (
        <div className="theme-page kitchen-paper-page min-h-screen overflow-hidden px-0 py-0">
            <div
                className="kitchen-paper-sheet flex min-h-screen w-full flex-col px-4 py-5 md:px-6 md:py-6 lg:h-screen lg:max-h-screen lg:overflow-hidden"
                style={{
                    border: "none",
                    borderRadius: 0,
                    boxShadow: "none",
                    marginLeft: 0,
                    marginRight: 0,
                    maxWidth: "none",
                    width: "100%",
                }}
            >
                <header className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-4xl">
                        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-[var(--kitchen-muted)]">
                            Kitchen Pass
                        </p>
                        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
                            <Metric label="Live orders" value={metrics.orderCount} hint="Tickets active on the pass" />
                            <Metric label="Items" value={metrics.itemQty} hint="Total plates and portions" />
                            <Metric label="Waiting" value={metrics.unassignedQty} hint="Still waiting for a chef" />
                            <Metric label="Handed off" value={metrics.assignedQty} hint="Already assigned to chefs" />
                            <Metric label="Stations" value={metrics.chefCount} hint="Active chefs on the floor" />
                            <Metric label="Oldest" value={formatAge(metrics.oldestMinutes)} hint="Longest waiting ticket" />
                        </dl>
                    </div>

                    <div className="flex flex-col items-start gap-2 text-sm lg:items-end lg:text-right">
                        <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <h1 className="font-serif text-2xl font-bold leading-tight text-[var(--kitchen-ink)] md:text-3xl lg:flex-1 lg:text-right">
                                {titleLabel}
                            </h1>

                            <button
                                type="button"
                                onClick={refreshBoard}
                                className="kitchen-paper-action self-start lg:self-end"
                                disabled={refreshing || ordersLoading || staffLoading}
                            >
                                {refreshing ? (
                                    <span className="inline-flex items-center gap-2">
                                        <LoaderCircle size={14} className="animate-spin" />
                                        Refreshing
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2">
                                        <RefreshCw size={14} />
                                        Refresh
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="space-y-0.5">
                            <p className="font-semibold text-[var(--kitchen-ink)]">{restaurantName}</p>
                            <p className="text-[var(--kitchen-muted)]">{boardSubtitle}</p>
                            <p className="inline-flex items-center gap-2 text-[var(--kitchen-muted)]">
                                <Sparkles size={14} />
                                {connected ? "Live socket connected" : "Live socket reconnecting"}
                                {socketError ? ` - ${socketError}` : ""}
                            </p>
                            {lastSyncAt ? (
                                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                                    Synced {lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSoundModalOpen(true)}
                                className="kitchen-paper-action"
                                title="Order Notification Sound Alerts"
                            >
                                <span className="inline-flex items-center gap-2">
                                    {soundMuted ? (
                                        <BellOff size={14} className="text-gray-400" />
                                    ) : (
                                        <Bell size={14} className="text-amber-500 animate-pulse" />
                                    )}
                                    {soundMuted ? "Sound Muted" : "Order Alert On"}
                                </span>
                            </button>

                            <button type="button" onClick={clearBoard} className="kitchen-paper-action">
                                Clear Assignments
                            </button>

                            <Link to="/owner" className="kitchen-paper-action">
                                Back Office
                            </Link>

                            <button type="button" onClick={logout} className="kitchen-paper-action">
                                <span className="inline-flex items-center gap-2">
                                    <LogOut size={14} />
                                    Logout
                                </span>
                            </button>
                        </div>
                    </div>
                </header>

                {(ordersError || staffError) && (
                    <div className="mb-5 space-y-2 text-sm text-[#9a4e16]">
                        {ordersError ? <p>{ordersError}</p> : null}
                        {staffError ? <p>{staffError}</p> : null}
                    </div>
                )}

                {/* Keep the chef board anchored on desktop while only the ticket rail scrolls. */}
                <div className="grid min-h-0 gap-8 lg:flex-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(260px,0.7fr)]">
                    <section className="order-2 lg:order-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:pr-6">
                        <div className="flex shrink-0 items-end justify-between gap-2">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kitchen-muted)]">
                                    Kitchen Tickets
                                </p>
                                <h2 className="mt-1 font-serif text-[1.45rem] font-bold leading-tight text-[var(--kitchen-ink)]">
                                    Live order slips
                                </h2>
                            </div>

                            <p className="text-right text-xs uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                                {metrics.uniqueTables} table{metrics.uniqueTables === 1 ? "" : "s"} in view
                            </p>
                        </div>

                        <div className="mt-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
                            {ordersLoading ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <LoaderCircle size={16} className="animate-spin" />
                                    Loading live orders...
                                </div>
                            ) : activeOrders.length === 0 ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <UtensilsCrossed size={16} />
                                    The pass is clear. New tickets will appear here in real time.
                                </div>
                            ) : (
                                <div>
                                    {activeOrders.map((order) => {
                                        const tickets = ticketRows.filter((ticket) => ticket.orderId === Number(order?.id || 0));
                                        return (
                                            <OrderBlock
                                                key={order.id}
                                                order={order}
                                                tickets={tickets}
                                                assignments={assignmentsPruned}
                                                chefById={chefById}
                                                draggingItemKey={draggingItemKey}
                                                onDragStart={handleDragStart}
                                                onDragEnd={handleDragEnd}
                                                onUnassign={handleUnassign}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="order-1 lg:order-2 lg:sticky lg:top-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden lg:pl-6">
                        <div className="flex shrink-0 items-end justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kitchen-muted)]">
                                    Chef Stations
                                </p>
                                <h2 className="mt-1 font-serif text-[1.45rem] font-bold leading-tight text-[var(--kitchen-ink)]">
                                    Drop tickets here
                                </h2>
                            </div>
                            <Users size={15} className="text-[var(--kitchen-muted)]" />
                        </div>

                        <p className="mt-2 text-[12px] leading-5 text-[var(--kitchen-muted)]">
                            Drag any item line from the tickets and drop it onto a chef. The item will stay pinned to
                            that chef until you move it again or clear the board.
                        </p>

                        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                            {staffLoading ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <LoaderCircle size={16} className="animate-spin" />
                                    Loading chefs...
                                </div>
                            ) : chefs.length === 0 ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <ChefHat size={16} />
                                    No active chefs found for this restaurant.
                                </div>
                            ) : (
                                chefs.map((chef) => {
                                    const chefTickets = ticketsByChef.get(String(chef.id || "")) || [];
                                    const palette = chef.palette;

                                    return (
                                        <ChefStation
                                            key={chef.id}
                                            chef={chef}
                                            palette={palette}
                                            tickets={chefTickets}
                                            currentUserId={currentUserId}
                                            isDropTarget={dropChefId === String(chef.id || "")}
                                            detailHref={`/kitchen/chef/${chef.id}`}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = "move";
                                                setDropChefId(String(chef.id || ""));
                                            }}
                                            onDragLeave={() => setDropChefId((prev) => (prev === String(chef.id || "") ? "" : prev))}
                                            onDrop={(event) => handleChefDrop(event, chef.id)}
                                        />
                                    );
                                })
                            )}
                        </div>

                    </aside>
                </div>
            </div>

            {soundModalOpen ? (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
                    onClick={() => setSoundModalOpen(false)}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Notification Sound Settings"
                        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-[rgba(217,200,175,0.25)] bg-[#181410] text-[#fff8e7] shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                                    <Bell size={20} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Kitchen Order Alerts & Sound</h3>
                                    <p className="text-xs text-amber-200/70">Configure sound chime when new live tickets arrive</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSoundModalOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Sound Mute Toggle Bar */}
                            <div className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-4">
                                <div className="flex items-center gap-3">
                                    {soundMuted ? <VolumeX size={20} className="text-gray-400" /> : <Volume2 size={20} className="text-amber-400" />}
                                    <div>
                                        <p className="text-sm font-bold text-white">{soundMuted ? "Sound Alerts Muted" : "Sound Alerts Active"}</p>
                                        <p className="text-xs text-amber-200/70">Plays chime automatically when live tickets arrive</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleSoundMute}
                                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                                        soundMuted
                                            ? "bg-amber-500 text-black hover:bg-amber-400"
                                            : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                    }`}
                                >
                                    {soundMuted ? "Unmute Sound" : "Mute Sound"}
                                </button>
                            </div>

                            {/* Sound Selector Component */}
                            <NotificationSoundPicker />

                            {/* Live Tickets Notification List */}
                            <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Live Ticket Alerts</h4>
                                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs text-amber-300 font-semibold">
                                        {ticketRows.length} Active
                                    </span>
                                </div>

                                {ticketRows.length === 0 ? (
                                    <p className="text-xs text-amber-100/60">No active ticket notifications currently.</p>
                                ) : (
                                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                        {ticketRows.slice(0, 10).map((ticket) => (
                                            <div key={ticket.itemKey} className="flex items-center justify-between rounded-xl bg-black/30 p-3 text-xs border border-white/5">
                                                <div>
                                                    <p className="font-bold text-white">{ticket.itemName} ({ticket.qty}x)</p>
                                                    <p className="text-[11px] text-amber-200/70">{ticket.orderRef} • {ticket.orderLabel}</p>
                                                </div>
                                                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                                                    {ticket.ageText}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    to="/owner/notifications"
                                    onClick={() => setSoundModalOpen(false)}
                                    className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 underline"
                                >
                                    Open Full Owner Notifications Page →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
