import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    BadgeCheck,
    Clock3,
    History,
    LoaderCircle,
    Mail,
    Phone,
    RefreshCw,
    Sparkles,
    Trash2,
    UserRound,
    UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import useKitchenLiveBoardData from "../hooks/useKitchenLiveBoardData";
import {
    buildKitchenTicketRows,
    formatKitchenAge,
    formatKitchenMoney,
    getKitchenAssignmentHistoryStorageKey,
    getKitchenAssignmentsStorageKey,
    getKitchenMinutesSince,
    isLiveKitchenStatus,
    readKitchenAssignmentHistory,
    readKitchenAssignments,
} from "../utils/kitchenBoardStorage";

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

const ACCESS_LABELS = {
    dashboard: "Dashboard",
    orders: "Orders",
    menu: "Menu",
    tables: "Tables",
    kitchen: "Kitchen",
    analytics: "Analytics",
    finance: "Finance",
    staff: "Staff",
    settings: "Settings",
    notifications: "Notifications",
};

const formatLabel = (value) =>
    String(value || "")
        .replace(/_/g, " ")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

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

function DetailRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-3 rounded-[18px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-3">
            {Icon ? (
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(95,61,31,0.12)] bg-[rgba(255,248,239,0.9)] text-[var(--kitchen-ink)]">
                    <Icon size={15} />
                </span>
            ) : null}
            <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--kitchen-muted)]">
                    {label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-[var(--kitchen-ink)]">
                    {value || "-"}
                </p>
            </div>
        </div>
    );
}

function ActivityCard({ entry }) {
    const actionStyle = getActionStyle(entry);
    const actionLabel = getActionLabel(entry);

    return (
        <article className="rounded-[22px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-tight text-[var(--kitchen-ink)]">
                        {entry.itemName || "Item"}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--kitchen-muted)]">
                        {entry.orderRef || "Order"}
                        {entry.orderLabel ? ` - ${entry.orderLabel}` : ""}
                        {entry.qty ? ` - ${entry.qty} plate${Number(entry.qty) === 1 ? "" : "s"}` : ""}
                    </p>
                </div>

                <span className="kitchen-paper-chip" style={actionStyle}>
                    {actionLabel}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
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

            {entry.note ? <p className="mt-2 text-sm italic text-[var(--kitchen-muted)]">{entry.note}</p> : null}
        </article>
    );
}

function WorkItem({ ticket }) {
    return (
        <article className="rounded-[22px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-tight text-[var(--kitchen-ink)]">
                        {ticket.itemName}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--kitchen-muted)]">
                        {ticket.qty} plate{ticket.qty === 1 ? "" : "s"} - {ticket.orderRef} - {ticket.ageText}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                        {ticket.orderLabel || "Kitchen ticket"} - {String(ticket.orderStatus || "").replace(/_/g, " ")}
                    </p>
                </div>

                <span className="kitchen-paper-chip">Live</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold tabular-nums text-[var(--kitchen-ink)]">
                    {formatKitchenMoney(ticket.lineTotal)}
                </p>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--kitchen-muted)]">
                    {ticket.tableNo ? `Table ${ticket.tableNo}` : "Live item"}
                </p>
            </div>

            {ticket.notes ? <p className="mt-2 text-sm italic text-[var(--kitchen-muted)]">{ticket.notes}</p> : null}
        </article>
    );
}

export default function StaffProfile() {
    const { staffId: staffIdParam } = useParams();
    const targetStaffId = String(staffIdParam || "").trim();
    const { user } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(user?.restaurantId || 0);
    const restaurantName = String(user?.restaurant?.name || user?.restaurantName || "Restaurant").trim() || "Restaurant";

    const { orders, staffUsers, ordersLoading, staffLoading, refreshing, ordersError, staffError, lastSyncAt, refreshBoard } =
        useKitchenLiveBoardData(restaurantId, socket);
    const dataLoading = ordersLoading || staffLoading;

    const [assignments, setAssignments] = useState({});
    const [historyEntries, setHistoryEntries] = useState([]);

    useEffect(() => {
        if (!restaurantId) {
            setAssignments({});
            setHistoryEntries([]);
            return undefined;
        }

        setAssignments(readKitchenAssignments(restaurantId));
        setHistoryEntries(readKitchenAssignmentHistory(restaurantId));

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

    const activeOrders = useMemo(() => {
        const list = Array.isArray(orders) ? orders.filter((order) => isLiveKitchenStatus(order?.status)) : [];
        return list.sort(
            (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
        );
    }, [orders]);

    const staffById = useMemo(() => {
        const map = new Map();
        (Array.isArray(staffUsers) ? staffUsers : []).forEach((staffUser) => {
            map.set(String(staffUser?.id || ""), {
                ...staffUser,
                id: String(staffUser?.id || ""),
            });
        });
        if (String(user?.id || "").trim()) {
            map.set(String(user.id), {
                ...(map.get(String(user.id)) || {}),
                ...user,
                id: String(user.id),
            });
        }
        return map;
    }, [staffUsers, user]);

    const currentStaff = useMemo(() => {
        if (!targetStaffId) return null;
        return staffById.get(targetStaffId) || null;
    }, [staffById, targetStaffId]);

    const effectiveRole = resolveEffectiveStaffRole(currentStaff?.role || user?.role, currentStaff?.designation || user?.designation);
    const pageDesignation = String(currentStaff?.designation || "").trim() || formatLabel(effectiveRole);
    const pageTitle = String(currentStaff?.name || "").trim() || "Staff profile";
    const pageInitials = useMemo(() => {
        const parts = pageTitle.split(/\s+/).filter(Boolean).slice(0, 2);
        if (parts.length === 0) return "SP";
        return parts.map((part) => part[0]).join("").toUpperCase();
    }, [pageTitle]);
    const isChef = /CHEF/i.test(String(effectiveRole || "")) || /CHEF/i.test(pageDesignation);

    const assignmentsPruned = useMemo(() => {
        const next = {};
        activeOrders.forEach((ticket) => {
            const staffKey = String(assignments?.[ticket.itemKey] || "").trim();
            if (staffKey && staffById.has(staffKey)) {
                next[ticket.itemKey] = staffKey;
            }
        });
        return next;
    }, [activeOrders, assignments, staffById]);

    useEffect(() => {
        if (JSON.stringify(assignments) === JSON.stringify(assignmentsPruned)) return;
        setAssignments(assignmentsPruned);
    }, [assignments, assignmentsPruned]);

    const currentTickets = useMemo(() => {
        if (!targetStaffId) return [];
        return buildKitchenTicketRows(activeOrders).filter(
            (ticket) => String(assignmentsPruned?.[ticket.itemKey] || "").trim() === targetStaffId
        );
    }, [activeOrders, assignmentsPruned, targetStaffId]);

    const relevantHistory = useMemo(() => {
        if (!targetStaffId) return [];
        return historyEntries
            .filter(
                (entry) =>
                    String(entry?.chefId || "") === targetStaffId ||
                    String(entry?.previousChefId || "") === targetStaffId
            )
            .slice()
            .sort((left, right) => new Date(right?.timestamp || 0).getTime() - new Date(left?.timestamp || 0).getTime())
            .slice(0, 8);
    }, [historyEntries, targetStaffId]);

    const metrics = useMemo(() => {
        const oldestMinutes = currentTickets.reduce((max, ticket) => {
            const minutes = getKitchenMinutesSince(ticket.createdAt);
            if (minutes === null) return max;
            return Math.max(max, minutes);
        }, 0);

        return {
            liveOrders: activeOrders.length,
            currentItems: currentTickets.length,
            historyEvents: targetStaffId
                ? historyEntries.filter(
                      (entry) =>
                          String(entry?.chefId || "") === targetStaffId ||
                          String(entry?.previousChefId || "") === targetStaffId
                  ).length
                : historyEntries.length,
            oldestMinutes,
        };
    }, [activeOrders, currentTickets, historyEntries, targetStaffId]);

    const accessEntries = useMemo(() => {
        const access = currentStaff?.access || {};
        if (!access || typeof access !== "object") return [];
        return Object.entries(access)
            .filter(([, enabled]) => Boolean(enabled))
            .map(([key]) => ACCESS_LABELS[key] || formatLabel(key))
            .sort((a, b) => a.localeCompare(b));
    }, [currentStaff?.access]);

    const joinedLabel = useMemo(() => {
        const value = currentStaff?.createdAt;
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }, [currentStaff?.createdAt]);

    const updatedLabel = useMemo(() => {
        const value = currentStaff?.updatedAt;
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }, [currentStaff?.updatedAt]);

    const homePath = isChef
        ? `/kitchen/chef/${encodeURIComponent(targetStaffId)}`
        : ["WAITER", "CASHIER"].includes(String(effectiveRole || "").toUpperCase())
            ? "/server"
            : "/kitchen";

    if (!restaurantId) {
        return (
            <div className="theme-page kitchen-paper-page min-h-screen px-4 py-4 md:px-6 md:py-6">
                <div className="kitchen-paper-sheet mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col rounded-[32px] px-4 py-5 md:px-8 md:py-7">
                    <p className="text-sm text-[var(--kitchen-muted)]">Kitchen context is missing.</p>
                </div>
            </div>
        );
    }

    if (!currentStaff && !ordersLoading && !staffLoading) {
        return (
            <div className="theme-page kitchen-paper-page min-h-screen px-4 py-4 md:px-6 md:py-6">
                <div className="kitchen-paper-sheet mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col rounded-[32px] px-4 py-5 md:px-8 md:py-7">
                    <div className="rounded-[28px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-5 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                            Staff profile
                        </p>
                        <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--kitchen-ink)]">
                            Staff member not found
                        </h1>
                        <p className="mt-2 text-sm text-[var(--kitchen-muted)]">
                            The profile you opened does not exist in this restaurant.
                        </p>
                        <Link
                            to={homePath}
                            className="kitchen-paper-action mt-4 inline-flex w-fit items-center gap-2"
                        >
                            <ArrowLeft size={14} />
                            Back to board
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="theme-page kitchen-paper-page min-h-screen px-4 py-4 md:px-6 md:py-6">
            <div className="kitchen-paper-sheet mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col rounded-[32px] px-4 py-5 md:px-8 md:py-7">
                <header className="flex flex-col gap-6">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.8fr)_minmax(280px,0.85fr)] lg:items-start lg:gap-6">
                        <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
                            <Metric label="Live orders" value={metrics.liveOrders} hint="Orders currently on the board" />
                            <Metric label="Current load" value={metrics.currentItems} hint="Items assigned to this staff" />
                            <Metric label="History" value={metrics.historyEvents} hint="Assignment history events" />
                            <Metric label="Oldest" value={formatKitchenAge(metrics.oldestMinutes)} hint="Longest waiting current item" />
                        </dl>

                        <div className="flex flex-col gap-3 self-start text-center">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(95,61,31,0.14)] bg-[rgba(255,248,239,0.96)] text-2xl font-bold text-[var(--kitchen-ink)] shadow-[0_12px_26px_rgba(74,43,19,0.08)]">
                                {pageInitials}
                            </div>
                            <h1 className="font-serif text-3xl font-bold leading-[0.96] text-[var(--kitchen-ink)] md:text-4xl">
                                {pageTitle}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <span className="kitchen-paper-chip">{formatLabel(effectiveRole)}</span>
                                <span className="kitchen-paper-chip">{pageDesignation}</span>
                                <span
                                    className="kitchen-paper-chip"
                                    style={{
                                        backgroundColor: currentStaff?.isActive === false ? "rgba(249,115,22,0.12)" : "rgba(16,185,129,0.12)",
                                        borderColor: currentStaff?.isActive === false ? "rgba(249,115,22,0.24)" : "rgba(16,185,129,0.24)",
                                        color: currentStaff?.isActive === false ? "#7d4212" : "#0f766e",
                                    }}
                                >
                                    {currentStaff?.isActive === false ? "Inactive" : "Active"}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 text-sm lg:items-end lg:text-right">
                            <div className="flex flex-wrap gap-2 self-start lg:self-end">
                                <button
                                    type="button"
                                    onClick={refreshBoard}
                                    className="kitchen-paper-action"
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

                                <Link to={homePath} className="kitchen-paper-action">
                                    <ArrowLeft size={14} />
                                    Back to board
                                </Link>
                            </div>

                            <div className="space-y-1">
                                <p className="font-semibold text-[var(--kitchen-ink)]">{restaurantName}</p>
                                <p className="text-[var(--kitchen-muted)]">
                                    {String(currentStaff?.name || "Staff").trim() || "Staff"} - {pageDesignation}
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

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <section className="space-y-6">
                        <article className="rounded-[28px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                        Current live load
                                    </p>
                                    <h2 className="mt-2 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                                        Assigned items
                                    </h2>
                                </div>
                                <span className="kitchen-paper-chip">
                                    {currentTickets.length} item{currentTickets.length === 1 ? "" : "s"}
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {dataLoading ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <LoaderCircle size={16} className="animate-spin" />
                                        Loading live data...
                                    </div>
                                ) : null}

                                {!dataLoading && currentTickets.length === 0 ? (
                                    <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-[rgba(95,61,31,0.12)] bg-[rgba(255,248,239,0.66)] p-4 text-sm text-[var(--kitchen-muted)]">
                                        <UtensilsCrossed size={16} />
                                        No items are assigned to this staff member right now.
                                    </div>
                                ) : (
                                    currentTickets.map((ticket) => <WorkItem key={ticket.itemKey} ticket={ticket} />)
                                )}
                            </div>
                        </article>

                        <article className="rounded-[28px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                        Recent activity
                                    </p>
                                    <h2 className="mt-2 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                                        Assignment history
                                    </h2>
                                </div>
                                <span className="kitchen-paper-chip">
                                    {relevantHistory.length} shown
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {dataLoading ? (
                                    <div className="flex items-center gap-3 text-sm text-[var(--kitchen-muted)]">
                                        <LoaderCircle size={16} className="animate-spin" />
                                        Loading history...
                                    </div>
                                ) : relevantHistory.length === 0 ? (
                                    <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-[rgba(95,61,31,0.12)] bg-[rgba(255,248,239,0.66)] p-4 text-sm text-[var(--kitchen-muted)]">
                                        <History size={16} />
                                        No history is recorded for this staff member yet.
                                    </div>
                                ) : (
                                    relevantHistory.map((entry) => (
                                        <ActivityCard
                                            key={entry.id || `${entry.timestamp}-${entry.itemKey}`}
                                            entry={entry}
                                        />
                                    ))
                                )}
                            </div>
                        </article>
                    </section>

                    <aside className="space-y-6">
                        <article className="rounded-[28px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                        Profile details
                                    </p>
                                    <h3 className="mt-2 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                                        Staff card
                                    </h3>
                                </div>
                                <span className="kitchen-paper-chip">
                                    ID {targetStaffId || "-"}
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                <DetailRow icon={Mail} label="Email" value={currentStaff?.email} />
                                <DetailRow icon={Phone} label="Phone" value={currentStaff?.phone} />
                                <DetailRow icon={BadgeCheck} label="Role" value={formatLabel(effectiveRole)} />
                                <DetailRow icon={UserRound} label="Designation" value={pageDesignation} />
                                <DetailRow icon={Sparkles} label="Restaurant" value={restaurantName} />
                                <DetailRow icon={Clock3} label="Joined" value={joinedLabel} />
                                <DetailRow icon={Clock3} label="Updated" value={updatedLabel} />
                            </div>
                        </article>

                        <article className="rounded-[28px] border border-[rgba(95,61,31,0.12)] bg-[rgba(255,255,255,0.34)] p-4 shadow-[0_10px_22px_rgba(74,43,19,0.04)]">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--kitchen-muted)]">
                                        Access
                                    </p>
                                    <h3 className="mt-2 font-serif text-2xl font-bold text-[var(--kitchen-ink)]">
                                        Permissions
                                    </h3>
                                </div>
                                <span className="kitchen-paper-chip">
                                    {accessEntries.length} enabled
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {accessEntries.length === 0 ? (
                                    <p className="text-sm text-[var(--kitchen-muted)]">No extra access permissions are configured.</p>
                                ) : (
                                    accessEntries.map((label) => (
                                        <span key={label} className="kitchen-paper-chip">
                                            {label}
                                        </span>
                                    ))
                                )}
                            </div>
                        </article>

                        <article className="rounded-[28px] border border-red-500/20 bg-red-500/5 p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-red-500">
                                <Trash2 size={18} />
                                <h3 className="font-serif text-lg font-bold">Danger Zone</h3>
                            </div>
                            <p className="mt-1 text-xs text-[var(--kitchen-muted)]">
                                Permanently delete your account and profile data.
                            </p>
                            <div className="mt-3">
                                <Link
                                    to="/delete-account"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-500 transition hover:bg-red-500/20"
                                >
                                    <Trash2 size={14} />
                                    Delete Account
                                </Link>
                            </div>
                        </article>
                    </aside>
                </div>
            </div>
        </div>
    );
}
