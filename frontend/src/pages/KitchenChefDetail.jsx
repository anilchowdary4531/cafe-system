import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Bell,
    BellOff,
    CheckCircle2,
    ChefHat,
    History,
    LoaderCircle,
    RefreshCw,
    Sparkles,
    UtensilsCrossed,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import useKitchenLiveBoardData from "../hooks/useKitchenLiveBoardData";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import { playNotificationSound } from "../utils/soundPlayer";
import {
    buildKitchenTicketRows,
    appendKitchenAssignmentHistory,
    createKitchenAssignmentHistoryEntry,
    formatKitchenAge,
    formatKitchenMoney,
    getKitchenAssignmentHistoryStorageKey,
    getKitchenAssignmentsStorageKey,
    getKitchenMinutesSince,
    isLiveKitchenStatus,
    readKitchenAssignmentHistory,
    readKitchenAssignments,
    writeKitchenAssignments,
} from "../utils/kitchenBoardStorage";
import { showToast } from "../utils/toast";

const CHEF_PALETTES = [
    { avatar: "#f4d3a8", avatarInk: "#6f3e17", chipBg: "rgba(201, 108, 29, 0.14)", chipInk: "#7a4115", ring: "rgba(201, 108, 29, 0.34)" },
    { avatar: "#edd6b8", avatarInk: "#6b4020", chipBg: "rgba(176, 112, 62, 0.14)", chipInk: "#74431d", ring: "rgba(176, 112, 62, 0.34)" },
    { avatar: "#f0c6a1", avatarInk: "#7a4118", chipBg: "rgba(194, 85, 24, 0.14)", chipInk: "#803d12", ring: "rgba(194, 85, 24, 0.34)" },
    { avatar: "#f7dfb8", avatarInk: "#6d4518", chipBg: "rgba(141, 102, 42, 0.14)", chipInk: "#744b1d", ring: "rgba(141, 102, 42, 0.34)" },
    { avatar: "#ebd0a0", avatarInk: "#6a3f11", chipBg: "rgba(169, 113, 48, 0.14)", chipInk: "#744315", ring: "rgba(169, 113, 48, 0.34)" },
    { avatar: "#f3dcbc", avatarInk: "#69421b", chipBg: "rgba(214, 164, 55, 0.16)", chipInk: "#795514", ring: "rgba(214, 164, 55, 0.34)" },
];

const ACTION_STYLES = {
    ASSIGNED: {
        backgroundColor: "rgba(34, 197, 94, 0.14)",
        borderColor: "rgba(34, 197, 94, 0.24)",
        color: "#27623c",
    },
    REASSIGNED: {
        backgroundColor: "rgba(249, 115, 22, 0.14)",
        borderColor: "rgba(249, 115, 22, 0.24)",
        color: "#7d4212",
    },
    UNASSIGNED: {
        backgroundColor: "rgba(148, 163, 184, 0.16)",
        borderColor: "rgba(148, 163, 184, 0.26)",
        color: "#475569",
    },
    COMPLETED: {
        backgroundColor: "rgba(16, 185, 129, 0.14)",
        borderColor: "rgba(16, 185, 129, 0.28)",
        color: "#0f766e",
    },
};

const getActionLabel = (entry) => {
    const action = String(entry?.action || "ASSIGNED").toUpperCase();
    if (action === "REASSIGNED") return "Reassigned";
    if (action === "UNASSIGNED") return "Unassigned";
    if (action === "COMPLETED") return "Completed";
    return "Assigned";
};

const getActionStyle = (entry) => {
    const action = String(entry?.action || "ASSIGNED").toUpperCase();
    return ACTION_STYLES[action] || ACTION_STYLES.ASSIGNED;
};

const getTimeLabel = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getRelativeLabel = (timestamp) => {
    const age = formatKitchenAge(getKitchenMinutesSince(timestamp));
    if (!age || age === "-") return "-";
    return age === "just now" ? age : `${age} ago`;
};

function Metric({ label, value, hint }) {
    return (
        <div className="min-w-0 text-left">
            <dt className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kitchen-muted)]">
                {label}
            </dt>
            <dd className="mt-1 font-serif text-2xl font-bold leading-none text-[var(--kitchen-ink)]">
                {value}
            </dd>
            {hint ? <p className="mt-1 text-xs text-[var(--kitchen-muted)]">{hint}</p> : null}
        </div>
    );
}

function TicketCard({
    ticket,
    chef,
    chefLabel,
    onAction,
    actionLabel = "Complete",
    actionIcon = <CheckCircle2 size={14} />,
    actionStyle,
    actionDisabled = false,
    actionTitle,
}) {
    const assignedStyle = chef?.palette
        ? {
              backgroundColor: chef.palette.chipBg,
              borderColor: chef.palette.ring,
              color: chef.palette.chipInk,
          }
        : {
              backgroundColor: "rgba(255,255,255,0.5)",
              borderColor: "rgba(95, 61, 31, 0.16)",
              color: "var(--kitchen-muted)",
          };

    return (
        <article className="rounded-[24px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-tight text-[var(--kitchen-ink)]">
                        {ticket.itemName}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--kitchen-muted)]">
                        {ticket.qty} plate{ticket.qty === 1 ? "" : "s"} - {ticket.orderRef} - {ticket.ageText}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                        {ticket.orderLabel || "Kitchen ticket"} -{" "}
                        {String(ticket.orderStatus || "").replace(/_/g, " ")}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <span className="kitchen-paper-chip" style={assignedStyle}>
                        {chefLabel || chef?.name || "Chef"}
                    </span>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold tabular-nums text-[var(--kitchen-ink)]">
                    {formatKitchenMoney(ticket.lineTotal)}
                </p>

                <button
                    type="button"
                    onClick={() => onAction?.(ticket.itemKey)}
                    disabled={actionDisabled}
                    className="kitchen-paper-action"
                    style={
                        actionStyle || {
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            borderColor: "rgba(16, 185, 129, 0.24)",
                            color: "#0f766e",
                        }
                    }
                    title={actionTitle}
                >
                    {actionIcon}
                    {actionLabel}
                </button>
            </div>

            {ticket.notes ? <p className="mt-2 text-sm italic text-[var(--kitchen-muted)]">{ticket.notes}</p> : null}
        </article>
    );
}

function HistoryCard({ entry, chef }) {
    const actionStyle = getActionStyle(entry);
    const actionLabel = getActionLabel(entry);

    return (
        <article className="rounded-[24px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-serif text-xl font-bold text-[var(--kitchen-ink)]">
                        {entry.itemName || "Item"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--kitchen-muted)]">
                        {entry.orderRef || "Order"}
                        {entry.orderLabel ? ` - ${entry.orderLabel}` : ""}
                        {entry.qty ? ` - ${entry.qty} plate${Number(entry.qty) === 1 ? "" : "s"}` : ""}
                    </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="kitchen-paper-chip" style={actionStyle}>
                        {actionLabel}
                    </span>
                    <span className="kitchen-paper-chip">{entry.chefName || chef?.name || "Chef"}</span>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                <span>{getTimeLabel(entry.timestamp)}</span>
                <span>-</span>
                <span>{getRelativeLabel(entry.timestamp)}</span>
                {entry.orderStatus ? (
                    <>
                        <span>-</span>
                        <span>{String(entry.orderStatus).replace(/_/g, " ")}</span>
                    </>
                ) : null}
            </div>

            {entry.previousChefName ? (
                <p className="mt-3 text-sm text-[var(--kitchen-muted)]">
                    Previous chef: {entry.previousChefName}
                </p>
            ) : null}

            {entry.note ? <p className="mt-2 text-sm italic text-[var(--kitchen-muted)]">{entry.note}</p> : null}
        </article>
    );
}

export default function KitchenChefDetail() {
    const { chefId: chefIdParam } = useParams();
    const targetChefId = String(chefIdParam || "").trim();
    const { user } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(user?.restaurantId || 0);
    const restaurantName = String(user?.restaurant?.name || "Restaurant").trim() || "Restaurant";
    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation);

    const [assignments, setAssignments] = useState({});
    const [assignmentsReady, setAssignmentsReady] = useState(false);
    const [historyEntries, setHistoryEntries] = useState([]);
    const [historyReady, setHistoryReady] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
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

    const { orders, staffUsers, ordersLoading, staffLoading, refreshing, ordersError, staffError, lastSyncAt, refreshBoard } =
        useKitchenLiveBoardData(restaurantId, socket);

    useEffect(() => {
        if (!restaurantId) {
            setAssignments({});
            setAssignmentsReady(false);
            setHistoryEntries([]);
            setHistoryReady(false);
            return undefined;
        }

        setAssignments(readKitchenAssignments(restaurantId));
        setHistoryEntries(readKitchenAssignmentHistory(restaurantId));
        setAssignmentsReady(true);
        setHistoryReady(true);

        const onStorage = (event) => {
            if (event.key === getKitchenAssignmentsStorageKey(restaurantId)) {
                setAssignments(readKitchenAssignments(restaurantId));
            }
            if (event.key === getKitchenAssignmentHistoryStorageKey(restaurantId)) {
                setHistoryEntries(readKitchenAssignmentHistory(restaurantId));
            }
        };

        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [restaurantId]);

    useEffect(() => {
        if (!assignmentsReady || !restaurantId) return;
        writeKitchenAssignments(restaurantId, assignments);
    }, [assignments, assignmentsReady, restaurantId]);

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

    const currentChef = chefById.get(targetChefId) || null;

    const ticketRows = useMemo(() => buildKitchenTicketRows(activeOrders), [activeOrders]);

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
        if (JSON.stringify(assignments) === JSON.stringify(assignmentsPruned)) return;
        setAssignments(assignmentsPruned);
    }, [assignments, assignmentsPruned, assignmentsReady, ordersLoading, staffLoading]);

    const currentTickets = useMemo(() => {
        if (!targetChefId) return [];
        return ticketRows.filter((ticket) => String(assignmentsPruned?.[ticket.itemKey] || "").trim() === targetChefId);
    }, [assignmentsPruned, targetChefId, ticketRows]);

    const availableTickets = useMemo(() => {
        return ticketRows.filter((ticket) => !String(assignmentsPruned?.[ticket.itemKey] || "").trim());
    }, [assignmentsPruned, ticketRows]);

    const handleCompleteTicket = useCallback(
        (ticketKey) => {
            const normalizedTicketKey = String(ticketKey || "").trim();
            if (!normalizedTicketKey || !currentChef) return;

            const ticket = currentTickets.find((row) => row.itemKey === normalizedTicketKey);
            if (!ticket) return;

            const historyEntry = createKitchenAssignmentHistoryEntry({
                action: "COMPLETED",
                item: ticket,
                chef: currentChef,
                note: "Marked complete",
            });

            setAssignments((prev) => {
                const next = { ...(prev || {}) };
                delete next[normalizedTicketKey];
                return next;
            });

            const storedEntry = appendKitchenAssignmentHistory(restaurantId, historyEntry);
            if (storedEntry) {
                setHistoryEntries((prev) => [...prev, storedEntry]);
            }

            showToast({
                title: "Item completed",
                message: `${ticket.itemName} from ${ticket.orderRef} was marked complete.`,
                variant: "success",
                durationMs: 2000,
            });
        },
        [currentChef, currentTickets, restaurantId]
    );

    const handlePickTicket = useCallback(
        (ticketKey) => {
            const normalizedTicketKey = String(ticketKey || "").trim();
            if (!normalizedTicketKey || !currentChef || !targetChefId) return;

            const ticket = ticketRows.find((row) => row.itemKey === normalizedTicketKey);
            if (!ticket) return;

            const existingChefId = String(assignmentsPruned?.[normalizedTicketKey] || "").trim();
            if (existingChefId && existingChefId !== targetChefId) {
                const existingChef = chefById.get(existingChefId);
                showToast({
                    title: "Already taken",
                    message: `${ticket.itemName} is already assigned to ${existingChef?.name || "another chef"}.`,
                    variant: "error",
                    durationMs: 2200,
                });
                return;
            }

            const nextAssignments = {
                ...(assignments || {}),
                [normalizedTicketKey]: targetChefId,
            };

            setAssignments(nextAssignments);

            const storedEntry = appendKitchenAssignmentHistory(
                restaurantId,
                createKitchenAssignmentHistoryEntry({
                    action: "ASSIGNED",
                    item: ticket,
                    chef: currentChef,
                    note: "Picked from live orders",
                })
            );
            if (storedEntry) {
                setHistoryEntries((prev) => [...prev, storedEntry]);
            }

            showToast({
                title: "Order picked",
                message: `${ticket.itemName} from ${ticket.orderRef} is now yours.`,
                variant: "success",
                durationMs: 2000,
            });
        },
        [assignments, assignmentsPruned, chefById, currentChef, restaurantId, targetChefId, ticketRows]
    );

    const relevantHistory = useMemo(() => {
        if (!targetChefId) return [];
        return historyEntries
            .filter((entry) => String(entry?.chefId || "") === targetChefId || String(entry?.previousChefId || "") === targetChefId)
            .slice()
            .sort((left, right) => new Date(right?.timestamp || 0).getTime() - new Date(left?.timestamp || 0).getTime());
    }, [historyEntries, targetChefId]);

    const metrics = useMemo(() => {
        const liveOrdersCount = activeOrders.length;
        const oldestMinutes = currentTickets.reduce((max, ticket) => {
            const minutes = getKitchenMinutesSince(ticket.createdAt);
            if (minutes === null) return max;
            return Math.max(max, minutes);
        }, 0);
        const pastEvents = relevantHistory.length;

        return {
            liveOrdersCount,
            pastEvents,
            oldestMinutes,
        };
    }, [activeOrders, currentTickets, relevantHistory]);

    const pageTitle = currentChef?.name || "Chef";
    const pageDesignation = String(currentChef?.designation || "Chef").trim() || "Chef";
    const isSenior = /SENIOR/i.test(pageDesignation);

    useEffect(() => {
        if (!historyOpen && !soundModalOpen) return undefined;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                setHistoryOpen(false);
                setSoundModalOpen(false);
            }
        };

        const previousOverflow = typeof document !== "undefined" ? document.body.style.overflow : "";
        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            if (typeof document !== "undefined") {
                document.body.style.overflow = previousOverflow;
            }
        };
    }, [historyOpen, soundModalOpen]);

    if (!restaurantId) {
        return (
            <div className="theme-page kitchen-paper-page min-h-screen px-4 py-4 md:px-6 md:py-6">
                <div className="kitchen-paper-sheet mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col rounded-[32px] px-4 py-5 md:px-8 md:py-7">
                    <p className="text-sm text-[var(--kitchen-muted)]">Kitchen context is missing.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="theme-page kitchen-paper-page min-h-screen">
            {/* Standard Top Navigation Header */}
            <header className="theme-nav border-b px-4 py-4 md:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/kitchen"
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                            <ArrowLeft size={16} />
                            Kitchen Board
                        </Link>
                        <div>
                            <p className="theme-muted text-xs uppercase tracking-[0.28em]">{restaurantName}</p>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                {pageTitle}
                                <span
                                    className="kitchen-paper-chip text-xs font-normal"
                                    style={{
                                        backgroundColor: currentChef?.palette?.chipBg || "rgba(255,255,255,0.5)",
                                        borderColor: currentChef?.palette?.ring || "rgba(95, 61, 31, 0.18)",
                                        color: currentChef?.palette?.chipInk || "var(--kitchen-ink)",
                                    }}
                                >
                                    {pageDesignation}
                                </span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Notification Symbol Bell & Sound Alert Toggle */}
                        <button
                            type="button"
                            onClick={() => setSoundModalOpen(true)}
                            className="theme-soft-button relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                            title="Order Notification Sound Alerts"
                        >
                            {soundMuted ? (
                                <BellOff size={18} className="text-gray-400" />
                            ) : (
                                <Bell size={18} className="text-amber-500 animate-pulse" />
                            )}
                            <span>{soundMuted ? "Sound Muted" : "Order Alert On"}</span>
                            <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                        </button>

                        <button
                            type="button"
                            onClick={refreshBoard}
                            className="theme-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                            disabled={refreshing || ordersLoading || staffLoading}
                        >
                            {refreshing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
                <div className="kitchen-paper-sheet mx-auto flex flex-col rounded-[32px] px-4 py-5 md:px-8 md:py-7">
                    <header className="flex flex-col gap-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(180px,0.65fr)_minmax(280px,0.9fr)] lg:items-start lg:gap-6">
                            <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
                                <Metric label="Live orders" value={metrics.liveOrdersCount} hint="Orders currently on the board" />
                                <Metric label="Past" value={metrics.pastEvents} hint="Assignment history events" />
                                <Metric label="Oldest" value={formatKitchenAge(metrics.oldestMinutes)} hint="Longest waiting current item" />
                            </dl>

                            <div className="flex flex-col gap-3 self-start text-center">
                                <h2 className="font-serif text-2xl font-bold leading-[0.96] text-[var(--kitchen-ink)] md:text-3xl lg:text-4xl">
                                    {pageTitle}
                                </h2>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <span
                                        className="kitchen-paper-chip"
                                        style={{
                                            backgroundColor: currentChef?.palette?.chipBg || "rgba(255,255,255,0.5)",
                                            borderColor: currentChef?.palette?.ring || "rgba(95, 61, 31, 0.18)",
                                            color: currentChef?.palette?.chipInk || "var(--kitchen-ink)",
                                        }}
                                    >
                                        {pageDesignation}
                                    </span>
                                    {isSenior ? (
                                        <span className="kitchen-paper-chip">Senior</span>
                                    ) : null}
                                    {currentChef?.id ? (
                                        <Link
                                            to={`/staff/profile/${encodeURIComponent(String(currentChef.id))}`}
                                            className="kitchen-paper-chip"
                                        >
                                            Chef profile
                                        </Link>
                                    ) : (
                                        <span className="kitchen-paper-chip">{pageTitle ? "Chef profile" : "Chef"}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-3 text-sm lg:items-end lg:text-right">
                                <div className="space-y-1">
                                    <p className="font-semibold text-[var(--kitchen-ink)]">{restaurantName}</p>
                                    <p className="text-[var(--kitchen-muted)]">
                                        {String(currentChef?.name || "Chef").trim() || "Chef"} -{" "}
                                        {String(currentChef?.designation || effectiveRole || "Chef")
                                            .replace(/_/g, " ")
                                            .toLowerCase()
                                            .replace(/\b\w/g, (char) => char.toUpperCase())}
                                    </p>
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
                            </div>
                        </div>
                    </header>

                <div className="kitchen-paper-rule my-6" />

                {(ordersError || staffError) && (
                    <div className="mb-5 space-y-2 text-sm text-[#9a4e16]">
                        {ordersError ? <p>{ordersError}</p> : null}
                        {staffError ? <p>{staffError}</p> : null}
                    </div>
                )}

                <div className="grid min-h-0 gap-8 lg:flex-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                    <section className="min-h-0 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
                        <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                        Live orders to pick
                                    </p>
                                    <h3 className="mt-2 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                                        Pick from pass
                                    </h3>
                                </div>
                                <span className="kitchen-paper-chip">
                                    {availableTickets.length} open
                                </span>
                            </div>

                            <p className="mt-2 text-[12px] leading-5 text-[var(--kitchen-muted)]">
                                Tap Pick to claim an open ticket. It will move into your live load and appear in your history.
                            </p>

                            <div className="mt-4 min-h-0 space-y-3 lg:flex-1 lg:overflow-y-auto lg:pr-2">
                                {!historyReady || ordersLoading || staffLoading ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <LoaderCircle size={16} className="animate-spin" />
                                        Loading live orders...
                                    </div>
                                ) : !currentChef ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <ChefHat size={16} />
                                        Chef not found. Open a chef from the kitchen board.
                                    </div>
                                ) : availableTickets.length === 0 ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <UtensilsCrossed size={16} />
                                        No open tickets are waiting to be picked.
                                    </div>
                                ) : (
                                    availableTickets.map((ticket) => (
                                        <TicketCard
                                            key={ticket.itemKey}
                                            ticket={ticket}
                                            chef={null}
                                            chefLabel="Unassigned"
                                            onAction={handlePickTicket}
                                            actionLabel="Pick"
                                            actionIcon={<ChefHat size={14} />}
                                            actionStyle={{
                                                backgroundColor: "rgba(249, 115, 22, 0.12)",
                                                borderColor: "rgba(249, 115, 22, 0.24)",
                                                color: "#7d4212",
                                            }}
                                            actionTitle={`Pick ${ticket.itemName}`}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </section>

                    <aside className="min-h-0 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
                        <div className="flex shrink-0 items-end justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                    Current assigned items
                                </p>
                                <h2 className="mt-2 font-serif text-3xl font-bold text-[var(--kitchen-ink)]">
                                    Live load
                                </h2>
                            </div>

                            <p className="text-right text-xs uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                                {currentTickets.length} item{currentTickets.length === 1 ? "" : "s"}
                            </p>
                        </div>

                        <div className="mt-5 min-h-0 space-y-3 lg:flex-1 lg:overflow-y-auto lg:pr-2">
                            {!historyReady || ordersLoading || staffLoading ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <LoaderCircle size={16} className="animate-spin" />
                                    Loading assigned items...
                                </div>
                            ) : !currentChef ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <ChefHat size={16} />
                                    Chef not found. Open a chef from the kitchen board.
                                </div>
                            ) : currentTickets.length === 0 ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                    <UtensilsCrossed size={16} />
                                    No items are assigned to this chef right now.
                                </div>
                            ) : (
                                currentTickets.map((ticket) => (
                                    <TicketCard
                                        key={ticket.itemKey}
                                        ticket={ticket}
                                        chef={currentChef}
                                        onAction={handleCompleteTicket}
                                    />
                                ))
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setHistoryOpen(true)}
                            className="kitchen-paper-action mt-4 w-full justify-center lg:w-auto lg:self-end"
                        >
                            <History size={14} />
                            History
                        </button>
                    </aside>
                </div>

                {historyOpen ? (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,12,8,0.48)] px-4 py-6 backdrop-blur-sm"
                        onClick={() => setHistoryOpen(false)}
                        role="presentation"
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="Past assigned items history"
                            className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[rgba(95,61,31,0.16)] bg-[rgba(255,248,239,0.98)] shadow-[0_30px_90px_rgba(74,43,19,0.28)]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[rgba(95,61,31,0.1)] px-5 py-4">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                        Past assigned items
                                    </p>
                                    <h3 className="mt-2 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                                        History trail
                                    </h3>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setHistoryOpen(false)}
                                    className="kitchen-paper-action"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5 pr-3">
                                {!historyReady || ordersLoading || staffLoading ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <LoaderCircle size={16} className="animate-spin" />
                                        Loading history...
                                    </div>
                                ) : !currentChef ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <History size={16} />
                                        Chef not found. Open a chef from the kitchen board.
                                    </div>
                                ) : relevantHistory.length === 0 ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <History size={16} />
                                        No history found for this chef yet.
                                    </div>
                                ) : (
                                    relevantHistory.map((entry) => (
                                        <HistoryCard
                                            key={entry.id || `${entry.timestamp}-${entry.itemKey}`}
                                            entry={entry}
                                            chef={currentChef}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
                </div>
            </main>

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
                                    <p className="text-xs text-amber-200/70">Configure sound chime and view live ticket notifications</p>
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
